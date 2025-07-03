import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    // 读取admin/index.html文件
    const adminHtmlPath = path.join(process.cwd(), 'public', 'admin', 'index.html');
    const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
    
    // 设置内容类型为HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(adminHtml);
  } catch (error) {
    console.error('Error serving admin page:', error);
    res.status(500).json({ error: 'Failed to load admin page' });
  }
} 