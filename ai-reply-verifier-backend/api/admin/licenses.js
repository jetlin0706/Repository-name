import { kv } from '@vercel/kv';

// 将密码硬编码以进行测试，绕过Vercel环境变量问题
const ADMIN_PASSWORD = 'HotelAI-Admin-2024!';

// Middleware for authentication
function auth(request) {
    if (!ADMIN_PASSWORD) {
        console.error("Admin password is not set on the server.");
        return false;
    }
    // FIX: Access headers as a plain object, not with .get()
    const authorization = request.headers.authorization; 
    if (!authorization) {
        return false;
    }

    const [scheme, encoded] = authorization.split(' ');
    if (scheme !== 'Basic' || !encoded) {
        return false;
    }

    try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        const [user, pass] = decoded.split(':');
        // The username can be anything, we only check the password
        return pass === ADMIN_PASSWORD;
    } catch (e) {
        console.error("Error decoding auth header:", e);
        return false;
    }
}


export default async function handler(request, response) {
    // 设置CORS头
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    // 处理OPTIONS请求
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    if (!auth(request)) {
        // For security reasons, don't give specific feedback in the response.
        // The console.error in auth() is for server-side debugging.
        return response.status(401).json({ message: 'Authentication required.' });
    }

    try {
        // Use request.body for Vercel functions, which is already parsed
        const body = request.body;

        if (request.method === 'GET') {
            const licenses = await kv.hgetall('licenses');
            return response.status(200).json(licenses || {});
        }

        if (request.method === 'POST') {
            const { licenseKey, hotelName, startDate, expiryDate } = body;
            if (!licenseKey || !hotelName || !expiryDate || !startDate) {
                return response.status(400).json({ message: 'Missing required fields.' });
            }

            // If updating, preserve existing activation data
            const existingDataRaw = await kv.hget('licenses', licenseKey);
            let activations = [];
            if (existingDataRaw) {
                let existingData;
                if (typeof existingDataRaw === 'object' && existingDataRaw !== null) {
                    existingData = existingDataRaw;
                } else {
                    try {
                        existingData = JSON.parse(existingDataRaw);
                    } catch (e) {
                        console.error('Could not parse existing license data for key:', licenseKey, e);
                        // If data is corrupted, we can't preserve activations. Start fresh.
                        existingData = {};
                    }
                }
                activations = existingData.activations || [];
            }
            
            const licenseData = { hotelName, startDate, expiryDate, activations };

            await kv.hset('licenses', { [licenseKey]: JSON.stringify(licenseData) });
            return response.status(200).json({ message: 'License saved successfully.' });
        }

        if (request.method === 'DELETE') {
            const { licenseKey } = body;
            if (!licenseKey) {
                return response.status(400).json({ message: 'Missing licenseKey.' });
            }
            await kv.hdel('licenses', licenseKey);
            return response.status(200).json({ message: 'License deleted successfully.' });
        }

        response.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return response.status(405).end(`Method ${request.method} Not Allowed`);

    } catch (error) {
        console.error('Error in licenses API:', error);
        return response.status(500).json({ message: 'An internal server error occurred.' });
    }
} 