# 博客工具脚本

本目录包含用于博客管理的实用工具脚本。

## 文章导入工具 (import_article.js)

自动化导入 Markdown 文章到 Hexo 博客，支持自动下载远程图片并组织文件结构。

### 功能特性

✅ **自动提取标题**：从 front-matter 或第一个 `#` 标题中提取文章标题  
✅ **智能文件命名**：根据标题生成规范的文件名（小写、短横线分隔）  
✅ **自动生成 front-matter**：如果文章没有 front-matter，自动生成标准格式  
✅ **下载远程图片**：自动下载文章中的所有远程图片（http/https）  
✅ **图片目录管理**：按文章名称组织图片到 `source/img/<文章名>/` 目录  
✅ **自动替换链接**：将远程图片链接替换为本地路径  
✅ **防止文件冲突**：自动检测并避免文件名冲突  

### 使用方法

#### 推荐方式：从 drafts 目录选择（最简单）

```bash
# 1. 将草稿文件放入 drafts 目录
cp ~/Downloads/my-article.md drafts/

# 2. 运行导入工具
node tools/import_article.js

# 3. 从列表中选择要导入的文件
# 📚 发现以下草稿文件：
#
#   [1] my-article.md (12.34 KB)
#   [2] another-draft.md (8.56 KB)
#
# 请选择要导入的文件（输入序号）：1
```

#### 方式二：从指定文件导入

```bash
node tools/import_article.js --file <文件路径>
```

示例：
```bash
node tools/import_article.js --file ~/Downloads/my-article.md
```

#### 查看帮助

```bash
node tools/import_article.js --help
```

### 工作流程

**推荐工作流程（使用 drafts 目录）：**

1. **放置草稿**：将 Markdown 文件复制到 `drafts/` 目录
2. **运行工具**：执行 `node tools/import_article.js`
3. **选择文件**：从列表中选择要导入的文件（输入序号）
4. **自动处理**：
   - 提取标题并生成文件名
   - 扫描并下载所有远程图片
   - 图片保存到 `source/img/<文章名>/` 目录
   - 替换图片链接为本地路径
   - 生成 front-matter（如果需要）
5. **保存文章**：处理后的文章保存到 `source/_posts/` 目录
6. **清理源文件**：可选择是否删除 drafts 中的源文件

### 示例

假设你有一篇文章 `example.md`：

```markdown
# 我的技术文章

这是一篇关于前端技术的文章。

![示例图片](https://example.com/images/demo.png)

## 内容

...
```

运行导入命令：

```bash
node tools/import_article.js --file example.md
```

输出：

```
📝 文章标题：我的技术文章
📄 文件名：-md
📷 发现 1 张远程图片，开始下载...
  [1/1] 下载: https://example.com/images/demo.png
  ✓ 已保存到: /img/-/demo.png
✅ 成功下载 1/1 张图片
✅ 文章已成功导入到：/path/to/blog/source/_posts/-md
是否删除源文件？(y/N)
```

生成的文章 `source/_posts/my-article.md`：

```markdown
---
title: 我的技术文章
date: 2024-01-01 12:00:00
tags:
---

这是一篇关于前端技术的文章。

![示例图片](/img/my-article/demo.png)

## 内容

...
```

图片目录结构：

```
source/img/
└── my-article/
    └── demo.png
```

### 配置选项

可以在脚本顶部的 `CONFIG` 对象中修改配置：

```javascript
const CONFIG = {
  postsDir: path.join(__dirname, '../source/_posts'),  // 文章目录
  imgDir: path.join(__dirname, '../source/img'),       // 图片目录
  scaffoldPath: path.join(__dirname, '../scaffolds/post.md'),  // 模板路径
  downloadTimeout: 30000,  // 图片下载超时时间（毫秒）
};
```

### 注意事项

1. **Node.js 版本**：需要 Node.js >= 22.14.0（与项目要求一致）
2. **网络连接**：下载远程图片需要稳定的网络连接
3. **图片格式**：支持所有常见图片格式（jpg, png, gif, webp 等）
4. **超时处理**：默认 30 秒超时，可根据网络情况调整
5. **错误处理**：如果某张图片下载失败，会保留原始链接并继续处理其他图片
6. **文件名冲突**：如果文件名已存在，会自动添加数字后缀（如 `article-1.md`）

### 图片管理最佳实践

#### ✅ 推荐做法

- 使用 `import_article.js` 导入文章，自动按文章名称组织图片
- 每篇文章的图片存放在独立目录：`source/img/<文章名>/`
- 图片使用相对路径引用：`/img/<文章名>/image.png`

#### ❌ 不推荐做法

- 手动将图片平铺在 `source/img/` 根目录（难以管理）
- 使用绝对路径或外部链接（影响加载速度和稳定性）
- 图片文件名使用中文或特殊字符（可能导致兼容性问题）

### 故障排查

| 问题 | 解决方案 |
|------|----------|
| 无法提取标题 | 确保文章包含 front-matter 的 `title` 字段或第一个 `#` 标题 |
| 图片下载失败 | 检查网络连接，确认图片 URL 可访问 |
| 图片下载超时 | 增加 `CONFIG.downloadTimeout` 的值 |
| 文件名冲突 | 脚本会自动添加数字后缀，无需手动处理 |
| 图片路径错误 | 确保图片使用 `/img/` 开头的绝对路径 |

---

## 图片格式转换工具 (image_convert.js)

将 WebP 格式图片转换为 PNG 格式。

### 使用方法

```bash
node tools/image_convert.js <webp文件路径>
```

### 功能

- 将 WebP 图片转换为 PNG 格式
- 保留原始文件名（仅更改扩展名）
- 输出到相同目录

---

## 环境要求

- **Node.js**: >= 22.14.0
- **pnpm**: 10.7.0
- **依赖包**: 已在 `package.json` 中定义，运行 `pnpm install` 安装

## 贡献

如果你有新的工具脚本想法或改进建议，欢迎提交 PR！
