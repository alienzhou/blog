---
title: 通过 JS 控制 input 框内光标位置
date: 2017-08-14 14:00:00
tags:
- JavaScript
- 浏览器
---

![](/img/input.jpg)

前段时间碰到一个需求：在表单中有一个字段叫金额，用户希望点击该输入框后（focus），能够自动为其金额数字后加上“万元”两个字。虽然这个需求可以通过其他的设计方式规避（例如在文本框后加入“万元”等），但是，既然碰到了问题，肯定还是希望能够研究一下技术解决方式。

对这个需求进行抽象，其实需要完成的任务就是：通过js来控制输入框内光标的位置。要完成这个任务，需要介绍一个input元素的方法： `HTMLInputElement.setSelectionRange()`

<!-- more -->

## setSelectionRange

### 介绍

[在MDN上可以找到setSelectionRange()的官方介绍。](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/setSelectionRange)其官方解释如下：
>The HTMLInputElement.setSelectionRange() method sets the start and end positions of the current text selection in an <input> element.

翻译过来就是：首先，setSelectionRange()方法是作用在input元素上的，其次，这个方法可以为当前元素内的文本设置备选中范围（selection）。简单来说，就是可以通过设置起始于终止位置，来选中一段文本中的一部分。值得一提的是，在新版中，该方法还接受一个可选参数，这个参数指定的选择的方向。

### 使用方式

其使用方式如下：
```javascript
inputElement.setSelectionRange(selectionStart, selectionEnd, [optional] selectionDirection);
```

 - **selectionStart**：第一个被选中的字符的序号（index），从0开始。
 - **selectionEnd**：被选中的最后一个字符的前一个。换句换说，不包括index为selectionEnd的字符。
 - **selectionDirection**：选择的方向。可选值为forward、backward或none。

