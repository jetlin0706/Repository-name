import { Redis } from '@upstash/redis';
import jwt from 'jsonwebtoken';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});
const JWT_SECRET = process.env.JWT_SECRET || 'ai-reply-secret';
const LOG_KEY = 'logs';
const LOG_MAX = 1000; // 最多保留1000条

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = getAuthPayload(req);
  if (!user) return res.status(401).json({ error: '未登录或token无效' });

  if (req.method === 'POST') {
    // 写入日志
    const { type, detail } = req.body;
    if (!type) return res.status(400).json({ error: '缺少type' });
    const log = {
      username: user.username,
      role: user.role,
      type,
      detail: detail || '',
      time: new Date().toISOString()
    };
    await redis.lpush(LOG_KEY, JSON.stringify(log));
    await redis.ltrim(LOG_KEY, 0, LOG_MAX - 1); // 保留最新1000条
    return res.status(200).json({ message: '日志写入成功' });
  }

  if (req.method === 'GET') {
    // 分页查询日志
    const { page = 1, pageSize = 20 } = req.query;
    const start = (parseInt(page) - 1) * parseInt(pageSize);
    const end = start + parseInt(pageSize) - 1;
    const logsRaw = await redis.lrange(LOG_KEY, start, end);
    let logs = logsRaw.map(str => { try { return JSON.parse(str); } catch { return null; } }).filter(Boolean);
    // 代理商只看自己
    if (user.role !== 'admin') {
      logs = logs.filter(l => l.username === user.username);
    }
    return res.status(200).json({ logs });
  }

  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
} 