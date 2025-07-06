import express from 'express';
import Redis from 'ioredis';
import auth from '../middleware/auth.js';

const router = express.Router();
const redis = new Redis(process.env.REDIS_URL);

// [GET] /api/admin/logs - 获取操作日志
router.get('/', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: '无权访问' });
    }
    try {
        const logs = await redis.lrange('logs', 0, -1);
        const parsedLogs = logs.map(log => {
            try {
                return JSON.parse(log);
            } catch {
                return { error: 'Invalid log entry' };
            }
        });
        res.status(200).json(parsedLogs);
    } catch (error) {
        console.error('获取日志失败:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

export default router; 