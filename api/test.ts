export default function handler(req: any, res: any) {
  res.json({ 
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