---
title: 各类“服务器推”技术原理与实例
date: 2018-06-08 12:00:00
tags:
- 综合
- JavaScript
---


服务器推（Server Push）是一类特定技术的总称。一般情况，客户端与服务器的交互方式是：客户端发起请求，服务器收到请求返回响应结果，客户端接收响应结果进行处理。从上述的交互过程中可以看出，客户端想要获取数据，需要自主地向服务端发起请求，获取相关数据。

在大多数场景下，客户端的“主动式”行为已经可以满足需求了。然而，在一些场景下，需要服务器“主动”向客户端推送数据。例如：

- 聊天室或者对话类应用
- 实时的数据监控与统计
- 股票财经类看板等等

这类应用有几个重要特点：要求较高的实时性，同时客户端无法预期数据更新周期，在服务端获取最新数据时，需要将信息同步给客户端。这类应用场景被称为“服务器推”（Server Push）。

“服务器推”技术由来已久，从最初的简单轮询，到后来基于长轮询的 COMET，到HTML5规范的 SSE，以及实现全双工的 WebSocket 协议，“服务器推”的技术不断发展。本文会介绍这些技术的基本原理以及实现方式，来帮助大家迅速了解与掌握“服务器推”各类技术的基本原理。文末会附上完整的 demo 地址。

<!-- more -->

## 1. 简易轮询

简易轮询是“解决”该问题最简陋的一个技术方式。

简易轮询本质上就是在前端创建一个定时器，每隔一定的时间去查询后端服务，如果有数据则进行相应的处理。

```javascript
function polling() {
    fetch(url).then(data => {
        process(data);
        return;
    }).catch(err => {
        return;
    }).then(() => {
        setTimeout(polling, 5000);
    });
}

polling();
```

轮询开始时，向后端发送请求，待响应结束后，间隔一定时间再去请求数据，如此循环往复。效果如下：

![](/img/163db06dae676193.gif)

这种做法的优点就是非常简单，几乎不需要进行任何额外的配置或开发。

而与此同时，缺点也十分明显。首先，这种相当于定时轮询的方式在获取数据上存在显而易见的延迟，要想降低延迟，只能缩短轮询间隔；而另一方面，每次轮询都会进行一次完整的HTTP请求，如果没有数据更新，相当于是一次“浪费”的请求，对服务端资源也是一种浪费。

因此，轮询的时间间隔需要进行仔细考虑。轮询的间隔过长，会导致用户不能及时接收到更新的数据；轮询的间隔过短，会导致查询请求过多，增加服务器端的负担。

## 2. COMET

随着web应用的发展，尤其是基于ajax的web2.0时代中web应用需求与技术的发展，基于纯浏览器的“服务器推”技术开始受到较多关注，Alex Russell（Dojo Toolkit 的项目 Lead）称这种基于HTTP长连接、无须在浏览器端安装插件的“服务器推”技术为“Comet”。

常用的COMET分为两种：基于HTTP的长轮询（long-polling）技术，以及基于iframe的长连接流（stream）模式。

### 2.1 基于HTTP的长轮询（long-polling）

在简单轮询中，我们会每隔一定的时间向后端请求。这种方式最大的问题之一就是，数据的获取延迟受限于轮询间隔，无法第一时间获取服务想要推送数据。

长轮询是再此基础上的一种改进。客户端发起请求后，服务端会保持住该连接，直到后端有数据更新后，才会将数据返回给客户端；客户端在收到响应结果后再次发送请求，如此循环往复。关于简单轮询与长轮询的区别，一图胜千言：

![](/img/163dabc8440e4ece.png)

这样，服务端一旦有数据想要推送，可以及时送达到客户端。

```javascript

function query() {
    fetchMsg('/longpolling')
        .then(function(data) {
            // 请求结束，触发事件通知eventbus
            eventbus.trigger('fetch-end', {data, status: 0});
        });
}

eventbus.on('fetch-end', function (result) {
    // 处理服务端返回的数据
    process(result);
    // 再次发起请求
    query();
});
```

以上是一段简略版的前端代码，通过eventbus来通知请求结束，收到结束消息后，`process(result)`处理所需数据，同时再次调用`query()`发起请求。

