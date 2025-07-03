// /api/admin/login
import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const JWT_SECRET = process.env.JWT_SECRET || 'ai-reply-secret';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  const userRaw = await redis.get(`account:${username}`);
  if (!userRaw) {
    return res.status(401).json({ error: '账号不存在' });
  }
  let user;
  try {
    user = typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw;
  } catch {
    return res.status(500).json({ error: '账号数据异常' });
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: '密码错误' });
  }
  // 生成JWT
  const token = jwt.sign({ username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '2d' });
  res.status(200).json({ token, user: { username: user.username, role: user.role, name: user.name } });
} 