# blog

个人技术博客项目，基于 Hexo 静态博客生成器构建。

## ⚠️ 重要说明

- **README.md**: 这是博客的文章目录索引，作为 GitHub 仓库的首页展示博客内容，**请勿随意修改**
- **AGENTS.md**: 本文件是项目的开发文档，包含环境配置、开发流程、工具使用等信息
- **ENV.md**: 环境配置详细说明（Node.js、pnpm、nvm 等）

## 项目定位

- 基于 **Hexo 4.2.1** 的静态博客站点，部署于 https://www.alienzhou.com
- 主要内容聚焦于大前端领域：JavaScript、CSS、Webpack、PWA、性能优化、Node.js 等
- 使用 **Minos** 主题，支持本地搜索、评论、RSS 订阅等功能

## 目录速览

- `source/_posts/`：博客文章目录（Markdown 格式）
- `themes/minos/`：Minos 主题（布局模板、样式、脚本）
- `public/`：构建产物（静态 HTML/CSS/JS 文件）
- `scaffolds/`：文章模板（post、draft、page）
- `config/`：部署配置（Nginx、部署脚本）
- `tools/`：工具脚本（图片转换等）

## 快速上手

### 环境准备

```bash
# 1. 切换到正确的 Node.js 版本（使用 nvm）
nvm use

# 2. 安装依赖
pnpm install

# 3. 启动本地开发服务器
pnpm server

# 4. 访问 http://localhost:4000
```

> **环境要求**: Node.js >= 22.14.0，pnpm >= 10.7.0  
> **快速切换**: 项目已配置 `.nvmrc`，运行 `nvm use` 即可自动切换到正确版本  
> **详细说明**: 查看 [ENV.md](./ENV.md) 了解环境配置详情

## 常见工作流

| 场景 | 推荐步骤 |
|------|----------|
| 新建文章 | `hexo new "文章标题"` → 编辑 `source/_posts/文章标题.md` → `pnpm server` 预览 |
| 导入文章 | `node tools/import_article.js --file <文件路径>` → 自动处理图片和 front-matter |
| 新建草稿 | `hexo new draft "草稿标题"` → 编辑后使用 `hexo publish "草稿标题"` 发布 |
| 新建页面 | `hexo new page "页面名称"` → 编辑 `source/页面名称/index.md` |
| 本地预览 | `pnpm server` 启动本地服务器，访问 http://localhost:4000 |
| 构建部署 | `pnpm clean` → `pnpm build` → `./upload.sh` 上传到服务器 |
| 主题修改 | 编辑 `themes/minos/` 下的模板/样式 → `pnpm server` 实时预览 |

## 目录结构

```
blog/
├── _config.yml              # Hexo 主配置文件
├── package.json             # 项目依赖配置
├── README.md                # 博客文章目录索引
├── DEV.md                   # 开发文档
├── upload.sh                # 部署上传脚本
│
├── source/                  # 源文件目录
│   ├── _posts/              # 博客文章（Markdown）
│   └── img/                 # 文章图片资源
│
├── themes/                  # 主题目录
│   └── minos/               # Minos 主题
│       ├── _config.yml      # 主题配置
│       ├── layout/          # 页面模板（EJS）
│       │   ├── layout.ejs   # 主布局
│       │   ├── post.ejs     # 文章页面
│       │   ├── archive.ejs  # 归档页面
│       │   ├── comment/     # 评论组件
│       │   ├── search/      # 搜索组件
│       │   └── plugins/     # 插件（代码复制、图片画廊等）
│       ├── source/          # 主题静态资源
│       │   ├── css/         # SCSS 样式
│       │   └── js/          # JavaScript 脚本
│       ├── scripts/         # 主题脚本
│       └── languages/       # 国际化语言文件
│
├── public/                  # 构建产物（生成的静态文件）
│
├── scaffolds/               # 文章模板
│   ├── post.md              # 文章模板
│   ├── draft.md             # 草稿模板
│   └── page.md              # 页面模板
│
├── config/                  # 部署配置
│   ├── deploy.sh            # 服务器部署脚本
│   └── nginx/               # Nginx 配置
│       └── nginx.conf       # Nginx 主配置
│
└── tools/                   # 工具脚本
    ├── image_convert.js     # 图片格式转换（WebP → PNG）
    └── import_article.js    # 文章导入工具（自动下载图片）
```

## 配置说明

### Hexo 主配置（`_config.yml`）

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `title` | AlienZHOU 的个人站点 | 站点标题 |
| `url` | https://www.alienzhou.com | 站点 URL |
| `language` | zh-cn | 语言设置 |
| `timezone` | Asia/Shanghai | 时区 |
| `theme` | minos | 使用的主题 |
| `per_page` | 10 | 每页文章数 |
| `permalink` | :year/:month/:day/:title/ | 文章 URL 格式 |

### 主题配置（`themes/minos/_config.yml`）

| 配置项 | 说明 |
|--------|------|
| `logo.text` | Logo 显示文字 |
| `article.highlight` | 代码高亮主题（tomorrow-night-eighties） |
| `search.type` | 搜索类型（insight 本地搜索） |
| `comment.type` | 评论系统（disqus） |
| `toc` | 是否显示文章目录 |

