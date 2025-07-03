import { Redis } from '@upstash/redis';
import jwt from 'jsonwebtoken';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});
const JWT_SECRET = process.env.JWT_SECRET || 'ai-reply-secret';

// 鉴权中间件，返回payload
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
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = getAuthPayload(req);
  if (!user) return res.status(401).json({ message: '未登录或token无效' });

  if (req.method === 'GET') {
    // 获取所有激活码
    const all = await redis.hgetall('licenses');
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    let licenseArray = Object.values(all).map(val => {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return null; }
      } else if (typeof val === 'object' && val !== null) {
        return val;
      }
      return null;
    }).filter(Boolean);

    // 代理商只看自己
    if (user.role !== 'admin') {
      licenseArray = licenseArray.filter(l => l.createdBy === user.username);
    }

    // 基础统计
    const total = licenseArray.length;
    const active = licenseArray.filter(l => new Date(l.expiryDate) > now).length;
    const todayActivations = licenseArray.reduce((count, license) => {
      const activationsToday = (license.activations || []).filter(act => act.timestamp && act.timestamp.startsWith(today)).length;
      return count + activationsToday;
    }, 0);

    // 管理员统计各代理商分布
    let agentStats = [];
    if (user.role === 'admin') {
      // 获取所有账号
      const keys = await redis.keys('account:*');
      const agents = [];
      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;
        let acc;
        try { acc = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { continue; }
        if (acc.role === 'agent') {
          agents.push({ username: acc.username, name: acc.name });
        }
      }
      // 统计每个代理商的激活码数量
      agentStats = agents.map(agent => {
        const agentLicenses = licenseArray.filter(l => l.createdBy === agent.username);
        return {
          username: agent.username,
          name: agent.name,
          licenseCount: agentLicenses.length,
          activeCount: agentLicenses.filter(l => new Date(l.expiryDate) > now).length,
          todayActivations: agentLicenses.reduce((count, license) => {
            const activationsToday = (license.activations || []).filter(act => act.timestamp && act.timestamp.startsWith(today)).length;
            return count + activationsToday;
          }, 0)
        };
      });
    }

    return res.status(200).json({
      total,
      active,
      todayActivations,
      agentStats
    });
  }

  res.setHeader('Allow', ['GET', 'OPTIONS']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
} 