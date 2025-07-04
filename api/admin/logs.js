// GitHub Pages上的API代理
// 由于GitHub Pages不支持服务器端代码，这个文件会被作为静态文件提供
// 当用户访问此页面时，会自动重定向到Vercel的API

document.addEventListener('DOMContentLoaded', () => {
  const vercelApiUrl = 'https://cursor-g8egzt964-makes-projects-63ecea9e.vercel.app/api/admin/logs';
  
  // 显示重定向信息
  document.body.innerHTML = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
      <h1>API重定向</h1>
      <p>GitHub Pages不支持服务器端API。正在重定向到Vercel托管的API...</p>
      <p>如果没有自动跳转，请<a href="${vercelApiUrl}">点击这里</a>访问API。</p>
    </div>
  `;
  
  // 自动重定向
  window.location.href = vercelApiUrl;
}); 