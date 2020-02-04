---
title: (S)CSS中实现主题样式的4½种方式 [译]
date: 2018-12-12 12:00:00
tags:
- CSS
- 翻译
---

> 原Slides: [4½ Methods for Theming in (S)CSS](https://speakerdeck.com/csswizardry/4half-methods-for-theming-in-s-css)；作者: Harry Roberts

PM 说要实现一个一键设置主题的功能，作为技术，你能想到的实现方式有哪些呢？

<!-- more -->

## 1. 什么是主题样式？

相信大家对网页的主题样式功能肯定不陌生。对于一些站点，在基础样式上，开发者还会为用户提供多种主题样式以供选择。

下面就是一个主题样式功能：用户可以在右侧选择自己喜欢的主题色，从而得到一个“个性”的页面。


![](/img/1679e2f8c6f75eea.png)

还有时候，我们开发了一个系统用来售卖，采购我们系统的客户可能有多个。也许其中一个客户很喜欢我们当前的深色色系主题，但是另一个系统的采购方希望我们能为它们定制一套新的样式。他们希望买来的系统能贴合它们自己的品牌调性，变为浅色的。这其实也是一种主题样式的需求。


![](/img/1679e2fac347b63b.png)


在上面的讨论里，除了“主题”外，我们又引出了一个概念——个性化。经常，我们说到主题时，还会有一种说法叫做：个性化主题。这两者在英文中分别有两个对应的词： Theming 与 Customisation。

当我们说主题（Theming）与个性化定制（Customisation）的时候，很多时候其实并没有区分两者。但实际上，两者还是有一些微妙的区别的。

### 1.1. 主题 Theming 与个性化定制 Customisation 的区别

我们说的主题（Theming）与个性化定制（Customisation）的时候，还是有一些微妙的区别的。


#### 主题：由开发者定义

主要表现在：

- 系统的输入是由开发者定义的
- 一般来说具有有限的种类
- 具有已知的规则与常量

例如，我们常见的一些应用会提供夜间主题、阅读模式，这些也算是主题（Theming）的范畴。


#### 个性化定制：由用户定义

特点表现在：

- 系统的输入是由用户来提供
- 一般具有无限种可能
- 规则更灵活，用户“为所欲为”


可以看到，“个性化”其实更强调了用户对系统的的影响力。

很多时候，我们谈到“主题”与“个性化定制”时，也许并没有一个明确的边界。从上面的描述也可以看出，两者似乎是处于天平的两端，区别主要在于开发者对规则的控制力度以及所能实现的差异化的粒度。


![](/img/1679e2fd21633517.png)

而我们更多的是在两点之间找到一个平衡点。

### 1.2. 对实现“主题功能”的建议

我们已经对主题样式有了初步的了解，如果你也在产品中遇到了主题样式的相关需求，不妨先看看以下几点建议：

1. 尽可能避免这个功能。因为很多时候这可能只是个伪需求。
2. KISS原则（Keep It Simple, Stupid!）。尽可能降低其复杂性。
3. 尽量只去改变外观，而不要改动元素盒模型（box-model）。
4. 严格控制你的规则，避免预期外的差异。
5. 把它作为一个锦上添花的功能来向上促销（up-sell）。

## 2. 实现“主题样式”的方式

### 2.1. 方式一：Theme Layer

> Overriding default style with additional CSS.

这应该是实现主题功能的一种最常用的手段了。首先，我们的站点会有一个最初的基础样式（或者叫默认样式）；然后通过添加一些后续的额外的CSS来覆盖与重新定义部分样式。

#### 具体实现

首先，我们引入基础的样式 `components.*` 文件

```scss
@import "components.tabs";
@import "components.buttons"
```

其中 `components.tabs` 文件内容如下

```scss
.tab {
    margin: 0;
    padding: 0;
    background-color: gray;
}
```

然后，假设我们的某个主题的样式文件存放于 `theme.*` 文件：

对应于 `components.tabs`，`theme.tabs` 文件内容如下

```scss
.tab {
    background-color: red;
}
```

因此，我们只需要引入主题样式文件即可

```css
@import "components.tabs";
@import "components.buttons"

@import "theme.tabs";
```

这样当前的样式就变为了

```scss
.tab {
    margin: 0;
    padding: 0;
    /* background-color: gray; */
    background-color: red;
}
```

#### 优点

- 实现方式简单
- 可以实现将主题应用与所有元素

#### 缺点

- 过多的冗余代码
- 许多的CSS其实是无用的，浪费了带宽
- 把样式文件切分到许多文件中，更加琐碎

---

### 2.2. 方式二：Stateful Theming

> Styling a UI based on a state or condition.

该方式可以实现基于条件选择不同的主题皮肤，并允许用户在客户端随时切换主题。非常适合需要客户端样式切换功能，或者需要对站点某一部分（区域）进行独立样式设置的场景。

#### 具体实现

还是类似上一节中 Tab 的这个例子，我们可以将 Tab 部分的 (S)CSS 改为如下形式：

```scss
.tab {
    background-color: gray;
    
    .t-red & {
        background-color: red;
    }
    
    .t-blue & {
        background-color: blue;
    }
}
```

这里我们把`.t-red`与`.t-blue`称为 Tab 元素的上下文环境（context）。Tab 元素会根据 context 的不同展示出不同的样式。

最后我们给`body`元素加上这个开关

```html
<body class="t-red">
    <ul class="tabs">...</ul>
</body>
```

此时 Tab 的颜色为红色。

当我们将`t-red`改为`t-blue`时，Tab 就变为了蓝色主题。

进一步的，我们可以创建一些 (S)CSS 的 util class（工具类）来专门控制一些 CSS 属性，帮助我们更好地控制主题。例如我们使用如下的`.u-color-current`类来控制不同主题下的字体颜色

```scss
.u-color-current {
    .t-red & {
        color: red;
    }
    
    .t-blue & {
        color: blue;
    }
}
```

这样，当我们在不同主题上下文环境下使用`.u-color-current`时，就可以控制元素展示出不同主题的字体颜色

```html
<body class="t-red">
    <h1 class="page-title u-color-current">...</h1>
</body>
```

上面这段代码会控制`<h1>`元素字体颜色为红色主题时的颜色。

#### 优点

- 将许多主题放在了同一处代码中
- 非常适合主题切换的功能
- 非常适合站点局部的主题化
- 可以实现将主题应用于所有元素

#### 缺点

- 有时有点也是缺点，将许多主题混杂在了同一块代码中
- 可能会存在冗余

---

### 2.3. 方式三：Config Theming

> Invoking a theme based on settings.

这种方式其实是在开发侧来实现主题样式的区分与切换的。基于不同的配置，配合一些开发的自动化工具，我们可以在开发时期根据配置文件，编译生成不同主题的 CSS 文件。

它一般会结合使用一些 CSS 预处理器，可以对不同的 UI 元素进行主题分离，并且向客户端直接提供主题样式下最终的 CSS。

#### 具体实现

我们还是以 Sass 为例：

首先会有一份 Sass 的配置文件，例如`settings.config.scss`，在这份配置中定义当前的主题值以及一些其他变量

```scss
$theme: red;
```

然后对于一个 Tab 组件，我们这么来写它的 Sass 文件

```scss
.tab {
    margin: 0;
    padding: 0;
    
    @if ($theme == red) {
        background-color: red;
    } @else {
        background-color: gray;
    }
}
```

这时，我们在其之前引入相应的配置文件后

```scss
@import "settings.config";
@import "components.tabs";
```

Tab 组件就会呈现出红色主题。

当然，我们也可以把我们的`settings.config.scss`做的更健壮与易扩展一些

```scss
$config: (
    theme: red,
    env: dev,
)

// 从$config中获取相应的配置变量
@function config($key) {
    @return map-get($config, $key);
}
```

与之前相比，这时候使用起来只需要进行一些小的修改，将直接使用`theme`变量改为调用`config`方法

```scss
.tab {
    margin: 0;
    padding: 0;
    
    @if (config(theme) == red) {
        background-color: red;
    } @else {
        background-color: gray;
    }
}
```

#### 优点

- 访问网站时，只会传输所需的 CSS，节省带宽
- 将主题的控制位置放在了一个地方（例如上例中的`settings.config.scss`文件）
- 可以实现将主题应用于所有元素

#### 缺点

- 在 Sass 中会有非常多逻辑代码
- 只支持有限数量的主题
- 主题相关的信息会遍布代码库中
- 添加一个新主题会非常费劲

---

### 2.4. 方式四：Theme Palettes

> Holding entire themes in a palette file.

这种方式有些类似于我们绘图时，预设了一个调色板（palette），然后使用的颜色都从其中取出一样。

在实现主题功能时，我们也会有一个类似的“调色板”，其中定义了主题所需要的各种属性值，之后再将这些信息注入到项目中。

当你经常需要为客户端提供完全的定制化主题，并且经常希望更新或添加主题时，这种模式会是一个不错的选择。

#### 具体实现

在方式三中，我们在一个独立的配置文件中设置了一些“环境”变量，来标示当前所处的主题。而在方式四中，我们会更进一步，抽取出一个专门的 palette 文件，用于存放不同主题的变量信息。

例如，现在我们有一个`settings.palette.red.scss`文件

```scss
$color: red;
$color-tabs-background: $color-red;
```

然后我们的`components.tabs.scss`文件内容如下

```css
.tabs {
    margin: 0;
    padding: 0;
    backgroung-color: $color-tabs-background;
}
```

这时候，我们只需要引入这两个文件即可

```css
@import "settings.palette.red";
@import "components.tabs";
```

可以看到，`components.tabs.scss`中并没有关于主题的逻辑判断，我们只需要专注于编辑样式，剩下就是选择所需的主题调色板（palette）即可。

#### 优点

- 编译出来的样式代码无冗余
- 非常适合做一些定制化主题，例如一个公司采购了你们的系统，你可以很方便实现一个该公司的主题
- 可以从一个文件中完全重制出你需要的主题样式

#### 缺点

- 由于主要通过设定不同变量，所以代码确定后，能实现的修改范围会是有限的

---

### 2.5. 方式五：用户定制化 User Customisation

> Letting users style their own UIs.

这种模式一般会提供一个个性化配置与管理界面，让用户能自己定义页面的展示样式。

“用户定制化”在社交媒体产品、SaaS 平台或者是 Brandable Software 中最为常见。

#### 具体实现

要实现定制化，可以结合方式二中提到的 util class。

首先，页面中支持自定义的元素会被预先添加 util class，例如 Tab 元素中的`u-user-color-background`

```html
<ul class="tabs u-user-color-background">...</ul>
```

此时，`u-user-color-background`还并未定义任何样式。而当用户输入了一个背景色时，我们会创建一个`<style>`标签，并将 hex 值注入其中

```html
<style id="my-custom">
    .u-user-color-background {
        background-color: #00ffff;
    }
</style>
```

这时用户就得到了一个红色的 Tab。

Twitter 就是使用这种方式来实现用户定制化的界面样式的：


![](/img/1679e300d854a05e.png)

#### 优点

- 不需要开发人员的输入信息（是用户定义的）
- 允许用户拥有自己“独一无二”的站点
- 非常实用

#### 缺点

- 不需要开发人员的输入信息也意味着你需要处理更多的“不可控”情况
- 会有许多的冗余
- 会浪费 CSS 的带宽
- 失去部分 CSS 的浏览器缓存能力

---

## 3. 如何选择方案？

最后来聊聊方案的选择。

在第二部分我们已经了解了五种实现方式（或者说4½种方法，因为第五种其实更偏个性化定制一些），那么面对产品需求，我们应该如何选择呢？

这里有一个不是非常严谨的方式可以参考。你可以通过尝试问自己下面这几个问题来做出决定：

- **是你还是用户谁来确定样式？**
用户：选择【方式五】User Customisation

- **主题是否会在客户端中被切换？**
是：选择【方式二】Stateful Theming 或【方式五】User Customisation

- **是否有主题能让用户切换？**
是：选择【方式二】Stateful Theming

- **你是希望网站的某些部分需要有不同么？**
是：选择【方式二】Stateful Theming

- **是否有预设的主题让客户端来选择？**
是：选择【方式三】Config Theming

- **是否是类似“贴牌”这类场景？**
是：选择【方式一】Theme Layer 或【方式四】Theme Palettes


