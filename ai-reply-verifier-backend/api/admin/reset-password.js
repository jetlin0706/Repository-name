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

  try {
    const user = getAuthPayload(req);
    if (!user) return res.status(401).json({ error: '未登录或token无效' });

    if (req.method === 'POST') {
      // 检查请求体是否存在
      console.log('重置密码请求体:', req.body);
      
      if (!req.body) {
        console.error('重置密码错误: 请求体不存在');
        return res.status(400).json({ error: '请求数据无效' });
      }
      
      // 检查请求体格式
      let username, newPassword;
      if (typeof req.body === 'string') {
        try {
          // 尝试解析JSON字符串
          const parsedBody = JSON.parse(req.body);
          username = parsedBody.username;
          newPassword = parsedBody.newPassword;
        } catch (error) {
          console.error('解析POST请求体失败:', error);
          return res.status(400).json({ error: '无效的请求格式' });
        }
      } else if (req.body && typeof req.body === 'object') {
        // 已经是对象格式
        username = req.body.username;
        newPassword = req.body.newPassword;
      } else {
        console.error('POST请求体格式错误');
        return res.status(400).json({ error: '无效的请求格式' });
      }
      
      // 验证必填参数
      if (!username) {
        console.error('重置密码错误: 缺少用户名');
        return res.status(400).json({ error: '缺少用户名' });
      }
      
      if (!newPassword) {
        console.error('重置密码错误: 缺少新密码');
        return res.status(400).json({ error: '缺少新密码' });
      }
      
      console.log(`尝试重置密码: ${username}, 操作者: ${user.username}`);
      
      // 只有管理员能重置任意账号，代理商只能重置自己
      if (user.role !== 'admin' && user.username !== username) {
        console.error(`无权限重置密码: ${user.username} 尝试重置 ${username} 的密码`);
        return res.status(403).json({ error: '无权限重置他人密码' });
      }
      
      // 检查账号是否存在
      const userRaw = await redis.get(`account:${username}`);
      if (!userRaw) {
        console.error(`重置密码错误: 账号 ${username} 不存在`);
        return res.status(404).json({ error: '账号不存在' });
      }
      
      let acc;
      try { 
        acc = typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw; 
      } catch (error) { 
        console.error(`解析账号数据失败: ${username}`, error);
        return res.status(500).json({ error: '账号数据异常' }); 
      }
      
      try {
        // 生成新的密码哈希
        console.log(`为 ${username} 生成新的密码哈希`);
        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        // 验证哈希是否有效
        const verifyHash = await bcrypt.compare(newPassword, passwordHash);
        if (!verifyHash) {
          throw new Error('密码哈希验证失败');
        }
        
        // 更新账号数据
        acc.passwordHash = passwordHash;
        await redis.set(`account:${username}`, JSON.stringify(acc));
        
        // 记录日志
        await writeLog(user, 'reset_password', `重置密码:${username}`);
        console.log(`${username} 密码重置成功`);
        
        return res.status(200).json({ message: '密码重置成功' });
      } catch (error) {
        console.error(`重置密码过程中出错:`, error);
        return res.status(500).json({ error: '重置密码失败，请稍后重试' });
      }
    }

    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('重置密码接口出错:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
} 