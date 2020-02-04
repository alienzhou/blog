---
title: 优化打包策略提升页面加载速度
date: 2018-05-05 12:00:00
tags:
- 性能优化
- 浏览器
- 综合
---

## TL;DR
- 可以考虑基于HTTP Cache来定义打包维度，将Cache周期相同的script尽量打包在一起，最大限度利用Cache；
- 合并零散的小脚本，避免触发浏览器并发请求限制后，资源请求串行，TTFB叠加等待时间；
- 注意打包后的资源依赖与资源引入顺序。

<!-- more -->

## 1. 引言
性能优化涵盖的范围非常之广，其中包含的知识也非常繁杂。从加载性能到渲染性能、运行时性能，每个点都有非常多可以学习与实践的知识。

优化问题包含方方面面，优化手段也依场景和具体问题而定。因此，本文并不是一个泛而全的概览文章，而是以之前的一次对于业务产品的简单优化（主要是DOMContentLoaded时间）为例，介绍了如何使用Chrome Dev Tools来分析问题，使用一些策略来缩短DOMContentLoaded的时间，提高加载速度。

## 2. DOMContentLoaded事件
W3C将页面加载分为了许多阶段， DOMContentLoaded（以下简称DCL）类似的有一些 DOM readState ，它们都会标识页面的加载状态与所处的阶段。我们接触最多的也就是 readState 中的 interactive、complete（或load事件）以及DCL事件

简单了解一下它们。浏览器会基于HTML内容来构建DOM，并基于CSS构建CSSOM。两者构建完成后，会合并为Render Tree。当DOM构建完毕后， `document.readyState` 状态会变为 `interactive` 。

![](/img/1632dfee442ac44d.png)

Render Tree构建完成就会进入到我们非常熟悉的 Layout –>> Paint –>> Composite 管道。

![](/img/1632dff994a5f163.png)

但是当页面包含Javascript时，这个过程会有些区别。

![](/img/1632dfffc7d10f7c.png)

