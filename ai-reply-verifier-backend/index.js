import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 导入路由
import verifyRouter from './api/verify.js';
import accountsRouter from './api/admin/accounts.js';
import licensesRouter from './api/admin/licenses.js';
import loginRouter from './api/admin/login.js';
import logsRouter from './api/admin/logs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- NEW: Serve Admin Frontend ---
// This will serve the HTML, CSS, and JS for your admin panel
app.use('/admin', express.static('admin'));

// Redirect /admin to /admin/index.html
app.get('/admin', (req, res) => {
  res.redirect('/admin/');
});

// 加载 API 路由
console.log('--- Loading API routes ---');

// 验证路由
app.use('/api/verify', verifyRouter);

// Admin 路由
const adminRoutes = {
  accounts: accountsRouter,
  licenses: licensesRouter,
  login: loginRouter,
  logs: logsRouter
};

Object.entries(adminRoutes).forEach(([name, router]) => {
  const route = `/api/admin/${name}`;
  console.log(`Registering admin route: ${route}`);
  app.use(route, router);
});

console.log('--- API routes loaded ---');

// Add a catch-all for the admin UI to handle client-side routing
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running successfully on http://localhost:${port}`);
}); 