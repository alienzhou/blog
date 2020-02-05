---
title: 生产环境中 PWA 实践的问题与解决方案
date: 2018-05-26 12:00:00
tags:
- PWA
- TroubleShooting
---

![](/img/troubleshooting.jpg)

在前八篇文章中，我已经介绍了一些 PWA 中的常见技术与使用方式。虽然我们已经学习了很多相关知识，但是，还是有很多问题在实践时才会暴露出来。这篇文章是一篇 TroubleShooting，总结了我近期在PWA实践过程中遇到了一些问题，以及这些问题的解决方案。希望能帮助一些遇到类似问题的朋友。

<!-- more -->

## 1. Service Worker Scope

> 注意Service Worker注册时的作用范围（scope）

### 1.1. 遇到的问题
我在页面`/home`下注册了Service Worker：

```javascript
navigator.serviceWorker.register('/static/home/js/sw.js')
```

通过在`.then()`中调用`console.log()`可以发现Service Worker其实注册成功了，但是在页面中却不生效。这是为什么呢？

### 1.2. 产生的原因

我在前几篇介绍Service Worker的文章中没有过多强调Scope的概念：

> scope: A USVString representing a URL that defines a service worker's registration scope; what range of URLs a service worker can control. This is usually a relative URL. The default value is the URL you'd get if you resolved './' using the service worker script's location as the base.

Scope规定了Service Worker的作用（URL）范围。例如，一个注册在`https://www.sample.com/list`路径下的Service Worker，其作用的范围只能是它本身与它的子路径：

- `https://www.sample.com/list`
- `https://www.sample.com/list/book`
- `https://www.sample.com/list/book/comic`

而在`https://www.sample.com`、`https://www.sample.com/book`这些路径下则是无效的。

同时，scope的默认值为`./`（注意，这里所有的相对路径不是相对于页面，而是相对于sw.js脚本的）。因此，`navigator.serviceWorker.register('/static/home/js/sw.js')`代码中的scope实际上是`/static/home/js`，Service Worker也就注册在了`/static/home/js`路径下，显然无法在`/home`下生效。

这种情况非常常见：我们会把`sw.js`这样的文件放置在项目的静态目录下（例如文中的`/static/home/js`），而并非页面路径下。显然，要解决这个问题需要设置相应的scope。

然而，另一个问题出现了。如果你直接将scope设置为`/home`：

```javascript
navigator.serviceWorker.register('/static/home/js/sw.js', {scope: '/home'})
```

在chrome控制台会看到如下的错误提示：

```
Uncaught (in promise) DOMException: Failed to register a ServiceWorker: The path of the provided scope ('/home') is not under the max scope allowed ('/static/home/js/'). 
Adjust the scope, move the Service Worker script, or use the Service-Worker-Allowed HTTP header to allow the scope.
```

StackOverflow上对此的解释是：

> Service workers can only intercept requests originating in the scope of the current directory that the service worker script is located in and its subdirectories.

简单来说，Service Worker只允许注册在Service Worker脚本所处的路径及其子路径下。显然，我上面的代码触碰到了这个规则。那怎么办呢？

### 1.3. 解决方案

解决这个问题的方式主要有两种。

#### 方法一：修改路由，让sw.js的访问路径处于合适的位置

```javascript
router.get('/sw.js', function (req, res) {
    res.sendFile(path.join(__dirname, '../../static/kspay-home/static/js/sw/', 'sw.js'));
});
```

以上是一个express中简单的路由。通过路由设置，我们将Service Worker脚本路径置于根目录下，这样就可以设置scope为`/home`而不会违反其规则了：

```javascript
navigator.serviceWorker
    .register('/sw.js', {
        scope: '/home'
    })
```

#### 方法二：添加`Service-Worker-Allowed`响应头

scope的规范有时候过于严格了。因此，浏览器也提供了一种方式来使我们可以越过这种限制。方法就是设置`Service-Worker-Allowed`响应头。

