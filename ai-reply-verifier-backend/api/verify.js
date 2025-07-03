import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  // 设置CORS头
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // 处理OPTIONS请求
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  
  // 只接受POST请求
  if (request.method !== 'POST') {
    return response.status(405).json({ valid: false, message: 'Only POST requests are allowed' });
  }

  try {
    const { licenseKey } = request.body;

    if (!licenseKey) {
      return response.status(400).json({ valid: false, message: 'License key is required' });
    }

    // 硬编码授权码用于测试
    if (licenseKey === 'JD-FIRST-KEY') {
      return response.status(200).json({ valid: true, message: 'License verified successfully.' });
    }

    const licenseDataString = await kv.hget('licenses', licenseKey);

    if (!licenseDataString) {
      return response.status(200).json({ valid: false, message: 'Invalid license key.' });
    }

    const licenseData = JSON.parse(licenseDataString);

    // licenseData is stored as a stringified JSON: { hotelName, expiryDate }
    const { expiryDate } = licenseData; 
    const now = new Date();
    const expiry = new Date(expiryDate);

    if (now > expiry) {
      return response.status(200).json({ valid: false, message: 'License has expired.' });
    }

    // --- NEW: Log activation ---
    const ip = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    if (!Array.isArray(licenseData.activations)) {
      licenseData.activations = [];
    }
    licenseData.activations.push({
      ip: ip || 'Unknown',
      timestamp: new Date().toISOString()
    });

    await kv.hset('licenses', { [licenseKey]: JSON.stringify(licenseData) });
    // --- END NEW ---

    return response.status(200).json({ valid: true, message: 'License verified successfully.' });
  } catch (error) {
    console.error('Error in verify API:', error);
    return response.status(500).json({ valid: false, message: 'An internal server error occurred.' });
  }
} 