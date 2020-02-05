---
title: 使用 Resource Hint 提升页面性能与体验
date: 2018-07-23 12:00:00
tags:
- PWA
- 性能优化
---

![](/img/resource-hint.jpg)

本文是《PWA学习与实践》系列的第十篇文章。也许你还没有听说过或不了解Resource Hint，但是通过本文，你会快速学习到这一件**页面加载性能利器**。本系列相关demo的代码都可以在[github repo](https://github.com/alienzhou/learning-pwa)中找到。

<!-- more -->

## 引言

我们知道，在没有缓存的情况下，无论是HTML、javascript还是一些API数据，页面的每一个请求都需要从客户端发起后经由服务端返回。在这种情况下，我们每一次涉及远程请求的交互（打开一个页面、查询列表数据、动态加载js脚本等）都会有网络延迟。如果我们能够预测或指定页面预先进行一些网络操作，例如DNS解析或者预加载资源，那么当我们在之后的操作中涉及到这部分资源时，加载会更迅速，交互也会更加流畅。

当然，目前已经有一些技术手段来帮助我们实现资源的预加载，例如常见的使用XMLHttpRequest来获取资源并进行缓存。然而，这些技术都是应用层面的，并非Web标准，某些需求也无法准确实现。同时，在性能方面也存在着问题。好在目前已有相关的Web标准（Resource Hint）涉及到这一部分，通过它，可以在浏览器原生层面实现这些功能，同时提供性能保证。下面我们来了解一下Resource Hint相关技术。

## 1. Resource Hint

Resource Hint是一系列相关标准，来告诉浏览器哪些源（origin）下的资源我们的Web App想要获取，哪些资源在之后的操作或浏览时需要被使用，以便让浏览器能够进行一些预先连接或预先加载等操作。Resource Hint有DNS Prefetch、Preconnect、Prefetch和Prerender这四种。

### 1.1. DNS Prefetch
当我们在注重前端性能优化时，可能会忽略了DNS解析。然而DNS的解析也是有耗时的。在Chrome的Timing Breakdown Phase中，第三阶段就是DNS查询。DNS Prefetch就是帮助我们告知浏览器，某个源下的资源在之后会要被获取，这样浏览器就会（Should）尽早解析它。

Resource Hint主要通过使用`link`标签。`rel`属性确定类型，`href`属性则指定相应的源或资源URL。DNS Prefetch可以像下面这样使用：

```html
<link rel="dns-prefetch" href="//yourwebsite.com">
```

### 1.2. Preconnect
我们知道，建立连接不仅需要DNS查询，还需要进行TCP协议握手，有些还会有TLS/SSL协议，这些都会导致连接的耗时。因此，使用Preconnect可以帮助你告诉浏览器：“我有一些资源会用到某个源，可以帮我预先建立连接。”

根据规范，当你使用Preconnect时，浏览器大致做了如下处理：

- 首先，解析Preconnect的URL
- 其次，根据当前link元素中的属性进行cors的设置
- 默认先将credential设为true；如果cors为Anonymous并且存在跨域，则将credential置为false
- 最后进行连接

使用Preconnect只需要将`rel`属性设为`preconnect`即可：

```html
<link rel="preconnect" href="//yourwebsite.com">
```

当然，你也可以设置CORS

```html
<link rel="preconnect" href="//yourwebsite.com" crossorigin>
```

需要注意的是，标准并没有硬性规定浏览器一定要（而是SHOULD）完成整个连接过程，浏览器可以视情况完成部分工作。

### 1.3. Prefetch

你可以把Prefetch理解为资源预获取。一般来说，可以用Prefetch来指定在紧接着之后的操作或浏览中需要使用到的资源，让浏览器提前获取。由于仅仅是提前获取资源，因此浏览器不会对资源进行预处理，并且像CSS样式表、JavaScript脚本这样的资源是不会自动执行并应用于当前文档的。

需要注意的是，和DNS Prefetch、Preconnect使用不太一样的地方是，Prefetch有一个`as`的可选属性，用来指定获取资源的类型。由于不同的资源类型会具有不同的优先级、[CSP](https://www.w3.org/TR/CSP3/)、请求头等，因此该属性很重要。下表列出了一些常用资源的`as`属性值：

| 资源使用者 | 写法 |
|---|---|
| `<audio>` | `<link rel=preload as=audio href=...>` |
| `<video>` | `<link rel=preload as=video href=...>` |
| `<track>` | `<link rel=preload as=track href=...>` |
| `<script>`, Worker's importScripts | `<link rel=preload as=script href=...>` |
|` <link rel=stylesheet>`, CSS @import | `<link rel=preload as=style href=...>` |
| CSS @font-face | `<link rel=preload as=font href=...>` |
| `<img>`, `<picture>`, srcset, imageset | `<link rel=preload as=image href=...>` |
| SVG's `<image>`, CSS *-image | `<link rel=preload as=image href=...>` |
| XHR, fetch | `<link rel=preload as=fetch crossorigin href=...>` |
| Worker, SharedWorker | `<link rel=preload as=worker href=...>` |
| `<embed>` | `<link rel=preload as=embed href=...>` |
| `<object>` | `<link rel=preload as=object href=...>` |
| `<iframe>`, `<frame>` | `<link rel=preload as=document href=...>` |
| HTML | `<link rel=preload as=html href=...>` |

可以看到，Prefetch的可选资源类型非常丰富，除了我们常用的`script`和`style`，甚至还包括XHR、video、img等，基本涵盖了Web中的各类资源。为了解决Prefetch中某些资源（例如XHR）的跨域问题，可以为其应用CORS属性。一个基本的Prefetch写法也很简单：

```html
<link rel="prefetch" href="/my.little.script.js" as="script">
```

### 1.4. Prerender

上一部分我们讲了Prefetch，而Prerender则是Prefetch的更进一步。可以粗略地理解为“预处理”（预执行）。

通过Prerender“预处理”的资源，浏览器都会作为HTML进行处理。浏览器除了会去获取资源，还可能会预处理（MAY preprocess）该资源，而该HTML页面依赖的其他资源，像`<script>`、`<style>`等页面所需资源也可能会被处理。但是预处理会由于浏览器或当前机器、网络情况的不同而被不同程度地推迟。例如，会根据CPU、GPU和内存的使用情况，以及请求操作的幂等性而选择不同的策略或阻止该操作。

注意，由于这些预处理操作的不可控性，当你只是需要能够预先获取部分资源来加速后续可能出现的网络请求时，建议使用Prefetch。当使用Prerender时，为了保证兼容性，目标页面可以监听`visibilitychange`事件并使用`document.visibilityState`来判断页面状态。

> When prerendering a document the user agent MUST set the document's visibilityState value to prerender. —— W3C Working Draft

Prerender的使用方式非常简单，与DNS Prefetch和Preconnect类似，指定`rel`属性为`prerender`：

```html
<link rel="prerender" href="//yourwebsite.com/nextpage.html">
```
## 2. Resource Hint的具体使用方式

在上面的部分里，我主要介绍了DNS Prefetch、Preconnect、Prefetch和Prerender这四种RHL（Resource Hint Link），并且简单介绍了如何在`link`中使用它们。然而除了直接在HTML中加入对应`link`标签外，还可以通过其他几种方式触发浏览器的Resource Hint。为了更加直观，下面我们还是以[图书搜索这个demo](https://github.com/alienzhou/learning-pwa/tree/resource-hint)为例来看看可以通过哪些方法来使用Resource Hint。

> 假设已经为该demo添加详情页`nextpage.html`及其依赖的`nextpage.js`，当点击列表中的图书时会进行跳转。

### 2.1. 文档head中的link元素

这是Resource Hint最常用的一种方式，我们上面介绍的各种示例也就是使用的这种方式。例如想要指定Prefetch `nextpage.js`脚本可以这么写：

```html
<link rel="prefetch" href="./nextpage.js" as="script">
```

### 2.2. HTTP Link头字段

可以通过[Link HTTP header](https://tools.ietf.org/html/rfc5988)来使用Resource Hint。Link HTTP header和`link`元素是等价的。
 
> The Link entity-header field provides a means for serialising one or more links in HTTP headers. It is semantically equivalent to the <LINK> element in HTML, as well as the atom:link feed-level element in Atom. —— RFC5988

[`Link`主要由两部分组成](https://tools.ietf.org/html/rfc5988#page-7)——`URI-Reference`和`link-param`。`URI-Reference`相当于`link`元素中的`href`属性；`link-param`则包括了`rel`、`title`、`type`等一系列元素属性，使用`;`分割。因此可以在响应头中添加以下部分：

```text
Link: </nextpage.js>; rel="prefetch"; as="script"
```

[我们的demo](https://github.com/alienzhou/learning-pwa/tree/resource-hint)使用了koa-static这个中间件，只要做如下修改即可：

```javascript
// app.js
app.use(serve(__dirname + '/public', {
    maxage: 1000 * 60 * 60,
    setHeaders: (res, path, stats) => {
        if (/index.html/.test(path)) {
            res.setHeader('Link', '</nextpage.js>; rel="prefetch"; as="script"');
        }
    }
}));
```

你会发现，在访问`index.html`时，浏览器就会向服务器请求`nextpage.js`这个页面本身并“不需要”用到的资源。


### 2.3. 向文档动态添加link元素

`link`元素也支持我们通过js动态向文档添加。对于动态添加的RHL，浏览器也会对其应用Resource Hint策略。添加`link`的方式和添加普通dom元素一致。

```js
var hint = document.createElement('link');
hint.rel = 'prefetch';
hint.as = 'script';
hint.href = '/nextpage.js';
document.head.appendChild(hint);
```

### 2.4. 改变已有link元素的href属性

当你改变页面中原有RHL的`href`属性（或者prefetch时的`as`属性）时，会立即触发对新资源的Resource Hint。例如在如下代码执行后

```js
var hint = document.querySelector('[rel="prefetch"]');
hint.href = './the.other.nextpage.js';
```

浏览器相当于接收到了新的Resource Hint“指示”，并在合适的时机向服务端请求`the.other.nextpage.js`这个资源。注意，当你修改`as`属性时，也会触发Resource Hint。

注意，如果你想通过修改已有`link`元素预获取`nextpage.html`这个资源，然后像下面这样写会触发两次请求。

```js
var hint = document.querySelector('[rel="prefetch"]');
hint.as = 'html'; // 触发第一次请求，再次请求./nextpage.js
hint.href = './nextpage.html'; // 请求./nextpage.html
```

## 2. Preload
既然提到了Resource Hint，那么不得不介绍一下与其类似的Preload。在遇到需要Preload的资源时，浏览器会 **立刻** 进行预获取，并将结果放在内存中，资源的获取不会影响页面parse与load事件的触发。直到再次遇到该资源的使用标签时，才会执行。

> (Preload) Initiating an early fetch and separating fetching from resource execution.

例如下面这个HTML片段：

```html
<head>
    <link rel="preload" href="./nextpage.js" as="script">
    <script type="text/javascript" src="./current.js"></script>
    <script type="text/javascript" src="./nextpage.js"></script>
<head>
```

![](/img/164c687371151554.gif)

浏览器首先会去获取`nextpage.js`，然后获取并执行`current.js`，最后，遇到使用`nextpage.js`资源的`script`标签时，将已经获取的`nextpage.js`执行。由于我们会将`script`标签置于body底部来保证性能，因此可以考虑在head标签中添加这些资源的Preload来加速页面的加载与渲染。

更进一步，我们还可以监听Preload的情况，并触发自定以操作

```html
<script>
  function preloadFinished(e) { ... }
  function preloadError(e)  { ... }
</script>
<!-- listen for load and error events -->
<link rel="preload" href="app.js" as="script" onload="preloadFinished()" onerror="preloadError()">
```

正如在引言中所提到的，在过去如果我们想预加载一些资源都会用一些应用层面的技术手段，但往往会遇到两个问题：

- 我们需要先获取资源，然后在适当时执行，但两者并不易于分离
- 无论哪种技术实现，都会带来一定的性能与体验损伤

Preload（包括前文提到的Prefetch等RHL）给我们带来的价值就是从浏览器层面很好地将资源的加载与执行分离了，并在浏览器层面来保证良好的性能体验。

看到这里，也许你会疑惑，都是会预获取资源，都是资源的获取与执行分离，那么Preload与Prefetch有什么区别呢？

这是它最容易与Prefetch混淆的地方。在标准里有这么一段话解释两者区别：

> The application can use the preload keyword to initiate <u>**early, high-priority, and non-render-blocking**</u> fetch of a CSS resource that can then be applied by the application at appropriate time

与Prefetch相比，Preload会[强制浏览器立即获取资源，并且该请求具有较高的优先级](https://www.w3.org/TR/preload/#x2.link-type-preload)（mandatory and high-priority），因此建议对一些**当前页面会马上用到**资源使用Preload；相对的，Prefetch的资源获取则是可选与较低优先级的，其是否获取完全取决于浏览器的决定，适用于预获取**将来可能会用到**的资源。

为了节省不必要的带宽消耗，如果Preload的资源在3s内没有被使用，Chrome控制台会出现类似下图的警告。这时你就需要仔细思考，该资源是否有必要Preload了。

![](/img/164c675aabb374df.png)

更多Preload与Prefetch的细节差异可以看这里 —— [Preload, Prefetch And Priorities in Chrome](https://medium.com/reloading/preload-prefetch-and-priorities-in-chrome-776165961bbf)。

## 3. 写在最后

本文介绍了如何使用Resource Hint（以及Preload）来提升页面加载性能与体验，简单来说：

- DNS Prefetch 可以帮助我们进行DNS预查询；
- Preconnect 可以帮助我们进行预连接，例如在一些重定向技术中，可以让浏览器和最终目标源更早建立连接；
- Prefetch 可以帮助我们预先获取所需资源（并且不用担心该资源会被执行），例如我们可以根据用户行为猜测其下一步操作，然后动态预获取所需资源；
- Prerender 则会更进一步，不仅获取资源，还会预加载（执行）部分资源，因此如果我们Prerender下一个页面，打开该页面时会让用户感觉非常流畅；
- Preload 则像是 Prefetch的升级版，会强制立即高优获取资源，非常适合Preload（尽早获取）一些关键渲染路径中的资源。

虽然，大部分PWA相关资料中并不会提及Resource Hint，但是正如我在[第一篇文章](https://juejin.im/post/5ac8a67c5188255c5668b0b8)中提到的

> PWA本身其实是一个概念集合，它不是指某一项技术，而是通过一系列的Web技术与Web标准来优化Web App的安全、性能和体验。

Resource Hint显然符合这一点。

我们不应该将PWA局限在Service Worker离线缓存、提醒通知这些常见的PWA内容中，希望读者也能开阔思维，理解PWA背后的概念与思想。因此，在后续文章中我也会介绍前端存储(sessionStorage/localStorage/indexDB)、HTTP/2.0以及PWA进展等相关内容。

在下一篇里，我们会一起来学习Google开源的PWA离线工具集 —— workbox。通过workbox，我们可以学习<u>**各类离线策略**</u>，并且了解一些生产环境中需要考虑的问题。部分开源PWA解决方案也是基于workbox进行封装的。


## 《PWA学习与实践》系列
- [第一篇：2018，开始你的PWA学习之旅](https://juejin.im/post/5ac8a67c5188255c5668b0b8)
- [第二篇：10分钟学会使用Manifest，让你的WebApp更“Native”](https://juejin.im/post/5ac8a89ef265da238440d60a)
- [第三篇：从今天起，让你的WebApp离线可用](https://juejin.im/post/5aca14b6f265da237c692e6f)
- [第四篇：TroubleShooting: 解决FireBase login验证失败问题](https://juejin.im/post/5accc3c9f265da23870f2abc)
- [第五篇：与你的用户保持联系: Web Push功能](https://juejin.im/post/5accd1355188252b0b201fb9)
- [第六篇：How to Debug? 在chrome中调试你的PWA](https://juejin.im/post/5ae56f926fb9a07aca79edf6)
- [第七篇：增强交互：使用Notification API来进行提醒](https://juejin.im/post/5ae7f7fd518825670960fe96)
- [第八篇：使用Service Worker进行后台数据同步](https://juejin.im/post/5af80c336fb9a07aab29f19c)
- [第九篇：PWA实践中的问题与解决方案](https://juejin.im/post/5b02e5f1f265da0b767dc81d)
- 第十篇：Resource Hint - 提升页面加载性能与体验（本文）
- 第十一篇：从PWA离线工具集workbox中学习各类离线策略（写作中…）

## 参考资料

- [Resource Hints W3C Working Draft 15 January 2018](https://www.w3.org/TR/resource-hints/)
- [Preload W3C Candidate Recommendation 26 October 2017](https://www.w3.org/TR/preload/)
- [Preload, Prefetch And Priorities in Chrome](https://medium.com/reloading/preload-prefetch-and-priorities-in-chrome-776165961bbf)
- [Web Linking](https://tools.ietf.org/html/rfc5988)
- [Page Visibility Level 2 W3C Proposed Recommendation 17 October 2017](https://www.w3.org/TR/page-visibility/)
- [CORS settings attributes](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#cors-settings-attributes)
- [Content Security Policy Level 3 W3C Working Draft, 13 September 2016](https://www.w3.org/TR/CSP3/)

