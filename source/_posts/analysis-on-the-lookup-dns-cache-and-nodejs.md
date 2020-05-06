---
title: NodeJS 中 DNS 查询的坑 & DNS cache 调研
date: 2020-05-06 14:00:00
tags:
- NodeJS
- 源码分析
- DNS
---

近期在做一个 DNS 服务器切换升级的演练中发现，我们在 NodeJS 中使用的 axios 以及默认的 `dns.lookup` 方法存在一些问题，会导致切换过程中的响应耗时从 ~80ms 上升至 ~3min，最终 nginx 层出现大量 502。

> 具体背景与分析参见[《node中请求超时的一些坑》](https://acemood.github.io/2020/05/02/node%E4%B8%AD%E8%AF%B7%E6%B1%82%E8%B6%85%E6%97%B6%E7%9A%84%E4%B8%80%E4%BA%9B%E5%9D%91/) ➡️

总结来说，NodeJS DNS 这块的“坑”可能有↓↓

- 使用 http 模块发起请求，默认会使用 `dns.lookup` 来进行 DNS 查询，其底层调用了系统函数 `getaddrinfo`。[`getaddrinfo` 会同步阻塞](https://medium.com/@amirilovic/how-to-fix-node-dns-issues-5d4ec2e12e95)，所以使用线程池来模拟异步，默认数量为 4。因此如果 DNS 查询时间过长且并发请求多，则会导致整体事件循环（Event Loop）出现延迟（阻塞）。
- 如果[使用 axios 来设置 timeout](https://github.com/axios/axios/issues/2710)，在 [0.19.0 之后](https://github.com/axios/axios/pull/1752/files)实际会调用 [`Request#setTimeout`](https://nodejs.org/dist/latest-v12.x/docs/api/http.html#http_request_settimeout_timeout_callback) 方法，该方法的超时时间不包括 DNS 查询。因此如果你将超时设为 3s，但是 DNS 查询由于 DNS 服务器未响应挂起了 5s（甚至更久），这种情况下你的请求是不会被超时释放的。随着请求的越来越多问题会被累积，造成雪崩。
- `getaddrinfo` 使用 [resolv.conf](http://man7.org/linux/man-pages/man5/resolv.conf.5.html) 中 nameserver 配置作为本地 DNS 服务器，可以配置多个作为主从。但其并没有完备的探活等自动切换机制。主下掉后，仍然会从第一个开始尝试，超时后切换下一个。即使使用 Round Robin，理论上仍会有 1/N 的请求第一个命中超时节点（N 为 nameserver 的数量）。

针对这种问题，在不去修改 NodeJS 底层（主要是 C/C++ 层）源码的情况下，在 JS 层引入 DNS 的缓存是一个轻量级的方案，会一定程度上规避这个问题（但也并不能完美解决）。因此，计划引入 [lookup-dns-cache](https://www.npmjs.com/package/lookup-dns-cache) 作为优化方案。但 DNS 查询的更换影响面广，引入前需要慎重确认以下问题：

<!-- more -->

## 需要解答的疑问

如果使用 [lookup-dns-cache](https://www.npmjs.com/package/lookup-dns-cache) 来替换默认的 `dns.lookup`，需要确认以下三个问题：

1. 使用该 package 后，DNS 查询与缓存的具体实现细节是怎样的？
1. 使用该 package 后是否与默认的 `dns.lookup` 方法一样，在 Linux 上也使用 resolv.conf 配置？
1. 使用该 package 后，DNS 查询的 timeout 值如何控制？

下面基于 [NodeJS v12.16.3](https://github.com/nodejs/node/tree/v12.16.3) 分别对这三个问题进行分析。

## TL;DR

1. lookup-dns-cache 在 JS 这一层做了防止重复请求和缓存两处优化
1. lookup-dns-cache 最底层也使用了 resolv.conf 这个配置
1. 使用 lookup-dns-cache 后无法控制 timeout 值

## 问题一：查询与缓存实现细节

[lookup-dns-cache](https://www.npmjs.com/package/lookup-dns-cache) 整体代码量很少，DNS 查询相关功能都委托给了 `dns.resolve*` 方法。[与 `dns.lookup` 不同](https://nodejs.org/docs/latest-v10.x/api/dns.html#dns_implementation_considerations)，`dns.resolve*` 并不使用 `getaddrinfo`，并且是异步实现。

lookup-dns-cache 主要是在 `dns.resolve*` 之上提供了两个优化点：

1. 避免额外的并行请求：对同一个 hostname 的并行查询，在查询请求未结束前，只会执行一次 `dns.resolve*`，其余放置在回调队列；
1. DNS 查询结果的缓存：提供基于 TTL 的缓存能力。

### 1. 避免额外的并行请求

该处主要是用过 `TasksManager` 来实现。[实现很简单](https://github.com/eduardbcom/lookup-dns-cache/blob/2.1.0/src/TasksManager.js)，发起 DNS 查询时，用 Map 存储当前正在进行查询的 hostname，查询结束后，从 Map 中删除。具体调用则在 Lookup.js 的 [`_innerResolve` 中](https://github.com/eduardbcom/lookup-dns-cache/blob/2.1.0/src/Lookup.js#L200-L218)：

```JavaScript
let task = this._tasksManager.find(key);

if (task) {
  task.addResolvedCallback(callback);
} else {
  task = new ResolveTask(hostname, ipVersion);
  this._tasksManager.add(key, task);
  task.on('addresses', addresses => {
    this._addressCache.set(key, addresses);
  });
  task.on('done', () => {
    this._tasksManager.done(key);
  });
  task.addResolvedCallback(callback);
  task.run();
}
```

其中的 key 是通过 ``${hostname}_${ipVersion}`` 拼接而成（ipVersion:ipv4/ipv4）。可以看到，如果在 `TasksManager` 实例中找到 task，则只添加回调，否则就发起一个查询，即创建一个 `ResolveTask` 实例。

### 2. DNS 缓存

lookup-dns-cache 通过为 resolve* 方法设置 `ttl: true` 来让 DNS 查询结果返回 TTL 值。对于查询回来的结果会在当前时间基础上[加上 TTL 来作为过期时间](https://github.com/eduardbcom/lookup-dns-cache/blob/2.1.0/src/ResolveTask.js#L82-L85)：

```JavaScript
addresses.forEach(address => {
  address.family = this._ipVersion;
  address.expiredTime = Date.now() + address.ttl * 1000;
});
```

当进行 DNS 查询前，会先查缓存，如果存在则直接返回。而在 AddressCache 中进行缓存查询时，[如果判断当前时间超过过期时间，则不再返回缓存结果](https://github.com/eduardbcom/lookup-dns-cache/blob/2.1.0/src/AddressCache.js#L21-L23)：

```JavaScript
find(key) {
  if (!this._cache.has(key)) {
    return;
  }

  const addresses = this._cache.get(key);
  if (this._isExpired(addresses)) {
    return;
  }

  return addresses;
}
```

这里可能会存在一个问题：如果查询的域名名称无限，由于缓存中仅判断是否过期，并无过期清理操作，因此过期缓存可能会一直占用内存而不释放。当然，由于普通业务项目中，域名查询的种类有限，并且基本会一直重复，因此并不会暴露该问题。

**阅读 lookup-dns-cache 的源码可以知道，其进行 DNS 查询使用的是 NodeJS 提供的另一类方法 —— `dns.resolve*`。因此引出了下一个问题，`dns.resolve*` 是否使用 resolv.conf 配置？**

---

## 问题二：dns.resolve* 是否使用 resolv.conf 配置

### 1. 方法的源码分析

#### 1.1. NodeJS 部分

在 `lib/dns.js` 最后可以发现，dns 模块导出的相关 resolve 方法是通过

```JavaScript
bindDefaultResolver(module.exports, getDefaultResolver());
```

这行绑定上去的。

而在 `lib/internal/dns/utils.js` 中会发现，`getDefaultResolver` 方法会返回一个 Resolver 实例。在这个模块里并没有各种 resolve 方法，而具体其上的 resolve 方法则还是在 [`lib/dns.js` 中实现的](https://github.com/nodejs/node/blob/v12.16.3/lib/dns.js#L207-L246)：

```JavaScript
...
function resolver(bindingName) {
  function query(name, /* options, */ callback) {
    let options;
    if (arguments.length > 2) {
      options = callback;
      callback = arguments[2];
    }

    validateString(name, 'name');
    if (typeof callback !== 'function') {
      throw new ERR_INVALID_CALLBACK(callback);
    }

    const req = new QueryReqWrap();
    req.bindingName = bindingName;
    req.callback = callback;
    req.hostname = name;
    req.oncomplete = onresolve;
    req.ttl = !!(options && options.ttl);
    const err = this._handle[bindingName](req, toASCII(name));
    if (err) throw dnsException(err, bindingName, name);
    return req;
  }
  ObjectDefineProperty(query, 'name', { value: bindingName });
  return query;
}

const resolveMap = ObjectCreate(null);
Resolver.prototype.resolveAny = resolveMap.ANY = resolver('queryAny');
Resolver.prototype.resolve4 = resolveMap.A = resolver('queryA');
Resolver.prototype.resolve6 = resolveMap.AAAA = resolver('queryAaaa');
Resolver.prototype.resolveCname = resolveMap.CNAME = resolver('queryCname');
...
```

而这里关于 DNS 查询调用的核心的方法就是 `this._handle[bindingName](req, toASCII(name))`。如果我们再回到 [`lib/internal/dns/utils.js` 这个定义 Resolver 类的地方就会发现](https://github.com/nodejs/node/blob/v12.16.3/lib/internal/dns/utils.js#L28)：

```JavaScript
...
class Resolver {
  constructor() {
    this._handle = new ChannelWrap();
  }
  ...
}
...
```

`this._handle` 是 `ChannelWrap` 的一个实例。`ChannelWrap` 来自于对 [c-ares](https://github.com/c-ares/c-ares) 的内部绑定 —— [cares_wrap.cc](https://github.com/nodejs/node/blob/v12.16.3/src/cares_wrap.cc)。

> c-ares: This is an asynchronous resolver library. It is intended for applications which need to perform DNS queries without blocking, or need to perform multiple DNS queries in parallel.

**按照[官方文档的说法](https://nodejs.org/en/docs/meta/topics/dependencies/#c-ares)，c-ares 支持 resolv.conf。但为了保险起见，具体在 NodeJS 的调用中是否使用到，需要继续向下进一步确认。**

拉到 cares_wrap.cc 的最后就可以看到针对 NodeJS 层的[一些绑定代码](https://github.com/nodejs/node/blob/v12.16.3/src/cares_wrap.cc#L2225-L2251)，这里截取和 `dns.resolve` 相关部分：

```C++
...
Local<FunctionTemplate> channel_wrap =
      env->NewFunctionTemplate(ChannelWrap::New);
  channel_wrap->InstanceTemplate()->SetInternalFieldCount(1);
  channel_wrap->Inherit(AsyncWrap::GetConstructorTemplate(env));
env->SetProtoMethod(channel_wrap, "queryAny", Query<QueryAnyWrap>);
env->SetProtoMethod(channel_wrap, "queryA", Query<QueryAWrap>);
env->SetProtoMethod(channel_wrap, "queryAaaa", Query<QueryAaaaWrap>);
env->SetProtoMethod(channel_wrap, "queryCname", Query<QueryCnameWrap>);
...
Local<String> channelWrapString =
      FIXED_ONE_BYTE_STRING(env->isolate(), "ChannelWrap");
  channel_wrap->SetClassName(channelWrapString);
  target->Set(env->context(), channelWrapString,
              channel_wrap->GetFunction(context).ToLocalChecked()).Check();
...
```

以上代码主要包括两个部分，在 C++ 层创建了 JS 的 `ChannelWrap` 类，同时设置相应的原型方法。因此，在 JS 层 `new ChannelWrap()` 基本上的调用链条为 `ChannelWrap::New` --> `ChannelWrap::ChannelWrap` --> `ChannelWrap::Setup`。其中 Setup 阶段调用了 c-ares 的[初始化配置方法](https://github.com/nodejs/node/blob/v12.16.3/src/cares_wrap.cc#L476)：

```C++
void ChannelWrap::Setup() {
  ...

  /* We do the call to ares_init_option for caller. */
  r = ares_init_options(&channel_,
                        &options,
                        ARES_OPT_FLAGS | ARES_OPT_SOCK_STATE_CB);

  ...
}
```

注意这里的第三个参数，就是该方法的 opmask，会决定使用哪些 options。

#### 1.2. c-ares 部分

在 c-ares 中具体配置（包括 dns server）的初始化有四个步骤，从前到后分别是：

- [通过传参初始化配置 - init_by_options](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_init.c#L196)
- [通过环境变量初始化配置 - init_by_environment](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_init.c#L203)
- [通过 resolv conf 初始化 - init_by_resolv_conf](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_init.c#L208)
- [默认方式 - init_by_defaults](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_init.c#L218)

在第一种通过 option 结构体传参中，ares 会通过 `options->nservers` 来获取 DNS 服务器配置。但同时，需要在[操作掩码中设置 `ARES_OPT_SERVERS`](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_init.c#L482-L502)。而在 NodeJS 中值设置了 `ARES_OPT_FLAGS | ARES_OPT_SOCK_STATE_CB`，因此不会设置 nservers。此外，init_by_options 中还会[设置 resolvconf_path 的值](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_init.c#L547-L552)，该值所指向的地址就是系统 resolv.conf 的地址：

```C++
/* Set path for resolv.conf file, if given. */
if ((optmask & ARES_OPT_RESOLVCONF) && !channel->resolvconf_path)
  {
    channel->resolvconf_path = ares_strdup(options->resolvconf_path);
    if (!channel->resolvconf_path && options->resolvconf_path)
      return ARES_ENOMEM;
  }
```

同样的，从上面节选的代码可以看出，NodeJS 调用中 optmask 并不包含 `ARES_OPT_RESOLVCONF`，因此 `channel->resolvconf_path` 为空，而此处也会影响后续的 `init_by_resolv_conf` 方法。

从 `ares_init_options` 代码的流程控制来看，正常情况下，设置完传参和环境变量后，最终会走到 `init_by_resolv_conf` 中。`init_by_resolv_conf` 方法主要是用来解析和获取 nameservers，其中包含比较多平台相关的条件编译，我们可以关注两个条件分支：

- `#elif defined(CARES_USE_LIBRESOLV)`
- 最后的条件分支

`CARES_USE_LIBRESOLV` 这个宏表示[是否使用 resolv 这个库](https://github.com/c-ares/c-ares/blob/baf6f4eb4240d6c8844f751570b3c151af263d93/CMakeLists.txt#L140-L142)。

```
IF ((IOS OR APPLE) AND HAVE_LIBRESOLV)
	SET (CARES_USE_LIBRESOLV 1)
ENDIF()
```

看起来似乎是在苹果系统下会启用。一旦使用这个库，条件分支里就会有两个重要的函数调用 —— [`res_ninit`](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_init.c#L1607) 和 [`res_getservers`](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_init.c#L1613)。

从手册中可以看出，`res_ninit` 会读取 [resolv.conf](http://man7.org/linux/man-pages/man3/resolver.3.html#:~:text=read%20the%20configuration%20files)，

> The res_ninit() and res_init() functions read the configuration files (see resolv.conf(5)) to get the default domain name and name server address(es).

因此在该分支中会使用 resolv.conf 文件。

再看另一条分支。[最后条件分支（看起来应该是 Linux）部分的处理](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_init.c#L1661)，其中会[优先读取 resolv.conf 的配置地址，不存在则取预定义的宏变量](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_init.c#L1678-L1682)：

```C++
/* Support path for resolvconf filename set by ares_init_options */
if(channel->resolvconf_path) {
  resolvconf_path = channel->resolvconf_path;
} else {
  resolvconf_path = PATH_RESOLV_CONF;
}
```

`PATH_RESOLV_CONF` 则定义在 [`ares_private.h`](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_private.h#L84) 中：

```C++
#define PATH_RESOLV_CONF        "/etc/resolv.conf"
```

`channel->nservers` 的设置也是通过读取文件中的 nameserver 配置项来添加的：

```C++
else if ((p = try_config(line, "nameserver", ';')) &&
      channel->nservers == -1)
  status = config_nameserver(&servers, &nservers, p);
```

> 这里有个值得注意的地方，如果你具体去看，会发现并没有读取 timeout 配置，这个可能说明，如果使用 `dns.resolve`，配置中的 timeout 变量并不会生效。


设置完成之后，当需要进行 DNS 查询时，最终会调用 ares_send.c 中的 `ares_send` 方法来发送查询请求。其中就会[使用 `channel->nservers` 中的值来作为本地 DNS 查询服务器](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_send.c#L103-L105)，其中 last_server [默认为 0](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_init.c#L174)：

```C++
/* Choose the server to send the query to. If rotation is enabled, keep track
 * of the next server we want to use. */
query->server = channel->last_server;
if (channel->rotate == 1)
  channel->last_server = (channel->last_server + 1) % channel->nservers;
```

> 这里还有个细节，[从代码上来看](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_send.c#L104-L105)，可以通过控制 `channel->rotate` 的值为 1 来开启本地 DNS 查询服务器的 RoundRobin 策略。而从实现上来看，它是通过 options 和 opmask 来控制的，似乎不会因为 resolv.conf 配置多个 nameserver 而自动 rr？

综合上面的分析可知，在 NodeJS（v12.16.3）中，调用 `dns.resolve*` 相关方法，底层会调用 [c-ares](https://github.com/c-ares/c-ares) 这个库。根据 c-ares 的实现来分析，其最终会读取 `resolv.conf` 的 nameserver 设置本地 DNS，并用其进行查询。

P.S. c-ares 也[依赖 glibc 的 resolv](https://github.com/c-ares/c-ares/blob/master/CMakeLists.txt#L217-L218)。

### 2. 实际验证

经过上面的分析之后，可以再简单进行一下实际验证。下面是一段调用 `dns.resolve`（其他 resolve 方法同理）的代码：

```JavaScript
const dns = require('dns');
dns.resolve('www.acfun.cn', function (...args) {
  console.log(...args);
});
```

#### 2.1. 实验一：

环境：CentOS Linux release 7.4.1708

运行输出：

```TEXT
$ node test.js
null [ '172.18.201.64' ]
```

用 strace 看下它的调用链：

```Bash
$ strace node test.js
```

内容比较多，下图只截取其中一部分，可以看到打开并读取了 resolv.conf。

![](/img/analysis-on-the-lookup-dns-cache-and-nodejs/15886736971147.jpg)

strace 输出（第8行的 open 调用）：

```
mprotect(0x43c0b904000, 503808, PROT_READ|PROT_EXEC) = 0
read(21, "const dns = require('dns');\ndns."..., 102) = 102
close(21)                               = 0
mprotect(0x43c0b884000, 503808, PROT_READ|PROT_WRITE) = 0
mprotect(0x43c0b904000, 503808, PROT_READ|PROT_WRITE) = 0
mprotect(0x43c0b884000, 503808, PROT_READ|PROT_EXEC) = 0
mprotect(0x43c0b904000, 503808, PROT_READ|PROT_EXEC) = 0
open("/etc/resolv.conf", O_RDONLY)      = 21
fstat(21, {st_mode=S_IFREG|0644, st_size=176, ...}) = 0
mmap(NULL, 4096, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x7f4d5c7e6000
read(21, "#nameserver 10.75.60.252\n#namese"..., 4096) = 176
read(21, "", 4096)                      = 0
close(21)                               = 0
munmap(0x7f4d5c7e6000, 4096)            = 0
open("/etc/nsswitch.conf", O_RDONLY)    = 21
fstat(21, {st_mode=S_IFREG|0644, st_size=1746, ...}) = 0
mmap(NULL, 4096, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x7f4d5c7e6000
read(21, "#\n# /etc/nsswitch.conf\n#\n# An ex"..., 4096) = 1746
read(21, "", 4096)                      = 0
close(21)                               = 0
munmap(0x7f4d5c7e6000, 4096)            = 0
uname({sysname="Linux", nodename="hb2-acfuntest-ls004.aliyun", ...}) = 0
open("/dev/urandom", O_RDONLY)          = 21
fstat(21, {st_mode=S_IFCHR|0666, st_rdev=makedev(1, 9), ...}) = 0
```

#### 2.2. 实验二：

环境：macOS 10.15.3 

运行输出：

```TEXT
$ node test.js
null [
  '61.149.11.118',
  '111.206.4.103',
  '61.149.11.116',
  '61.149.11.117',
  '61.149.11.115',
  '61.149.11.113',
  '61.149.11.112',
  '111.206.4.98',
  '111.206.4.97',
  '61.149.11.119',
  '111.206.4.96',
  '61.149.11.114'
]
```

可以看到，域名被正常解析了。下面修改 `/etc/resolv.conf` 内容，将 nameserver 改为一个无法访问的 IP（前面三个被注释的是原 DNS server）：

```
#
# macOS Notice
#
# This file is not consulted for DNS hostname resolution, address
# resolution, or the DNS query routing mechanism used by most
# processes on this system.
#
# To view the DNS configuration used by this system, use:
#   scutil --dns
#
# SEE ALSO
#   dns-sd(1), scutil(8)
#
# This file is automatically generated.
#
#nameserver 172.18.1.166
#nameserver 192.168.43.27
#nameserver 192.168.1.1
nameserver 192.168.2.2
```

此时再执行，会触发超时错误：

```
Error: queryA ETIMEOUT www.acfun.cn
    at QueryReqWrap.onresolve [as oncomplete] (dns.js:202:19) {
  errno: 'ETIMEOUT',
  code: 'ETIMEOUT',
  syscall: 'queryA',
  hostname: 'www.acfun.cn'
}
```

### 3. 结论

通过源码和测试，可以确定 dns.resolve 相关方法，在 Linux 仍然会读取 resolv.conf 配置来设置本地 DNS 服务器。

---

## 问题三：关于 DNS 查询的 timeout

在 c-ares 部分有提到两个编译分支，在最后一个 else 中，并不会对 timeout 的值进行处理，因此会落到最后的默认赋值上（5s）

```C++
if (channel->timeout == -1)
    channel->timeout = DEFAULT_TIMEOUT;
```

`DEFAULT_TIMEOUT` [定义在这](https://github.com/nodejs/node/blob/v12.16.3/deps/cares/src/ares_private.h#L40:9)，为 5s 

```C++
#define DEFAULT_TIMEOUT         5000 /* milliseconds */
```

而对于走到 CARES_USE_LIBRESOLV 分支的代码，则因为调用了 `res_ninit`，可以在 [`__res_state`](https://github.com/lattera/glibc/blob/895ef79e04a953cac1493863bcae29ad85657ee1/resolv/bits/types/res_state.h#L13) 结构体中取到 retrans 值，该值会被[用作 timeout 值](https://github.com/lattera/glibc/blob/895ef79e04a953cac1493863bcae29ad85657ee1/resolv/bits/types/res_state.h#L13)：

```C++
if (channel->timeout == -1)
      channel->timeout = res.retrans * 1000;
```

> c-ares 文档也有关于 timeout 的[简单说明](https://c-ares.haxx.se/ares_init_options.html#:~:text=ARES_OPT_TIMEOUTMS%20int%20timeout;)

按照之前分析来看，在生产环境（CentOS 7）中应该是属于第一种情况。由于 NodeJS 层没有暴露对应设置超时的入口，所以，如果替换为 lookup-dns-cache，则都会落到默认超时时间，无法控制 timeout 的时间。

## 综上

1. lookup-dns-cache 在 JS 这一层做了防止重复请求和缓存两处优化
1. lookup-dns-cache 最底层也使用了 resolv.conf 这个配置
1. 使用 lookup-dns-cache 后无法控制 DNS 查询的 timeout 值

## 参考资料

- NodeJS 官方文档
  - [DNS](https://nodejs.org/dist/latest-v12.x/docs/api/dns.html)
  - [Dependencies](https://nodejs.org/en/docs/meta/topics/dependencies/#c-ares)
- [c-ares](https://github.com/c-ares/c-ares)
- [man-pages: RESOLVER](http://man7.org/linux/man-pages/man3/resolver.3.html)
- [How to fix nodejs DNS issues?](https://medium.com/@amirilovic/how-to-fix-node-dns-issues-5d4ec2e12e95)
- [axios: difference in timeout behavior between versions 0.18.1 and 0.19.0-2](https://github.com/axios/axios/issues/2710)

---

P.S. resolv 中设置 timeout（retrans）值目测是在[这个地方](https://github.com/lattera/glibc/blob/895ef79e04a953cac1493863bcae29ad85657ee1/resolv/res_init.c#L644-L651)

```C++
...
else if (!strncmp (cp, "timeout:", sizeof ("timeout:") - 1))
{
  int i = atoi (cp + sizeof ("timeout:") - 1);
  if (i <= RES_MAXRETRANS)
    parser->template.retrans = i;
  else
    parser->template.retrans = RES_MAXRETRANS;
}
...
```

