import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeDecrypt } from '@/lib/risk/identity'

/**
 * GET  — check webhook status in WooCommerce
 * POST — register / re-register webhooks in WooCommerce via REST API
 */

async function getWcWebhooks(base: string, auth: string): Promise<any[]> {
  try {
    const res = await fetch(`${base}/wp-json/wc/v3/webhooks?per_page=100`, {
      headers: { Authorization: auth }, signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const supabase = createAdminClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, store_url, api_key, api_secret, webhook_secret')
    .eq('user_id', userId)
    .single()

  if (!store) return NextResponse.json({ error: 'No store connected' }, { status: 404 })

  const ck = safeDecrypt(store.api_key)
  const cs = safeDecrypt(store.api_secret)
  if (!ck || !cs) return NextResponse.json({ error: 'Missing API credentials' }, { status: 400 })

  const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64')
  const base = store.store_url.replace(/\/$/, '')
  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.hontrio.com'
  const expectedUrl = `${appUrl}/api/risk/webhook`

  const webhooks = await getWcWebhooks(base, auth)
  const hontrioWebhooks = webhooks.filter((w: any) =>
    w.delivery_url?.includes('/api/risk/webhook')
  )

  const status = {
    'order.created': hontrioWebhooks.find((w: any) => w.topic === 'order.created'),
    'order.updated': hontrioWebhooks.find((w: any) => w.topic === 'order.updated'),
  }

  return NextResponse.json({
    webhookUrl: expectedUrl,
    webhookSecret: store.webhook_secret ? '✓ set' : '✗ missing',
    orderCreated: status['order.created']
      ? { id: status['order.created'].id, status: status['order.created'].status }
      : null,
    orderUpdated: status['order.updated']
      ? { id: status['order.updated'].id, status: status['order.updated'].status }
      : null,
    allActive: !!status['order.created'] && !!status['order.updated'] &&
      status['order.created'].status === 'active' && status['order.updated'].status === 'active',
  })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const supabase = createAdminClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, store_url, api_key, api_secret, webhook_secret')
    .eq('user_id', userId)
    .single()

  if (!store) return NextResponse.json({ error: 'No store connected' }, { status: 404 })

  const ck = safeDecrypt(store.api_key)
  const cs = safeDecrypt(store.api_secret)
  if (!ck || !cs) return NextResponse.json({ error: 'Missing API credentials' }, { status: 400 })

  const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64')
  const base = store.store_url.replace(/\/$/, '')
  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.hontrio.com'
  const webhookUrl = `${appUrl}/api/risk/webhook`

  // Ensure webhook_secret exists
  let secret = store.webhook_secret
  if (!secret) {
    secret = crypto.randomUUID()
    await supabase.from('stores').update({ webhook_secret: secret }).eq('id', store.id)
  }

  // Get existing webhooks
  const existing = await getWcWebhooks(base, auth)
  const hontrioWebhooks = existing.filter((w: any) =>
    w.delivery_url?.includes('/api/risk/webhook')
  )

  // Delete stale/paused Hontrio webhooks
  for (const w of hontrioWebhooks) {
    if (w.status !== 'active') {
      try {
        await fetch(`${base}/wp-json/wc/v3/webhooks/${w.id}?force=true`, {
          method: 'DELETE',
          headers: { Authorization: auth },
          signal: AbortSignal.timeout(10000),
        })
      } catch {}
    }
  }

  // Re-fetch after cleanup
  const fresh = await getWcWebhooks(base, auth)
  const activeHontrio = fresh.filter((w: any) =>
    w.delivery_url?.includes('/api/risk/webhook') && w.status === 'active'
  )
  const registeredTopics = new Set(activeHontrio.map((w: any) => w.topic))

  const results: Record<string, any> = {}

  for (const topic of ['order.created', 'order.updated']) {
    if (registeredTopics.has(topic)) {
      results[topic] = { action: 'already_active' }
      continue
    }
    try {
      const res = await fetch(`${base}/wp-json/wc/v3/webhooks`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Hontrio Risk Shield — ${topic}`,
          topic, delivery_url: webhookUrl,
          secret, status: 'active',
        }),
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) {
        const data = await res.json()
        results[topic] = { action: 'registered', id: data.id }
      } else {
        const err = await res.text()
        results[topic] = { action: 'failed', error: err.substring(0, 200) }
      }
    } catch (e: any) {
      results[topic] = { action: 'error', error: e.message }
    }
  }

  const allOk = Object.values(results).every((r: any) =>
    r.action === 'registered' || r.action === 'already_active'
  )

  return NextResponse.json({ success: allOk, webhookUrl, results })
}
