---
title: vue-cli 迁移 vite2 实践小结
date: 2021-03-01 12:00:00
tags:
- 前端工程化
- 自动化工具
- vite
- vue
---

两周前（202.02.17），[vite2.0 发布了](https://dev.to/yyx990803/announcing-vite-2-0-2f0a)，作为使用了浏览器原生 ESM 为下一代前端工具，vite 2.0 相较于 1.0 更加成熟。在此之前笔者就开始[关注这类「新型」的前端工具](https://www.alienzhou.com/2020/06/18/how-snowpack-works/)。这次趁着 vite 2.0 发布，也成功将一个基于 vue-cli(-service) + vue2 的已有项目进行了迁移。

![](/img/migration-from-vue-cli-to-vite2/1.png)

<!-- more -->

迁移工作比较顺利，花了不到半天时间。但整个迁移过程中也遇到了一些小问题，这里汇总一下，也方便遇到类似问题的朋友一起交流和参考。

## 项目背景

在介绍具体迁移工作前，先简单介绍下项目情况。目前该项目上线不到一年，不太有构建相关的历史遗留债务。项目包含 1897 个模块文件（包括 node_modules 中模块），使用了 vue2 + vuex + typescript 的技术栈，构建工具使用的是 vue-cli（webpack）。算是一套比较标准的 vue 技术栈。由于是内部系统，项目对兼容性的要求较低，用户基本都使用较新的 Chrome 浏览器（少部分使用 Safari）。

## 迁移工作

下面具体来说下迁移中都做了哪些处理。

### 1、配置文件

首先需要安装 vite 并创建 vite 的配置文件。

```bash
npm i -D vite
```

vue-cli-service 中使用 `vue.config.js` 作为配置文件；而 vite 则默认会需要创建一个 `vite.config.ts` 来作为配置文件。基础的配置文件很简单：

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // ...
  ],
})
```

创建该配置文件，之前的 vue.config.js 就不再使用了。

### 2、入口与 HTML 文件

在 vite 中也需要指定入口文件。但和 webpack 不同，在 vite 中不是指定 js/ts 作为入口，而是指定实际的 HTML 文件作为入口。

在 webpack 中，用户通过将 entry 设置为入口 js（例如 `src/app.js`）来指定 js 打包的入口文件，辅以 HtmlWebpackPlugin 将生成的 js 文件路径注入到 HTML 中。而 vite 直接使用 HTML 文件，它会解析 HTML 中的 script 标签来找到入口的 js 文件。

因此，我们在入口 HTML 中加入对 js/ts 文件的 script 标签引用：

```diff
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title><%= htmlWebpackPlugin.options.title %></title>
</head>

<body>
  <noscript>
    We're sorry but <%= htmlWebpackPlugin.options.title %> doesn't work properly without JavaScript enabled.
  </noscript>
  <div id="app"></div>
+ <script type="module" src="/src/main.ts"></script>
</body>

</html>
```

注意上面 `<script type="module" src="/src/main.ts"></script>` 这一行，它使用浏览器原生的 ESM 来加载该脚本，`/src/main.ts` 就是入口 js 的源码位置。在 vite dev 模式启动时，它其实启动了一个类似静态服务器的 server，将 serve 源码目录，因此不需要像 webpack 那样的复杂模块打包过程。模块的依赖加载将完全依托于浏览器中对 `import` 语法的处理，因此可以看到很长一串的脚本加载瀑布流：

![](/img/migration-from-vue-cli-to-vite2/2.png)


这里还需要注意 [project root 的设置](https://vitejs.dev/config/#root)。在默认是 `process.cwd()`，而 index.html 也会在 project root 下进行寻找。为了方便我将 `./public/index.html` 移到了 `./index.html`。

### 3、使用 vue 插件

vite 2.0 提供了对 vue 项目的良好支持，但其本身并不和 vue 进行较强耦合，因此通过插件的形式来支持对 vue 技术栈的项目进行构建。vite 2.0 官网目前（2021.2.28）推荐的 vue 插件会和 [vue3 的 SFC](https://vitejs.dev/plugins/#vitejs-plugin-vue) 一起使用更好。因此这里使用了一个专门用来支持 vue2 的插件 [vite-plugin-vue2](https://www.npmjs.com/package/vite-plugin-vue2)，支持 JSX，同时目前最新版本也是[支持 vite2 的](https://github.com/underfin/vite-plugin-vue2/pull/13)。

使用上也很简单：

```diff
import { defineConfig } from 'vite';
+ import { createVuePlugin } from 'vite-plugin-vue2';

