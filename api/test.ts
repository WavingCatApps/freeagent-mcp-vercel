import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env_check: {
      has_access_token: !!process.env.FREEAGENT_ACCESS_TOKEN,
      has_refresh_token: !!process.env.FREEAGENT_REFRESH_TOKEN,
      has_client_id: !!process.env.FREEAGENT_CLIENT_ID,
      has_client_secret: !!process.env.FREEAGENT_CLIENT_SECRET
    }
  });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    status: 'ok', 
    method: 'POST',
    timestamp: new Date().toISOString()
  });
}