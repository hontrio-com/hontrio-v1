import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import { clearCachedAccessToken, revokeToken } from '@/lib/google/oauth'
import { EdinioClient } from '@/lib/edinio/client'
import { ShopifyApi } from '@/lib/shopify/api'
import { ATTACHMENTS_BUCKET, attachmentObjects } from '@/lib/tickets/attachments'
import { removeHontrioCampaigns } from '@/lib/ads/remove'
import { logError, logWarn } from '@/lib/logger'

// =============================================
// Ștergerea unui cont (de omul însuși sau de un admin), în ordinea în care
// ceva poate rămâne în urmă:
// 0. campaniile create de Hontrio se șterg din contul Google Ads al omului
//    (Termeni, art. 14.5 nou, lib/ads/remove.ts), cât accesul mai merge;
//    înainte ca regula să intre în vigoare, rămân ale lui și rulează mai departe;
// 1. accesurile date altora se retrag la ei: Google (refresh token), Edinio
//    (jetonul), Shopify (aplicația se dezinstalează) — fiecare „cât se poate";
// 2. fișierele din Storage: avatarul și atașamentele tichetelor (și cele
//    puse de echipă în tichetele omului);
// 3. rândul din users: restul (magazinele cu ofertele, comenzile și campaniile
//    lor, legătura Google, notificările, tichetele) se șterge în cascadă;
// 4. contul din Supabase Auth.
// Pașii 2–4 se verifică; la o eroare, ștergerea se oprește și se poate relua.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>
export type DeleteResult = { ok: true } | { ok: false; step: 'storage' | 'database' | 'auth' }

const plain = (v: string) => (v.includes(':') ? decrypt(v) : v)

async function revokeAccess(supabase: Supabase, userId: string) {
  const { data: google } = await supabase.from('google_connections').select('refresh_token_encrypted').eq('user_id', userId).maybeSingle()
  if (google?.refresh_token_encrypted) {
    try { await revokeToken(decrypt(google.refresh_token_encrypted)) } catch (err) {
      logWarn('account/delete', 'Accesul Google n-a putut fi retras', { userId, error: (err as Error).message })
    }
  }
  clearCachedAccessToken(userId)

  const { data: stores } = await supabase.from('stores').select('platform, store_url, api_key').eq('user_id', userId)
  for (const s of stores ?? []) {
    if (!s.api_key) continue
    try {
      if (s.platform === 'edinio') await new EdinioClient(plain(s.api_key)).revoke()
      else if (s.platform === 'shopify') await new ShopifyApi(s.store_url, plain(s.api_key)).revokeAccess()
    } catch (err) {
      logWarn('account/delete', 'Accesul unui magazin n-a putut fi retras', { userId, platform: s.platform, error: (err as Error).message })
    }
  }
}

/** Fișierele dintr-un „dosar" (un singur nivel), pentru ștergere. */
async function listFolder(supabase: Supabase, bucket: string, folder: string): Promise<string[] | null> {
  const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 })
  if (error) return null
  return (data ?? []).filter(f => f.name).map(f => `${folder}/${f.name}`)
}

async function removeFiles(supabase: Supabase, userId: string): Promise<boolean> {
  // Atașamentele din tichetele omului, inclusiv cele puse de echipă
  const { data: tickets } = await supabase.from('tickets').select('id, attachments').eq('user_id', userId)
  const ticketIds = (tickets ?? []).map(t => t.id)
  const { data: replies } = ticketIds.length
    ? await supabase.from('ticket_replies').select('attachments').in('ticket_id', ticketIds)
    : { data: [] as { attachments: unknown }[] }
  const fromTickets = attachmentObjects([...(tickets ?? []).map(t => t.attachments), ...(replies ?? []).map(r => r.attachments)])

  const [privateOwn, avatars, legacyOwn] = await Promise.all([
    listFolder(supabase, ATTACHMENTS_BUCKET, userId),
    listFolder(supabase, 'uploads', `avatars/${userId}`),
    listFolder(supabase, 'uploads', `ticket-attachments/${userId}`),
  ])
  if (!privateOwn || !avatars || !legacyOwn) return false

  const privatePaths = [...new Set([...privateOwn, ...fromTickets.private])]
  const publicPaths = [...new Set([...avatars, ...legacyOwn, ...fromTickets.legacy])]
  for (const [bucket, paths] of [[ATTACHMENTS_BUCKET, privatePaths], ['uploads', publicPaths]] as const) {
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100))
      if (error) {
        logError('account/delete', 'Fișierele n-au putut fi șterse', { userId, bucket, error: error.message })
        return false
      }
    }
  }
  return true
}

export async function deleteAccount(userId: string): Promise<DeleteResult> {
  const supabase = createAdminClient()

  await removeHontrioCampaigns(supabase, userId, { reason: 'account_deleted' })
  await revokeAccess(supabase, userId)

  if (!(await removeFiles(supabase, userId))) return { ok: false, step: 'storage' }

  const { error: eDb } = await supabase.from('users').delete().eq('id', userId)
  if (eDb) {
    logError('account/delete', 'Contul n-a putut fi șters din baza de date', { userId, error: eDb.message })
    return { ok: false, step: 'database' }
  }

  const { error: eAuth } = await supabase.auth.admin.deleteUser(userId)
  // Un cont deja lipsă din Supabase Auth e tot „șters"
  if (eAuth && !/not.?found/i.test(eAuth.message)) {
    logError('account/delete', 'Contul n-a putut fi șters din Supabase Auth', { userId, error: eAuth.message })
    return { ok: false, step: 'auth' }
  }
  return { ok: true }
}
