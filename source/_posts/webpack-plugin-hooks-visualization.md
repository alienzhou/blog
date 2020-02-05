---
title: 可视化 webpack 内部插件与钩子关系📈
date: 2018-09-30 12:00:00
tags:
- webpack
- webpack插件
- 自动化工具
---

![](/img/pic-plugins.jpg)

webpack的成功之处，不仅在于强大的打包构建能力，也在于它灵活的插件机制。

本文的第一部分会先介绍钩子（hook）这个重要的概念与webpack插件的工作方式。然而，熟悉的朋友会发现，这种灵活的机制使得webpack模块之间的联系更加松散与非耦合的同时，让想要理清webpack内部源码结构与联系变得更困难。第二部分将会介绍webpack内部插件与钩子关系的可视化展示工具📈，用一张图理清webpack内部这种错综复杂的关系。

<!-- more -->

也许你了解过webpack的插件与钩子机制；但你或许不知道，webpack内部拥有超过180个钩子，这些钩子与模块（内置插件）之间的「创建」「注册」「调用」关系非常复杂。因此，掌握webpack内部插件与钩子间的关系会帮助我们更进一步理解webpack的内部执行方式。

**可视化工具使用效果图：**

![webpack模块/内置插件与钩子关系图📈](/img/16625b730faf4a62.gif)

## 1. webpack的插件机制

在具体介绍webpack内置插件与钩子可视化工具之前，我们先来了解一下webpack中的插件机制。

webpack实现插件机制的大体方式是：

- 「创建」—— webpack在其内部对象上创建各种钩子；
- 「注册」—— 插件将自己的方法注册到对应钩子上，交给webpack；
- 「调用」—— webpack编译过程中，会适时地触发相应钩子，因此也就触发了插件的方法。


## 1.1. Tapable

