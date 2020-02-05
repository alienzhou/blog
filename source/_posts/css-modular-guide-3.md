---
title: 使用 💅styled-components 进行 React 开发
date: 2018-06-15 14:00:00
tags: CSS
---

![](/img/styled-components.jpg)

CSS是一门几十分钟就能入门，但是却需要很长的时间才能掌握好的语言。它有着它自身的一些复杂性与局限性。其中非常重要的一点就是，本身不具备真正的模块化能力。💅styled-components 就是一种实现 CSS 模块化的 CSS in JS 方案。

<!-- more -->

## 1. 面临的问题
CSS中虽然有`@import`功能。然而，我们都知道，这里的`@import`仅仅是表示引入相应的CSS文件，但其模块化核心问题并未解决——CSS文件中的任何一个选择器都会作用在整个文档范围里。

而如今的前端项目规模越来越大，已经不是过去随便几个css、js文件就可以搞定的时代。与此同时的，对于一个大型的应用，前端开发团队往往也不再是一两个人。随着项目与团队规模的扩大，甚至是项目过程中人员的变动，如何更好进行代码开发的管理已经成为了一个重要问题。用CSS实现一些样式往往并不是最困难的所在，难的是使用一套合理的CSS架构来支持团队的合作与后续的维护。

> What we want is to be able to write code that is as transparent and self-documenting as possible. 

本系列文章会介绍一些业界在探索CSS模块化进程中提出的方案。在前两篇文章中，我介绍了[如果使用BEM与命名空间来规范与架构你的CSS](/2018/06/13/css-modular-guide-1/)以及[如何使用Webpack中的CSS modules](/2018/06/15/css-modular-guide-2/)。在这篇文章中，我会介绍styled-components这种CSS in JS方案，以及如何在React中使用。

## 2. styled-components是什么
随着React等前端技术的不断流行，组件化的思想开始受到越来越多的人重视。以组件为中心的开发思路使得各种 css-in-js 实践出现。

![](/img/16401f75d0bed9f5.png)

💅styled-components，就是这些方案中的一种。它既具备了 css-in-js 的模块化与参数化的优点，又完全使用CSS的书写习惯，不会引起额外的学习成本。这些优点都是它渐渐流行的原因。

如果你正在学习或使用React技术栈，就非常有必要了解一下💅styled-components了。接下来的部分，就会带着你迅速了解styled-components在React中的一些基本使用方式与使用场景。

