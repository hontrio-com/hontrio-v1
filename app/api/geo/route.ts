import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  // Vercel injects this header automatically in production
  const country = req.headers.get('x-vercel-ip-country') || ''
  return NextResponse.json({ country })
}
