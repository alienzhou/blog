---
title: webpack 中的 Local Scope
date: 2018-06-15 12:00:00
tags: CSS
---

CSS是一门几十分钟就能入门，但是却需要很长的时间才能掌握好的语言。它有着它自身的一些复杂性与局限性。其中非常重要的一点就是，本身不具备真正的模块化能力。

<!-- more -->

## 1. 面临的问题
你可能会说，CSS有`@import`功能。然而，我们都知道，这里的`@import`仅仅是表示引入相应的CSS文件，但其模块化核心问题并未解决——CSS文件中的任何一个选择器都会作用在整个文档范围里。

因此，其实我们面临的最大问题就是——所有的选择器都是在一个全局作用域内的。一旦引入一个新的CSS文件，就有着与预期不符的样式表现的风险（因为一些不可预测的选择器）。

而如今的前端项目规模越来越大，已经不是过去随便几个css、js文件就可以搞定的时代。与此同时的，对于一个大型的应用，前端开发团队往往也不再是一两个人。随着项目与团队规模的扩大，甚至是项目过程中人员的变动，如何更好进行代码开发的管理已经成为了一个重要问题。

回想一下，有多少次：
- 我们讨论着如何对class进行有效的命名，以避免协作开发时的冲突；
- 我们面对一段别人写的css、html代码，想要去修改，然后疯狂查找、猜测每个类都是什么作用，哪些是可以去掉的，哪些是可以修改的——到最后我们选择重新添加一个新的class；
- 我们准备重构代码时，重构也就成了重写
- ……

用CSS实现一些样式往往并不是最困难的所在，难的是使用一套合理的CSS架构来支持团队的合作与后续的维护。

> What we want is to be able to write code that is as transparent and self-documenting as possible. 