而在服务端，以node为例，服务端只需要在监听到有消息/数据更新时，再进行返回即可。

```javascript
const app = http.createServer((req, res) => {
    // 返回数据的方法
    const longPollingSend = data => {
        res.end(data);
    };

    // 当有数据更新时，服务端“推送”数据给客户端
    EVENT.addListener(MSG_POST, longPollingSend);

    req.socket.on('close', () => {
        console.log('long polling socket close');
        // 注意在连接关闭时移除监听，避免内存泄露
        EVENT.removeListener(MSG_POST, longPollingSend);
    });
});
```

效果如下：

![](/img/163db08447932e5e.gif)

### 2.2 基于iframe的长连接流（stream）模式

当我们在页面中嵌入一个iframe并设置其src时，服务端就可以通过长连接“源源不断”地向客户端输出内容。

例如，我们可以向客户端返回一段script标签包裹的javascript代码，该代码就会在iframe中执行。因此，如果我们预先在iframe的父页面中定义一个处理函数`process()`，而在每次有新数据需要推送时，在该连接响应中写入`<script>parent.process(${your_data})</script>`。那么iframe中的这段代码就会调用父页面中预先定义的`process()`函数。（是不是有点像JSONP传输数据的方式？）

```javascript
// 在父页面中定义的数据处理方法
function process(data) {
    // do something
}

// 创建不可见的iframe
var iframe = document.createElement('iframe');
iframe.style = 'display: none';
// src指向后端接口
iframe.src = '/long_iframe';
document.body.appendChild(iframe);
```

后端还是以node为例

```javascript
const app = http.createServer((req, res) => {
    // 返回数据的方法，将数据拼装成script脚本返回给iframe
    const iframeSend = data => {
        let script = `<script type="text/javascript">
                        parent.process(${JSON.stringify(data)})
                    </script>`;
        res.write(script);
    };

    res.setHeader('connection', 'keep-alive');
    // 注意设置相应头的content-type
    res.setHeader('content-type', 'text/html; charset=utf-8');        
    // 当有数据更新时，服务端“推送”数据给客户端
    EVENT.addListener(MSG_POST, iframeSend);

    req.socket.on('close', () => {
        console.log('iframe socket close');
        // 注意在连接关闭时移除监听，避免内存泄露
        EVENT.removeListener(MSG_POST, iframeSend);
    });
});
```

效果如下：

![](/img/163db0aba564b278.gif)

不过使用iframe有个小瑕疵，因此这个iframe相当于永远也不会加载完成，所以浏览器上会一直有一个loading标志。

总得来说，长轮询和iframe流这两种COMET技术，具有了不错的实用价值，其特点在于兼容性非常强，不需要客户端或服务端支持某些新的特性。不过，为了便于处理COMET使用时的一些问题，还是推荐在生产环境中考虑一些成熟的第三方库。值得一提的是，Socket.io在不兼容WebSocket（我们后面会提到）的浏览器中也会回退到长轮询模式。

然而，COMET技术并不是HTML5标准的一部分，从兼容标准的角度出发的话，并不推荐使用。（尤其在我们有了一些其他技术之后）

## 3. SSE (Server-Sent Events)

SSE (Server-Sent Events) 是HTML5标准中的一部分。其实现原理类似于我们在上一节中提到的基于iframe的长连接模式。

HTTP响应内容有一种特殊的content-type —— text/event-stream，该响应头标识了响应内容为事件流，客户端不会关闭连接，而是等待服务端不断得发送响应结果。

SSE规范比较简单，主要分为两个部分：浏览器中的`EventSource`对象，以及服务器端与浏览器端之间的通讯协议。

在浏览器中可以通过`EventSource`构造函数来创建该对象

```javascript
var source = new EventSource('/sse');
```

而SSE的响应内容可以看成是一个事件流，由不同的事件所组成。这些事件会触发前端`EventSource`对象上的方法。

