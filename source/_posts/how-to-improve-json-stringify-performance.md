---
title: 如何提升JSON.stringify()的性能？
date: 2019-06-05 12:00:00
tags:
- 漫游Github
- 性能优化
- JavaScript
---

![](/img/json.jpg)

在一些性能敏感的场合下（例如服务端处理大量并发），或面对大量 stringify 的操作时，我们会希望它的性能更好，速度更快。这也催生了一些优化的 stringify 方案/库，那么，在他们大幅的性能提升背后的技术原理是什么呢？

<!-- more -->

![](/img/how-to-improve-json-stringify-performance/16f6c376da73aced.png)

## 1. 熟悉的`JSON.stringify()`

在浏览器端或服务端，`JSON.stringify()`都是我们很常用的方法：

- 将 JSON object 存储到 localStorage 中；
- POST 请求中的 JSON body；
- 处理响应体中的 JSON 形式的数据；
- 甚至某些条件下，我们还会用它来实现一个简单的深拷贝；
- ……

在一些性能敏感的场合下（例如服务端处理大量并发），或面对大量 stringify 的操作时，我们会希望它的性能更好，速度更快。这也催生了一些优化的 stringify 方案/库，下图是它们与原生方法的性能对比：

![](/img/how-to-improve-json-stringify-performance/16b25784d49d825a.png)

绿色部分时原生`JSON.stringify()`，可见性能相较这些库都要低很多。那么，在大幅的性能提升背后的技术原理是什么呢？

## 2. 比 `stringify` 更快的 `stringify`

由于 JavaScript 是动态性很强的语言，所以对于一个 Object 类型的变量，其包含的键名、键值、键值类型最终只能在运行时确定。因此，执行`JSON.stringify()`时会有很多工作要做。在一无所知的情况下，我们想要大幅优化显然无能为力。

那么如果我们知道这个 Object 中的键名、键值信息呢 —— 也就是知道它的结构信息，这会有帮助么？

看个例子：

下面这个 Object，

```JavaScript
const obj = {
    name: 'alienzhou',
    status: 6,
    working: true
};
```

我们对它应用`JSON.stringify()`，得到结果为

```JavaScript
JSON.stringify(obj);
// {"name":"alienzhou","status":6,"working":true}
```

现在如果我们知道这个`obj`的结构是固定的：

- 键名不变
- 键值的类型一定

那么其实，我可以创建一个“定制化”的 stringify 方法

```JavaScript
function myStringify(o) {
    return (
        '{"name":"'
        + o.name
        + '","status":'
        + o.status
        + ',"isWorking":'
        + o.working
        + '}'
    );
}
```

看看我们的`myStringify`方法的输出：

```JavaScript
myStringify({
    name: 'alienzhou',
    status: 6,
    working: true
});
// {"name":"alienzhou","status":6,"isWorking":true}

myStringify({
    name: 'mengshou',
    status: 3,
    working: false
});
// {"name":"mengshou","status":3,"isWorking":false}
```

可以得到正确的结果，但只用到了类型转换和字符串拼接，所以“定制化”方法可以让“stringify”更快。

总结来看，如何得到比 `stringify` 更快的 `stringify` 方法呢？

1. 需要先确定对象的结构信息；
2. 根据其结构信息，为该种结构的对象创建“定制化”的`stringify`方法，其内部实际是通过字符串拼接生成结果的；
3. 最后，使用该“定制化”的方法来 stringify 对象即可。

这也是大多数 stringify 加速库的套路，转化为代码就是类似：

```JavaScript
import faster from 'some_library_faster_stringify';

// 1. 通过相应规则，定义你的对象结构
const theObjectScheme = {
    // ……
};

// 2. 根据结构，得到一个定制化的方法
const stringify = faster(theObjectScheme);

// 3. 调用方法，快速 stringify
const target = {
    // ……
};
stringify(target);
```

## 3. 如何生成“定制化”的方法

根据上面的分析，核心功能在于，**根据其结构信息，为该类对象创建“定制化”的stringify方法，其内部实际是简单的属性访问与字符串拼接。**

为了了解具体的实现方式，下面我以两个实现上略有差异的开源库为例来简单介绍一下。

### 3.1. fast-json-stringify

![](/img/how-to-improve-json-stringify-performance/16b21d1399c2e90b.png)

