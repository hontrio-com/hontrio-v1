import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

async function checkWithTimeout(fn: () => Promise<any>, timeoutMs = 5000) {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), timeoutMs))
  const start = Date.now()
  try {
    await Promise.race([fn(), timeout])
    return { ok: true, latency: Date.now() - start }
  } catch (e: any) {
    return { ok: false, latency: Date.now() - start, error: e.message }
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const [supabaseCheck, openaiCheck, kieCheck] = await Promise.all([
      checkWithTimeout(async () => {
        const supabase = createAdminClient()
        const { error } = await supabase.from('users').select('id').limit(1)
        if (error) throw new Error(error.message)
      }),
      checkWithTimeout(async () => {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      }),
      checkWithTimeout(async () => {
        const res = await fetch('https://api.kie.ai/api/v1/jobs/recordInfo?taskId=health_check', {
          headers: { Authorization: `Bearer ${process.env.KIE_API_KEY}` },
        })
        // 404 is ok — means API is up but task not found
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`)
      }),
    ])

    const checks = [
      { name: 'Supabase DB', ...supabaseCheck },
      { name: 'OpenAI API', ...openaiCheck },
      { name: 'KIE.ai API', ...kieCheck },
      { name: 'Vercel Edge', ok: true, latency: 0 },
    ]

    const allOk = checks.every(c => c.ok)
    return NextResponse.json({ checks, allOk, checkedAt: new Date().toISOString() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}