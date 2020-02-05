---
title: 为什么要在 JS 中进行静态类型检查 - 1
date: 2017-07-05 12:00:00
tags:
- 翻译
- JavaScript
---

*本文为翻译文章，原文链接见文末*

作为一个JavaScript开发者，你可以编写一整天编写也不会遇到任何静态类型检查得问题。那么为什么要自找麻烦得去学习它呢？
然而学习静态类型并不仅仅是一个思维拓展的训练。如果你愿意花点时间来学习一些静态类型的优势、劣势以及使用的案例，那将会极大的帮助你进行编码。
怎么样，有意思吧？要是你感兴趣的话，那接下来四个部分将会向你详细解释。

<!-- more -->

# 一、定义

理解静态类型最快捷的方式就是它和动态类型进行对比。
> A language with static types is referred to as a statically-typed language. On the other hand, a language with dynamic types is referred to as a dynamically-typed language.

静态类型语言和动态类型语言得核心区别在于，静态类型语言（statically-typed languages）会在编译时（compile time）进行类型检查，而动态语言（dynamically-typed）则是在运行时进行类型检查（runtime）。

这里又多了一个概念：什么是“类型检查”（type-checking）？

为了解释这个概念，我们可以将Java于JavaScript的类型对比看一下。

这里的类型（Types）指的是一个数据被定义的类型。

举个例子，在Java中如果你定义一个`boolean`值：

```
boolean result = true;
```
这个变量就有了一个正确的类型，因为`boolean`类型的声明和这个变量给定的值是相符的。

在另一方面，如果你尝试这么来声明这个变量：

```
boolean result ＝ 123;
```
由于变量`result`有一个错误的类型，因此会编译失败。这里我们明确地声明了`result`是一个`boolean`类型，但是它却用整型值`123`赋给了它。

JavaScript和其他一些动态类型语言有着不同的处理方法，他们允许上下文环境来确定数据需要被定义为什么类型：

```
var result = true;
```
长话短说，静态类型语言需要你在能够使用这个变量之前定义它的类型。而动态类型语言则不同。JavaScript中变量类型是被“隐去”的，而Java中则是显式声明的。

类型检查将会确保并且强制使你的变量类型（constant, boolean, number, variable, array, object）和你已经定义和预期的内容相符。例如：你已经确定“这个方法总是会返回一个string型”。当程序运行的时候，你可以很安全地假设它会返回一个string型。

当出现一个类型错误时，静态类型检查和动态类型检查的差异就凸显出来了。在静态类型语言中，类型检查发生在编译阶段。在动态类型语言中，只有在程序运行了一次的时候错误才会被发现，也就是在运行时。

这就意味着，对于写动态类型语言的程序员而言，即使代码中包含了会在运行时阻止脚本正常运行的错误类型，这段代码也可以通过编译。

在另一方面，如果一个写静态语言的程序员写了一段包含了类型错误的代码，那么除非修复这个错误，否则会一直编译失败。

# A new era of JavaScript
因为JavaScript是一种动态类型语言，因此你可以定义各种变量、方法、对象而不需要声明它的类型。

