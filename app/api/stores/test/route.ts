import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { clientIp, rateLimitAll } from '@/lib/security/rate-limit'
import { checkWooKeys, parseWooKeys } from '@/lib/woocommerce/connect'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/stores/test
// Verifică o cheie WooCommerce înainte de conectare, de pe server: din
// browser, cererea către magazin cade pe CORS, iar cheia ar ajunge în adresă.
// Cere și o comandă, ca să știm că cheia poate citi vânzările.
// Răspunsul e { ok, error? } (200): rezultatul testului, nu o eroare a cererii.
// =============================================

export async function POST(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const allowed = await rateLimitAll([
    [`store-test:${userId}`, 10, 10 * 60 * 1000],
    [`store-test-ip:${clientIp(request.headers)}`, 30, 10 * 60 * 1000],
  ])
  if (!allowed) return NextResponse.json({ ok: false, error: t('sync.too_many_attempts') }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = parseWooKeys(body)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: t(parsed.key, parsed.params) }, { status: parsed.status })

  const check = await checkWooKeys(parsed.keys)
  if (!check.ok) return NextResponse.json({ ok: false, error: t(check.key, check.params) })
  return NextResponse.json({ ok: true, wc_version: check.version, currency: check.currency })
}
