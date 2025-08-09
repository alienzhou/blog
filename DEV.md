# 开发文档 (DEV.md)

## 本地开发启动流程

### 环境要求

- Node.js >= 22.14.0
- pnpm 10.7.0

### 快速开始

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd blog
   ```

2. **安装依赖**

```bash
pnpm install
```

4. **构建**

```bash
pnpm build
```

### 创建新文章

```bash
# 创建新文章
hexo new "文章标题"

# 创建新页面
hexo new page "页面名称"

# 创建草稿
hexo new draft "草稿标题"
```

## 环境变量说明

### 站点配置 (_config.yml)

主要配置项说明：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `title` | 站点标题 | AlienZHOU 的个人站点 |
| `subtitle` | 站点副标题 | '' |
| `description` | 站点描述 | 个人博客，分享JavaScript、CSS... |
| `url` | 站点 URL | https://www.alienzhou.com |
| `language` | 站点语言 | zh-cn |
| `timezone` | 时区 | Asia/Shanghai |
| `theme` | 使用的主题 | minos |


### RSS 配置

```yaml
feed:
  type: rss2
  path: rss.xml
  limit: 20  # RSS 文章数量限制
```

## 目录结构

```
blog/
├── _config.yml          # Hexo 主配置文件
├── package.json         # 项目依赖配置
├── source/              # 源文件目录
│   ├── _posts/          # 文章目录
│   └── ...
├── themes/              # 主题目录
│   └── minos/           # Minos 主题
├── public/              # 生成的静态文件（构建后）
├── scaffolds/           # 文章模板
└── node_modules/        # 依赖包
```

## 构建与部署说明

### 本地构建

```bash
# 清理之前的构建文件
pnpm clean

# 生成静态文件
pnpm build
```

构建完成后，静态文件将生成在 `public/` 目录中。

### 部署流程

#### 手动部署

1. **构建项目**

```bash
pnpm build
```

2. **上传 public 目录**

将 `public/` 目录中的所有文件上传到你的 Web 服务器

### 部署配置选项

根据部署目标，可以在 `_config.yml` 中配置不同的部署方式：

```yaml
# GitHub Pages
deploy:
  type: git
  repo: https://github.com/username/username.github.io.git
  branch: master

# FTP
deploy:
  type: ftpsync
  host: your-ftp-host
  user: your-username
  pass: your-password
  remote: /path/to/website/
```

## 开发注意事项

1. **文章格式**: 使用 Markdown 格式编写文章
2. **图片资源**: 建议将图片放在 `source/images/` 目录
3. **主题定制**: 主题文件位于 `themes/minos/` 目录
4. **缓存清理**: 如遇到构建问题，先尝试 `pnpm clean`
5. **端口冲突**: 默认端口 4000，如有冲突可在启动时指定端口

## 故障排除

### 常见问题

1. **构建失败**: 检查 Node.js 版本是否符合要求
2. **主题问题**: 确认主题文件完整性
3. **端口占用**: 使用 `hexo server -p 端口号` 指定其他端口
4. **依赖问题**: 删除 `node_modules` 重新安装

### 获取帮助

- [Hexo 官方文档](https://hexo.io/docs/)
- [Minos 主题文档](https://github.com/ppoffice/hexo-theme-minos)