export default defineConfig({
  plugins: [
+   createVuePlugin(),
  ],
});
```

### 4、处理 typescript 路径映射

使用 vite 构建 ts 项目时，如果使用了 [typescript 路径映射](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping)的功能，就需要进行特殊处理，否则会出现模块无法解析（找不到）的错误：

![](/img/migration-from-vue-cli-to-vite2/3.jpeg)

这里需要使用 [vite-tsconfig-paths](https://github.com/aleclarson/vite-tsconfig-paths) 这个插件来做路径映射的解析替换。其原理较为简单，大致就是 vite 插件的 [resolveId 钩子](https://vitejs.dev/guide/api-plugin.html#universal-hooks)阶段，利用 [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths) 这个库来将路径映射解析为实际映射返回。有兴趣的可以看下该插件的实现，比较简短。

具体使用方式如下：

```diff
import { defineConfig } from 'vite';
import { createVuePlugin } from 'vite-plugin-vue2';
+ import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    createVuePlugin(),
+   tsconfigPaths(),
  ],
});
```

### 5、替换 CommonJS

vite 使用 ESM 作为模块化方案，因此不支持使用 `require` 方式来导入模块。否则在运行时会报 `Uncaught ReferenceError: require is not defined` 的错误（浏览器并不支持 CJS，自然没有 require 方法注入）。

此外，也可能会遇到 ESM 和 CJS 的兼容问题。当然这并不是 vite 构建所导致的问题，但需要注意这一点。简单来说就是 ESM 有 default 这个概念，而 CJS 没有。任何导出的变量在 CJS 看来都是 module.exports 这个对象上的属性，ESM 的 default 导出也只是 cjs 上的 module.exports.default 属性而已。例如在 typescript 中我们会通过 esModuleInterop 配置来让 tsc 添加一些兼容代码帮助解析导入的模块，webpack 中也有类似操作。

例如之前的代码：

```typescript
module.exports = {
    SSO_LOGIN_URL: 'https://xxx.yyy.com',
    SSO_LOGOUT_URL: 'https://xxx.yyy.com/cas/logout',
}
```

```typescript
const config = require('./config');
```

在导出和导入上都需要修改为 ESM，例如：

```typescript
export default {
    SSO_LOGIN_URL: 'https://xxx.yyy.com',
    SSO_LOGOUT_URL: 'https://xxx.yyy.com/cas/logout',
}
```

```typescript
import config from './config';
```

### 6、环境变量的使用方式

使用 vue-cli（webpack）时我们经常会利用环境变量来做运行时的代码判断，例如：

```typescript
const REPORTER_HOST = process.env.REPORTER_TYPE === 'mock'
  ? 'http://mock-report.xxx.com'
  : 'http://report.xxx.com';
```

[vite 仍然支持环境变量](https://vitejs.dev/guide/env-and-mode.html#env-variables)的使用，但不再提供 `process.env` 这样的访问方式。而是需要通过 [`import.meta.env`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/import.meta) 来访问环境变量：

```diff
-const REPORTER_HOST = process.env.REPORTER_TYPE === 'mock'
+const REPORTER_HOST = import.meta.env.REPORTER_TYPE === 'mock'
  ? 'http://mock-report.xxx.com'
  : 'http://report.xxx.com';
