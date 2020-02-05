---
title: 基于Gulp的多页面应用实践指南
date: 2017-10-15 13:00:00
tags:
- Gulp
- 前端工程化
- 自动化工具
---

![](/img/automatic-tool-flow.jpg)

基于 Gulp.js 来封装一套自己的前端自动化工作流，实现多页面应用的自动化构建。

<!-- more -->

## 1. 什么是多页应用
相信很多人都知道单页面应用SPA（single page web application），那么与其相对的就是多页面应用，或者说是这种更为传统的站点——通过后端路由控制，访问不同url会由服务器吐出不同的页面与页面资源。由于SEO等一些因素，这种多页面的应用（或者说是站点更合适）如今仍然是一种非常重要的形式。

由于近期的项目形态就是这样的，而在项目中最后选择使用了gulp作为自动化工具，但是网上的各类相关博文都比较零碎，不够系统；同时在实际应用中尤其是多页面站点中遇到的一些问题也没有特别好的实践，因此，将项目中遇到的问题和解决方案整理了一下。

同时，借着项目中碰到的问题，也读了gulp及其一些相关库的源码，之后也会考虑写一些短文来进行交流。

## 2. 什么是Gulp

相信大家对Gulp应该不会太陌生，用一句Gulp官方的话来说：

> Gulp就是基于流的前端自动化构建工具

