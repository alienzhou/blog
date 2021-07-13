---
title: Nodejs 中为什么没有 TimerWrap —— Nodejs 是如何实现 timer 的
date: 2021-07-13 12:00:00
tags:
- NodeJS
---

- 移除 Timer_Wrap：https://github.com/nodejs/node/commit/2930bd1317d15d12738a4896c0a6c05700411b47
- v4.x - https://github.com/nodejs/node/blob/v4.9.1/lib/timers.js - 使用一个 handle 对应一个 DoubleLinkList 的实现。这一版实现参考了 libev http://pod.tst.eu/http://cvs.schmorp.de/libev/ev.pod#Be_smart_about_timeouts
- adv performance：https://github.com/nodejs/node/commit/ae558af7bc1db217eb1c368c8b5e5773910232c3#diff-5a0457600721c223f1ed7184ef7d1d2617f4552a5341b53a49b284f808981724
- 通过优先级队列优化到一个 timer handle 的 PR：https://github.com/nodejs/node/commit/23a56e0c28cd828ef0cabb05b30e03cc8cb57dd5#diff-5a0457600721c223f1ed7184ef7d1d2617f4552a5341b53a49b284f808981724
- Nodejs 从 0.1.90 开始，在 net 模块中使用了 libev 中提到的优化技术实现 timer：https://github.com/nodejs/node/blob/v0.1.90/lib/net.js#L58


<!-- more -->