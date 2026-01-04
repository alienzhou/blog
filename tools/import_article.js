#!/usr/bin/env node

/**
 * 博客文章导入工具
 * 用于将 Markdown 文章导入到 Hexo 博客项目中
 * 
 * 使用方法：
 * 1. 从文件导入：node tools/import_article.js --file <文件路径>
 * 2. 从剪贴板导入：node tools/import_article.js --clipboard
 * 3. 交互式导入：node tools/import_article.js
 * 
 * 功能：
 * - 自动提取文章标题并生成文件名
 * - 自动生成 front-matter（如果不存在）
 * - 下载文章中的远程图片到本地
 * - 按文章名称组织图片目录
 * - 替换图片链接为本地路径
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// 配置
const CONFIG = {
  postsDir: path.join(__dirname, '../source/_posts'),
  imgDir: path.join(__dirname, '../source/img'),
  draftsDir: path.join(__dirname, '../drafts'),  // 草稿目录
  scaffoldPath: path.join(__dirname, '../scaffolds/post.md'),
  downloadTimeout: 30000, // 图片下载超时时间（毫秒）
};

/**
 * 从 Markdown 内容中提取标题
 * @param {string} content - Markdown 内容
 * @returns {string|null} - 提取的标题
 */
function extractTitle(content) {
  // 尝试从 front-matter 中提取标题
  const frontMatterMatch = content.match(/^---\s*\ntitle:\s*(.+?)\s*\n/m);
  if (frontMatterMatch) {
    return frontMatterMatch[1].trim();
  }

  // 尝试从第一个 # 标题中提取
  const h1Match = content.match(/^#\s+(.+?)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return null;
}

/**
 * 从 Markdown 内容中提取所有图片链接
 * @param {string} content - Markdown 内容
 * @returns {Array<{url: string, alt: string, match: string}>} - 图片信息数组
 */
function extractImageUrls(content) {
  const images = [];
  // 匹配 Markdown 图片语法：![alt](url)
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
    const url = match[2].trim();
    // 只处理远程图片（http/https）
    if (url.startsWith('http://') || url.startsWith('https://')) {
      images.push({
        url: url,
        alt: match[1] || '',
        match: match[0], // 完整的匹配字符串，用于替换
      });
    }
  }

  return images;
}

/**
 * 下载图片到本地
 * @param {string} url - 图片 URL
 * @param {string} destPath - 目标路径
 * @returns {Promise<void>}
 */
