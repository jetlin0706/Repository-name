# AI回复点评助手管理系统

## 访问方式

本系统已部署到GitHub Pages，您可以通过以下链接访问：

- GitHub Pages: [https://jetlin0706.github.io/repository-name-v2/](https://jetlin0706.github.io/repository-name-v2/)

## 部署方案

本项目采用前后端分离的架构，使用以下部署方案解决中国大陆访问问题：

1. **前端部署**：使用GitHub Pages部署静态前端资源
2. **后端部署**：使用Vercel部署API后端，选择东京区域(hnd1)服务器

## 部署步骤

### 1. GitHub Pages部署（前端）

1. Fork本仓库到您自己的GitHub账号
2. 在仓库设置中启用GitHub Pages
   - 进入仓库设置 -> Pages
   - Source选择"GitHub Actions"
   - 会自动使用`.github/workflows/gh-pages.yml`配置文件
3. 修改CNAME文件（如果您有自己的域名）
   - 编辑`.github/workflows/gh-pages.yml`文件
   - 将`echo "your-domain.com" > CNAME`中的域名替换为您自己的域名
4. 推送更改到main分支，GitHub Actions会自动部署

### 2. Vercel部署（后端）

1. 登录Vercel并导入`ai-reply-verifier-backend`目录
2. 在项目设置中，配置以下内容：
   - 构建命令：`npm install`
   - 输出目录：`public`
   - 环境变量：根据需要设置
3. 在"Settings" -> "Functions" -> "Region Selection"中选择"hnd1"(东京)区域
4. 部署项目
5. 获取部署后的域名，更新前端代码中的API地址

### 3. 配置前端API地址

1. 编辑`admin/script.js`文件
2. 将`apiBaseUrl`变量中的Vercel URL替换为您自己的Vercel部署URL
3. 推送更改并重新部署

## 技术说明

- 前端通过CORS跨域请求访问Vercel上的API
- Vercel部署在东京区域(hnd1)，对中国大陆访问更友好
- 静态资源通过GitHub Pages提供，解决了Vercel在中国大陆的访问问题

## 常见问题

1. **为什么选择这种部署方式？**
   - Vercel在某些区域的服务器对中国大陆访问不稳定
   - 东京区域(hnd1)的服务器对中国大陆访问更友好
   - GitHub Pages提供稳定的静态资源托管

2. **如何更新系统？**
   - 前端更新：修改代码后推送到GitHub仓库
   - 后端更新：在Vercel上重新部署项目

3. **如何排查访问问题？**
   - 检查浏览器控制台是否有跨域错误
   - 确认Vercel API是否可以直接访问
   - 验证GitHub Pages是否正常部署
