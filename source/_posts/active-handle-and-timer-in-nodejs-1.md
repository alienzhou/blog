---
title: Node.js 中的 Active Handle 与 Timer 优化 (上)
date: 2021-07-23 22:31:22
tags:
- NodeJS
- 源码分析
- libuv
---

![](/img/active-handle-and-timer-in-nodejs/nodejs-libuv.jpeg)

近期在做 Node.js 基础监控中 Active Handles/Requests 信息的按需采集功能。在 Active Handles 中包含了 timer 的信息采集，这里的 timer 就是指的通过 `setTimeout`/`setInterval` 设置的定时器，以及 Nodejs 内置 JavaScript 模块中创建的定时器等。而 Nodejs 在 timer 实现上与其他异步资源的代码结构不太一致，做了特定的优化。

<!-- more -->

> 本文源码基于当前（2021.07.18）的 LTS 版（v14.17.3）。其主要逻辑与概念在近四个大版本（v10/12/14/16）上基本一致。

## 1. 引言

由于部分同学可能对 Nodejs 中的 Handles 和 Requests 不太熟悉，所以本文会分为上下两篇：

- 上篇先介绍 Active Handles & Requests 和的基本概念作为铺垫，不会涉及 timer 部分。

- 下篇会介绍 timer “与众不同”的地方，以及 Nodejs 为其定制的优化。

## 2. 什么是 Handles 和 Requests？

