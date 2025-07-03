import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    // 读取style.css文件
    const cssPath = path.join(process.cwd(), 'public', 'admin', 'style.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    
    // 设置内容类型为CSS
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.status(200).send(cssContent);
  } catch (error) {
    console.error('Error serving CSS file:', error);
    res.status(500).json({ error: 'Failed to load CSS file' });
  }
} 