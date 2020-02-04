---
title: 一篇全面的CSS布局学习指南 [译]
date: 2018-07-07 12:00:00
tags:
- CSS
- 指南
- 翻译
---

无论你是一个想要学习CSS布局的新手，还是一个比较有经验但想要进一步巩固与了解最新CSS布局知识的前端开发者，这篇指南都能帮你全面了解如今CSS布局发展的现状。

在过去的许多年中，正如翻天覆地的前端开发一般，CSS布局也产生了巨大的变化。现在我们有需要可选的CSS布局方式来开发我们的网站，这也就要求我们对这些方式作出选择。在这片文章里，我会介绍各种CSS布局的基本使用方式以及使用的目的。

如果你还是CSS方面的新手并且想要了解什么是最好的布局方法，这篇文章正式你所需要的；当然，如果你是一位比较有经验的开发者，想要了解一些关于CSS布局的最新知识，这篇文章也不容错过。当然，我不会将各类技术的细枝末节都放到这篇文章里（否则可以写一本书了），而是对各类技术做一个基本的概述，同时会给大家提供相关链接来进一步学习。

<!-- more -->

## 1. 正常文档流（Normal Flow）

如果你打开一个没有用任何CSS来改变页面布局的网页，那么网页元素就会排列在一个正常流（normal flow）之中。在正常流中，元素盒子（boxes）会基于文档的写作模式（writing mode）一个接一个地排列。这就意味着，如果你的写作模式是水平方向的（句子是从左到右或从右到左书写），正常流会垂直地一个接一个排列页面的块级元素。

当然，如果你是在一个垂直方向的写作模式下，句子是垂直方向书写的，所以块级元素会水平方法排列。

![Block and Inline Directions change with Writing Mode](/img/1645fd10965531f9.png)

正常流是一种最基础的布局：当你为文档应用了CSS、创建了某些CSS布局，你其实是让这些块做了一个正常文档流之外的“事”。

### 1.1. 通过页面结构来发挥正常文档流的优势

通过确保你书写的页面具有良好的页面结构（well-structured manner），你可以最大程度利用正常流所带来的优势。试想一下，如果浏览器中没有正常流，那么你创建的元素都会堆积在浏览器的右上角。这就意味着你必须指定所有的元素的布局方式。

有了正常流，即使CSS加载失败了，用户仍然能阅读你的页面内容；同时，一些不使用CSS的工具（例如一些阅读器）会按照元素在文档中的位置来读取页面内容。从 可用性（accessibility） 角度来看，这无疑是非常有帮助的，同时也让开发者轻松了一些。如果你的内容顺序和用户预期的阅读顺序一致，你就不需要为了将元素调整到正确的位置而进行大量的布局调整。当你继续读下去会发现，使用新的布局方式是如何让页面布局事半功倍的。

因此，在思考如何布局之前，你需要认真思考你的文档结构，以及你希望用户以何种顺序来阅读文档中的内容。

### 1.2. 脱离正常文档流

一旦你有了一个结构良好的页面，你就需要去决定如何利用它并将它变为我们需要的布局结构。这会涉及到 脱离正常文档流（moving away from normal flow），即本文后续的部分内容。我们有许多布局“利器”可以使用，其中第一个就是`float`，它是一个描述什么是脱离正常文档流的非常好的例子。

---

## 2. 浮动（Float）

浮动被用来将盒子（box）置于左侧或右侧，同时让内容环绕其展示。

要让一个元素进行浮动，需要为该元素设置一个值为`left`或`right`的`float`属性。默认值为`none`。

```css
.item {
    float: left
}
```

值得强调的是，当你使某个元素浮动并让文字环绕它时，内容的line box被截断了。如果你让一个元素浮动，同时为紧跟着的包含文本的元素设置一个背景色，你会发现背景色会出现在浮动元素下方。

![The background color on the content runs under the float](/img/1645fd10966db934.png)

如果你想要在浮动元素和环绕的文本之间创建边距，你需要给浮动元素设置外边距。在文本元素上设置外边距只会让其相对于容器缩进。例如在下面这个例子中，你就需要为左侧浮动的图片设置右边距和下边距。

![](/img/1645fd10966e8ee5.png)

```html
<div class="container">
  <div class="item"></div>
  <p>Pea horseradish azuki bean lettuce avocado asparagus okra. Kohlrabi radish okra azuki bean corn fava bean mustard tigernut jícama green bean celtuce. </p>
  <p>Grape silver beet  collard greens avocado quandong fennel gumbo black-eyed pea watercress potato tigernut corn groundnut. Chickweed okra pea winter purslane coriander yarrow sweet pepper radish garlic brussels sprout groundnut summer purslane earthnut pea tomato spring onion azuki bean gourd. Gumbo kakadu plum komatsuna black-eyed pea green bean zucchini gourd winter purslane silver beet rock melon radish asparagus spinach.</p>
</div>
```

```CSS
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
}

.item {
  width: 100px;
  height: 100px;
  float: left;
  margin: 0 20px 20px 0;
  background-color: rgba(111,41,97,.3);
}
```

### 2.1. 清除浮动

一旦你对一个元素应用了浮动，所有接下来的元素都会环绕它直到内容处于它下方且开始应用正常文档流。如果你想要避免这种情况，可以手动去清除浮动。

当你不想要某个元素受到其之前的浮动元素影响时，为其添加`clear`属性即可。使用`left`值可以清除左浮动效果，`right`值为右浮动，`both`则会清除左右浮动。

```css
.clear {
    clear: both;
}
```

但是，当你发现在容器内有了一个浮动元素，同时容器文本内容过短时就会出现问题。文本盒子会被绘制在浮动元素下，然后接下来的部分会以正常流绘制在其后。

![The box around the text does not clear the float](/img/1645fd10967f2208.png)


为了避免这种情况，我们需要为容器中某个元素应用`clear`属性。我们可以在容器最后添加一个空元素并设置`clear`属性。但是在某些情况下可能无法使用这种方式（例如一些CMS系统生成的页面）。因此，最常见的清除浮动的hack方案是：在容器内添加一个CSS伪元素，并将其`clear`属性设置为both。

```html
<div class="container">
  <div class="item"></div>
  <p>Pea horseradish azuki bean lettuce avocado asparagus okra.</p>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
}

.item {
  width: 100px;
  height: 100px;
  float: left;
  margin: 0 20px 20px 0;
  background-color: rgba(111,41,97,.3);
}

.container::after {
  content: "";
  display: table;
  clear: both;
}
```