```
var myString = "my string";

var myNumber = 777;

var myObject = {
  name: "Preethi",
  age: 26,
};

function add(x, y) {
  return x + y;
}
```
这非常方便，但有时确不是那么理想。这也就是为什么想[Flow](https://flow.org/)和[TypeScript](https://www.typescriptlang.org/)这样的工具最近开始走入人们的视野，带给JavaScript开发者使用静态类型的选择。

[Flow](https://flow.org/)时Facebook开发和发布的一个开源的静态类型检查库，它允许你逐渐地向你的JavaScript代码中添加类型。

[TypeScript](https://www.typescriptlang.org/)是一个会编译为JavaScript的超集（尽管它看起来几乎像一种新的静态类型语言），这意味着，它使用起来会感觉和JavaScript很像，并不难上手。

不论是使用上面哪种工具，当你想要使用类型时，你会明确告诉工具哪个（些）文件需要类型检查。对于TypeScript，你需要将`.js`文件拓展名改为`.ts`。对于Flow，你需要在文件的顶部引入一段标注`@flow`。

一旦你声明了想要对某一个文件进行类型检查，你需要使用他们各自的语法去定义类型。这两个工具的一个区别在于，Flow是一个类型“检查器”而不是一个编译器。TypeScript则是一个编译器。

我相信类似Flow和TypeScript这样的工具为JavaScript带来了一个跨世代的转变与提高。

下面我会从这四个部分来谈一谈“在javascript中进行静态类型检查”：
- 第一部分 [Flow语法的快速入门](http://www.jianshu.com/p/bda750e2d15e)
- 第二、三部分 [（通过详细的示例来阐述）静态类型的优缺点](http://www.jianshu.com/p/289b3c734a9f)
- 第四部分 [是否应该在JavaScript种使用静态类型呢？](http://www.jianshu.com/p/d23f93be8821)

注意我选择在例子中使用Flow而不是TypeScript是因为我比较熟悉它。你可以根据你自己的目的与场景选择一个对你来说合适的工具。TypeScript同样非常不错！

话不多说，开搞！

# 第一部分、Flow语法快速人们
为了要理解静态类型的优势和劣势，你首先需要通过使用Flow来对静态类型的语法有个基础的认识。如果你以前从来没用过静态类型，那么你可以需要花点时间来熟悉一下这种语法。

让我们先来看看如何在JavaScript基本类型（以及像数组、对象、函数等）上应用。

## boolean
下面这段代码描述了JavaScript中的`boolean`值

```
var isFetching: boolean = false;
```
注意，当你想要定义一个类型时，你需要用下面这种语法：
![image](/img/why-use-static-types-in-js/1_Z79CcJO6h4DO_xKJMdK9zg.png)

## number
这里指的是IEEE 754下的浮点型。不像许多其他的程序语言，JavaScript并不会定义不同的数值类型（例如interger、short、long和float points）。而是所有的数值类型都会被存储为双精度浮点数。因此，你只需要一种数据类型来定义所有的数值变量。

备注：数值型`number`包含了`Infinity`和`NaN`


```
var luckyNumber: number = 10;
var notSoLuckyNumber: number = NaN;
```

## string
下面是一个`string`类型

```
var myName: string = 'Preethi';
```

## null
下面是一个`null`数据类型

```
var data: null = null;
```

## void
在这里void描述的是JavaScript中`undefined`类型

```
var data: void = undefined;
```
注意要将`null`和`undefined`区别对待。如果你像下面这么写：

```
var data: void = null;

/*------------------------FLOW ERROR------------------------*/
20: var data: void = null                     
                     ^ null. This type is incompatible with
20: var data: void = null
              ^ undefined
```
由于`undefined`和`null`是不同的类型，而`void`类型应该属于`undefined`类型，因此Flow会抛出一个错误。

## Array
JavaScript中的数组类型。使用`Array<T>`这样的语法来定义一个数组，其中数组的元素类型为`T`。

```
var messages: Array<string> = ['hello', 'world', '!'];
```
注意上面的代码，用`string`替换了`T`，表示`messages`是一个字符串数组。

## Object
JavaScript中的对象类型。有几种不同的方式来为对象添加类型限制。

你可以添加类型来描述对象的格式：

```
var aboutMe: { name: string, age: number } = {
  name: 'Preethi',
  age: 26,
};
```
你可以用对象来作为Map，并给键和值都设置类型：

```
var namesAndCities: { [name: string]: string } = {
  Preethi: 'San Francisco',
  Vivian: 'Palo Alto',
};
```
你也可以仅仅定义一个对象为`Object`类型:

```
var someObject: Object = {};

someObject.name = {};
someObject.name.first = 'Preethi';
someObject.age = 26;
```
上面这段代码使你可以不受限制得设置对象的键和值，因此就类型检查而言，这种方式并没有增加太多的价值。

## any
正如字面意思，它可以代表任何类型。`any`类型一定程度上避免了类型检查，因此如非必要，尽量扁面使用这个类型。

```
var iCanBeAnything:any = 'LALA' + 2; // 'LALA2'
```
有一个场景下比较适用：当你使用了一个扩展了系统原型的外部类库（类似`Object.prototype`）。
例如，你使用的类库为`Object.prototype`扩展了一个叫`doSomething`的属性。

```
Object.prototype.someProperty('something');
```
你的代码很可能会报如下错误：

```
41:   Object.prototype.someProperty('something')
                       ^^^^^^ property `someProperty`. Property not found in
41:   Object.prototype.someProperty('something')
      ^^^^^^^^^^^^ Object
```
为了避免着各种情况，你可以使用`any`类型：

```
(Object.prototype: any).someProperty('something'); // No errors!
```

## Functions
给方法添加类型的最常见的用法是，为该方法的参数和返回值添加类型检查：

```
var calculateArea = (radius: number): number => {
  return 3.14 * radius * radius
};
```
你甚至可以给async方法和生成器（generator）添加类型：

```
async function amountExceedsPurchaseLimit(
  amount: number,
  getPurchaseLimit: () => Promise<number>
): Promise<boolean> {
  var limit = await getPurchaseLimit();

  return limit > amount;
}
```
这里可以关注一下，这段代码是如何将第二个参数`getPurchaseLimit`声明为一个返回`Promise`对象的函数的。同时，
`amountExceedsPurchaseLimit`方法本身被声明会返回一个`Promise`对象。

## 类型别名（Type alias）
类型别名（Type alias）是我最喜欢的一种用法。它允许你使用已有的类型（number,、string等）来组合成一个新的类型：

```
type PaymentMethod = {
  id: number,
  name: string,
  limit: number,
};
```
在上面这段代码中，我创建了一个叫作`PaymentMethod`的新类型，包含了`number`和`string`两种类型。

可以这样来使用`PaymentMethod`类型：

```
var myPaypal: PaymentMethod = {
  id: 123456,
  name: 'Preethi Paypal',
  limit: 10000,
};
```
通过给原始类型包裹一层新类型，你可以为它们创建一个新的类型别名。例如，创建`Name`和`Email`这两个类型别名：

```
type Name = string;
type Email = string;

var myName: Name = 'Preethi';
var myEmail: Email = 'iam.preethi.k@gmail.com';
```
这么做的话，可以清楚的表明，`Name`和`Email`是指代不同的事物，而不仅仅是一个字符串。由于`Name`和`Email`是不可互换的，这么做可以帮助你避免混淆它们。

## 泛型（Generics）
泛型是一种对类型本身进行抽象的方法。什么意思呢？看看下面的代码：

```
type GenericObject<T> = { key: T };

var numberT: GenericObject<number> = { key: 123 };
var stringT: GenericObject<string> = { key: "Preethi" };
var arrayT: GenericObject<Array<number>> = { key: [1, 2, 3] }
```
我为类型`T`创建了一个抽象的概念，你可以使用任何类型来代替`T`。对于`numberT`来说，`T`是`number`类型的；而对于`arrayT`来说，`T`是`Array<number>`类型的。

如果你是第一次接触这些类型，确实可能会有些晕。不过相关的入门介绍马上就要结束了。

## Maybe
`Maybe`类型允许我们声明一个包含`null`和`undefined`两个潜在类型的值。对于类型`T`又`T`、`null`和`undefined`三种类型，意味着一个变量可能是`T`、`null`和`undefined`三者之一。在类型定义前加上一个“?”就可以定义一个`Maybe`类型：

```
var message: ?string = null;
```
这段代码表示message是`string`类型、`null`或`undefined`。

你也可以用`Maybe`类型来表示一个对象属性可能是某种类型`T`或者`undefined`：

```
type Person = {
  firstName: string,
  middleInitial?: string,
  lastName: string,
};
```
通过将“?”放在属性名`middleInitial`之后，你可以表明这个对象时可选的。

## Disjoint unions（或操作）
这是创建你的数据模型的另一个强大的方法。当你的程序需要同时处理不同的数据类型，Disjoint unions会是一个很有用的方法。换句话说，根据环境的不同，数据的结构也会不同。

我们基于之前的泛型示例来拓展`PaymentMethod`类型。想象一种场景，在我们的一个应用中，包含了三类不同的支付方法。在这种情况下，你可以这么做：

```
type Paypal = { id: number, type: 'Paypal' };
type CreditCard = { id: number, type: 'CreditCard' };
type Bank = { id: number, type: 'Bank' };
```
你可以用disjoint union来定义`PaymentMethod`类型：

```
type PaymentMethod = Paypal | CreditCard | Bank;
```
现在支付方法将会是这三种类型中的一种。关于disjoint union，在第二部分将会有更多的例子。

除了上面所述之外，Flow还有一些其他特性有必要在这篇简介中提一下：

**1）类型推断（Type inference）：**可能的话Flow会使用类型推断的功能。当类型检查可以自动推断出一个表达式的数据类型时，类型推断就会介入进来。这个特性可以帮助避免过多的类型声明。

举个例子，你可以这么写：

```
/* @flow */

class Rectangle {
  width: number;
  height: number;

  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  circumference() {
    return (this.width * 2) + (this.height * 2)
  }

  area() {
    return this.width * this.height;
  }
}
```
即使这个类并没有类型，Flow依然可以进行一定的类型检查：

```
var rectangle = new Rectangle(10, 4);

var area: string = rectangle.area();

// Flow errors
100: var area: string = rectangle.area();
                        ^^^^^^^^^^^^^^^^ number. This type is incompatible with
100: var area: string = rectangle.area();
               ^^^^^^ string
```
在这里我尝试把`area`定义为`string`类型，但是在`Rectangle`类中，我们给`width`和`height`定义的类型时`number`类型。因此，基于`area`方法的定义，它只能返回一个`number`类型。即使我们有显式地给`area`方法定义类型，Flow还是可以捕获到这个错误。

需要注意的一点是，Flow的维护人员建议，如果你需要导出（export）类定义，为了在非本地上下文环境（context）下更容易找出错误原因，你最好还是要添加明确的类型定义。

**2）动态类型检查（Dynamic type tests）：**这个特性意味着，Flow有能力确定一个变量在运行时的类型，因此当进行静态类型检查使Flow也可以使用这个能力。当Flow抛出一个错误但是你需要让Flow相信你的代码是没有问题的时候，这个特性就显得很有用处。

在这里我不会更深入得讲解更多细节，因为这更多的是一个进阶的特性，针对这一点我希望能够单开一篇来介绍。但如果你想要了解更多，可以看看[这里](https://flowtype.org/docs/dynamic-type-tests.html)。

## 语法介绍结束
这一部分我们了解了非常多的内容。我希望这个总览性质的简介可以对你有帮助。如果你想要进一步探索，我推荐你可以深入地读一下[这些文档](https://flow.org/en/docs/)。

结束了语法的学习，我们可以进入下一个更有趣的部分 ==> [使用静态类型的优势与劣势](http://www.jianshu.com/p/289b3c734a9f)

原文：[Why use static types in JavaScript? (A 4-part primer on static typing with Flow)](https://medium.freecodecamp.com/why-use-static-types-in-javascript-part-1-8382da1e0adb)