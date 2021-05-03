---
title: npm script 执行”丢失“ root 权限的问题
date: 2021-04-30 12:00:00
tags:
- NPM
- TroubleShooting
---

![](/img/troubleshooting-npm-script-root-auth/0.png)

近期，在线上运行服务时遇到了一个诡异的 Linux 权限问题：root 用户在操作本该有权限的资源时，却报了权限错误。

<!-- more -->

## 1、问题背景

报错如下：

```text
Error: EACCES: permission denied, mkdir '/root/.pm2/logs'
    at Object.mkdirSync (fs.js:921:3)
    at mkdirpNativeSync (/home/web_server/project/node_modules/pm2/node_modules/mkdirp/lib/mkdirp-native.js:29:10)
    at Function.mkdirpSync [as sync] (/home/web_server/project/node_modules/pm2/node_modules/mkdirp/index.js:21:7)
    at module.exports.Client.initFileStructure (/home/web_server/project/node_modules/pm2/lib/Client.js:133:25)
    at new module.exports (/home/web_server/project/node_modules/pm2/lib/Client.js:38:8)
    at new API (/home/web_server/project/node_modules/pm2/lib/API.js:108:19)
    at Object.<anonymous> (/home/web_server/、project/node_modules/pm2/lib/binaries/CLI.js:22:11)
    at Module._compile (internal/modules/cjs/loader.js:1137:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)
    at Module.load (internal/modules/cjs/loader.js:985:32)
```

这个错误非常直观，就是用户想要创建 `/root/.pm2/logs` 文件夹，但是没有权限。该服务使用 pm2 做多进程管理。pm2 默认会将其日志信息、进程信息等写入到 `$HOME/.pm2` 下。因为是 root 后用户所以写到了 `/root/.pm2` 里。

但这个问题的奇怪之处在于，服务是通过 root 用户启动的，对 `/root` 目录是具有写入权限的。但这里却报了名优权限的错我。

那么是什么导致 root 用户操作 `/root` 目录的权限“丢失”了呢？

## 2、初步排查

项目是容器化部署，使用 npm script 启动，代码文件位于 `/home/web_server/project` 下。执行 `npm start` 即可启动。

这是我们使用的一套标准的构建与部署「模版」，已经在上百个服务上应用，且一直都正常。知道近期的一次上线出现了上面这个问题。

这次突然出现的这个问题让我充满了疑惑 —— 基于对 Linux 系统用户、用户组权限控制的理解，不可能出现这个错误。难道是我理解有误？

在疑惑的同时，我尝试不使用 npm script，直接通过 pm2 命令行 `pm2 start ecosystem.config.js` 启动，发现服务正常启动了！莫非是 npm 导致的？

而在这次上线的时候，确实更新了基础镜像，升级了 npm cli。之前是 v6.x，这次更新到了 v7.x。而当我将 npm 版本回退到 v6.x 后，问题小时。看来是 v7.x 的改动导致了这个问题。

## 3、问题定位

先说结论：npm v6.x 使用 npm script 执行命令时默认会使用 unsafe 模式，将子执行命令的子进程设置为 root 用户/用户组，该行为可以通过 `unafe-pem` 配置来控制。而在 v7.x 中，如果通过 root 用户执行 npm script，则会基于当前目录（cwd）所属用户来设置。

下面通过代码来一起看下。

### 3.1、v7.x 中 npm script 的实现