提到 Nodejs 中的 Handles 和 Requests 时，我们指的就是 libuv 中的 [Handles 和 Requests](https://docs.libuv.org/en/v1.x/guide/basics.html#handles-and-requests) 概念。

可以大致理解为 Handle 会”指代“一系列 I/O 操作或 timer 等，例如用于 TCP 的 `uv_tcp_t`，用于定时器的 `uv_timer_t`。libuv 中还有一个与其类似的概念是的 Request，它与 Handle 的主要区别就是生命周期的长短。

> Handles represent long-lived objects capable of performing certain operations while active.
> —— libuv design overview

例如我们最常见的 DNS 查询（`uv_getaddrinfo_t`）和文件读写（`uv_fs_t`）就都是 Request。

Nodejs 中的一个核心依赖就是 libuv。它通过 libuv 来实现基于 event loop 模型的异步 I/O，同时抹平了系统间的差异。由于 Handle 会“指代”某个工作，因此通过 Handle（与 Request）的信息也可以一定程度上反应出 Nodejs 目前在忙些什么事儿。

我们在 userland 里做的各种 I/O 操作，最后很多都会直接对应到 libuv 中的 Handle。

![](/img/active-handle-and-timer-in-nodejs/01.png)


上面是从 Handle 角度来看，我们使用 Nodejs 时的大致情况。

日常工作中我们大多都是在 [userland](https://nodejs.org/en/knowledge/getting-started/what-is-node-core-verus-userland/) 写代码（包括引入的 npm 包）。这些代码会引用（require）各个 Nodejs 内置模块，也就是图中的 [internal javascript module](https://github.com/nodejs/node/tree/v14.17.3/lib)。然后最底层是通过 libuv 的 public API 来创建 Handle 并进行异步 I/O。为了能让 js 层使用到最底层的 [uv 库](https://github.com/nodejs/node/tree/v14.17.3/deps/uv)，Nodejs 中有一部分代码会负责做 Handle 的包装，加上一些简单的处理逻辑，再通过 v8 binding 机制暴露给 Nodejs 的内部 js 模块，也就是图中 [Handle Wrap 和 v8 bindings](https://github.com/nodejs/node/tree/v14.17.3/src) 这部分。

Handle Wrap 在 node-core 中就是指的 src 目录下实现的 [ProcessWrap](https://github.com/nodejs/node/blob/v14.17.3/src/process_wrap.cc#L47) / [FSEventWrap](https://github.com/nodejs/node/blob/v14.17.3/src/fs_event_wrap.cc#L49) 这些，它们是对 libuv 中 handle 的封装，都继承自 HandleWrap 抽象类。下图是 HandleWrap 和 ReqWrap（libuv Request 的 Wrap）类相关的类继承关系。

![](/img/active-handle-and-timer-in-nodejs/02.png)

其中浅蓝色部分的 AsyncWrap 是对 Nodejs 中异步操作的抽象，会用来做异步的追踪，例如在 userland 中使用的 [async_hooks](https://nodejs.org/dist/latest/docs/api/async_hooks.html) 中的一些功能就会依赖到这部分。绿色部分的 BaseObject 和 MemoryRetainer 则是用于那些在 JavaScript 层和 C/C++ 层有对应关系的对象时，帮助管理对象的生命周期。

## 3. 什么是 Active 状态？

上面介绍了 Handles 和 Requests。下面说说 Active 的概念。

Active 是 libuv handle 的一种状态。一般某种 handle 都会存在对应的 `uv_xxx_start()` 和 `uv_xxx_stop()` 方法。在调用 `uv_xxx_start()` 后 handle 就会进入 active 状态；而在调用 `uv_xxx_stop` 方法后，handle 就会被 deactivate。因此，通过找到所有的 Active Handles，可以一定程度上了解目前 Nodejs 进程正在或将要干什么事儿。

而在 Nodejs 进程运行时，会通过调用 [uv_loop_alive](https://github.com/nodejs/node/blob/v14.17.3/deps/uv/src/unix/core.c#L353-L362) 来[检查](https://github.com/nodejs/node/blob/v14.17.3/src/node_main_instance.cc#L134-L143)是否存在 active handles & requests，从而判断进程是否需要退出。

```cpp
do {
    uv_run(env->event_loop(), UV_RUN_DEFAULT);

    per_process::v8_platform.DrainVMTasks(isolate_);

    more = uv_loop_alive(env->event_loop());
    if (more && !env->is_stopping()) continue;

    if (!uv_loop_alive(env->event_loop())) {
        EmitBeforeExit(env.get());
    }

    more = uv_loop_alive(env->event_loop());
} while (more == true && !env->is_stopping());
```

上面代码中 `uv_run` 和 `uv_loop_alive` 两个方法都与是否存在 active handle 有关。Nodejs 进程是否退出也与它们的执行情况有关。 `uv_loop_alive` 方法会判断是否有 active 状态的 handles 和 requests。

`uv_run` 则是会[不断循环从各个“队列”中取任务执行](https://github.com/nodejs/node/blob/v14.17.3/deps/uv/src/unix/core.c#L365-L422)，在 `UV_RUN_DEFAULT` 模式下，只有在没有 active handle/request 时，该方法才会跳出循环并返回：

```cpp
int uv_run(uv_loop_t* loop, uv_run_mode mode) {
    ...
    while (r != 0 && loop->stop_flag == 0) {
        ...
        r = uv__loop_alive(loop);
        if (mode == UV_RUN_ONCE || mode == UV_RUN_NOWAIT)
            break;
    }
    ...
    return r;
}
```

从那个上面代码可以看到，DEFAULT 模式下 `uv__loop_alive` 的返回值将决定 event loop 是否持续。而 `uv_loop_alive` 内部实际调用的也是 `uv__loop_alive`。

这就是为什么下面这段代码在运行后，Nodejs 进程不会退出

```js
const http = require('http');
const app = http.createServer(() => {})
app.listen(8088);
```

因为在 Nodejs 进程中存在一个 TCP 的 active handle。

## 4. unref handles

但 libuv 中有一个特殊的操作叫 [unref（解引用）](https://docs.libuv.org/en/v1.x/handle.html?highlight=Reference%20counting#reference-counting)，可以让实际 “active” 的 handle 不会在 `uv_loop_alive` 中被统计到。

每个 event loop 中会维持一个 [active_handles](https://github.com/nodejs/node/blob/v14.17.3/deps/uv/include/uv.h#L1793) 属性用于计数（requests 也类似），在 `uv_loop_alive()` 中会通过 `uv__has_active_handles` 宏来判断是否大于 0。

```c
#define uv__has_active_handles(loop)    \
  ((loop)->active_handles > 0)
```

而使用 `uv_unref()` 来解引用，最后就会通过 `uv__active_handle_rm` 来将该计数减一。

```c
#define uv__active_handle_rm(h)     \
  do {                              \
    (h)->loop->active_handles--;    \
  }                                 \
  while (0)
```

但这只是减少了 `active_handles` 计数，并不会影响 handle 的执行。所以只要进程还未退出，handle 的工作就会正常做。而 Nodejs 也将 unref 操作封装暴露到了 userland 里，基本上如果我们在 userland 中创建的对象有对应的 handle，都会在其上存在一个 `.unref()` 的方法。例如还是上面这段代码，当我们稍作修改

```diff
const http = require('http');
const app = http.createServer(() => {})
app.listen(8088);
+ app.unref();
```

这个时候如果再去运行，进程立刻就退出了。

## 5. 什么时候会用到 `unref`？

也许你会奇怪，为什么需要 `unref` 呢？像上面这段代码，创建了一个 HTTP 服务监听端口，是不希望退出的。但可以考虑另一个场景：

- 我们要读取文件执行一批异步任务，任务结束后进程退出。
- 同时，希望每 5 秒上报一下环境信息。

最简版本：

```js
// do batch tasks
const fs = require('fs');
fs.readFile('task.txt', 'utf-8', (_, content) => {
  doBatchAsyncTasks(content.split(','));
});

// report
const timer = setInterval(reportEnvStat, 5000);
```

但这个版本的一大问题就是，任务结束后进程并不会退出，因为进程中有一个会“永久”存活的 timer handle。处理这种问题有几个可行方式：

1. `doBatchAsyncTasks` 结束后直接调用 `process.exit()` 来主动退出；
2. 在 `doBatchAsyncTasks` 后，通过 `clearInterval()` 来清除定时器。

但这两种方法，都会导致设计上的耦合 —— 异步任务和定时上报需要嵌套对方的资源。

另一种更简便的方式，就是使用 `.unref()`：

```diff
const fs = require('fs');
fs.readFile('task.txt', 'utf-8', (_, content) => {
  doBatchAsyncTasks(content.split(','));
});


const timer = setInterval(reportEnvStat, 5000);
+ timer.unref();
```

这在你实现一个 library 时可能会更典型。如果你的 library 中创建了一个“永久”的 active handle，而其独立存活并无意义的话，就可能导致使用它的进程无法在预期状态下退出。而这种情况 1、2 这两种方法可能就不太合适， 使用 unref 就会好些。

## 6. 如何采集 Active Handles？

那我们如何获取当前进程中的 Active Handles 呢？

一个最简单的思路是，在所有 handle 创建的地方（或者统一入口），存储其信息；然后在所有 stop 的地方删除掉存储的对象。但由于 Nodejs 运行过程中 handles 的数量并不少，创建也很频繁（很多时候和 QPS 成正比），所以这种方式在运行时性能与内存占用上都有明显缺陷。

因此会借助目前 Nodejs 已有的能力。其本身已经存储了创建的 Handles 与 Requests 对象。这样只有在按需触发采集时才会有性能与内存开销，采集完毕后又恢复如初。

在 Nodejs 中有两个比较可行的「采集点」：

1. libuv 提供了 `uv_walk()` 这个 public API 来遍历某个 event loop 中所有的 Handles，包括 active/inactive、ref/unref。
2. Nodejs 也会保存其所创建的 HandleWrap 对象。通过文章之前的部分可以知道，该对象与 libuv handles 有对应关系，保存了指向 libuv handle 的指针。

对于第一种方法，可以传入一个回调函数来处理遍历到的 handles。libuv 内部会把 handles 保存在 event loop 的 `handle_queue` 上，通过遍历该队列 libuv 就可以拿到所有 handles。

第二种方式，则可以通过 Nodejs Environment 对象上的 `handle_wrap_queue()` 方法来获取 `HandleWrapQueue` 的指针，它是一个[双向链表](https://github.com/nodejs/node/blob/v14.17.3/src/util.h#L211-L254)，用存储当前环境下所有的 HandleWrap 对象。

由于之前我们提到的，两者存在对应关系，所以基本上从这两处都可以获取到所需的 handle 详情信息。

## 7. 例外情况：定时器（timer）

通过上面的方式采集，有一个非常重要的例外，就是定时器（timer）：

- `HandleWrapQueue` 中是没有 `TimerWrap` 的，所以通过这种方式，是拿不到 js 层设置的定时器的；
- `uv_walk` 中拿到的 timer handle，与 js 层设置定时器的情况也差异极大，并不能反映其情况。

所以，为什么 `HandleWrapQueue` 中没有 `TimerWrap`？为什么 libuv 中的 timer handle 信息与 js 的 timer 对不上呢？

这两个问题会留到「Nodejs 中的 Active Handle 与 Timer 优化（下）」中继续介绍。

## 总结

最后总结一下本文内容：

1. Handles 和 Requests 是 libuv 中的抽象概念，一种 Handle 大致指代了一种 I/O 操作。
2. node-core 中对各类 Handles 与 Requests 进行了封装，并分别继承自 `HandleWrap` 和 `ReqWrap`。
3. Active Handles/Requests 代表当前进程正在忙或将要忙的事儿，它也是 Nodejs 进程不退出的重要原因。
4. 使用 `.unref()` 方法可以在不“取消” handle 工作的同时，解除该 handle 的 active 计数。
5. 可以通过 `uv_walk` 或 `env->handle_queue()` 来收集大多数 handle 信息。

---

timer 主要来源于两块：

- 来自 [userland](https://nodejs.org/en/knowledge/getting-started/what-is-node-core-verus-userland/) 的定时器，也就是你在代码里写的 `setTimeout`、`setInterval`
- 来自 node-core 中的定时器，主要是 internal js 模块创建，例如用 `http.request` 方法发送请求时去设置的 timeout


本文主要包含两个部分：

1. libvu 是如何实现定时器的？
2. nodejs 中是如何优化定时器的？