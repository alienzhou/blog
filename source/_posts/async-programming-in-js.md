---
title: 玩转 JS 异步编程 —— “回调地狱”的各类解决方案
date: 2017-08-19 12:00:00
tags:
---

![](/img/tips.jpg)

异步编程在 JavaScript 中非常重要。

实现异步编程的最基本模式就是使用回调函数，然而过多的异步代码与异步流程也带了回调嵌套的问题。本文会介绍各类替代回调函数的技术方法，从而解决回调函数带来的“回调地狱”问题。

<!-- more -->

```javascript
setTimeout(function () {
    console.log('延时触发');
}, 2000);

fs.readFile('./sample.txt', 'utf-8', function (err, res) {
    console.log(res);
});
```
上面就是典型的回调函数，不论是在浏览器中，还是在node中，JavaScript本身是单线程，因此，为了应对一些单线程带来的问题，异步编程成为了JavaScript中非常重要的一部分。

不论是浏览器中最为常见的ajax、事件监听，还是node中文件读取、网络编程、数据库等操作，都离不开异步编程。在异步编程中，许多操作都会放在回调函数（callback）中。同步与异步的混杂、过多的回调嵌套都会使得代码变得难以理解与维护，这也是常受人诟病的地方。

先看下面这段代码
```javascript
fs.readFile('./sample.txt', 'utf-8', (err, content) => {
    let keyword = content.substring(0, 5);
    db.find(`select * from sample where kw = ${keyword}`, (err, res) => {
        get(`/sampleget?count=${res.length}`, data => {
           console.log(data);
        });
    });
});
```
首先我们读取的一个文件中的关键字`keyword`，然后根据该`keyword`进行数据库查询，最后依据查询结果请求数据。

其中包含了三个异步操作：
- 文件读取：fs.readFile
- 数据库查询：db.find
- http请求：get

可以看到，我们没增加一个异步请求，就会多添加一层回调函数的嵌套，这段代码中三个异步函数的嵌套已经开始使一段本可以语言明确的代码编程不易阅读与维护了。

抽象出来这种代码会变成下面这样：
```javascript
asyncFunc1(opt, (...args1) => {
    asyncFunc2(opt, (...args2) => {
        asyncFunc3(opt, (...args3) => {
            asyncFunc4(opt, (...args4) => {
                // some operation
            });
        });
    });
});
```
左侧明显出现了一个三角形的缩进区域，过多的回调也就让我们陷入“回调地狱”。接下来会介绍一些方法来规避回调地狱。

## 一、拆解function
回调嵌套所带来的一个重要问题就是代码不易阅读与维护。因为普遍来说，过多的缩进（嵌套）会极大的影响代码的可读性。基于这一点，可以进行一个最简单的优化——将各步拆解为单个的`function`
```javascript
function getData(count) {
    get(`/sampleget?count=${count}`, data => {
        console.log(data);
    });
}

function queryDB(kw) {
    db.find(`select * from sample where kw = ${kw}`, (err, res) => {
        getData(res.length);
    });
}

function readFile(filepath) {
    fs.readFile(filepath, 'utf-8', (err, content) => {
        let keyword = content.substring(0, 5);
        queryDB(keyword);
    });
}

readFile('./sample.txt');
```
可以看到，通过上面的改写方式，代码清晰了许多。该方法非常简单，具有一定的效果，但是缺少通用性。

## 二、事件发布/监听模式
如果在浏览器中写过事件监听`addEventListener`，那么你对这种事件发布/监听的模式一定不陌生。

借鉴这种思想，一方面，我们可以监听某一事件，当事件发生时，进行相应回调操作；另一方面，当某些操作完成后，通过发布事件触发回调。这样就可以将原本捆绑在一起的代码解耦。

