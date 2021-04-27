---
title: 记一次 Node gRPC 静态生成文件引发的问题
date: 2021-04-12 12:00:00
tags:
- NodeJS
- gRPC
- TroubleShooting
- 服务端
---

![](/img/troubleshooting-grpc-static-codegen/0.jpeg)

本文记录了使用 Node gRPC（static codegen 方式）时，遇到的一个“奇怪”的坑。虽然问题本身并不常见，但顺着问题排查发现其中涉及到了一些有意思的点。去沿着问题追根究底、增长经验是一种不错的学习方式。所以我把这次排查的过程以及涉及到的点记录了下来。

<!-- more -->

> 为了让大家在阅读时有更好的体验，我准备了一个 [demo](https://github.com/alienzhou/grpc-static-pollute-demo) 来还原该问题，感兴趣的朋友可以 clone 下来，配合文章一起“食用”。

## 1、场景还原

如果在你了解过或在 NodeJS 中使用过 gRPC，那么一定会知道它有两种使用模式 ——「动态代码生成」（dynamic codegen）和「静态代码生成」（static codegen）。

> 这里简单解释下（对 gRPC 有了解的小伙伴可以直接跳过这段）。RPC 框架一般都会选择一种 IDL，而 gRPC 默认使用的就是 [protocol bufffers](https://developers.google.com/protocol-buffers)，我们一般会叫该文件 PB 或 proto 文件。根据 PB 文件可以自动生成序列化/反序列化代码（_xxx_pb.js_），用于 gRPC 时还会生成适配 gRPC 的代码（_xxx_grpc_pb.js_`）。如果在 Nodejs 进程启动后，再 load PB 文件生成对应方法，叫做「动态代码生成」；而先用工具生成出对应的 js 文件，运行时直接 require 生成的 js 则叫作「静态代码生成」。可以参见 gRPC 官方库中提供的[示例](https://github.com/grpc/grpc/tree/master/examples/node)。

我们的项目使用了公司内部的解密组件包（也是我们维护的），叫 keycenter。解密组件中需要用到 gRPC 请求，并且它使用了「静态代码生成」这种模式。

之前项目一直都正常运行。直到有一天引入了 redis 组件来实现缓存功能。在满心欢喜地加完代码运行后，控制台报出了如下错误信息：

```bash
Error: 13 INTERNAL: Request message serialization failure: Expected argument of type keycenter.SecretData
    at Object.callErrorFromStatus (/Users/xxxx/server/node_modules/@infra-node/grpc-js/build/src/call.js:31:26)
    at Object.onReceiveStatus (/Users/xxxx/server/node_modules/@infra-node/grpc-js/build/src/client.js:176:52)
    at Object.onReceiveStatus (/Users/xxxx/server/node_modules/@infra-node/grpc-js/build/src/client-interceptors.js:342:141)
    at Object.onReceiveStatus (/Users/xxxx/server/node_modules/@infra-node/grpc-js/build/src/client-interceptors.js:305:181)
    at /Users/zhouhongxuan/programming/xxxx/server/node_modules/@infra-node/grpc-js/build/src/call-stream.js:124:78
    at processTicksAndRejections (internal/process/task_queues.js:75:11)
```

而这个 redis 组件确实间接依赖了 gRPC。这里放一个组件模块依赖关系，说明一下项目使用的各组件包之间的关系。

![](/img/troubleshooting-grpc-static-codegen/1.png)

其中每个黄色组件就是一单独的 npm 包。业务代码直接使用了 keycenter 包进行了秘钥的解密；同时引入了 redis 缓存组件，而缓存模块间接依赖了 keycenter。最终 keycenter 组件通过「静态代码生成」的方式使用 gRPC。

下面我们就来一起看看这个问题。

## 2、问题排查

>❗️ 以下的章节顺序并非是排查时的实际顺序。大家实际排查问题时，还是建议先看“最近的现场”。 👀  例如这个问题，就会首先去 `Request message serialization failure` 抛错的地方查看情况。同时再辅以上层（外层）逻辑的排查，两头夹逼找到真相。但为了让文章阅读起来更顺畅，能够有从问题表象一步步走近真相，所以选择了目前的文章结构。我会尝试去尽量保留实际的排查路径。

### 2.1、莫非是 redis 组件内部逻辑出错了？

最直接的想法就是：新引入的这个 redis 组件有问题。因为出现问题的第一时间，我就把项目里下面这行代码注释掉了：

```diff
- this.redis = new Redis(redisConfig);
+ // this.redis = new Redis(redisConfig);
```

注释完果然就好了。所以引入新组件确实导致了问题。

由于报错和 gRPC 有关，而 redis 内部也间接依赖到了 gRPC（因为间接依赖了 keycenter），那么我的第一反应就是，这个组件内部逻辑可能有问题。也许是哪步操作使用到了 keycenter 方法，然后报出了错误。

但这个想法出现的有多快，排除的就有多快。

通过添加断点、日志的方式，很快就得出了一个结论：redis 组件虽然依赖到了 keycenter，但是整个实例化过程中完全不会调用它的方法，既然没有调用，这个 gRPC 的错误自然不是它直接导致的。

但它和 redis 组件或多或少脱不了关系。

### 2.2、是否真的是 redis 实例化导致了报错？

上面我通过注释掉 Redis 实例化的代码行后运行正常，初步判断是实例化导致的问题。然而我忽略了重要的一点，typescript 编译时，对于 import 但是没有使用的模块，在产出的代码里是会把模块引入的这段删除的。

例如下面这段代码，导入的模块实际没有使用，[在编译产出的代码中就不会导入该模块](https://www.typescriptlang.org/play?module=1#code/JYWwDg9gTgLgBAJQKYBNgGc4DMoRHAcgAFgA7HAQwFpSIUkB6KVDAgbgCgkAPSWOelgoBXADbwAjGyA)：

```typescript
import Redis from '@infra-node/redis';
export default 1;
```

而如果是[这样](https://www.typescriptlang.org/play?module=1#code/JYWwDg9gTgLgBAJQKYBNgGc4DMoRHAcgAFgA7HAQwFpSIUkB6KVDAgbgChk102g)

```typescript
import Redis from '@infra-node/redis';
Redis;
```

或者[这样](https://www.typescriptlang.org/play?module=1#code/JYWwDg9gTgLgBAcgALAHYDMoEMC0qIAmApgPRREHADOCA3EA)

```typescript
import '@infra-node/redis';
```

则模块引入的代码 `require(@infra-node/redis)` 在产出中会被保留。因此，实例化操作很可能并不是导致问题的原因。

通过进一步测试，发现直接原因是引入了 `@infra-node/redis` 模块。导入模块就会导致问题，只要不导入就没事儿，我第一时间的直觉有两个：

- 副作用
- 依赖关系

---

到这里，我们先回到最初的问题。

### 2.3、`new A instanceof A === false`?

还记得最初的问题么？问题的抛错 `Error: 13 INTERNAL: Request message serialization failure: Expected argument of type XXX` 来自于 [grpc-tools 生成](https://github.com/grpc/grpc-node/blob/grpc%401.24.x/packages/grpc-tools/src/node_generator.cc#L132-L135)的 Nodejs 版 _xxx_grpc_pb.js_ 代码：

```JavaScript
function serialize_keycenter_SecretData(arg) {
  if (!(arg instanceof keycenter_pb.SecretData)) {
    throw new Error('Expected argument of type keycenter.SecretData');
  }
  return Buffer.from(arg.serializeBinary());
}
```

`serialize_keycenter_SecretData` 是用于在请求时将 `SecretData` 实例序列化为二进制数据的方法。可以看到，方法里会判断 `arg` 是否是 `keycenter_pb.SecretData` 的实例。

在我们项目的场景下，我们事先会得到了 pb 对象二进制的 base64 编码值，所以在代码中会使用 _xxx_pb.js_ 文件提供的反序列化生成 `SecretData` 的实例，并设置其他属性。

```typescript
import { SecretData } from '../gen/keycenter_pb';
// ...

// 反序列化二进制
const secretData = SecretData.deserializeBinary(Buffer.from(base64, 'base64'));
secretData.setKeyName(keyName);

keyCenter.decrypt(secretData, metadata, (err, res) => {
    // ...
});
```

并且这里我打印 `arg` 后，在控制台看起来它的值也很正常。

![](/img/troubleshooting-grpc-static-codegen/2.png)

`SecretData.deserializeBinary` 的方法实现如下：

```typescript
proto.keycenter.SecretData.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.keycenter.SecretData;
  return proto.keycenter.SecretData.deserializeBinaryFromReader(msg, reader);
};

proto.keycenter.SecretData.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setKeyName(value);
      break;
    case 2:
      ...
    }
  }
  return msg;
};
```

从 `var msg = new proto.keycenter.SecretData;` 看起其就是通过 `SecretData` 构造函数创建了一个实例，并传入 `.deserializeBinaryFromReader` 方法中进行赋值，最后返回该实例。

所以目前从这个错误看起来，像是一个 `new A instanceof A === false` 的伪命题。但显然并不可能。所以我的判断是，这里面一定有一个“李鬼” —— 有一个看起来像是 `SecretData` 但实际不是的家伙冒充了它。

听起来似乎很奇怪。只能揣着性子继续排查。

### 2.4、“奇怪”的依赖安装？

首先回顾一下上面列出的包/模块依赖关系：

![](/img/troubleshooting-grpc-static-codegen/1.png)

我瞟了下目前实际的包安装情况。大致如下（省略了一些无关的包信息）：

```
.
├── grpc-js
│   ...
├── keycenter
└── redis
    ├── Changelog.md
    ├── LICENSE
    ├── README.md
    ├── built
    ├── node_modules
    │   ├── @infra-node
    │   │   │ ...
    │   │   └── keycenter
    │   ├── chokidar
    │   ├── debug
    │   ├── p-map
    │   └── readdirp
    └── package.json
```

上面列出了目前项目中的包安装情况。可以看到一个比较有意思的地方：外层存在一个 keycenter 包，同时在 redis 内部也安装了一个 keycenter 包。这是为什么呢？

原因很简单：项目直接依赖的 keycenter 版本声明与 redis 中的依赖版本无法合并指向同一版本，所以会在两个地方分别安装。这是 npm 的正常机制。一般这种情况也并不会出现问题。

但当我手动删除了 redis 中的 keycenter 后，项目又可以正常运行了。看来“李鬼”就是这儿了。

### 2.5、莫非引用了错误的模块文件？

结合上面的情况，对于 `new A instanceof A === false` 的问题，基本可以认定为是 `new A' instanceof A === false`（注意里面的 A 和 A'）。也就是在

```JavaScript
function serialize_keycenter_SecretData(arg) {
  if (!(arg instanceof keycenter_pb.SecretData)) {
    throw new Error('Expected argument of type keycenter.SecretData');
  }
  return Buffer.from(arg.serializeBinary());
}
```

这个方法执行时，传入的 `arg` 的构造函数与方法中的 `keycenter_pb.SecretData` 实际不同。这让我怀疑，是不是引用了错误的 __pb.js_ 文件。例如一个是用的外层 keycenter 中的 `keycenter_pb.js`，另一个则是使用到了 redis 中 keycenter 中的 `keycenter_pb.js`。两个文件一模一样，函数签名一模一样，但看起相同的两个对象，实则不同，自然过不了判断。

难道是构造 `arg` 参数时引入的 `keycenter_pb.js` 和 `serialize_keycenter_SecretData` 方法引入的 `keycenter_pb.js` 不同么？

基于我对 Nodejs `require` 机制的了解，基本排除了这个可能。它们是通过相对路径引入，根据模块寻路的规则，都会命中各自包内的代码模块。不存在引到其他包内的代码文件的情况。

### 2.6、模块是如何被“污染”的？

如果引用的模块没有问题，那么会不会是模块内的变量被“污染”了？

这就和我最开始的直觉 —— “副作用”，有些关联了。副作用的产生场景很多，但是有一个场景非常典型，就是全局变量的使用。在查看 `keycenter_pb.js` 文件的代码后，我发现果然如此：

```JavaScript
var jspb = require('google-protobuf');
var goog = jspb;
var global = Function('return this')();
// ...
goog.exportSymbol('proto.keycenter.SecretData', null, global);
// ...
goog.object.extend(exports, proto.keycenter);
```

代码通过 `Function('return this')()` 获取了全局对象。然后通过执行 `goog.exportSymbol` 方法，在全局对象上挂载 `global.proto.keycenter.SecretData` 属性值。最后再在 `exports` 上挂载 `proto.keycenter` 对象作为导出。

但如果仔细分析，仅仅上述代码，并不会导致这个错误。因为它会先修改 global 引用的指向，再修改 global 上对应的对象。例如引入模块后引用关系大致如下：

![](/img/troubleshooting-grpc-static-codegen/3.png)

当运行环境中再次引入一个同样内容 `_pb'.js` 文件后，就会变成如下引用关系。

![](/img/troubleshooting-grpc-static-codegen/4.png)

可以看到原先的 proto 对象并不会被修改，即外部之前导入的对象并不会变。那么究竟是如何被“污染”的呢？

其实问题来自于 2.3 节中用到的 `.deserializeBinary` 这个方法。这是 `_pb.js` 在构造函数上暴露出来的静态方法，可以根据二进制数据生成对应的实例对象：

```JavaScript
proto.keycenter.SecretData.deserializeBinary = function(bytes) {
    var reader = new jspb.BinaryReader(bytes);
    var msg = new proto.keycenter.SecretData;
    return proto.keycenter.SecretData.deserializeBinaryFromReader(msg, reader);
};
```

注意第二行 `var msg = new proto.keycenter.SecretData`，使用了 `proto.keycenter.SecretData` 这个构造函数，而我们根据前面的代码可以知道，这里的 proto 其实是 `[global].proto`。所以一旦我们的全局对象上的指向被修改后，这里使用的 `keycenter.SecretData` 其实就是另一个构造函数了。

真相大白。导致错误的过程如下：

1. 首先 `keycenter_grpc_pb.js` 引入了同目录下 `keycenter_pb.js` 文件，模块中的 `keycenter.SecretData` 构造函数这时候就确定了
1. 因为一些其他原因，某个包引用了另一个地方的、内容相同的 pb 文件，为了区分我们叫它 `keycenter_pb-2.js`。它和 `keycenter_pb.js` 内容一摸一样，不过是两个文件。这时候 global 上指向的对象就被修改了
1. 然后导入 `keycenter_pb.js` 模块，再使用 `SecretData.deserializeBinary` 生成实例，传入 `keycenter_grpc_pb.js` 中的方法就会出错了

✨ 为了大家更好理解，我复刻了这个问题的核心逻辑，[做成了 demo](https://github.com/alienzhou/grpc-static-pollute-demo)，大家可以 clone 到本地再配合文章内容来查看、运行。

---

☕️ 上面已经完成了问题的排查，下面的文章会进入到另一个主题 —— 问题修复。本身以为会较为顺畅的修复过程，也遇到一些意料之外的问题。

---

## 3、解决思路

如果理解了错误原因，就会发现这个错误出现的条件还是比较苛刻的。需要同时满足以下几个必要条件才会复现：

1. 进行了挂载全局变量的操作
1. 项目同时 import 两个内容相同的 `_pb.js` 文件
1. 使用了 `.deserializeBinary` 方法来创建实例对象
1. 模块的 import 顺序需要先导入 `_grpc_pb.js`，再导入 `_pb'.js`（同内容的另一个 pb 文件）

针对 2～4 这三个条件，我们只要破坏其一，就可以避免问题发生。我在 [demo 项目](https://github.com/alienzhou/grpc-static-pollute-demo)中分别写了对应的代码（correct-2.ts、correct-3.ts、correct-4.ts），感兴趣的话可以试下。

如果作为包提供方，要解决这个问题虽然看似方式很多，但是现实上我们能控制的有限 ——

- 先是第 2 条，会需要保证只安装一个 keycenter 包。不同包、模块对于包的版本依赖是外部控制的，不受包自身控制，因此很难确保根除；
- 然后是第 3 条，使用 `.deserializeBinary` 是功能要求，如果要规避这个方法的坑会使代码变得较为 tricky；
- 最后是第 4 条，引用顺序显然也是外部控制的，不受包自身所控

所以我们尽量还是希望能找一个“正规”的路子，使得通过 grpc-tools 或者 protoc 生成的 `_pb.js` 文件，不会产生全局污染（也就是破除条件 1）。

## 4、修复之路

### 4.1、让 protoc 生成的代码避免全局污染

按上面的思路，我们会希望在 protoc 生成时就产出一份“安全”的 `_pb.js` 静态文件。

protoc 支持在 js_out 参数中设置 `import_style` 来控制模块类型。[官方文档](https://developers.google.com/protocol-buffers/docs/reference/javascript-generated#commonjs-imports)里提供了 `commonjs` 这个参数。

```bash
protoc --proto_path=src --js_out=import_style=commonjs,binary:build/gen src/foo.proto src/bar/baz.proto
```

但是遗憾的是，这个参数并不会生成我们预想的代码，它生成的代码就是我们在上文中看到的“问题代码”。所以还有其他 `import_style` 么？

文档里没有，只能去源码里找答案了。

> 下面会涉及到 protoc，这里简单介绍了一下，便于不了解的朋友能快速理解。[protobuf](https://github.com/protocolbuffers/protobuf#protocol-compiler-installation) 这个仓库中包含了 Protocol Compiler。其中各个语言相关的代码生成器放在了 `src/google/protobuf/compiler/` 下面对应名称的文件夹里。例如 JavaScript 就是 [`/js` 文件夹内](https://github.com/protocolbuffers/protobuf/tree/v3.15.7/src/google/protobuf/compiler/js)。

在源码中可以发现，其[支持的 style 值](https://github.com/protocolbuffers/protobuf/blob/v3.15.7/src/google/protobuf/compiler/js/js_generator.cc#L3492-L3502)并非只有 commonjs 和 closure 两种：

```c++
// ...
else if (options[i].first == "import_style") {
  if (options[i].second == "closure") {
    import_style = kImportClosure;
  } else if (options[i].second == "commonjs") {
    import_style = kImportCommonJs;
  } else if (options[i].second == "commonjs_strict") {
    import_style = kImportCommonJsStrict;
  } else if (options[i].second == "browser") {
    import_style = kImportBrowser;
  } else if (options[i].second == "es6") {
    import_style = kImportEs6;
  } else {
    *error = "Unknown import style " + options[i].second + ", expected " +
              "one of: closure, commonjs, browser, es6.";
  }
}
// ...
```

但大致浏览完源码后，我发现 browser 和 es6 两种 style 实际也不能满足我们的需求。这时候就剩下 `commonjs_strict` 了。这个 strict 感觉就会非常贴合我们的目标。

主要的[相关代码](https://github.com/protocolbuffers/protobuf/blob/v3.15.7/src/google/protobuf/compiler/js/js_generator.cc#L3635-L3645)如下：

```c++
// Generate "require" statements.
if ((options.import_style == GeneratorOptions::kImportCommonJs ||
      options.import_style == GeneratorOptions::kImportCommonJsStrict)) {
  printer->Print("var jspb = require('google-protobuf');\n");
  printer->Print("var goog = jspb;\n");

  // Do not use global scope in strict mode
  if (options.import_style == GeneratorOptions::kImportCommonJsStrict) {
    printer->Print("var proto = {};\n\n");
  } else {
    printer->Print("var global = Function('return this')();\n\n");
  }
  // ...
}
```

这里就可以看出 `commonjs_strict` 和 `commonjs` 最大的区别就是是否使用了全局变量。如果是 `commonjs_strict` 则会使用 `var proto = {};` 来代替全局变量。完全满足需求！

但是，实际使用后，我发现了另一个问题。

### 4.2、grpc-tools 并不适配 `commonjs_strict`

`import_style=commonjs_strict` 另一个最大的区别在于[导出代码的生成](https://github.com/protocolbuffers/protobuf/blob/v3.15.7/src/google/protobuf/compiler/js/js_generator.cc#L3690-L3697)：

```c++
// if provided is empty, do not export anything
if (options.import_style == GeneratorOptions::kImportCommonJs &&
    !provided.empty()) {
  printer->Print("goog.object.extend(exports, $package$);\n", "package",
                  GetNamespace(options, file));
} else if (options.import_style == GeneratorOptions::kImportCommonJsStrict) {
  printer->Print("goog.object.extend(exports, proto);\n", "package",
                  GetNamespace(options, file));
}
```

这样看可能不太直观，直接贴两种 style 生成的代码就很明白了。

下面是用 `commonjs_strict` 生成的：

```
goog.object.extend(exports, proto);
```

下面是用 `commonjs` 生成的：

```
goog.object.extend(exports, proto.keycenter);
```

这样就能明显看出区别了。`commonjs` 形式导出时会导出 package 下的对象。因此，在我们使用对应的 `_pb.js` 文件时，会需要调整一下导入的代码。此外，grpc-tools 生成的 __grpc_pd.js_ 静态代码因为也会导入 `_pb.js` 文件，因此也需要适配这种导出。

> 这里简单介绍下 grpc-tools 的角色。它做了两件事，一个是 wrap 了一些 protoc 命令行，这样用户可以直接使用 grpc-tools 而不去关心 protoc；另一个是实现了一个 protoc 的 grpc 插件。关于 protoc 插件机制与如何实现一个 protoc 插件，后续有机会可以单写篇文章介绍。

而当我满心欢喜地去翻阅 [grpc-tools 源码](https://github.com/grpc/grpc-node/blob/grpc%401.24.6/packages/grpc-tools/src/node_generator.cc#L218-L221)时发现，

```c++
grpc::string file_path =
    GetRelativePath(file->name(), GetJSMessageFilename(file->name()));
out->Print("var $module_alias$ = require('$file_path$');\n", "module_alias",
            ModuleAlias(file->name()), "file_path", file_path);
```

它并不会考虑 `import_style=commonjs_strict` 这种情况，而是固定生成对应 `commonjs` 的导入代码。也有 [issue](https://github.com/grpc/grpc-node/issues/1445) 提到了这个问题。

### 4.3、只能自己动手了

好吧，这个导入/导出的问题目前没有特别好的解决办法。

我们这边之前因为一些特殊需求，所以 folk 了 grpc-tools 的代码，修改了内部实现以适配我们的 RPC 框架。因此这块就自己上手，支持了 `import_style=commonjs_strict` 这种情况，修改了导入时的代码：

```c++
grpc::string pb_package = file->package();
if (params.commonjs_strict && !pb_package.empty()) {
  out->Print("var $module_alias$ = require('$file_path$').$pb_package$;\n", "module_alias",
           ModuleAlias(file->name()), "file_path", file_path, "pb_package", pb_package);
} else {
  out->Print("var $module_alias$ = require('$file_path$');\n", "module_alias",
           ModuleAlias(file->name()), "file_path", file_path);
}
```

当然还需要配合做一些其他改动，例如 CLI 入参的判断处理等，这里就不贴了。

当然，令人头疼的问题不止这一个，如果你使用了其他 protoc 插件自动生成 .d.ts 文件的话，这块也会需要适配 `import_style=commonjs_strict` 的情况。

### 4.4、其他方式

当然，还有一种解决方法就是不用使用 static codegen，而是使用 [proto-loader](https://github.com/grpc/grpc-node/tree/master/packages/proto-loader) 来做 dynamic codegen。这样就规避了这个问题。


## 5、最后

本文主要记录了一次 gRPC 相关报错的排查过程。包括找出原因、提出解决思路到最后修复的整个过程。

排查问题是每个工程师经常会面对的事儿，也常常充满挑战。往往这些问题的落脚处可能并不大，修复工作也只是简单几行代码。而排障的过程，伴随着各类知识或技术点的使用，从表象到真相，整个过程也是工程师独有的乐趣。

而在文章写作上，相比介绍一个技术点，要写好一篇排障文章往往更不容易，所以也想挑战一下自己。

> 文章内容有一个配套的 [demo 代码](https://github.com/alienzhou/grpc-static-pollute-demo)，可以用来配合理解文章中的问题。