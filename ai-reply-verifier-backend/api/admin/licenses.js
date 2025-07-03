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

  const user = getAuthPayload(req);
  if (!user) return res.status(401).json({ message: '未登录或token无效' });

  if (req.method === 'GET') {
    // 管理员查全部，代理商查自己
    const all = await redis.hgetall('licenses');
    const result = {};
    for (const key in all) {
      let lic;
      try { lic = typeof all[key] === 'string' ? JSON.parse(all[key]) : all[key]; } catch { continue; }
      if (user.role === 'admin' || lic.createdBy === user.username) {
        result[key] = lic;
      }
    }
    return res.status(200).json(result);
  }

  if (req.method === 'POST') {
    // 创建/更新激活码，createdBy归属
    const { licenseKey, hotelName, startDate, expiryDate } = req.body;
    if (!licenseKey || !hotelName || !expiryDate || !startDate) {
      return res.status(400).json({ message: '缺少字段' });
    }
    // 只允许代理商/管理员创建
    const existingRaw = await redis.hget('licenses', licenseKey);
    let activations = [];
    let createdBy = user.username;
    if (existingRaw) {
      let existing;
      try { existing = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw; } catch { existing = {}; }
      activations = existing.activations || [];
      createdBy = existing.createdBy || user.username;
      // 代理商只能更新自己创建的
      if (user.role !== 'admin' && createdBy !== user.username) {
        return res.status(403).json({ message: '无权修改他人激活码' });
      }
    }
    const licenseData = { hotelName, startDate, expiryDate, activations, createdBy };
    await redis.hset('licenses', { [licenseKey]: JSON.stringify(licenseData) });
    await writeLog(user, existingRaw ? 'update_license' : 'add_license', `${existingRaw ? '更新' : '添加'}激活码:${licenseKey}(${hotelName})`);
    return res.status(200).json({ message: '保存成功' });
  }

  if (req.method === 'DELETE') {
    const { licenseKey } = req.body;
    if (!licenseKey) return res.status(400).json({ message: '缺少licenseKey' });
    const raw = await redis.hget('licenses', licenseKey);
    if (!raw) return res.status(404).json({ message: '激活码不存在' });
    let lic;
    try { lic = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { lic = {}; }
    // 代理商只能删自己创建的
    if (user.role !== 'admin' && lic.createdBy !== user.username) {
      return res.status(403).json({ message: '无权删除他人激活码' });
    }
    await redis.hdel('licenses', licenseKey);
    await writeLog(user, 'delete_license', `删除激活码:${licenseKey}(${lic.hotelName || ''})`);
    return res.status(200).json({ message: '删除成功' });
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
} 