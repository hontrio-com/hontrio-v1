import { NextResponse, after } from 'next/server'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/security/encryption'
import { logApiError } from '@/lib/logger'
import { EdinioError, getEdinioRedirectUri } from '@/lib/edinio/config'
import { EDINIO_OAUTH_COOKIE, exchangeEdinioCode, openPendingAuth } from '@/lib/edinio/oauth'
import { EdinioClient } from '@/lib/edinio/client'
import { storeFields } from '@/lib/edinio/mapping'
import { syncEdinioStore } from '@/lib/edinio/sync'
import { setActiveStore } from '@/lib/stores/active'
import type { EdinioStore } from '@/lib/edinio/types'

// =============================================
// GET /api/integrations/edinio/callback
// Întoarcerea din Edinio: verifică cererea, schimbă codul pe jeton, salvează
// magazinul și pornește prima sincronizare completă (după răspuns).
// =============================================

// Prima sincronizare rulează în `after`, în limita duratei rutei
export const maxDuration = 300

const ROUTE = '/api/integrations/edinio/callback'

function back(request: Request, params: Record<string, string>) {
  const url = new URL('/settings', request.url)
  url.searchParams.set('tab', 'integrations')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const response = NextResponse.redirect(url)
  response.cookies.delete(EDINIO_OAUTH_COOKIE)
  return response
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  // Omul a apăsat „Anulează" în Edinio
  if (oauthError) return back(request, { edinio_error: oauthError === 'access_denied' ? 'access_denied' : 'oauth' })
  if (!code || !state) return back(request, { edinio_error: 'oauth' })

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login?callbackUrl=/settings?tab=integrations', request.url))
  }
  const userId = session.user.id

  // `state` trebuie să fie al cererii pornite de ACEST utilizator, din acest browser
  const cookieStore = await cookies()
  const pending = openPendingAuth(cookieStore.get(EDINIO_OAUTH_COOKIE)?.value, userId, state)
  if (!pending) {
    logApiError(ROUTE, 401, 'State Edinio invalid sau expirat', { userId })
    return back(request, { edinio_error: 'state' })
  }

  let token: string
  let store: EdinioStore | null
  try {
    ({ accessToken: token, store } = await exchangeEdinioCode(code, getEdinioRedirectUri(request.url), pending.verifier))
  } catch (err) {
    const codeErr = err instanceof EdinioError ? err.code : 'oauth'
    logApiError(ROUTE, 502, 'Schimbul codului Edinio a eșuat', { userId, error: (err as Error).message })
    return back(request, {
      edinio_error: codeErr === 'invalid_grant' ? 'expired' : codeErr === 'not_configured' ? 'not_configured' : 'oauth',
    })
  }

  const client = new EdinioClient(token)
  if (!store) {
    try { store = await client.getStore() } catch {}
  }
  if (!store) {
    await client.revoke()
    return back(request, { edinio_error: 'store_read' })
  }

  const supabase = createAdminClient()
  // Același magazin Edinio legat din nou: îi actualizăm rândul, cu datele și costurile lui.
  // Altfel e încă un magazin al contului, lângă celelalte
  const { data: existing } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', 'edinio')
    .eq('external_id', store.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const fields = {
    ...storeFields(store),
    platform: 'edinio',
    api_key: encrypt(token),
    api_secret: null,
    connection_status: 'active',
    last_error: null,
  }

  let storeId: string
  if (existing) {
    const { error } = await supabase.from('stores').update(fields).eq('id', existing.id)
    if (error) {
      logApiError(ROUTE, 500, 'Eroare salvare magazin Edinio', { userId, error: error.message })
      await client.revoke()
      return back(request, { edinio_error: 'save' })
    }
    storeId = existing.id
  } else {
    const { data, error } = await supabase
      .from('stores')
      .insert({ user_id: userId, ...fields, sync_status: 'active' })
      .select('id')
      .single()
    if (error || !data) {
      logApiError(ROUTE, 500, 'Eroare salvare magazin Edinio', { userId, error: error?.message })
      await client.revoke()
      return back(request, { edinio_error: 'save' })
    }
    storeId = data.id
  }

  // Magazinul abia legat e cel pe care omul vrea să-l vadă
  await setActiveStore(supabase, userId, storeId)

  // Prima sincronizare completă: după ce omul a primit deja pagina de Setări
  after(async () => {
    const result = await syncEdinioStore(storeId, 'full')
    if (!result.ok && result.reason !== 'locked') {
      logApiError(ROUTE, 500, 'Prima sincronizare Edinio a eșuat', { storeId, reason: result.reason, message: result.message })
    }
  })

  return back(request, { edinio: 'connected' })
}
