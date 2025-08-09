#!/usr/bin/env bash

# 设置变量
SERVER=$SERVER
USER=$USER
REMOTE_PATH="/home/"$USER"/blog/archive/"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="blog-${TIMESTAMP}.tar.gz"

echo "开始打包 public 目录..."

# 1. 打包 public 目录
if tar -czf "$ARCHIVE_NAME" -C . public; then
    echo "✅ 打包完成: $ARCHIVE_NAME"
else
    echo "❌ 打包失败"
    exit 1
fi

echo "开始上传到服务器..."

# 提示用户准备输入密码
echo "准备上传到 ${USER}@${SERVER}:${REMOTE_PATH}"
echo "请在下面的提示中输入服务器密码："

# 2. 上传到服务器 (scp 会自动提示输入密码)
if scp "$ARCHIVE_NAME" "${USER}@${SERVER}:${REMOTE_PATH}"; then
    echo "✅ 上传完成"
else
    echo "❌ 上传失败"
    rm "$ARCHIVE_NAME"
    exit 1
fi

# 3. 清理本地临时文件
rm "$ARCHIVE_NAME"
echo "✅ 本地临时文件已清理"

echo "🎉 部署完成！文件已上传到 ${SERVER}:${REMOTE_PATH}${ARCHIVE_NAME}"