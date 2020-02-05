---
title: 在 Chrome 中调试你的 PWA
date: 2018-05-01 12:00:00
tags: PWA
---

![](/img/chrome-dev.jpg)

前几篇文章介绍了PWA中的一些功能与背后的技术。工欲善其事，必先利其器。这一篇会介绍如何调试我们的PWA。

<!-- more -->

## Service Worker
新版的chrome调试工具中集成了Service Worker调试工具。

开启chrome调试工具，选择Application选项卡。在左侧的列表选择Application --> Service Worker，就会显示当前站点下的Service Worker。

![](/img/16310656fb567e8f.png)

在Service Worker下有三个复选框：

- Offline：切换为无网环境。通过勾选可以方便查看应用在无网环境中的表现。
- Update on reload：每次reload都更新Service Worker。一般来说，当访问站点发现Service Worker有更新后，为了保证本次访问，不会立即激活新的Service Worker，只会在安装后进入等待状态，在下一次访问时激活。勾选该选项就可以使每次Reload后都重新安装与激活Service Worker。
- Bypass for network：使用网络请求。我们知道Service Worker可以拦截客户端请求，勾选该选项后所有请求都会直接走网络请求。


面板右上角的Upadte按钮可以手动触发Service Worker的更新；而Unregister类似于代码中的unregister，用于注销当前的Service Worker。

从下方“Service workers from other domain”中，可以查看在这个client上所有注册过的Service Worker：

![](/img/163107b914043f63.png)

Service Worker主面板区域包括了：Source、Status、Clients、Push和Sync五个项目。

![](/img/163106e9284cbc26.png)

- Source：展示了当前注册所使用的Service Worker脚本（sw.js），点击可以查看脚本内容。同时还展示了该Service Worker的安装时间。
- Status：展示Service Worker所处的生命周期。通过点击stop按钮可以暂停该Service Worker。其中，`#1201`表示Service Worker的版本，当sw.js文件未更改时，reload站点该数字是不会增加的；但是当勾选Update on reload后，由于每次reload都会触发Service Worker重新安装，因此该数字会增加。
- Clients：显示了当前Service Worker所作用的root。focus按钮用来帮你快速切换到该Service Worker对应的tab（当你打开多个站点的tab时，点击可以快速切换）。
- Push：用来模拟进行推送。
- Sync：用来模拟进行后台同步。

在Service Worker中`console.log`的信息也会显示在Console中。此外，由于默认情况下，reload页面会清空console，为了保存一些日志信息，可以打开Preserve log来保留Console信息。

![](/img/163108561231f344.png)

## Manifest
在Application中，点击Manifest即可看到当前应用所使用的Manifest配置：

![](/img/163108efbea4b61d.png)

同样，点击manifest.json出链接可以查看manifest文件。点击“Add to homescreen”可以把应用添加到桌面。除了点击“Add to homescreen”，也可以使用chrome中的添加到应用文件夹。


![](/img/1631097d137fb789.png)

## Cache
除了Service Worker与Manifest，在我们的WebApp中还用到了Cache。在Application中也支持查看Cache：在Cache列表的Cache Storage中查看。

![](https://user-gold-cdn.xitu.io/2018/4/29/163109e551b9cd0f?w=1197&h=393&f=png&s=89517)

其中bs-0-2-0和api-0-1-1就是我们的“图书搜索”Web App所创建与使用的两个cache。在bs-0-2-0中缓存了包括页面、js、css、图片在内的一些静态资源；在而api-0-1-1中则缓存了图书检索的XHR请求。

![](https://user-gold-cdn.xitu.io/2018/4/29/16310a142d0c794d?w=1197&h=503&f=png&s=116464)

如果想删除某些cache，可以右键点击，然后选择Delete；也可以点击上方的×。除了在这里清除cache，还可以在Application下的Clear Storage中清除包括Service Worker、Cache与Storage（cookie/localstorage/IndexedDB……）等数据。

![](https://user-gold-cdn.xitu.io/2018/4/29/16310a439ef7c605?w=1196&h=664&f=png&s=88822)

## 写在最后
如果你喜欢或想要了解更多的PWA相关知识，欢迎关注我，关注[《PWA学习与实践》](https://juejin.im/user/59ad5377518825244d206d2d/posts)系列文章。我会总结整理自己学习PWA过程的遇到的疑问与技术点，并通过实际代码和大家一起实践。

在下一篇文章里，我们会继续了解另一个经常与Push API组合在一起的功能——消息提醒，Notification API。

## 《PWA学习与实践》系列
- [第一篇：2018，开始你的PWA学习之旅](https://juejin.im/post/5ac8a67c5188255c5668b0b8)
- [第二篇：10分钟学会使用Manifest，让你的WebApp更“Native”](https://juejin.im/post/5ac8a89ef265da238440d60a)
- [第三篇：从今天起，让你的WebApp离线可用](https://juejin.im/post/5aca14b6f265da237c692e6f)
- [第四篇：TroubleShooting: 解决FireBase login验证失败问题](https://juejin.im/post/5accc3c9f265da23870f2abc)
- [第五篇：与你的用户保持联系: Web Push功能](https://juejin.im/post/5accd1355188252b0b201fb9)
- 第六篇：How to Debug? 在chrome中调试你的PWA（本文）
- [第七篇：增强交互：使用Notification API来进行提醒](https://juejin.im/post/5ae7f7fd518825670960fe96)
- [第八篇：使用Service Worker进行后台数据同步](https://juejin.im/post/5af80c336fb9a07aab29f19c)
- [第九篇：PWA实践中的问题与解决方案](https://juejin.im/post/5b02e5f1f265da0b767dc81d)
- [第十篇：Resource Hint - 提升页面加载性能与体验](https://juejin.im/post/5b4b66f0f265da0f9155feb6)
- 第十一篇：从PWA离线工具集workbox中学习各类离线策略（写作中…）

