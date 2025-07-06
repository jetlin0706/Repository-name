import express from 'express';
import Redis from 'ioredis';
import auth from '../middleware/auth.js';

const router = express.Router();
const redis = new Redis(process.env.REDIS_URL);

// 获取指定时间段的开始时间
function getPeriodStartDate(period = 'month') {
    const now = new Date();
    now.setHours(now.getHours() + 8); // 修正为东八区时间
    const startDate = new Date(now);

    switch (period) {
        case 'today': // 增加 'today' 周期
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'week':
            const day = startDate.getDay() || 7;
            startDate.setDate(startDate.getDate() - day + 1);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'month':
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'year':
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'all':
        default:
            return null;
    }

    return startDate;
}

router.get('/', auth, async (req, res) => {
    try {
        const licenses = await redis.hgetall('licenses');
        const currentUser = req.user;
        
        let totalLicenses = 0;
        let activatedCount = 0;
        let todayActivations = 0;
        const today = new Date().toISOString().split('T')[0];

        for (const key in licenses) {
            try {
                const license = JSON.parse(licenses[key]);

                // 如果不是admin，则只处理自己创建的
                if (currentUser.role !== 'admin' && license.creator !== currentUser.username) {
                    continue; 
                }

                totalLicenses++; // 总数只计算自己名下的
                
                if (license.status === '已激活') {
                    activatedCount++;
                }

                if (license.activations && Array.isArray(license.activations)) {
                    license.activations.forEach(act => {
                        if (act.time && act.time.startsWith(today)) {
                            todayActivations++;
                        }
                    });
                }
            } catch (e) {
                console.error(`Error processing license ${key} for dashboard:`, e);
            }
        }

        res.status(200).json({
            totalLicenses,
            activatedCount,
            todayActivations,
        });
    } catch (error) {
        console.error('获取仪表盘数据失败:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

export default router; 