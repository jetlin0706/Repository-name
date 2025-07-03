import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});
const JWT_SECRET = process.env.JWT_SECRET || 'ai-reply-secret';

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
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = getAuthPayload(req);
  if (!user) return res.status(401).json({ error: '未登录或token无效' });

  if (req.method === 'POST') {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) return res.status(400).json({ error: '缺少参数' });
    // 只有管理员能重置任意账号，代理商只能重置自己
    if (user.role !== 'admin' && user.username !== username) {
      return res.status(403).json({ error: '无权限重置他人密码' });
    }
    const userRaw = await redis.get(`account:${username}`);
    if (!userRaw) return res.status(404).json({ error: '账号不存在' });
    let acc;
    try { acc = typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw; } catch { return res.status(500).json({ error: '账号数据异常' }); }
    acc.passwordHash = await bcrypt.hash(newPassword, 10);
    await redis.set(`account:${username}`, JSON.stringify(acc));
    await writeLog(user, 'reset_password', `重置密码:${username}`);
    return res.status(200).json({ message: '密码重置成功' });
  }

  res.setHeader('Allow', ['POST', 'OPTIONS']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
} 