如果你完全不了解gulp，建议可以先简单浏览一下[gulp的官网](https://gulpjs.com/)

> gulp是前端开发过程中对代码进行构建的工具，是自动化项目的构建利器；它不仅能对网站资源进行优化，而且在开发过程中很多重复的任务能够使用正确的工具自动完成；使用它，我们不仅可以很愉快的编写代码，而且大大提高我们的工作效率。

开发者可以在文件读取与输出中进行相应的操作与处理，从而使输出的文件满足生产要求，实现自动化。其核心部分主要有两块：vinyl与vinyl-fs组成的基于文件的一种objectMode流及其相关操作，以及orchestrator这个任务以来与控制系统（但是gulp4.0好像已经舍弃了它）。当然，本文不会来介绍这两部分的原理或者实现（这部分内容会放在之后的文章里），而是聚焦于其实际的项目应用。

## 3. 在多页应用开发中，我们要解决什么问题
首先，在项目开发中，我们肯定会遇到各种依赖关系的管理。然而如果不用一些前端的依赖管理框架，浏览器是无法原生支持各种模块化规范的，而自动化工具的一大目标就是实现它们（或者说让你开发起来感觉像是实现了）。

![项目开发时的各种依赖关系](/img/mpa-based-on-gulp-in-action/6476654-c78145e9df14fa47.png)

上图就是我们需要面对的繁杂的依赖关系。不像单页（SPA）应用中所有的JavaScript模块都会打包为一个文件（当然可能会有一些代码拆分之类的工作，但其本质上还是将整个站点的路由等页面控制的逻辑前置到了浏览器端）；与之对应的，多页面应用则可以说是一种更为传统，通过后端路由来进行页面的跳转。

因此与单页应用最大的不同就在于，其打包出的文件决不能是一个单一的文件（一个JavaScript文件和一个CSS文件）。页面可能会包含一些公共部分，但每个页面至少需要对应一个独立的JavaScript与一个独立的CSS文件。因此，在各种复杂的处理后，对于多页面应用，我们需要做的就是显现下图的效果。

![image.png](/img/mpa-based-on-gulp-in-action/6476654-071fe32a56dc9b70.png)

其次，在管理模块化依赖之外，我们可能需要预处理一些文件。例如：将less文件编译为css文件，通过babel来使我们的es6代码能运行在不支持es6的浏览器等等。

此外，类似在单页应用中遇到的问题，我们在多页面的情况下也会要处理。例如替换HTML中的环境变量，处理CSS中的雪碧图，甚至规避一些代码检查等等。

最终，我们要将这些处理后的内容发布到运行目录中，实现自动化流程。

## 4. 如何用Gulp来解决这些问题（workflow）
如果细细梳理上一节所谈及的各项目标与工作，可以发现，这是一个紧密相接的工作流程（workflow），这一节会详细讲解各个工作流程。
### 4.1. JS部分
首先，我们来看一下JavaScript部分的工作流程：


![JavaScript部分处理流程](/img/mpa-based-on-gulp-in-action/6476654-a512d598d147d565.png)

#### 4.1.1. 模块化打包

项目使用browserify来实现CommonJS。如果用过browserify，应该不会对下面这段代码感到陌生：
```javascript
browserify({
  entries: $your_entry_arr,
  cache: {},
  packageCache: {},
  plugin: $your_plugin_arr
});
```
通过设置一个（或一些）入口文件，可以将入口文件打包为一个文件。但是，在多页面应用中，最重要的有点就是，各个页面会有自己的JavaScript脚本文件。在项目开发时，在每个HTML页面中引入一个该页面特有的JavaScript脚本。例如页面list.html中通过`<script src="../js/list.js"></script>`引入脚本。而该脚本使用CommonJS规范进行模块化。

```javascript
// ../js/list.js
const button = require('./common/button');
// 一些button的操作
button.render('#button');
// ……
```
因此，需要针对不同的页面，打包出多份的JavaScript文件。首先使用`node-glob`获取每个页面的入口文件，其中`SRC_JS_PATH`为JavaScript源码的路径

```javascript
/**
 * 获取js入口文件路径组
 * @return {Array} 文件路径数组
 */
const getEntryJsFiles = () => (
    glob.sync(`${SRC_JS_PATH}/**/*.js`, {
        ignore: [`${SRC_JS_PATH}/*.dist.js`, `${SRC_JS_PATH}/*.mod.js`]
    })
);
```
然后，对每个入口文件创建其对应的bundle对象并返回，以便于在每个bundle对象上进行后续的js任务处理
```javascript
let files = getEntryJsFiles();

// 遍历所有入口文件，生成browserify对象
bundleTasks = files.map(ele => ({
  bundle: browserify({
  entries: [ele],
  cache: {},
  packageCache: {},
  plugin: [watchify]
  }),
  filename: ele
}));
```
这样，我们就得到了一个`bundleTasks`，里面保存了所有页面对应的各自的入口文件的bundle对象与文件名。下面我们就会对每个bundle对象都应用上面流程图中的工序进行处理。我们先保留这个`bundleTasks`数组，来讲讲其他的工作流程。

#### 4.1.2. 路径修正
由于使用`node-glob`进行匹配，所以匹配到的路径不单单包含文件名，可能还会包含某些目录名。例如，可能想要匹配`list.js`，但是由于工作路径等原因，实际输出的路径名为`./page/list.js`。那么不进行处理会有什么问题呢？

如果直接使用`gulp.dest`进行输出，默认会带上匹配出来的路径里面的所有片段，也就是说，我们可能只希望在dist目录下生成一个list.js文件，但实际上会生成一个page目录，目录里包含list.js文件。这就不符合我们的需求了。因此，使用`gulp-rename`进行路径调整（当然，`gulp-rename`也可以重命名文件）。

在这里，还要推荐一个gulp工具：`gulp-load-plugins`。它可以自动帮我们加载`gulp-`开头的各类gulp插件。因此，可以很方面得进行路径调整。
```javascript
.pipe(plugins.rename({
  dirname: ''
}))
```
我们需要将该步处理置于打包操作之后。这里有一个需要注意的地方，由于bundle的stream是一个普通模式的stream，而gulp（vinyl）的stream则是一个objectMode的stream，因此需要一些转化与处理。这里就用到了`vinyl-source-stream`与`vinyl-buffer`两个库：
```javascript
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const plugins = require('gulp-load-plugins')();

bundle
  .pipe(source(filename))
  .pipe(buffer())
  .pipe(plugins.rename({ // 修正路径名称
    dirname: ''
  }))
```

#### 4.1.3. 转码
虽然部分浏览器对于es6语法已经有了较好的原生支持，但是为了能更好得保证es6代码在浏览器端的正常运行，还是推荐使用babel这样的工具来使得生产环境下的代码具有很好的浏览器兼容性（转为es5）。而在gulp中只需使用`gulp-babel`插件就可以很方便地实现，只需简单几行代码：
```javascript
.pipe(plugins.babel({
  presets: ['env']
}))
```
我们将该步操作置于第二步中的pipe之后。
```javascript
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const plugins = require('gulp-load-plugins')();

bundle
  .pipe(source(filename))
  .pipe(buffer())
  .pipe(plugins.rename({
    dirname: ''
  }))
  .pipe(plugins.babel({ // babel
    presets: ['env']
  }))
```

#### 4.1.4. 禁用代码检查
由于项目的一些特殊原因，需要将开发时的源码和发布的生产环境代码一同上传到线上代码库，同时需要通过jslint的一些代码检查。但是发布后的代码很多时候是不符合代码规范的，因此，需要通过添加一些注释来取消对部分发布后代码的检查。

这个插件也非常简单，通过判断文件类型，为文件头部加入特定的注释文本即可：
```javascript
const through = require('through2');
const gutil = require('gulp-util');
const path = require('path');
const DIS_LINTER = {
    html: '<!-- htmlcs-disable -->',
    css: '/* csshint-disable */',
    js: '/*eslint-disable */'
};

