import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET' || req.method === 'POST') {
    return res.json({ 
      status: 'ok', 
      method: req.method,
      timestamp: new Date().toISOString(),
      env_check: {
        has_access_token: !!process.env.FREEAGENT_ACCESS_TOKEN,
        has_refresh_token: !!process.env.FREEAGENT_REFRESH_TOKEN,
        has_client_id: !!process.env.FREEAGENT_CLIENT_ID,
        has_client_secret: !!process.env.FREEAGENT_CLIENT_SECRET
      }
    });
  }
  
  res.status(405).json({ error: 'Method not allowed' });
}