```javascript
const events = require('events');
const eventEmitter = new events.EventEmitter();

eventEmitter.on('db', (err, kw) => {
    db.find(`select * from sample where kw = ${kw}`, (err, res) => {
        eventEmitter('get', res.length);
    });
});

eventEmitter.on('get', (err, count) => {
    get(`/sampleget?count=${count}`, data => {
        console.log(data);
    });
});

fs.readFile('./sample.txt', 'utf-8', (err, content) => {
    let keyword = content.substring(0, 5);
    eventEmitter. emit('db', keyword);
});
```
使用这种模式的实现需要一个事件发布/监听的库。上面代码中使用node原生的`events`模块，当然你可以使用任何你喜欢的库。

## 三、Promise
`Promise`是一种异步解决方案，最早由社区提出并实现，后来写进了es6规范。

目前一些主流的浏览器已经原生实现了`Promise`的API，可以在[Can I use](https://caniuse.com/#search=promise)里查看浏览器的支持情况。当然，如果想要做浏览器的兼容，可以考虑使用一些`Promise`的实现库，例如[bluebird](https://github.com/petkaantonov/bluebird)、 [Q](https://github.com/kriskowal/q)等。下面以bluebird为例：

首先，我们需要将异步方法改写为`Promise`，对于符合node规范的回调函数（第一个参数必须是Error），可以使用bluebird的`promisify`方法。该方法接收一个标准的异步方法并返回一个`Promise`对象。
```javascript
const bluebird = require('bluebird');
const fs = require("fs");
const readFile = bluebird.promisify(fs.readFile);
```
这样，`readFile`就变成了一个`Promise`对象。

但是，有的异步方法无法进行转换，或者我们需要使用原生`Promise`，这就需要我们手动进行一些改造。下面提供一种改造的方法。

以`fs.readFile`为例，借助原生`Promise`来改造该方法：
```javascript
const readFile = function (filepath) {
    let resolve,
        reject;
    let promise = new Promise((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });
    let deferred = {
        resolve,
        reject,
        promise
    };
    fs.readFile(filepath, 'utf-8', function (err, ...args) {
        if (err) {
            deferred.reject(err);
        }
        else {
            deferred.resolve(...args);
        }
    });
    return deferred.promise;
}
```
我们在方法中创建了一个`Promise`对象，并在异步回调中根据不同的情况使用`reject`与`resolve`来改变`Promise`对象的状态。该方法返回这个`Promise`对象。其他的一些异步方法也可以参照这种方式进行改造。

假设通过改造，`readFile`、`queryDB`与`getData`方法均会返回一个`Promise`对象。代码就变为了：
```javascript
readFile('./sample.txt').then(content => {
    let keyword = content.substring(0, 5);
    return queryDB(keyword);
}).then(res => {
    return getData(res.length);
}).then(data => {
    console.log(data);
}).catch(err => {
    console.warn(err);
});
```
可以看到，之前的嵌套操作编程了通过`then`连接的链式操作。代码的整洁度上有了一个较大的提高。

## 四、generator
`generator`是es6中的一个新的语法。在`function`关键字后添加*即可将函数变为`generator`。
```javascript
const gen = function* () {
    yield 1;
    yield 2;
    return 3;
}
```
执行`generator`将会返回一个遍历器对象，用于遍历`generator`内部的状态。
```javascript
let g = gen();
g.next(); // { value: 1, done: false }
g.next(); // { value: 2, done: false }
g.next(); // { value: 3, done: true }
g.next(); // { value: undefined, done: true }
```
可以看到，`generator`函数有一个最大的特点，可以在内部执行的过程中交出程序的控制权，`yield`相当于起到了一个暂停的作用；而当一定情况下，外部又将控制权再移交回来。

想象一下，我们用`generator`来封装代码，在异步任务处使用`yield`关键词，此时`generator`会将程序执行权交给其他代码，而在异步任务完成后，调用`next`方法来恢复`yield`下方代码的执行。以readFile为例，大致流程如下：
```javascript
// 我们的主任务——显示关键字
// 使用yield暂时中断下方代码执行
// yield后面为promise对象
const showKeyword = function* (filepath) {
    console.log('开始读取');
    let keyword = yield readFile(filepath);
    console.log(`关键字为${filepath}`);
}

// generator的流程控制
let gen = showKeyword();
let res = gen.next();
res.value.then(res => gen.next(res));
```
在主任务部分，原本`readFile`异步的部分变成了类似同步的写法，代码变得非常清晰。而在下半部分，则是对于什么时候需要移交回控制权给`generator`的流程控制。

然而，我们需要手动控制`generator`的流程，如果能够自动执行`generator`——在需要的时候自动移交控制权，那么会更加具有实用性。

为此，我们可以使用 [co](https://github.com/tj/co) 这个库。它可以是省去我们对于`generator`流程控制的代码
```javascript
const co = reuqire('co');
// 我们的主任务——显示关键字
// 使用yield暂时中断下方代码执行
// yield后面为promise对象
const showKeyword = function* (filepath) {
    console.log('开始读取');
    let keyword = yield readFile(filepath);
    console.log(`关键字为${filepath}`);
}

// 使用co
co(showKeyword);
```
其中，`yeild`关键字后面需要是`functio`, `promise`, `generator`, `array`或`object`。可以改写文章一开始的例子：
```javascript
const co = reuqire('co');

const task = function* (filepath) {
   let keyword = yield readFile(filepath);
   let count = yield queryDB(keyword);
   let data = yield getData(res.length);
   console.log(data);
});

co(task, './sample.txt');
```

## 五、async/await
可以看到，上面的方法虽然都在一定程度上解决了异步编程中回调带来的问题。然而
- function拆分的方式其实仅仅只是拆分代码块，时常会不利于后续维护；
- 事件发布/监听方式模糊了异步方法之间的流程关系；
- `Promise`虽然使得多个嵌套的异步调用能够通过链式的API进行操作，但是过多的`then`也增加了代码的冗余，也对阅读代码中各阶段的异步任务产生了一定干扰；
- 通过`generator`虽然能提供较好的语法结构，但是毕竟`generator`与`yield`的语境用在这里多少还有些不太贴切。

因此，这里再介绍一个方法，它就是es7中的async/await。

简单介绍一下async/await。基本上，任何一个函数都可以成为async函数，以下都是合法的书写形式：
```javascript
async function foo () {};
const foo = async function () {};
const foo = async () => {};
```
在`async`函数中可以使用`await`语句。`await`后一般是一个`Promise`对象。
```javascript
async function foo () {
    console.log('开始');
    let res = await post(data);
    console.log(`post已完成，结果为：${res}`);
};
```
当上面的函数执行到`await`时，可以简单理解为，函数挂起，等待`await`后的`Promise`返回，再执行下面的语句。

值得注意的是，这段异步操作的代码，看起来就像是“同步操作”。这就大大方便了异步代码的编写与阅读。下面改写我们的例子。
```javascript
const printData = async function (filepath) {
   let keyword = await readFile(filepath);
   let count = await queryDB(keyword);
   let data = await getData(res.length);
   console.log(data);
});

printData('./sample.txt');
```
可以看到，代码简洁清晰，异步代码也具有了“同步”代码的结构。

注意，其中`readFile`、`queryDB`与`getData`方法都需要返回一个`Promise`对象。这可以通过在第三部分`Promise`里提供的方式进行改写。

## 后记
异步编程作为JavaScript中的一部分，具有非常重要的位置，它帮助我们避免同步代码带来的线程阻塞的同时，也为编码与阅读带来了一定的困难。过多的回调嵌套很容易会让我们陷入“回调地狱”中，使代码变成一团乱麻。为了解决“回调地狱”，我们可以使用文中所述的这五种常用方法：
- function拆解
- 事件发布/订阅模式
- Promise
- Generator
- async / await

理解各类方法的原理与实现方式，了解其中利弊，可以帮助我们更好得进行异步编程。

----
Happy Coding！
----
----