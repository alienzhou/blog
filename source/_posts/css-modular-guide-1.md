---
title: 使用 BEM 与命名空间来规范 CSS
date: 2018-06-13 12:00:00
tags:
- CSS
- 指南
---

CSS是一门几十分钟就能入门，但是却需要很长的时间才能掌握好的语言。它有着它自身的一些复杂性与局限性。其中非常重要的一点就是，本身不具备真正的模块化能力。

<!-- more -->

## 1. 面临的问题
CSS中虽然有`@import`功能。然而，我们都知道，这里的`@import`仅仅是表示引入相应的CSS文件，但其模块化核心问题并未解决——CSS文件中的任何一个选择器都会作用在整个文档范围里。

因此，其实我们面临的最大问题就是——所有的选择器都是在一个全局作用域内的。一旦引入一个新的CSS文件，就有着与预期不符的样式表现的风险（因为一些不可预测的选择器）。

而如今的前端项目规模越来越大，已经不是过去随便几个css、js文件就可以搞定的时代。与此同时的，对于一个大型的应用，前端开发团队往往也不再是一两个人。随着项目与团队规模的扩大，甚至是项目过程中人员的变动，如何更好进行代码开发的管理已经成为了一个重要问题。

回想一下，有多少次：
- 我们讨论着如何对class进行有效的命名，以避免协作开发时的冲突；
- 我们面对一段别人写的css、html代码，想要去修改，然后疯狂查找、猜测每个类都是什么作用，哪些是可以去掉的，哪些是可以修改的——到最后我们选择重新添加一个新的class；
- 我们准备重构代码时，重构也就成了重写
- ……

用CSS实现一些样式往往并不是最困难的所在，难的是使用一套合理的CSS架构来支持团队的合作与后续的维护。

> What we want is to be able to write code that is as transparent and self-documenting as possible. 

本系列文章会介绍一些业界在探索CSS模块化进程中提出的方案。本篇主要会讲解BEM方法论，并将其与CSS命名空间结合。

## 2. BEM命名方法论