[Tapable](https://github.com/webpack/tapable)就是webpack用来创建钩子的库。

> The tapable packages exposes many Hook classes, which can be used to create hooks for plugins.

通过Tapable，可以快速创建各类钩子。以下是各种钩子的类函数：

```javascript
const {
	SyncHook,
	SyncBailHook,
	SyncWaterfallHook,
	SyncLoopHook,
	AsyncParallelHook,
	AsyncParallelBailHook,
	AsyncSeriesHook,
	AsyncSeriesBailHook,
	AsyncSeriesWaterfallHook
} = require("tapable");
```

以最简单的`SyncHook`为例，它可以帮助我们创建一个同步的钩子。为了帮助理解Tapable创建钩子的使用方式，我们以一个“下班回家进门”的模拟场景来介绍Tapable是如何使用的。

现在我们有一个`welcome.js`模块，它设定了我们“进门回家”的一系列行为（开门、脱鞋…）：

```javascript
// welcome.js
const {SyncHook} = require('tapable');

module.exports = class Welcome {
    constructor(words) {
        this.words = words;
        this.sayHook = new SyncHook(['words']);
    }

    // 进门回家的一系列行为
    begin() {
        console.log('开门');
        console.log('脱鞋');
        console.log('脱外套');
        // 打招呼
        this.sayHook.call(this.words);
        console.log('关门');
    }
}
```

首先，我们在构造函数里创建了一个同步钩子`sayHook`，它用来进行之后的打招呼。

然后，`begin()`方法描述了我们刚回家进门的一系列动作：开门、脱鞋、脱外套、关门。其中，在「脱外套」与「关门」之间是一个打招呼的行为，我们在此触发了`sayHook`钩子，并将words作为参数传入其中。

> 注意，这里的`.call()`的方法是Tapable提供的触发钩子的方法，不是js中原生的call方法。

触发这一系列流程也非常简单：

```JavaScript
// run.js
const Welcome = require('./welcome');
const welcome = new Welcome('我回来啦！');
welcome.begin();

/* output:
 * 开门
 * 脱鞋
 * 脱外套
 * 关门
 * /
```

接下来，我们希望有不同的打招呼方式 —— “普通地打招呼”和“大喊一声”。

对应的我们会有两个模块`say.js`和`shout.js`，通过`.tap()`方法在`sayHook`钩子上注册相应方法。

```JavaScript
// say.js
module.exports = function (welcome) {
    welcome.sayHook.tap('say', words => {
        console.log('轻声说:', words);
    });
};

// shout.js
module.exports = function (welcome) {
    welcome.sayHook.tap('shout', words => {
        console.log('出其不意的大喊一声:', words);
    });
};
```

最后，我们修改一下`run.js`，给`welcome`应用`shout.js`这个模块。

```JavaScript
// run.js
const Welcome = require('./welcome');
const applyShoutPlugin = require('./shout');
const welcome = new Welcome('我回来啦！');
applyShoutPlugin(welcome);
welcome.begin();

/* output:
 * 开门
 * 脱鞋
 * 脱外套
 * 出其不意的大喊一声: 我回来啦！
 * 关门
 * /
```

这样，我们就把打招呼的实现方式与welcome解耦了。我们也可以使用`say.js`模块，甚至和`shout.js`两者同时使用。这就好比创建了一个“可插拔”的系统机制 —— 我可以根据需求自主选择要不要打招呼，要用什么方式打招呼。

虽然上面的例子非常简单，但是已经可以帮助我们理解tapable的使用以及插件的思想。

## 1.2. webpack中的插件

在介绍webpack的插件机制前，先简单回顾下上面“进门回家”例子：

- 我们的`Welcome`类是主要的功能类，其中包含具体的功能函数`begin()`与钩子`sayHook`；
- `run.js`模块负责执行流程，控制代码流；
- 最后，`say.js`和`shout.js`是独立的“可插入”模块。根据需要，我们可以自主附加到主流程中。

理解了上面这个例子，就可以很好地类比到webpack中：

例如，webpack中有一个重要的类 —— `Compiler`，它创建了非常多的钩子，这些钩子将会散落在“各地”被调用（call）。它就类似于我们的`Welcome`类。

```JavaScript
// Compiler类中的部分钩子

this.hooks = {
    /** @type {SyncBailHook<Compilation>} */
    shouldEmit: new SyncBailHook(["compilation"]),
    /** @type {AsyncSeriesHook<Stats>} */
    done: new AsyncSeriesHook(["stats"]),
    /** @type {AsyncSeriesHook<>} */
    additionalPass: new AsyncSeriesHook([]),
    /** @type {AsyncSeriesHook<Compiler>} */
    beforeRun: new AsyncSeriesHook(["compiler"]),
    /** @type {AsyncSeriesHook<Compiler>} */
    run: new AsyncSeriesHook(["compiler"]),
    /** @type {AsyncSeriesHook<Compilation>} */
    emit: new AsyncSeriesHook(["compilation"]),
    ……
}
```

然后，webpack中的插件会将所需执行的函数通过 `.tap()` / `.tapAsync()` / `.tapPromise()` 等方法注册到对应钩子上。这样，webpack调用相应钩子时，插件中的函数就会自动执行。

那么，还有一个问题：webpack是如何调用插件，将插件中的方法在编译阶段注册到钩子上的呢？

对于这个问题，webpack规定每个插件的实例，必须有一个`.apply()`方法，webpack打包前会调用所有插件的`.apply()`方法，插件可以在该方法中进行钩子的注册。

在webpack的[`lib/webpack.js`](https://github.com/webpack/webpack/blob/master/lib/webpack.js#L42-L50)中，有如下代码：

```JavaScript
if (options.plugins && Array.isArray(options.plugins)) {
    for (const plugin of options.plugins) {
        plugin.apply(compiler);
    }
}
```

上面这段代码会从webpack配置的`plugins`字段中取出所有插件的实例，然后调用其`.apply()`方法，并将`Compiler`的实例作为参数传入。这就是为什么webpack要求我们所有插件都需要提供`.apply()`方法，并在其中进行钩子的注册。

> 注意，和`.call()`一样，这里的`.apply()`也不是js的原生方法。你会在源码中看到许多`.call()`与`.apply()`，但它们基本都不是你认识的那个方法。

## 2. 编译期（Compiler中）钩子的触发流程

目前，网上已经有了一些解析webpack的优质文章。其中也不乏对webpack编译流程整理与介绍的文章。

但是，由于我近期的工作与兴趣原因，需要对webpack内部的执行步骤与细节做一些较为深入的调研，包括各种钩子与方法的注册、触发时机、条件等等。目前的一些文章内容可能不足以支持，据此做了一定的整理工作。

### 2.1. 一张待完善的图

下面是我之前梳理的`Compiler`中`.run()`方法（编译的启动方法）的执行流程及钩子触发情况（图中只涉及了一部分compilation的相关钩子，完整版还需进一步整理）：

![](/img/166255f64585604f.png)

但是梳理过程中其实出现了一些困难。如果你也曾经想要仔细阅读webpack源码并梳理内部各个模块与插件执行流程与关系，可能也会碰到和我一样的麻烦。下面就来说一下：

### 2.2. 插件与钩子机制带来的问题

首先，可以看到由于图比较细，所以它会比网上常见的整体流程图要复杂；但是，即使只算上webpack常用插件、`compiler`钩子与`compilation`钩子，这张图也只算是其中一小部分。更不用说另外上百个你可能从未接触过的钩子。这些模块与钩子交织出了一个复杂的webpack系统。

其次，在源码阅读与整理的过程中，还会遇到几个问题：

- **联系松散**。根据以上的例子，你可以发现：使用tapable钩子类似事件监听模式，虽然能有效解耦，但钩子的注册与调用几乎完全无关，很难将一个钩子的“创建 - 注册 - 调用”过程有效联系起来。

- **模块交互基于钩子**。webpack内部模块与插件在很多时候，是通过钩子机制来进行联系与调用的。但是，基于钩子的模式是松散的。例如你看到源码里一个模块提供了几个钩子，但你并不知道，在何时、何地该钩子会被调用，又在何时、何地钩子上被注册了哪些方法。这些以往都是需要我们通过在代码库中搜索关键词来解决。

- **钩子数量众多**。webpack内部的钩子非常多，数量达到了180+，类型也五花八门。除了官网列出的`compiler`与`compilation`中那些常用的钩子，还存在着众多其他可以使用的钩子。有些有用的钩子你可能无从知晓，例如我最近用到的`localVars`、`requireExtensions`等钩子。

- **内置插件众多**。webpack v4+ 本身内置了许多插件。即使非插件，webpack的模块自身也经常使用tapable钩子来交互。甚至可以认为，webpack项目中的各个模块都是“插件化”的。这也使得几乎每个模块都会和各种钩子“打交道”。


这些问题导致了想要全面了解webpack中模块/插件间作用关系（核心是与钩子的关系）具有一定的困难。为了帮助理解与阅读webpack源码、理清关系，我制作了一个小工具来可视化展示内置插件与钩子之间的关系，并支持通过交互操作进一步获取源码信息。

## 3. Webpack Internal Plugin Relation

[Webpack-Internal-Plugin-Relation](https://github.com/alienzhou/webpack-internal-plugin-relation)是一个可以展现webpack内部模块（插件）与钩子间关系的工具。文章开头展示的动图就是其功能与使用效果。

> github仓库地址：[https://github.com/alienzhou/webpack-internal-plugin-relation](https://github.com/alienzhou/webpack-internal-plugin-relation)
> 可以在这里查看 [在线演示](https://alienzhou.github.io/webpack-internal-plugin-relation/) 

### 3.1. 关系类型

模块/插件与钩子的关系主要分为三类：

- 模块/插件「创建」钩子，如`this.hooks.say = new SyncHook()`；
- 模块/插件将方法「注册」到钩子上，如`obj.hooks.say.tap('one', () => {...})`;
- 模块/插件通过「调用」来触发钩子事件，如`obj.hooks.say.call()`。

### 3.2. 效果演示

可以进行模块/插件与钩子之间的关系展示：

![](/img/16625b6e741edc52.gif)

可以通过点击等交互，展示模块内钩子信息，双击直接跳转至webpack相应源码处：

![](/img/16625b730faf4a62.gif)

由于关系非常复杂（600+关系），可以对关系类型进行筛选，只展示关心的内容：

![](/img/16628a3932c5b50b.gif)

### 3.3. 工具包含的功能

具体来说，这个工具包含的功能主要包括：

- **关系收集**：
    - 收集模块中hook的创建信息，即钩子的创建信息；
    - 收集模块中hook的注册信息，记录哪些模块对哪些钩子进行了注册；
    - 收集模块中hook的调用信息，即钩子是在代码中的哪一行触发的；
    - 生成包含「模块信息」、「钩子信息」、「源码位置信息」等原始数据的文件。

- **可视化展示**：
    - 使用力导向图可视化展示插件、钩子间关系。可以看到目前webpack v4中有超过180个钩子与超过130个模块；
    - 展示所有模块与钩子列表。

- **交互信息**：
    - 支持对力导向图中节点的展现进行筛选；
    - 通过单击javascript module类节点，可在左下角查看模块的详细信息；
    - 双击javascript module类节点，可直接打开webpack对应源码查看；
    - 双击节点间关系，可直接打开并定位源码具体行数，进行查看；
    - 可以选择要查看的关系：创建-contain / 注册-register / 调用-call。

### 3.4. 基于原始数据定制自己的功能

目前，工具会将原始的采集结果都保留下来。因此，如果你并不需要可视化展示，或者有自己的定制化需求，那么完全可以基于这些信息进行处理，用于你所需的地方。模块的原始信息结构如下：

```javascript
"lib/MultiCompiler.js": {
  "hooks": [
    {
      "name": "done",
      "line": 17
    },
    {
      "name": "invalid",
      "line": 18
    },
    {
      "name": "run",
      "line": 19
    },
    {
      "name": "watchClose",
      "line": 20
    },
    {
      "name": "watchRun",
      "line": 21
    }
  ],
  "taps": [
    {
      "hook": "done",
      "type": "tap",
      "plugin": "MultiCompiler",
      "line": 37
    },
    {
      "hook": "invalid",
      "type": "tap",
      "plugin": "MultiCompiler",
      "line": 48
    }
  ],
  "calls": [
    {
      "hook": "done",
      "type": "call",
      "line": 44
    }
  ]
}
```

## 4. 尾声

这个[Webpack-Internal-Plugin-Relation](https://github.com/alienzhou/webpack-internal-plugin-relation)的小工具主要通过：

1. 遍历webpack源码模块文件
2. 语法分析获取钩子相关信息
3. 加工原始采集信息，转换为力导向图所需格式
4. 基于力导向图数据构建前端web可视化服务
5. 最后再辅以一些交互功能

目前我在使用它帮助阅读与整理webapck源码与编译流程。也许有些朋友也碰到了类似问题，分享出来希望它也能在某些方面对你有所帮助。如果你也对webpack或者这个工具感兴趣，希望能多多支持我的文章和工具，一同交流学习～😊


## 告别「webpack配置工程师」

> 写在最后。

webpack是一个强大而复杂的前端自动化工具。其中一个特点就是配置复杂，这也使得「webpack配置工程师」这种戏谑的称呼开始流行🤷但是，难道你真的只满足于玩转webpack配置么？

显然不是。在学习如何使用webpack之外，我们更需要深入webpack内部，探索各部分的设计与实现。万变不离其宗，即使有一天webpack“过气”了，但它的某些设计与实现却仍会有学习价值与借鉴意义。因此，在学习webpack过程中，我会总结一系列【webpack进阶】的文章和大家分享。

欢迎感兴趣的同学多多交流与关注！

> 往期文章：
> - [【webpack进阶】前端运行时的模块化设计与实现](https://juejin.im/post/5b82ac82f265da431d0e6d25)
> - [【webpack进阶】使用babel避免webpack编译运行时模块依赖](https://juejin.im/post/5b76d49ef265da43231ef7bd)