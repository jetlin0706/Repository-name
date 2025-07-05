// /api/admin/accounts
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-reply-secret';

// 鉴权中间件
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

// 日志写入工具
async function writeLog(user, type, detail) {
  await kv.lpush('logs', JSON.stringify({
    username: user.username,
    role: user.role,
    type,
    detail,
    time: new Date().toISOString()
  }));
  await kv.ltrim('logs', 0, 999);
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 特殊路由: /me 获取当前用户信息
    const pathParts = req.url.split('?')[0].split('/');
    const lastPathPart = pathParts[pathParts.length - 1];
    
    if (lastPathPart === 'me') {
      const user = getAuthPayload(req);
      if (!user) return res.status(401).json({ error: '未登录或token无效' });
      return res.status(200).json({ 
        user: { 
          username: user.username, 
          role: user.role, 
          name: user.name 
        } 
      });
    }

    const user = getAuthPayload(req);
    if (!user) return res.status(401).json({ error: '未登录或token无效' });
    if (user.role !== 'admin') return res.status(403).json({ error: '无权限' });

    if (req.method === 'GET') {
      // 查询所有账号（不返回密码）
      console.log('获取账号列表，请求用户:', user.username);
      
      // 始终添加admin账户到列表中，确保它总是显示在列表中
      const accounts = [
        {
          username: 'admin',
          name: '超级管理员',
          role: 'admin',
          createdAt: '—'
        }
      ];
      
      try {
        const keys = await kv.keys('account:*');
        console.log(`找到${keys.length}个账号记录，keys:`, keys);
        
        for (const key of keys) {
          const raw = await kv.get(key);
          console.log(`获取到账号数据 ${key}:`, raw);
          
          if (!raw) {
            console.log(`账号 ${key} 数据为空，跳过`);
            continue;
          }
          
          let acc;
          try { 
            acc = typeof raw === 'string' ? JSON.parse(raw) : raw;
            console.log(`解析后的账号数据:`, acc);
            
            // 确保不将admin重复添加到列表中
            if (acc.username !== 'admin') {
              accounts.push({ 
                username: acc.username, 
                name: acc.name, 
                role: acc.role, 
                createdAt: acc.createdAt 
              });
              console.log(`添加账号 ${acc.username} 到列表`);
            } else {
              console.log(`跳过admin账号，因为已经添加过了`);
            }
          } catch (e) { 
            console.error(`解析账号数据出错 ${key}:`, e);
            continue; 
          }
        }
      } catch (e) {
        console.error('获取账号列表出错:', e);
        // 即使出错，依然返回admin账号
      }
      
      console.log(`返回${accounts.length}个账号:`, accounts);
      return res.status(200).json({ accounts });
    }

    if (req.method === 'POST') {
      // 检查请求体是否存在
      if (!req.body) {
        console.error('添加账号错误: 请求体不存在');
        return res.status(400).json({ error: '请求数据无效' });
      }
      
      // 新增代理商账号
      const { username, password, name } = req.body;
      console.log(`尝试添加账号: ${username}, 名称: ${name}, 操作者: ${user.username}`);
      
      // 验证所有必填参数
      if (!username) {
        console.error('添加账号错误: 缺少用户名');
        return res.status(400).json({ error: '用户名不能为空' });
      }
      if (!password) {
        console.error('添加账号错误: 缺少密码');
        return res.status(400).json({ error: '密码不能为空' });
      }
      if (!name) {
        console.error('添加账号错误: 缺少名称');
        return res.status(400).json({ error: '名称不能为空' });
      }
      
      // 检查账号是否已存在
      const exists = await kv.get(`account:${username}`);
      if (exists) {
        console.error(`添加账号错误: 账号 ${username} 已存在`);
        return res.status(409).json({ error: '账号已存在' });
      }
      
      try {
        // 生成密码哈希
        console.log('生成密码哈希...');
        const passwordHash = await bcrypt.hash(password, 10);
        
        // 验证哈希是否有效
        const verifyHash = await bcrypt.compare(password, passwordHash);
        if (!verifyHash) {
          throw new Error('密码哈希验证失败');
        }
        
        // 创建账号数据
        const acc = { 
          username, 
          passwordHash, 
          role: 'agent', 
          name, 
          createdAt: new Date().toISOString() 
        };
        
        // 写入数据库
        console.log(`写入账号数据: ${username}`);
        await kv.set(`account:${username}`, JSON.stringify(acc));
        
        // 记录日志
        await writeLog(user, 'add_account', `添加合作伙伴:${username}(${name})`);
        console.log(`账号 ${username} 创建成功`);
        
        return res.status(201).json({ message: '创建成功' });
      } catch (error) {
        console.error(`添加账号过程中出错:`, error);
        return res.status(500).json({ error: '创建账号失败，请稍后重试' });
      }
    }

    if (req.method === 'DELETE') {
      // 确保请求体已解析
      console.log('DELETE请求体:', req.body);
      
      // 检查请求体格式
      let username;
      if (typeof req.body === 'string') {
        try {
          // 尝试解析JSON字符串
          const parsedBody = JSON.parse(req.body);
          username = parsedBody.username;
        } catch (error) {
          console.error('解析DELETE请求体失败:', error);
          return res.status(400).json({ error: '无效的请求格式' });
        }
      } else if (req.body && typeof req.body === 'object') {
        // 已经是对象格式
        username = req.body.username;
      } else {
        console.error('DELETE请求体格式错误');
        return res.status(400).json({ error: '无效的请求格式' });
      }
      
      if (!username) {
        console.error('删除账号错误: 缺少用户名');
        return res.status(400).json({ error: '缺少账号' });
      }
      
      console.log(`尝试删除账号: ${username}, 操作者: ${user.username}`);
      
      if (username === 'admin') {
        console.error('删除账号错误: 尝试删除超级管理员');
        return res.status(403).json({ error: '不能删除超级管理员' });
      }
      
      try {
        // 检查账号是否存在
        const accountExists = await kv.get(`account:${username}`);
        if (!accountExists) {
          console.error(`删除账号错误: 账号 ${username} 不存在`);
          return res.status(404).json({ error: '账号不存在' });
        }
        
        await kv.del(`account:${username}`);
        await writeLog(user, 'delete_account', `删除账号:${username}`);
        console.log(`账号 ${username} 删除成功`);
        
        return res.status(200).json({ message: '删除成功' });
      } catch (error) {
        console.error(`删除账号过程中出错:`, error);
        return res.status(500).json({ error: '删除账号失败，请稍后重试' });
      }
    }

    res.status(405).json({ error: '不支持的方法' });
  } catch (error) {
    console.error('账号管理接口出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
} 