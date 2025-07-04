import { Redis } from '@upstash/redis';
import jwt from 'jsonwebtoken';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});
const JWT_SECRET = process.env.JWT_SECRET || 'ai-reply-secret';

// 鉴权中间件，返回payload
function getAuthPayload(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const token = auth.replace('Bearer ', '');
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// 获取指定时间段的开始时间
function getPeriodStartDate(period = 'month') {
  const now = new Date();
  const startDate = new Date(now);
  
  switch (period) {
    case 'day':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      // 获取本周一
      const day = startDate.getDay() || 7; // 周日是0，转为7
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
      return null; // 不限制开始时间
  }
  
  return startDate;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = getAuthPayload(req);
  if (!user) return res.status(401).json({ message: '未登录或token无效' });

  if (req.method === 'GET') {
    // 获取查询参数
    const period = req.query.period || 'month';
    const periodStartDate = getPeriodStartDate(period);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // 获取所有激活码
    const all = await redis.hgetall('licenses');
    let licenseArray = Object.values(all).map(val => {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return null; }
      } else if (typeof val === 'object' && val !== null) {
        return val;
      }
      return null;
    }).filter(Boolean);

    // 代理商只看自己
    if (user.role !== 'admin') {
      licenseArray = licenseArray.filter(l => l.createdBy === user.username);
    }

    // 基础统计
    const total = licenseArray.length;
    const active = licenseArray.filter(l => new Date(l.expiryDate) > now).length;
    
    // 根据周期过滤激活数据
    const filteredLicenses = periodStartDate ? 
      licenseArray.filter(l => {
        // 检查创建时间是否在周期内
        if (l.createdTime && new Date(l.createdTime) >= periodStartDate) {
          return true;
        }
        // 检查激活记录是否在周期内
        return (l.activations || []).some(act => 
          act.timestamp && new Date(act.timestamp) >= periodStartDate
        );
      }) : licenseArray;
    
    // 计算当前周期的激活次数
    const periodActivations = licenseArray.reduce((count, license) => {
      if (!periodStartDate) return count + (license.activations || []).length;
      
      const activationsInPeriod = (license.activations || []).filter(act => 
        act.timestamp && new Date(act.timestamp) >= periodStartDate
      ).length;
      return count + activationsInPeriod;
    }, 0);

    // 管理员统计各代理商分布
    let agentStats = [];
    if (user.role === 'admin') {
      // 获取所有账号
      const keys = await redis.keys('account:*');
      const agents = [];
      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;
        let acc;
        try { acc = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { continue; }
        if (acc.role === 'agent') {
          agents.push({ username: acc.username, name: acc.name });
        }
      }
      
      // 获取上一个周期的数据作为比较
      const getPreviousPeriodStart = () => {
        if (!periodStartDate) return null;
        
        const prevStart = new Date(periodStartDate);
        switch (period) {
          case 'day':
            prevStart.setDate(prevStart.getDate() - 1);
            break;
          case 'week':
            prevStart.setDate(prevStart.getDate() - 7);
            break;
          case 'month':
            prevStart.setMonth(prevStart.getMonth() - 1);
            break;
          case 'year':
            prevStart.setFullYear(prevStart.getFullYear() - 1);
            break;
          default:
            return null;
        }
        return prevStart;
      };
      
      const prevPeriodStart = getPreviousPeriodStart();
      
      // 统计每个代理商的激活码数量
      agentStats = agents.map(agent => {
        const agentLicenses = licenseArray.filter(l => l.createdBy === agent.username);
        
        // 当前周期激活次数
        const currentPeriodActivations = agentLicenses.reduce((count, license) => {
          if (!periodStartDate) return count + (license.activations || []).length;
          
          const activationsInPeriod = (license.activations || []).filter(act => 
            act.timestamp && new Date(act.timestamp) >= periodStartDate
          ).length;
          return count + activationsInPeriod;
        }, 0);
        
        // 上一周期激活次数（用于计算趋势）
        const previousPeriodActivations = prevPeriodStart ? agentLicenses.reduce((count, license) => {
          const activationsInPrevPeriod = (license.activations || []).filter(act => 
            act.timestamp && 
            new Date(act.timestamp) >= prevPeriodStart && 
            new Date(act.timestamp) < periodStartDate
          ).length;
          return count + activationsInPrevPeriod;
        }, 0) : 0;
        
        // 计算趋势（正数表示上升，负数表示下降，0表示不变）
        const trend = previousPeriodActivations > 0 ? 
          Math.round((currentPeriodActivations - previousPeriodActivations) / previousPeriodActivations * 100) : 
          (currentPeriodActivations > 0 ? 100 : 0);
        
        return {
          username: agent.username,
          name: agent.name,
          licenseCount: agentLicenses.length,
          activeCount: agentLicenses.filter(l => new Date(l.expiryDate) > now).length,
          todayActivations: currentPeriodActivations,
          trend: trend
        };
      });
    }

    return res.status(200).json({
      total,
      active,
      todayActivations: periodActivations,
      period,
      agentStats
    });
  }

  res.setHeader('Allow', ['GET', 'OPTIONS']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
} 