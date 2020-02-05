---
title: 前端广播式通信：Broadcast Channel
date: 2019-04-01 12:00:00
tags:
- 3分钟速览
- 浏览器
- 特性
---

![](/img/broadcast.jpg)

前端如何实现广播式通信呢？Broadcast Channel 就是一个好方法。它会创建一个所有同源页面都可以共享的（广播）频道，因此其中某一个页面发送的消息可以被其他页面监听到。

<!-- more -->

## Broadcast Channel 是什么？

在前端，我们经常会用 `postMessage` 来实现页面间的通信，但这种方式更像是点对点的通信。对于一些需要广播（让所有页面知道）的消息，用 `postMessage` 不是非常自然。Broadcast Channel 就是用来弥补这个缺陷的。

顾名思义，Broadcast Channel 会创建一个所有同源页面都可以共享的（广播）频道，因此其中某一个页面发送的消息可以被其他页面监听到。

下面就来速览一下它的使用方法。

## 如何使用？

Broadcast Channel 的 API 非常简单易用。

### 创建

首先我们会使用构造函数创建一个实例：

```JavaScript
const bc = new BroadcastChannel('alienzhou');
```

可以接受一个 `DOMString` 作为 name，用以标识这个 channel 。在其他页面，可以通过传入相同的 name 来使用同一个广播频道。用 MDN 上的话来解释就是：

> There is one single channel with this name for all browsing contexts with the same origin.

该 name 值可以通过实例的 `.name` 属性获得

```JavaScript
console.log(bc.name);
// alienzhou
```

### 监听消息

Broadcast Channel 创建完成后，就可以在页面监听广播的消息：

```JavaScript
bc.onmessage = function(e) {
    console.log('receive:', e.data);
};
```

对于错误也可以绑定监听：

```JavaScript
bc.onmessageerror = function(e) {
    console.warn('error:', e);
};
```

> 除了为 `.onmessage` 赋值这种方式，也可以使用 `addEventListener` 来添加 `'message'` 监听。

### 发送消息

Broadcast Channel 实例也有一个对应的 `postMessage` 用于发送消息：

```JavaScript
bc.postMessage('hello');
```

### 关闭

可以看到，上述短短几行代码就可以实现多个页面间的广播通信，非常方便。而有时我们希望取消当前页面的广播监听：

- 一种方式是取消或者修改相应的 `'message'` 事件监听
- 另一种简单的方式就是使用 Broadcast Channel 实例为我们提供的 `close` 方法。

```JavaScript
bc.close();
```

两者是有区别的：

取消 `'message'` 监听只是让页面不对广播消息进行响应，Broadcast Channel 仍然存在；而调用 `close` 方法这会切断与 Broadcast Channel 的连接，浏览器才能够尝试回收该对象，因为此时浏览器才会知道用户已经不需要使用广播频道了。

在关闭后调用 `postMessage` 会出现如下报错

![](/img/169d80b1620cdac9.png)

如果之后又再需要广播，则可以重新创建一个相同 name 的 Broadcast Channel。

## Demo 效果

[可以戳这里查看在线 Demo >>](https://alienzhou.github.io/broadcast-channel/)

下面是 Broadcast Channel Demo 的演示效果：

![](/img/169d8452cef80241.gif)

## 兼容性如何？

Broadcast Channel 是一个非常好用的多页面消息同步 API，然而兼容性却**不是很乐观**。

![](/img/169d80efd65b5401.png)

好在我们还有些其他方案可以作为补充（或者作为 polyfill ），其他的前端跨页面通信可以参考我的另一篇文章[《前端跨页面通信的方法》](/2019/04/01/cross-tab-communication-in-frontend/)。