```javascript
// 默认的事件
source.addEventListener('message', function (e) {
    console.log(e.data);
}, false);

// 用户自定义的事件名
source.addEventListener('my_msg', function (e) {
    process(e.data);
}, false);

// 监听连接打开
source.addEventListener('open', function (e) {
    console.log('open sse');
}, false);

// 监听错误
source.addEventListener('error', function (e) {
    console.log('error');
});

```

`EventSource`通过事件监听的方式来工作。注意上面的代码监听了`my_msg`事件，SSE支持自定义事件，默认事件通过监听`message`来获取数据。

SSE中，每个事件由类型和数据两部分组成，同时每个事件可以有一个可选的标识符。不同事件的内容之间通过仅包含回车符和换行符的空行（"\r\n"）来分隔。每个事件的数据可能由多行组成。

- 类型为空白，表示该行是注释，会在处理时被忽略。
- 类型为 data，表示该行包含的是数据。以 data 开头的行可以出现多次。所有这些行都是该事件的数据。
- 类型为 event，表示该行用来声明事件的类型。浏览器在收到数据时，会产生对应类型的事件。例如我在上面自定义的`my_msg`事件。
- 类型为 id，表示该行用来声明事件的标识符。
- 类型为 retry，表示该行用来声明浏览器在连接断开之后进行再次连接之前的等待时间。

可以看到，SSE确实是一个比较简单的协议规范，服务端实现也比较简单：

```javascript
const app = http.createServer((req, res) => {
    const sseSend = data => {
        res.write('retry:10000\n');            
        res.write('event:my_msg\n');
        // 注意文本数据传输
        res.write(`data:${JSON.stringify(data)}\n\n`);
    };

    // 注意设置响应头的content-type
    res.setHeader('content-type', 'text/event-stream');
    // 一般不会缓存SSE数据
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('connection', 'keep-alive');
    res.statusCode = 200;

    res.write('retry:10000\n');
    res.write('event:my_msg\n\n');

    EVENT.addListener(MSG_POST, sseSend);

    req.socket.on('close', () => {
        console.log('sse socket close');
        EVENT.removeListener(MSG_POST, sseSend);
    });
});
```

效果如下：

![](/img/163db0c9519f6a53.gif)

此外，我们还可以考虑结合HTTP/2的优势来使用SSE。然而，一个可能不太好的消息是，IE/Edge并不兼容。

![](/img/163daf0d02eb1e6c.png)

