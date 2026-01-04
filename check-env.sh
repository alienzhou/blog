#!/bin/bash

# 环境检查脚本
# 用于验证 Node.js 和 pnpm 版本是否符合项目要求

echo "🔍 检查开发环境..."
echo ""

# 检查 Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js: $NODE_VERSION"
    
    # 提取版本号（去掉 'v' 前缀）
    NODE_VERSION_NUM=${NODE_VERSION#v}
    REQUIRED_NODE="22.14.0"
    
    # 简单的版本比较（仅供参考）
    if [[ "$NODE_VERSION_NUM" < "$REQUIRED_NODE" ]]; then
        echo "⚠️  警告: Node.js 版本低于要求 (>= $REQUIRED_NODE)"
        echo "   建议运行: nvm install 22.14.0 && nvm use 22.14.0"
    fi
else
    echo "❌ Node.js 未安装"
    echo "   请访问: https://nodejs.org/ 或使用 nvm 安装"
    exit 1
fi

echo ""

# 检查 pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo "✅ pnpm: $PNPM_VERSION"
    
    REQUIRED_PNPM="10.7.0"
    if [[ "$PNPM_VERSION" < "$REQUIRED_PNPM" ]]; then
        echo "⚠️  警告: pnpm 版本低于要求 (>= $REQUIRED_PNPM)"
        echo "   建议运行: npm install -g pnpm@10.7.0"
    fi
else
    echo "❌ pnpm 未安装"
    echo "   请运行: npm install -g pnpm@10.7.0"
    exit 1
fi

echo ""

# 检查 nvm
if command -v nvm &> /dev/null; then
    echo "✅ nvm 已安装"
else
    echo "ℹ️  nvm 未安装（可选，但推荐使用）"
    echo "   安装方法: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
fi

echo ""
echo "📋 项目要求:"
echo "   Node.js >= 22.14.0"
echo "   pnpm >= 10.7.0"
echo ""

# 检查 .nvmrc
if [ -f ".nvmrc" ]; then
    NVMRC_VERSION=$(cat .nvmrc)
    echo "📌 .nvmrc 指定版本: $NVMRC_VERSION"
    echo "   运行 'nvm use' 切换到该版本"
fi

echo ""
echo "✨ 环境检查完成！"
