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

  try {
    // 特殊路由: /me 获取当前用户信息
    const pathParts = req.url.split('?')[0].split('/');
    const lastPathPart = pathParts[pathParts.length - 1];
    
    if (lastPathPart === 'me') {
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
      console.log('获取账号列表，请求用户:', user.username);
      const keys = await redis.keys('account:*');
      const accounts = [];
      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;
        let acc;
        try { acc = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { continue; }
        accounts.push({ username: acc.username, name: acc.name, role: acc.role, createdAt: acc.createdAt });
      }
      console.log(`获取到${accounts.length}个账号`);
      return res.status(200).json({ accounts });
    }

    if (req.method === 'POST') {
      // 检查请求体是否存在
      if (!req.body) {
        console.error('添加账号错误: 请求体不存在');
        return res.status(400).json({ error: '请求数据无效' });
      }
      
      // 新增代理商账号
      const { username, password, name } = req.body;
      console.log(`尝试添加账号: ${username}, 名称: ${name}, 操作者: ${user.username}`);
      
      // 验证所有必填参数
      if (!username) {
        console.error('添加账号错误: 缺少用户名');
        return res.status(400).json({ error: '用户名不能为空' });
      }
      if (!password) {
        console.error('添加账号错误: 缺少密码');
        return res.status(400).json({ error: '密码不能为空' });
      }
      if (!name) {
        console.error('添加账号错误: 缺少名称');
        return res.status(400).json({ error: '名称不能为空' });
      }
      
      // 检查账号是否已存在
      const exists = await redis.get(`account:${username}`);
      if (exists) {
        console.error(`添加账号错误: 账号 ${username} 已存在`);
        return res.status(409).json({ error: '账号已存在' });
      }
      
      try {
        // 生成密码哈希
        console.log('生成密码哈希...');
        const passwordHash = await bcrypt.hash(password, 10);
        
        // 验证哈希是否有效
        const verifyHash = await bcrypt.compare(password, passwordHash);
        if (!verifyHash) {
          throw new Error('密码哈希验证失败');
        }
        
        // 创建账号数据
        const acc = { 
          username, 
          passwordHash, 
          role: 'agent', 
          name, 
          createdAt: new Date().toISOString() 
        };
        
        // 写入数据库
        console.log(`写入账号数据: ${username}`);
        await redis.set(`account:${username}`, JSON.stringify(acc));
        
        // 记录日志
        await writeLog(user, 'add_account', `添加账号:${username}(${name})`);
        console.log(`账号 ${username} 创建成功`);
        
        return res.status(201).json({ message: '创建成功' });
      } catch (error) {
        console.error(`添加账号过程中出错:`, error);
        return res.status(500).json({ error: '创建账号失败，请稍后重试' });
      }
    }

    if (req.method === 'DELETE') {
      // 删除账号
      if (!req.body) {
        console.error('删除账号错误: 请求体不存在');
        return res.status(400).json({ error: '请求数据无效' });
      }
      
      const { username } = req.body;
      console.log(`尝试删除账号: ${username}, 操作者: ${user.username}`);
      
      if (!username) {
        console.error('删除账号错误: 缺少用户名');
        return res.status(400).json({ error: '缺少账号' });
      }
      
      if (username === 'admin') {
        console.error('删除账号错误: 尝试删除超级管理员');
        return res.status(403).json({ error: '不能删除超级管理员' });
      }
      
      try {
        // 检查账号是否存在
        const accountExists = await redis.get(`account:${username}`);
        if (!accountExists) {
          console.error(`删除账号错误: 账号 ${username} 不存在`);
          return res.status(404).json({ error: '账号不存在' });
        }
        
        await redis.del(`account:${username}`);
        await writeLog(user, 'delete_account', `删除账号:${username}`);
        console.log(`账号 ${username} 删除成功`);
        
        return res.status(200).json({ message: '删除成功' });
      } catch (error) {
        console.error(`删除账号过程中出错:`, error);
        return res.status(500).json({ error: '删除账号失败，请稍后重试' });
      }
    }

    res.status(405).json({ error: '不支持的方法' });
  } catch (error) {
    console.error('账号管理接口出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
} 