export default function handler(req, res) {
  // 如果是对根路径的请求，重定向到admin页面
  if (req.url === '/') {
    res.setHeader('Location', '/admin');
    res.status(302).end();
    return;
  }
  
  // 否则返回API信息
  res.status(200).json({
    name: 'AI Reply Verifier API',
    version: '1.0.0',
    endpoints: [
      '/api/verify - 验证授权码',
      '/api/admin/licenses - 管理授权码(需要认证)'
    ]
  });
} 