const dislint = preText => {
  let js = new Buffer(`${DIS_LINTER['js']}\n`);
  let css = new Buffer(`${DIS_LINTER['css']}\n`);
  let html = new Buffer(`${DIS_LINTER['html']}\n`);
  let buf = {
    html,
    css,
    js
  };

  return through.obj((chunk, enc, cb) => {
    let ext = '';
    try {
      ext = path.extname(chunk.path);
    }
    catch (err) {
      console.log(err);
    }
    ext = ext.length > 0 ? ext.slice(1) : 'js';

    // gutil.log(gutil.colors.magenta('[Disable Linter]'), chunk.path);
    let preBuf = preText && preText.length > 0 ? new Buffer(preText) : buf[ext];
    if (chunk.isNull()) {
      cb(null, chunk);
    }
    if (chunk.isBuffer()) {
      chunk.contents = Buffer.concat([preBuf, chunk.contents]);
    }
    if (chunk.isStream()) {
      let stream = through();
      stream.write(preBuf);
      chunk.contents = chunk.contents.pipe(stream);
    }
    cb(null, chunk);
  });
};

module.exports = dislint;
```

使用该插件：

```javascript
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const plugins = require('gulp-load-plugins')();
const dislint = require('./dislint');

bundle
  .pipe(source(filename))
  .pipe(buffer())
  .pipe(plugins.rename({
    dirname: ''
  }))
  .pipe(plugins.babel({
    presets: ['env']
  }))
  .pipe(dislint()) // 取消代码检查
```

#### 4.1.5. 添加md5戳并输出
为了防止用户浏览器缓存影响资源更新，可以通过添加md5戳的方式，来改变文件名称。这里用到了`gulp-md5Plus`这个插件。

此外，在开发阶段，我们可以通过禁用浏览器缓存保证获取最新的资源，因此，在开发阶段可以禁用生成md5的功能。要根据不同的环境进行不同的操作，可以使用环境变量进行执行。`gulp-util`提供了这一功能。`gulp-util`是gulp可以看做是一个gulp的常用功能工具箱，里面包含了log、类型判断等一系列功能。

这里，我们会在非生产环境下，使用`gutil.noop()`作为一个不进行任务处理的stream导出；而在生产环境下使用`gulp-md5Plus`来实现md5。最后，将处理后的文件输出到指定的发布目录：
```javascript
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const plugins = require('gulp-load-plugins')();
const dislint = require('./dislint');
const gutil = require('gulp-util');

bundle
  .pipe(source(filename))
  .pipe(buffer())
  .pipe(plugins.rename({
    dirname: ''
  }))
  .pipe(plugins.babel({
    presets: ['env']
  }))
  .pipe(dislint())
  .pipe(gutil.env.env === 'production' ? plugins.md5Plus(5, `${DIST_HTML_PATH}/**/*.html`) : gutil.noop())  // md5
  .pipe(gulp.dest(DIST_JS_PATH)) // 发布文件
