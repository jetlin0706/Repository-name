import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { licenseKey } = request.body;
    if (!licenseKey) {
      return response.status(400).json({ valid: false, error: 'License key not provided' });
    }

    // 从数据库获取授权码的详细信息
    const licenseDetails = await kv.hgetall(`license:${licenseKey}`);

    // 检查授权码是否存在
    if (!licenseDetails) {
      return response.status(200).json({ valid: false, message: 'Invalid license key' });
    }

    // 检查授权码是否已过期
    const now = new Date();
    const expiresAt = new Date(licenseDetails.expiresAt);
    if (now > expiresAt) {
      return response.status(200).json({ valid: false, message: 'License key has expired' });
    }
    
    // 验证通过
    return response.status(200).json({ valid: true });

  } catch (error) {
    console.error('Verification error:', error);
    return response.status(500).json({ valid: false, error: 'Internal server error' });
  }
} 