来做一个简单的实例（[在线浏览](http://codepen.io/AlienZHOU/full/amzByz/)），当选中一个文本框时，文本框内的文字将会被选中。可以使用点击（click）输入框的方式，也可以使用tab切换焦点的方式，其效果如下：
![效果图](/img/set-selection-range/6476654-5c5b883ece246b51.png)
实现代码如下
**备注：本文中事件监听未使用兼容写法，读者可自行补全**

```java
<form>
  <label>这个input在focus时，内部文本会被选中</label>
  <input id="test" placeholder="万元" value="这是一段测试文本">
</form>
```

```css
body {
  background-color: #f6f6f6;
}

form {
  padding: 30px;
}

input {
  display: block;
  margin-top: 10px;
  padding: 10px;
  font-size: 15px;
  color: #333333;
  border: 1px solid #555555;
  border-radius: 5px;
}
```

```javascript
document.getElementById('test').addEventListener('focus', function() {
  changeCursorPos('test');
});

function changeCursorPos(inputId, pos) {
  var inpObj = document.getElementById(inputId);
  if (inpObj.setSelectionRange) {
    inpObj.setSelectionRange(0, inpObj.value.length);
  }
}
```
其中最重要的部分是

```javascript
inpObj.setSelectionRange(0, inpObj.value.length);
```
这段代码会从第一个字符开始，到最后一个字符结束，选中输入框内的所有内容。

### 兼容性

那么，这个方法的兼容性怎么样呢？

| Feature | Chrome | Edge | Firefox(Gecko) | Internet Explorer | Opera | Safari |
| ------------- | :-----: | :-----: | :-----: | :-----: | :-----: | :-----: |
| Basic support | 1.0 | (Yes) | 1.0 (1.7 or earlier) | 9 | 8.0 | (Yes) |
| selectionDirection | 15 | (Yes) | 8.0 (8.0) | ? | ? | (Yes) |

可以看到，对于基本的功能，主流浏览器的常用版本（及以上）都有着较好的支持，而selectionDirection作为附加功能，虽然兼容性一般，但是不会影响对于该方法的使用。因此，可以在一定的场景下可以放心使用`setSelectionRange()`。

## 控制光标位置

### 初步测试

以上介绍了inputElement.setSelectionRange()的含义与使用方式，然而，我的目标需求是控制输入框内的光标位置，而不是选中输入框内的部分文本。所以，上面介绍的这些和我的目标需求有关系么？
有。
回到上一部分的实例代码，我们可以将关键代码进行一定的修改
```javascript
inpObj.setSelectionRange(0, inpObj.value.length-1);//修改了selectionEnd的值
```
修改之后的结果如下
![这里写图片描述](/img/set-selection-range/6476654-444ef081d4722b1d.png)
可以明显看到，选中文本区域改变了。那么更进一步问自己一个问题，此时的光标实际停留的位置在哪——“文”字后面。因此，不难发现，代码成功将本该处于文本末端（"本"字后面）的光标，移动至了其前一个字符“文”的后方。通过设置不同的selection，js能够成功将光标设置在不同的字符后方（其实是selection选区的后方）。
有了这个结论，可以进一步猜想，如果将选区的范围设置为0，那么则不会有文字被选中，同时，还可以控制光标的所处位置。显然，这个就是能够满足我需求的点。
为了测试这个功能，我写了一个[简单的例子](http://codepen.io/AlienZHOU/full/QKwGJz/)。

代码如下

```html
<form>
  <label>这个input在focus时，光标会移动至文本的开头处</label><input id="test" placeholder="万元" value="这是一段测试文本">
</form>

```

```css
body {
  background-color: #f6f6f6;
}

form {
  padding: 30px;
}

input {
  display: block;
  margin-top: 10px;
  padding: 10px;
  font-size: 15px;
  color: #333333;
  border: 1px solid #555555;
  border-radius: 5px;
}
```

```javascript
document.getElementById('test').addEventListener('focus', function() {
  changeCursorPos('test')
});

function changeCursorPos(inputId, pos) {
  var inpObj = document.getElementById(inputId);
  if (inpObj.setSelectionRange) {
    inpObj.setSelectionRange(0, 0);
  }
}
```
测试浏览器firefox（chrome请使用tab来切换焦点，具体原因后半部分会进一步解释）。实现结果与预期一致，光标被定位在了文本的最前方。

### 实现

```html
<form>
  <label>自动添加“万元”单位的input</label>
  <input id="money" name="money" placeholder="万元">
</form>
```

```css
body {
  background-color: #f6f6f6;
}

form {
  padding: 30px;
}

input {
  display: block;
  margin-top: 10px;
  padding: 10px;
  font-size: 15px;
  color: #333333;
  border: 1px solid #555555;
  border-radius: 5px;
}
```

```javascript
document.getElementById('money').addEventListener('focus', function(e) {
  e.preventDefault();
  var val = this.value,
    len = val.length;
  if (val.indexOf('万元') !== -1) {
    pos = len - 2;
    changeCursorPos('money', pos);
  } else {
    $(this).val(val + '万元');
    pos = len;
    changeCursorPos('money', pos);
  }
});

function changeCursorPos(inputId, pos) {
  var inpObj = document.getElementById(inputId);
  if (inpObj.setSelectionRange) {
    inpObj.setSelectionRange(pos, pos);
  } else {
    console.log('不兼容该方法');
  }
}
```

## BUG fix

理论上来说，我已经完成了目标需求，在firefox下点击输入框或用tab、chrome下使用tab都可以实现功能。但是，我在上面也提到了，chrome中，只能使用tab，如果你用点击输入框的方式进行测试，会发现，这个方法失效了，光标仍然处于文本的末尾。
造成这个问题的原因是chrome存在的一个bug：[setSelectionRange() for input/textarea during onFocus fails when mouse clicks](https://bugs.chromium.org/p/chromium/issues/detail?id=32865)
这个bug似乎是由于chrome中默认的事件处理顺序引起的，有人提到
>WebKit and Blink handle tasks for mousedown in the following order:
 1. Focus
 2. Selection
The order looks reversed in other browsers

chrome默认的selection操作将会覆盖focus中的js操作代码。为了解决这个问题，第一个想到的就是阻止浏览器默认行为

```javascript
e.prevenDefault();
//return false;
```
然而，尝试之后发现，阻止浏览器默认行为在这个问题上并不生效。需要寻求其他方法。

### 最初的解决方法

解决这个问题的第一个思路就是，将`changeCursorPos()`这个方法的启动时间延迟，最好能够在浏览器默认行为之后。这个实现非阻塞有异曲同工之处，因此，可以使用定时器setTimeout来改变其在队列中的顺序

```javascript
setTimeout(function(){
	changeCursorPos('money', pos);
}, 0);
```
针对这个改动，只需要将原js代码中的
```javascript
changeCursorPos('money', pos);
```
全部替换为
```javascript
setTimeout(function(){
	changeCursorPos('money', pos);
}, 0);
```
其效果可以[在线观看](http://codepen.io/AlienZHOU/full/ALjOXK/)

然而，我在测试时发现，这个方法存在以下两个重要问题：

 - 效果较差。光标会先处于文本尾部，在跳至文本开头，对用户显示不友好。
 - 失效。更重要的问题是，即使使用setTimeout也不能保证将changeCursorPos操作最后执行，可以发现，在测试中，时常会出现其失效的情况。

### 解决失效问题

要解决失效问题，其实就是要保证将changeCursorPos的执行顺序添加至最后。需要了解，在鼠标点击与tab切换时，这两个操作之间的区别。

在tab切换时，相当于调用了`inputElement.focus()`，或者准确地说，在使用`setSelectionRange()`时两者的操作结果相同。而当使用鼠标点击选择输入框时，不仅会触发`focus`监听，还会触发一个`click`监听，而且通过测试可以发现，`click`事件触发晚于`focus`事件。

因此，如果在`click`监听中也添加`changeCursorPos`操作，就可以保证该操作不会被chrome的默认行为覆盖掉。

html与css不变，js代码如下

```javascript
//为input添加一个click监听，保证changeCursorPos在chrome默认focus事件之后执行
document.getElementById('money').addEventListener('click', function(e) {
  var val = this.value;
  var len = val.length;
  if (val.indexOf('万元') !== -1) {
    pos = len - 2;
    setTimeout(function() {
      changeCursorPos('money', pos);
    }, 0);
  }
  else {
    $(this).val(val + '万元');
    pos = len;
    setTimeout(function() {
      changeCursorPos('money', pos);
    }, 0);
  }
});

//保留focus监听，确保tab的正确使用
document.getElementById('money').addEventListener('focus', function(e) {
  var val = this.value;
  var len = val.length;
  if (val.indexOf('万元') !== -1) {
    pos = len - 2;
    setTimeout(function() {
      changeCursorPos('money', pos);
    }, 0);
  } else {
    $(this).val(val + '万元');
    pos = len;
    setTimeout(function() {
      changeCursorPos('money', pos);
    }, 0);
  }
});

function changeCursorPos(inputId, pos) {
  var inpObj = document.getElementById(inputId);
  if (inpObj.setSelectionRange) {
    inpObj.setSelectionRange(pos, pos);
  } else {
    console.log('不兼容该方法');
  }
}
```
[点击查看实例](http://codepen.io/AlienZHOU/full/kkYgkP/)

然而，再来看看之前碰到的两个问题：
> - 效果较差。光标会先处于文本尾部，在跳至文本开头，对用户显示不友好。
> - 失效。更重要的问题是，即使使用setTimeout也不能保证将changeCursorPos操作最后执行，可以发现，在测试中，时常会出现其失效的情况。

可见，上一部分代码已经解决了失效的问题，保证了功能的实现。然而，这个方案还不完美，其效果差的问题仍然没有解决。因此，还需要找一个更完美的实现方案。

### 最终的解决方案

最终的解决方案的思路如下：

 1. 通过文档的按键监听来判断是使用tab操作还是鼠标点击操作，并设置标志位
 2. 当触发focus监听时，判断操作方式，如果focus事件的来源为tab操作则转执行changeCursorPos，否则使其失去焦点
 3. 在click监听中手动触发focus事件，并将设置标志，模拟tab行为

代码如下

```html
<form>
  <label>解决chrome中点击input的bug的方案</label>
  <input id="exception" placeholder="exception">
  <input id="money" name="money" placeholder="万元">
</form>
```

```css
body {
  background-color: #f6f6f6;
}

form {
  padding: 30px;
}

input {
    display: block;
    margin-top: 10px;
    padding: 10px;
    font-size: 15px;
    color: #333333;
    border: 1px solid #555555;
    border-radius: 5px;
  }
```

```javascript
var tab = false;
document.addEventListener('keydown', function(e) {
  if (e.keyCode == 9) {
    tab = true;
  }
});
document.getElementById('exception').addEventListener('focus', function() {
  tab = false;
});
document.getElementById('money').addEventListener('click', function() {
  tab = true;
  this.focus();
});

document.getElementById('money').addEventListener('focus', function() {
  if (tab) {
    var val = this.value,
      len = val.length;
    if (val.indexOf('万元') !== -1) {
      pos = len - 2;
      setTimeout(function() {
        changeCursorPos('money', pos);
      }, 0);
    } else {
      $(this).val(val + '万元');
      pos = len;
      setTimeout(function() {
        changeCursorPos('money', pos);
      }, 0);
    }
  } else {
    this.blur();
  }
  tab = false;
});

function changeCursorPos(inputId, pos) {
  var inpObj = document.getElementById(inputId);
  if (inpObj.setSelectionRange) {
    inpObj.setSelectionRange(pos, pos);
  } else {
    console.log('不兼容该方法');
  }
}
```
[在线演示](http://codepen.io/AlienZHOU/full/wWKgwM/)

可以看到，在演示代码中，使用了`tab`变量作为标志，代码复用性较低，不太好，在实际项目中可以使用一些闭包或模块方式来进行处理，做成一个更加通用的功能。此处抛砖引玉，主要是展示实现的思路。

## 总结

`setSelectionRange()`方法可以帮助我们很容易的选中文本中的某一部分内容。同时，活用该方法也可以实现设置光标位置的功能。然而，chrome中存在的一个小bug导致该功能在鼠标点击时失效。文中研究了修复该bug的一些方法。然而作为抛砖引用，还是期待更多简便与解决方案。