```

#### 4.1.6. 错误处理
由于gulp是基于stream的操作，因此使用try…catch…语法显然是无法处理抛出的异常；取而代之就需要监听stream上的error事件。但是，在代码里，我们总不能在每个`.pipe()`后加上`.on('error', function(){}})`这样的代码吧，那也太臃肿了。

为了解决这个问题，就可以使用`gulp-plumber`插件。只需要在stream的最前面加上它，就可以了。
```javascript
bundle
  .pipe(plugins.plumber(err => {
    log(red(`[${err.plugin}]`), red(err.message));
  }))
  .pipe(source(filename))
  .pipe(buffer())
  .pipe(plugins.rename({
    dirname: ''
  }))
  .pipe(plugins.babel({
    presets: ['env']
  }))
  .pipe(dislint())
  .pipe(gutil.env.env === 'production' ? plugins.md5Plus(5, `${DIST_HTML_PATH}/**/*.html`) : gutil.noop())  // md5
  .pipe(gulp.dest(DIST_JS_PATH)) // 发布文件
```

#### 4.1.7. 封装任务
可以看到，上面的一系列任务是每个入口js文件都会经历的，因此，我们将“路径修正-->转码-->禁用代码检查-->md5-->输出”这个流程封装为一个叫做jsTask的任务，并应用在每个bundle上。

```javascript
/**
 * js任务流，具体包括：
 * 模块打包 --> 路径修正(重命名) --> babel --> 取消代码检查 --> md5(production状态) --> 产出
 * @param {Object} bundle 各入口文件的browserify对象
 * @param {string} filename 入口文件名
 * @return {stream} stream 对象
 */
const jsTask = ({bundle, filename}) => (
    bundle.bundle((err, buf) => {
        if (err) {
            // 浏览器提示
            browserSync.notify(`[Browserify Error] ${err.message}`, 10000);
            log(red('[Browserify Error]'), red(err.message));
        }
    })
    .pipe(plugins.plumber(err => {
        log(red(`[${err.plugin}]`), red(err.message));
    }))
    .pipe(source(filename))
    .pipe(buffer())
    .pipe(plugins.rename({
        dirname: ''
    }))
    .pipe(plugins.babel({
        presets: ['env']
    }))
    .pipe(dislint())
    .pipe(gutil.env.env === 'production' ? plugins.md5Plus(5, `${DIST_HTML_PATH}/**/*.html`) : gutil.noop())
    .pipe(gulp.dest(DIST_JS_PATH))
);
```
`jsTask`会包装并返回整个js任务的流。基于以上代码，我们可以定义一个`dist:js`任务来发布js代码：

```javascript
/**
 * 获取js入口文件路径组
 * @return {Array} 文件路径数组
 */
const getEntryJsFiles = () => (
  glob.sync(`${SRC_JS_PATH}/**/*.js`, {
    ignore: [`${SRC_JS_PATH}/*.dist.js`, `${SRC_JS_PATH}/*.mod.js`]
  })
);

// [发布]js代码，其中会进行js相关工作流程
gulp.task('dist:js', cb => {
  let files = getEntryJsFiles();

  // 遍历所有入口文件，生成browserify对象
  bundleTasks = files.map(ele => ({
    bundle: browserify({
      entries: [ele],
      cache: {},
      packageCache: {},
      plugin: [watchify]
    }),
    filename: ele
  }));

  // 映射与合并js流
  let streams = bundleTasks.map(jsTask);
  return es.merge(streams);
});

// [删除]发布目录下的js文件
gulp.task('del:js', () => del.sync([`${DIST_JS_PATH}/*`]));
```
#### 4.1.8. 自动刷新浏览器
前端开发需要频繁修改并希望能看到浏览器中展现的情况，因此，解放你的F5显然很有必要。在项目里，可以使用`browserSync`来做到这一点。

`browserSync`可以在代码更新时自动刷新浏览器，同时还可以向浏览器推送消息进行展示。使用`browserSync`，可以建立相应的gulp任务，在第一次执行gulp时启动browserSync，并创建reload:browser任务，这样在需要的时候就能方便得触发浏览器刷新。
```javascript
const browserSync = require('browser-sync').create();

