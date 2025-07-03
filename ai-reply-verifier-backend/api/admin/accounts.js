// /api/admin/accounts
import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});
const JWT_SECRET = process.env.JWT_SECRET || 'ai-reply-secret';

// 鉴权中间件
function getAuthPayload(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const token = auth.replace('Bearer ', '');
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// 日志写入工具
async function writeLog(user, type, detail) {
  await redis.lpush('logs', JSON.stringify({
    username: user.username,
    role: user.role,
    type,
    detail,
    time: new Date().toISOString()
  }));
  await redis.ltrim('logs', 0, 999);
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 特殊路由: /me 获取当前用户信息
  if (req.url.endsWith('/me')) {
    const user = getAuthPayload(req);
    if (!user) return res.status(401).json({ error: '未登录或token无效' });
    return res.status(200).json({ 
      user: { 
        username: user.username, 
        role: user.role, 
        name: user.name 
      } 
    });
  }

  const user = getAuthPayload(req);
  if (!user) return res.status(401).json({ error: '未登录或token无效' });
  if (user.role !== 'admin') return res.status(403).json({ error: '无权限' });

  if (req.method === 'GET') {
    // 查询所有账号（不返回密码）
    const keys = await redis.keys('account:*');
    const accounts = [];
    for (const key of keys) {
      const raw = await redis.get(key);
      if (!raw) continue;
      let acc;
      try { acc = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { continue; }
      accounts.push({ username: acc.username, name: acc.name, role: acc.role, createdAt: acc.createdAt });
    }
    return res.status(200).json({ accounts });
  }

  if (req.method === 'POST') {
    // 新增代理商账号
    const { username, password, name } = req.body;
    if (!username || !password || !name) return res.status(400).json({ error: '参数不全' });
    const exists = await redis.get(`account:${username}`);
    if (exists) return res.status(409).json({ error: '账号已存在' });
    const passwordHash = await bcrypt.hash(password, 10);
    const acc = { username, passwordHash, role: 'agent', name, createdAt: new Date().toISOString() };
    await redis.set(`account:${username}`, JSON.stringify(acc));
    await writeLog(user, 'add_account', `添加账号:${username}(${name})`);
    return res.status(201).json({ message: '创建成功' });
  }

  if (req.method === 'DELETE') {
    // 删除账号
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: '缺少账号' });
    if (username === 'admin') return res.status(403).json({ error: '不能删除超级管理员' });
    await redis.del(`account:${username}`);
    await writeLog(user, 'delete_account', `删除账号:${username}`);
    return res.status(200).json({ message: '删除成功' });
  }

  res.status(405).json({ error: '不支持的方法' });
} 