---
title: 使用 Babel 避免 webpack 编译模块依赖
date: 2018-08-19 12:00:00
tags:
- webpack
- Babel
- 自动化工具
---

![](/img/babel.jpg)

Babel 是一个非常强大的工具，作用远不止我们平时的 ES6 -> ES5 语法转换这么单一。在前端进阶的道路上，了解与学习 Babel 及其灵活的插件模式将会为前端赋予更多的可能性。

本文就是运用 Babel ，通过编写 [Babel 插件](https://github.com/alienzhou/babel-plugin-import-customized-require) 解决了一个实际项目中的问题。

<!-- more -->

> 本文相关代码已托管至 github: [babel-plugin-import-customized-require](https://github.com/alienzhou/babel-plugin-import-customized-require)

## 1. 遇到的问题 

最近在项目中遇到这样一个问题：我们知道，使用 webpack 作为构建工具是会默认自动帮我们进行依赖构建；但是在项目代码中，有一部分的依赖是运行时依赖/非编译期依赖（可以理解为像 requirejs 、seajs 那样的纯前端模块化），对于这种依赖不做处理会导致 webpack 编译出错。

为什么需要非编译期依赖呢？例如，在当前的业务模块（一个独立的 webpack 代码仓库）里，我依赖了一个公共业务模块的打点代码

```javascript
// 这是home业务模块代码
// 依赖了common业务模块的代码
import log from 'common:util/log.js'

log('act-1');
```

然而，可能是由于技术栈不统一，或是因为common业务代码遗留问题无法重构，或者仅仅是为了业务模块的分治……总之，无法在 webpack 编译期解决这部分模块依赖，而是需要放在前端运行时框架解决。

为了解决webpack编译期无法解析这种模块依赖的问题，可以给这种非编译期依赖引入新的语法，例如下面这样：

```javascript
// __my_require__是我们自定义的前端require方法
var log = __my_require__('common:util/log.js')

log('act-1');
```

但这样就导致了我们代码形式的分裂，拥抱规范让我们希望还是能够用ESM的标准语法来一视同仁。

我们还是希望能像下面这样写代码：

```javascript
// 标准的ESM语法
import * as log from 'common:util/log.js';

log('act-1');
```

此外，也可以考虑使用webpack提供了 `externals` 配置来避免某些模块被 webpack 打包。然而，一个重要的问题是，在已有的 common 代码中有一套前端模块化语法，要将 webpack 编译出来的代码与已有模式融合存在一些问题。因此该方式也存在不足。

针对上面的描述，总结来说，我们的目的就是：

- 能够在代码中使用ESM语法，来进行非编译期分析的模块引用
- 由于webpack会尝试打包该依赖，需要不会在编译期出错

## 2. 解决思路

基于上面的目标，首先，我们需要有一种方式能够标识不需要编译的运行期依赖。例如 `util/record` 这个模块，如果是运行时依赖，可以参考标准语法，为模块名添加标识： `runtime:util/record` 。效果如下：

```javascript
// 下面这两行是正常的编译期依赖
import React from 'react';
import Nav from './component/nav';

// 下面这两个模块，我们不希望webpack在编译期进行处理
import record from 'runtime:util/record';
import {Banner, List} from 'runtime:ui/layout/component';
```

其次，虽然标识已经可以让开发人员知道代码里哪些模块是webpack需要打包的依赖，哪些是非编译期依赖；但 webpack 不知道，它只会拿到模块源码，分析 import 语法拿到依赖，然后尝试加载依赖模块。但这时 webpack 傻眼了，因为像 `runtime:util/record` 这样的模块是运行时依赖，编译期找不到该模块。那么，就需要通过一种方式，让 webpack “看不见”非编译期的依赖。

最后，拿到非编译期依赖，由于浏览器现在还不支持ESM的import语法，因此需要将它变为在前端运行时我们自定义的模块依赖语法。


![](/img/1654c154b3778163.png)

## 3. 使用 Babel 对源码进行分析

### 3.1. Babel 相关工具介绍

> 对 Babel 以及插件机制不太了解的同学，可以先看这一部分做一个简单的了解。

Babel 是一个强大的 JavaScript Compiler，可以将源码通过词法分析与语法分析转换为 AST（抽象语法树），通过对 AST 进行转换，可以修改源码，最后再将修改后的 AST 转换会目标代码。

![](/img/1654852a672a4d8e.png)

由于篇幅限制，本文不会对 Compiler 或者 AST 进行过多介绍，但是如果你学过编译原理，那么对词法分析、语法分析、token 、AST 应该都不会陌生。即使没了解过也没有关系，你可以粗略的理解为：Babel 是 Compiler 的一部分，它可以将 JavaScript 源码转化为一种特殊的数据结构，这种数据结构就是树，也就是 AST ，它是一种能够很好表示源码的结构。Babel 的 AST 是基于[ESTree](https://github.com/estree/estree)的。

例如， `var alienzhou = 'happy'` 这条语句，经过babel处理后它的AST大概是下面这样的

```javascript
{
    type: 'VariableDeclaration',
    kind: 'var',
    // ...其他属性
    decolarations: [{
        type: 'VariableDeclarator',
        id: {
            type: 'Identifier',
            name: 'alienzhou',
            // ...其他属性
        },
        init: {
            type: 'StringLiteral',
            value: 'happy',
            // ...其他属性
        }
    }],
}
```

这部分 AST node 表示，这是一条变量声明的语句，使用 `var` 关键字，其中 id 和 init 属性又是两个 AST node ，分别是名称为 alienzhou 的标识符（ Identifier ）和值为 happy 的字符串字面量（ StringLiteral ）。

这里，简单介绍一些如何使用 Babel 及其提供的一些库来进行 AST 的分析和修改。生成 AST 可以通过 `babel-core` 里的方法，例如：

```javascript
const babel = require('babel-core');
const {ast} = babel.transform(`var alienzhou = 'happy'`);
```

然后遍历 AST，找到特定的节点进行修改即可。Babel 也为我们提供了 `traverse` 方法来遍历AST：

```javascript
const traverse = require('babel-traverse').default;
```

在 Babel 中访问 AST node 使用的是[ vistor 模式](https://en.wikipedia.org/wiki/Visitor_pattern)，可以像下面这样指定 AST node type 来访问所需的 AST node：

```javascript
traverse(ast, {
    StringLiteral(path) {
        console.log(path.node.value)
        // ...
    }
})
```

这样就可以得到所有的字符串字面量，当然你也可以替换这个节点的内容：

```javascript
let visitor = {
    StringLiteral(path) {
        console.log(path.node.value)
        path.replaceWith(
            t.stringLiteral('excited');
        )
    }
};
traverse(ast, visitor);
```

> 注意，AST 是一个 mutable 对象，所有的节点操作都会在原 AST 上进行修改。

这篇文章不会详细介绍 babel-core、babel-traverse 的 API，而是帮助没有接触过的朋友快速理解它们，具体的使用方式可以参考相关文档。

由于大部分的 webpack 项目都会在 loader 中使用 Babel，因此只需要提供一个 Babel 的插件来处理非编译期依赖语法即可。而 Babel 插件其实就是导出一个方法，该方法会返回我们上面提到的 visitor 对象。

那么接下来我们专注于 visitor 的编写即可。

### 3.2 编写一个 Babel 插件来解决非编译期依赖

ESM 的 import 语法在 AST node type 中是[ ImportDeclaration](https://github.com/babel/babel/blob/master/packages/babel-parser/ast/spec.md#importdeclaration)：

```javascript
export default function () {
    return {
        ImportDeclaration: {
            enter(path) {
                // ...
            }
            exit(path) {
                let source = path.node.source;
                if (t.isStringLiteral(source) && /^runtime:/.test(source.value)) {
                    // ...
                }
            }
        }
    }
}
```

在 `enter` 方法里，需要收集 ImportDeclaration 语法的相关信息；在 `exit` 方法里，判断当前 ImportDeclaration 是否为非编译期依赖，如果是则进行语法转换。

收集 ImportDeclaration 语法相关信息需要注意，对于不同的 import specifier 类型，需要不同的分析方式，下面列举了这五种 import：

```javascript
import util from 'runtime:util';
import * as util from 'runtime:util';
import {util} from 'runtime:util';
import {util as u} from 'runtime:util';
import 'runtime:util';
```

对应了三类 specifier：

- ImportSpecifier：`import {util} from 'runtime:util'`,`import {util as u} from 'runtime:util';`
- ImportDefaultSpecifier：`import util from 'runtime:util'`
- ImportNamespaceSpecifier：`import * as util from 'runtime:util'`

> `import 'runtime:util'` 中没有 specifier

可以在 ImportDeclaration 的基础上，对子节点进行 traverse，这里新建了一个 visitor 用来访问 Specifier，针对不同语法进行收集：

```javascript
const specifierVisitor = {
    ImportNamespaceSpecifier(_path) {
        let data = {
            type: 'NAMESPACE',
            local: _path.node.local.name
        };

        this.specifiers.push(data);
    },

    ImportSpecifier(_path) {
        let data = {
            type: 'COMMON',
            local: _path.node.local.name,
            imported: _path.node.imported ? _path.node.imported.name : null
        };

        this.specifiers.push(data);
    },

    ImportDefaultSpecifier(_path) {
        let data = {
            type: 'DEFAULT',
            local: _path.node.local.name
        };

        this.specifiers.push(data);
    }
}
```

在 ImportDeclaration 中使用 specifierVisitor 进行遍历：

```javascript
export default function () {
    // store the specifiers in one importDeclaration
    let specifiers = [];
    return {
        ImportDeclaration: {
            enter(path) {
                path.traverse(specifierVisitor, { specifiers });
            }
            exit(path) {
                let source = path.node.source;
                if (t.isStringLiteral(source) && /^runtime:/.test(source.value)) {
                    // ...
                }
            }
        }
    }
}
```

到目前为止，我们在进入 ImportDeclaration 节点时，收集了 import 语句相关信息，在退出节点时，通过判断可以知道目前节点是否是非编译期依赖。因此，如果是非编译期依赖，只需要根据收集到的信息替换节点语法即可。

生成新节点可以使用 babel-types。不过推荐使用 babel-template，会令代码更简便与清晰。下面这个方法，会根据不同的 import 信息，生成不同的运行时代码，其中假定 `__my_require__` 方法就是自定义的前端模块 `require` 方法。

```javascript
const template = require('babel-template');

function constructRequireModule({
    local,
    type,
    imported,
    moduleName
}) {

    /* using template instead of origin type functions */
    const namespaceTemplate = template(`
        var LOCAL = __my_require__(MODULE_NAME);
    `);

    const commonTemplate = template(`
        var LOCAL = __my_require__(MODULE_NAME)[IMPORTED];
    `);

    const defaultTemplate = template(`
        var LOCAL = __my_require__(MODULE_NAME)['default'];
    `);

    const sideTemplate = template(`
        __my_require__(MODULE_NAME);
    `);
    /* ********************************************** */

    let declaration;
    switch (type) {
        case 'NAMESPACE':
            declaration = namespaceTemplate({
                LOCAL: t.identifier(local),
                MODULE_NAME: t.stringLiteral(moduleName)
            });
            break;

        case 'COMMON':
            imported = imported || local;
            declaration = commonTemplate({
                LOCAL: t.identifier(local),
                MODULE_NAME: t.stringLiteral(moduleName),
                IMPORTED: t.stringLiteral(imported)
            });
            break;

        case 'DEFAULT':
            declaration = defaultTemplate({
                LOCAL: t.identifier(local),
                MODULE_NAME: t.stringLiteral(moduleName)
            });
            break;

        case 'SIDE':
            declaration = sideTemplate({
                MODULE_NAME: t.stringLiteral(moduleName)
            })

        default:
            break;
    }

    return declaration;
}
```

最后整合到一开始的 visitor 中：

```javascript
export default function () {
    // store the specifiers in one importDeclaration
    let specifiers = [];
    return {
        ImportDeclaration: {
            enter(path) {
                path.traverse(specifierVisitor, { specifiers });
            }
            exit(path) {
                let source = path.node.source;
                let moduleName = path.node.source.value;
                if (t.isStringLiteral(source) && /^runtime:/.test(source.value)) {
                    let nodes;
                    if (specifiers.length === 0) {
                        nodes = constructRequireModule({
                            moduleName,
                            type: 'SIDE'
                        });
                        nodes = [nodes]
                    }
                    else {
                        nodes = specifiers.map(constructRequireModule);
                    }
                    path.replaceWithMultiple(nodes);
                }
                specifiers = [];
            }
        }
    }
}
```

那么，对于一段 `import util from 'runtime:util'` 的源码，在该 Babel 插件修改后变为了 `var util = require('runtime:util')['default']`，该代码也会被 webpack 直接输出。

这样，通过 Babel 插件，我们就完成了文章最一开始的目标。

## 4. 处理 dynamic import

细心的读者肯定会发现了，我们在上面只解决了静态 import 的问题，那么像下面这样的动态 import 不是仍然会有以上的问题么？

```javascript
import('runtime:util').then(u => {
    u.record(1);
});
```
是的，仍然会有问题。因此，进一步我们还需要处理动态 import 的语法。要做的就是在 visitor 中添加一个新的 node type：

```javascript
{
    Import: {
        enter(path) {
            let callNode = path.parentPath.node;
            let nameNode = callNode.arguments && callNode.arguments[0] ? callNode.arguments[0] : null;

            if (t.isCallExpression(callNode)
                && t.isStringLiteral(nameNode)
                && /^runtime:/.test(nameNode.value)
            ) {
                let args = callNode.arguments;
                path.parentPath.replaceWith(
                    t.callExpression(
                        t.memberExpression(
                            t.identifier('__my_require__'), t.identifier('async'), false),
                            args
                ));
            }
        }
    }
}
```

这时，上面的动态 import 代码就会被替换为：

```javascript
__my_require__.async('runtime:util').then(u => {
    u.record(1);
});
```

非常方便吧。

## 5. 写在最后

> 本文相关代码已托管至 Github: [babel-plugin-import-customized-require](https://github.com/alienzhou/babel-plugin-import-customized-require)

本文是从一个关于 webpack 编译期的需求出发，应用 Babel 来使代码中部分模块依赖不在 webpack 编译期进行处理。其实从中可以看出，Babel 给我们赋予了极大的可能性。

文中解决的问题只是一个小需求，也许你会有更不错的解决方案；然而这里更多的是展示了 Babel 的灵活、强大，它给前端带来的更多的空间与可能性，在许多衍生的领域也都能发现它的身影。希望本文能成为一个引子，为你拓展解决问题的另一条思路。

## 参考资料

- [Babel AST spec](https://github.com/babel/babel/blob/master/packages/babel-parser/ast/spec.md)
- [visitor pattern](https://en.wikipedia.org/wiki/Visitor_pattern)
- [Babel Plugin Handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md)
- [AST Explorer](http://astexplorer.net/)