// [启动]browserSync
gulp.task('start:browserSync', () => browserSync.init({
  proxy: '192.168.11.23',
  notify: true
}));

// 刷新浏览器
gulp.task('reload:browser', cb => {
  browserSync.reload();
  cb();
});
```

#### 4.1.9. 增量发布
上面介绍了对于一个js入口文件的整套工作流。然而在实际开发中，我们在修改了某一个文件之后，并不需要将所有的代码全量再发布一遍，如果能每次只增量得发布与修改相关的js代码，会在开发体验与效率上有较大的提升。

同时，结合`browserSync`可以让你的开发效率极大获得提升。为此，我们需要`watchify`来进行文件监听，并将其作为`browserify`的插件，实现文件的增量打包编译。通过监听每个bundle的update事件，可以在文件更新时重新打包并处理发布，最后到stream触发end事件（处理完成）时刷新浏览器。

```javascript
/**
 * 监听各个browserify对象的update事件
 * 在模块更新时按需打包
 * @param {Object} bundle 各入口文件的browserify对象
 * @param {string} filename 入口文件名
 */
const addBundleTaskListeners = ({bundle, filename}) => {
  bundle.on('update', () => {
    log(blue('[Browserify Update]'), filename);
    let sm = jsTask({bundle, filename});
    // 打包完成后刷新浏览器（错误不刷新，保留notify）
    sm.on('end', () => runSequence('reload:browser'));
  });
};

// [监听]为所有入口文件对应的browserify对象添加update监听
gulp.task('watch:js', () => {
  bundleTasks.forEach(item => {
    addBundleTaskListeners(item);
  });
});
```

### 4.2. HTML部分

![HTML部分处理流程](/img/mpa-based-on-gulp-in-action/6476654-826361fea7518d59.png)

HTML部分主要包括两个工作：文件内变量的替换与文件路径的修正。

#### 4.2.1. 替换文件内变量
在开发中，经常会有类似这样的需求：
- 在开发环境下，我们会引用一些开发机上的静态资源；然而在生产环境中，则需要替换成线上的CDN地址。
- 协同开发下，不同的开发人员可能会使用不同的资源路径。
- 为每个HTML设置title内容，其中一部分为统一文字，例如：我的主页——贡献列表、我的主页——个人设置…尤其在开发中，“我的主页”可能突然要被换成“个人中心”之类的…
- HTML中其他不常更改但可能需要各处统一的部分…

上面这些需求我们当然可以通过手工替换的方式开解决，它们本身并无太多技术含量，但很浪费开发人员的精力，并且还可能因为粗心大意产生错误或遗漏。因此如果能在gulp中自动替换这些变量，必然会节省很多麻烦。

参考一些其他工具或脚手架里的功能，我们的目标效果是：在项目根目录下定义这些变量（例如在.env或.env.local文件中）
```
$ONE_CDN$=http://cp01-test.XXXX.com
$ONE_TITLE$=我的主页
```
然后在HTML中直接使用

```xml
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>$ONE_TITLE$——贡献列表</title>
    <link rel="shortcut icon" href="/img/icon.png" />

    <script src="$ONE_CDN$/vendors/bower_components/jquery/dist/jquery.min.js"></script>
    <script src="$ONE_CDN$/vendors/bower_components/bootstrap/dist/js/bootstrap.min.js"></script>
    <script src="$ONE_CDN$/js/app.min.js"></script>
    <link href="$ONE_CDN$/vendors/bower_components/animate.css/animate.min.css" rel="stylesheet">
    <link href="$ONE_CDN$/vendors/bower_components/bootstrap/dist/js/bootstrap.min.css" rel="stylesheet">
    ……
</head>
```

下面，就要需要一个方法能够读取出.env和.env.local文件中的所有变量（默认先使用.env.local，可以理解为.env.local会覆盖.env中的同名变量）

```javascript
/**
 * trim
 * @param {string} str 待处理字符串
 * @return {string} 处理后的字符串
 */