```

与 webpack 类似，vite 也[内置了一些环境变量](https://vitejs.dev/guide/env-and-mode.html#env-variables)，可以直接使用。

### 7、`import.meta.env` types

> 补充：vite 提供了它所需要的 types 定义，可以直接应用 [vite/client](https://github.com/vitejs/vite/blob/v2.0.3/packages/vite/client.d.ts) 来引入，可以不需要通过以下方式来自己添加。

如果在 typescript 中通过 [`import.meta.env`](https://github.com/microsoft/TypeScript/issues/22861) 来访问环境变量，可能会有一个 ts 错误提示：`类型“ImportMeta”上不存在属性“env”`。

![](/img/migration-from-vue-cli-to-vite2/4.jpeg)

这是因为在目前版本下（v4.2.2）`import.meta` 的定义还是一个[空的 interface](https://github.com/microsoft/TypeScript/blob/v4.2.2/lib/lib.es5.d.ts#L608-L615)：

```typescript
interface ImportMeta {
}
```

但我们可以通过 interface 的 merge 能力，在项目中进一步定义 ImportMeta 的类型来拓展对 `import.meta.env` 的类型支持。例如之前通过 vue-cli 生成的 ts 项目在 src 目录下会生成 `vue-shims.d.ts` 文件，可以在这里拓展 env 类型的支持：

```typescript
declare global {
  interface ImportMeta {
    env: Record<string, unknown>;
  }
}
```

这样就不会报错了。

![](/img/migration-from-vue-cli-to-vite2/5.jpeg)

### 8、webpack require context

在 webpack 中我们可以通过 [`require.context`](https://webpack.js.org/api/module-methods/#requirecontext) 方法「动态」解析模块。比较常用的一个做法就是指定某个目录，通过正则匹配等方式加载某些模块，这样在后续增加新的模块后，可以起到「动态自动导入」的效果。

例如在项目中，我们动态匹配 modules 文件夹下的 route.ts 文件，在全局的 vue-router 中设置 router 配置：

```typescript
const routes = require.context('./modules', true, /([\w\d-]+)\/routes\.ts/)
    .keys()
    .map(id => context(id))
    .map(mod => mod.__esModule ? mod.default : mod)
    .reduce((pre, list) => [...pre, ...list], []);

export default new VueRouter({ routes });
```

文件结构如下：

```
src/modules
├── admin
│   ├── pages
│   └── routes.ts
├── alert
│   ├── components
│   ├── pages
│   ├── routes.ts
│   ├── store.ts
│   └── utils
├── environment
│   ├── store
│   ├── types
│   └── utils
└── service
    ├── assets
    ├── pages
    ├── routes.ts
    ├── store
    └── types
```

require context 是 webpack 提供的特有的模块方法，并不是语言标准，所以在 vite 中不再能使用 require context。但如果完全改为开发者手动 import 模块，一来是对已有代码改动容易产生模块导入的遗漏；二来是放弃了这种「灵活」的机制，对后续的开发模式也会有一定改变。但好在 vite2.0 提供了 [glob 模式的模块导入](https://vitejs.dev/guide/features.html#glob-import)。该功能可以实现上述目标。当然，会需要做一定的代码改动：

```typescript
const routesModules = import.meta.globEager<{default: unknown[]}>('./modules/**/routes.ts');
const routes = Object
  .keys(routesModules)
  .reduce<any[]>((pre, k) => [...pre, ...routesMod[k].default], []);

