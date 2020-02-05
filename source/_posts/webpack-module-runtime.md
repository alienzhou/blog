---
title: webpack 前端运行时的模块化设计与实现
date: 2018-08-27 12:00:00
tags:
- webpack
- 模块化
- 自动化工具
---

![](/img/1_dQA3VhfjIQc1DYua6KoLFQ.png)

你真的了解前端模块化么？「一起告别 webpack 配置工程师」

<!-- more -->

## 告别「webpack配置工程师」
webpack是一个强大而复杂的前端自动化工具。其中一个特点就是配置复杂，这也使得「webpack配置工程师」这种戏谑的称呼开始流行🤷但是，难道你真的只满足于玩转webpack配置么？

显然不是。在学习如何使用webpack之外，我们更需要深入webpack内部，探索各部分的设计与实现。万变不离其宗，即使有一天webpack“过气”了，但它的某些设计与实现却仍会有学习价值与借鉴意义。因此，在学习webpack过程中，我会总结一系列【webpack进阶】的文章和大家分享。

欢迎感兴趣的同学多多交流与关注！

## 1. 引言

下面进入正题。一直以来，在前端领域，开发人员日益增长的语言能力需求和落后的JavaScript规范形成了一大矛盾。例如，我们会用babel来进行ES6到ES5的语法转换，会使用各种polyfill来兼容老式上的新特性……而我们本文的主角 —— 模块化也是如此。

由于JavaScript在设计之初就没有考虑这一点，加之模块化规范的迟到，导致社区中涌现出一系列前端运行时的模块化方案，例如RequireJS、seaJS等。以及与之对应的编译期模块依赖解决方案，例如browserify、rollup和本文的主角webpack。

但是我们要知道，`<script type="module">`还存在一定的兼容性与使用问题。

![](/img/1657be864c854472.png)

在更通用的范围内来讲，浏览器原生实际是不支持所谓的CommonJS或ESM模块化规范的。那么webpack是如何在打包出的代码中实现模块化的呢？


## 2. NodeJS中的模块化

在探究webpack打包后代码的模块化实现前，我们先来看一下Node中的模块化。

NodeJS（以下简称为Node）在模块化上基本是遵循的CommonJS规范，而webpack打包出来的代码所实现模块化的方式，也类似于CommonJS。因此，我们先以熟悉的Node（这里主要参考Node v10）作为引子，简单介绍它的模块化实现，帮助我们接下来理解webpack的实现。

Node中的模块引入会经历下面几个步骤：

1. 路径分析
2. 文件定位
3. 编译执行

在Node中，模块以文件维度存在，并且在编译后缓存于内存中，通过`require.cache`可以查看模块缓存情况。在模块中添加`console.log(require.cache)`查看输出如下：

```JavaScript
{ '/Users/alienzhou/programming/gitrepo/test.js':
   Module {
     id: '.',
     exports: {},
     parent: null,
     filename: '/Users/alienzhou/programming/gitrepo/test.js',
     loaded: false,
     children: [],
     paths:
      [ '/Users/alienzhou/programming/gitrepo/node_modules',
        '/Users/alienzhou/programming/node_modules',
        '/Users/alienzhou/node_modules',
        '/Users/node_modules',
        '/node_modules' ] } }
```

