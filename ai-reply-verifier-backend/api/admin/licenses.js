import express from 'express';
import Redis from 'ioredis';
import auth from '../middleware/auth.js';

const router = express.Router();
const redis = new Redis(process.env.REDIS_URL);

// [GET] /api/admin/licenses - 获取所有授权码
router.get('/', auth, async (req, res) => {
    try {
        const licenses = await redis.hgetall('licenses');
        const parsedLicenses = {};
        const currentUser = req.user;

        for (const key in licenses) {
            try {
                const license = JSON.parse(licenses[key]);

                // 如果不是admin，则只显示自己创建的
                if (currentUser.role !== 'admin' && license.creator !== currentUser.username) {
                    continue; // 跳过不属于自己的授权码
                }

                parsedLicenses[key] = license;
            } catch (e) {
                console.error(`Error parsing license key ${key}:`, e);
                parsedLicenses[key] = {}; // 出错时返回空对象
            }
        }
        res.status(200).json(parsedLicenses);
    } catch (error) {
        res.status(500).json({ message: '服务器内部错误' });
    }
});

// [POST] /api/admin/licenses - 新增或更新授权码
router.post('/', auth, async (req, res) => {
    const { key, hotelName, startDate, expiryDate } = req.body;
    if (!key || !hotelName || !startDate || !expiryDate) {
        return res.status(400).json({ message: '缺少必要字段' });
    }

    try {
        const existingLicenseRaw = await redis.hget('licenses', key);
        const isUpdate = !!existingLicenseRaw;
        let existingData = {};
        if (isUpdate) {
            try { existingData = JSON.parse(existingLicenseRaw); } catch { existingData = {}; }
        }

        const licenseData = {
            hotelName,
            startDate,
            expiryDate,
            creator: req.user.username,
            createdTime: isUpdate ? existingData.createdTime : new Date().toISOString(),
            updatedTime: new Date().toISOString(),
            status: isUpdate ? existingData.status : '有效',
            activationCount: isUpdate ? existingData.activationCount : 0,
            activations: existingData.activations || []
        };

        await redis.hset('licenses', key, JSON.stringify(licenseData));
        res.status(201).json({ message: `授权码已${isUpdate ? '更新' : '创建'}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '操作失败' });
    }
});

// [DELETE] /api/admin/licenses/:key - 删除授权码
router.delete('/:key', auth, async (req, res) => {
    const { key } = req.params;
    if (!key) {
        return res.status(400).json({ message: '缺少授权码key' });
    }
    try {
        const result = await redis.hdel('licenses', key);
        if (result === 0) {
            return res.status(404).json({ message: '授权码不存在' });
        }
        res.status(200).json({ message: '删除成功' });
    } catch (error) {
        res.status(500).json({ message: '服务器内部错误' });
    }
});

export default router; 