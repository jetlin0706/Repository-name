import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Redis from 'ioredis';

// 导入所有路由和中间件
import verifyRouter from './api/verify.js';
import accountsRouter from './api/admin/accounts.js';
import licensesRouter from './api/admin/licenses.js';
import loginRouter from './api/admin/login.js';
import logsRouter from './api/admin/logs.js';
import dashboardRouter from './api/admin/dashboard.js';
import resetPasswordRouter from './api/admin/reset-password.js';
import verifyTokenHandler from './api/admin/verify-token.js'; // 注意这里是 handler

const app = express();
const port = process.env.PORT || 3002;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 全局中间件
app.use(cors());
app.use(express.json());

// 静态文件服务
const adminPath = path.join(__dirname, 'public', 'admin');
app.use('/admin', express.static(adminPath));

// API 路由注册
app.use('/api/verify', verifyRouter);
app.use('/api/admin/accounts', accountsRouter);
app.use('/api/admin/licenses', licensesRouter);
app.use('/api/admin/login', loginRouter);
app.use('/api/admin/logs', logsRouter);
app.use('/api/admin/dashboard', dashboardRouter);
app.use('/api/admin/reset-password', resetPasswordRouter);
app.use('/api/admin/verify-token', verifyTokenHandler); // 直接使用 handler

// 后台 SPA 路由 Fallback
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(adminPath, 'index.html'));
});

// 启动服务器
app.listen(port, () => {
    console.log(`Server is running successfully on http://localhost:${port}`);
}); 