以express中的静态服务中间件serve-static为例，[进行相应配置](https://github.com/expressjs/serve-static#options)：

```javascript
options: {
    maxAge: 0,
    setHeaders: function (res, path, stat) {
        // 添加Service-Worker-Allowed，扩展service worker的scope
        if (/\/sw\/.+\.js/.test(path)) {
            res.set({
                'Content-Type': 'application/javascript',
                'Service-Worker-Allowed': '/home'
            });
        }
    }
}
```

## 2. CORS

> 跨域资源的缓存报错

### 2.1. 遇到的问题

在[《【PWA学习与实践】(3) 让你的WebApp离线可用》](https://juejin.im/post/5aca14b6f265da237c692e6f)中我介绍了如何用Service Worker进行缓存以实现离线功能。其中，为了提高体验，我们会在Service Worker安装时缓存静态文件，实现这一功能的部分代码如下：

```javascript
// 监听install事件，安装完成后，进行文件缓存
self.addEventListener('install', e => {
    var cacheOpenPromise = caches.open(cacheName).then(function (cache) {
        return cache.addAll(cacheFiles);
    });
    e.waitUntil(cacheOpenPromise);
});
```

`cacheFiles`就是需要缓存的静态文件列表。然而Service Worker运行后，在application tab中发现`cacheFiles`的静态资源并未被缓存下来。

![](/img/1639b2f3954721b0.png)

### 2.2. 产生的原因

切换到Console可以看到类似如下的报错信息：

![](/img/1639b385aac7ce3c.png)

前端同学对这个问题非常熟悉：**跨域问题**。

为了使我们的页面能够顺利加载CDN等外站资源，浏览器在`script`、`link`、`img`等标签上放松了跨域限制。这使得我们在页面中通过`script`标签来加载javascript脚本是不会导致跨域问题的（经典的jsonp就是以此为基础实现的）。

然而在Service Worker中使用`cache.addAll()`则会通过类似fetch请求的方式来获取资源（类似在页面中使用XHR请求外站脚本），是会受到跨域资源策略限制而无法缓存到本地的。

在实际生产环境中，为了缩短请求的响应时间与、减轻服务器压力，通常我们都会将javascript、css、image这些静态资源通过CDN进行分发，或者将其放置在一些独立的静态服务集群中。所以线上的静态资源基本都是“跨站资源”。

### 2.3. 解决方案

该问题其实不算是Service Worker中的特定问题，解决方式和处理一般的跨域问题类似，可以设置`Access-Control-Allow-Origin`响应头来解决。

- 如果使用CDN，可以在CDN服务中进行配置。一般的CDN服务是会支持配置HTTP响应头的；
- 如果使用自己搭建的静态服务器集群，可以对服务器进行相应配置。这里有一个[仓库](https://github.com/h5bp/server-configs)包含ngix、apache、iis等常用服务器的配置，可以参考。

## 3. iOS standalone 模式

> iOS standalone模式下的特殊处理

### 3.1. 遇到的问题

今年年初Apple宣布在iOS safari 11.3中支持Service Worker，这对PWA的推广起到了重要的作用，让我们可以“跨平台”来实现PWA技术。

虽然，iOS safari不支持manifest配置来实现添加到桌面，但是我在[《【PWA学习与实践】(2) 使用Manifest，让你的WebApp更“Native”》](https://juejin.im/post/5ac8a89ef265da238440d60a)中介绍了如何用safari自有的meta标签来实现standalone模式。

不过，问题就出在了standalone模式上。抛开iOS safari standalone模式现有的一些其他小bug（包括状态栏的显示、白屏、重复添加等），iOS safari standalone模式有一个无法回避的重大问题。其源于iOS与android的一个重要区别：

iOS没有后退键，而一般android机都有。

在iOS上使用standalone模式添加的应用，由于没有浏览器的工具栏，所以无法进行后退。例如我打开首页，然后点击首页课程列表中的一门课程后，浏览器跳转到课程页，由于iOS没有后退键，所以你无法再回到首页，除非杀死“应用”重新启动。

### 3.2. 产生的原因

正如上面所提到的，由于iOS没有后退键，而standalone模式会隐藏浏览器工具条和导航条，因此，在iOS中使用保存到桌面的WebApp，就像是一次不能回头的旅行……

### 3.3. 解决方案

显然，这种体验是无法接受的。目前我采用的解决方案非常简单，在打开页面时进行判断，如果是iOS中的standalone模式，则在页面右上角显示一个“返回”小图标。点击图标返回上一个页面。

iOS中有一个专门的属性来判断是否为standalone模式：

```javascript
if ('standalone' in window.navigator && window.navigator.standalone) {
    // standalone模式进行特殊处理，例如展示返回按钮
    backBtn.show();
}
```

使用history API即可实现按钮的后退功能：

```javascript
backBtn.addEventListener('click', function () {
    window.history.back();
});
```

## 4. 图片策略

> 解决PWA离线资源中非缓存图片资源的展示

### 4.1. 遇到的问题
在实际使用中，为了满足一定的离线功能，我缓存了一些变化频率极小的API数据，例如个人中心里的列表信息。而列表中包含了较多的图片。为了节省了用户的存储空间，对于图片资源我并未选择缓存。

这导致了一个问题：离线情况下，虽然用户能正常看到列表信息，但是其中的图片部分都是类似下面这种“图裂了”的情况，体验不太好。

![](/img/16397f563295ef0e.png)

### 4.2. 产生的原因

原因上面已经解释了，离线状态下无法请求到图片资源，所以在一些浏览器中就会表现出这种“图挂了”的状态。

### 4.3. 解决方案

解决这个体验问题的大致思路如下：

1. 首先，需要在本地缓存占位图资源
2. 其次，在获取图片时判断是否出现错误
3. 最后，在错误时使用占位图进行替换

由于只是缓存占位图，而占位图一般较为固定，只会有有限的几种尺寸样式，因此不会产生太多缓存空间的占用。占位图的缓存完全可以在缓存静态资源时一起进行。

而图片获取出错（可能是网络原因，也可能是URL错误）时，进行占位图的替换有两种简单的方式：

**方法一：在fetch事件中监听图片资源，出错时使用占位图**

```javascript
self.addEventListener('fetch', e => {
    if (/\.png|jpeg|jpg|gif/i.test(e.request.url)) {
        e.respondWith(
            fetch(e.request).then(response => {
                return response;
            }).catch(err => {
                // 请求错误时使用占位图
                return caches.match(placeholderPic).then(cache => cache);
            })
        );
        return;
    }
```

**方法二：通过img标签的onerror属性来请求占位图**

先将img标签改为

```HTML
<img class="list-cover"
    src="//your.sample.com/1234.png"
    alt="{{ item.desc }}"
    onerror="javascript:this.src='https://your.sample.com/placeholder.png'"/>   
```

`onerror`属性中指定的方法会在图片加载错误时替换`src`；同时我们将Service Worker中的代码进行调整：

```javascript
self.addEventListener('fetch', e => {
    if (/\.png|jpeg|jpg|gif/i.test(e.request.url)) {
        e.respondWith(
            fetch(e.request).then(response => {
                return response;
            // 触发onerror后，img会再次请求图片placeholder.png
            // 由于无网络连接，此fetch依然会出错
            }).catch(err => {
                // 由于我们事先缓存了placeholder.png，这里会返回缓存结果
                return caches.match(e.request).then(cache => cache);
            })
        );
        return;
    }
```

## 5. 写在最后

本文总结了一些我在进行PWA升级实践中遇到的问题，希望对遇到类似问题的朋友能够有一些启发或帮助。

在下一篇文章中，我会回到PWA相关技术，介绍Resource Hint，以及如何使用Resource Hint来提高页面的加载性能，提升用户体验。


## 《PWA学习与实践》系列
- [第一篇：2018，开始你的PWA学习之旅](https://juejin.im/post/5ac8a67c5188255c5668b0b8)
- [第二篇：10分钟学会使用Manifest，让你的WebApp更“Native”](https://juejin.im/post/5ac8a89ef265da238440d60a)
- [第三篇：从今天起，让你的WebApp离线可用](https://juejin.im/post/5aca14b6f265da237c692e6f)
- [第四篇：TroubleShooting: 解决FireBase login验证失败问题](https://juejin.im/post/5accc3c9f265da23870f2abc)
- [第五篇：与你的用户保持联系: Web Push功能](https://juejin.im/post/5accd1355188252b0b201fb9)
- [第六篇：How to Debug? 在chrome中调试你的PWA](https://juejin.im/post/5ae56f926fb9a07aca79edf6)
- [第七篇：增强交互：使用Notification API来进行提醒](https://juejin.im/post/5ae7f7fd518825670960fe96)
- [第八篇：使用Service Worker进行后台数据同步](https://juejin.im/post/5af80c336fb9a07aab29f19c)
- 第九篇：PWA实践中的问题与解决方案（本文）
- [第十篇：Resource Hint - 提升页面加载性能与体验](https://juejin.im/post/5b4b66f0f265da0f9155feb6)
- 第十一篇：从PWA离线工具集workbox中学习各类离线策略（写作中…）

## 参考资料
### Service Worker Scope
- [Service Worker Scope (MDN)](https://developer.mozilla.org/zh-CN/docs/Web/API/ServiceWorkerContainer/register#%E5%8F%82%E6%95%B0)
- [Understanding Service Worker scope](https://stackoverflow.com/questions/35780397/understanding-service-worker-scope)
- [How exactly add “Service-Worker-Allowed” to register service worker scope in upper folder](https://stackoverflow.com/questions/49084718/how-exactly-add-service-worker-allowed-to-register-service-worker-scope-in-upp)

### CORS
- [What limitations apply to opaque responses?](https://stackoverflow.com/questions/39109789/what-limitations-apply-to-opaque-responses)
- [Handle Third Party Requests](https://developers.google.com/web/tools/workbox/guides/handle-third-party-requests)
- [CORS settings attributes](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes)
- [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Git Repo: server configs](https://github.com/h5bp/server-configs)

### iOS standalone
- [Don’t use iOS meta tags irresponsibly in your Progressive Web Apps](https://medium.com/@firt/dont-use-ios-web-app-meta-tag-irresponsibly-in-your-progressive-web-apps-85d70f4438cb)