function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => {
      reject(new Error(`下载超时: ${url}`));
    }, CONFIG.downloadTimeout);

    protocol.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        clearTimeout(timeout);
        const redirectUrl = response.headers.location;
        downloadImage(redirectUrl, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        clearTimeout(timeout);
        reject(new Error(`下载失败 (${response.statusCode}): ${url}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        clearTimeout(timeout);
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        clearTimeout(timeout);
        fs.unlink(destPath, () => {}); // 删除不完整的文件
        reject(err);
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * 生成图片文件名
 * @param {string} url - 图片 URL
 * @param {number} index - 图片索引
 * @returns {string} - 文件名
 */
function generateImageFileName(url, index) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = path.extname(pathname) || '.jpg';
    const basename = path.basename(pathname, ext);
    
    // 清理文件名
    let cleanName = basename
      .replace(/[^\w-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    // 如果文件名太长或为空，使用索引
    if (!cleanName || cleanName.length > 50) {
      cleanName = `image-${index + 1}`;
    }
    
    return `${cleanName}${ext}`;
  } catch (err) {
    return `image-${index + 1}.jpg`;
  }
}

/**
 * 下载文章中的所有图片
 * @param {string} content - Markdown 内容
 * @param {string} articleSlug - 文章 slug（用于创建图片目录）
 * @returns {Promise<{content: string, downloadedCount: number}>} - 更新后的内容和下载数量
 */
async function downloadArticleImages(content, articleSlug) {
  const images = extractImageUrls(content);
  
  if (images.length === 0) {
    console.log('📷 未发现远程图片');
    return { content, downloadedCount: 0 };
  }

  console.log(`📷 发现 ${images.length} 张远程图片，开始下载...`);

  // 创建文章专属图片目录
  const articleImgDir = path.join(CONFIG.imgDir, articleSlug);
  if (!fs.existsSync(articleImgDir)) {
    fs.mkdirSync(articleImgDir, { recursive: true });
  }

  let updatedContent = content;
  let downloadedCount = 0;

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const fileName = generateImageFileName(image.url, i);
    const destPath = path.join(articleImgDir, fileName);
    const relativePath = `/img/${articleSlug}/${fileName}`;

    try {
      console.log(`  [${i + 1}/${images.length}] 下载: ${image.url}`);
      await downloadImage(image.url, destPath);
      
      // 替换图片链接
      const newImageMarkdown = `![${image.alt}](${relativePath})`;
      updatedContent = updatedContent.replace(image.match, newImageMarkdown);
      
      downloadedCount++;
      console.log(`  ✓ 已保存到: ${relativePath}`);
    } catch (err) {
      console.error(`  ✗ 下载失败: ${err.message}`);
      console.log(`  保留原始链接: ${image.url}`);
    }
  }

  console.log(`✅ 成功下载 ${downloadedCount}/${images.length} 张图片`);
  return { content: updatedContent, downloadedCount };
}

/**
 * 从标题生成 slug（用于文件名和图片目录）
 * @param {string} title - 文章标题
 * @returns {string} - slug
 */
function generateSlugFromTitle(title) {
  // 移除特殊字符，转换为小写，空格替换为短横线
  let slug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // 移除特殊字符（包括中文）
    .replace(/\s+/g, '-')      // 空格替换为短横线
    .replace(/-+/g, '-')       // 多个短横线合并为一个
    .replace(/^-|-$/g, '');    // 移除首尾短横线

  // 如果 slug 为空（比如纯中文标题），返回空字符串
  return slug || '';
}

/**
 * 生成文件名（英文小写，短横线分隔）
 * @param {string} title - 文章标题
 * @returns {string} - 文件名
 */
function generateFileName(title) {
  const slug = generateSlugFromTitle(title);
  
  // 如果文件名为空或只包含中文，使用时间戳
  if (!slug || slug.length === 0) {
    return `article-${Date.now()}.md`;
  }

  return `${slug}.md`;
}

/**
 * 检查文件是否已存在，如果存在则添加数字后缀
 * @param {string} fileName - 文件名
 * @returns {string} - 唯一的文件名
 */
function ensureUniqueFileName(fileName) {
  const baseName = path.basename(fileName, '.md');
  let uniqueFileName = fileName;
  let counter = 1;

  while (fs.existsSync(path.join(CONFIG.postsDir, uniqueFileName))) {
    uniqueFileName = `${baseName}-${counter}.md`;
    counter++;
  }

  return uniqueFileName;
}

/**
 * 检查内容是否已包含 front-matter
 * @param {string} content - Markdown 内容
 * @returns {boolean}
 */
function hasFrontMatter(content) {
  return /^---\s*\n[\s\S]*?\n---\s*\n/.test(content);
}

/**
 * 生成 front-matter
 * @param {string} title - 文章标题
 * @param {string} content - 原始内容
 * @returns {string} - 包含 front-matter 的完整内容
 */
function generateFrontMatter(title, content) {
  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);

  // 如果已经有 front-matter，直接返回原内容
  if (hasFrontMatter(content)) {
    console.log('✓ 检测到文章已包含 front-matter，保持原样');
    return content;
  }

  // 生成新的 front-matter
  const frontMatter = `---
title: ${title}
date: ${dateStr}
tags:
---

`;

  // 移除原内容中的第一个 # 标题（如果存在）
  const contentWithoutH1 = content.replace(/^#\s+.+?\n\n?/m, '');

  return frontMatter + contentWithoutH1;
}

/**
 * 提示用户输入标题
 * @returns {Promise<string>} - 用户输入的标题
 */
async function promptForTitle() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('📝 请输入文章标题：', (answer) => {
      rl.close();
      const title = answer.trim();
      if (title) {
        resolve(title);
      } else {
        console.error('❌ 标题不能为空');
        process.exit(1);
      }
    });
  });
}

/**
 * 提示用户输入文件名（slug）
 * @param {string} suggestedSlug - 建议的文件名
 * @returns {Promise<string>} - 用户确认或输入的文件名
 */
async function promptForSlug(suggestedSlug) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = suggestedSlug 
      ? `📄 请输入文件名 (直接回车使用 "${suggestedSlug}")：`
      : '📄 请输入文件名（英文小写，短横线分隔）：';

    rl.question(prompt, (answer) => {
      rl.close();
      const slug = answer.trim();
      
      if (slug) {
        // 清理用户输入的文件名
        const cleanSlug = slug
          .toLowerCase()
          .replace(/\.md$/, '')  // 移除 .md 后缀
          .replace(/[^\w-]/g, '-')  // 非字母数字替换为短横线
          .replace(/-+/g, '-')  // 多个短横线合并
          .replace(/^-|-$/g, '');  // 移除首尾短横线
        
        if (cleanSlug) {
          resolve(cleanSlug);
        } else {
          console.error('❌ 无效的文件名');
          process.exit(1);
        }
      } else if (suggestedSlug) {
        resolve(suggestedSlug);
      } else {
        console.error('❌ 文件名不能为空');
        process.exit(1);
      }
    });
  });
}

/**
 * 导入文章
 * @param {string} content - Markdown 内容
 * @param {string} sourceFile - 源文件路径（可选）
 */
async function importArticle(content, sourceFile = null) {
  // 提取标题
  let title = extractTitle(content);
  
  // 如果无法提取标题，让用户输入
  if (!title) {
    console.log('⚠️  未能从文章中提取标题');
    title = await promptForTitle();
  }

  console.log(`📝 文章标题：${title}`);

  // 生成建议的文件名：优先使用源文件名，否则从标题生成
  let suggestedSlug = '';
  if (sourceFile) {
    // 从源文件名提取 slug（去掉路径和 .md 后缀）
    suggestedSlug = path.basename(sourceFile, '.md');
  }
  // 如果源文件名为空或无效，从标题生成
  if (!suggestedSlug) {
    suggestedSlug = generateSlugFromTitle(title);
  }
  
  // 让用户确认或输入文件名
  const slug = await promptForSlug(suggestedSlug);
  const fileName = ensureUniqueFileName(`${slug}.md`);
  const articleSlug = path.basename(fileName, '.md');
  
  console.log(`📁 文件名：${fileName}`);
  console.log(`📁 图片目录：/img/${articleSlug}/`);

  // 下载图片并更新内容
  const { content: updatedContent } = await downloadArticleImages(content, articleSlug);

  // 生成完整内容
  const fullContent = generateFrontMatter(title, updatedContent);

  // 确保目标目录存在
  if (!fs.existsSync(CONFIG.postsDir)) {
    fs.mkdirSync(CONFIG.postsDir, { recursive: true });
  }

  // 写入文件
  const targetPath = path.join(CONFIG.postsDir, fileName);
  fs.writeFileSync(targetPath, fullContent, 'utf8');
  console.log(`✅ 文章已成功导入到：${targetPath}`);

  // 如果是从文件导入，询问是否删除源文件
  if (sourceFile && fs.existsSync(sourceFile)) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('是否删除源文件？(y/N) ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        fs.unlinkSync(sourceFile);
        console.log(`🗑️  源文件已删除：${sourceFile}`);
      }
      rl.close();
    });
  }
}

/**
 * 从 drafts 目录选择文件（使用上下键交互式选择）
 * @returns {Promise<string|null>} - 选择的文件路径
 */
async function selectDraftFile() {
  // 确保 drafts 目录存在
  if (!fs.existsSync(CONFIG.draftsDir)) {
    fs.mkdirSync(CONFIG.draftsDir, { recursive: true });
    console.log('📁 已创建 drafts 目录，请将草稿文件放入该目录');
    return null;
  }

  // 读取 drafts 目录中的 .md 文件
  const files = fs.readdirSync(CONFIG.draftsDir)
    .filter(file => file.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    console.log('📁 drafts 目录为空，请先将 Markdown 文件放入 drafts/ 目录');
    return null;
  }

  // 获取文件信息
  const fileInfos = files.map(file => {
    const filePath = path.join(CONFIG.draftsDir, file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024).toFixed(2);
    return { name: file, path: filePath, size };
  });

  console.log('\n📚 发现以下草稿文件（使用 ↑↓ 键选择，回车确认）：\n');

  return new Promise((resolve) => {
    let selectedIndex = 0;

    // 渲染选择列表
    const renderList = () => {
      // 移动光标到列表开始位置并清除之前的内容
      process.stdout.write('\x1B[' + fileInfos.length + 'A'); // 向上移动
      
      fileInfos.forEach((file, index) => {
        const prefix = index === selectedIndex ? '  ▶ ' : '    ';
        const highlight = index === selectedIndex ? '\x1B[36m' : '\x1B[0m'; // 青色高亮
        const reset = '\x1B[0m';
        process.stdout.write('\x1B[2K'); // 清除当前行
        console.log(`${highlight}${prefix}${file.name} (${file.size} KB)${reset}`);
      });
    };

    // 初始渲染
    fileInfos.forEach((file, index) => {
      const prefix = index === selectedIndex ? '  ▶ ' : '    ';
      const highlight = index === selectedIndex ? '\x1B[36m' : '\x1B[0m';
      const reset = '\x1B[0m';
      console.log(`${highlight}${prefix}${file.name} (${file.size} KB)${reset}`);
    });

    // 设置原始模式以捕获按键
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const handleKeypress = (key) => {
      // Ctrl+C 退出
      if (key[0] === 3) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handleKeypress);
        console.log('\n已取消');
        resolve(null);
        return;
      }

      // 上箭头
      if (key[0] === 27 && key[1] === 91 && key[2] === 65) {
        selectedIndex = Math.max(0, selectedIndex - 1);
        renderList();
      }
      // 下箭头
      else if (key[0] === 27 && key[1] === 91 && key[2] === 66) {
        selectedIndex = Math.min(fileInfos.length - 1, selectedIndex + 1);
        renderList();
      }
      // 回车
      else if (key[0] === 13) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handleKeypress);
        console.log(`\n✅ 已选择: ${fileInfos[selectedIndex].name}\n`);
        resolve(fileInfos[selectedIndex].path);
      }
    };

    process.stdin.on('data', handleKeypress);
  });
}

/**
 * 从文件读取内容
 * @param {string} filePath - 文件路径
 * @returns {string} - 文件内容
 */
function readFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 错误：文件不存在 - ${filePath}`);
    process.exit(1);
  }

  return fs.readFileSync(filePath, 'utf8');
}

