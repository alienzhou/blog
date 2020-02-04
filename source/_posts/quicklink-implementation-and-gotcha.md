---
title: quicklink 的实现原理与给前端的启发
date: 2018-12-25 12:00:00
tags:
- 漫游Github
- JavaScript
- 浏览器
- 性能优化
---

近来，GoogleChromeLabs 推出了 [quicklink](https://github.com/GoogleChromeLabs/quicklink)，用以实现链接资源的预加载（prefetch）。本文在介绍其实现思路的基础上，会进一步探讨在预加载方面前端工程师还可以做什么。

<!-- more -->

![](/img/16f6c376da73aced.png)

## 1. quicklink 是什么？

quicklink 是一个通过预加载资源来提升后续速度的轻量级工具库。旨在提升浏览过程中，用户访问后续页面的加载速度。

当我们提到性能优化，往往都会着眼于当前用户访问的这个页面，通过压缩资源大小、删减不必要资源、加快页面解析渲染等方式提升用户的访问速度；而 quicklink 用了另一种思路：我预先帮你加载（获取）接下来最可能要用的资源，这样之后真正使用到该资源（链接）时就会感觉非常顺畅。

照着这个思路，我们需要解决的问题就是如何预先帮用户加载资源。这里其实涉及到两个问题：

- 如何去预加载一个指定资源？（预加载的方式）
- 如何确定某个资源是否要加载？（预加载的策略）

下面就结合 quicklink 源码来看看如何解决这两个问题。

> 注：下文提到的“预加载”/“预获取”均指 prefetch

## 2. quicklink 实现原理

## 2.1. 如何去预加载一个指定资源？

首先要解决的是，通过什么方法来实现资源的预加载。即预加载的方式。

我们这里的预加载对应的英文是 prefetch。提到 prefetch 自然会想到使用浏览器的 Resource Hints，通过提示浏览器做一些“预操作”（例如 DNS 解析、资源下载等）来加快后续的访问。

> 如果对 prefetch 与 Resource Hints 不熟悉，可以看看这篇[《使用Resource Hint提升页面加载性能与体验》](https://juejin.im/post/5b4b66f0f265da0f9155feb6#heading-4)。

只需下面一行代码就可以实现浏览器的资源预加载。是不是非常美妙？

```
<link rel="prefetch" href="/my.little.script.js" as="script">
```

因此，对于一个指定的 URL，可以通过下面四行代码来预加载：

```JavaScript
const link = document.createElement(`link`);
link.rel = `prefetch`;
link.href = url;
document.head.appendChild(link);
```

然而，我们不得不面对兼容性的问题。Resource Hints 在低版本 IE 与移动端是重灾区。

![](/img/167e4b2371f81ea0.png)

美梦破灭。既然如此，我们就需要一个类似 prefetch shim 的方式：在不支持 Resource Hints 的浏览器中，使用其他方式来预加载资源。对此，我们可以利用浏览器自身的缓存策略，“实实在在”预先请求这个资源，这也形成了一种资源的“预获取”。而最方便的就是通过 XHR：

```JavaScript
const req = new XMLHttpRequest();
req.open(`GET`, url, req.withCredentials=true);
req.send();
```

这样 shim 也完成了。最后，如何检测浏览器是否支持 prefetch 呢？

我们可以通过 `link` 元素上 relList 属性的 `support` 方法来检查 prefetch 的支持情况：

```JavaScript
const link = document.createElement('link');
link.relList || {}).supports && link.relList.supports('prefetch');
```

结合这三段代码，就组成了一个简易的 prefetcher：**判断是否支持 Resource Hints 中的 prefetch，支持则使用它，否则回退使用 XHR 加载**。

值得一提的是，使用 Resource Hints 与使用 XHR 来预加载资源还是有一些重要差异的。[草案中](https://www.w3.org/TR/resource-hints/#x1-introduction)也提到了一些（主要是性能差异以及与浏览器其他行为之间的冲突）。其中还有一点就是，Resource Hints 中的 prefetch 是否执行，完全是由浏览器决定的，草案里有句话非常明显 —— the user agent *SHOULD* fetch。因此，所有 prefetch 的资源并不一定会真正被 prefetch。相较之下，XHR 的方式“成功率”则更高。这点在 [Netflix 实施的性能优化案例](https://medium.com/dev-channel/a-netflix-web-performance-case-study-c0bcde26a9d9#1b0c)中也提到了。

![](/img/167e4b291f960c09.png)

> 题外话：quicklink 中使用 fetch API  实现高优先级资源的加载。这是因为浏览器会为所有的请求都设置一个优先级，高优请求会被优先执行；目前，`fetch` 在 Chrome 中属于高优先级，在 Safari 中属于中等优先级。


## 2.2. 如何确定某个资源是否要预加载？

有了资源预加载的方式，那么接下来就需要一个预加载的策略了。

这其实是个见仁见智的问题。例如直接给你一个链接 `https://my.test.com/somelink`，在没有任何背景信息的情况下，恐怕你完全不知道是否需要预加载它。那对于这个问题，quicklink 是怎么解决的呢？或者说，quicklink 是通过什么策略来进行预加载的呢？

quicklink 用了一个比较直观的策略：只对处于视口内的资源进行预加载。这一点也比较好理解，网络上大多的资源加载、页面跳转都伴随着用户点击这类行为，而它要是不在你的视野内，你也就无从点击了。这一定程度上算是个必要条件。

这么一来，我们所要解决的问题就是，如果判断一个链接是否处于可视区域内？

以前，对于这种问题，我们做的就是监听 `scroll` 事件，然后判断某元素的位置，从而“得知”元素是否进入了视区。传统的图片懒加载库 [lazysize](https://github.com/aFarkas/lazysizes) 等也是用这种策略。

```JavaScript
document.addEventListener('scroll', function () {
    // ……判断元素位置
});
```

> 注：目前 lazysize 也有了基于 IntersectionObserver 的实现

当然，需要特别注意滚动监听的性能，例如使用截流、避免强制同步布局、 `passive: true` 等方式缓解性能问题。

不过现在我们有了一个新的方案来实现这一功能 —— `IntersectionObserver`：

```JavaScript
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const link = entry.target;
      // 预加载链接
    }
  });
});

// 对所有 a 标签添加观察者
Array.from(options.el.querySelectorAll('a'), link => {
    observer.observe(link);
});
```

`IntersectionObserver` 会创建一个观察者，专门用来观察与通知元素进出视口的情况。如上述代码所示，`IntersectionObserver` 可以观察所有 `a` 元素的位置情况（主要是进入视野）。

> 对 `IntersectionObserver` 不了解的同学可以参考 [Google 的 `IntersectionObserver` 介绍文章](https://developers.google.com/web/updates/2016/04/intersectionobserver)。

但是如下图所示， `IntersectionObserver` 存在兼容性问题，因此要在不兼容的浏览器中使用 quicklink 需要一个 [polyfill](https://github.com/w3c/IntersectionObserver)。


![](/img/167e54a6cc93bde4.png)

目前，我们已经把 quicklink 的两大部分（预加载的方式和预加载的策略）的原理和简单实现讲完了。整个 quicklink 非常简洁，这些基本就是 quicklink 的核心。剩下的就是一些参数检查、额外的规则特性等。

> 题外话：为了进一步保证性能，quicklink 使用 `requestIdleCallback` 在空闲时间查询页面 `a` 标签并挂载观察者。对 `requestIdleCallback` 不了解的同学可以看看 [Google 的这篇文章](https://developers.google.com/web/updates/2015/08/using-requestidlecallback)。


## 3. 到此为止？不，我们还能做更多

到这里，quicklink 的实现就基本讲完了。仔细回想一下，quicklink 其实提供了我们一种通过“预加载”来实现性能优化的思路（粗略来说像是用流量换体验）。这种方式我在前面也提到了，其实可以分为两个部分：

- 如何去预加载一个指定资源？（预加载的方式）
- 如何确定某个资源是否要加载？（预加载的策略）

其实两部分似乎都有可以作为的地方。例如如何保证 prefetcher（资源预加载器）的成功率能更高，以及目前使用的回退方案 XHR 其实在预加载无法缓存的资源时所受的限制等。

此外，我们在这里还可以来聊一聊策略这块。

由于 quicklink 是一个业务无关的轻量级功能库，所以它采用了一个简单但一定程度上有效的策略：预加载视野内的链接资源。然而在实际生产中，我们面对的是更复杂的环境，更复杂的业务，反而会需要更精准的预加载判断。因此，我们完全可以从 quicklink 中剥离出 prefetcher 来作为一个预加载器；而在策略部分使用自己的实现，例如：

- 结合访问日志、打点记录的更精准的预加载。例如，我们可以通过访问日志、打点记录，根据 refer 来判断，从 A 页面来的 B、C、D 页面的比例，从而设置一个阈值，超过该阈值则认为访问 A 页面的用户接下来更容易访问它，从而对其预加载。

- 结合用户行为数据来进行个性化的预加载。例如我们有一个阅读类或商品展示类站点，从用户行为发现，当该链接暴露在该用户视野内 XX 秒（用户阅读内容 XX 秒）后点击率达到 XX%。而不是简单的一刀切或进入视野就预加载。

- 后置非必要资源，精简某类落地页。落地页就是要让新用户尽快“落地”，为此我们可以像 [Netflix](https://medium.com/dev-channel/a-netflix-web-performance-case-study-c0bcde26a9d9#1b0c) 介绍的那样，在宣贯页/登录页精简加载内容，而预加载后续主站的主包（主资源）。例如有些站点的首页大多偏静态，可以用原生 JavaScript 加 内联关键 CSS 的方式，加快加载，用户访问后再预加载 React、Vue 等一系列主站资源。

- 等等。

上面这些场景只是抛砖引玉，相信大家还会有更多更好的场景来助力我们的前端应用“起飞”。而我们完全可以借助一些构建工具、数据采集与分析平台来实现策略的自动提取与注入，持续优化整个预加载的流程与效果。

## 写在最后

预加载、Resource Hints 等由来已久。quicklink 通过提出一种可行的方案让它又重回了大家的视野，给我们展现了性能优化的另一面。希望大家通过了解 quicklink 的实现，也能有自己的想法与启发。

相信随着浏览器的不断进化，标准的不断前行，前端工程师对极致体验与性能要求的不断提高，我们的产品将会越来越美好。

---

好了，这期的「漫游 Github」就到这里了。本系列会不定期和大家一起看一看、聊一聊、学一学 github 上有趣的项目，不仅学习一些技术点，还可以了解作者的技术思考，欢迎感兴趣的小伙伴关注。

![](/img/16f6e12e3b3ac91a.png)

---