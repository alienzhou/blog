---
title: 无编译/服务器，实现浏览器的 CommonJS
date: 2020-01-10 12:00:00
tags:
- 漫游 Github
- JavaScript
- 模块化
---

![](/img/commonjs-without-build-and-server/1_43_420BE-rnsY75fgjoydQ.jpg)

> Use CommonJS modules directly in the browser with no build step and no web server.

以前我们要在浏览器中使用 CommonJS 都需要一堆编译工具和服务器，但本文要介绍一种方式，支持在浏览器直接打开本地 HTML 源文件中使用 CommonJS 加载模块。

<!-- more -->

## 1. one-click.js 是什么

[one-click.js](https://github.com/jordwalke/one-click.js) 是个很有意思的库。Github 里是这么介绍它的：

![](/img/commonjs-without-build-and-server/16f6bdd32223feba.png)

我们知道，如果希望 CommonJS 的模块化代码能在浏览器中正常运行，通常都会需要构建/打包工具，例如 webpack、rollup 等。而 one-click.js 可以让你在不需要这些构建工具的同时，也可以在浏览器中正常运行基于 CommonJS 的模块系统。

进一步的，甚至你都不需要启动一个服务器。例如试着你可以试下 clone 下 one-click.js 项目，直接双击（用浏览器打开）其中的 `example/index.html` 就可以运行。

Repo 里有一句话概述了它的功能：

> Use CommonJS modules directly in the browser with no build step and no web server.

举个例子来说 ——

假设在当前目录（`demo/`）现在，我们有三个“模块”文件：

`demo/plus.js`：

```JavaScript
// plus.js
module.exports = function plus(a, b) {
    return a + b;
}
```

`demo/divide.js`：

```JavaScript
// divide.js
module.exports = function divide(a, b) {
    return a / b;
}
```

与入口模块文件 `demo/main.js`：

```JavaScript
// main.js
const plus = require('./plus.js');
const divide = require('./divide.js');
console.log(divide(12, add(1, 2)));
// output: 4
```

常见用法是指定入口，用 webpack 编译成一个 bundle，然后浏览器引用。而 one-click.js 让你可以抛弃这些，只需要在 HTML 中这么用：

```HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>one click example</title>
</head>
<body>
    <script type="text/javascript" src="./one-click.js" data-main="./main.js"></script>
</body>
</html>
```

注意 `script` 标签的使用方式，其中的 `data-main` 就指定了入口文件。此时直接用浏览器打开这个本地 HTML 文件，就可以正常输出结果 7。

## 2. 打包工具是如何工作的？

上一节介绍了 one-click.js 的功能 —— 核心就是实现不需要打包/构建的前端模块化能力。

在介绍其内部实现这之前，我们先来了解下打包工具都干了什么。俗话说，知己知彼，百战不殆。

还是我们那三个 JavaScript 文件。

plus.js：

```JavaScript
// plus.js
module.exports = function plus(a, b) {
    return a + b;
}
```

divide.js：

```JavaScript
// divide.js
module.exports = function divide(a, b) {
    return a / b;
}
```

与入口模块 main.js：

```JavaScript
// main.js
const plus = require('./plus.js');
const divide = require('./divide.js');
console.log(divide(12, add(1, 2)));
// output: 4
```

回忆一下，当我们使用 webpack 时，会指定入口（main.js）。webpack 会根据该入口打包出一个 bundle（例如 bundle.js）。最后我们在页面中引入处理好的 bundle.js 即可。这时的 bundle.js 除了源码，已经加了很多 webpack 的“私货”。

简单理一理其中 webpack 涉及到的工作：

1. **依赖分析**：首先，在打包时 webpack 会根据语法分析结果来获取模块的依赖关系。简单来说，在 CommonJS 中就是根据解析出的 require 语法来得到当前模块所依赖的子模块。
2. **作用域隔离与变量注入**：对于每个模块文件，webpack 都会将其包裹在一个 function 中。这样既可以做到 `module`、`require` 等变量的注入，又可以隔离作用域，防止变量的全局污染。
3. **提供模块运行时**：最后，为了 `require`、`exports` 的有效执行，还需要提供一套运行时代码，来实现模块的加载、执行、导出等功能。

> 如果对以上的 2、3 项不太了解，可以从篇文章中了解 [webpack 的模块运行时设计](https://juejin.im/post/5b82ac82f265da431d0e6d25#heading-3)。

## 3. 我们面对的挑战

没有了构建工具，直接在浏览器中运行使用了 CommonJS 的模块，其实就是要想办法完成上面提到的三项工作：

- 依赖分析
- 作用域隔离与变量注入
- 提供模块运行时

解决这三个问题就是 one-click.js 的核心任务。下面我们来分别看看是如何解决的。

### 3.1. 依赖分析

这是个麻烦的问题。如果想要正确加载模块，必须准确知道模块间的依赖。例如上面提到的三个模块文件 —— `main.js` 依赖 `plus.js` 和 `divide.js`，所以在运行 `main.js` 中代码时，需要保证 `plus.js` 和 `divide.js` 都已经加载进浏览器环境。然而问题就在于，没有编译工具后，我们自然无法自动化的知道模块间的依赖关系。

对于 [RequireJS](https://requirejs.org/) 这样的模块库来说，它是在代码中声明当前模块的依赖，然后使用异步加载加回调的方式。显然，CommonJS 规范是没有这样的异步 API 的。

而 one-click.js 用了一个取巧但是有额外成本的方式来分析依赖 —— 加载两遍模块文件。在第一次加载模块文件时，为模块文件提供一个 mock 的 `require` 方法，每当模块调用该方法时，就可以在 require 中知道当前模块依赖哪些子模块了。

```JavaScript
// main.js
const plus = require('./plus.js');
const divide = require('./divide.js');
console.log(minus(12, add(1, 2)));
```

例如上面的 `main.js`，我们可以提供一个类似下面的 `require` 方法：

```JavaScript
const recordedFieldAccessesByRequireCall = {};
const require = function collect(modPath) {
    recordedFieldAccessesByRequireCall[modPath] = true;
    var script = document.createElement('script');
    script.src = modPath;
    document.body.appendChild(script);
};
```

`main.js` 加载后，会做两件事：

1. 记录当前模块中依赖的子模块；
2. 加载子模块。

这样，我们就可以在 `recordedFieldAccessesByRequireCall` 中记录当前模块的依赖情况；同时加载子模块。而对于子模块也可以有递归操作，直到不再有新的依赖出现。最后将各个模块的 `recordedFieldAccessesByRequireCall` 整合起来就是我们的依赖关系。

此外，如果我们还想要知道 `main.js` 实际调用了子模块中的哪些方法，可以通过 `Proxy` 来返回一个代理对象，统计进一步的依赖情况：

```JavaScript
const require = function collect(modPath) {
    recordedFieldAccessesByRequireCall[modPath] = [];
    var megaProxy = new Proxy(function(){}, {
        get: function(target, prop, receiver) {
            if(prop == Symbol.toPrimitive) {
                return function() {0;};
            }
            return megaProxy;
        }
    });
    var recordFieldAccess = new Proxy(function(){}, {
        get: function(target, prop, receiver) {
            window.recordedFieldAccessesByRequireCall[modPath].push(prop);
            return megaProxy;
        }
    });
    // …… 一些其他处理
    return recordFieldAccess;
};
```

以上的代码会在你获取被导入模块的属性时记录所使用的属性。

上面所有模块的加载就是我们所说的“加载两遍”的第一遍，用于分析依赖关系。而第二遍就需要基于入口模块的依赖关系，“逆向”加载模块即可。例如 `main.js` 依赖 `plus.js` 和 `divide.js`，那么实际上加载的顺序是 `plus.js` -> `divide.js` -> `main.js`。

值得一提的是，在第一次加载所有模块的过程中，这些模块执行基本都是会报错的（因为依赖的加载顺序都是错误的），我们会忽略执行的错误，只关注依赖关系的分析。当拿到依赖关系后，再使用正确的顺序重新加载一遍所有模块文件。one-click.js 中有更完备的实现，该方法名为 `scrapeModuleIdempotent`，具体[源码可以看这里](https://github.com/jordwalke/one-click.js/blob/8db5f181fe7dafa050d5789741fbe4b2c87ba779/one-click.js#L378-L505)。

到这里你可能会发现：“这是一种浪费啊，每个文件都加载了两遍。”

确实如此，这也是 one-click.js 的 [tradeoff](https://github.com/jordwalke/one-click.js#tradeoffs)：

> In order to make this work offline, One Click needs to initialize your modules twice, once in the background upon page load, in order to map out the dependency graph, and then another time to actually perform the module loading.

### 3.2. 作用域隔离

我们知道，模块有一个很重要的特点 —— 模块间的作用域是隔离的。例如，对于如下普通的 JavaScript 脚本：

```JavaScript
// normal script.js
var foo = 123;
```

当其加载进浏览器时，`foo` 变量实际会变成一个全局变量，可以通过 `window.foo` 访问到，这也会带来全局污染，模块间的变量、方法都可能互相冲突与覆盖。

在 NodeJS 环境下，由于使用 CommonJS 规范，同样像上面这样的模块文件被导入时， `foo` 变量的作用域只在源模块中，不会污染全局。而 NodeJS 在实现上其实就是[用一个 wrap function 包裹了模块内的代码](https://juejin.im/post/5b82ac82f265da431d0e6d25#heading-2)，我们都知道，function 会形成其自己的作用域，因此就实现了隔离。

NodeJS 会在 `require` 时对源码文件进行包装，而 webpack 这类打包工具会在编译期对源码文件进行改写（也是类似的包装）。而 one-click.js 没有编译工具，那编译期改写肯定行不通了，那怎么办呢？下面来介绍两种常用方式：

#### 3.2.1. JavaScript 的动态代码执行

一种方式可以通过 `fetch` 请求获取 script 中文本内容，然后通过 `new Function` 或 `eval` 这样的方式来实现动态代码的执行。这里以 `fetch` + `new Function` 方式来做个介绍：

还是上面的除法模块 `divide.js`，稍加改造下，源码如下：

```JavaScript
// 以脚本形式加载时，该变量将会变为 window.outerVar 的全局变量，造成污染
var outerVar = 123;

module.exports = function (a, b) {
    return a / b;
}
```

现在我们来实现作用域屏蔽：

```JavaScript
const modMap = {};
function require(modPath) {
    if (modMap[modPath]) {
        return modMap[modPath].exports;
    }
}

fetch('./divide.js')
    .then(res => res.text())
    .then(source => {
        const mod = new Function('exports', 'require', 'module', source);
        const modObj = {
            id: 1,
            filename: './divide.js',
            parents: null,
            children: [],
            exports: {}
        };

        mod(modObj.exports, require, modObj);
        modMap['./divide.js'] = modObj;
        return;
    })
    .then(() => {
        const divide = require('./divide.js')
        console.log(divide(10, 2)); // 5
        console.log(window.outerVar); // undefined
    });
```

代码很简单，核心就是通过 `fetch` 获取到源码后，通过 `new Function` 将其构造在一个函数内，调用时向其“注入”一些模块运行时的变量。为了代码顺利运行，还提供了一个简单的 `require` 方法来实现模块引用。

当然，上面这是一种解决方式，然而在 one-click.js 的目标下却行不通。因为 one-click.js 还有一个目标是能够在无服务器（offline）的情况下运行，所以 `fetch` 请求是无效的。

那么 one-click.js 是如何处理的呢？下面我们就来了解下：

#### 3.2.2. 另一种作用域隔离方式

一般而言，隔离的需求与沙箱非常类似，而在前端创建一个沙箱有一种常用的方式，就是 iframe。下面为了方便起见，我们把用户实际使用的窗口叫作“主窗口”，而其中内嵌的 iframe 叫作“子窗口”。由于 iframe 天然的特性，每个子窗口都有自己的 `window` 对象，相互之间隔离，不会对主窗口进行污染，也不会相互污染。

下面仍然以加载 divide.js 模块为例。首先我们构造一个 iframe 用于加载脚本：

```JavaScript
var iframe = document.createElement("iframe");
iframe.style = "display:none !important";
document.body.appendChild(iframe);
var doc = iframe.contentWindow.document;
var htmlStr = `
    <html><head><title></title></head><body>
    <script src="./divide.js"></script></body></html>
`;
doc.open();
doc.write(htmlStr);
doc.close();
```

这样就可以在“隔离的作用域”中加载模块脚本了。但显然它还无法正常工作，所以下一步我们就要补全它的模块导入与导出功能。模块导出要解决的问题就是让主窗口能够访问子窗口中的模块对象。所以我们可以在子窗口的脚本加载运行完后，将其挂载到主窗口的变量上。

修改以上代码：

```JavaScript
// ……省略重复代码
var htmlStr = `
    <html><head><title></title></head><body>
    <scrip>
        window.require = parent.window.require;
        window.exports = window.module.exports = undefined;
    </script>
    <script src="./divide.js"></script>
    <scrip>
        if (window.module.exports !== undefined) {
            parent.window.modObj['./divide.js'] = window.module.exports;
        }
    </script>
    </body></html>
`;
// ……省略重复代码
```

核心就是通过像 `parent.window` 这样的方式实现主窗口与子窗口之间的“穿透”：

- 将子窗口的对象挂载到主窗口上；
- 同时支持子窗口调用主窗口中方法的作用。

上面只是一个原理性的粗略实现，如果对更严谨的实现细节感兴趣可以看源码中的 [loadModuleForModuleData 方法](https://github.com/jordwalke/one-click.js/blob/8db5f181fe7dafa050d5789741fbe4b2c87ba779/one-click.js#L203-L281)。

值得一提的是，在「3.1. 依赖分析」中提到先加载一遍所有模块来获取依赖关系，而这部分的加载也是放在 iframe 中进行的，也需要防止“污染”。

### 3.3. 提供模块运行时

模块的运行时一版包括了构造模块对象（module object）、存储模块对象以及提供一个模块导入方法（`require`）。模块运行时的各类实现一般都大同小异，这里需要注意的就是，如果隔离的方法使用 iframe，那么需要在主窗口与子窗口中传递一些运行时方法和对象。

当然，细节上还可能会需要支持模块路径解析（resolve）、循环依赖的处理、错误处理等。由于这部分的实现和很多库类似，又或者不算特别核心，在这里就不详细介绍了。

## 4. 总结

最后归纳一下大致的运行流程：

1. 首先从页面中拿到入口模块，在 one-click.js 中就是 `document.querySelector("script[data-main]").dataset.main`；
2. 在 iframe 中“顺藤摸瓜”加载模块，并在 `require` 方法中收集模块依赖，直到没有新的依赖出现；
3. 收集完毕，此时就拿到了完整的依赖图；
4. 根据依赖图，“逆向”加载相应模块文件，使用 iframe 隔离作用域，同时注意将主窗口中的模块运行时传给各个子窗口；
5. 最后，当加载到入口脚本时，所有依赖准备就绪，直接执行即可。

总的来说，由于没有了构建工具与服务器的帮助，所以要实现依赖分析与作用域隔离就成了困难。而 one-click.js 运用上面提到的技术手段解决了这些问题。

那么，one-click.js 可以用在生产环境么？显然是[不行的](https://github.com/jordwalke/one-click.js#not-using)。

> Do not use this in production. The only purpose of this utility is to make local development simpler.

**所以注意了**，作者也说了，这个库的目的仅仅是方便本地开发。当然，其中一些技术手段作为学习资料，咱们也是可以了解学习一下的。感兴趣的小伙伴可以访问 [one-click.js 仓库](https://github.com/jordwalke/one-click.js)进一步了解。

---

好了，这期的「漫游 Github」就到这里了。本系列会不定期和大家一起看一看、聊一聊、学一学 github 上有趣的项目，不仅学习一些技术点，还可以了解作者的技术思考，欢迎感兴趣的小伙伴关注。

![](https://user-gold-cdn.xitu.io/2020/1/4/16f6c376da73aced?w=1543&h=165&f=png&s=31589)

---

## 往期内容

- [【漫游Github】quicklink 的实现原理与给前端的启发](https://juejin.im/post/5c21f8435188256d12597789)
- [【漫游Github】如何提升JSON.stringify()的性能？](https://juejin.im/post/5cf61ed3e51d4555fd20a2f3)