/**
 * 交互式输入
 */
async function interactiveInput() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('请输入 Markdown 文章内容（输入 EOF 或按 Ctrl+D 结束）：');
  console.log('---');

  let content = '';
  rl.on('line', (line) => {
    if (line.trim() === 'EOF') {
      rl.close();
    } else {
      content += line + '\n';
    }
  });

  rl.on('close', async () => {
    if (content.trim()) {
      await importArticle(content);
    } else {
      console.error('❌ 错误：未输入任何内容');
      process.exit(1);
    }
  });
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
博客文章导入工具

使用方法：
  node tools/import_article.js [选项]

选项：
  --file <路径>     从指定文件导入文章
  --help, -h        显示帮助信息

示例：
  # 从 drafts 目录选择文件导入（默认）
  node tools/import_article.js

  # 从指定文件导入
  node tools/import_article.js --file ./my-article.md

功能：
  - 自动提取文章标题并生成文件名
  - 自动生成 front-matter（如果不存在）
  - 自动下载文章中的远程图片到本地
  - 按文章名称组织图片目录（source/img/文章名/）
  - 自动替换图片链接为本地路径

工作流程：
  1. 将草稿文件放入 drafts/ 目录
  2. 运行 node tools/import_article.js
  3. 从列表中选择要导入的文件
  4. 自动处理并导入到 source/_posts/

文章要求：
  - 文章应包含标题（front-matter 中的 title 或第一个 # 标题）
  - 如果已包含 front-matter，将保持原样
  - 如果没有 front-matter，将自动生成
  - 远程图片（http/https）将自动下载到本地
`);
}

// 主程序
async function main() {
  const args = process.argv.slice(2);

  // 显示帮助
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  // 从指定文件导入
  const fileIndex = args.indexOf('--file');
  if (fileIndex !== -1 && args[fileIndex + 1]) {
    const filePath = path.resolve(args[fileIndex + 1]);
    const content = readFromFile(filePath);
    await importArticle(content, filePath);
    return;
  }

  // 默认：从 drafts 目录选择文件
  const selectedFile = await selectDraftFile();
  if (selectedFile) {
    const content = readFromFile(selectedFile);
    await importArticle(content, selectedFile);
  }
}

// 运行主程序
if (require.main === module) {
  main();
}

module.exports = {
  extractTitle,
  extractImageUrls,
  generateFileName,
  generateFrontMatter,
  downloadImage,
  downloadArticleImages,
  importArticle,
  selectDraftFile,
};