根据[HTML5 spec](https://www.w3.org/TR/html5/syntax.html#the-end)，由于在Javascript中可以访问DOM，因此当浏览器解析页面遇到Javascript后会阻塞 DOM 的解析；于此同时，为避免CSS与Javascript之间的竞态，CSSOM的构建会阻塞 Javascript 脚本的执行。不过有一个例外，如果将脚本设置为async，会有一个区别，DCL的触发不需要等待async的脚本被执行。

也就是：

- 当浏览器完成对于document的解析（parse）时，文档状态就会被标记为 `interactive` 。即 "DOM tree is ready"。
- 当所有普通（既不是defer也不是async）与defer的脚本被执行，并且已经没有任何阻塞脚本的样式时，浏览器就会触发 `DOMContentLoaded` 事件。即 "CSSOM is ready"。

或者将上面的部分精简一下：

> DOM construction can’t proceed until JavaScript is executed, and JavaScript can’t proceed until CSSOM is available. [[1]](https://calendar.perfplanet.com/2012/deciphering-the-critical-rendering-path/)

## 3. 排查问题
下面就可以通过Chrome Dev Tools来分析问题。为了内容精简，以下截图取了在slow 3G 无缓存模式下的访问情况，为了保持和线上环境类似（还原浏览器的同源最大请求并发），在本地搭建对应的服务器放置静态资源。wifi情况下，各个时间点大致等比缩短8~9倍。

首先看一个整体的waterfall

![](/img/1632e14e43c51ffb.png)

在最下面可以看到 DCL 为 17.00s（slow 3G）。

> p.s. 页面load时间也很长。主要因为业务膨胀后，页面包含过多资源，没有使用一些懒加载与异步渲染技术，这部分也存在很多优化空间，但由于篇幅不在本文中讨论内。

页面里有一个很明显的请求block了DCL —— common.js。那么common.js是什么呢？它其实就是项目中一些通用脚本文件的打包合并。

![](/img/1632e19f6b41592b.png)

由于common.js为同步脚本，因此等到它其下载并执行完毕后，才会触发DCL。而与此对应的，其他各个脚本的时间线与其有很大差距。具体来看common.js的Timing pharse，耗时11.44s，其中download花费 7.12s。

![](/img/1632e19f6b55068a.png)

## 4. 分析诊断

download过长最直接的原因就是文件太大。common.js的打包合并包含了下面的内容

```javascript
'pkg/common.js': [
    'static/js/bridge.js', // 业务基础库
    'static/js/zepto.min.js', // 第三方库
    'static/js/zepto.touch.min.js', // 第三方库
    'static/js/bluebird.core.min.js', // 第三方库
    'static/js/link.interceptor.js', // 业务基础库
    'static/js/global.js', // 业务基础库
    'static/js/felog.js', // 业务基础库
    'widget/utils/*.js' // 业务工具组件
]
```

这里，我们发现这么打包会存在下面几个问题：

### 4.1. 文件大小

download过长最直接的原因：文件过大。

将这些资源全部打包在一起导致common.js较大，原文件161KB，gzip 之后为52.5KB，单点阻塞了关键渲染路径。你也可以在 audits 中的Critical Request Chains部分发现common.js是瓶颈。

### 4.2. HTTP Cache

zepto/bluebird这种第三方库属于非常稳定的资源，几乎不会改动。虽然代码量较多，但是通过HTTP Cache可以有效避免重复下载。同时，上线新版后，为了避免一些文件走 HTTP Cache，我们会给静态资源加上 md5。

然而，当这些稳定的第三方库与一些其他文件打包后，会因为该打包中某些文件的局部变动导致合并打包后的hash变化而缓存失效。

例如，其中bridge.js与/utils/*.js容易随着版本上线迭代，迭代后打包导致common的hash变化，HTTP Cache失效，zepto/bluebird等较大的资源虽然未更改，但由于打包在了一起，仍需要重新下载。每次上线新版本后，一些加载的性能数据表现都会显著下降，其中一部分原因在于此。

## 5. 实施优化手段

结合上面分析的问题，可以进行一些简单而有效的优化。

### 5.1. 拆包

考虑将文件的打包合并按照文件的更新频率进行划分。这样既可以有效缩减common.js的大小，也可以基于不同类型的资源，更好利用HTTP Cache。

例如：

- 将基本不会变动的文件打包为 lib.js，主要为一些第三方库，这类文件几乎不会改动，非常稳定。

- 将项目依赖的最基础js打包为common.js，例如本文中的global.js、link.interceptor.js，项目中的所有部分都需要它们，同时也是项目特有的，相较上一部分的lib会有一定量的开发与改动，但是更新间隔可能会有几个版本。

- 将项目中变动较为频繁的工具库打包为util.js，理论上其中工具由于不作为基础运行的依赖，是可以异步加载的。这部分代码是三者之中变动最为频繁的。

```
'pkg/util.js': [
    'widget/utils/*.js'
],
'pkg/common.js': [
    'static/js/link.interceptor.js',
    'static/js/global.js',
    'static/js/felog.js'
],
'pkg/lib.js': [
    'static/js/zepto.min.js',
    'static/js/zepto.touch.min.js',
    'static/js/bluebird.core.min.js'
]
```

### 5.2 Quene Delay

但是在拆分后DCL时间几乎没有减少。

![](/img/1632e8c6138105fa.png)

这里就不得不提到打包的初衷之一：减少并发。我们将common.js拆分为三个部分后，触碰到了同域TCP连接数限制，图中的这四个资源被chrome放入了队列（图中白色长条）。

> Queueing. The browser queues requests when:
> 
> - There are higher priority requests.
> - There are already six TCP (Chrome) connections open for this origin, which is the limit. Applies to HTTP/1.0 and HTTP/1.1 only.
> - The browser is briefly allocating space in the disk cache

我们打包合并资源一定程度上也是为了减少TCP round trip，同时尽量规避同域下的请求并发数量限制。因此在common.js拆分时，也要注意不宜分得过细，否则过犹不及，忘了初衷。

从network waterfall中也很容易发现，大部分资源由于size较小，其下载时间其实非常短，耗时主要是在TTFB（Time To First Byte），可以粗略理解为在等待服务器返回数据（图中表现出来就是绿色较多）。所以除了打包项目依赖的lib.js/common.js/util.js外，还可以考虑将部分依赖的组件脚本进行打包合并，

![](/img/1632e66b1ad70b03.png)

像上图中这四个脚本的耗时都在在TTFB上，而且在同一个CDN上，可以通过打包减小不必要的并发。将首屏依赖的关键组件进行打包：

```javascript
'pkg/util.js': [
    'widget/utils/*.js'
],
'pkg/common.js': [
    'static/js/bridge.js',
    'static/js/link.interceptor.js',
    'static/js/global.js',
    'static/js/felog.js'
],
'pkg/lib.js': [
    'static/js/zepto.min.js',
    'static/js/zepto.touch.min.js',
    'static/js/bluebird.core.min.js'
],
'pkg/homewgt.js': [
    'widget/home/**.js',
    'widget/player/*.js',
]
```

优化后的DCL变为了11.20s。
![](/img/1632e66b1b179577.png)

### 5.3 资源引入顺序
注意，一些打包工具会自动分析文件依赖关系，文件打包后会同时替换资源路径。例如：在HTML中，引用了 `static/js/zepto.min.js` 和 `static/js/bluebird.core.min.js` 两个资源，在打包后构建工具会将HTML中的引用自动替换为 `lib.js` 。因此需要注意打包后的资源加载顺序。

例如，原HTML中的资源顺序

```HTML
<script type="text/javascript" src="//your.cdn.com/static/js/bridge.js"></script>
<script type="text/javascript" src="//your.cdn.com/static/js/zepto.min.js"></script>
<script type="text/javascript" src="//your.cdn.com/static/js/bluebird.core.min.js"></script>
<script type="text/javascript" src="//your.cdn.com/static/js/global.js"></script>
```

其中 `global.js` 依赖于 `zepto.min.js`，这个在目前看来没有问题。但是由于打包合并，构建工具会自动替换脚本文件名。由于 `bridge.js` 的位置，在打包后`common.js`的引入顺序先于`lib.js`。这就导致 `global.js` 先于 `zepto.min.js` 引入与执行，出现错误。

![](/img/1632ea590a6e0088.png)

对此，在不影响原有依赖的情况下，可以调整脚本顺序

```HTML
<script type="text/javascript" src="//your.cdn.com/static/js/zepto.min.js"></script>
<script type="text/javascript" src="//your.cdn.com/static/js/bluebird.core.min.js"></script>
<script type="text/javascript" src="//your.cdn.com/static/js/bridge.js"></script>
<script type="text/javascript" src="//your.cdn.com/static/js/global.js"></script>
```

输出的结果如下：

![](/img/1632ea869bad3777.png)

## 6. 验证效果

![](/img/1632eaf0bcf7c7b5.png)

最终在无缓存的slow 3G下DCL时间11.19s，相比最初的17.00s，降低34%。（wifi情况下降比例相同，时间大致同比为1/8~1/9，接近1s）。同时，相较于之前，一些静态资源能够更好地去利用HTTP Cache，节省带宽，降低每次新版上线后用户访问站点的静态资源下载量。

![](/img/1632e66b434d09f4.png)

## 7. 写在最后
需要指出，性能优化也许有一些“基本准则”，但绝对没有银弹。无论是多么“基础与通用”的优化手段，亦或是多么“复杂而有针对性”的优化手段，都是在解决特定的具体问题。因此，解决性能问题往往都是从实际出发，通过“排查问题 --> 分析诊断 --> 实施优化 --> 验证效果”这样一条不断循环的路径来开展的。

同时，提升性能的其中一个目的就是更好的用户体验。用户体验往往是一个宽泛的概念，涉及方方面面。相对应的，性能优化也不能只死盯着某个“指标”，更应该理解其背后对产品与用户的意义。从问题出发，拿数据量化，找解决方案。

在实际环境下，面对有限的资源和各种限制，创造最大的价值。性能优化更是如此。


## 参考资料

- [HTML5 spec: parse HTML (the end)](https://www.w3.org/TR/html5/syntax.html#the-end)
- [HTML5 spec: current-document-readiness](https://www.w3.org/TR/html5/dom.html#current-document-readiness)
- [Deciphering the Critical Rendering Path](https://calendar.perfplanet.com/2012/deciphering-the-critical-rendering-path/)
- [Network Analysis Reference](https://developers.google.com/web/tools/chrome-devtools/network-performance/reference)