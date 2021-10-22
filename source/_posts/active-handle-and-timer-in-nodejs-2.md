---
title: Node.js 中的 Active Handle 与 Timer 优化 (下)
date: 2021-09-18 17:32:00
tags:
- NodeJS
- 源码分析
- libuv
---

![](/img/active-handle-and-timer-in-nodejs/nodejs-libuv.jpeg)

近期在做 Node.js 基础监控中 Active Handles/Requests 信息的按需采集功能。在 Active Handles 中包含了 timer 的信息采集，这里的 timer 就是指的通过 `setTimeout`/`setInterval` 设置的定时器，以及 Nodejs 内置 JavaScript 模块中创建的定时器等。而 Nodejs 在 timer 实现上与其他异步资源的代码结构不太一致，做了特定的优化。

<!-- more -->

> 本文源码基于 v14.17.3。其主要逻辑与概念在近四个双数版本（v10/12/14/16）上基本一致。

## 1. 引言

在上篇中我们介绍了 Handles 和 Requests 的概念，了解了什么是 Active 状态。并且知道了一个信息 —— Nodejs 使用了 `HandleWrap` 这个基类来作为 libuv 中 Handle 的封装，所以我们有两种获取 Handle 的方式：

- 遍历 HandleWrap Queue
- 使用 `uv_walk` 来遍历

但在上篇中提到，通过上面的方式采集，有一个例外，就是定时器（timer）：

- `HandleWrapQueue` 中是没有 `TimerWrap` 的，所以通过这种方式，是拿不到 js 层设置的定时器的；
- `uv_walk` 中拿到的 timer handle，与 js 层设置定时器的情况也差异极大，并不能反映其情况。

那么这篇内容会接着从 Node.js 中 Timer 的实现，来解释「为什么 `HandleWrapQueue` 中没有 `TimerWrap`」，为什么「libuv 中的 timer handle 信息与 js 的 timer 对不上」。


## 2. 真的没有 TimerWrap 么？

有也没有。

Nodejs 中要用到的其他类型的 Handle，基本都会有对应的 `HandleWrap`，但我们却找不到 Timer Handle。不过它曾经有过。

