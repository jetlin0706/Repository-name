import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-reply-secret';

const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: '认证失败，缺少Token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Attach user info to request
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token无效或已过期' });
    }
};

// 假设 writeLog 功能暂时不需要，以保证主流程稳定
// export const writeLog = async (user, action, detail) => { ... };

export default auth;

// 管理员权限中间件
export const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    console.error(`Permission Error: User ${req.user?.username} with role ${req.user?.role} attempted admin action.`);
    return res.status(403).json({ message: '无权执行此操作' });
  }
}; 