![](/img/1645fd10968de015.png)

> example: [Smashing Guide to Layout: clearfix](https://codepen.io/rachelandrew/pen/jxJjje) on Codepen

### 2.2. 块级格式化上下文（Block Formatting Context）

清除浮动的另一个方法是在容器内创建BFC。一个BFC元素完全包裹住了它内部的所有元素，包括内部的浮动元素，保证浮动元素不会超出其底部。创建BFC的方式有很多种，其中最常用的一种清除浮动的方式是为元素设置除visible（默认）之外的`overflow`属性值。

```css
.container {
    overflow: auto;
}
```

像上面这样使用`overflow`一般情况下是有效的。然而，在某些情况下，这可能会带来一些阴影的截断或是非预期的滚动条。同时它也使你的CSS变得不那么直观：设置`overflow`是因为你想要展示滚动条还是仅仅为了获取清除浮动的能力呢？

为了使清除浮动的意图更加直观，并且避免BFC的负面影响，你可以使用`flow-root`作为`display`属性的值。`display: flow-root`做的唯一的一件事就是去创建一个BFC，因此可以避免其他创建BFC方法带来的问题。

```css
.container {
    display: flow-root;
}
```

### 2.3. 浮动的一些遗留用法

在新的布局方式出现以前，`float`经常会被用来创建多栏布局。我们会给一系列元素设置宽度并且将它们一个接一个进行浮动。通过为浮动元素设置一些精细的百分比大小可以创建类似网格的效果。

我不建议在当下仍然过度地使用这种方法。但是，在现有的网站中，这种方式仍然会存在许多年。因此，当你碰到一个页面里面到处是`float`的应用，可以确定它就是用的这种技术。

### 2.4. 关于浮动与清除浮动的其他阅读资料

- “[The Clearfix: Force an Element To Self-Clear its Children](https://css-tricks.com/snippets/css/clear-fix/),” Chris Coyier, CSS-Tricks
- “[float](https://developer.mozilla.org/en-US/docs/Web/CSS/float),” CSS: Cascading Style Sheets, MDN web docs
- “[clear](https://developer.mozilla.org/en-US/docs/Web/CSS/clear),” CSS: Cascading Style Sheets, MDN web docs
- “[Understanding CSS Layout And The Block Formatting Context](https://www.smashingmagazine.com/2017/12/understanding-css-layout-block-formatting-context/),” Rachel Andrew, Smashing Magazine

---

## 3. 定位（Positioning）

想要把一个元素从正常流中移除，或者改变其在正常文档流中的位置，可以使用CSS中的`position`属性。当处于正常文档流时，元素的`position`属性为`static`。在块级维度上元素会一个接一个排列下去，当你滚动页面时元素也会随着滚动。

当你改变元素的position属性时，通常情况下你也会设置一些偏移量来使元素相对于参照点进行一定的移动。不同的position值会产生不同的参照点。

### 3.1. 相对定位（relative postioning）

如果一个元素具有属性`position: relative`，那么它偏移的参照位是其原先在正常文档流中的位置。你可以使用top、left、bottom和right属性来相对其正常流位置进行移动。

```css
.item {
    position: relative;
    bottom: 50px;
}
```

注意，页面上的其他元素并不会因该元素的位置变化而受到影响。该元素在正常流中的位置会被保留，因此你需要自己去处理一些元素内容覆盖的情况。

```html
<div class="container">
  
  <p>Pea horseradish azuki bean lettuce avocado asparagus okra. Kohlrabi radish okra azuki bean corn fava bean mustard tigernut jícama green bean celtuce. </p>
  
  <div class="item"></div>
  <p>Grape silver beet  collard greens avocado quandong fennel gumbo black-eyed pea watercress potato tigernut corn groundnut. Chickweed okra pea winter purslane coriander yarrow sweet pepper radish garlic brussels sprout groundnut summer purslane earthnut pea tomato spring onion azuki bean gourd. Gumbo kakadu plum komatsuna black-eyed pea green bean zucchini gourd winter purslane silver beet rock melon radish asparagus spinach.</p>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
}

.item {
  width: 100px;
  height: 100px;
  background-color: rgba(111,41,97,.3);
  position: relative;
  bottom: 50px;
}
```

![](/img/1645fd1096a5574e.png)

> example: [Smashing Guide to Layout: position: relative](https://codepen.io/rachelandrew/pen/MGxNwd) on Codepen

### 3.2. 绝对定位（absolute postioning）

给一个元素设置`position: absolute`属性可以将其完全从正常流中移除。其原本占据的空间也会被移除。该元素会定位会相对于视口容器，除非其某个祖先元素也是定位元素（position值不为static）。

因此，当你为某个元素设置`position: absolute`时，首先发生的变化是该元素会定位在视口的左上角。你可以通过设置`top`、`left`、`bottom`和`right`偏移量属性来将元素移动到你想要的位置。

```css
.item {
    position: absolute;
    top: 20px;
    right: 20px;
}
```

通常情况下你并不希望元素相对于视口进行定位，而是相对于容器元素。在这种情况下，你需要为容器元素设置一个除了默认`static`之外的值。

由于给一个元素设置`position: relative`并不会将其从正常流中移除，所以通常这是一个不错的选择。给你想要相对的容器元素设置`position
: relative`，就可以让绝对定位的元素相对其进行偏移。

```html
<div class="container">
  
  <p>Pea horseradish azuki bean lettuce avocado asparagus okra. Kohlrabi radish okra azuki bean corn fava bean mustard tigernut jícama green bean celtuce. </p>
  
  <div class="item"></div>
  <p>Grape silver beet  collard greens avocado quandong fennel gumbo black-eyed pea watercress potato tigernut corn groundnut. Chickweed okra pea winter purslane coriander yarrow sweet pepper radish garlic brussels sprout groundnut summer purslane earthnut pea tomato spring onion azuki bean gourd. Gumbo kakadu plum komatsuna black-eyed pea green bean zucchini gourd winter purslane silver beet rock melon radish asparagus spinach.</p>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  position: relative;
}

.item {
  width: 100px;
  height: 100px;
  background-color: rgba(111,41,97,.3);
  position: absolute;
  top: 20px;
  left: 20px;
}
```

![](/img/1645fd10c4022eb6.png)

> example: [Smashing Guide to Layout: position: absolute](https://codepen.io/rachelandrew/pen/zjbgvx) on Codepen

### 3.3. 固定定位（fixed positioning）

大多数情况下，`position: fixed`的元素会相对于视口定位，并且会从正常文档流中被移除，不会保留它所占据的空间。当页面滚动时，固定的元素会留在相对于视口的位置，而其他正常流中的内容则和通常一样滚动。

```css
.item {
    position: fixed;
    top: 20px;
    left: 100px;
}
```

当你想要一个固定导航栏一直停留在屏幕上时这会非常有效。和其他的position值一样，这也可能会造成一些元素被遮挡，需要小心保证页面内容的可读而不会被固定元素遮挡。

```html
<div class="container">
  
  <p>Pea horseradish azuki bean lettuce avocado asparagus okra. Kohlrabi radish okra azuki bean corn fava bean mustard tigernut jícama green bean celtuce. </p>
  
  <div class="item"></div>
  <p>Grape silver beet  collard greens avocado quandong fennel gumbo black-eyed pea watercress potato tigernut corn groundnut. Chickweed okra pea winter purslane coriander yarrow sweet pepper radish garlic brussels sprout groundnut summer purslane earthnut pea tomato spring onion azuki bean gourd. Gumbo kakadu plum komatsuna black-eyed pea green bean zucchini gourd winter purslane silver beet rock melon radish asparagus spinach.</p>
  
   <p>Grape silver beet  collard greens avocado quandong fennel gumbo black-eyed pea watercress potato tigernut corn groundnut. Chickweed okra pea winter purslane coriander yarrow sweet pepper radish garlic brussels sprout groundnut summer purslane earthnut pea tomato spring onion azuki bean gourd. Gumbo kakadu plum komatsuna black-eyed pea green bean zucchini gourd winter purslane silver beet rock melon radish asparagus spinach.</p>
  
   <p>Grape silver beet  collard greens avocado quandong fennel gumbo black-eyed pea watercress potato tigernut corn groundnut. Chickweed okra pea winter purslane coriander yarrow sweet pepper radish garlic brussels sprout groundnut summer purslane earthnut pea tomato spring onion azuki bean gourd. Gumbo kakadu plum komatsuna black-eyed pea green bean zucchini gourd winter purslane silver beet rock melon radish asparagus spinach.</p>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  position: relative;
}

.item {
  width: 100px;
  height: 100px;
  background-color: rgba(111,41,97,.3);
  position: fixed;
  top: 20px;
  left: 20px;
}
```

![](/img/1645fd10c42778cd.png)

> example: [Smashing Guide to Layout: position: fixed](https://codepen.io/rachelandrew/pen/xjBvLE) on Codepen


为了使一个固定定位的元素不相对于视口进行定位，你需要为容器元素设置`transform`、`perspective`、`filter`三个属性之一（不为默认值none）。这样固定的元素就会相对于该块级元素偏移，而非视口。

### 3.4. STICKY 定位

设置`position: sticky`会让元素在页面滚动时如同在正常流中，但当其滚动到相对于视口的某个特定位置时就会固定在屏幕上，如同fixed一般。这个属性值是一个较新的CSS属性，在浏览器兼容性上会差一些，但在不兼容的浏览器中会被忽略并会退到正常的滚动情况。

```css
.item {
    position: sticky;
    top: 0;
}
```

下面的代码展示了如何创建一个非常流行导航栏效果：导航栏会随着页面滚动，而当导航栏滚动到页面顶部时则会固定在顶部位置。

```html
<div class="container">
  
  <p>Pea horseradish azuki bean lettuce avocado asparagus okra. Kohlrabi radish okra azuki bean corn fava bean mustard tigernut jícama green bean celtuce. </p>
  
  <div class="item"></div>
  <p>Grape silver beet  collard greens avocado quandong fennel gumbo black-eyed pea watercress potato tigernut corn groundnut. Chickweed okra pea winter purslane coriander yarrow sweet pepper radish garlic brussels sprout groundnut summer purslane earthnut pea tomato spring onion azuki bean gourd. Gumbo kakadu plum komatsuna black-eyed pea green bean zucchini gourd winter purslane silver beet rock melon radish asparagus spinach.</p>
  
   <p>Grape silver beet  collard greens avocado quandong fennel gumbo black-eyed pea watercress potato tigernut corn groundnut. Chickweed okra pea winter purslane coriander yarrow sweet pepper radish garlic brussels sprout groundnut summer purslane earthnut pea tomato spring onion azuki bean gourd. Gumbo kakadu plum komatsuna black-eyed pea green bean zucchini gourd winter purslane silver beet rock melon radish asparagus spinach.</p>
  
   <p>Grape silver beet  collard greens avocado quandong fennel gumbo black-eyed pea watercress potato tigernut corn groundnut. Chickweed okra pea winter purslane coriander yarrow sweet pepper radish garlic brussels sprout groundnut summer purslane earthnut pea tomato spring onion azuki bean gourd. Gumbo kakadu plum komatsuna black-eyed pea green bean zucchini gourd winter purslane silver beet rock melon radish asparagus spinach.</p>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  position: relative;
}

.item {
  width: 100px;
  height: 30px;
  background-color: rgba(111,41,97,.3);
  position: sticky;
  top: 0;
  width: 100%;
}
```

> example: [Smashing Guide to Layout: position: sticky](https://codepen.io/rachelandrew/pen/LmawOy) on Codepen

### 3.5. 关于定位（positioning）的其他阅读资料

- “[Positioning](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Positioning),” MDN Learning Area, MDN web docs, Mozilla
- “[position: sticky](https://css-tricks.com/position-sticky-2/);,” Chris Coyier, CSS-Tricks
- “[CSS position:sticky](https://caniuse.com/#feat=css-sticky),” Browser support information for sticky positioning, caniuse

---

## 4. 弹性布局（Flex Layout）

弹性盒子（Flexbox）布局是一种为一维布局而设计的布局方法。一维的意思是你希望内容是按行或者列来布局。你可以使用`display: flex`来将元素变为弹性布局。

```css
.container {
    display: flex;
}
```

该容器的直接子元素会变为弹性项（flex item），并按行排列。

```html
<div class="container">
  <div class="item">1</div>
  <div class="item">2</div>
  <div class="item">3</div>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  display: flex;
}

.item {
  width: 100px;
  height: 100px;
  padding: 10px;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}
```

![](/img/1645fd10c4105b96.png)

> example: [Smashing Guide to Layout: flex](https://codepen.io/rachelandrew/pen/RyObov) on Codepen

### 4.1. 弹性盒子的轴（axes）

在上面的例子中，我们会称弹性项在行内是从起始位置开始排列，而不是说它们是左对齐。这些元素会按行排列是因为默认的`flex-direction`值为`row`，`row`代表了文本的行文方向。由于我们工作的环境是英文（中文也是如此），一种自左向右的语言，行的开始位置就是在左边，因此我们的弹性项也是从左边开始的。因此`flex-direction`的值被定义为弹性盒子的主轴（main axis）。

交叉轴（cross axis）则是和主轴垂直的一条轴。如果你的`flex-direction`是`row`并且弹性项是按照行内方向排列的，那么交叉轴就是块级元素的排列方向。如果`flex-direction`是`column`那么弹性项就会以块级元素排列的方向排布，然后交叉轴就会变为`row`。

如果你习惯于从主轴与交叉轴的角度来使用弹性盒子，那么一切会变得非常简单。

### 4.2. 方向和次序

弹性盒子模型让我们可以通过为`flex-direction`属性设置`row-reverse`或`column-reverse`值来改变主轴上弹性项的方向。

```html
<div class="container">
  <div class="item">1</div>
  <div class="item">2</div>
  <div class="item">3</div>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  display: flex;
  flex-direction: row-reverse;
}

.item {
  width: 100px;
  height: 100px;
  padding: 10px;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}
```

![](/img/1645fd10ce900086.png)

> example: [Smashing Guide to Layout: flex-direction](https://codepen.io/rachelandrew/pen/zjXONE) on Codepen

当然，你也可以通过`order`属性来改变某一个弹性项的顺序。但是要特别注意，这可能会给那些通过键盘（而非鼠标或触屏）访问你的网站的用户带来一些麻烦，因为tab的顺序是页面内元素在源码中的顺序而非显示顺序。你可以阅读之后的“显示和文档顺序”部分来了解更多相关内容。

### 4.3. 一些Flex的属性

这些flex的属性是用来控制弹性项在主轴上空间大小的。这三个属性是：

- flex-grow
- flex-shrink
- flex-basis

通常可以使用它们的简写形式：`flex`。第一个值代表`flex-grow`，第二个是`flex-shrink`，而第三个则是`flex-basis`。

```css
.item {
    flex: 1 1 200px;
}
```

`flex-basis`会为弹性项设置未拉伸和压缩时的初始大小。在上面的例子中，大小是200px，因此我们会给每个项200px的空间大小。但是大多数情况下容器元素大小不会正好被分为许多200px大小的项，而是可能有一些不足或剩余空间。`flex-grow`和`flow-shrink`属性允许我们在容器大小不足或有空余时控制各个弹性项的大小。

如果`flex-grow`的值是任意的正数，那么弹性项会被允许拉伸来占据更多的空间。因此，在上面的例子中，当各项被设为200px后，所有多余的空间会被每个弹性项平分并填满。

如果`flex-shrink`的值为任意的正数，那么当弹性项被设置了`flex-basis`后，元素溢出容器时会进行收缩。在上面这个CSS的例子中，如果容器空间不足，每个弹性项会等比例缩放以适应容器的大小。

`flex-grow`和`flex-shrink`的值可以是任意的正数。一个具有较大`flex-grow`值的弹性项会在容器有剩余空间时拉伸更大的比例；而一个具有更大`flex-shrink`值的项则会在容器空间不足时被压缩的更多。

```html
<div class="container">
  <div class="item">1</div>
  <div class="item">2</div>
  <div class="item">3</div>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  display: flex;
}

.item {
  flex: 1 1 0;
  width: 100px;
  height: 100px;
  padding: 10px;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}

.container :first-child {
  flex: 2 1 0; 
}
```

![](/img/1645fd10d55eab80.png)

> example: [Smashing Guide to Layout: flex properties](https://codepen.io/rachelandrew/pen/rvbaRM) on Codepen

理解这些属性是理解如何使用弹性布局的关键，下面列出的一些资源会帮助我们进一步学习其中的细节。当你需要在容器的一个维度上拉伸或者压缩一些元素时，你可以考虑使用弹性盒子模型。如果你发现你正尝试在行和列两个维度上排列你的内容，你需要的是网格模型（grid），这时弹性盒子模型很可能不是最合适的工具了。

### 4.4. 关于弹性盒子布局的其他阅读资料

- “[CSS Flexible Box Layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout),” A complete guide to the specification, MDN web docs, Mozilla
- “[A Complete Guide to Flexbox](https://css-tricks.com/snippets/css/a-guide-to-flexbox/),” Chris Coyier, CSS-Tricks
- “[Flexbox Froggy](https://flexboxfroggy.com/),” A game for learning Flexbox
- “[Flexbugs](https://github.com/philipwalton/flexbugs),” A community curated list of browser bugs relating to Flexbox
- [Learn Flexbox for free - 12 interactive screencasts to take you from beginner to advanced](https://scrimba.com/g/gflexbox) from scrimba（译者荐）

---

## 5. 网格布局（grid layout）

CSS网格布局（grid layout）是一种用来进行二维布局的技术。二维（two-dimesional）意味着你希望按照行和列来排布你的内容。和弹性盒子类似，网格布局也需要设置一个`display`值。你可以为容器元素设置`display: grid`，并且使用`grid-template-columns`和`grid-template-rows`属性来控制网格中的行与列。

```css
.container {
    display: grid;
    grid-template-columns: 200px 200px 200px;
    grid-template-rows: 200px 200px;
}
```

上面这段CSS会创建一个行列元素大小固定的网格。不过这也许并不是你希望的。默认值为`auto`，你可以认为这代表了“让格子尽可能的大”。如果你每没有指定行（row track）的大小，所有添加进来的行内容大小都会被置为`auto`。一种常用的模式是为网格制定列宽度，但是允许网格按需添加行。

你可以使用任意的长度单位或时百分比来设置行与列，同时你可以使用为网格系统所创造的新的单位——`fr`。`fr`是一种弹性单位，它可以指定网格容器内的空间被如何划分。

网格会替你计算与分配空间，你不需要去计算元素的百分比去适应容器大小。在下面这个例子中，我们使用`fr`来创建网格的列，这使得网格的列可以自适应。同时我们还使用了`grid-gap`来保证元素间的间距（关于网格内元素与的间距会在“对齐”这一部分详细介绍）。

```html
<div class="container">
  <div>1</div>
  <div>2</div>
  <div>3</div>
  <div>4</div>
  <div>5<br>has more content.</div>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-gap: 20px;
}

.container > div {
  padding: 10px;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}
```

![](/img/1645fd10d760b18f.png)

> example: [Smashing Guide to Layout: a simple grid](https://codepen.io/rachelandrew/pen/erorKm) on Codepen


### 5.1. 关于网格的一些术语

网格系统总是有两个轴：inline axis表示页面中文字的文字排列的方向，block axis表示页面中块级元素的排列方向。

一个被设置为`display: grid`的元素就是所谓的网格容器。在网格容器中会有网格线（grid line），网格线就是你在指定`grid-template-columns`和`grid-template-rows`时网格中行列所生成的。网格中的最小单位（也就是被四条网格线截取生成的区域）被成为网格单元格（grid cell），进一步的，由若干个单元格组成的矩形区域被成为网格区域（grid area）。

![Grid Lines run between each track of the grid.](/img/1645fdc7e2d360d1.png)

![Grid Tracks are between any two lines](/img/1645fdcc9dec47b3.png)

![Grid cells are the smallest unit on the grid, a Grid Area is one or more cells together making a rectangular area](/img/1645fdd0fdacbfb7.png)

### 5.2. 网格的自动排列规则

一旦你创建了网格，那么网格容器的直接子元素就会开始将它们自己一个一个地放置在网格的单元格中。子元素的放置是依据网格的自动排列规则（auto-placement rule）。这些规则确保了网格内元素是被安排在各个空的单元格中，而不会彼此遮盖。

网格中任何没有被进行定位的直接子元素都会根据自动排列规则进行放置。在下面这个列子中，我让每三个元素中的第一个占据两行，但仍然从起始行开始去自动排列。

```html
<div class="container">
  <div>1</div>
  <div>2</div>
  <div>3</div>
  <div>4</div>
  <div>5</div>
  <div>6</div>
  <div>7</div>
  <div>8</div>
  <div>9</div>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-gap: 20px;
}

.container > div {
  padding: 10px;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}

.container > div:nth-child(3n+1) {
  grid-row-end: span 2;
  background-color: rgba(193,225,237,.3);
  border: 2px solid rgba(193,225,237,.5);
}
```

![](/img/1645fe43135e298f.png)

> example: [Smashing Guide to Layout: auto-placement](https://codepen.io/rachelandrew/pen/ZoZoqY) on Codepen

### 5.3. 基于行/列的基本定位方法

定位网格元素最简单的方式是使用基于行/列（line）的定位方法，只需告诉浏览器从哪一排到哪一排来进行合并。例如，如果你需要一个2*2的网格区域，你可以将指定元素从第一行开始到第三行、从第一列开始到第三列，这样就可以覆盖到四个单元格。

```css
.item {
    grid-column-start: 1;
    grid-column-end: 3;
    grid-row-start: 1;
    grid-row-end: 3;
}
```

这些属性可以用缩写来表示：`grid-column`和`grid-row`，其中起一个值代表起始值，第二个值代表结束值。

```css
.item {
    grid-column: 1 / 3;
    grid-row: 1 / 3;
}
```

你也可以让网格项（grid item）占据同一个单元格。支持一些内容间会覆盖的设计。网格项会像通常网页中的元素那样叠起来，在html源码中下面的网格项会叠在其他元素上面。你仍然可以用`z-index`来控制它的堆叠顺序。

```html
<div class="container">
  <div class="one">1</div>
  <div class="two">2</div>
  <div class="three">3</div>
  <div class="four">4</div>
  <div class="five">5</div>

</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-gap: 20px;
}

.container > div {
  padding: 10px;
}

.one {
  grid-column: 1 / 4;
  grid-row: 1;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}

.two {
  grid-column: 1 / 3;
  grid-row: 2;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}

.three {
  grid-column: 2 / 4;
  grid-row: 2 / 5;
  background-color: rgba(193,225,237,.3);
  border: 2px solid rgba(193,225,237,.5);
}

.four {
  grid-column: 1;
  grid-row: 4 ;
  background-color: rgba(193,225,237,.3);
  border: 2px solid rgba(193,225,237,.5);
}

.five {
  grid-column: 3 ;
  grid-row: 4 / 5;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}
```

![](/img/1645ff2d0ec568f3.png)

> example: [Smashing Guide to Layout: line-based placement](https://codepen.io/rachelandrew/pen/mLgLZj) on Codepen

### 5.4. 通过命名区域来定位元素

你可以通过命名区域（named areas）来定位网格中的元素。要是用这种方式，你需要给每个元素一个名字，然后通过`grid-template-areas`属性的值来描述布局方式。

```css
.item1 {
    grid-area: a;
}

.item2 {
    grid-area: b;
}

.item3 {
    grid-area: c;
}

.container {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    grid-template-areas: 
     "a a b b"
     "a a c c";
}
```

使用这种方式有几个需要注意的点。如果你想要合并一些单元格作为你的网格项，你需要重复元素的名字。网格区域需要能形成一个完整的矩形 —— 每个单元格都需要被填入一个值。如果你想要空出某些单元格，那就需要使用`.`这个值。例如在下面的CSS里我将最右下角的单元格留空。

```css
.container {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    grid-template-areas: 
     "a a b b"
     "a a c .";
}
```

你也可以通过下面这个demo的代码来看看实际的布局效果。

```html
<div class="container">
  <div class="one">1</div>
  <div class="two">2</div>
  <div class="three">3</div>
  <div class="four">4</div>
  <div class="five">5</div>

</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-auto-rows: minmax(50px, auto);
  grid-gap: 20px;
  grid-template-areas: 
    "a a a"
    "b c c"
    ". . d"
    "e e d"
}

.container > div {
  padding: 10px;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}

.one {
  grid-area: a;
}

.two {
  grid-area: b;
}

.three {
  grid-area: c;
}

.four {
  grid-area: d;
}

.five {
  grid-area: e;
}

```

![](/img/1645ffbcc1e79e99.png)

> example: [Smashing Guide to Layout: grid-template-areas](https://codepen.io/rachelandrew/pen/bMJKeX) on Codepen


### 5.5. 关于网格布局的其他阅读资料

这片文章只包括了CSS网格布局的一些初步内容，其中还有非常多的内容值得学习，下面的一些资料可以帮助你进一步学习。一些组件或整个页面的布局都可以使用网格。如果你需要在两个维度进行布局，网格布局是一个不错的选择 —— 不论需要布局的区域的大小。

- “[CSS Grid Layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout),” Web technology for developers, MDN web docs, Mozilla
- “[Grid by Example](https://gridbyexample.com/),” Everything you need to learn CSS Grid Layout, Rachel Andrew
- “[Grid Garden](https://cssgridgarden.com/),” A fun interactive game to test and improve your CSS skills
- “[Layout Land](https://www.youtube.com/channel/UC7TizprGknbDalbHplROtag),” Jen Simmons, YouTube
- [Learn CSS Grid for free - 14 interactive screencasts to take you from beginner to advanced](https://scrimba.com/g/gR8PTE) from scrimba（译者荐）

我（作者）在Smashing Magazine也写一些文章来帮助你深入理解各种网格的概念：

- “[Best Practices With CSS Grid Layout](https://www.smashingmagazine.com/2018/04/best-practices-grid-layout/)”
- “[Styling Empty Cells With Generated Content And CSS Grid Layout](https://www.smashingmagazine.com/2018/02/generated-content-grid-layout/)”
- “[Using CSS Grid: Supporting Browsers Without Grid](https://www.smashingmagazine.com/2017/11/css-grid-supporting-browsers-without-grid/)”
- “[CSS Grid Gotchas And Stumbling Blocks](https://www.smashingmagazine.com/2017/09/css-grid-gotchas-stumbling-blocks/)”
- “[Naming Things In CSS Grid Layout](https://www.smashingmagazine.com/2017/10/naming-things-css-grid-layout/)”

---

## 6. 显示顺序和文档顺序（visual and document order）

在文章的最开始，我建议你以从上到下的阅读顺序来组织你的文档顺序，这样会有助于可读性和CSS的布局方式。从我们关于弹性盒子和CSS网格的简短介绍来看，你可以发现用这些布局方法可能会极大地改变页面展示的元素在文档中的顺序。这可能会导致一个隐含的问题。

在一些非可视化的应用场景中，浏览器会遵循文档源码来进行使用。因此，屏幕阅读器会读取文档的顺序，此外使用键盘tab键来浏览的用户访问文档的顺序是基于源码的顺序，而不是元素展示的顺序。许多屏幕阅读器的用户并非完全失明，他们可能在使用屏幕阅读器的同时也能够看到这些元素在文档的哪个部分。在这些情况下，当与源码进行对比时，这种混乱的页面展现可能会令人充满迷惑。

当你改变了元素在文档中原来的顺序时，一定确保知道自己在做什么。如果你发现你自己正在CSS中重新排序你的元素，你应该去回头看看是否要重新组织你的页面元素。你可以通过使用tab访问来测试一下你的页面。

### 6.1. 关于显示顺序和文档顺序的其他阅读资料

- “[CSS Grid Layout and Accessibility](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout/CSS_Grid_Layout_and_Accessibility),” Web technology for developers, MDN web docs, Mozilla
- “[HTML Source Order vs CSS Display Order](http://adrianroselli.com/2015/10/html-source-order-vs-css-display-order.html),” Adrian Roselli
- “[Flexbox And The Keyboard Navigation Disconnect](https://tink.uk/flexbox-the-keyboard-navigation-disconnect/),” Code Things, Tink
- “[The Responsive Order Conflict For Keyboard Focus](https://alastairc.ac/2017/06/the-responsive-order-conflict/),” Alastair Campbell

---

## 7. 盒模型的生成（box generation）

你写在网页里的任何东西都会生成一个盒子（box），这篇文章讨论的所有东西其实都是如何能够使用CSS来按照你的设计布局这些盒子。然而，在某些情况下，你可能根本不想创建一个盒子。有两个`display`的属性值会帮你处理这种情况。

### 7.1. 不生成盒子或内容（`display: none`）

如果你希望元素以及它所有的内容（包括所有子元素）都不会生成，你可以使用`display: none`。这样元素就不会被展示，并且不会保留其本该占有的空间。

```css
.item {
    display: none;
}
```

### 7.2 不生成该元素，但是生成其所有子元素（`display: contents`）

`display: content`是`display`的一个新的属性值。为一个元素应用`display: content`属性会导致其自身的盒子不生成但所有的子元素都会照常生成。这有什么用呢？试想一下，如果你希望一个弹性布局或网格布局中的非直接子元素能应用这些布局，这就会非常有用。

在下面这个例子里，第一个弹性项包含了两个子元素，由于它被设为`display: contents`，它的盒子不会生成并且它的两个子元素会成为弹性项，并被当作弹性盒子容器的直接子元素来布局。

```html
<div class="container">
  <div class="item">
    <div class="subitem">A</div>
    <div class="subitem">B</div>
  </div>
  <div class="item">2</div>
  <div class="item">3</div>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  display: flex;
}

.item {
  flex: 1 1 200px;
  padding: 10px;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}

.subitem {
  padding: 10px;
  background-color: rgba(193,225,237,.3);
  border: 2px solid rgba(193,225,237,.5);
}

.container .item:first-child {
  display: contents;
}
```

![](/img/1646049946695d35.png)

> example: [Smashing Guide to Layout: display: contents](https://codepen.io/rachelandrew/pen/GdLBRR) on Codepen

### 7.3. 关于box generation的其他阅读资料

- “[Vanishing Boxes With display: contents](https://rachelandrew.co.uk/archives/2016/01/29/vanishing-boxes-with-display-contents/),” Rachel Andrew
- [How display: contents; Works](https://bitsofco.de/how-display-contents-works/),” Ire Aderinokun,
- [CSS display: contents](https://caniuse.com/#feat=css-display-contents),” Browser support information, caniuse

---

## 8. 对齐

在以前，要实现对齐往往会用到一些很"tricky"的方式，并且能够使用的方法也非常有限。随着CSS盒模型对齐（box alignment module）的出现，这一切都发生了变化。你将会使用它来控制网格容器与弹性盒子容器中的对齐。未来其他的各种布局方法都会应用这些对齐属性。盒模型对齐（box alignment specification）规范中的一系列详细属性如下：

- `justify-content`
- `align-content`
- `place-content`
- `justify-items`
- `align-items`
- `place-items`
- `justify-self`
- `align-self`
- `place-self`
- `row-gap`
- `column-gap`
- `gap`

由于不同的布局模型有不同的特性，因此用于不同布局模型的对齐属性会有一些表现上的差异。让我们来看看在一些简单的网格与弹性布局中对齐是如何工作的。

`align-items`和`justify-items`属性相对是`align-self`和`justify-self`属性的一种批量形式。这些属性会控制与元素在其网格区域（grid area）中的对齐情况。

```html
<div class="container">
  <div>1</div>
  <div>2</div>
  <div>3</div>
  <div>4</div>
  <div class="special">5</div>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-auto-rows: minmax(100px, auto);
  grid-gap: 20px;
  align-items: center;
  justify-items: start;
}

.special {
  grid-column: 2 / 4;
  align-self: end;
  justify-self: end;
}

.container > div {
  padding: 10px;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}
```

![](/img/164653c5e7a035d4.png)

> example: [Smashing Guide to Layout: Grid align-items, justify-items, align-self, justify-self](https://codepen.io/rachelandrew/pen/WJWKgd) on Codepen

`align-content`和`justify-content`属性则会对网格中的行/列（tracks）进行对齐控制（网格容器中需要在排列完行/列元素后有多余的空间）。

```html
<div class="container">
  <div>1</div>
  <div>2</div>
  <div>3</div>
  <div>4</div>
  <div>5</div>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  height: 300px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  display: grid;
  grid-template-columns: 100px 100px 100px;
  grid-auto-rows: minmax(100px, auto);
  grid-gap: 20px;
  align-content: space-between;
  justify-content: end;
}

.container > div {
  padding: 10px;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}
```

![](/img/1646547a0ff1dacb.png)

> example: [Smashing Guide to Layout: Grid align-content, justify-content](https://codepen.io/rachelandrew/pen/mLgGym) on Codepen

在弹性盒子中，`align-items`和`align-self`用来解决交叉轴上的对齐问题，而`justify-content`则用于解决主轴上空间的分配。

```html
<div class="container">
  <div>1</div>
  <div>2</div>
  <div class="special">3</div>
  <div>4</div>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  height: 300px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.special {
  align-self: stretch;
}

.container > div {
  padding: 10px;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}
```

![](/img/1646549cd671d30a.png)

> example: [Smashing Guide to Layout: Flex justify-content, align-items, align-self](https://codepen.io/rachelandrew/pen/ZoZMQZ) on Codepen

在交叉轴上，把弹性行（flex line）和额外空间包裹在弹性容器中之后，你就可以使用`align-content`了。

```html
<div class="container">
  <div>1</div>
  <div>2</div>
  <div>3</div>
  <div>4</div>
  <div>5</div>
</div>
```

```css
p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  height: 300px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  align-content: space-between;
}

.container > div {
  flex: 1 1 200px;
  padding: 10px;
  background-color: rgba(111,41,97,.3);
  border: 2px solid rgba(111,41,97,.5);
}
```

![](/img/1646550a7f945c10.png)

> example: [Smashing Guide to Layout: Flex align-content](https://codepen.io/rachelandrew/pen/QrPVjB) on Codepen

下面的一些链接更细节地讨论了各类布局方法中的盒模型对齐。花些时间去理解对齐的工作原理是非常值得的，它对理解弹性盒子、网格布局以及未来的一些布局方法都会很有帮助。

### 8.1. 行/列的间隔
一个多栏布局具有`column-gap`属性，到目前位置，网格布局具有`grid-column-gao`、`grid-row-gap`和`grid-grid`。这些现在都被从grid标准中删除而被添加进盒模型对齐中了。与此同时，`grid-`的前缀属性被重命名为`column-gap`、`row-gap`和`gap`。浏览器会将带有前缀的属性换为新的重命名属性，所以如果你在目前的代码中使用兼容性更好的老名字也不用担心。

重命名意味着这些属性也能被应用于其他布局方法，一个明显的备选就是弹性盒子。虽然目前没有浏览器支持盒子模型中的gap属性，但是在未来我们应该可以使用`column-gap`和`row-gap`来创建弹性项目元素间的间距。

### 8.2. 关于box generation的其他阅读资料

- “[CSS Box Alignment](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Box_Alignment),” CSS: Cascading Style Sheets, MDN web docs, Mozilla
- “[Box Alignment in Flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout/Box_Alignment_in_Flexbox),” CSS Flexible Box Layout, MDN web docs, Mozilla
- “[Box Alignment in CSS Grid Layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout/Box_Alignment_in_CSS_Grid_Layout),” CSS Grid Layout, MDN web docs, Mozilla
- “[The New Layout Standard For The Web: CSS Grid, Flexbox And Box Alignment](https://www.smashingmagazine.com/2016/11/css-grids-flexbox-box-alignment-new-layout-standard/),” Rachel Andrew, Smashing Magazine
- “[Box Alignment Cheatsheet](https://rachelandrew.co.uk/css/cheatsheets/box-alignment),” Rachel Andrew

---

## 9. 多栏布局（多列布局）

多栏布局（multi-column layout）是一种支持创建多栏的布局类型，如同报纸上那样。每一块都被分割成栏（column），你会按照块方向在栏中往下读然后会在回到下一栏的顶部。然而用这种方式阅读在网页内容中并不总是有效，因为人们并不想去让滚动条滚动来、滚动去地去阅读。当需要展示少部分内容、折叠一组复选框或者其他一些小的UI组件时会非常有用。

当展示一组高度不同的卡片或产品时多栏布局也非常有用。

### 9.1. 设置栏的宽度

要设置一个最有的栏宽，并通知浏览器依此宽度展示尽可能多的栏可以使用下面的CSS：

```css
.container {
    column-width: 300px;
}
```

这会创建尽可能多的300px的栏，所有剩下的空间会被所有栏共享。因此，除非空间被划分为300px时没有剩余，否则你的栏会比300px稍多一些。

### 9.2. 设置栏的数目

除了设置宽度，你可以使用`column-count`来设置栏的数目。在这种情况下，浏览器会将空间均分给你需要的数目的栏。

```css
.container {
    column-count: 3;
}
```

如果你同时添加了`column-width`和`column-count`，那么`column-count`属性会作为一个最大值限制。在下面的代码里，栏会被添加直到达到三个，此时任何额外的空间都会被分给三栏，即使空间足够成为一个额外的新栏。

```css
.container {
    column-width: 300px;
    column-count: 3;
}
```

### 9.3. 间距和栏规则

你无法为单个栏盒子添加外边距和内边距，需要用`column-gap`属性来设置间距。如果你不具体指定`column-gap`的值，它会默认为1em来防止栏间碰撞。这和其他布局方法中`column-gap`的行为不一样，其他布局中默认为0。你可以在间距上使用任意的长度单元，包括0（如果你不希望有栏间距）。

`column-rule`属性让你有能力向两栏间添加规则。它是`column-rule-width`、`column-rule-color`和`column-rule-style`的简写形式，可border行为类似。注意，一个规则自身不会占用任何空间。它会占据在间距的顶部，从而增加或减少那些你设置`column-gap`的规则与内容间的空间。

```html
<div class="container">
  <p>Pea horseradish azuki bean lettuce avocado asparagus okra. Kohlrabi radish okra azuki bean corn fava bean mustard tigernut jícama green bean celtuce. </p>
  <p>Grape silver beet  collard greens avocado quandong fennel gumbo black-eyed pea watercress potato tigernut corn groundnut. Chickweed okra pea winter purslane coriander yarrow sweet pepper radish garlic brussels sprout groundnut summer purslane earthnut pea tomato spring onion azuki bean gourd. Gumbo kakadu plum komatsuna black-eyed pea green bean zucchini gourd winter purslane silver beet rock melon radish asparagus spinach.</p>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  column-width: 120px;
  column-gap: 20px;
  column-rule: 4px dotted #000;
}
```

![](/img/164723a815c7d001.png)

> example: [Smashing Guide to Layout: multicol](https://codepen.io/rachelandrew/pen/ELJdOQ) on Codepen

### 9.4. 允许元素横跨多栏

你可以使用`column-span`属性让多栏容器内的元素横跨多栏，类似通栏。

```css
h3 {
    column-span: all;
}
```

当`column-span`出现时，多栏容器分栏会在这个元素上放停下，因此，容器里的内容会在元素上方形成多栏样式，然后在横跨元素（spanning element）的下方形成一组新的栏盒子（column box）。

```html
<div class="container">
  <p>Pea horseradish azuki bean lettuce avocado asparagus okra. Kohlrabi radish okra azuki bean corn fava bean mustard tigernut jícama green bean celtuce. </p>
  <h2>Veggies!</h2>
  <p>Grape silver beet  collard greens avocado quandong fennel gumbo black-eyed pea watercress potato tigernut corn groundnut. Chickweed okra pea winter purslane coriander yarrow sweet pepper radish garlic brussels sprout groundnut summer purslane earthnut pea tomato spring onion azuki bean gourd. </p>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  column-width: 120px;
  column-gap: 20px;
  column-rule: 4px dotted #000;
}

.container h2 {
  column-span: all;
  background-color: rgba(193,225,237,.6);
  border:2px solid rgba(193,225,237,.6);
  margin: 1em 0;
  padding: .5em;
}
```

![](/img/16472418608ef0d4.png)

> example: [Smashing Guide to Layout: multicol span](https://codepen.io/rachelandrew/pen/gzyBQV) on Codepen

你只可以使用`column-span: all`或`column-span: none`，并不能让元素横跨某几个栏（非通栏）。在文章写作时，Firefox还不支持`column-span`属性。

### 9.5. 关于多栏布局的其他阅读资料

- “[Using Multi-Column Layouts](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Columns/Using_multi-column_layouts),” CSS Multi-column Layout, MDN web docs, Mozilla

---

## 10. 碎片化（Fragmentation）

多栏布局是碎片化（fragmentation）的一个例子，页面内容会被拆分成栏。这和打印时内容被分到不同页非常类似。这个过程是碎片化规范（Fragmentation specification）处理的。这个规范包括了一些帮助控制内容切分的属性。

例如，如果你有一组置于多栏中的卡片，并且你想确保卡片不会被截为两半分到不同的栏，你可以使用`break-inside`属性的`avoid`值。考虑浏览器兼容性的因素，你也可能会想使用遗留的`page-break-inside`属性。

```css
.card {
    page-break-inside: avoid;
    break-inside: avoid;
}
```

如果你想在heading元素后禁止断行，你可以使用`break-after`属性。

```css
.container h2 {
    page-break-after: avoid;
    break-after: avoid;
}
```

这些属性可以被用在打印样式或多栏样式中。在下面的例子里，在多栏容器中的三个段落被拆分到了三栏之中。我为`p`元素设置了`break-inside: avoid`，这意味着每个多栏会在自己的栏中结束（即使这会使各栏长度不同）。

```html
<div class="container">
  <p>Pea horseradish azuki bean lettuce avocado asparagus okra. Kohlrabi radish okra azuki bean corn fava bean mustard tigernut jícama green bean celtuce. </p>
  <p>Grape silver beet  collard greens avocado quandong fennel gumbo black-eyed pea watercress potato tigernut corn groundnut. Chickweed okra pea winter purslane coriander yarrow sweet pepper radish garlic brussels sprout</p>
  
  <p>Groundnut summer purslane earthnut pea tomato spring onion azuki bean gourd. Gumbo kakadu plum komatsuna black-eyed pea green bean zucchini gourd winter purslane silver beet rock melon radish asparagus spinach.</p>
</div>
```

```css
body {
  padding: 20px;
  font: 1em Helvetica Neue, Helvetica, Arial, sans-serif;
}

* {box-sizing: border-box;}

p {
  margin: 0 0 1em 0;
}

.container {
  width: 500px;
  border: 5px solid rgb(111,41,97);
  border-radius: .5em;
  padding: 10px;
  column-width: 120px;
  column-gap: 20px;
  column-rule: 4px dotted #000;
}

.container p {
  page-break-inside: avoid;
  break-inside: avoid;
}
```

![](/img/164725a874c0a4bd.png)

> example: [Smashing Guide to Layout: multicol fragmentation](https://codepen.io/rachelandrew/pen/wjZYOK) on Codepen

### 10.1. 关于碎片化的其他阅读资料

- “[A Guide To The State Of Print Stylesheets In 2018](https://www.smashingmagazine.com/2018/05/print-stylesheets-in-2018/),” Rachel Andrew, Smashing Magazine
- “[Column Breaks](https://www.quirksmode.org/css/columns/breaks.html),” QuirksMode.org

---

## 11. 如何选择布局类型？

大多数的网页会混合使用多种布局类型。各布局规范都准确定义了它们之间是如何相互作用的。例如，你可能会在网格布局的网格项中使用弹性布局。一些弹性容器可能具有定位属性或浮动。这些规范根据最优的布局方式已经包含了布局模型的混合使用。在这篇指南中，我尝试概述了这种布局类型的基本使用方式，来帮助你了解实现一个效果可能的最好方法。

然而，别害怕去运用多种方式来实现布局设计。担心你的选择会不会造成实际问题的情况比你想象中要少很多。所以请在开始就组织好你的文档结构，并且注意你文档内容的可视展示顺序。剩下的大部分工作就是在浏览器中试试你的布局方式是否符合预期。

---

原文：[Getting Started With CSS Layout](https://www.smashingmagazine.com/2018/05/guide-css-layout/?utm_source=mybridge&utm_medium=blog&utm_campaign=read_more)，感谢作者Rachel Andrew。