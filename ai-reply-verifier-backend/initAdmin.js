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
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const adminData = {
    username: ADMIN_USERNAME,
    passwordHash,
    role: ADMIN_ROLE,
    name: ADMIN_NAME,
    createdAt: new Date().toISOString()
  };
  const key = `account:${ADMIN_USERNAME}`;
  // Upstash Redis KV REST API
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
  } else {
    const text = await res.text();
    console.error('初始化失败：', text);
  }
}

main(); 