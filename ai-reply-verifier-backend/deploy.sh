#!/bin/bash

# 设置环境变量
export JWT_SECRET="ai-reply-secret"
export REDIS_URL="redis://localhost:6379"

# 安装依赖
npm install

# 重启PM2服务
pm2 restart api-server

# 显示服务状态
pm2 status
pm2 logs api-server --lines 50 