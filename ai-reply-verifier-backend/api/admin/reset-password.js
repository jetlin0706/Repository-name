import express from 'express';
import Redis from 'ioredis';
import bcrypt from 'bcryptjs';
import auth from '../middleware/auth.js';

const router = express.Router();
const redis = new Redis(process.env.REDIS_URL);

// [POST] /api/admin/reset-password - 重置用户密码
router.post('/', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: '只有管理员才能重置密码' });
    }

    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
        return res.status(400).json({ message: '缺少用户名或新密码' });
    }

    try {
        const accountKey = `account:${username}`;
        const userRaw = await redis.get(accountKey);
        if (!userRaw) {
            return res.status(404).json({ message: '用户不存在' });
        }

        const user = JSON.parse(userRaw);
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(newPassword, salt);
        
        await redis.set(accountKey, JSON.stringify(user));
        res.status(200).json({ message: '密码重置成功' });

    } catch (error) {
        console.error('重置密码失败:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

export default router; 