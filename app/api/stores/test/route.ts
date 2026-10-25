import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { validateStoreUrl } from '@/lib/security/validate-url'
import { rateLimit } from '@/lib/security/rate-limit'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/stores/test
// Verifică o cheie WooCommerce înainte de conectare, de pe server: din
// browser, cererea către magazin cade pe CORS, iar cheia ar ajunge în adresă.
// Cere și o comandă, ca să știm că cheia poate citi vânzările.
// =============================================

export async function POST(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const rl = rateLimit(`store-test:${userId}`, 10, 10 * 60 * 1000)
  if (!rl.success) return NextResponse.json({ ok: false, error: t('sync.too_many_attempts') }, { status: 429 })

  let body: { store_url?: unknown; consumer_key?: unknown; consumer_secret?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: t('api.invalid_request') }, { status: 400 })
  }
  const { store_url, consumer_key, consumer_secret } = body
  if (typeof store_url !== 'string' || typeof consumer_key !== 'string' || typeof consumer_secret !== 'string') {
    return NextResponse.json({ ok: false, error: t('sync.fields_required') }, { status: 400 })
  }
  if (!consumer_key.startsWith('ck_') || !consumer_secret.startsWith('cs_')) {
    return NextResponse.json({ ok: false, error: t('sync.woo_key_format') }, { status: 400 })
  }
  // Oricare ar fi motivul (adresă locală, IP privat...), omului îi trebuie o adresă bună
  const url = validateStoreUrl(store_url)
  if (!url.valid) return NextResponse.json({ ok: false, error: t(url.error ?? 'sync.store_url_invalid') }, { status: 400 })

  const auth = 'Basic ' + Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64')
  const get = (path: string) => fetch(`${url.cleaned}/wp-json/wc/v3/${path}`, {
    headers: { Authorization: auth, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  })

  try {
    const status = await get('system_status?_fields=environment,settings')
    if (status.status === 401 || status.status === 403) {
      return NextResponse.json({ ok: false, error: t('sync.woo_key_not_accepted') })
    }
    if (status.status === 404) {
      return NextResponse.json({ ok: false, error: t('sync.woo_not_detected') })
    }
    if (!status.ok) return NextResponse.json({ ok: false, error: t('sync.store_responded_status', { status: status.status }) })
    const info = await status.json().catch(() => null) as { environment?: { version?: string }; settings?: { currency?: string } } | null

    const orders = await get('orders?per_page=1&_fields=id')
    if (!orders.ok) {
      return NextResponse.json({ ok: false, error: t('sync.woo_key_no_orders') })
    }

    return NextResponse.json({
      ok: true,
      wc_version: info?.environment?.version ?? null,
      currency: info?.settings?.currency ?? null,
    })
  } catch {
    return NextResponse.json({ ok: false, error: t('sync.store_no_response_check_url') })
  }
}
