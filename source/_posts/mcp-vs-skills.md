---
title: MCP 是最大骗局？Skills 才是救星？
date: 2026-01-13 03:30:32
tags:
- AI
- Agent
- MCP
- Skills
---

尤记得上半年大家对 MCP 的狂热，遇人就会和我聊到 MCP。然而从落地使用上似乎不是这么个情况。社区里面流传着一句话：MCP 是一个开发者远超使用者的功能。那么 MCP 真的是世上最大骗局吗？

![file](/img/mcp-vs-skills/ace502a5589ee97e44017b303fab492f.jpg)

<!-- more -->

如果你是 AI 工具的用户（而不是开发者），这篇文章可能会从另一角度来尝试解释：为什么 MCP 这么火，但你用起来总觉得"没什么用"？Skills 为什么可能才是你真正需要的东西。

---

## 一、MCP：开发者的狂欢，用户的懵圈

MCP（Model Context Protocol）在 2024 年底由 Anthropic 发布，号称是 AI 领域的"USB-C"——一个标准化的协议，让 AI 可以连接各种外部工具。

听起来很美好。但现实是社区里充斥着对 MCP 的嘲讽，称其为"最大骗局"。

> [MCP 可能是唯一开发者比使用者还多的技术](https://x.com/dotey/status/1971626371349991813)
> [开发者为什么吐槽 MCP 协议？](https://zhuanlan.zhihu.com/p/1982787663686819915)

![file](/img/mcp-vs-skills/75a6e3278d71b66ddbde8c65727c279a.jpg)

这意味着什么？

**大量开发者在「研究」MCP，但真正能给用户用的工具少得可怜。**

SDK 月下载量 9700 万次，Registry 增长 407%——开发者热情高涨。但作为用户，你打开 Claude 或 Cursor，想找个好用的 MCP 工具，大概率还是会失望。

这不是 MCP 的错。这是它的「基因」决定的。

---

## 二、协议的「基因」决定了谁受益

为什么 MCP 对用户不友好？也许答案藏在协议设计本身。

我们对比下 MCP 和 Skills（Agent Skills）两个协议的规范：


| 维度      | MCP                 | Skills                 |
| ------- | ------------------- | --------------------- |
| 协议规定的是  | 开发者怎么写工具            | AI 怎么用能力              |
| 规范内容    | API、Schema、SDK      | Markdown、Instructions |
| 开发者上手门槛 | 懂 JSON Schema + SDK | 会写 Markdown           |


> 来源：[modelcontextprotocol.io](https://modelcontextprotocol.io) / [agentskills.io](https://agentskills.io)

**MCP 协议规定的是「开发者怎么写工具」**——API 接口怎么定义、数据结构怎么传递、SDK 怎么集成。这些对开发者很重要，但普通用户根本不关心。

**Skills 协议规定的是「AI 怎么用能力」**——什么时候加载、怎么理解指令、如何执行任务。这些直接影响用户体验。

![file](/img/mcp-vs-skills/dfd2188ed345d10bdaae9d07b8aa4d5e.jpg)

即使开发者来说，Skill 的上手成本也都远低于 MCP。甚至简单的 Skills，使用者可以在使用过程中无缝切换为开发者，[边用边优化](https://mp.weixin.qq.com/s/-3k6--An5nTWg8P8kgqEKg)。

**一句话总结**：MCP 面向开发者，尽力优化了开发体验，在 Agent 如何使用这些工具上却没有给出太多指导；Skill 面向使用者，优化使用体验（包括成本），在 Agent 如何使用这些工具上给出了很多指导。

协议的设计目标，决定了谁能从中获益。

---

## 三、Skills 的杀手锏：渐进式披露

除了设计目标不同，Skills 还有一个技术上的优势：**渐进式披露（Progressive Disclosure）**。

这是什么意思？用一个类比来解释：图书馆找书。

想象你去图书馆找资料：

**MCP 方式**：管理员把整个书架的书全搬到你面前。结果：**信息过载，找不到重点** 📚📚📚

**Skill 方式**：管理员先给你一本目录，你说要哪本再拿哪本。结果：**精准高效** 📋→📖

![file](/img/mcp-vs-skills/b37eaedabfeddc4d6c4041f94b7489dc.jpg)

AI 的「脑容量」有限（Context Window）。

- **传统方式**：一次性加载所有工具定义。假设有 100 个工具，可能占用几十万 tokens。
- **Skill 方式**：启动时只加载名称和描述（约 100 tokens/skill）。需要哪个，再加载哪个的详细指令。

根据 [agentskills.io 官方规范](https://agentskills.io/what-are-skills)：

- 元数据层：~100 tokens/skill
- 完整指令：建议 <5000 tokens

这意味着什么？100 个 Skills，启动时只需要约 10,000 tokens 的元数据。而不是一股脑塞进去几十万 tokens。

1. AI 不会被无关信息干扰，更聪明
2. 响应更快
3. 能支持更多工具

---

## 四、两者不是对手，是搭档

说了这么多 Skills 的好话，是不是意味着 MCP 没用了？不是。

**MCP 和 Skills 解决的是不同层次的问题**：

- **MCP = 工具箱**：定义了「能连接什么」——数据库、API、文件系统、第三方服务
- **Skills = 使用手册**：定义了「怎么聪明地用这些工具」——工作流程、最佳实践、按需加载

![file](/img/mcp-vs-skills/d4ec92d036a0957476520aeded13e755.jpg)

它们也可以结合使用：

> 用 Skills 的渐进式披露来管理 MCP 工具。

MCP 负责「连接」，Skills 负责「智慧」。组合是一个好的解决方案。

---

## 五、给用户的建议

1. **别光被 MCP 的热度带节奏**。22000+ 个仓库听起来很多，但落地的有多少呢？
2. **关注 Skills 生态**。如果你用 Claude Code 等工具（近期 Kwaipilot 也会支持），Skills 可能比 MCP 更能直接提升你的体验。
3. **两者都关注**。长期来看，MCP + Skills 的组合可能是一种选择。MCP 提供连接能力，Skills 提供使用智慧。
4. **2026 年**：渐进式披露和动态上下文管理会成为 AI 工具的标配。近期我的一个实践 —— 基于 20w 字的 Specs 来让 Agent 实现一个 10pd 需求 —— 也是通过渐进式披露 Specs。[Cursor 也已经给出了很好的解释](https://cursor.com/cn/blog/dynamic-context-discovery)。

---

## 结语

MCP 是最大骗局吗？不是。它也是一个优秀的开发者协议。

Skills 是救星吗？对用户来说，目前来说可能是的。

**协议的设计目标，决定了谁能从中获益。** MCP 让开发者更容易写工具，Skills 让用户更容易用工具。

如果你是用户，别纠结 MCP 为什么"不好用"了。去看看 Skills 吧。

---

## 参考链接

- [MCP 官方文档](https://modelcontextprotocol.io)
- [Agent Skills 官方规范](https://agentskills.io)
- [Anthropic Skills 发布公告](https://www.anthropic.com/news/skills)
- [开发者为什么吐槽 MCP 协议？](https://zhuanlan.zhihu.com/p/1982787663686819915)