上面就是模块对象的数据结构，也可以在[Node源码](https://github.com/nodejs/node/blob/master/lib/internal/modules/cjs/loader.js#L102-L110)中找到Module类的构造方法。其中`exports`属性非常重要，它就是模块的导出对象。因此，下面这行语句

```JavaScript
var test = require('./test.js');
```

其实就是把`test.js`模块的`exports`属性赋值给`test`变量。

也许你还会好奇，当我们写一个Node(JavaScript)模块时，模块里的`module`、`require`、`__filename`等这些变量是哪来的？如果你看过[Node loader.js 部分源码](https://github.com/nodejs/node/blob/master/lib/internal/modules/cjs/loader.js#L124-L131)，应该就大致能理解：

```JavaScript
Module.wrap = function(script) {
  return Module.wrapper[0] + script + Module.wrapper[1];
};

Module.wrapper = [
  '(function (exports, require, module, __filename, __dirname) { ',
  '\n});'
];
```

Node会自动将每个模块进行包装（wrap），将其变为一个function。例如模块test.js原本为：

```JavaScript
console.log(require.cache);
module.exports = 'test';
```

包装后大致会变为：

```JavaScript
(function (exports, require, module, __filename, __dirname) {
    console.log(require.cache);
    module.exports = 'test';
});
```

这下你应该明白`module`、`require`、`__filename`这些变量都是哪来的了吧 —— 它们会被作为function的参数在模块编译执行时注入进来。以一个扩展名为`.js`的模块为例，当你`require`它时，一个完整的方法调用大致包括下面几个过程：

```flow
st=>start: require()引入模块
op1=>operation: 调用._load()加载模块
op2=>operation: new Module(filename, parent)创建模块对象
op3=>operation: 将模块对象存入缓存
op4=>operation: 根据文件类型调用Module._extensions
op5=>operation: 调用.compile()编译执行js模块
cond=>condition: Module._cache是否无缓存
e=>end: 返回module.exports结果
st->op1->cond
cond(yes)->op2->op3->op4->op5->e
cond(no)->e
```

在[Node源码](https://github.com/nodejs/node/blob/master/lib/internal/modules/cjs/loader.js#L685-L691)中能看到，模块执行时，包装定义的几个变量被注入了：

```JavaScript
if (inspectorWrapper) {
    result = inspectorWrapper(compiledWrapper, this.exports, this.exports,
                              require, this, filename, dirname);

} else {
    result = compiledWrapper.call(this.exports, this.exports, require, this,
                                  filename, dirname);
}

```

> 题外话，从这里你也可以看出，在模块内使用`module.exports`与`exports`的区别

## 3. webpack实现的前端模块化

之所以在介绍「webpack是如何在打包出的代码中实现模块化」之前，先用一定篇幅介绍了Node中的模块化，是因为两者在同步依赖的设计与实现上有异曲同工之处。理解Node的模块化对学习webpack很有帮助。当然，由于运行环境的不同（webpack打包出的代码运行在客户端，而Node是在服务端），实现上也有一定的差异。

下面就来看一下，webpack是如何在打包出的代码中实现前端（客户端）模块化的。

### 3.1. 模块对象
和Node的模块化实现类似，在webpack打包出的代码中，每个模块也有一个对应的模块对象。在`__webpack_require__()`方法中，有这么一段代码：

```javascript
function __webpack_require__(moduleId) {
    // …… other code
    
    var module = installedModules[moduleId] = {
        i: moduleId,
        l: false,
        exports: {},
        parents: null,
        children: []
    };
    
    // …… other code
}
```

类似于Node，在webpack中各个模块的也有对应的模块对象，其数据结构基本遵循CommonJS规范；其中`installedModules`则是模块缓存对象，类似于Node中的`require.cache`/`Module._cache`。

### 2.2. 模块的require：`__webpack_require__`
`__webpack_require__`是webpack前端运行时模块化中非常重要的一个方法，相当于CommonJS规范中的`require`。

根据第一部分的流程图：在Node中，当我们`require`一个模块时，会先判断该模块是否在缓存之中，如果存在则直接返回该模块的`exports`属性；否则会加载并执行该模块。webpack中的实现也类似：

```javascript
function __webpack_require__(moduleId) {
    // 1.首先会检查模块缓存
    if(installedModules[moduleId]) {
        return installedModules[moduleId].exports;
    }
    
    // 2. 缓存不存在时，创建并缓存一个新的模块对象，类似Node中的new Module操作
    var module = installedModules[moduleId] = {
        i: moduleId,
        l: false,
        exports: {},
        children: []
    };

    // 3. 执行模块，类似于Node中的：
    // result = compiledWrapper.call(this.exports, this.exports, require, this, filename, dirname);
    modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

    module.l = true;

    // 4. 返回该module的输出
    return module.exports;
}
```

如果你仔细对比webpack与Node，你会发现在`__webpack_require__`中有一个重要的区别：

在webpack中不存在像Node一样调用`._compile()`这种方法的过程。即不会像Node那样，对一个未载入缓存的模块，通过「读取模块路径 -> 编译模块代码 -> 执行模块」来载入模块。为什么呢？

这是因为，Node作为服务端语言，模块都是本地文件，加载时延低，可同步阻塞进行模块文件寻址、读取、编译和执行，这些过程在模块require的时候再“按需”执行即可；而webpack运行在客户端（浏览器），显然不能在需要时（即执行`__webpack_require__`时）再通过网络加载js文件，并同步地等待加载完成后再返回`__webpack_require__`。这种网络时延，显然不能满足“同步依赖”的要求。

那么webpack是如何解决这个问题的呢？


### 3.2. 如何解决前端的同步依赖

我们还是回来看下Node：

Node（v10）中加载、编译与执行（js）模块的代码主要集中在`Module._extensions['.js']`和`Module.prototype._compile`中。首先会通过`fs.readFileSync`读取文件内容，然后通过`vm.runInThisContext`来编译和执行JavaScript代码。

> The vm module provides APIs for compiling and running code within V8 Virtual Machine contexts.

但是，根据上面的分析，在前端runtime中肯定不能通过网络去同步获取JavaScript脚本文件；那么就需要我们换一个思路：有没有什么地方能够预先放置我们“之后”可能会需要的模块，让我们能够在require时不需要同步等待过长的时间（当然，这里的“之后”可能是几秒、几分钟后，也可能是这次事件循环task的下几行代码）。

内存就是一个不错的选择。我们可以把同步依赖的模块先“注册”到内存中（模块暂存），等到require时，再执行该模块、缓存模块对象、返回对应的`exports`。而webpack中，这个所谓的内存就是`modules`对象。

> 注意这里指的模块暂存和模块缓存概念完全不同。暂存可以粗略类比为将编译好的模块代码先放到内存中，实际并没有引入该模块。基于这个目的，我们也可以把“模块暂存”理解为“模块注册”，因此后文中“模块暂存”与“模块注册”具有相等的概念。

所以，过程大致是这样的：

当我们已经获取了模块内容后（但模块还未执行），我们就将其暂存在`modules`对象中，键就是webpack的moduleId；等到需要使用`__webpack_require__`引用模块时，发现缓存中没有，则从`modules`对象中取出暂存的模块并执行。

### 3.3. 如何”暂存“模块

思路已经清晰了，那么我们就来看看，webpack是如何将模块“暂存”在`modules`对象上的。在实际上，webpack打包出来的代码可以简单分为两类：

- 一类是webpack模块化的前端runtime，你可以简单类比为RequireJS这样的前端模块化类库所实现的功能。它会控制模块的加载、缓存，提供诸如`__webpack_require__`这样的require方法等。
- 另一类则是模块注册与运行的代码，包含了源码中的模块代码。为了进一步理解，我们先来看一下这部分的代码是怎样的。

> 为了便于学习与代码阅读，建议你可以在webpack（v4）配置中加入`optimization:{runtimeChunk: {name: 'runtime'}}`，这样会让webpack将runtime与模块注册代码分开打包。

```JavaScript
// webpack module chunk
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([["home-0"],{

/***/ "module-home-0":
/***/ (function(module, exports, __webpack_require__) {

const myalert = __webpack_require__("module-home-1");

myalert('test');

/***/ }),

/***/ "module-home-1":
/***/ (function(module, exports) {

module.exports = function (a) {
    alert('hi:' + a);
};

/***/ })

},[["module-home-0","home-1"]]]);
```

上面这是一个不包含runtime的chunk，我们不妨将其称为module chunk（下面会沿用这个叫法）。简化一下这部分代码，大致结构如下：

```JavaScript
// webpack module chunk
window["webpackJsonp"].push([
    ["home-0"], // chunkIds
    {
        "module-home-0": (function(module, exports, __webpack_require__){ /* some logic */ }),
        "module-home-1": (function(module, exports, __webpack_require__){ /* some logic */ })
    },
    [["module-home-0","home-1"]]
])
```

这里，`.push()`方法参数为一个数组，包含三个元素：

- 第一个元素是一个数组，`["home-0"]`表示该js文件所包含的所有chunk的id（可以粗略理解为，webpack中module组成chunk，chunk又组成file）；
- 第二个元素是一个对象，键是各个模块的id，值则是一个被function包装后的模块；
- 第三个元素也是一个数组，其又是由多个数组组成。具体作用我们先按下不表，最后再说。

来看下参数数组的第二个元素 —— 包含模块代码的对象，你会发现这里方法签名是不是很像Node中的通过`Module.wrap()`进行的模块代码包装？没错，[webpack源码](https://github.com/webpack/webpack/blob/master/lib/FunctionModuleTemplatePlugin.js#L16-L31)中也有类似，会像Node那样，将每个模块的代码用一个function包装起来。

而当webpack配置了runtime分离后，打包出的文件中会出现一个“纯净”的、不包含任何模块代码的runtime，其主要是一个自执行方法，其中暴露了一个全局变量`webpackJsonp`：

```JavaScript
// webpack runtime chunk
var jsonpArray = window["webpackJsonp"] = window["webpackJsonp"] || [];
var oldJsonpFunction = jsonpArray.push.bind(jsonpArray);
jsonpArray.push = webpackJsonpCallback;
```

> `webpackJsonp`变量名可以通过`output.jsonpFunction`进行配置

可以看到，`window["webpackJsonp"]`上的`.push()`方法已经被修改为了`webpackJsonpCallback()`方法。该方法如下：

```javascript
// webpack runtime chunk
function webpackJsonpCallback(data) {
    var chunkIds = data[0];
    var moreModules = data[1];
    var executeModules = data[2];

    var moduleId, chunkId, i = 0, resolves = [];
    // webpack会在installChunks中存储chunk的载入状态，据此判断chunk是否加载完毕
    for(;i < chunkIds.length; i++) {
        chunkId = chunkIds[i];
        if(installedChunks[chunkId]) {
            resolves.push(installedChunks[chunkId][0]);
        }
        installedChunks[chunkId] = 0;
    }
    
    // 注意，这里会进行“注册”，将模块暂存入内存中
    // 将module chunk中第二个数组元素包含的 module 方法注册到 modules 对象里
    for(moduleId in moreModules) {
        if(Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {
            modules[moduleId] = moreModules[moduleId];
        }
    }

    if(parentJsonpFunction) parentJsonpFunction(data);

    while(resolves.length) {
        resolves.shift()();
    }

    deferredModules.push.apply(deferredModules, executeModules || []);

    return checkDeferredModules();
};
```

注意以上方法的这几行，就是我们之前所说的「将模块“暂存”在modules对象上」

```JavaScript
// webpackJsonpCallback
for(moduleId in moreModules) {
    if(Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {
    modules[moduleId] = moreModules[moduleId];
    }
}
```

配合`__webpack_require__()`中下面这一行代码，就实现了在需要引入模块时，同步地将模块从暂存区取出来执行，避免使用网络请求导致过长的同步等待时间。

```JavaScript
// __webpack_require__
modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
```

### 3.4. 模块的自动执行

到目前为止，对于webpack的同步依赖实现已经介绍的差不多了，但还遗留一个小问题：webpack中的所有js源文件都是模块，但如果都是不会自动执行的模块，那我们只是在前端引入了一堆“死”代码，怎么让代码“活”起来呢？

很多时候，我们引入一个script标签加载脚本文件，至少希望其中一个模块的代码会自动执行，而不仅仅是注册在`modules`对象上。一般来说，这就是webpack中所谓的入口模块。

webpack是如何让这些入口模块自动执行的呢？不知道你是否还记得module chunk中那个按下不表的第三个参数：这个参数是一个数组，而数组里面每个元素又是一个数组

```javascript
[["module-home-0","home-1"], ["module-home-2","home-3","home-5"]]
```

对照上面这个例子，我们可以具体解释下参数的含义。第一个元素`["module-home-0","home-1"]`表示，我希望自动执行moduleId为`module-home-0`的这个模块，但是该模块需要chunkId为`home-1`的chunk已经加载后才能执行；同理，`["module-home-2","home-3","home-5"]`表示自动执行`module-home-2`模块，但是需要检查chunk`home-3`和`home-5`已经加载。

执行某些模块需要保证一些chunk已经加载是因为，该模块所依赖的其他模块可能并不在当前chunk中，而webpack在编译期会通过依赖分析自动将依赖模块的所属chunkId注入到此处。

这个模块“自动”执行的功能在runtime chunk的代码中主要是由`checkDeferredModules()`方法实现：

```JavaScript
function checkDeferredModules() {
    var result;
    for(var i = 0; i < deferredModules.length; i++) {
        var deferredModule = deferredModules[i];
        var fulfilled = true;
        // 第一个元素是模块id，后面是其所需的chunk
        for(var j = 1; j < deferredModule.length; j++) {
            var depId = deferredModule[j];
            // 这里会首先判断模块所需chunk是否已经加载完毕
            if(installedChunks[depId] !== 0) fulfilled = false;
        }
        // 只有模块所需的chunk都加载完毕，该模块才会被执行（__webpack_require__）
        if(fulfilled) {
            deferredModules.splice(i--, 1);
            result = __webpack_require__(__webpack_require__.s = deferredModule[0]);
        }
    }
    return result;
}
```

## 4. 异步依赖

如果你只是想学习webpack前端runtime中同步依赖的设计与实现，那么到这里主要内容基本已经结束了。不过我们知道，webpack支持使用动态模块引入的语法（代码拆分），例如：`dynamic import`和早期的`require.ensure`，这种方式与使用CommonJS的`require`和ESM的`import`最重要的区别在于，该类方法会异步（或者说按需）加载依赖。

### 4.1. 代码转换

就像在源码中使用`require`会在webpack打包时被替换为`__webpack_require__`一样，在源码中使用的异步依赖语法也会被webpack修改。以`dynamic import`为例，下面的代码

```JavaScript
import('./test.js').then(mod => {
    console.log(mod);
});
```

在产出后会被转换为

```JavaScript
__webpack_require__.e(/* import() */ "home-1")
    .then(__webpack_require__.bind(null, "module-home-3"))
    .then(mod => {
        console.log(mod);
    });
```

上面代码是什么意思呢？我们知道，webpack打包后会将一些module合并为一个chunk，因此上面的`"home-1"`就表示：包含`./test.js`模块的chunk的chunkId为`"home-1"`。

webpack首先通过`__webpack_require__.e`加载指定chunk的script文件（module chunk），该方法返回一个promise，当script加载并执行完成后resolve该promise。webpack打包时会保证异步依赖的所有模块都已包含在该module chunk或当前上下文中。

既然module chunk已经执行，那么表明异步依赖已经就绪，于是在then方法中执行`__webpack_require__`引用`test.js`模块（webpack编译后moduleId为module-home-3）并返回。这样在第二个then方法中就可以正常使用该模块了。

### 4.2. `__webpack_require__.e`

异步依赖的核心方法就是`__webpack_require__.e`。下面来分析一下该方法：

```JavaScript
__webpack_require__.e = function requireEnsure(chunkId) {
    var promises = [];
    var installedChunkData = installedChunks[chunkId];
    
    // 判断该chunk是否已经被加载，0表示已加载。installChunk中的状态：
    // undefined：chunk未进行加载,
    // null：chunk preloaded/prefetched
    // Promise：chunk正在加载中
    // 0：chunk加载完毕
    if(installedChunkData !== 0) {
        // chunk不为null和undefined，则为Promise，表示加载中，继续等待
        if(installedChunkData) {
            promises.push(installedChunkData[2]);
        } else {
            // 注意这里installChunk的数据格式
            // 从左到右三个元素分别为resolve、reject、promise
            var promise = new Promise(function(resolve, reject) {
                installedChunkData = installedChunks[chunkId] = [resolve, reject];
            });
            promises.push(installedChunkData[2] = promise);

            // 下面代码主要是根据chunkId加载对应的script脚本
            var head = document.getElementsByTagName('head')[0];
            var script = document.createElement('script');
            var onScriptComplete;

            script.charset = 'utf-8';
            script.timeout = 120;
            if (__webpack_require__.nc) {
                script.setAttribute("nonce", __webpack_require__.nc);
            }
            
            // jsonpScriptSrc方法会根据传入的chunkId返回对应的文件路径
            script.src = jsonpScriptSrc(chunkId);

            onScriptComplete = function (event) {
                script.onerror = script.onload = null;
                clearTimeout(timeout);
                var chunk = installedChunks[chunkId];
                if(chunk !== 0) {
                    if(chunk) {
                        var errorType = event && (event.type === 'load' ? 'missing' : event.type);
                        var realSrc = event && event.target && event.target.src;
                        var error = new Error('Loading chunk ' + chunkId + ' failed.\n(' + errorType + ': ' + realSrc + ')');
                        error.type = errorType;
                        error.request = realSrc;
                        chunk[1](error);
                    }
                    installedChunks[chunkId] = undefined;
                }
            };
            var timeout = setTimeout(function(){
                onScriptComplete({ type: 'timeout', target: script });
            }, 120000);
            script.onerror = script.onload = onScriptComplete;
            head.appendChild(script);
        }
    }
    return Promise.all(promises);
};
```

该方法首先会根据chunkId在installChunks中判断该chunk是否正在加载或已经被加载；如果没有则会创建一个promise，将其保存在installChunks中，并通过`jsonpScriptSrc()`方法获取文件路径，通过sciript标签加载，最后返回该promise。

`jsonpScriptSrc()`则可以理解为一个包含chunk map的方法，例如这个例子中：

```JavaScript
function jsonpScriptSrc(chunkId) {
    return __webpack_require__.p + "" + ({}[chunkId]||chunkId) + "." + {"home-1":"0b49ae3b"}[chunkId] + ".js"
}
```

其中包含一个map —— `{"home-1":"0b49ae3b"}`，会根据home-1这个chunkId返回home-1.0b49ae3b.js这个文件名。

### 4.3. 更新chunk加载状态

最后，你会发现，在onload中，并没有调用promise的resolve方法。那么是何时resolve的呢？

你还记得在介绍同步require时用于注册module的`webpackJsonpCallback()`方法么？我们之前说过，该方法参数数组中的第一个元素是一个chunkId的数组，代表了该脚本所包含的chunk。

> p.s. 当一个普通的脚本被浏览器下载完毕后，会先执行该脚本，然后触发onload事件。

因此，在`webpackJsonpCallback()`方法中，有一段代码就是根据chunkIds的数组，检查并更新chunk的加载状态：

```JavaScript
// webpackJsonpCallback()
var moduleId, chunkId, i = 0, resolves = [];
for(;i < chunkIds.length; i++) {
    chunkId = chunkIds[i];
    if(installedChunks[chunkId]) {
        resolves.push(installedChunks[chunkId][0]);
    }
    installedChunks[chunkId] = 0;
}

// ……

while(resolves.length) {
    resolves.shift()();
}
```

上面的代码先根据模块注册时的chunkId，取出installedChunks对应的所有loading中的chunk，最后将这些chunk的promise进行resolve操作。

## 5. 写在最后

至此，对于「webpack打包后是如何实现前端模块化」这个问题就差不多结束了。本文通过Node中的模块化为引子，介绍了webpack中的同步与异步模块加载的设计与实现。

为了方便大家对照文中内容查看webpack运行时源码，我把基础的webpack runtime chunk和module chunk放在了[这里](https://gitee.com/alienzhou/codes/o431yhewq8kimbtdnjpcl12)，有兴趣的朋友可以对照着看。

最后还是欢迎对webpack感兴趣的朋友能够相互交流，关注我的系列文章。

## 参考资料

- [NodeJS internal - cjs module loader](https://github.com/nodejs/node/blob/master/lib/internal/modules/cjs/loader.js)
- [webpack MainTemplate](https://github.com/webpack/webpack/blob/master/lib/MainTemplate.js)
- [webpack FunctionModuleTemplatePlugin](https://github.com/webpack/webpack/blob/master/lib/FunctionModuleTemplatePlugin.js)
- [webpack RuntimeTemplate](https://github.com/webpack/webpack/blob/master/lib/RuntimeTemplate.js)
- [webpack runtime chunk示例](https://gitee.com/alienzhou/codes/o431yhewq8kimbtdnjpcl12)