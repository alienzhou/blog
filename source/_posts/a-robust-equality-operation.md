---
title: 如何“严谨地”判断两个变量是否相同
date: 2020-01-08 12:00:00
tags:
- 3分钟速览
- JavaScript
---

![](/img/16f8389a295640a6.jpg)

你知道如何“严谨地”判断两个变量相同么？仅仅使用 `===` 就可以了么？

<!-- more -->

## 严格相等

我们可以非常快的写一个 `is` 方法来判断变量 x 是否就是 y：

```JavaScript
// 第一版
function is(x, y) {
  return x == y;
}
```

当然，你会很快发现，方法里用了 `==`，由于[隐式转换](https://www.w3schools.com/js/js_type_conversion.asp)的问题，这并不严谨。所以我们自然会使用如下的方法：

```JavaScript
// 第二版
function is(x, y) {
  return x === y;
}
```

那么这是否完美了呢？

## 一个“更严谨”的方法

```JavaScript
// 第三版
function is(x, y) {
  if (x === y) {
    return x !== 0 || y !== 0 || 1 / x === 1 / y;
  } else {
    return x !== x && y !== y;
  }
}
```

上面方法相较于我们常用的第二版更复杂了。那么为什么多了这么多判断呢？

下面让我们来详细看看。

### 1. Infinity

了解 JavaScript 的同学应该会记得，在全局中有一个叫做 [`Infinity`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Infinity) 的属性，表示数值上的无穷大。

| Infinity 属性的属性特性 |  |
|---|---|
| writable | false |
| enumerable | false |
| configurable | false |

同时，你用 `Number.POSITIVE_INFINITY` 也能获取到该值。

![](https://user-gold-cdn.xitu.io/2020/1/4/16f6f132c0bec8ec?w=436&h=39&f=png&s=3876)

于此对应的，也有个 `Number.NEGATIVE_INFINITY` 的值，实际就是 `-Infinity`。

而 `Infinity` 比较特殊的一点在于，在 JavaScript 中 `1 / Infinity` 与 `-1 / Infinity`。 被认为是相等的（由于 `+0` 和 `-0`，下一节会进一步介绍）

![](https://user-gold-cdn.xitu.io/2020/1/4/16f6f174c669e5f3?w=322&h=41&f=png&s=2913)

而在很多场景中，包括像一些 deepEqual 之类的方法中，我们不希望将其判定为相等。学过统计的同学都知道[假设检验中有两类错误](https://en.wikipedia.org/wiki/False_positives_and_false_negatives)：

- I类错误：弃真错误（false positive）
- II类错误：取伪错误（false negative）

结合我们上面提到的，第一个条件判断可能就会犯II类错误 —— `1 / Infinity` 与 `-1 / Infinity` 不相同，却判断为相同了。所以需要进一步判断：

```JavaScript
x !== 0 || y !== 0 || 1 / x === 1 / y
```

`1 / Infinity` 与 `-1 / Infinity` 在与 `0` 的相等判断中都会为 `true`


![](https://user-gold-cdn.xitu.io/2020/1/4/16f6f2ddd2f954bc?w=574&h=41&f=png&s=4875)

而其倒数 `Infinity` 与 `-Infinity` 是不相等的，所以避免了 `1 / Infinity` 与 `-1 / Infinity` 的判断问题。

### 2. `+0` 与 `-0`

其实，上面 `Infinity` 问题的核心原因在于于 JavaScript 中存在 `+0` 与 `-0`。

我们知道每个数字都有其对应的二进制编码形式，因此 `+0` 与 `-0` 编码是有区别的，平时我们不主动声明的话，所使用的其实都是 `+0`，而 JavaScript 为了我们的运算能更加方便，也做了很多额外工作。

> 想要更进一步了解 `+0` 与 `-0` 可以读一下 [JavaScript’s two zeros](https://2ality.com/2012/03/signedzero.html) 这篇文章。

但在很多判断相等的工作上，我们还是会把 `+0` 与 `-0` 区分开。

```JavaScript
x !== 0 || y !== 0 || 1 / x === 1 / y
```

上面这个式子也就起到了这个作用。

### 3. `NaN`

JavaScript 中还有一个叫 [`NaN`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/NaN) 全局属性，用来表示不是一个数字（Not-A-Number）

| NaN 属性的属性特性 |  |
|---|---|
| writable | false |
| enumerable | false |
| configurable | false |

它有一个特点 —— 自己不等于自己：

![](https://user-gold-cdn.xitu.io/2020/1/4/16f6f35688449594?w=328&h=36&f=png&s=2128)

这可能会导致判断出现 I 类错误（弃真错误）：原本是相同的，却被我们判断为不相同。

解决的方法也很简单，JavaScript 中只有 `NaN` 会有“自己不等于自己”的特点。所以只需要判断两个变量是否都“自己不等于自己”即可，即都为 `NaN` ：

```JavaScript
x !== x && y !== y
```

如果两个变量都为 `NaN`，那么他们其实就还是相同的。

## 总结

总的来说，我们的加强版就是额外处理了 `+0`/`-0` 与 `NaN` 的情况。

实际项目中，很多时候由于并不会碰这样的业务值，或者这些边界情况的判断并不影响业务逻辑，所以使用 `===` 就足够了。

而在一些开源库中，由于需要更加严谨，所以很多时候就会考虑使用第三版的这类方法。例如在 [react-redux 中对 props 和 state 前后相等性判断](https://github.com/reduxjs/react-redux/blob/58ae5edee510a2f2f3bc577f55057fe9142f2976/src/utils/shallowEqual.js#L1-L7)，[underscore 中的相等判断方法](https://github.com/jashkenas/underscore/blob/master/underscore.js#L1191-L1198)等。而 underscore 中更进一步还对 `null` 与 `undefined` 做了特殊处理。
