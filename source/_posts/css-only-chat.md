---
title: 如何在零JS代码情况下实现实时聊天功能？
date: 2019-05-20 12:00:00
tags:
- CSS
- 综合
---

![](./img/css-chat.jpg)

在我们的印象里，实现一个简单的聊天应用（消息发送与多页面同步）并不困难 —— 这是在我们有 JavaScript 的帮助下。而如果让你只能使用 CSS，不能有前端的 JavaScript 代码，那你能够实现么？

<!-- more -->

## 引言

前段时间在 github 上看到了一个很“trick”的项目：用纯 CSS（即不使用 JavaScript）实现一个聊天应用 —— [css-only-chat](https://github.com/kkuchta/css-only-chat)。即下图所示效果。

![](/img/css-only-chat/16ad56d29a8af1c6.gif)

> 原版是用 Ruby 写的后端。可能大家对 Ruby 不太了解，所以我按照原作者思路，用 NodeJS 实现了一版 [css-only-chat-node](https://github.com/alienzhou/css-only-chat-node)，对大家来说可能会更易读些。

## 1. 我们要解决什么问题

首先强调一下，服务端的代码肯定还是需要写的，而且这部分显然不能是 CSS。所以这里的“纯 CSS”主要指在浏览器端只使用 CSS。

回忆一下，如果使用 JavaScript 来实现上图中展示的聊天功能，有哪些问题需要处理呢？

- 首先，需要添加按钮的`click`事件监听，包括字符按钮的点击与发送按钮的点击；
- 其次，点击相应按钮后，要将信息通过 Ajax 的方式发送到后端服务；
- 再者，要实现实时的消息展示，一般会建立一个 WebSocket 连接；
- 最后，对于后端同步来的消息，我们会在浏览器端操作 DOM API 来改变 DOM 内容，展示消息记录。

涉及到 JavaScript 的操作主要就是上面四个了。但是，现在我们只能使用 CSS，那对于上面这几个操作，可以用什么方式实现呢？

## 2. Trick Time

### 2.1. 解决“点击监听”的问题

使用 JavaScript 的话一行代码可以搞定：

```JavaScript
document.getElementById('btn').addEventListener('click', function () {
    // ……
});
```

使用 CSS 的话，其实有个伪类可以帮我们，即`:active`。它可以选择激活的元素，而当我们点击某个元素时，它就会处于激活状态。

所以，对于上面动图中的26个字母（再加上 send 按钮），可以分配不同的`classname`，然后设置伪类选择器，这样就可以在点击该字母对应的按钮时触发命中某个 CSS 规则。例如可以对字符“a”设置如下规则用于“捕获”点击：

```CSS
.btn_a:active {
    /* …… */ 
}
```

### 2.2. 发送请求

如果有 JavaScript 的帮助，发送请求只需要用个 XHR 即可，很方便。而对于 CSS，如果要想发一个请求的话有什么办法么？

可以使用`background-image`属性，将它指定为某个 URL，这样前端就会向服务器发起一个背景图片的请求。之所以可以使用`background-image`属性还因为：浏览器只有在该 CSS 选择器规则被实际应用到 DOM 元素后才会实际发起`background-image`的请求。例如下面这个规则：

```CSS
.btn_a:active {
    background-image: url('/keys/a');
}
```

只有在字符“a”被点击后，浏览器才会向服务器请求`/keys/a`这张“图片”。而在服务器端，通过判断 URL 可以知道前端点击了哪个字符。例如，对于按钮“b”会有如下规则：

```CSS
.btn_b:active {
    background-image: url('/keys/b');
}
```

这样就相当于实现了在 URL（`/keys/a`与`/keys/b`） 中“传参”。 

### 2.3. 实时消息展示

实时的消息展示，核心会用到一种叫“服务器推”的技术。其中比较常见方式有：

- 使用 JavaScript 来和服务端建立 WebSocket 连接
- 使用 JavaScript 创建定时器，定时发送请求轮询
- 使用 JavaScript 和服务端配合来实现长轮询

但这些方法都无法规避 JavaScript，显然不符合咱们的要求。其实还有一种方式，我在[《各类“服务器推”技术原理与实例》](/2018/06/08/server-push-methods/)中也有提到，那就是基于 iframe 的长连接流（stream）模式。

这里我们主要是借鉴了“长连接流”这种模式。让我们的页面永远处于一个未加载完成的状态。但是，由于请求头中包含`Transfer-Encoding: chunked`，它会告诉浏览器，虽然页面没有返回结束，但你可以开始渲染页面了。正是由于该请求的响应永远不会结束，所以我们可以不断向其中写入新的内容，来更新页面展示。

实现起来也非常简单。`http.ServerResponse`类本身就是继承自`Stream`的，所以只要在需要更新页面内容时调用`.write()`方法即可。例如下面这段代码，可以每隔2s在页面上动态添加 "hello" 字符串而不需要任何浏览器端的配合（也就不需要写 JavaScript 代码了）：

```JavaScript
const http = require('http');
http.createServer((req, res) => {
    res.setHeader('connection', 'keep-alive');
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    res.write('I will update by myself');

    setInterval(() => res.write('<br>hello'), 2000);
}).listen(8085);
```

![](/img/css-only-chat/16ad547da08e7d73.gif)

### 2.4. 改变页面信息

在上一节我们已经可以通过 Stream 的方式，不借助 JavaScript 即可动态改变页面内容了。但是如果你细心会发现，这种方式只能不断“append”内容。而在我们的例子中，看起来更像是能够动态改变某个 DOM 中的文本，例如随着点击不同按钮，“Current Message”后面的文本会不断变化。

这里其实也有个很“trick”的方式。下图这个部分（我们姑且叫它 ChatPanel 吧）

![](/img/css-only-chat/16ad543f357344b1.png)

其实我们每次调用`res.write()`时都会返回一个全新的 ChatPanel 的 HTML 片段。于此同时，还会附带一个`<style>`元素，将之前的 ChatPanel 设为`display: none`。所以看起来像是更新了原来的 ChatPanel 的内容，但其实是 append 了一个新的，同时隐藏之前的 ChatPanel。

### 2.5. 点击重复的按钮

到目前为止，基本的方案都有了，但还有一个重要的问题：

在 CSS 规则中的`background-image`只会在第一次应用到元素时发起请求，之后就不会再向服务器请求了。也就是说，用

```CSS
.btn_a:active {
    background-image: url('/keys/a');
}
```

这种规则，“a” 这个按钮点过一次之后，下次再点击就毫无反应了 —— 即后端收不到请求了。

要解决这个问题有一个方法。可以在每次返回的新的 ChatPanel（ChatPanel 是啥咱们在上一节中提到了，如果忘了可以回去看下）里，为每个字符按钮都应用一套新的样式规则，并设置新的背景图 URL。例如我们第一次点击了“h”之后，返回的 ChatPanel 里的按钮“a”的`classname`会该成`btn_h_a`，对应的 CSS 规则改为：

```CSS
.btn_h_a:active {
    background-image: url('/keys/h_a');
}
```

再次点击“i”之后，ChatPanel 里对应的按钮的样式规则改为：

```CSS
.btn_hi_a:active {
    background-image: url('/keys/hi_a');
}
```

### 2.6. 存储

为了能够保存未发送的内容（点击 send 按钮之前的输入内容），以及同步历史消息，需要有个地方存储用户输入。同时我们还会为每个连接设定一个唯一的用户 ID。在原版的 css-only-chat 中使用了 Redis。我在 css-only-chat-node 中为了简便，直接存储在了运行时的内存变量中了。

## 3. 最后

也许有朋友会问，这个 DEMO 有什么实用价值么？可以发展成一个可用的聊天工具么？

好吧，其实我觉得没有太大用。但是里面涉及到的一些“知识点”到是了解下也无妨。我们每天面对那么多无趣的需求，偶尔看看这种“有意思”的项目也算是放松一下吧。

最后，如果想看具体的运行效果，或者想了解代码的细节，可以看这里：

- [css-only-chat-node](https://github.com/alienzhou/css-only-chat-node)：由于原版是 Ruby 写的，所以实现了一个 NodeJS 版的便于大家查看
- [css-only-chat](https://github.com/kkuchta/css-only-chat)：css-only-chat 的原版仓库，使用 Ruby 实现

Just have fun! 😜