> 以下代码来自 [npm/cli v7.11.1](https://github.com/npm/cli/tree/v7.11.1)

npm script 的执行逻辑可以从 [`lib/exec.js`](https://github.com/npm/cli/blob/v7.11.1/lib/exec.js#L88) 中查看：

```js
class Exec extends BaseCommand {
  // ...
  async _exec (_args, { locationMsg, path, runPath }) {
    // ...
    if (call && _args.length)
      throw this.usage

    return libexec({
      ...flatOptions,
      args,
      // ...
    })
  }
}
```

省略无关代码，可以看到执行 npm script 时会调用 `libexec` 方法，[`libexec` 方法](https://github.com/npm/cli/blob/v7.11.1/node_modules/libnpmexec/lib/index.js#L50)内部会调用 [`runScript` 方法](https://github.com/npm/cli/blob/v7.11.1/node_modules/libnpmexec/lib/index.js#L50)来执行命令。

> 因为调用链比较长，我把中间代码省略了，只贴出关键的代码，感兴趣的朋友可以点击文中链接跳转查看。

通过[一系列](https://github.com/npm/cli/blob/v7.11.1/node_modules/%40npmcli/run-script/lib/run-script.js#L9)曲折的调用，代码最后会调用到 [`promiseSpawn` 方法](https://github.com/npm/cli/blob/v7.11.1/node_modules/%40npmcli/run-script/lib/run-script-pkg.js#L54)。这个方法最终会使用 child_process 内置模块里提的 `spawn` 方法来启动子进程执行命令，其[相关代码](https://github.com/npm/cli/blob/v7.11.1/node_modules/%40npmcli/promise-spawn/index.js#L13-L20)如下：

```js
const promiseSpawn = (cmd, args, opts, extra = {}) => {
  const cwd = opts.cwd || process.cwd()
  const isRoot = process.getuid && process.getuid() === 0
  const { uid, gid } = isRoot ? inferOwner.sync(cwd) : {}
  return promiseSpawnUid(cmd, args, {
    ...opts,
    cwd,
    uid,
    gid
  }, extra)
}
```

上面的实现中，有一行非常重要：

```js
const { uid, gid } = isRoot ? inferOwner.sync(cwd) : {}
```

可以看到，如果当前进程的用户是 root，则会使用 `inferOwner` 方法来设置启动的子进程的 uid 和 gid（也就是用户 id 和用户组 id）。

那么 `inferOwner` 是做什么的呢？它其实就是[用来获取某个文件所属的用户与用户组](https://github.com/npm/cli/blob/v7.11.1/node_modules/%40npmcli/promise-spawn/index.js#L13-L20)的：

```js
const inferOwnerSync = path => {
  path = resolve(path)
  if (cache.has(path))
    return cache.get(path)

  const parent = dirname(path)

  let threw = true
  try {
    const st = fs.lstatSync(path)
    threw = false
    const { uid, gid } = st
    cache.set(path, { uid, gid })
    return { uid, gid }
  } finally {
    if (threw && parent !== path) {
      const owner = inferOwnerSync(parent)
      cache.set(path, owner)
      return owner // eslint-disable-line no-unsafe-finally
    }
  }
}
```

其中最重要的代码是这几行：

```js
const st = fs.lstatSync(path)
// ...
const { uid, gid } = st
```

[`fs.lstatSync` 方法](https://nodejs.org/dist/latest-v14.x/docs/api/fs.html#fs_fs_lstatsync_path_options) 会使用 [`fstat`](https://man7.org/linux/man-pages/man2/lstat.2.html) 这个系统调用来获取文件的 uid 和 gid。

![](/img/troubleshooting-npm-script-root-auth/1.png)

`promiseSpawn` 中会将 cwd 传入来获取 uid 和 gid。而在我们线上服务的容器里，我们是在 `/home/web_server/project` 下执行 `npm start`，该目录所属用户是 `web_server`，用户组是 `web_server`。所以 npm 在启动子进程时“切换”了用户。

所以实际情况是，`pm2 start ecosystemt.config.js` 相当于是被 web_server 用户启动的，但是环境变量 `$HOME` 仍然是 `/root`。所以在 `/root` 中创建文件夹，自然就没有权限。

### 3.2、v6.x 中 npm script 实现方式的区别

> 以下代码来自 [npm/cli v6.14.8](https://github.com/npm/cli/tree/v6.14.8)

v7.x 为了权限安全，做了上述操作，那么 v6.x 如何呢？

v6.x 的 npm script 入口是 [`lib/run-script.js` 文件](https://github.com/npm/cli/blob/v6.14.8/lib/run-script.js#L173)：

```js
function run (pkg, wd, cmd, args, cb) {
  // ...
  chain(cmds.map(function (c) {
    // pass cli arguments after -- to script.
    if (pkg.scripts[c] && c === cmd) {
      pkg.scripts[c] = pkg.scripts[c] + joinArgs(args)
    }

    // when running scripts explicitly, assume that they're trusted.
    return [lifecycle, pkg, c, wd, { unsafePerm: true }]
  }), cb)
}
```

而其实际执行则需要从 `lifecycle` 方法中来找。上面这段代码的最后一行还有一个非常重要的参数 `{ unsafePerm: true }`，之后会用到。

[lifecycle](https://github.com/npm/cli/blob/v6.14.8/lib/utils/lifecycle.js#L13) 本身代码并不复杂，主要就是参数调整，然后调用实际函数。和 uid、gid 实际的设置代码是在 [`npm-lifecycle/index.js` 中的 `runCmd`](https://github.com/npm/cli/blob/v6.14.8/node_modules/npm-lifecycle/index.js#L264-L276) 里：

```js
function runCmd (note, cmd, pkg, env, stage, wd, opts, cb) {
  // ...
  var unsafe = opts.unsafePerm
  var user = unsafe ? null : opts.user
  var group = unsafe ? null : opts.group
  
  // ...
  if (unsafe) {
    runCmd_(cmd, pkg, env, wd, opts, stage, unsafe, 0, 0, cb)
  } else {
    uidNumber(user, group, function (er, uid, gid) {
      if (er) {
        er.code = 'EUIDLOOKUP'
        opts.log.resume()
        process.nextTick(dequeue)
        return cb(er)
      }
      runCmd_(cmd, pkg, env, wd, opts, stage, unsafe, uid, gid, cb)
    })
  }
}

// ...
function runCmd_ (cmd, pkg, env, wd, opts, stage, unsafe, uid, gid, cb_) {
  // ...
  var proc = spawn(sh, args, conf, opts.log)
  // ...
}
```

`runCmd` 里会通过传入的 `opt.unsafePem` 参数（就是上面设置的那个 `{ unsafePerm: true }`）来判断是否是 `unsafe` 的。如果是 `unsafe`，则会在调用 `runCmd_` 时将 uid、gid 设置为 0。0 就代表 root 用户和 root 用户组。

而最终在 `runCmd_` 中的 [`spawn`](https://github.com/npm/cli/blob/v6.14.8/node_modules/npm-lifecycle/lib/spawn.js#L36) 就是 `child_process` 中的 `spawn` 方法：

```js
const _spawn = require('child_process').spawn
// ...
function spawn (cmd, args, options, log) {
  // ...
  const raw = _spawn(cmd, args, options)
  // ...
}
```

---

到这里我们就定位到了该问题：

- 在 v6.x 中，只要没有设置 `unsafe-pem` 这个 npm config，npm script 就会在启动子进程时默认设置为 root。
- 而在 v7.x 中，如果运行时是 root 用户，则会根据 cwd 所属的用户/用户组，来设置启动子进程的 uid 和 gid。

目前从代码实现来看，似乎没有特别好的处理方式，比较简答的两种就是：

- 如果用 v7.x，在我们这个场景下，可以把 `/home/web_server/project` 所属用户/用户组改为 root。但权限的改动可能会引发其他问题。
- 先暂时回退到 v6.x，使环境和保持一致。

### 3.3、npm cli 的变更日志

其实，这个变更在 npm [v7.0.0-beta.0 发布时的 CHANGELOG](https://github.com/npm/cli/blob/v7.11.1/CHANGELOG.md#all-lifecycle-scripts) 里是有提到的。不过只有寥寥一行：

> The user, group, uid, gid, and unsafe-perms configurations are no longer relevant. When npm is run as root, scripts are always run with the effective uid and gid of the working directory owner.

大致说的就是咱们上面从代码分析的结论：如果是 root 运行 npm，则在脚本执行时切换到当前工作目录的 owner。

然后如果你跟着代码看下来，也会发现 v6.x 中的 `unsafe-pem` 配置，在 v7.0.0 开始就被废弃了。不过 npm cli 文档更新的较慢，直到 v7.0.0 正式版发布后的一个月后，才在 [v7.0.15 的 Release](https://github.com/npm/cli/blob/v7.11.1/CHANGELOG.md#documentation-16) 里把 `unsafe-pem` 从文档中移除。

### 3.4、其他可能出现的问题

这个功能实现的变更，除了会导致一些文件操作时的权限问题，还会有一些其他场景的权限错误。例如在如果你用 npm script 启动一个 nodejs server，要绑定 443 端口，这个时候可能就会报错。因为会需要 root 权限来执行这个端口绑定。在 [issue 里就有人提到了这个情况](https://github.com/npm/cli/issues/3110)。

---

## 4、加餐：child_process#spawn 是如何设置 user 和 group 的？

通过上面的分析，问题已经被解决了。沿着这个问题，可以具体看了下 Nodejs 中，child_process 模块的 `spawn` 方法是如何设置 user 和 group 的。

> 以下代码基于 [Nodejs v14.16.1](https://github.com/nodejs/node/tree/v14.16.1)。只关注 unix 实现。

Nodejs 中，我们在上层引入的模块，是直接放在 `lib` 下面的，而其一般会在调用 `lib/internal` 下的对应模块，这部分会直接使用 internalBinding 来调用 C++ 对象和方法。child_process 也不例外，你会在 [`lib/internal/child_process.js`](https://github.com/nodejs/node/blob/v14.16.1/lib/internal/child_process.js#L378) 中看到如下代码：

```js
ChildProcess.prototype.spawn = function(options) {
  // ...
  const err = this._handle.spawn(options);
  // ...
```

因为比较简答，所以这里省去了 `lib/child_process.js` 中的方法。只要知道，我们在 JavaScript 层使用 `spawn` 方法时，最后会调用到 ChildProcess 实例的 `spawn` 方法即可。可以看到最后是调用了 `this._handle.spawn`。那么 `this._handle` 是什么呢？

它其实就是[通过 binding 创建的 Process 对象](https://github.com/nodejs/node/blob/v14.16.1/lib/internal/child_process.js#L250)：

```js
const { Process } = internalBinding('process_wrap');

// ...
function ChildProcess() {
  EventEmitter.call(this);

  // ...
  this._handle = new Process();
  // ...
}
```

这个 binding 的设置在 [`src/process_wrap.cc`](https://github.com/nodejs/node/blob/v14.16.1/src/process_wrap.cc#L157-L174) 中，

```c++
  static void Spawn(const FunctionCallbackInfo<Value>& args) {
    // ...

    // options.uid
    Local<Value> uid_v =
        js_options->Get(context, env->uid_string()).ToLocalChecked();
    if (!uid_v->IsUndefined() && !uid_v->IsNull()) {
      CHECK(uid_v->IsInt32());
      const int32_t uid = uid_v.As<Int32>()->Value();
      options.flags |= UV_PROCESS_SETUID;
      options.uid = static_cast<uv_uid_t>(uid);
    }

    // options.gid
    Local<Value> gid_v =
        js_options->Get(context, env->gid_string()).ToLocalChecked();
    if (!gid_v->IsUndefined() && !gid_v->IsNull()) {
      CHECK(gid_v->IsInt32());
      const int32_t gid = gid_v.As<Int32>()->Value();
      options.flags |= UV_PROCESS_SETGID;
      options.gid = static_cast<uv_gid_t>(gid);
    }
    
    int err = uv_spawn(env->event_loop(), &wrap->process_, &options);
    wrap->MarkAsInitialized();
    
    // ...
}
```

可以看到，它把从 JavaScript 层设置的 uid 和 gid 设置到 options 上，然后调用了 [`uv_spawn`](https://docs.libuv.org/en/latest/process.html?highlight=uv_spawn#c.uv_spawn) 函数创建子进程。在 `uv_spawn` 中对于创建的子进程会通过 [`uv__process_child_init` 来做初始化设置](https://github.com/nodejs/node/blob/v14.16.1/deps/uv/src/unix/process.c#L408)：

```c++
int uv_spawn(uv_loop_t* loop,
             uv_process_t* process,
             const uv_process_options_t* options) {

    // ...
    if (pid == 0) {
        uv__process_child_init(options, stdio_count, pipes, signal_pipe[1]);
        abort();
    }
    // ...
}
```

最后则是在 [`uv__process_child_init`](https://github.com/nodejs/node/blob/v14.16.1/deps/uv/src/unix/process.c#L346-L365) 里通过 [`setuid`](https://man7.org/linux/man-pages/man2/setuid.2.html) 和 [`setgid`](https://man7.org/linux/man-pages/man2/setgid.2.html) 这两个系统调用来实现的：

```c++
static void uv__process_child_init(const uv_process_options_t* options,
                                   int stdio_count,
                                   int (*pipes)[2],
                                   int error_fd) {
    // ...
    if ((options->flags & UV_PROCESS_SETGID) && setgid(options->gid)) {
        uv__write_int(error_fd, UV__ERR(errno));
        _exit(127);
    }

    if ((options->flags & UV_PROCESS_SETUID) && setuid(options->uid)) {
        uv__write_int(error_fd, UV__ERR(errno));
        _exit(127);
    }
    // ...
}
```

在 Nodejs 官方文档中也有介绍。

![](/img/troubleshooting-npm-script-root-auth/2.png)

我们通过阅读代码也印证了这一点。

完。
