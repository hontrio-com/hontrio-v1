import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { clientIp, rateLimitAll } from '@/lib/security/rate-limit'
import { KEY_CONNECTORS, keyPlatformOf } from '@/lib/commerce/connect'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/stores/test
// Verifică cheile unui magazin înainte de conectare, de pe server: din
// browser, cererea către magazin cade pe CORS, iar cheia ar ajunge în adresă.
// Platforma vine în `platform` (woocommerce implicit, gomag, merchantpro,
// opencart); fiecare verifică și că poate citi comenzile.
// Răspunsul e { ok, error? } (200): rezultatul testului, nu o eroare a cererii.
// =============================================

export const maxDuration = 60

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
  const platform = keyPlatformOf(body)
  if (!platform) return NextResponse.json({ ok: false, error: t('sync.platform_unsupported') }, { status: 400 })
  const connector = KEY_CONNECTORS[platform]

  const parsed = connector.parse(body)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: t(parsed.key, parsed.params) }, { status: parsed.status })

  const check = await connector.check(parsed.keys)
  if (!check.ok) return NextResponse.json({ ok: false, error: t(check.key, check.params) })
  return NextResponse.json({ ok: true, platform, version: check.version, currency: check.currency, store_url: check.storeUrl })
}
