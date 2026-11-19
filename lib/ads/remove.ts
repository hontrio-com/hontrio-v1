import { createAdminClient } from '@/lib/supabase/admin'
import { mutate, GoogleAdsApiError } from '@/lib/google/ads'
import { storeAdsAccount } from '@/lib/google/accounts'
import { getAccessTokenForUser, GoogleAuthError } from '@/lib/google/oauth'
import { budgetPath, campaignPath } from '@/lib/google/operations'
import { utcToLocal, ROMANIA_TZ } from '@/lib/commerce/time'
import { closeGroupIfDone } from '@/lib/ads/apply'
import { logError, logWarn } from '@/lib/logger'

// =============================================
// Clientul pleacă: deconectează Google, șterge un magazin sau își șterge
// contul. Atunci Hontrio șterge din contul lui Google Ads campaniile pe care
// le-a creat, cu bugetele lor (Termeni, art. 14.5 nou). Ștergerea e
// definitivă: o campanie ștearsă nu mai poate fi pornită.
//
// - Se face cât timp accesul la Google mai merge, deci înainte de retragerea
//   lui. Ce nu se poate șterge (accesul retras direct din contul Google, o
//   eroare Google) rămâne în jurnal, iar plecarea merge mai departe: nimeni
//   nu e ținut în Hontrio de o eroare.
// - O campanie pe care Google n-o mai are (ștearsă de om) se socotește ștearsă.
// - Regula intră în vigoare cu Termenii care o cuprind. Până atunci (constantele
//   de mai jos nule) nu se șterge nimic, ca în Termenii de acum (art. 14.5:
//   campaniile rămân ale clientului).
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

/**
 * Versiunea Termenilor care cuprinde regula (lib/auth/validation.ts, TERMS_VERSION): pentru cine a acceptat-o
 * (sau una mai nouă), regula se aplică de la acceptare. Nulă până la publicarea Termenilor noi.
 */
export const LEAVE_REMOVAL_TERMS_VERSION: string | null = null
/**
 * De când se aplică tuturor („AAAA-LL-ZZ”, ora României): după cele 30 de zile de preaviz pentru clienții care
 * au acceptat Termenii de dinainte (art. 18.1). Nulă până atunci.
 */
export const LEAVE_REMOVAL_FROM: string | null = null

export type LeaveRule = { version: string | null; from: string | null }
const RULE: LeaveRule = { version: LEAVE_REMOVAL_TERMS_VERSION, from: LEAVE_REMOVAL_FROM }

/** La plecare, campaniile Hontrio ale acestui cont se șterg? `today` = ziua de azi în România. */
export function leaveRemovesCampaigns(termsVersion: string | null | undefined, today: string, rule: LeaveRule = RULE): boolean {
  if (rule.version && termsVersion && termsVersion >= rule.version) return true
  return !!rule.from && today >= rule.from
}

/** Regula, pentru contul dat (din versiunea Termenilor acceptată de el). */
export async function leaveRuleFor(supabase: Supabase, userId: string, nowMs = Date.now()): Promise<boolean> {
  if (!RULE.version && !RULE.from) return false
  const { data } = await supabase.from('users').select('terms_version').eq('id', userId).maybeSingle()
  return leaveRemovesCampaigns((data?.terms_version as string | null) ?? null, utcToLocal(new Date(nowMs).toISOString(), ROMANIA_TZ).slice(0, 10))
}

export type LeaveReason = 'google_disconnect' | 'store_deleted' | 'account_deleted'
export type RemovalResult = { removed: number; failed: number }

/** Google nu mai are campania (sau bugetul): ștearsă deja, de om. */
export function alreadyGone(err: GoogleAdsApiError): boolean {
  return /NOT_FOUND|REMOVED/.test(`${err.errorCode ?? ''} ${err.message}`)
}

/**
 * Șterge din Google Ads campaniile create de Hontrio ale contului (sau doar ale unui magazin), dacă regula se aplică
 * contului. Întoarce câte s-au șters și câte au rămas în Google Ads.
 */
export async function removeHontrioCampaigns(supabase: Supabase, userId: string, opts: { storeId?: string; reason: LeaveReason }): Promise<RemovalResult> {
  if (!(await leaveRuleFor(supabase, userId))) return { removed: 0, failed: 0 }

  let q = supabase.from('ad_campaigns').select('id, customer_id, google_campaign_id, google_budget_id, product_group_id')
    .eq('user_id', userId).not('google_campaign_id', 'is', null).neq('status', 'removed')
  if (opts.storeId) q = q.eq('store_id', opts.storeId)
  const { data: rows, error } = await q
  if (error) {
    logError('ads/remove', 'Campaniile de șters nu s-au putut citi', { userId, reason: opts.reason, error: error.message })
    return { removed: 0, failed: 0 }
  }
  const campaigns = (rows ?? []) as { id: string; customer_id: string; google_campaign_id: string; google_budget_id: string | null; product_group_id: string | null }[]
  if (!campaigns.length) return { removed: 0, failed: 0 }

  let token: string
  try {
    token = await getAccessTokenForUser(userId)
  } catch (err) {
    if (!(err instanceof GoogleAuthError)) throw err
    logWarn('ads/remove', 'Campaniile Hontrio nu s-au putut șterge: accesul Google nu mai merge', { userId, reason: opts.reason, count: campaigns.length })
    return { removed: 0, failed: campaigns.length }
  }

  let removed = 0
  let failed = 0
  const now = new Date().toISOString()
  const logins = new Map<string, string | null>()
  for (const c of campaigns) {
    const cid = String(c.customer_id)
    if (!logins.has(cid)) logins.set(cid, (await storeAdsAccount(supabase, userId, cid))?.login_customer_id ?? null)
    const loginCustomerId = logins.get(cid) ?? null
    try {
      await mutate(token, cid, [{ campaignOperation: { remove: campaignPath(cid, c.google_campaign_id) } }], { loginCustomerId })
    } catch (err) {
      if (!(err instanceof GoogleAdsApiError) || !alreadyGone(err)) {
        failed++
        logError('ads/remove', 'O campanie Hontrio nu s-a putut șterge din Google Ads', {
          userId, campaign: c.google_campaign_id, reason: opts.reason, error: err instanceof Error ? err.message : String(err),
        })
        continue
      }
    }
    // Bugetul campaniei (doar al ei): fără campanie nu mai cheltuie, dar nu-l lăsăm în cont
    if (c.google_budget_id) {
      try {
        await mutate(token, cid, [{ campaignBudgetOperation: { remove: budgetPath(cid, c.google_budget_id) } }], { loginCustomerId })
      } catch { /* rămâne în cont, fără nicio campanie */ }
    }
    await supabase.from('ad_campaigns').update({ status: 'removed', paused_reason: opts.reason, updated_at: now }).eq('id', c.id)
    if (c.product_group_id) await closeGroupIfDone(supabase, c.product_group_id, now)
    removed++
  }
  logWarn('ads/remove', 'Campaniile Hontrio ale unui client care pleacă', { userId, reason: opts.reason, removed, failed })
  return { removed, failed }
}