> P.S. 最新版 (v3.1.0) 的styled-components在SSR上有了极大的性能提升: you can now use streaming server-side rendering with styled-components -- [v3.1.0: A massive performance boost and streaming server-side rendering support](https://medium.com/styled-components/v3-1-0-such-perf-wow-many-streams-c45c434dbd03)

## 3. 在react中使用styled-components
### 3.1. 基本用法
那么，如何在我们的react项目中使用styled-components呢？
官网上有一句话非常形象：
> It removes the mapping between components and styles. This means that **when you're defining your styles, you're actually creating a normal React component**, that has your styles attached to it.

简单来说，就是在你使用styled-components进行样式定义的同时，你也就创建了一个React组件。来先看一下它基本语法：

```javascript
import styled from 'styled-components';

const ListWrap = styled.ul`
    margin: 0;
    padding: 0;
`;

const Item = styled.li`
    margin: 10px 0;
    padding: 5px 15px;
    border-left: 3px solid #333;
    font-size: 16px;
    list-style: none;
    font-weight: bold;
`;
```

上面这段代码，其实就是定义了一个`li`元素的各种样式信息（边距、边框、字体等等）。是不是和直接在`.css`文件中直接写css很像？

注意，当我们将这个`styled`的`li`元素赋给了`Item`这个变量时，我们也就创建了一个叫`Item`的React组件。因此，我们可以在JSX中直接使用`Item`

```javascript
import React, {Component} from 'react';

export default class List extends Component {
    render() {
        return (
            <ListWrap>
                <Item>这是一条普通的记录</Item>
                <Item>这也是一条普通的记录</Item>
            </ListWrap>
        )
    }
}
```

![](/img/16401f75d1061a6b.png)

是不是非常方便？

如果你对ES6熟悉的话，也许已经发现了，在使用`styled`设置css样式的语法里，用到了模板字符串。因此，对于样式，我们完全可以加入变量计算。更进一步的，我们可以通过获取React组件的`props`来更改相应的css属性：

```javascript
const Item = styled.li`
    margin: 10px 0;
    padding: 5px 15px;
    border-left: 3px solid #333;
    font-size: 16px;
    list-style: none;
    font-weight: bold;
    text-decoration: ${props => props.underline ? 'underline' : 'none'};
`;

export default class List extends Component {
    render() {
        return (
            <ListWrap>
                <Item>这是一条普通的记录</Item>
                <Item>这也是一条普通的记录</Item>
                <Item underline>这条记录有一条下划线</Item>
            </ListWrap>
        )
    }
}
```

![](/img/16401f75d150a951.png)


这一语法也是styled-components工作的核心之一。原因在于，使用模板字符串时，下面这两行代码是等价的：

```javascript
func`I love ${some_lib} & styled-component`
func(['I love ',  '  & styled-component'], some_lib)
```

如果想具体了解，可以看文末的参考链接。

### 3.2. 扩展已有样式
有些时候，我们想要在已有的组件样式基础上，添加一些其他的样式属性，从而创建一个新的组件。

例如，对于上一节中的`Item`组件，我们想要在此基础上，创建一个红底白字的新Item样式，但是其他属性（字体、边距等）保持一致。使用styled-components的`styled`方法可以很容易实现：

```javascript
const RedItem = styled(Item)`
    color: #fff;
    background: #991302;
`;

export default class List extends Component {
    render() {
        return (
            <ListWrap>
                <Item>这是一条普通的记录</Item>
                <Item>这也是一条普通的记录</Item>
                <Item underline>这条记录有一条下划线</Item>
                <RedItem>这是一条红色的记录</RedItem>
            </ListWrap>
        )
    }
}
```

![](/img/16401f75d1469309.png)

是不是非常简单？这里需要一提的是，对于`styled.li`这种书写模式，实际上和`styled('li')`是等价的，只是一种方法的别名而已。

### 3.3. 样式继承
实际上，在styled-components中，对于组件的样式继承可以使用`extend`方法。因此，对于上一小节中的`RedItem`组件，我们也完全可以使用`extend`方法来实现：

```javascript
const RedItem = Item.extend`
    color: #fff;
    background: #991302;
`;
```

![](/img/16401f75d1374bb6.png)

在这个例子中，在css部分的代码是一样的。那么`extend`和`styled`两者有什么区别呢？官网上有一句话解释的非常清楚：
> The styled() factory **generates new component styles with a new class**. Calling extend creates new component styles by extending the old one, and thus **doesn't generate two classes for a single component**. (styled() factory does that)

怎么理解这句话呢？我们如果去审查页面元素，就会发现区别：
`styled`方法会创建一个新的类`.iVuaxi`来应用这两行样式，而Item本身的样式依旧存在于`.bWdYgn`类中；
而使用`extend`方法后则会在`.fYpJfw`类中实现所有的样式，并不会创建两个css类。
![](/img/16401f7659bb8714.png)

那么，什么时候使用`extend`方式，什么时候使用`styled`方式呢？styled-components官方推荐尽量去使用`extend`方式。当该react组件不是一个styled-components组件时，使用`styled`方式。

### 3.4.修改标签类型
除了需要继承组件样式外，有时候，我们可能想要更换该组件的HTML标签。例如按钮，我们已经有了一个button组件的样式，想要再创造一个一样的a标签按钮。这时候，我们就可以使用`withComponent`方法：

```javascript
// 使用withComponent方法修改标签类型
const DivItem = Item.withComponent('div');

export default class List extends Component {
    render() {
        return (
            <ListWrap>
                <Item>这是一条普通的记录</Item>
                <Item>这也是一条普通的记录</Item>
                <Item underline>这条记录有一条下划线</Item>
                <RedItem>这是一条红色的记录</RedItem>
                <ExtendedItem>这条记录使用了‘extend’</ExtendedItem>
                <DivItem>这实际上是个div </DivItem>
            </ListWrap>
        )
    }
}
```

![](/img/16401f765fcc94dc.png)

### 3.5. 添加动画keyframes
当然，styled-components作为一个组件样式方面的工具，肯定不会漏掉css3中的重要功能——动画。我们完全可以在使用styled-components创建的组件中，设置相应的css3动画。不过和之前稍有不同的是，我们还需要从styled-components库中导出一个`keyframes`方法。

下面，我们就来创建一个带有动画的Item。首先，使用keyframes方法创建css3动画

```javascript
import styled, {keyframes} from 'styled-components';

const MyAnimation = keyframes`
    from {
        padding-left: 0;
        background: #991302;
    }

    to {
        padding-left: 50px;
        background: #009317;
    }
`;
```

然后，使用继承的方式，创建一个带动画的组件

```javascript
const AnimateItem = RedItem.extend`
    animation: ${MyAnimation} 2s linear infinite alternate;
`;
```

![](/img/16401f7659c340eb.gif)

### 3.6. 全局样式
有些时候，在开发中需要设置一些全局的样式，这个该怎么处理呢？典型的，当我们想要为`body`元素设置一些属性时，该怎么办呢？

```HTML
<abbr>12312</abbr>
```

别担心，styled-components提供了`injectGlobal`方法来实现它。调用`injectGlobal`并不会返回一个组件，而是会将`injectGlobal`中的css相关样式直接添加到`<style>`标签内部。同样的，需要导出`injectGlobal`方法：

```javascript
import styled, {keyframes, injectGlobal} from 'styled-components';

injectGlobal`
    body {
        border: 5px solid #991302;
        background: #ddd;
    }
`;
```

![](/img/16401f766fa6d723.png)

如果我们去看页面输出的话，可以看到这一段样式：![](https://user-gold-cdn.xitu.io/2018/6/15/16401f767381a83f?w=679&h=66&f=png&s=22877)这就是我们设置全局样式后的输出。

## 4. 使用styled-components的一些优点

使用styled-components来进行React技术栈的开发有许多优势，这里总结了一篇[post](https://medium.com/@jamiedixon/styled-components-production-patterns-c22e24b1d896)里的一些观点：
1. 压缩你的样式代码（Compressed Styles）。使用styled-components可以有效简化部分样式的编写。
1. 写出更清爽的JSX代码（Clearer JSX）。![原先的JSX](/img/16401f767ed1bf08.png)![使用styled-components后的JSX](/img/16401f76734dc323.png)
2. 实现样式的组合与继承（Composing Styles）
3. 属性过滤（Prop filtering）。styled-components会通过白名单的方式过滤无效的属性。

## 5. 完善你的styled-components开发环境
### 5.1. vs code插件
工欲善其事，必先利其器。如果你使用vs code进行开发，可以很方便地安装styled-components插件：vscode-styled-components。该插件会进行语法与智能提示，提高我们的开发效率。![使用vscode-styled-components插件前](/img/16401f76848f1d65.png)![使用vscode-styled-components插件后](/img/16401f76a42d5ecd.png)

### 5.2. stylelint
如果你在使用styled-components的同时，也使用了stylelint来进行css检查，那么你很可能会遇到一些问题。因为styled-components会导致代码不符合某些检查规则。

为了解决这个问题，styled-components提供了一个叫stylelint-config-styled-components的包来调整stylelint中的某些规则检查。你可以在你的`.stylelintrc`文件中添加配置：`"processors": ["stylelint-processor-styled-components"]`。这样你就可以继续使用stylelint了。具体配置方式可以参考[这里](https://www.styled-components.com/docs/tooling#stylelint)。

## 参考资料

> 想了解CSS模块化相关内容，可以看看
> - [【CSS模块化之路1】使用BEM与命名空间来规范CSS](/2018/06/13/css-modular-guide-1/)
> - [【CSS模块化之路2】webpack中的Local Scope](/2018/06/15/css-modular-guide-2/)

如果你对文中提到一些点感兴趣，也可以在这里进一步阅读相关资料。

- [The magic behind 💅 styled-components](https://mxstbr.blog/2016/11/styled-components-magic-explained/): 介绍了模板字符串对styled-components的重要作用
- [💅 styled components 💅 — Production Patterns](https://medium.com/@jamiedixon/styled-components-production-patterns-c22e24b1d896): 使用styled components的一些优点
- [A 5-minute Intro to Styled Components](https://medium.freecodecamp.org/a-5-minute-intro-to-styled-components-41f40eb7cd55)
- [vs code下的💅styled-components插件](https://marketplace.visualstudio.com/items?itemName=jpoissonnier.vscode-styled-components)
- [v3.1.0: A massive performance boost and streaming server-side rendering support](https://medium.com/styled-components/v3-1-0-such-perf-wow-many-streams-c45c434dbd03)