当然，你可以通过一些手段来写一个兼容IE的polyfill。不过，由于IE上的XMLHttpRequest对象并不支持获取部分的响应内容，因此只能使用XDomainRequest来替代，当然，这也导致了一些小问题。如果大家对具体的实现细节感兴趣，可以看一下这个polyfill库[Yaffle/EventSource](https://github.com/Yaffle/EventSource)。

## 4. WebSocket

WebSocket与http协议一样都是基于TCP的。WebSocket其实不仅仅限于“服务器推”了，它是一个全双工的协议，适用于需要进行复杂双向数据通讯的场景。因此也有着更复杂的规范。

![](/img/163db3d3dd408fcb.png)

当客户端要和服务端建立WebSocket连接时，在客户端和服务器的握手过程中，客户端首先会向服务端发送一个HTTP请求，包含一个`Upgrade`请求头来告知服务端客户端想要建立一个WebSocket连接。

在客户端建立一个WebSocket连接非常简单：

```javascript
var ws = new WebSocket('ws://127.0.0.1:8080');
```
当然，类似于`HTTP`和`HTTPS`，`ws`相对应的也有`wss`用以建立安全连接。

这时的请求头如下：（注意其中的Upgrade字段）

```
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Cache-Control: no-cache
Connection: Upgrade
Cookie: Hm_lvt_4e63388c959125038aabaceb227cea91=1527001174
Host: 127.0.0.1:8080
Origin: http://127.0.0.1:8080
Pragma: no-cache
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
Sec-WebSocket-Key: 0lUPSzKT2YoUlxtmXvdp+w==
Sec-WebSocket-Version: 13
Upgrade: websocket
```

而服务器在收到请求后进行处理，响应头如下

```
Connection: Upgrade
Origin: http://127.0.0.1:8080
Sec-WebSocket-Accept: 3NOOJEzyscVfEf0q14gkMrpV20Q=
Upgrade: websocket
```

表示升级到了WebSocket协议。

注意，上面的请求头中有一个`Sec-WebSocket-Key`，这其实和加密、安全性关系不大，最主要的作用是来验证服务器是否真的正确“理解”了WebSocket、该WebSocket连接是否有效。服务器会使用`Sec-WebSocket-Key`，并根据一个固定的算法

```javascript
mask = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";  // 一个规定的字符串
accept = base64(sha1(key + mask));
```

生成`Sec-WebSocket-Accept`响应头字段，交由浏览器验证。

接下来，浏览器与服务器之间就可以愉快地进行双向通信了。

鉴于篇幅，关于WebSocket协议的具体规范与细节（例如数据帧格式、心跳检查等）就不在这里深入了，网络上也有很多这类的不错的文章可以阅读，感兴趣的读者也可以阅读本文最后的参考资料。

下面简单介绍一下WebSocket的使用。

在浏览器端，建立WebSocket连接后，可以通过`onmessage`来监听数据信息。

```javascript
var ws = new WebSocket('ws://127.0.0.1:8080');

ws.onopen = function () {
    console.log('open websocket');
};

ws.onmessage = function (e) {
    var data = JSON.parse(e.data);
    process(data);
};
```

在服务器端，由于WebSocket协议具有较多的规范与细节需要处理，因此建议使用一些封装较完备的第三方库。例如node中的[websocket-node](https://github.com/theturtle32/WebSocket-Node)和著名的[socket.io](https://github.com/socketio/socket.io)。当然，其他语言也有许多[开源实现](https://github.com/search?q=websocket)。node部分代码如下：

```javascript
const http = require('http');
const WebSocketServer = require('websocket').server;

const app = http.createServer((req, res) => {
    // ...
});
app.listen(process.env.PORT || 8080);

const ws = new WebSocketServer({
    httpServer: app
});

ws.on('request', req => {
    let connection = req.accept(null, req.origin);
    let wsSend = data => {
        connection.send(JSON.stringify(data));
    };
    // 接收客户端发送的数据
    connection.on('message', msg => {
        console.log(msg);
    });
    connection.on('close', con => {
        console.log('websocket close');
        EVENT.removeListener(MSG_POST, wsSend);
    });
    // 当有数据更新时，使用WebSocket连接来向客户端发送数据
    EVENT.addListener(MSG_POST, wsSend);
});
```

效果如下：

![](/img/163db4bae3a5ec95.gif)

## 写在最后

服务器推（Server Push）作为一类特定的技术，在一些业务场景中起到了重要的作用，了解各类技术实现的原理与特点，有利于在实际的业务场景中帮助我们做出一定的选择与判断。

为了便于理解文中的内容，我把所有代码整理在了一个demo里，感兴趣的朋友可以在[这里](https://github.com/alienzhou/server_push_demo)下载，并在本地运行查看。

![](/img/163db4e9e1cf80b1.gif)

## 参考资料

- [w3c: Server-Sent Events](https://www.w3.org/TR/2015/REC-eventsource-20150203/)
- [w3c: The WebSocket API](https://www.w3.org/TR/websockets/)
- [Comet：基于 HTTP 长连接的“服务器推”技术](https://www.ibm.com/developerworks/cn/web/wa-lo-comet/)
- [HTML5 服务器推送事件（Server-sent Events）实战开发](https://www.ibm.com/developerworks/cn/web/1307_chengfu_serversentevent/)
- [What is Sec-WebSocket-Key for?
](https://stackoverflow.com/questions/18265128/what-is-sec-websocket-key-for)
- [Deep dive into WebSockets and HTTP/2 with SSE + how to pick the right path](https://blog.sessionstack.com/how-javascript-works-deep-dive-into-websockets-and-http-2-with-sse-how-to-pick-the-right-path-584e6b8e3bf7)
- [MDN: Server Sent Event](https://developer.mozilla.org/zh-CN/docs/Server-sent_events/Using_server-sent_events)
- [The WebSocket Protocol](https://tools.ietf.org/html/rfc6455)