const trim = str => str.replace(/(^\s*)|(\s*$)/g, '');

/**
 * 获取文件中的环境变量
 * @return {Object} 环境变量map
 */
const getEnv = () => {
    let prepare = ['.env.local', '.env'];
    let env = {};

    /**
     * 检查.env中变量名是否合法
     * 全部使用大写字母，用_连接，第一个单词为ONE，首尾使用$
     * @param {string} key 待检查的变量名
     * @return {boolean} 检查结果，合法true，非法false
     */
    function envCheck(key) {
        return /^\$ONE(_[A-Z]+)+\$$/.test(key);
    }

    /**
     * 读取文件中的变量
     * @param {string} filename 配置文件
     * @return {Object} 配置变量
     */
    function readEnvFile(filename) {
        let env = {};
        try {
            let filepath = path.resolve('.', filename);
            if (fs.existsSync(filepath) && fs.statSync(filepath).isFile()) {
                fs.readFileSync(filepath, 'utf-8')
                    .split(/\r?\n/)
                    .filter(ele => ele !== '')
                    .forEach(ele => {
                        let pairs = ele.split('=');
                        let key = trim(pairs[0]);
                        let value = trim(pairs[1]);
                        if (envCheck(key)) {
                            env[key] = value;
                        }
                        else {
                            log(red('[env]'), `无效的变量名: ${key}`, 'tip: 全部使用大写字母，用_连接，第一个单词为ONE，首尾使用$');
                        }
                    });
            }
        }
        catch (err) {
            log(red('[env]'), '读取env变量出错', err);
        }
        finally {
            return env;
        }
    }

    let envArr = [{}];
    // 优先寻找本地配置.env.local
    while (prepare.length) {
        // 生产环境下优先使用.env
        let filename = gutil.env.env === 'production' ? prepare.shift() : prepare.pop();
        envArr.push(readEnvFile(filename));
    }

    return Object.assign.apply(null, envArr);
};
```

`getEnv()`方法可以读取所有定义的环境变量，并保存为一个键值对形式的对象，键名是变量名，值则是变量的值

```javascript
// getEnv()
{
  'ONE_CDN': 'http://cp01-test.XXXX.com',
  'ONE_TITLE': '我的主页'
}
```

由于要替换文件内容，我们可以使用`event-stream`库来进行stream的操作。使用其中的`.replace()`方法来替换文件内容，代码片段如下：

```javascript
const es = require('event-stream');

let pipe = fs.createReadStream(sourceFile);

// 添加管道，替换.env中的环境变量
for (let k in envMap) {
  pipe = pipe.pipe(es.replace(k, envMap[k]));
}
```

#### 4.4.2. 修正文件路径
类似JavaScript中的文件路径修正操作，在HTML中同样使用`gulp-rename`来实现，路径修正部分代码片段如下：
```javascript
// 路径格式化正则
let reg = new RegExp(`^${path.relative('.', SRC_HTML_PATH)}`);

return (
  pipe.pipe(source(sourceFile))
    .pipe(dislint())
    .pipe(plugins.rename(p => {
      // 格式化目标路径
      p.dirname = p.dirname.replace(reg, '');
    }))
    .pipe(gulp.dest(DIST_HTML_PATH))
);
```

#### 4.2.3. 封装任务
将变量替换与文件路径修正两部分代码封装为一个任务函数`htmlTask`

```javascript
/**
 * html发布任务
 * @param {string} sourceFile 需要发布的目标html文件
 * @return {stream} 文件流
 */
const htmlTask = sourceFile => {
  let pipe = fs.createReadStream(sourceFile);

  // 添加管道，替换.env中的环境变量
  for (let k in envMap) {
    pipe = pipe.pipe(es.replace(k, envMap[k]));
  }

  // 路径格式化正则
  let reg = new RegExp(`^${path.relative('.', SRC_HTML_PATH)}`);

  return (
    pipe.pipe(source(sourceFile))
      .pipe(dislint())
      .pipe(plugins.rename(p => {
        // 格式化目标路径
        p.dirname = p.dirname.replace(reg, '');
      }))
      .pipe(gulp.dest(DIST_HTML_PATH))
  );
};
```
在此基础上，创建一个gulp任务用于HTML文件的发布
```javascript
// [发布]html页面
gulp.task('dist:html', () => {
  let files = glob.sync(`${SRC_HTML_PATH}/**/*.html`);
  let streams = files.map(htmlTask);
  return es.merge(streams);
});
```
同时，还需要把已有的文件删除，这里用到了`del`这个包
```javascript
const del = require('del');

