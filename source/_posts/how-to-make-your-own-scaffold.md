---
title: 🛠如何快速开发一个自己的项目脚手架？
date: 2019-05-17 12:00:00
tags:
- JavaScript
- 前端工程化
- 自动化工具
---

![](/img/scaffold.jpg)

用过那么多脚手架，现在自己来开发一个可好？

<!-- more -->

## 引言

下面是一个使用脚手架来初始化项目的典型例子。

![](/img/how-to-make-your-own-scaffold/16ac081750971790.gif)

随着前端工程化的理念不断深入，越来越多的人选择使用脚手架来从零到一搭建自己的项目。其中大家最熟悉的就是`create-react-app`和`vue-cli`，它们可以帮助我们初始化配置、生成项目结构、自动安装依赖，最后我们一行指令即可运行项目开始开发，或者进行项目构建（build）。

这些脚手架提供的都是普遍意义上的最佳实践，但是我在开发中发现，随着业务的不断发展，必然会出现需要针对业务开发的实际情况来进行调整。例如：

- 通过调整插件与配置实现 Webpack 打包性能优化后
- 删除脚手架构建出来的部分功能
- 项目架构调整
- 融合公司开发工具
- ……

总而言之，随着业务发展，我们往往会沉淀出一套更“个性化”的业务方案。这时候我们最直接的做法就是开发出一个该方案的脚手架来，以便今后能复用这些最佳实践与方案。

## 1. 脚手架怎么工作？

功能丰富程度不同的脚手架，复杂程度自然也不太一样。但是总体来说，脚手架的工作大体都会包含几个步骤：

- 初始化，一般在这个时候会进行环境的初始化，做一些前置的检查
- 用户输入，例如用 vue-cli 的时候，它会“问”你很多配置选项
- 生成配置文件
- 生成项目结构，这是候可能会使用一个项目模版
- 安装依赖
- 清理、校验等收尾工作

