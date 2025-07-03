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

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // 检查请求体是否存在
    if (!req.body) {
      console.error('Login error: Request body is missing');
      return res.status(400).json({ error: '请求数据无效' });
    }

    const { username, password } = req.body;
    console.log(`Login attempt for username: ${username}`);

    if (!username || !password) {
      console.error(`Login error: Missing credentials - username: ${!!username}, password: ${!!password}`);
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    // 硬编码的测试账号 - 仅用于开发环境
    if (username === 'admin' && password === 'Aa123456.') {
      console.log('使用硬编码的测试账号登录成功');
      const testUser = {
        username: 'admin',
        role: 'admin',
        name: '超级管理员'
      };
      const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '2d' });
      return res.status(200).json({ token, user: testUser });
    }

    const userRaw = await redis.get(`account:${username}`);
    if (!userRaw) {
      console.error(`Login error: Account not found for username: ${username}`);
      return res.status(401).json({ error: '账号不存在' });
    }

    let user;
    try {
      user = typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw;
    } catch (error) {
      console.error(`Login error: Failed to parse user data for ${username}`, error);
      return res.status(500).json({ error: '账号数据异常' });
    }

    // 检查passwordHash是否存在
    if (!user.passwordHash) {
      console.error(`Login error: Password hash is missing for user: ${username}`);
      return res.status(500).json({ error: '账号数据异常，请联系管理员' });
    }

    try {
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        console.error(`Login error: Password mismatch for user: ${username}`);
        return res.status(401).json({ error: '密码错误' });
      }
    } catch (error) {
      console.error(`Login error: bcrypt compare failed for user: ${username}`, error);
      return res.status(500).json({ error: '登录验证失败，请联系管理员' });
    }

    // 生成JWT
    const token = jwt.sign({ username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '2d' });
    console.log(`Login successful for user: ${username}, role: ${user.role}`);
    res.status(200).json({ token, user: { username: user.username, role: user.role, name: user.name } });
  } catch (error) {
    console.error('Unexpected error in login handler:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
} 