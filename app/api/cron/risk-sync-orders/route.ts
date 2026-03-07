import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeDecrypt, mapStatus, recalc, getSettings } from '@/lib/risk/identity'

export async function GET(req: Request) {
  const authH = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  const manual = new URL(req.url).searchParams.get('manual') === 'true'
  if (!manual && secret && authH !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const results: any[] = []
  try {
    const { data: stores } = await supabase.from('stores')
      .select('id, user_id, store_url, api_key, api_secret').not('api_key', 'is', null)
    for (const store of (stores || [])) {
      const ck = safeDecrypt(store.api_key), cs = safeDecrypt(store.api_secret)
      if (!ck || !cs) continue
      try {
        const base = store.store_url.replace(/\/$/, '')
        const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64')
        const since = new Date(Date.now() - 7 * 86400000).toISOString()
        let updated = 0
        const touched = new Set<string>()
        for (let p = 1; p <= 20; p++) {
          const url = new URL(`${base}/wp-json/wc/v3/orders`)
          url.searchParams.set('per_page', '100')
          url.searchParams.set('page', String(p))
          url.searchParams.set('modified_after', since)
          const res = await fetch(url.toString(), {
            headers: { Authorization: auth }, signal: AbortSignal.timeout(20000),
          })
          if (!res.ok) break
          const orders = await res.json()
          const pages = parseInt(res.headers.get('x-wp-totalpages') || '1')
          if (!Array.isArray(orders) || !orders.length) break
          for (const woo of orders) {
            const newSt = mapStatus(woo.status || 'pending')
            const { data: ex } = await supabase.from('risk_orders')
              .select('id, order_status, customer_id')
              .eq('store_id', store.id).eq('external_order_id', String(woo.id)).single()
            if (!ex || ex.order_status === newSt) continue
            await supabase.from('risk_orders').update({
              order_status: newSt, updated_at: new Date().toISOString(),
              ...(['collected','refused','returned','cancelled'].includes(newSt) ? { resolved_at: new Date().toISOString() } : {}),
            }).eq('id', ex.id)
            if (ex.customer_id) touched.add(ex.customer_id)
            updated++
          }
          if (p >= pages) break
        }
        if (touched.size) {
          const settings = await getSettings(supabase, store.id)
          for (const id of touched) { try { await recalc(supabase, id, store.id, settings) } catch {} }
        }
        results.push({ store_id: store.id, updated, recalculated: touched.size })
      } catch (e: any) { results.push({ store_id: store.id, error: e.message }) }
    }
    return NextResponse.json({ ok: true, results })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}