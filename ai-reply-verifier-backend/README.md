# AI回复验证后端

这是携程AI回复助手的授权验证后端服务。

## 部署步骤

1. 在Vercel上创建新项目，关联此仓库
2. 在Vercel项目设置中添加以下环境变量：

```
# 管理员密码
ADMIN_PASSWORD=your_admin_password

# KV数据库连接信息 (需要在Vercel控制台获取)
KV_URL=your_kv_database_url
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token
KV_REST_API_READ_ONLY_TOKEN=your_kv_read_only_token
```

3. 在Vercel控制台中创建KV数据库，并获取连接信息
4. 部署完成后，将部署URL更新到前端代码中：
   - 打开 `携程AI回复点评/popup/popup.js`
   - 将 `VERIFIER_URL` 更新为 `https://你的域名.vercel.app/api/verify`

## 使用管理后台

部署完成后，访问 `https://你的域名.vercel.app/admin` 可以管理授权码。

## 403错误排查

如果验证时出现403错误，请检查：

1. 前端URL是否正确配置
2. Vercel KV数据库是否正确配置
3. 授权码是否已添加到数据库
4. 授权码是否过期 