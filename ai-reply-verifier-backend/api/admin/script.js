import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    // 读取script.js文件
    const jsPath = path.join(process.cwd(), 'public', 'admin', 'script.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    
    // 设置内容类型为JavaScript
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.status(200).send(jsContent);
  } catch (error) {
    console.error('Error serving JS file:', error);
    res.status(500).json({ error: 'Failed to load JS file' });
  }
} 