export default new VueRouter({ routes });
```

主要就是将 `require.context` 改为 `import.meta.globEager`，同时适配返回值类型。当然，为了支持 types，可以为 ImportMeta 接口添加一些类型：

```diff
declare global {
  interface ImportMeta {
    env: Record<string, unknown>;
+   globEager<T = unknown>(globPath: string): Record<string, T>;
  }
}
```

此外再提一下，`import.meta.globEager` 会在构建时做静态分析将代码替换为静态 import 语句。如果希望能支持 dynamic import，请使用 `import.meta.glob` 方法。

### 9、API 代理

vite2.0 本地开发时（DEV 模式）仍然提供了一个 HTTP server，同时也支持[通过 proxy 项设置代理](https://vitejs.dev/config/#server-proxy)。其背后和 webpack 一样也是使用了 [http-proxy](https://github.com/http-party/node-http-proxy)，因此针对 vue-cli 的 proxy 设置可以迁移到 vite 中：

```diff
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { createVuePlugin } from 'vite-plugin-vue2';
+ import proxy from './src/tangram/proxy-table';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    createVuePlugin(),
  ],
+ server: {
+   proxy,
+ }
});
```

### 10、HTML 内容插入

在基于 vue-cli 中我们可以利用 webpack 的 HtmlWebpackPlugin 来实现 HTML 中值的替换，例如 `<%= htmlWebpackPlugin.options.title %>` 这种形式来将该处模板变量在编译时，替换为实际的 title 值。要实现这样的功能也非常简单，例如 [vite-plugin-html](https://www.npmjs.com/package/vite-plugin-html) 。这个插件基于 ejs 来实现模板变量注入，通过 `transformIndexHtml` 钩子，接收原始 HTML 字符串，然后通过 ejs 渲染注入的变量后返回。

下面是迁移后，使用 vite-plugin-html 的配置方式：

```diff
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { createVuePlugin } from 'vite-plugin-vue2';
+ import { injectHtml } from 'vite-plugin-html';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    createVuePlugin(),
+   injectHtml({
+     injectData: {
+       title: '用户管理系统',
+     },
    }),
  ],
  server: {
    proxy,
  },
});
```

对应的需求修改一下 HTML 的模板变量写法：

```diff
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
- <title><%= htmlWebpackPlugin.options.title %></title>
+ <title><%= title %></title>
</head>

<body>
  <noscript>
-   We're sorry but <%= htmlWebpackPlugin.options.title %> doesn't work properly without JavaScript enabled.
+   We're sorry but <%= title %> doesn't work properly without JavaScript enabled.
  </noscript>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>

</html>
```

### 11、兼容性处理

在项目背景介绍上有提到该项目对兼容性要求很低，所以这块在迁移中实际并未涉及。

当然，如果对兼容性有要求的项目，可以使用 [@vitejs/plugin-legacy](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy) 插件。该插件会打包出两套代码，一套面向新式浏览器，另一套则包含各类 polyfill 和语法兼容来面向老式浏览器。同时在 HTML 中使用 [module/nomodule 技术](https://philipwalton.com/articles/using-native-javascript-modules-in-production-today/)来实现新/老浏览器中的「条件加载」。

## 总结

该项目包含 1897 个模块文件（包括 node_modules 中模块），迁移前后的构建（无缓存）耗时如下：

|     | vue-cli  | vite 2 |
|  ----  | ----  | ----  |
| dev 模式 | ~8s | ~400ms |
| prod 模式 | ~42s | ~36s |

可以看到，在 DEV 模式下 vite2 构建效率的提升非常明显，这也是因为其在 DEV 模式下只做一些轻量级模块文件处理，不会做较重的打包工作，而在生产模式下，由于仍然需要使用 esbuild 和 rollup 做构建，所以在该项目中效率提升并不明显。

---

以上就是笔者在做 vue-cli 迁移 vite 2.0 时，遇到的一些问题。都是一些比较小的点，整体迁移上并未遇到太大的阻碍，用了不到半天时间就迁移了。当然，这也有赖于近年来 JavaScript、HTML 等标准化工作使得我们写的主流代码也能够具备一定的统一性。这也是这些前端工具让我们「面向未来」编程带来的一大优点。希望这篇文章能够给，准备尝试迁移到 vite 2.0 的各位朋友一些参考。