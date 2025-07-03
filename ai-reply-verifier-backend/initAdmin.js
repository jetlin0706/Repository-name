// 初始化管理员账号脚本
// 用法：node ai-reply-verifier-backend/initAdmin.js

const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');

// ====== 配置区 ======
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Aa123456.';
const ADMIN_NAME = '超级管理员';
const ADMIN_ROLE = 'admin';
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
// ====================

if (!KV_URL || !KV_TOKEN) {
  console.error('请先配置KV_REST_API_URL和KV_REST_API_TOKEN环境变量！');
  process.exit(1);
}

async function main() {
  try {
    console.log('开始初始化管理员账号...');
    console.log(`用户名: ${ADMIN_USERNAME}`);
    console.log(`角色: ${ADMIN_ROLE}`);
    
    // 生成密码哈希
    console.log('生成密码哈希...');
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    console.log('密码哈希生成成功');
    
    // 验证哈希是否有效
    const verifyHash = await bcrypt.compare(ADMIN_PASSWORD, passwordHash);
    if (!verifyHash) {
      throw new Error('密码哈希验证失败，可能是bcrypt库问题');
    }
    console.log('密码哈希验证成功');
    
    // 创建管理员数据
    const adminData = {
      username: ADMIN_USERNAME,
      passwordHash: passwordHash, // 确保字段名和值都正确
      role: ADMIN_ROLE,
      name: ADMIN_NAME,
      createdAt: new Date().toISOString()
    };
    
    console.log('管理员数据:', JSON.stringify(adminData, null, 2));
    
    const key = `account:${ADMIN_USERNAME}`;
    // Upstash Redis KV REST API
    console.log(`正在向Redis写入数据，key=${key}...`);
    const url = `${KV_URL}/set/${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: JSON.stringify(adminData) })
    });
    
    if (res.ok) {
      console.log('管理员账号初始化成功！');
      console.log('请使用以下信息登录:');
      console.log(`用户名: ${ADMIN_USERNAME}`);
      console.log(`密码: ${ADMIN_PASSWORD}`);
    } else {
      const text = await res.text();
      console.error('初始化失败：', text);
    }
  } catch (error) {
    console.error('初始化过程中出错:', error);
    process.exit(1);
  }
}

main(); 