如果你去看 Nodejs 的早期版本（例如 6 年前的 [v2.0.0](https://github.com/nodejs/node/blob/v2.0.0/src/timer_wrap.cc)），会发现实际是有 time_wrap.cc 这个文件的：

![](/img/active-handle-and-timer-in-nodejs/03.png)

我们在 userland 里设置的定时器，就会间接使用到它。然后，在 v11.0.0 中被[移出](https://github.com/nodejs/node/commit/2930bd1317d15d12738a4896c0a6c05700411b47)。移除它的一个原因也是因为在多个版本迭代后，已经不再需要向 js 层暴露创建 native 定时器的能力。这和 Timer 的实现也很有关系。

## 3. libuv 中 timer 的实现

我们以 v14.17.3 配套的 libuv v1.47.0 为例来看下其中 timer 的实现。

libuv 会使用 heap 来存储所有的 timer handle。在[调用定时器的 start 方法时，会插入堆中](https://github.com/nodejs/node/blob/v14.17.3/deps/uv/src/timer.c#L89-L91)，而 stop 则会从 heap 里移除：

```c
int uv_timer_start(uv_timer_t* handle,
                   uv_timer_cb cb,
                   uint64_t timeout,
                   uint64_t repeat) {
  ...
  heap_insert(timer_heap(handle->loop),
              (struct heap_node*) &handle->heap_node,
              timer_less_than);
  ...
}
```

在核心的循环方法 `uv_run` 中则[有一个阶段是执行定时器](https://github.com/nodejs/node/blob/v14.17.3/deps/uv/src/unix/core.c#L376)的：

```c
int uv_run(uv_loop_t* loop, uv_run_mode mode) {
  ...
  r = uv__loop_alive(loop);
  if (!r)
    uv__update_time(loop);

  while (r != 0 && loop->stop_flag == 0) {
    ...
    uv__run_timers(loop);
    ...
  }
}
```

它实际上就是从 heap 中[遍历所有到期的定时器](https://github.com/nodejs/node/blob/v14.17.3/deps/uv/src/timer.c#L163-L180)来执行：

```c
void uv__run_timers(uv_loop_t* loop) {
  struct heap_node* heap_node;
  uv_timer_t* handle;

  for (;;) {
    heap_node = heap_min(timer_heap(loop));
    if (heap_node == NULL)
      break;

    handle = container_of(heap_node, uv_timer_t, heap_node);
    if (handle->timeout > loop->time)
      break;

    uv_timer_stop(handle);
    uv_timer_again(handle);
    handle->timer_cb(handle);
  }
}
```

## 4. Nodejs 在使用 timer 时面临的问题

libuv 中实现定时器的逻辑并不复杂。但是这种情况下，在实际的应用中可能会有些问题。

在大多数 Node.js 应用中，定时器的创建会很频繁。我们也许只注意到自己使用的 `setTimeout`/`setInterval`，但像是发起 http 请求时的 timeout，处理 incoming message 时的 timeout 等等，这些都会涉及定时器。

试想一下，我们 1 个接口对应 3 个后端请求的话，处理一个请求就会用到 4 个定时器，处理 1000 个请求就会要创建 4000 个定时器。那么这里可能就有两部分不好忽视的开销：

1. timer 插入 heap 的时间
2. js 与 C++ 之间的频繁调用，因为需要不停创建 TimerWrap

那么有办法优化么？

## 5. 借鉴 libev，优化 timer 实现

与 libuv 类似，有一个叫 [libev](http://software.schmorp.de/pkg/libev.html) 的异步事件库，它介绍了[优化 timer 的一些思路](http://pod.tst.eu/http://cvs.schmorp.de/libev/ev.pod#Be_smart_about_timeouts)。Node.js [参考了](https://github.com/nodejs/node/blob/v4.9.1/lib/timers.js#L15-L19)它的思路。

![](/img/active-handle-and-timer-in-nodejs/04.png)

但这块其实有过两次优化调整。下面先来介绍第一次优化，看看它是如何降低 timer 的 start、stop、处理到期 handler 这三个操作的时间复杂度。

Node.js 运用了一个假设（或者说是先验知识）：很多 Timer 都会具有同样的 timeout 值。它是该优化手段的基础。

这里的 timeout 值可以理解为 `setTimeout` 和 `setInterval` 的第二个参数，也就是那个毫秒参数。正如刚才说的，一般大批量的定时会在像是 http timeout 这种场景下产生；或者我们在写代码时，大多也是设置固定时间的定时器。那么 timeout 就是可枚举的。我们可以把 timeout 相同的 timer 存入一个双向链表中。每个链表会对应创建一个 TimeWrap(TimeHandleWrap)，负责顺序触发这个链表中的 timer。

结构如下：

![](/img/active-handle-and-timer-in-nodejs/05.png)

由于链表是按 timer 创建的时间顺序插入，所以顺序触发即可，不需要额外的遍历。

先来看 stop 操作，即移除 timer。显然，移除双向链表某一节点的复杂度是 O(1)。再来看 start，也就是插入操作。目前，插入需要遍历所有 TimerList 找到该 timeout 对应的链表。那么很容易想到的优化就是基于 timeout 值加哈希映射。在 js 中可以用类似 map (object) ：

![](/img/active-handle-and-timer-in-nodejs/06.png)

那么在插入的时候可以先通过 Map 找到链表，再在链表尾部插入，整个操作维持在 O(1)：

![](/img/active-handle-and-timer-in-nodejs/07.png)


最终就是如下的数据结构：

![](/img/active-handle-and-timer-in-nodejs/08.png)

Node.js 在 js 层维护了主要的数据结构，而每个 timeout 值对应的 C/C++ timer handle 会在触发时通过 binding 获取并调用 js callback。

## 6. 进一步的优化

在做完上面的优化之后，已经大幅减少了实际的 timer handle 的创建，不再需要每次添加定时器时都走一遍 js -> C++ 的调用；同时，还将操作复杂度从 O(lgN) 降为了 O(1)。而在这个情况下，Node.js 在 v11.0.0 中又进行了一次 timer 结构的调整。

在这个 [PR](https://github.com/nodejs/node/commit/23a56e0c28cd828ef0cabb05b30e03cc8cb57dd5#diff-5a0457600721c223f1ed7184ef7d1d2617f4552a5341b53a49b284f808981724) 中，每个 Node.js 环境只需要一个 timer handle，不再需要每个 timeout 值就创建一个 TimerWrap(timer handle) 了。

如何只使用一个实际的 TimerWrap 来处理可能出现的所有 js 中的 timer 呢？其中主体数据结构与第五节相同，仍然是 Map + Doubly Linked List 的组合来保证插入和移除效率。

但为了能够让 TimerWrap 快速找到下一个需要执行的定时器，其新增了一个 heap 来存储所有的链表头。这个链表头是一个特殊节点，会存储该链表中第一个 timer 的到期时间，因此结构就变为：

![](/img/active-handle-and-timer-in-nodejs/09.png)

通过取出堆顶元素，就可以拿到需要执行的 timer。然后再对堆进行整理，并将最新的堆顶元素的到期时间设置给 TimerWrap，保证下次按时触发。虽然堆上插入、删除的复杂度是 O(log N)，但如果我们以之前的假设来看（即 timer 数量虽多，但都是集中的几个 timeout 值），那么这个堆的大小其实也是一个很小的常数，因此实际的时间开销并不大。

## 7. 不再需要 TimerWrap

介绍完了 Node.js 中的优化，大家可能也发现为什么不再需要 TimerWrap 了。

Wrap 的作用是提供给 js 层创建 uv handle 的能力。但经过优化，只存在一个 timer handle 了，那么完全就可以在 Node.js 启动时创建出来，不再需要 js 层根据情况动态创建 timer handle 了。所以也就不再需要了。

![](/img/active-handle-and-timer-in-nodejs/10.png)

而更准确的来说，应该是每个 Node.js Environment 会有一个对应的 timer handle。例如像我们创建了一个 worker，就会有一个新的“环境”。

![](/img/active-handle-and-timer-in-nodejs/11.png)


## 8、更“准确”的 timer 情况

从上面的内容可以知道，「timer」的含义在不同场景下含义可能不同：

- 当我们在 libuv 的语境中，timer 就是 timer handle；
- 当我们在 js 层的语境中，它会是 js 中创建的 timer 对象。

两个信息具有较大的不一致性。例如仅仅提供 timer handle 的信息，那么就无法知道 userland 中实际创建的 js timer 的情况。而反过来，如果一些 C++ Add-on 创建了 timer handle，那么从 js timer 中也是不到这个信息的。

## 总结

timer 作为 Node.js 中高频使用的功能，被针对性进行了很多优化。其中一大优化就是数据结构上的优化。

Node.js 中通过 Map + Doubly Linked List + Heap 来保持定时器的高校插入、删除和触发的同时，将实际使用的 timer handle 的数量优化为 1 个，这也大幅减少了 js 与 C++ 相互调用的次数。