---
title: DNS 查询导致的 Nodejs 服务疑似“内存泄漏”问题
date: 2021-05-02 18:00:00
tags:
- NodeJS
- DNS
- TroubleShooting
---

![](/img/troubleshooting-nodejs-dns-mem/00.jpeg)

某天下午，线上的服务监控发出报警：在同一个服务下，部署的众多容器中，某一个容器出现 OOM 问题。

<!-- more -->

## 1、OOM 报警：内存泄漏？

![](/img/troubleshooting-nodejs-dns-mem/01.png)

上图是容器维度的资源使用率监控图。可以看到红色的内存使用率曲线，逐步升高将近到 100% 后又迅速降至 0%。这是因为触发 OOM 后容器自动重启。而在重启后，容器的的内存使用率仍在缓慢上升。

该容器分配的资源为 1 核 1G，其容器内只运行一个 Nodejs 进程。运行的 Nodejs 进程在某段时间的监控曲线如下：

![](/img/troubleshooting-nodejs-dns-mem/02.png)


可以看到，堆内存使用率也是逐步攀升，CPU 使用率则较为稳定。其与容器维度的监控表现一致。从容器与 Nodejs 进程的曲线上来看，非常像是 Nodejs 服务内存泄漏的问题。

## 2、使用堆内存快照，排查堆内存问题

既然是内存问题，我很快想到要通过堆内存快照（Heap Snapshot）来排查。该服务使用了快手内部自研的 KNode 运行时来部署服务，因此可以在线上按需实时地打出堆快照，并在线查看：

![](/img/troubleshooting-nodejs-dns-mem/03.png)