此外，你还需要处理命令行行为等。往往我们只是想轻量级、快速得创建一个特定场景的脚手架（不用想vue-cli那么完备）。而对于想要快速创建一个脚手架，其实我们不用完全从零开始。[Yeoman](https://yeoman.io/) 就是一个可以帮我们快速创建脚手架的工具。

![](/img/how-to-make-your-own-scaffold/16ac137b8509c628.png)

可能很多同学都不太了解，那么先简单介绍一下 Yeoman 是什么，又是如何帮我们来简化脚手架搭建的。

首先，Yeoman 可以简单理解为是一个脚手架的运行框架，它定义了一个脚手架在运行过程中所要经历的各个阶段（例如我们上面说的，可能会先读取用户输入，然后生成项目文件，最后安装依赖），我们所需要的就是在生命周期的对应阶段，填充对应的操作代码即可。而我们填充代码的地方，在 Yeoman 中叫做 generator，物如其名，Yeoman 通过调用某个 generator 即可生成（generate）对应的项目。

如果你还不是特别清楚它们之间的关系，那么可以举个小例子：

将脚手架开发类比为前端组件开发，Yeoman 的角色就像是 React，是一个框架，尤其是定义了组件的生命周期函数；而 generator 类似于你写的一个 React 业务组件，根据 React 的规则在各个生命周期中填代码即可。

[Yeoman 内置的“生命周期”方法执行顺序如下：](https://yeoman.io/authoring/running-context.html#the-run-loop)

1. initializing
2. prompting
3. default
4. writing
5. conflicts
6. install
7. end

其中 default 阶段会执行你自定义地各种方法。

同时，Yeoman 还集成了脚手架开发中常用的各类工具，像是文件操作、模版填充、终端上的用户交互功能，命令行等，并且封装成了简单易用的方法。

通过这两点，Yeoman 可以帮我们大大规范与简化脚手架的开发。

## 2. 开发一个自己的脚手架

了解了一些脚手架的工作方式与 Yeoman 的基本概念，咱们就可以来创建一个属于自己的脚手架。作为例子，这个脚手架的功能很简单，它会为我们创建一个最简版的基于 Webpack 的前端项目。最终脚手架使用效果如下：

![](/img/how-to-make-your-own-scaffold/16ac081750971790.gif)

### 2.1. 准备一个项目模版

脚手架是帮助我们快速生成一套既定的项目架构、文件、配置，而最常见的做法的就是先写好一套项目框架模版，等到脚手架要生成项目时，则将这套模版拷贝到目标目录下。这里其实会有两个小点需要关注。

第一个是模版内变量的填充。

在模版中的某些文件内容可能会需要生成时动态替换，例如根据用户在终端中输入的内容，动态填充`package.json`中的`name`值。而 Yeoman 内置了 [ejs](https://github.com/mde/ejs) 作为模版引擎，可以直接使用。

第二个就是模版的放置位置。

一种是直接放在本地，也就是直接放到 generator 中，跟随 generator 一起下载，每次安装都是本地拷贝，速度很快，但是项目模版自身的更新升级比较困难，需要提示用户升级 generator。

另一种则是将模版文件放到某个服务器上，每次使用脚手架初始化时通过某个地址动态下载，想要更新升级模版会很方便，通常会选择托管在 github 上。

关于第二个模版放置究竟是选择在本地好，还是远端好，其实还是依据你个人的业务场景而定，在不同的场景的限制的需求不同，我之前既写过模版放在本地的脚手架（即和脚手架一起通过 npm 安装），也写过托管在 git 仓库上的这种方式。

回到我们「创建一个最简版的基于 Webpack 的前端项目」的目标，我准备了一个[项目模版](https://github.com/alienzhou/webpack-kickoff-template)，之后就会用它来作为脚手架生成的项目内容。

### 2.2. 创建 generator（yeoman-generator）

创建 Yeoman 的 generator 需要遵循它的规则。

首先是 generator 命名规则。需要以`generator`打头，横线连接。例如你想创建一个名为 webpack-kickoff 的 generator，包名需要取成 `generator-webpack-kickoff`。

这样，当你通过

```bash
npm i -g yo
```

安装完 Yeoman 的 CLI 后，就可以通过`yo`命令来使用 generator 来启动脚手架：

```
yo webpack-kickoff
```

这里的 webpack-kickoff 就是包名里`generator-`后面的内容，Yeoman 会按这个规则去全局找相匹配的包。

其次，依据 Yeoman 的规范，默认情况下你需要在项目（即 generator）的`generators/app/`目录下创建`index.js`，在其中写入你的脚手架工作流程。当然，也可以通过[修改配置来扩展或改变这个规则](https://yeoman.io/authoring/index.html#folder-tree)。

此外，你创建的 generator 类需要继承 yeoman-generator。所以我们会在`generators/app/index.js`中写如下代码：

```JavaScript
const Generator = require('yeoman-generator');
class WebpackKickoffGenerator extends Generator {
    constructor(params, opts) {
        super(params, opts);
    }
}
module.exports = WebpackKickoffGenerator;
```

还记得之前提到的“生命周期”方法么？包括 initializing、prompting、default、writing、conflicts、install 和 end。除了`default`，其他都代表了 Generator 中的一个同名方法，你需要的就是在子类中重写后所需的对应方法。`default`阶段则会执行用户定义的类方法。

例如，你想在初始化时打印下版本信息，可以这么做：

```JavaScript
const Generator = require('yeoman-generator');
class WebpackKickoffGenerator extends Generator {
    constructor(params, opts) {
        super(params, opts);
    }
    
    initializing() {
        const version = require('../../package.json').version;
        this.log(version);
    }
}
module.exports = WebpackKickoffGenerator;
```

可见，剩下的工作就是在 WebpackKickoffGenerator 类中填充各种方法的实现细节了。

### 2.3. 处理用户交互

脚手架工作中一般都会有一些用户自定义的内容，例如创建的项目目录名，或者是否启用某个配置等。这些交互一般都是通过交互式的终端来实现的，例如下面这个功能。

![](/img/how-to-make-your-own-scaffold/16ac080688a52242.png)

可以使用 [Inquirer.js](https://github.com/SBoudrias/Inquirer.js) 来实现。而 Yeoman 已经帮我们集成好了，直接在 generator 里调用 `this.prompt` 即可。

在用户交互部分的需求也比较简单，只需要询问用户所需创建的项目目录名即可，随后也会作为项目名。按照 Yeoman 的流程规范，我们将该部分代码写在 `prompting` 方法中：

```JavaScript
class WebpackKickoffGenerator extends Generator {
    // ……
    prompting() {
        const done = this.async();

        const opts = [{
            type: 'input',
            name: 'dirName',
            message: 'Please enter the directory name for your project：',
            default: 'webpack-app',
            validate: dirName => {
                if (dirName.length < 1) {
                    return '⚠️  directory name must not be null！';
                }
                return true;
            }
        }];

        return this.prompt(opts).then(({dirName}) => {
            this.dirName = dirName;
            done();
        });
    }
    // ……
}
```

注意，由于用户交互是一个“异步”的行为，为了让后续生命周期方法在“异步”完成后再继续执行，需要调用`this.async()`方法来通知方法为异步方法，避免顺序执行完同步代码后直接调用下一阶段的生命周期方法。调用后会返回一个函数，执行函数表明该阶段完成。

### 2.4. 下载模版

正如2.1.中所述，我们选择将模版托管在 [github](https://github.com/alienzhou/webpack-kickoff-template) 上，因此在生成具体项目代码前，需要将相应的文件下载下来。可以使用 [download-git-repo](https://github.com/flipxfx/download-git-repo) 来快速实现。

```JavaScript
class WebpackKickoffGenerator extends Generator {
    // ……
    _downloadTemplate() {
        return new Promise((resolve, reject) => {
            const dirPath = this.destinationPath(this.dirName, '.tmp');
            download('alienzhou/webpack-kickoff-template', dirPath, err => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
    // ……
}
```

这里我们使用了`this.destinationPath()`方法，该方法主要用于获取路径。不传参时返回当前命令行运行的目录；如果收到多个参数，则会进行路径的拼接。

此外，如果你细心的话，会发现`_downloadTemplate()`方法带了一个下划线前缀。这是 Yeoman 中的一个约定：Yeoman 执行顺序中有个`default`阶段，该阶段包含了所有用户自定义的类方法。但是，如果某些方法你不希望被 Yeoman 的脚手架流程直接调用，而是作为工具方法提供给其他类方法，则可以添加一个下划线前缀。对于这种命名的方法，则会在`default`阶段被忽略。

### 2.5. 模版文件拷贝

项目模版下载完毕后，下面就可以将相关的目录、文件拷贝到目标文件夹中。这些都可以在`writing`阶段操作。此时需要遍历模版中的所有目录，将所有文件进行模版填充与拷贝。遍历方式如下：

```JavaScript
class WebpackKickoffGenerator extends Generator {
    // ……
    _walk(filePath, templateRoot) {
        if (fs.statSync(filePath).isDirectory()) {
            fs.readdirSync(filePath).forEach(name => {
                this._walk(path.resolve(filePath, name), templateRoot);
            });
            return;
        }

        const relativePath = path.relative(templateRoot, filePath);
        const destination = this.destinationPath(this.dirName, relativePath);
        this.fs.copyTpl(filePath, destination, {
            dirName: this.dirName
        });
    }
    // ……
}
```

这里使用了`this.fs.copyTpl()`方法，它支持文件拷贝，同时还可以指定相应的模版参数，此外，如果出现重名覆盖情况会在控制台自动输出相应信息。

最后，把下载与拷贝整合起来即可完成`writing`阶段。

```JavaScript
class WebpackKickoffGenerator extends Generator {
    // ……
    writing() {
        const done = this.async();
        this._downloadTemplate()
            .then(() => {
                const templateRoot = this.destinationPath(this.dirName, '.tmp');
                this._walk(templateRoot, templateRoot);
                fs.removeSync(templateRoot);
                done();
            })
            .catch(err => {
                this.env.error(err);
            });
    }
    // ……
}
```

### 2.6. 依赖安装

到目前，脚手架已经可以帮我们把项目开发所需的配置、目录结构、依赖清单都准备好了。这时候可以进一步帮开发人员将依赖安装完毕，这样脚手架创建项目完成后，开发人员就可以直接开发了。

Yeoman 也提供了`this.npmInstall()`来方法来实现 npm 包的安装：

```JavaScript
class WebpackKickoffGenerator extends Generator {
    // ……
    install() {
        this.npmInstall('', {}, {
            cwd: this.destinationPath(this.dirName)
        });
    }
    // ……
}
```

到这里，脚手架的核心功能就完成了。已经可以使用咱们的这个 generator 来快速创建项目了。很简单吧~

> 完整的代码可以参考 [generator-webpack-kickoff](https://github.com/alienzhou/generator-webpack-kickoff)。

## 3. 使用脚手架 🚀

使用该脚手架会同时需要 Yeoman 与上述咱们刚创建的 yeoman-generator。当然，有一个前提，Yeoman 与这个 generator 都需要全局安装。全局安装 Yeoman 没啥有问题（`npm install -g yo`），处理 generator-webpack-kickoff 的话可能有几种方式：

1. 直接发布到 npm，然后正常全局安装
2. 直接手动拷贝到全局 node_modules
3. 使用`npm link`将某个目录链接到全局

依据2.2.节的内容，咱们的 generator 名称为 generator-webpack-kickoff。由于我的包已经发到 npm 上了，所以要使用该脚手架可以运行如下指令：

```bash
# 安装一次即可
npm i -g yo
npm i -g generator-webpack-kickoff

# 启动脚手架
yo webpack-kickoff
```

## 4. 优化

从上文这个例子可以看出，实现一个脚手架非常简单。例子虽小，但也包含了脚手架开发的主要部分。当然，这篇文章为了简化，省略了一些“优化”功能。例如

- 项目目录的重名检测，生成项目时，检查是否目录已存在，并提示警告
- 项目模版的缓存。虽然我们使用 github 托管方式，但也可以考虑不必每次都重新下载，可以放一份本地缓存，然后每天或每周更新；
- CLI 的优化。[完整版](https://github.com/alienzhou/generator-webpack-kickoff)里还会包含一些更丰富的 CLI 使用，例如我们在动图中看到的 loading 效果、头尾显示的信息面板等。这些工具包括
    - [ora](https://github.com/sindresorhus/ora)，用于创建 spinner，也就是上面所说的 loading 效果
    - [chalk](https://github.com/chalk/chalk)，用于打印彩色的信息
    - [update-notifier](https://github.com/yeoman/update-notifier)，用于检查包的线上版本与本地版本
    - [beeper](https://github.com/sindresorhus/beeper)，可以“哔”一下你，例如出错的时候
    - [boxen](https://github.com/sindresorhus/boxen)，创建头尾的那个小“面板”
- 版本检查。上面提到可以用 [update-notifier](https://github.com/yeoman/update-notifier) 来检查版本。所以可以在 initializing 阶段进行版本检查，提示用户更新脚手架。

## 最后

本文通过一个简单的例子来告诉大家如何使用 Yeoman 快速创建脚手架。要了解更多 yeoman-generator 的开发与使用，可以参考[社区里大家写的各类 generator](https://www.npmjs.com/search?q=keywords:yeoman-generator)。目前在 npm 上有超过 8000 个 yeoman-generator，也许就会有你的菜。

> 文中完成的代码请查看 [generator-webpack-kickoff](https://github.com/alienzhou/generator-webpack-kickoff)。