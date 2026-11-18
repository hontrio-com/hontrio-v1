import { createAdminClient } from '@/lib/supabase/admin'
import { storedMessage } from '@/lib/i18n/stored'
import { notify } from '@/lib/ads/journal'
import { accessLostMail, budgetSpentMail, lossLimitMail, moneyIn, pilotBlockedMail, proposalsMail, protectionFailedMail, sendPilotEmail } from '@/lib/ads/emails'

// =============================================
// Ce află omul de la pilot, în clopoțel și pe e-mail: oprirea de siguranță
// (reușită sau nu), contul pe care pilotul nu-l mai poate citi, accesul la
// Google pierdut și propunerile noi. Fiecare se spune o dată pe întâmplare,
// nu la fiecare oră în care problema continuă.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

/** Omul are o notificare cu exact acest titlu (și mesaj, dacă e dat) de la `since` încoace (ca să n-o repetăm). */
async function notifiedSince(supabase: Supabase, userId: string, title: string, since: string, message?: string): Promise<boolean> {
  let q = supabase.from('notifications').select('id').eq('user_id', userId).eq('title', title).gte('created_at', since)
  if (message !== undefined) q = q.eq('message', message)
  const { data } = await q.limit(1)
  return !!data?.length
}

/** O trecere reluată (eroare trecătoare, timpul cronului) nu repetă același avertisment în aceeași zi. */
const SAME_DAY_MS = 20 * 60 * 60_000

/** (a) Oprirea de siguranță a pus campania pe pauză. */
export async function alertLossStop(supabase: Supabase, userId: string, p: {
  store: string; campaign: string; spend: number; currency: string; reason: { key: string; params?: Record<string, string | number> }
}) {
  await notify(supabase, userId, 'warning', storedMessage('notifications.loss_limit_title'), storedMessage(p.reason.key, p.reason.params))
  await sendPilotEmail(userId, (t, locale) => lossLimitMail(t, { store: p.store, campaign: p.campaign, spend: moneyIn(locale, p.currency)(p.spend) }))
}

/**
 * (b) Oprirea de siguranță n-a reușit: Google a refuzat, campania pierde mai departe. Pilotul reîncearcă la
 * fiecare trecere; omul află o dată pe zi pentru aceeași campanie.
 */
export async function alertProtectionFailed(supabase: Supabase, userId: string, p: { store: string; campaign: string }) {
  const title = storedMessage('notifications.loss_limit_failed_title')
  const message = storedMessage('notifications.loss_limit_failed_body', { name: p.campaign })
  if (await notifiedSince(supabase, userId, title, new Date(Date.now() - SAME_DAY_MS).toISOString(), message)) return
  await notify(supabase, userId, 'error', title, message)
  await sendPilotEmail(userId, t => protectionFailedMail(t, p))
}

/**
 * (b) Hontrio a pierdut accesul la Google (retras sau expirat), iar omul are campanii Hontrio care rulează:
 * pilotul nu le mai poate opri. Se cheamă o singură dată, când conexiunea trece din activă în retrasă.
 */
export async function alertAccessLost(supabase: Supabase, userId: string) {
  const { data: live } = await supabase.from('ad_campaigns').select('id').eq('user_id', userId).eq('status', 'active').not('google_campaign_id', 'is', null).limit(1)
  if (!live?.length) return
  await notify(supabase, userId, 'error', storedMessage('notifications.access_lost_title'), storedMessage('notifications.access_lost_body'))
  await sendPilotEmail(userId, t => accessLostMail(t))
}

/**
 * (b) Pilotul n-a putut citi contul Google Ads, deci oprirea de siguranță n-a rulat. O dată pe întâmplare:
 * nimic dacă omul a primit deja avertismentul de la ultima trecere reușită (`since`).
 */
export async function alertPilotBlocked(supabase: Supabase, userId: string, store: string, since: string) {
  const title = storedMessage('notifications.pilot_blocked_title')
  if (await notifiedSince(supabase, userId, title, since)) return
  await notify(supabase, userId, 'error', title, storedMessage('notifications.pilot_blocked_body', { store }))
  await sendPilotEmail(userId, t => pilotBlockedMail(t, { store }))
}

/** Cât timp contul rămâne fără buget, omul primește din nou avertismentul doar după atât. */
const BUDGET_ALERT_GAP_MS = 3 * 24 * 60 * 60_000

/**
 * (b) Contul Google Ads nu mai are buget (cheltuit sau expirat), iar magazinul are campanii Hontrio pornite:
 * Google nu le arată. Doar omul poate adăuga bani, din Google Ads; îi amintim cel mult o dată la 3 zile.
 */
export async function alertBudgetSpent(supabase: Supabase, userId: string, store: string) {
  const title = storedMessage('notifications.budget_spent_title', { store })
  if (await notifiedSince(supabase, userId, title, new Date(Date.now() - BUDGET_ALERT_GAP_MS).toISOString())) return
  await notify(supabase, userId, 'error', title, storedMessage('notifications.budget_spent_body'))
  await sendPilotEmail(userId, t => budgetSpentMail(t, { store }))
}

/** Un e-mail cu propuneri, cel mult o dată pe zi pe magazin. */
const PROPOSALS_EMAIL_GAP_MS = 24 * 60 * 60_000

/** (c) Propuneri noi care așteaptă aprobarea: în clopoțel la fiecare trecere, pe e-mail cel mult o dată pe zi pe magazin. */
export async function alertProposals(supabase: Supabase, userId: string, store: string, count: number) {
  const title = storedMessage('notifications.proposals_title_store', { store })
  const recent = await notifiedSince(supabase, userId, title, new Date(Date.now() - PROPOSALS_EMAIL_GAP_MS).toISOString())
  await notify(supabase, userId, 'info', title, storedMessage('notifications.proposals_body', { count }))
  if (!recent) await sendPilotEmail(userId, t => proposalsMail(t, { store, count }))
}