> Heapsnaphost 中各项的含义以及如何查看，如果不了解可以看 [Chrome Devtools 的说明文档](https://developer.chrome.com/docs/devtools/memory-problems/memory-101/)。

不过可能是由于堆快照是一个切面数据，同时，打印这张快照时堆内存使用率也不是太高（大概为 20%），所以在初步看了堆快照后，问题线索不太直接。遇到这个问题，还有一个好办法，就是做两个时间点的快照 Diff。

![](/img/troubleshooting-nodejs-dns-mem/04.jpeg)

v8 会给每个堆内存对象分配一个 ID。因此可以在 Heap 使用率较低和较高两个时间点，分别打印对应的堆快照，通过这个关联 ID，就可以对比出这段时间内新增和回收释放的堆内存对象。而 Chrome Devtools 本身也支持堆快照的 comparison 展示。

![](/img/troubleshooting-nodejs-dns-mem/05.jpeg)

上图展示了在堆内存从 20% 涨到 50% 后新申请而没有被 GC 的对象（Object Allocated）。结合之前的堆快照（切面数据）和上面的 comparison 数据（Diff 数据），可以发现，红框中的这两类对象非常突出。也就是 `GetAddrInfoReqWrap` 与 `Socket`。

`Socket` 和网络连接相关，属于比较广的范围。因为我将目光放在了 `GetAdrrInfoReqWrap` 上。基于之前对 Nodejs 的了解，我知道这是和 DNS 查询相关的 JS 层 wrapper 对象。当然，如果大家不知道这个对象，也可以通过[查阅 Nodejs 源码](https://github.com/nodejs/node/blob/v14.16.1/lib/dns.js#L141)来了解到它的功能。展开堆快照中的对象，看下具体信息：

![](/img/troubleshooting-nodejs-dns-mem/06.jpeg)

从快照中对象的具体信息看，其 hostname 比较分散，所以感觉是和容器内整个 DNS 查询有关。

## 3、从其他 Nodejs 监控项，来看这个问题

如果是 DNS 查询的问题，肯定也会间接影响到 HTTP 相关的监控项。而情况也确实如此。从 Nodejs 进程发起的 HTTP 请求的监控来看，有问题的容器，每分钟能完成的请求数只有 3 次（如下图）：

![](/img/troubleshooting-nodejs-dns-mem/07.jpeg)

而同一个服务下的正常容器内，每个 Nodejs 进程每分钟可以正常发送超过 150 个 HTTP 请求（如下图）：

![](/img/troubleshooting-nodejs-dns-mem/08.jpeg)

同时，异常容器中的 Nodejs 发送完成一个 HTTP 请求的平均耗时超过了 800 秒（>13分钟）。而正常情况下内网服务之间的 HTTP 请求耗时一般都在几十毫秒，慢的也不太会超过几百毫秒。

此外，如果查看 Nodejs 的 Active Handle 的数量，也是处于一个持续上涨的状态。

![](/img/troubleshooting-nodejs-dns-mem/09.jpeg)

这里的 Active Handle 是指 [libuv 中的 Handle](http://docs.libuv.org/en/v1.x/design.html#handles-and-requests)，与其类似的还有一个叫 Request 的概念。它是 libuv 中的抽象概念，用来指代 libuv 中某项操作的对象，例如定时器、设备 IO 等。Nodejs 进程中的 Active Handle 数量持续上涨往往是有问题的，它说明 Nodejs 要处理的东西“积压”地越来越多。

因此，基本怀疑就是 DNS 查询的问题导致请求积压，从而导致了该故障。

## 4、故障确定与修复

通过上面的分析，基本可以确定和 DNS 查询脱不了干系。因为在服务部署的众多容器中，只有这一个有 OOM 问题，所以我分别登进一个健康容器和这个问题容器，执行以下 JS 代码来确认 DNS 查询情况（本文隐去了实际域名）：

```js
console.time('dns');
require('dns').lookup('xxx.xxxx.xxx', () => {
    console.timeEnd('dns');
});
```

这里需要提一下。Nodejs 封装了两类 DNS 查询的方法，一类就是上面用到的 `dns.lookup()`；另一个就是 `dns.resolve()` 和 `dns.resolve*()`。这里之所以在测试代码中使用 `dns.lookup()` 方法，是因为使用 Nodejs 中内置 http 模块的 `http.request()` 请求时，默认使用的就是该方法，而不是 `dns.resolve()`。

项目使用了 axios，而其在 [Nodejs 环境](https://github.com/axios/axios/blob/v0.21.1/lib/defaults.js#L18-L24)下[使用的是 `http.request()`](https://github.com/axios/axios/blob/v0.21.1/lib/adapters/http.js#L7) 方法来发起 HTTP 请求。`http.request()` 会调用 net 模块中的 [`createConnection` 方法](https://github.com/nodejs/node/blob/v14.16.1/lib/_http_client.js#L321)来建立连接。net 模块创建连接时，[默认的 lookup 方法](https://github.com/nodejs/node/blob/v14.16.1/lib/net.js#L1039)就是 `dns.lookup()`：

```js
function lookupAndConnect(self, options) {
  // ...
  const lookup = options.lookup || dns.lookup;
  defaultTriggerAsyncIdScope(self[async_id_symbol], function() {
    lookup(host, dnsopts, function emitLookup(err, ip, addressType) {
      self.emit('lookup', err, ip, addressType, host);
      // ...
    });
  });
}
```

当然，lookup 方法是[可以设置](https://nodejs.org/dist/latest-v14.x/docs/api/http.html#http_http_request_url_options_callback)的，例如可以传入 `dns.resolve()` 或者自定义的方法。下图就是 Nodejs 官方文档中的说明截图：

![](/img/troubleshooting-nodejs-dns-mem/10.png)

回到该故障。测试代码运行后，正常容器（下图左）的 DNS 查询耗时为 33 毫秒；故障容器的耗时为 5000 毫秒，差异极大。

![](/img/troubleshooting-nodejs-dns-mem/11.jpeg)

那么是什么导致的耗时差异呢？

`dns.lookup()` 方法会使用系统的 [`/etc/resolv.conf` 配置文件](https://nodejs.org/dist/latest-v14.x/docs/api/dns.html#dns_dns_lookup_hostname_options_callback)。该文件中会设置 nameserver 的地址、超时时间、重试次数、rotate 策略等。通过对比正常容器和故障容器，发现了配置差异：

![](/img/troubleshooting-nodejs-dns-mem/12.jpeg)

故障容器中（上图右）有个 nameserver 配置为了 `10.62.38.17`（正常容器是 `10.6.6.6`）。而 `10.62.38.17` 这个 nameserver 之前出现了问题，已经被替换掉了。但是在基础平台批量刷配置的操作中，故障容器所属的宿主机可能遗漏或者失败了。定位到具体原因后，联系了司内的容器化部署/运营平台的同学，修复该配置后后故障就解决了。

## 5、总结

这个问题曲折的点在于：其监控表象初看像是内存泄漏，而一般来说内存泄漏都是代码 bug 导致的。但这个故障其实并非如此，实际是宿主机 DNS nameserver 的配置问题。

原因大致就是，由于 Nodejs 中 DNS 查询耗时过长导致了请求堆积，上游服务与 Nodejs 建立的连接也不会释放。所以在整个请求的生命周期中「持有」的对象未被释放，堆内存中对象不断增多，从而看起来像是「内存泄漏」。

---

## 加餐：聊聊 Nodejs 中 DNS 查询与请求堆积

上面还是只一个粗略的分析和定位。在这一节会尝试能更深入一些，将故障现象和 Nodejs 实现细节联系起来。

关于 Nodejs 中 DNS 查询故障导致的服务不响应的问题，之前已经有文章阐述了类似的问题：

> - [node中请求超时的一些坑](https://acemood.github.io/2020/05/02/node%E4%B8%AD%E8%AF%B7%E6%B1%82%E8%B6%85%E6%97%B6%E7%9A%84%E4%B8%80%E4%BA%9B%E5%9D%91/)
> - [NodeJS 中 DNS 查询的坑 & DNS cache 分析](https://www.alienzhou.com/2020/05/06/analysis-on-the-lookup-dns-cache-and-nodejs/)

下面再尝试简单解释一下。

使用 http 模块的 `http.request()` 方法默认会使用 `dns.lookup()` 作为 DNS 查询的方法（这个在上中文也已经提到了）。而 `dns.lookup()` 通过 binding 会调用到 [`GetAddrInfo()` 函数](https://github.com/nodejs/node/blob/v14.16.1/src/cares_wrap.cc#L1987-L1991)：

```c++
void GetAddrInfo(const FunctionCallbackInfo<Value>& args) {
  // ...
  int err = req_wrap->Dispatch(uv_getaddrinfo,
                               AfterGetAddrInfo,
                               *hostname,
                               nullptr,
                               &hints);
  if (err == 0)
    // Release ownership of the pointer allowing the ownership to be transferred
    USE(req_wrap.release());

  args.GetReturnValue().Set(err);
}
```

其中最重要的调用的就是 `uv_getaddrinfo()`，它会将 [`uv__getaddrinfo_work` 提交到线程池的工作任务中](https://github.com/nodejs/node/blob/v14.16.1/deps/uv/src/unix/getaddrinfo.c#L209-L213)：

```c++
uv__work_submit(loop,
                &req->work_req,
                UV__WORK_SLOW_IO,
                uv__getaddrinfo_work,
                uv__getaddrinfo_done);
```

而 `uv__getaddrinfo_work()` 中就会使用 [`getaddrinfo` 函数](https://github.com/nodejs/node/blob/v14.16.1/deps/uv/src/unix/getaddrinfo.c#L101-L108)来做 DNS 查询：

```c++
static void uv__getaddrinfo_work(struct uv__work* w) {
  uv_getaddrinfo_t* req;
  int err;

  req = container_of(w, uv_getaddrinfo_t, work_req);
  err = getaddrinfo(req->hostname, req->service, req->hints, &req->addrinfo);
  req->retcode = uv__getaddrinfo_translate_error(err);
}
```

那么为什么会涉及到线程池概念呢？因为调用 `getaddrinfo()` 函数是一个同步调用，所以 [libuv 会通过线程池](https://docs.libuv.org/en/latest/threadpool.html)来实现 Nodejs 所需的异步 IO。线程池默认大小为 4，可以通过 [`UV_THREADPOOL_SIZE` 这个环境变量](https://github.com/nodejs/node/blob/v14.16.1/deps/uv/src/threadpool.c#L194)来配置，在 Nodejs v14 中最大是 1024。

回到故障场景：

从正常进程的监控数据看到，每分钟 Nodejs 进程发起的请求大致为 150 个，也就是 1 秒 2.5 个。而在故障容器中，请求在 DNS 查询阶段就要耗时 5s。即使不考虑其他耗时也要 5s 才能发完一个请求。4 个线程平均下来，也就是 1 秒最多能处理 0.8 个请求。显然，2.5 要远大于 0.8，处理能力和请求数量严重不匹配。所以服务运行时间越长，积压的请求数、连接数就越多。

到这里，还有几个问题可以再说明下：

### 关于超时

对于 HTTP 请求，我们一般会设置超时时间。但是 Nodejs 发起的请求可能不会触发到超时，由此使得上游服务到 Nodejs 的连接不会及时断开。这是在使用 axios 时可能出现的问题。

因为 axios 会基于 [`requset.setTimeout`](https://github.com/axios/axios/blob/v0.21.1/lib/adapters/http.js#L278) 来设置超时。之前的[文章](https://acemood.github.io/2020/05/02/node%E4%B8%AD%E8%AF%B7%E6%B1%82%E8%B6%85%E6%97%B6%E7%9A%84%E4%B8%80%E4%BA%9B%E5%9D%91/)也分析过，它是不包含 DNS 查询时间的。从 [Nodejs 官网文档](https://nodejs.org/dist/latest-v14.x/docs/api/http.html#http_request_settimeout_timeout_callback)中也能大致看出这个意思。

![](/img/troubleshooting-nodejs-dns-mem/13.jpeg)

### 关于 DNS cache

Nodejs 本身不做 DNS 查询结果的缓存（一些讨论也认为 cache 放在 userland 可能会合理些）。所以如果 `getaddrinfo()` 本身也没有 DNS cache（开启 nscd 似乎可以），Nodejs 就会在每次使用域名做 http 请求时，都会去请求 DNS nameserver。上文故障中的情况便是如此。

当然，你也可以通过使用类似像 [dnscache](https://www.npmjs.com/package/dnscache) 这类包来做 monkey patch，在 JS 层为 DNS 查询添加缓存；或者通过在 axios 中添加拦截器，实现缓存。不过使用缓存一定要注意处理缓存过期的问题，可以使用 DNS server 返回的 TTL。不过有时这个值也不太可靠，可能会需要基于业务场景设置一个尽量小的值。总之使用缓存一定要谨慎！

### 关于 `dns.resolve()`/`dns.resolve*()`

从文章之前的章节可以知道，`dns.resolve()`/`dns.resolve*()` 与 `dns.lookup()` 的实现并不相同。它们是基于 [c-ares](https://github.com/c-ares/c-ares) 实现的。

> This is c-ares, an asynchronous resolver library. It is intended for applications which need to perform DNS queries without blocking, or need to perform multiple DNS queries in parallel.

`http.request()` 是支持通过在 options 中传入 lookup 配置来覆盖默认的 `dns.lookup` 的。但是需要注意 `dns.resolve()` 和 `dns.lookup` 存在的[可能区别](https://nodejs.org/dist/latest-v14.x/docs/api/dns.html#dns_dns_resolve_dns_resolve_and_dns_reverse)。

此外，它们只是不用再使用线程池，如果遇到像文中的故障，DNS 查询的耗时一样会很高，同样会有类似问题。

完。