本系列文章会介绍一些业界在探索CSS模块化进程中提出的方案。再上一篇文章里我们介绍了[如何使用BEM和命名空间来规范与架构我们的CSS](https://juejin.im/post/5b20e8e0e51d4506c60e47f5)。这一篇文章主要介绍了，如何在webpack中使用一种类似“CSS模块化”的解决方案———Local Scope，来规避一些开发中的问题。

## 2. 什么是Local Scope
通常来说，CSS中的所有选择器可以算是“全局作用域”。而“Local Scope”顾名思义，使CSS具有类似于局部作用域的能力，同时搭配类似JavaScript中模块化的写法，到达CSS模块化的效果。

这么说可能有些抽象，我们可以来看一个例子。

在webpack中引入css往往是这样的：

```
// index.css
.title {
    font-size: 30px;
    color: #333;
}

// index.js
import './index.css';

funciont createTitle(str) {
    var title = document.createElement('h1');
    title.appendChild(document.createTextNode(str));
    title.setAttribute('class', 'title');
    document.body.appendChild(title);
}

createTitle('Hi!');
```

由于，webpack中将js、css、png等这些资源都视为模块，所以可以通过import导入。但是，实际上，对于导入的所有css，其“地位”都是平等的，都是在全局有效的。例如：

```
// index.css
.title {
    font-size: 30px;
    color: #333;
}

// other.css
.title {
    font-size: 15px;
    color: #999;
}

// index.js
import './index.css';
import './other.css';

funciont createTitle(str) {
    var title = document.createElement('h1');
    title.appendChild(document.createTextNode(str));
    title.setAttribute('class', 'title');
    document.body.appendChild(title);
}

createTitle('Hi!');
```

当我们引入了新的CSS文件other.css后，其中的`.title`和index.css中的`.title`有着同样的“作用域”——全局。

回想一下在JavaScript中：

```
// a.js
var a = 1;

// other.js
var a = 2;

// index.html
<script src="./a.js"></script>
<script src="./other.js"></script>
<script>
    console.log(a); // 2
</script>
```

如果某个html页面通过`script`标签引入这两js文件，那么a的值必定会有冲突，其中一个会被覆盖。如果使用模块化的方式，可以变成：

```javascript
// a.js
export var a = 1;

// other.js
export var a = 2;

// app.js
import {a} from './a';
import {a as other} from './other';

console.log(a); // 1
console.log(a); // 2
```

而所谓的Local Scope就是webpack中在CSS上针对这种问题的一个解决方案。类似JavaScript的模块化，通过对CSS文件进行模块引用与导出的方式，能够在开发时，更有效得控制各个class的作用范围。

## 3. 使用方法
首先，需要在webpack中对`css-loader`进行一定的配置。

```javascript
// loader: 'css-loader',
// options: {
//     modules: true,
//     localIdentName: '[local]__[name]--[hash:base64:5]'
// }
const config = {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js'
    },
    module: {
        rules: [{
            test: /\.css$/,
            use: [{
                loader: 'style-loader'
            }, {
                loader: 'css-loader',
                options: {
                    modules: true,
                    localIdentName: '[local]__[name]--[hash:base64:5]'
                }
            }]
        }]
    }
};
```

然后，我们还是使用前一节例子中的那个场景：

```
// index.css
:local .title {
    font-size: 30px;
    color: #333;
}

// other.css
:local .title {
    font-size: 15px;
    color: #999;
}

// index.js
import styles from './index.css';
import others from './other.css';

funciont createTitle(str) {
    var title = document.createElement('h1');
    title.appendChild(document.createTextNode(str));
    // styles.title  font-size: 30px;color: #333;
    title.setAttribute('class', styles.title);
    document.body.appendChild(title);
}

createTitle('Hi!');
```

其中需要注意的有三个地方：
- 第一个是在CSS文件中的，类选择器前多了`:local`这个语法。通过添加`:local`就可以指示webpack，这不是一个“全局”的选择器（当然，实际上也是全局的，后面会简单解释）。
- 第二个地方是在js文件中，将`import 'index.css'`变为了`import styles from './index.css'`。是不是看着很熟悉，没错，和JavaScript中的模块化方案用法一样。
- 第三个地方，在使用到该class的地方，由原来的`title.setAttribute('class', ‘title’)`变为了`title.setAttribute('class', styles.title)`。这样我们可以选择在一部分dom元素上使用`styles.title`，即`index.css`的样式；在另一部分dom元素上使用`other.css`的样式。

这样就解决了我们之前提到的问题。

当然，有些时候，我们希望类选择器中的某一部分仍然是“全局”的，那么我们可以这么写：

```css
:local .title :global(.sub-title) { color: #666; }
```

## 4. 关于Local Scope
虽然我们上面说了这么多次的“模块化”、“作用域”、“全局”，然而，实际上，对于CSS这门语言来说，它在自己本身的逻辑上是不具备这些特点的。而webpack中Local Scope的相关方案，其实也并不是（CSS本身逻辑支持的）真正意义上所谓的模块化。所以很多地方我都打上了引号。

如果对着打包后的页面，打开chrome控制台，会发现，我们的html是这个样子的

```
<body>
    <h1 class="title__index--330EV">Hi!</h1>
</body>
```

`h1`标签的`class`并不是我们在CSS中所写的`title`，而是一串奇怪的字符串`title__index--330EV`。

当使用webpack进行打包时，由于检查到`:local`这个语法，因此会为`.title`这个class生成一个新的class名称，而我们在js文件中所使用的`styles.title`对应的就是这个新的classname。

所以可以理解，其实当前的CSS语法逻辑中中并没有实际意义上所谓的local scope，但是，通过webpack打包时的操作，我们会为每个`:local`的class生成一个唯一的名称，而我们使用样式实际是指向了这个classname。这就实现了两个CSS文件中，相同名称的class在使用时就不会有冲突了，相当于避开了“全局作用域”。

如果打开打包后的`bundle.js`,我们可以发现一段很有趣的代码

```javascript
// ……其余省略
// exports
exports.locals = {
    "title": "title__index--330EV"
};

// ……其余省略
// exports
exports.locals = {
    "title": "title__other--3vRzX"
};
```

这是在两个不同的模块内的部分。上面一个就是导出的`index.css`中对应的classname，下面一个就是`other.css`的。通过`styles.title`就可以引用到`title__index--330EV`这个实际值。

最后，再来说一下`title__index--330EV`这个值得由来。在上一节的一开始，我们对webpack进行了配置，其中有一行

```javascript
localIdentName: '[local]__[name]--[hash:base64:5]'
```

其实就是指示了唯一标识的命名方式：`local`是class的名称，`name`是文件的名称，而最后加上`hash`值。当然，你完全可以使用其他你喜欢的方式。默认是使用`[hash:base64]`。

## 5. 写在最后
其实webpack中的CSS模块化方案Local Scope，粗浅的来说也是通过生成唯一的classname来避免冲突，控制作用范围。只是和BEM不同，BEM是一个建议标准，更多的还是人为的操控，而webpack中的Local Scope则提供了一个完整的模块化与打包方案。在一定程度上提高了开发的效率，降低了错误率。