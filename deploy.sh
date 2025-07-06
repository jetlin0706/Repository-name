#!/bin/bash

# 设置变量
BACKUP_DIR="/home/ubuntu/backups"
APP_DIR="/home/ubuntu/ai-reply-verifier-backend"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 创建备份目录（如果不存在）
mkdir -p $BACKUP_DIR

# 备份当前代码
echo "正在备份当前代码..."
if [ -d "$APP_DIR" ]; then
    cd $APP_DIR
    tar -czf "$BACKUP_DIR/backend-backup-$TIMESTAMP.tar.gz" .
    echo "备份完成：$BACKUP_DIR/backend-backup-$TIMESTAMP.tar.gz"
fi

# 解压新代码
echo "正在解压新代码..."
tar -xzf ../backend-update.tar.gz -C $APP_DIR

# 安装依赖
echo "正在安装依赖..."
cd $APP_DIR
npm install

# 重启服务
echo "正在重启服务..."
pm2 restart all

echo "部署完成！" 