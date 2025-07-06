// /api/admin/verify-token
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-reply-secret';

// 这个文件不再需要 express router，因为它被 index.js 直接作为中间件使用
export default (req, res) => {
    // CORS 头在全局中间件中处理，这里不再需要
    
    // 只允许GET请求
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      res.status(200).json({
        valid: true,
        user: {
          username: decoded.username,
          role: decoded.role,
          name: decoded.name
        }
      });
    } catch (error) {
      // 根据错误类型返回不同信息
      const message = error.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token';
      res.status(401).json({ valid: false, message });
    }
}; 