// [删除]发布目录额下的html文件
gulp.task('del:html', () => del.sync([`${DIST_HTML_PATH}/*`]));
```

### 4.3. CSS部分

![CSS部分处理流程](/img/mpa-based-on-gulp-in-action/6476654-ff7268e61e149d78.png)

CSS部分的处理流程中大部分与之前的操作大同小异，其中最主要的区别是在CSS中使用到`gulp-less`插件与`gulp-minify-css`插件分别对less文件进行预处理与压缩
```javascript
gulp.src(`${SRC_CSS_PATH}/**/*.less`) //多个文件以数组形式传入
  .pipe(less())
  .pipe(minifyCss())
  .pipe(gulp.dest('dist/css')); 
```

最终CSS部分的处理任务如下：
```javascript
// [删除]发布目录下的css文件
gulp.task('del:css', () => del.sync([`${DIST_CSS_PATH}/*`]));

// [发布]css文件
gulp.task('dist:css', function () {
  gulp.src(`${SRC_CSS_PATH}/**/*.less`) 
    .pipe(plugins.rename({
        dirname: ''
    }))
    .pipe(less())
    .pipe(minifyCss())
    .pipe(gulp.dest('dist/css')); 
});
```

## 4.4. 组合与管理这些任务
我们定义上面一系列的任务，但最终的目标是将这些任务组合起来，让他们变成一条指令（或某几条指令）。为了更好得组织任务依赖，控制任务流程，我们使用`run-sequence`来控制这些任务的执行。

最常见的，首先是在开发时，希望输入`gulp`就可以进入开发模式，能够监听变化并自动刷新浏览器。

```javascript
// [监听]为所有入口文件对应的browserify对象添加update监听
gulp.task('watch:js', () => {
  bundleTasks.forEach(item => {
    addBundleTaskListeners(item);
  });
});

// [监听]更新CSS
gulp.task('watch:css', () => {
  gulp.watch(['!**/gulpfile.js', 'src/**/*.css'], () => {
    runSequence(
      'del:css',
      'dist:css',
      'reload:browser'
    );
  });
  cb();
});

// [启动]browserSync
gulp.task('start:browserSync', () => browserSync.init({
  proxy: '192.168.11.23',
  notify: true
}));

// 刷新浏览器
gulp.task('reload:browser', cb => {
  browserSync.reload();
  cb();
});

// [监听]html文件变化
gulp.task('watch:html', cb => {
  // 监听html变化，全量发布新html
  gulp.watch(['!**/gulpfile.js', 'src/**/*.html'], () => {
    runSequence(
      'del:html',
       'dist:html',
      'reload:browser'
    );
  });
  cb();
});

// 发布模式
// build任务，进行项目资源发布
gulp.task('build', cb => {
  runSequence(
    ['del:html', 'del:js'],
    'dist:html',
    'dist:js',
    cb
  );
});

// 开发模式
// 执行发布，并进行监听
gulp.task('default', cb => {
  runSequence(
    'build',
    'start:browserSync',
    ['watch:js', 'watch:html', 'watch:css'],
    cb
  );
});
```

当然，常用的还有发布任务
```javascript
// 发布模式
// 构建资源发布，并退出gulp进程
gulp.task('dist', cb => {
  gutil.env.env = gutil.env.env === undefined ? 'production' : gutil.env.env;
  runSequence(
    'build',
    () => {
      cb();
      process.nextTick(process.exit);
    }
  );
});
```
## 总结
文章里主要整理了我在项目中用到的一些解决方案与实践方法。其中也还存在一些不足，例如HTML与CSS的增量发布等，这些都是之后可以再进行优化的地方。

完。

----
Happy Coding！
----
----