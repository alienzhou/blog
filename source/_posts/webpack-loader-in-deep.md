---
title: 你真的掌握了 webpack 么？- loader 十问
date: 2018-10-14 12:00:00
tags:
- webpack
- webpack-loader
- 自动化工具
---

「 你能回答这十问么？」

1. webpack默认配置是在哪处理的，loader有什么默认配置么？
2. webpack中有一个resolver的概念，用于解析模块文件的真实绝对路径，那么loader和普通模块的resolver使用的是同一个么？
3. 我们知道，除了config中的loader，还可以写inline的loader，那么inline loader和normal config loader执行的先后顺序是什么？
4. 配置中的`module.rules`在webpack中是如何生效与实现的？
5. webpack编译流程中loader是如何以及在何时发挥作用的？
6. loader为什么是自右向左执行的？
7. 如果在某个pitch中返回值，具体会发生什么？
8. 如果你写过loader，那么可能在loader function中用到了`this`，这里的`this`究竟是什么，是webpack实例么？
9. loader function中的`this.data`是如何实现的？
10. 如何写一个异步loader，webpack又是如何实现loader的异步化的？

<!-- more -->

## 1. loader 十问

在我学习webpack loader的过程中，也阅读了网上很多相关文章，收获不少。但是大多都只介绍了loader的配置方式或者loader的编写方式，对其中参数、api及其他细节的介绍并不清晰。

我在阅读loader源码前心中的疑问就是上面列出的「十问」，也许你也会有类似的疑问。下面我会结合loader相关的部分源码，为大家还原loader的设计与实现原理，解答这些疑惑。

## 2. loader运行的总体流程

webpack编译流程非常复杂，但其中涉及loader的部分主要包括了：

- loader（webpack）的默认配置
- 使用loaderResolver解析loader模块路径
- 根据`rule.modules`创建RulesSet规则集
- 使用loader-runner运行loader

其对应的大致流程如下：

![](/img/166713f3741bc389.png)

首先，在`Compiler.js`中会为将用户配置与默认配置合并，其中就包括了loader部分。

然后，webpack就会根据配置创建两个关键的对象——`NormalModuleFactory`和`ContextModuleFactory`。它们相当于是两个类工厂，通过其可以创建相应的`NormalModule`和`ContextModule`。其中`NormalModule`类是这篇文章主要关注的，webpack会为源码中的模块文件对应生成一个`NormalModule`实例。

在工厂创建`NormalModule`实例之前还有一些必要步骤，其中与loader最相关的就是通过loader的resolver来解析loader路径。

在`NormalModule`实例创建之后，则会通过其`.build()`方法来进行模块的构建。构建模块的第一步就是使用loader来加载并处理模块内容。而loader-runner这个库就是webpack中loader的运行器。

最后，将loader处理完的模块内容输出，进入后续的编译流程。

上面就是webpack中loader涉及到的大致流程。下面会结合源码对其进行具体的分析，而在源码阅读分析过程中，就会找到「loader十问」的解答。

## 3. loader运行部分的具体分析

### 3.1. webpack默认配置

> Q：1. webpack默认配置是在哪处理的，loader有什么默认配置么？

webpack和其他工具一样，都是通过配置的方式来工作的。随着webpack的不断进化，其默认配置也在不断变动；而曾经版本中的某些最佳实践，也随着版本的升级进入了webpack的默认配置。

