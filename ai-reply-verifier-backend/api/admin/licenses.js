import { kv } from '@vercel/kv';
import jwt from 'jsonwebtoken';

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
  await kv.lpush('logs', JSON.stringify({
    username: user.username,
    role: user.role,
    type,
    detail,
    time: new Date().toISOString()
  }));
  await kv.ltrim('logs', 0, 999);
}

// 获取用户名称
async function getUserName(username) {
  if (username === 'admin') return '超级管理员';
  
  try {
    const accountData = await kv.get(`account:${username}`);
    if (!accountData) return username;
    
    const account = typeof accountData === 'string' ? JSON.parse(accountData) : accountData;
    return account.name || username;
  } catch (error) {
    console.error('获取用户名称失败:', error);
    return username;
  }
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
    const all = await kv.hgetall('licenses');
    const result = {};
    
    // 获取所有合作伙伴的名称映射
    const accountKeys = await kv.keys('account:*');
    const accountMap = {};
    
    for (const key of accountKeys) {
      const username = key.replace('account:', '');
      const accountData = await kv.get(key);
      if (!accountData) continue;
      
      try {
        const account = typeof accountData === 'string' ? JSON.parse(accountData) : accountData;
        accountMap[username] = account.name || username;
      } catch (error) {
        console.error(`解析账号数据失败: ${key}`, error);
      }
    }
    
    for (const key in all) {
      let lic;
      try { lic = typeof all[key] === 'string' ? JSON.parse(all[key]) : all[key]; } catch { continue; }
      if (user.role === 'admin' || lic.createdBy === user.username) {
        // 添加创建人名称
        if (lic.createdBy) {
          lic.creatorName = lic.createdBy === 'admin' ? '超级管理员' : accountMap[lic.createdBy] || lic.createdBy;
        }
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
    const existingRaw = await kv.hget('licenses', licenseKey);
    let activations = [];
    let createdBy = user.username;
    let createdTime = new Date().toISOString();
    
    if (existingRaw) {
      let existing;
      try { existing = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw; } catch { existing = {}; }
      activations = existing.activations || [];
      createdBy = existing.createdBy || user.username;
      createdTime = existing.createdTime || createdTime;
      // 代理商只能更新自己创建的
      if (user.role !== 'admin' && createdBy !== user.username) {
        return res.status(403).json({ message: '无权修改他人激活码' });
      }
    }
    
    const licenseData = { 
      hotelName, 
      startDate, 
      expiryDate, 
      activations, 
      createdBy,
      createdTime
    };
    
    await kv.hset('licenses', { [licenseKey]: JSON.stringify(licenseData) });
    await writeLog(user, existingRaw ? 'update_license' : 'add_license', `${existingRaw ? '更新' : '添加'}激活码:${licenseKey}(${hotelName})`);
    return res.status(200).json({ message: '保存成功' });
  }

  if (req.method === 'DELETE') {
    const { licenseKey } = req.body;
    if (!licenseKey) return res.status(400).json({ message: '缺少licenseKey' });
    const raw = await kv.hget('licenses', licenseKey);
    if (!raw) return res.status(404).json({ message: '激活码不存在' });
    let lic;
    try { lic = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { lic = {}; }
    // 代理商只能删自己创建的
    if (user.role !== 'admin' && lic.createdBy !== user.username) {
      return res.status(403).json({ message: '无权删除他人激活码' });
    }
    await kv.hdel('licenses', licenseKey);
    await writeLog(user, 'delete_license', `删除激活码:${licenseKey}(${lic.hotelName || ''})`);
    return res.status(200).json({ message: '删除成功' });
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
} 