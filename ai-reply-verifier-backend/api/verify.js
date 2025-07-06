import express from 'express';
import Redis from 'ioredis';

const router = express.Router();
const redis = new Redis(process.env.REDIS_URL);

// [POST] /api/verify - 验证授权码
router.post('/', async (req, res) => {
    const { licenseKey, machineId } = req.body;
    if (!licenseKey || !machineId) {
        return res.status(400).json({ valid: false, message: '缺少licenseKey或machineId' });
    }

    try {
        const licenseRaw = await redis.hget('licenses', licenseKey);
        if (!licenseRaw) {
            return res.status(404).json({ valid: false, message: '授权码不存在' });
        }

        const license = JSON.parse(licenseRaw);
        const now = new Date();

        if (new Date(license.expiryDate) < now) {
            return res.status(403).json({ valid: false, message: '授权码已过期' });
        }
        
        // --- 更新激活信息 ---
        const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        // 检查这个 machineId 是否已经激活过
        const isAlreadyActivated = license.activations.some(act => act.machineId === machineId);

        if (!isAlreadyActivated) {
            license.activations.push({ 
                machineId, 
                ip: clientIp,
                time: new Date().toISOString() 
            });
            license.activationCount = (license.activationCount || 0) + 1;
            license.status = '已激活'; // 更新状态
        }

        // 无论是否是首次激活，都更新最后激活时间和IP
        license.lastActivationIp = clientIp;
        license.lastActivationTime = new Date().toISOString();

        await redis.hset('licenses', licenseKey, JSON.stringify(license));
        // --- 激活信息更新完毕 ---

        res.status(200).json({
            valid: true,
            hotelName: license.hotelName,
            expiryDate: license.expiryDate
        });

    } catch (error) {
        console.error('验证授权码失败:', error);
        res.status(500).json({ valid: false, message: '服务器内部错误' });
    }
});

export default router; 