BEM其实是一种命名的规范。或者说是一种class书写方式的方法论（methodology）。BEM的意思就是块（block）、元素（element）、修饰符（modifier）,是由[Yandex](http://yandex.ru/)团队提出的一种前端命名方法论。在具体CSS类选择器上的表现就像下面这样

```css
.block {}
.block__element {}
.block--modifier {}
.block__element--modifier {}
```

其中，block表示的是独立的分块或组件；element表示每个block中更细粒度的元素；modifier则通常会用来表示该block或者element不同的类型和状态。

举个例子，例如我们有一个列表

```html
<ul class="list">
  <li class="item">learn html</li>
  <li class="item underline">learn css</li>
  <li class="item">learn js</li>
</ul>
```

列表容器的class为`.list`，列表内每条记录的class为`.item`，其中，还为第二个条记录添加了一个下划线`.underline`。简单的css如下

```css
.list {
  margin: 15px;
  padding: 0;
}
.list .item {
  margin: 10px 0;
  border-left: 3px solid #333;
  font-size: 15px;
  color: #333;
  list-style: none;
}
.list .underline {
  color: #111;
  text-decoration: underline;
}
```

这样的命名方式，我们在阅读html时并不能迅速了解：`.item`是只能在`.list`中使用么，它是仅仅定义在这个组件内的一部分么？`.underline`是一个通用样式么，我想修改列表的中underline的记录为红色，这会影响到项目其他地方么？

这时候，我们就可以使用BEM方式来命名我们的class

```css
.list {
  margin: 15px;
  padding: 0;
}
.list__item {
  margin: 10px 0;
  border-left: 3px solid #333;
  font-size: 15px;
  color: #333;
  list-style: none;
}
.list__item--underline {
  color: #111;
  text-decoration: underline;
}
```

```html
<ul class="list">
  <li class="list__item">learn html</li>
  <li class="list__item list__item--underline">learn css</li>
  <li class="list__item">learn js</li>
</ul>
```

这段代码的一大优势就是增加了它的自解释性：一定程度上，它的class名本身就是一个简易的文档。

这里还需要避免一个误区，BEM命名规范里，我们的CSS并不会关心HTML中dom元素的层级结构。它的核心着眼点还是我们定义的块（block）、元素（element）、修饰符（modifier）这三部分。因为关注点不同，所以一个block内的所有element，在CSS中并不会考虑层级，因此也就没有`.list__item__avatar`这种写法

```html
<ul class="list">
  <li class="list__item">
    ![](avatar.png)
    learn html
  </li>
  <li class="list__item list__item--underline">learn css</li>
  <li class="list__item">learn js</li>
</ul>
```

而是把这个`img`也看作block中的元素`.list__avatar`

```html
<ul class="list">
  <li class="list__item">
    ![](avatar.png)
    learn html
  </li>
  <li class="list__item list__item--underline">learn css</li>
  <li class="list__item">learn js</li>
</ul>
```

从这个例子看一看出，CSS部分并不关心dom层级结构，而是在block下面有哪些element，这些element又有哪些modifier。

基于这个思想，我们可以知道，如果一个block里面含有其他block并不会违反BEM的原则。例如上面这个列表的例子，其中头像avatar原本只是一个简单的element，现在如果变成了一个很复杂的组件——包括图片、姓名和标签，那么可能会有这么一个block

```html
<ul class="list">
  <li class="list__item">
    <div class="list__avatar">
      <img class="list__head list__head--female" />
      <span class="list__name"></span>
      <span class="list__tag"></span>
    </div>
    learn html
  </li>
  <li class="list__item list__item--underline">learn css</li>
  <li class="list__item">learn js</li>
</ul>
```

我们可以为avatar创建一个新的block

```html
<ul class="list">
  <li class="list__item">
    <div class="avatar">
      <img class="avatar__head avatar__head--female" />
      <span class="avatar__name"></span>
      <span class="avatar__tag"></span>
    </div>
    learn html
  </li>
  <li class="list__item list__item--underline">learn css</li>
  <li class="list__item">learn js</li>
</ul>
```

那么你可能会有疑问，什么时候需要在将一个elment重新抽象为新的block呢？仅仅当我们的dom元素变得很多的时候么？

其实，BEM中的block一定程度上可以理解为一个“独立的块”。独立就意味着，把这一部分放到其他部分也可以正常展示与使用，它不会依赖其父元素或兄弟元素。而在另一个维度上面来说，也就是视觉设计的维度，当UI设计师给出UI稿后，其中的一些设计元素或组件会重复出现，这些部分也是可以考虑的。所以理解UI设计稿并不是指简单的还原，其中的设计原则与规范也值得揣摩。

从上面的简单介绍可以看出，BEM有着一些优点

- class的单一职责原则、开闭原则
- 模块化思想，一般来说遵循这个方法的组件可以迁移环境
- 一定程度上，避免命名的污染
- 自解释性。可以直观看出各个class之间的依赖关系以及它们的作用范围（`.list__item`和`.list__item--underline`都是依赖于`.list`的，因此它们不能脱离于`.list`存在）

当然，BEM仅仅是一种命名规范或建议。在没有约束的情况下，你随时都可以违反。所以我们可以借助类似BEM-constructor的工具，既帮我们进行一定的约束，同时也省去一些繁琐的重复工作。在介绍BEM-constructor之前，我们还需要简单了解一下BEM-constructor中命名空间（namespaces）的基本概念。

## 3. 约定项目的命名空间（namespaces）

命名空间（namespaces）也是一种关于CSS中class命名方式的规范。[《More Transparent UI Code with Namespaces》](https://csswizardry.com/2015/03/more-transparent-ui-code-with-namespaces/)提供了一种命名空间的规范。在BEM的基础上，建立命名空间主要是为了进一步帮助我们：
- 让代码能够自解释
- 在一个全局的context中安全地加入一个新的class
- 确保一个修改不会产生额外的副作用
- 在后期维护时能够迅速定位问题

命名空间分为以下几种。

### Object: o-

当你使用面向对象的CSS（Object-Oriented CSS）时，`o-`这个namespace将会非常有用。

- 对象是一个抽象的概念。
- 尽量避免修改它们的样式。
- 如果要使用`o-`时请慎重考虑。

### Component: c-

`c-`应该是一个更为常见的namespace，表示Components（组件）。
```css
.c-list {}
.c-avatar {}
```
从命名中我们就能知道：这是一个list组件；或者这是一个avatar组件。

- Components应该是一组具体的UI。`c-`代表一个具体的组件。
- 修改它们非常安全，只会对组件产生影响。

### Utility: u-

Utilities符合单一职责原则，实现一个具体的功能或效果。其概念有些类似JavaScript中的通用工具方法。例如一个清除浮动的Utility，或者一个文字居中的Utility。
```css
.u-clearfix {}
.u-textCenter {}
```
由于Utilities作为一组工具集，在样式上具有更强的“话语权”，所以`!important`在Utilities中会更为常见。当我们看到下面这段HTML，我们会更加确信，这个大号的字体是`.u-largeFont`这个样式引起的。
```java
<h1 class="title u-largeFont">namespace</h1>
```

- Utilities中的样式一般具有更高的权重.
- 不要滥用`u-`前缀，只用在一些通用的工具方法上.

### Theme: t-

当我们使用Stateful Themes这种定义主题的方式时（后续有机会会介绍一些“自定义主题”的方式），往往我们会在最外层容器元素中加入一个代表不同主题的class。这里就会用到`t-`。

- 主题`t-`是一个高层级的命名空间。
- 一定程度上它和下面的Scope一样，也为其内部的规则提供了一个作用空间。
- 可以很明显地标识当前UI的总体状态（主题）。

### Scope: s-

`s-`可能不是这么好理解，因为CSS中并没有Scope这个概念（或者说只有一个全局的Scope）。而`s-`正是希望通过命名的方式来建立一个新的Scope。

但是请勿滥用它，只有在你确实需要创建一个新的“作用域”的时候再使用它。例如一个简单场景：CMS。如果你接触过CMS你就会知道，它一定有一个生成或编辑内容的功能。而通常的，我们会将这部分编辑的内容输出到页面中，并在外部赋予一个新的Scope，用以隔离该部分与外部整个站点的样式。

```html
<nav class="c-nav-primary">
  ...
</nav>

<section class="s-cms-content">
  <h1>...</h1>
  <p>...</p>
  <ul>
    ...
  </ul>
  <p>...</p>
</section>

<ul class="c-share-links">
  ...
</ul>
```

```css
.s-cms-content {
  font: 16px/1.5 serif; /* [1] */
  h1, h2, h3, h4, h5, h6 {
    font: bold 100%/1.5 sans-serif; /* [2] */
  }
  a {
    text-decoration: underline; /* [3] */
  }
}
```

`section`部分就是展示CMS中的content（内容）。

- 首先，用到Scopes的场景确实非常的少，因此你准备使用时一定要仔细考虑
- 它的实现是要依赖于嵌套方式的（SASS/LESS中），也可以说是CSS后代选择器

慎用，需要万分小心。

## 4. 在SASS中使用BEM-constructor

BEM-constructor是基于SASS的一个工具。使用BEM-constructor可以帮助规范并快速地创建符合BEM与namespace规范的class。BEM-constructor的语法非常简单。

```shell
npm install sass-bem-constructor --save-dev
```

首先在SASS引入`@import 'bem-constructor';`，然后使用`@include block($name, $type) { ... }`创建block，其中`$name`是block的名字，`$type`是namespace的类型（`'object'`, `'component'`和`'utility'`）。类似得，使用`element($name...)`和`modifier($name...)`可以快速生成block中的其他部分。

将最初的例子进行改写

```css
@import 'sass-bem-constructor/dist/_sass-bem-constructor.scss';

@include block('list', 'component') {
    margin: 15px;
    padding: 0;
    @include element('item') {
        margin: 10px 0;
        border-left: 3px solid #333;
        font-size: 15px;
        color: #333;
        list-style: none;
        @include modifier('underline') {
            color: #111;
            text-decoration: underline;
        }
    }
}
```

生成的内容如下

```css
.c-list {
  margin: 15px;
  padding: 0;
}
.c-list__item {
  margin: 10px 0;
  border-left: 3px solid #333;
  font-size: 15px;
  color: #333;
  list-style: none;
}
.c-list__item--underline {
  color: #111;
  text-decoration: underline;
}
```

BEM-constructor支持我们之前提到的各种命名空间。例如`theme($themes...)`，`scope($name)`等等。语法格式基本类似。

此外，如果不想使用namespace，也可以手动关闭

```css
$bem-use-namespaces: false; // defaults to true
```

同时也支持更改命名空间的前缀名

```css
$bem-block-namespaces: (
    'object': 'obj',     // defaults to 'o'
    'component': 'comp', // defaults to 'c'
    'utility': 'helper', // defaults to 'u'
);
```

当然，如果你不喜欢BEM中的`__`，`--`的连接线，也可以自定义

```css
$bem-element-separator: '-'; // Defaults to '__'
$bem-modifier-separator: '-_-_'; // Defaults to '--'
```

## 5. 写在最后

BEM和namespace是一种命名规范，或者说是一种使用建议。他的目的是帮助我们写出更易维护与协作的代码，更多的是在代码规范的层面上帮助我们解决CSS模块化中的问题。然而，也不得不承认，它距离我们梦想中的CSS模块化还有这很长的距离。但是无论如何，其中蕴含的一些组件化与CSS结构组织方式的想法也是值得我们去思考的。

## 参考资料

- [More Transparent UI Code with Namespaces](https://csswizardry.com/2015/03/more-transparent-ui-code-with-namespaces/)
- [BEM I (finally) understand](https://m.alphasights.com/bem-i-finally-understand-b0c74815d5b0)
- [BEMIT: Taking the BEM Naming Convention a Step Further](https://csswizardry.com/2015/08/bemit-taking-the-bem-naming-convention-a-step-further/)
- [Immutable CSS](https://csswizardry.com/2015/03/immutable-css/)
- [bem-constructor](https://github.com/danielguillan/bem-constructor)
- [Battling BEM – 5 common problems and how to avoid them](https://medium.com/fed-or-dead/battling-bem-5-common-problems-and-how-to-avoid-them-5bbd23dee319)