webpack的入口文件是`lib/webpack.js`，会根据配置文件，设置编译时的配置options [(source code)](https://github.com/webpack/webpack/blob/master/lib/webpack.js#L37-L40)（上一篇[《可视化 webpack 内部插件与钩子关系📈》](/2018/09/30/webpack-plugin-hooks-visualization/)提到的plugin也是在这里触发的）

```javascript
options = new WebpackOptionsDefaulter().process(options);
compiler = new Compiler(options.context);
compiler.options = options;
```

由此可见，默认配置是放在`WebpackOptionsDefaulter`里的。因此，如果你想要查看当前webpack默认配置项具体内容，可以在[该模块](https://github.com/webpack/webpack/blob/master/lib/WebpackOptionsDefaulter.js)里查看。

例如，在`module.rules`这部分的默认值为`[]`；但是此外还有一个`module.defaultRules`配置项，虽然不开放给开发者使用，但是包含了loader的默认配置 [(source code)](https://github.com/webpack/webpack/blob/master/lib/WebpackOptionsDefaulter.js#L61-L87)：

```javascript
this.set("module.rules", []);
this.set("module.defaultRules", "make", options => [
    {
        type: "javascript/auto",
        resolve: {}
    },
    {
        test: /\.mjs$/i,
        type: "javascript/esm",
        resolve: {
            mainFields:
                options.target === "web" ||
                options.target === "webworker" ||
                options.target === "electron-renderer"
                    ? ["browser", "main"]
                    : ["main"]
        }
    },
    {
        test: /\.json$/i,
        type: "json"
    },
    {
        test: /\.wasm$/i,
        type: "webassembly/experimental"
    }
]);
```

> 此外值得一提的是，`WebpackOptionsDefaulter`继承自`OptionsDefaulter`，而`OptionsDefaulter`则是一个封装的配置项存取器，封装了一些特殊的方法来操作配置对象。

### 3.2. 创建`NormalModuleFactory`

`NormalModule`是webpack中不得不提的一个类函数。源码中的模块在编译过程中会生成对应的`NormalModule`实例。

`NormalModuleFactory`是`NormalModule`的工厂类。其创建是在`Compiler.js`中进行的，`Compiler.js`是webpack基本编译流程的控制类。`compiler.run()`方法中的主体（钩子）流程如下：

![](/img/166715d115c84870.png)

`.run()`在触发了一系列`beforeRun`、`run`等钩子后，会调用`.compile()`方法，其中的第一步就是调用`this.newCompilationParams()`创建`NormalModuleFactory`实例。

```javascript
newCompilationParams() {
    const params = {
        normalModuleFactory: this.createNormalModuleFactory(),
        contextModuleFactory: this.createContextModuleFactory(),
        compilationDependencies: new Set()
    };
    return params;
}
```

### 3.3. 解析（resolve）loader的真实绝对路径

> Q：2. webpack中有一个resolver的概念，用于解析模块文件的真实绝对路径，那么loader模块与normal module（源码模块）的resolver使用的是同一个么？

在`NormalModuleFactory`中，创建出`NormalModule`实例之前会涉及到四个钩子：

- beforeResolve
- resolve
- factory
- afterResolve

其中较为重要的有两个：

- resolve部分负责解析loader模块的路径（例如css-loader这个loader的模块路径是什么）；
- factory负责来基于resolve钩子的返回值来创建`NormalModule`实例。

`resolve`钩子上注册的方法较长，其中还包括了模块资源本身的路径解析。`resolver`有两种，分别是loaderResolver和normalResolver。

```javascript
const loaderResolver = this.getResolver("loader");
const normalResolver = this.getResolver("normal", data.resolveOptions);
```

由于除了config文件中可以配置loader外，还有inline loader的写法，因此，对loader文件的路径解析也分为两种：inline loader和config文件中的loader。resolver钩子中会先处理inline loader。

#### 3.3.1. inline loader 

```
import Styles from 'style-loader!css-loader?modules!./styles.css';
```

上面是一个inline loader的例子。其中的request为`style-loader!css-loader?modules!./styles.css`。

首先webpack会从request中解析出所需的loader [(source code)](https://github.com/webpack/webpack/blob/master/lib/NormalModuleFactory.js#L184-L187):

```javascript
let elements = requestWithoutMatchResource
    .replace(/^-?!+/, "")
    .replace(/!!+/g, "!")
    .split("!");
```

因此，从`style-loader!css-loader?modules!./styles.css`中可以取出两个loader：`style-loader`和`css-loader`。

然后会将“解析模块的loader数组”与“解析模块本身”一起并行执行，这里用到了[`neo-async`](https://github.com/suguru03/neo-async)这个库。

> `neo-async`库和`async`库类似，都是为异步编程提供一些工具方法，但是会比`async`库更快。

解析返回的结果格式大致如下：

```javascript
[ 
    // 第一个元素是一个loader数组
    [ { 
        loader:
            '/workspace/basic-demo/home/node_modules/html-webpack-plugin/lib/loader.js',
        options: undefined
    } ],
    // 第二个元素是模块本身的一些信息
    {
        resourceResolveData: {
            context: [Object],
            path: '/workspace/basic-demo/home/public/index.html',
            request: undefined,
            query: '',
            module: false,
            file: false,
            descriptionFilePath: '/workspace/basic-demo/home/package.json',
            descriptionFileData: [Object],
            descriptionFileRoot: '/workspace/basic-demo/home',
            relativePath: './public/index.html',
            __innerRequest_request: undefined,
            __innerRequest_relativePath: './public/index.html',
            __innerRequest: './public/index.html'
        },
	resource: '/workspace/basic-demo/home/public/index.html'
    }
]
```

其中第一个元素就是该模块被引用时所涉及的所有inline loader，包含loader文件的绝对路径和配置项。

#### 3.3.2. config loader

> Q：3. 我们知道，除了config中的loader，还可以写inline的loader，那么inline loader和normal config loader执行的先后顺序是什么？

上面一节中，webpack首先解析了inline loader的绝对路径与配置。接下来则是解析config文件中的loader [(source code)](https://github.com/webpack/webpack/blob/master/lib/NormalModuleFactory.js#L270-L279)，即`module.rules`部分的配置：

```javascript
const result = this.ruleSet.exec({
    resource: resourcePath,
    realResource:
        matchResource !== undefined
            ? resource.replace(/\?.*/, "")
            : resourcePath,
    resourceQuery,
    issuer: contextInfo.issuer,
    compiler: contextInfo.compiler
});
```

`NormalModuleFactory`中有一个`ruleSet`的属性，这里你可以简单理解为：它可以根据模块路径名，匹配出模块所需的loader。`RuleSet`细节此处先按下不表，其具体内容我会在下一节介绍。

这里向`this.ruleSet.exec()`中传入源码模块路径，返回的`result`就是当前模块匹配出的config中的loader。如果你熟悉webpack配置，会知道`module.rules`中有一个`enforce`字段。基于该字段，webpack会将loader分为preLoader、postLoader和loader三种 [(source code)](https://github.com/webpack/webpack/blob/master/lib/NormalModuleFactory.js#L284-L311)：

```javascript
for (const r of result) {
    if (r.type === "use") {
        // post类型
        if (r.enforce === "post" && !noPrePostAutoLoaders) {
            useLoadersPost.push(r.value);
        // pre类型
        } else if (
            r.enforce === "pre" &&
            !noPreAutoLoaders &&
            !noPrePostAutoLoaders
        ) {
            useLoadersPre.push(r.value);
        } else if (
            !r.enforce &&
            !noAutoLoaders &&
            !noPrePostAutoLoaders
        ) {
            useLoaders.push(r.value);
        }
    }
    // ……
}
```

最后，使用neo-aysnc来并行解析三类loader数组 [(source code)](https://github.com/webpack/webpack/blob/master/lib/NormalModuleFactory.js#L312-L335)：

```javascript
asyncLib.parallel(
    [
        this.resolveRequestArray.bind(
            this,
            contextInfo,
            this.context,
            useLoadersPost, // postLoader
            loaderResolver
        ),
        this.resolveRequestArray.bind(
            this,
            contextInfo,
            this.context,
            useLoaders, // loader
            loaderResolver
        ),
        this.resolveRequestArray.bind(
            this,
            contextInfo,
            this.context,
            useLoadersPre, // preLoader
            loaderResolver
        )
    ]
    // ……
}
```

那么最终loader的顺序究竟是什么呢？下面这一行代码可以解释：

```javascript
loaders = results[0].concat(loaders, results[1], results[2]);
```

其中`results[0]`、`results[1]`、`results[2]`、`loader`分别是postLoader、loader（normal config loader）、preLoader和inlineLoader。因此合并后的loader顺序是：post、inline、normal和pre。

然而loader是从右至左执行的，真实的loader执行顺序是倒过来的，因此inlineLoader是整体后于config中normal loader执行的。

### 3.3.3. RuleSet

> Q：4. 配置中的`module.rules`在webpack中是如何生效与实现的？

webpack使用`RuleSet`对象来匹配模块所需的loader。`RuleSet`相当于一个规则过滤器，会将resourcePath应用于所有的`module.rules`规则，从而筛选出所需的loader。其中最重要的两个方法是：

- 类静态方法`.normalizeRule()`
- 实例方法`.exec()`

webpack编译会根据用户配置与默认配置，实例化一个`RuleSet`。首先，通过其上的静态方法`.normalizeRule()`将配置值转换为标准化的test对象；其上还会存储一个`this.references`属性，是一个map类型的存储，key是loader在配置中的类型和位置，例如，`ref-2`表示loader配置数组中的第三个。

> p.s. 如果你在.compilation中某个钩子上打印出一些NormalModule上request相关字段，那些用到loader的模块会出现类似`ref-`的值。从这里就可以看出一个模块是否使用了loader，命中了哪个配置规则。

实例化后的`RuleSet`就可以用于为每个模块获取对应的loader。这个实例化的`RuleSet`就是我们上面提到的`NormalModuleFactory`实例上的`this.ruleSet`属性。工厂每次创建一个新的`NormalModule`时都会调用`RuleSet`实例的`.exec()`方法，只有当通过了各类测试条件，才会将该loader push到结果数组中。

### 3.4. 运行loader

#### 3.4.1. loader的运行时机

> Q：5. webpack编译流程中loader是如何以及在何时发挥作用的？

loader的绝对路径解析完毕后，在`NormalModuleFactory`的`factory`钩子中会创建当前模块的`NormalModule`对象。到目前为止，loader的前序工作已经差不多结束了，下面就是真正去运行各个loader。

我们都知道，运行loader读取与处理模块是webpack模块处理的第一步。但如果说到详细的运行时机，就涉及到webpack编译中`compilation`这个非常重要的对象。

webpack是以入口维度进行编译的，`compilation`中有一个重要方法——`.addEntry()`，会基于入口进行模块构建。`.addEntry()`方法中调用的`._addModuleChain()`会执行一系列的模块方法 [(source code)](https://github.com/webpack/webpack/blob/master/lib/Compilation.js#L996-L1010)

```javascript
this.semaphore.acquire(() => {
    moduleFactory.create(
        {
            // ……
        },
        (err, module) => {
            if (err) {
                this.semaphore.release();
                return errorAndCallback(new EntryModuleNotFoundError(err));
            }
            // ……
            if (addModuleResult.build) {
                // 模块构建
                this.buildModule(module, false, null, null, err => {
                    if (err) {
                        this.semaphore.release();
                        return errorAndCallback(err);
                    }

                    if (currentProfile) {
                        const afterBuilding = Date.now();
                        currentProfile.building = afterBuilding - afterFactory;
                    }

                    this.semaphore.release();
                    afterBuild();
                });
            }
        }
    )
}
```

其中，对于未build过的模块，最终会调用到`NormalModule`对象的[`.doBuild()`方法](https://github.com/webpack/webpack/blob/master/lib/NormalModule.js#L257)。而构建模块(`.doBuild()`)的第一步就是[运行所有的loader](https://github.com/webpack/webpack/blob/master/lib/NormalModule.js#L265)。

这时候，loader-runner就登场了。

#### 3.4.2. loader-runner —— loader的执行库

> Q：6. loader为什么是自右向左执行的？

![](/img/166726229bc58100.png)

webpack将loader的运行工具剥离出来，独立成了[loader-runner库](https://github.com/webpack/loader-runner)。因此，你可以编写一个loader，并用独立的loader-runner来测试loader的效果。

loader-runner分为了两个部分：loadLoader.js与LoaderRunner.js。

loadLoader.js是一个兼容性的模块加载器，可以加载例如cjs、esm或SystemJS这种的模块定义。而LoaderRunner.js则是loader模块运行的核心部分。其中暴露出来的`.runLoaders()`方法则是loader运行的启动方法。

如果你写过或了解如何编写一个loader，那么肯定知道，每个loader模块都支持一个`.pitch`属性，上面的方法会优先于loader的实际方法执行。实际上，webpack官方也给出了pitch与loader本身方法的执行顺序图：

```
|- a-loader `pitch`
  |- b-loader `pitch`
    |- c-loader `pitch`
      |- requested module is picked up as a dependency
    |- c-loader normal execution
  |- b-loader normal execution
|- a-loader normal execution
```

这两个阶段（pitch和normal）就是loader-runner中对应的`iteratePitchingLoaders()`和`iterateNormalLoaders()`两个方法。

`iteratePitchingLoaders()`会递归执行，并记录loader的`pitch`状态与当前执行到的`loaderIndex`（`loaderIndex++`）。当达到最大的loader序号时，才会处理实际的module：

```javascript
if(loaderContext.loaderIndex >= loaderContext.loaders.length)
    return processResource(options, loaderContext, callback);
```

当`loaderContext.loaderIndex`值达到整体loader数组长度时，表明所有pitch都被执行完毕（执行到了最后的loader），这时会调用`processResource()`来处理模块资源。主要包括：添加该模块为依赖和读取模块内容。然后会递归执行`iterateNormalLoaders()`并进行`loaderIndex--`操作，因此loader会“反向”执行。

接下来，我们讨论几个loader-runner的细节点：

> Q：7. 如果在某个pitch中返回值，具体会发生什么？

官网上说：

> if a loader delivers a result in the pitch method the process turns around and skips the remaining loaders

这段说明表示，在pitch中返回值会跳过余下的loader。这个表述比较粗略，其中有几个细节点需要说明：

首先，只有当`loaderIndex`达到最大数组长度，即pitch过所有loader后，才会执行`processResource()`。

```javascript
if(loaderContext.loaderIndex >= loaderContext.loaders.length)
    return processResource(options, loaderContext, callback);
```

因此，在pitch中返回值除了跳过余下loader外，不仅会使`.addDependency()`不触发（不将该模块资源添加进依赖），而且无法读取模块的文件内容。loader会将pitch返回的值作为“文件内容”来处理，并返回给webpack。

---

> Q：8. 如果你写过loader，那么可能在loader function中用到了`this`，这里的`this`究竟是什么，是webpack实例么？

其实这里的`this`既不是webpack实例，也不是compiler、compilation、normalModule等这些实例。而是一个[叫`loaderContext`的loader-runner特有对象](https://github.com/webpack/loader-runner/blob/master/lib/LoaderRunner.js#L263-L291)。

每次调用`runLoaders()`方法时，如果不显式传入context，则会默认创建一个新的`loaderContext`。所以在官网上提到的各种loader API（callback、data、loaderIndex、addContextDependency等）都是该对象上的属性。

---

> Q：9. loader function中的`this.data`是如何实现的？

知道了loader中的`this`其实是一个叫`loaderContext`的对象，那么`this.data`的实现其实就是`loaderContext.data`的实现 [(source code)](https://github.com/webpack/loader-runner/blob/master/lib/LoaderRunner.js#L346-L351)：

```javascript
Object.defineProperty(loaderContext, "data", {
    enumerable: true,
    get: function() {
        return loaderContext.loaders[loaderContext.loaderIndex].data;
    }
});
```

这里定义了一个`.data`的（存）取器。可以看出，调用`this.data`时，不同的normal loader由于`loaderIndex`不同，会得到不同的值；而pitch方法的形参`data`也是不同的loader下的data [(source code)](https://github.com/webpack/loader-runner/blob/master/lib/LoaderRunner.js#L177)。

```javascript
runSyncOrAsync(
    fn,
    loaderContext,
    [loaderContext.remainingRequest, loaderContext.previousRequest, currentLoaderObject.data = {}],
    function(err) {
        // ……
    }
);
```

`runSyncOrAsync()`中的数组`[loaderContext.remainingRequest, loaderContext.previousRequest, currentLoaderObject.data = {}]`就是pitch方法的入参，而`currentLoaderObject`就是当前`loaderIndex`所指的loader对象。

因此，如果你想要保存一个“贯穿始终”的数据，可以考虑保存在`this`的其他属性上，或者通过修改loaderIndex，来取到其他loader上的数据（比较hack）。

--- 

> Q：10. 如何写一个异步loader，webpack又是如何实现loader的异步化的？

pitch与normal loader的实际执行，都是在[`runSyncOrAsync()`](https://github.com/webpack/loader-runner/blob/master/lib/LoaderRunner.js#L90)这个方法中。

根据webpack文档，当我们调用`this.async()`时，会将loader变为一个异步的loader，并返回一个异步回调。

在具体实现上，`runSyncOrAsync()`内部有一个`isSync`变量，默认为`true`；当我们调用`this.async()`时，它会被置为`false`，并返回一个`innerCallback`作为异步执行完后的回调通知：

```javascript
context.async = function async() {
    if(isDone) {
        if(reportedError) return; // ignore
        throw new Error("async(): The callback was already called.");
    }
    isSync = false;
    return innerCallback;
};
```

我们一般都使用`this.async()`返回的callback来通知异步完成，但实际上，执行`this.callback()`也是一样的效果：

```javascript
var innerCallback = context.callback = function() {
    // ……
}
```

同时，在`runSyncOrAsync()`中，只有`isSync`标识为`true`时，才会在loader function执行完毕后立即（同步）回调callback来继续loader-runner。

```javascript
if(isSync) {
    isDone = true;
    if(result === undefined)
        return callback();
    if(result && typeof result === "object" && typeof result.then === "function") {
        return result.catch(callback).then(function(r) {
            callback(null, r);
        });
    }
    return callback(null, result);
}
```

看到这里你会发现，代码里有一处会判断返回值是否是Promise（`typeof result.then === "function"`），如果是Promise则会异步调用callback。因此，想要获得一个异步的loader，除了webpack文档里提到的`this.async()`方法，还可以直接返回一个Promise。

## 4. 尾声

以上就是webapck loader相关部分的源码分析。相信到这里，你已经对最开始的「loader十问」有了答案。希望这篇文章能够让你在学会配置loader与编写一个简单的loader之外，能进一步了解loader的实现。

阅读源码的过程中可能存在一些纰漏，欢迎大家来一起交流。

## 告别「webpack配置工程师」

webpack是一个强大而复杂的前端自动化工具。其中一个特点就是配置复杂，这也使得「webpack配置工程师」这种戏谑的称呼开始流行🤷但是，难道你真的只满足于玩转webpack配置么？

显然不是。在学习如何使用webpack之外，我们更需要深入webpack内部，探索各部分的设计与实现。万变不离其宗，即使有一天webpack“过气”了，但它的某些设计与实现却仍会有学习价值与借鉴意义。因此，在学习webpack过程中，我会总结一系列【webpack进阶】的文章和大家分享。

欢迎感兴趣的同学多多交流与关注！

> 【webpack进阶】往期文章：
> - [webpack 前端运行时的模块化设计与实现](/2018/08/27/webpack-module-runtime/)
> - [使用 Babel 避免 webpack 编译模块依赖](/2018/08/19/webpack-babel-transform/)
> - [可视化 webpack 内部插件与钩子关系📈](/2018/09/30/webpack-plugin-hooks-visualization/)