下图是根据 [fast-json-stringify](https://github.com/fastify/fast-json-stringify#benchmarks) 提供的 benchmark 结果，整理出来的性能对比。

![](/img/how-to-improve-json-stringify-performance/16b21db215453a98.png)

可以看到，在大多数场景下具备2-5倍的性能提升。

#### 3.1.1. scheme 的定义方式

fast-json-stringify 使用了 [JSON Schema Validation ](http://json-schema.org/latest/json-schema-validation.html) 来定义（JSON）对象的数据格式。其 scheme 定义的结构本身也是 JSON 格式的，例如对象

```JavaScript
{
    name: 'alienzhou',
    status: 6,
    working: true
}
```

对应的 scheme 就是：

```JavaScript
{
    title: 'Example Schema',
    type: 'object',
    properties: {
        name: {
            type: 'string'
        },
        status: {
            type: 'integer'
        },
        working: {
            type: 'boolean'
        }
    }
}
```

其 scheme 定义规则丰富，具体使用可以参考 [Ajv](https://ajv.js.org/) 这个 JSON 校验库。

#### 3.1.2. stringify 方法的生成

fast-json-stringify 会根据刚才定义的 scheme，拼接生成出实际的函数代码字符串，然后使用 [Function 构造函数](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function)在运行时动态生成对应的 stringify 函数。

在代码生成上，首先它会注入预先定义好的各类工具方法，这一部分不同的 scheme 都是一样的：

```JavaScript
var code = `
    'use strict'
  `

  code += `
    ${$asString.toString()}
    ${$asStringNullable.toString()}
    ${$asStringSmall.toString()}
    ${$asNumber.toString()}
    ${$asNumberNullable.toString()}
    ${$asIntegerNullable.toString()}
    ${$asNull.toString()}
    ${$asBoolean.toString()}
    ${$asBooleanNullable.toString()}
  `
```

其次，就会根据 scheme 定义的具体内容生成 stringify 函数的具体代码。而生成的方式也比较简单：通过遍历 scheme。

遍历 scheme 时，根据定义的类型，在对应代码处插入相应的工具函数用于键值转换。例如上面例子中`name`这个属性：

```JavaScript
var accessor = key.indexOf('[') === 0 ? sanitizeKey(key) : `['${sanitizeKey(key)}']`
switch (type) {
    case 'null':
        code += `
            json += $asNull()
        `
        break
    case 'string':
        code += nullable ? `json += obj${accessor} === null ? null : $asString(obj${accessor})` : `json += $asString(obj${accessor})`
        break
    case 'integer':
        code += nullable ? `json += obj${accessor} === null ? null : $asInteger(obj${accessor})` : `json += $asInteger(obj${accessor})`
        break
    ……
```

上面代码中的`code`变量保存的就是最后生成的函数体的代码串。由于在 scheme 定义中，`name`为`string`类型，且不为空，所以会在`code`中添加如下一段代码字符串：

```JavaScript
"json += $asString(obj['name'])"
```

> 由于还需要处理数组、及联对象等复杂情况，实际的代码省略了很多。

然后，生成的完整的`code`字符串大致如下：

```JavaScript
function $asString(str) {
    // ……
}
function $asStringNullable(str) {
    // ……
}
function $asStringSmall(str) {
    // ……
}
function $asNumber(i) {
    // ……
}
function $asNumberNullable(i) {
    // ……
}
/* 以上是一系列通用的键值转换方法 */

/* $main 就是 stringify 的主体函数 */
function $main(input) {
    var obj = typeof input.toJSON === 'function'
        ? input.toJSON()
        : input

    var json = '{'
    var addComma = false
    if (obj['name'] !== undefined) {
        if (addComma) {
            json += ','
        }
        addComma = true
        json += '"name":'
        json += $asString(obj['name'])
    }

    // …… 其他属性(status、working)的拼接

    json += '}'
    return json
}

return $main
```

最后，将`code`字符串传入 Function 构造函数来创建相应的 stringify 函数。

```JavaScript
// dependencies 主要用于处理包含 anyOf 与 if 语法的情况
dependenciesName.push(code)
return (Function.apply(null, dependenciesName).apply(null, dependencies))
```

### 3.2. slow-json-stringify

![](/img/how-to-improve-json-stringify-performance/16b223db88e935e6.png)

[slow-json-stringify](https://github.com/lucagez/slow-json-stringify) 虽然名字叫 "slow"，但其实是一个 "fast" 的 stringify 库（命名很调皮）。

> The slowest stringifier in the known universe. Just kidding, it's the fastest (:

它的实现比前面提到的 fast-json-stringify 更轻量级，思路也很巧妙。同时它[在很多场景下效率会比 fast-json-stringify 更快](https://github.com/lucagez/slow-json-stringify/blob/master/benchmark.md)。

![](/img/how-to-improve-json-stringify-performance/16b25784d49d825a.png)


![](/img/how-to-improve-json-stringify-performance/16b25793da834834.png)

#### 3.2.1. scheme 的定义方式

slow-json-stringify 的 scheme 定义更自然与简单，主要就是将键值替换为类型描述。还是上面这个对象的例子，scheme 会变为

```JavaScript
{
    name: 'string',
    status: 'number',
    working: 'boolean'
}
```

确实非常直观。

#### 3.2.2. stringify 方法的生成

不知道你注意到没有

```JavaScript
// scheme
{
    name: 'string',
    status: 'number',
    working: 'boolean'
}

// 目标对象
{
    name: 'alienzhou',
    status: 6,
    working: true
}
```

scheme 和原对象的结构是不是很像？

这种 scheme 的巧妙之处在于，这样定义之后，我们可以先把 scheme `JSON.stringify`一下，然后“扣去”所有类型值，最后等着我们的就是把实际的值直接填充到 scheme 对应的类型声明处。

具体如何操作呢？

首先，可以直接对 scheme 调用`JSON.stringify()`来生成基础模版，同时借用`JSON.stringify()`的第二个参数来作为遍历方法收集属性的访问路径：

```JavaScript
let map = {};
const str = JSON.stringify(schema, (prop, value) => {
    const isArray = Array.isArray(value);
    if (typeof value !== 'object' || isArray) {
        if (isArray) {
            const current = value[0];
            arrais.set(prop, current);
        }

        _validator(value);

        map[prop] = _deepPath(schema, prop);
        props += `"${prop}"|`;
    }
    return value;
});
```

此时，`map` 里收集所有属性的访问路径。同时生成的`props`可以拼接为匹配相应类型字符还的正则表达式，例如我们这个例子里的正则表达式为`/"name"|"status"|"working"|"(string|number|boolean|undef)"|\\[(.*?)\\]/`。

然后，根据正则表达式来顺序匹配这些属性，替换掉属性类型的字符串，换成统一的占位字符串`"__par__"`，并基于`"__par__"`拆分字符串：


```JavaScript
const queue = [];
const chunks = str
    .replace(regex, (type) => {
      switch (type) {
        case '"string"':
        case '"undefined"':
          return '"__par__"';
        case '"number"':
        case '"boolean"':
        case '["array-simple"]':
        case '[null]':
          return '__par__';
        default:
          const prop = type.match(/(?<=\").+?(?=\")/)[0];
          queue.push(prop);
          return type;
      }
    })
    .split('__par__');
```

这样你就会得到`chunks`和`props`两个数组。`chunks`里包含了被分割的 JSON 字符串。以例子来说，两个数组分别如下

```JavaScript
// chunks
[
    '{"name":"',
    '","status":"',
    '","working":"',
    '"}'
]

// props
[
    'name',
    'status',
    'working'
]
```

最后，由于 map 中保存了属性名与访问路径的映射，因此可以根据 prop 访问到对象中某个属性的值，循环遍历数组，将其与对应的 chunks 拼接即可。

从代码量和实现方式来看，这个方案会更轻便与巧妙，同时也不需要通过 Function、eval 等方式动态生成或执行函数。

## 4. 总结

虽然不同库的实现有差异，但从整体思路上来说，实现高性能 stringify 的方式都是一样的：

1. 开发者定义 Object 的 JSON scheme；
2. stringify 库根据 scheme 生成对应的模版方法，模版方法里会对属性与值进行字符串拼接（显然，属性访问与字符串拼接的效率要高多了）；
3. 最后开发者调用返回的方法来 stringify Object 即可。

归根到底，它本质上是通过静态的结构信息将优化与分析前置了。

## Tips

最后，还是想提一下

- 所有的 benchmark 只能作为一个参考，具体是否有性能提升、提升多少还是建议你在实际的业务中测试；
- fast-json-stringify 中使用到了 Function 构造函数，因此建议不要将用户输入直接用作 scheme，以防一些安全问题。

---

好了，这期的「漫游 Github」就到这里了。本系列会不定期和大家一起看一看、聊一聊、学一学 github 上有趣的项目，不仅学习一些技术点，还可以了解作者的技术思考，欢迎感兴趣的小伙伴关注。

![](/img/how-to-improve-json-stringify-performance/16f6c376da73aced.png)

---