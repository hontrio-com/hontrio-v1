import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { validateStoreUrl } from '@/lib/security/validate-url'
import { rateLimit } from '@/lib/security/rate-limit'

// =============================================
// POST /api/stores/test
// Verifică o cheie WooCommerce înainte de conectare, de pe server: din
// browser, cererea către magazin cade pe CORS, iar cheia ar ajunge în adresă.
// Cere și o comandă, ca să știm că cheia poate citi vânzările.
// =============================================

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const userId = session.user.id

  const rl = rateLimit(`store-test:${userId}`, 10, 10 * 60 * 1000)
  if (!rl.success) return NextResponse.json({ ok: false, error: 'Prea multe încercări. Așteaptă câteva minute.' }, { status: 429 })

  let body: { store_url?: unknown; consumer_key?: unknown; consumer_secret?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cerere invalidă' }, { status: 400 })
  }
  const { store_url, consumer_key, consumer_secret } = body
  if (typeof store_url !== 'string' || typeof consumer_key !== 'string' || typeof consumer_secret !== 'string') {
    return NextResponse.json({ ok: false, error: 'Toate câmpurile sunt obligatorii' }, { status: 400 })
  }
  if (!consumer_key.startsWith('ck_') || !consumer_secret.startsWith('cs_')) {
    return NextResponse.json({ ok: false, error: 'Cheia începe cu ck_, iar secretul cu cs_' }, { status: 400 })
  }
  const url = validateStoreUrl(store_url)
  if (!url.valid) return NextResponse.json({ ok: false, error: url.error }, { status: 400 })

  const auth = 'Basic ' + Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64')
  const get = (path: string) => fetch(`${url.cleaned}/wp-json/wc/v3/${path}`, {
    headers: { Authorization: auth, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  })

  try {
    const status = await get('system_status?_fields=environment,settings')
    if (status.status === 401 || status.status === 403) {
      return NextResponse.json({ ok: false, error: 'Cheia API nu e acceptată. Verifică cheia, secretul și permisiunea (Citire).' })
    }
    if (status.status === 404) {
      return NextResponse.json({ ok: false, error: 'Adresa nu pare un magazin WooCommerce cu API-ul REST pornit.' })
    }
    if (!status.ok) return NextResponse.json({ ok: false, error: `Magazinul a răspuns ${status.status}. Încearcă din nou.` })
    const info = await status.json().catch(() => null) as { environment?: { version?: string }; settings?: { currency?: string } } | null

    const orders = await get('orders?per_page=1&_fields=id')
    if (!orders.ok) {
      return NextResponse.json({ ok: false, error: 'Cheia nu poate citi comenzile. Alege permisiunea Citire sau Citire/Scriere.' })
    }

    return NextResponse.json({
      ok: true,
      wc_version: info?.environment?.version ?? null,
      currency: info?.settings?.currency ?? null,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Magazinul nu răspunde. Verifică adresa.' })
  }
}