## 文章编写规范

### Front-matter 格式

每篇文章开头需包含 YAML 格式的 front-matter：

```yaml
---
title: 文章标题
date: 2024-01-01 12:00:00
tags:
  - JavaScript
  - 前端
categories:
  - 技术
---
```

### 常用 Front-matter 字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `title` | 文章标题 | `title: 我的文章` |
| `date` | 发布日期 | `date: 2024-01-01 12:00:00` |
| `tags` | 标签列表 | `tags: [JavaScript, CSS]` |
| `categories` | 分类 | `categories: 技术` |
| `updated` | 更新日期 | `updated: 2024-01-02` |
| `comments` | 是否开启评论 | `comments: true` |

### 图片引用

文章中的图片放置在 `source/img/` 目录下，使用相对路径引用：

```markdown
![图片描述](/img/example.png)
```

**推荐做法**：使用 `import_article.js` 工具导入文章时，会自动：
- 下载文章中的远程图片到 `source/img/<文章名>/` 目录
- 替换图片链接为本地路径
- 按文章名称组织图片，避免混乱

## 常用命令

```bash
# 安装依赖
pnpm install

# 启动本地服务器（开发模式）
pnpm server

# 监听文件变化自动构建
pnpm watch

# 生成静态文件
pnpm build

# 清理构建缓存
pnpm clean

# 部署到服务器
pnpm deploy

# 创建新文章
hexo new "文章标题"

# 导入文章（自动处理图片）
node tools/import_article.js --file <文件路径>

# 创建草稿
hexo new draft "草稿标题"

# 发布草稿
hexo publish "草稿标题"

# 创建新页面
hexo new page "页面名称"
```

## 部署流程

### 本地构建

```bash
pnpm clean        # 清理旧的构建文件
pnpm build        # 生成静态文件到 public/
```

### 上传部署

```bash
./upload.sh       # 打包 public/ 并上传到服务器
```

服务器端会执行 `config/deploy.sh` 脚本完成部署，Nginx 配置位于 `config/nginx/nginx.conf`。

## 主题定制

### 修改样式

主题样式文件位于 `themes/minos/source/css/`，使用 SCSS 编写：

- `style.scss` - 主样式入口
- `_variables.scss` - 变量定义（颜色、字体等）
- `_article.scss` - 文章样式
- `_highlight.scss` - 代码高亮样式

### 修改布局

页面模板位于 `themes/minos/layout/`，使用 EJS 模板引擎：

- `layout.ejs` - 主布局模板
- `post.ejs` - 文章页面模板
- `archive.ejs` - 归档页面模板
- `index.ejs` - 首页模板

### 添加插件

插件模板位于 `themes/minos/layout/plugins/`：

- `copy-code.ejs` - 代码复制按钮
- `gallery.ejs` - 图片画廊
- `katex.ejs` / `mathjax.ejs` - 数学公式支持

## 博客内容分类

当前博客包含以下主要内容分类：

| 分类 | 说明 |
|------|------|
| 综合列表 | 前端技术清单、划词高亮、跨页面通信等 |
| 开源项目学习 | quicklink、JSON.stringify 性能优化等 |
| 自动化工具 | vite、snowpack、gulp、脚手架开发 |
| CSS 学习 | CSS 布局、主题样式实现 |
| 性能优化 | 前端性能优化指南、打包优化 |
| Webpack 进阶 | loader、plugin、模块化设计 |
| CSS 模块化 | BEM、CSS Modules、styled-components |
| PWA | 10 篇 PWA 学习与实践系列 |
| 排障系列 | DNS、gRPC、npm script 问题排查 |
| Node.js | Active Handle、Timer 优化 |

## 注意事项

### 图片处理

- 推荐使用 WebP 格式以减小文件体积
- 可使用 `tools/image_convert.js` 进行格式转换
- 图片命名使用小写字母和短横线

### 文章命名

- 文件名使用英文，避免中文和特殊字符
- 使用短横线分隔单词：`my-article-title.md`

### Git 提交

- `public/` 目录已加入 `.gitignore`，不需要提交构建产物
- `node_modules/` 不提交
- `db.json` 是 Hexo 缓存文件，可选择性提交

## 排障提示

| 问题 | 解决方案 |
|------|----------|
| 构建失败 | 运行 `pnpm clean` 清理缓存后重新构建 |
| 样式不更新 | 检查浏览器缓存，或强制刷新（Ctrl+Shift+R） |
| 文章不显示 | 检查 front-matter 格式是否正确，日期是否为未来时间 |
| 图片不显示 | 检查图片路径是否正确，确保以 `/img/` 开头 |
| 本地服务器报错 | 检查端口 4000 是否被占用 |

## 提交前检查

- 确保文章 front-matter 格式正确
- 本地预览确认文章显示正常
- 检查图片是否正确加载
- 确认代码块语法高亮正常
- 运行 `pnpm build` 确保构建成功
