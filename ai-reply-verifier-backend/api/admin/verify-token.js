// /api/admin/verify-token
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-reply-secret';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 只允许GET请求
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // 获取Authorization头
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        valid: false, 
        message: 'No token provided' 
      });
    }

    // 提取token
    const token = authHeader.split(' ')[1];
    
    try {
      // 验证token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // 返回验证结果和用户信息
      res.status(200).json({
        valid: true,
        user: {
          username: decoded.username,
          role: decoded.role,
          name: decoded.name
        }
      });
    } catch (error) {
      // token验证失败
      console.error('Token verification failed:', error);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          valid: false,
          message: 'Token has expired'
        });
      }
      
      return res.status(401).json({
        valid: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Unexpected error in verify-token handler:', error);
    res.status(500).json({ 
      valid: false,
      error: '服务器内部错误' 
    });
  }
} 