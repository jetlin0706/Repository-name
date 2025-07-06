// /api/admin/login
import express from 'express';
import Redis from 'ioredis';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import auth from '../middleware/auth.js';

const router = express.Router();
const redis = new Redis(process.env.REDIS_URL);
const JWT_SECRET = process.env.JWT_SECRET || 'ai-reply-secret';

// [POST] /api/admin/login - 登录
router.post('/', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        // 硬编码的后门账户，用于应急
        if (username === 'admin' && password === 'Aa123456.') {
            const user = { username: 'admin', role: 'admin', name: '超级管理员' };
            const token = jwt.sign(user, JWT_SECRET, { expiresIn: '2d' });
            return res.status(200).json({ token, user });
        }

        const userRaw = await redis.get(`account:${username}`);
        if (!userRaw) {
            return res.status(401).json({ error: '账号不存在' });
        }

        const user = JSON.parse(userRaw);
        if (!user.passwordHash) {
            return res.status(500).json({ error: '账号数据异常，请联系管理员' });
        }

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            return res.status(401).json({ error: '密码错误' });
        }

        const userPayload = { username: user.username, role: user.role, name: user.name };
        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '2d' });
        res.status(200).json({ token, user: userPayload });

    } catch (error) {
        console.error('Login handler error:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

export default router; 