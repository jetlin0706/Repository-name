// /api/admin/accounts
import express from 'express';
import Redis from 'ioredis';
import bcrypt from 'bcryptjs';
import auth from '../middleware/auth.js';

const router = express.Router();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

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

// 获取当前用户信息
router.get('/me', auth, (req, res) => {
  console.log('返回当前用户信息:', req.user);
  return res.status(200).json({ 
    user: { 
      username: req.user.username, 
      role: req.user.role, 
      name: req.user.name 
    } 
  });
});

// 获取所有账号
router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权访问' });
  }
  try {
    // 1. 获取所有授权码并计算每个创建者的数量
    const allLicensesRaw = await redis.hgetall('licenses');
    const licenseCounts = {};
    for (const key in allLicensesRaw) {
      try {
        const license = JSON.parse(allLicensesRaw[key]);
        const creator = license.creator || 'N/A';
        licenseCounts[creator] = (licenseCounts[creator] || 0) + 1;
      } catch (e) {
        console.error(`Error parsing license ${key} for counting:`, e);
      }
    }

    // 2. 获取所有账号并附加酒店数量
    const accountKeys = await redis.keys('account:*');
    const accounts = [];
    for (const key of accountKeys) {
      try {
        const accountRaw = await redis.get(key);
        const account = JSON.parse(accountRaw);
        delete account.passwordHash;
        // 附加酒店数量
        account.hotelCount = licenseCounts[account.username] || 0;
        accounts.push(account);
      } catch (e) {
        console.error(`Error processing account ${key}:`, e);
      }
    }
    
    // 确保admin账号存在于列表中
    if (!accounts.some(acc => acc.username === 'admin')) {
      const adminAccount = { 
          username: 'admin', 
          name: '超级管理员', 
          role: 'admin', 
          createdAt: 'N/A', 
          hotelCount: licenseCounts['admin'] || 0
      };
      accounts.push(adminAccount);
    }
    
    res.status(200).json(accounts);
  } catch (error) {
    res.status(500).json({ message: '服务器内部错误' });
  }
});

// 创建新账号
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权操作' });
  }
  const { username, password, name } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ message: '缺少必要字段' });
  }
  try {
    const existing = await redis.exists(`account:${username}`);
    if (existing) {
      return res.status(409).json({ message: '用户名已存在' });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const newAccount = {
      username,
      passwordHash,
      name,
      role: 'agent',
      createdAt: new Date().toISOString()
    };
    await redis.set(`account:${username}`, JSON.stringify(newAccount));
    
    delete newAccount.passwordHash;
    await writeLog(req.user, 'add_account', `添加合作伙伴:${username}(${name})`);
    res.status(201).json(newAccount);
  } catch (error) {
    res.status(500).json({ message: '创建失败' });
  }
});

// 删除账号
router.delete('/:username', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权操作' });
  }
  const { username } = req.params;
  if (username === 'admin') {
    return res.status(400).json({ message: '不能删除主管理员账号' });
  }
  try {
    const result = await redis.del(`account:${username}`);
    if (result === 0) {
      return res.status(404).json({ message: '用户不存在' });
    }
    await writeLog(req.user, 'delete_account', `删除账号:${username}`);
    res.status(200).json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除失败' });
  }
});

export default router; 