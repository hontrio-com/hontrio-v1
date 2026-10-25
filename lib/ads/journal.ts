import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'

// =============================================
// Jurnalul pilotului (ad_actions) și notificările către om. Textele se
// salvează ca chei de traducere (storedMessage), ca fiecare să le citească
// în limba lui.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

export type ActionKind =
  // Ale omului
  | 'launch' | 'pause' | 'enable' | 'declare_eu' | 'pause_existing'
  // Ale pilotului
  | 'pause_loss_limit' | 'graduate' | 'set_target' | 'set_budget'
  | 'exclude_products' | 'sync_products' | 'add_negatives' | 'segment'

export type ActionStatus = 'proposed' | 'applied' | 'rejected' | 'failed' | 'expired'

export type ActionRow = {
  id: string
  user_id: string
  store_id: string
  ad_campaign_id: string | null
  kind: ActionKind
  params: Record<string, unknown>
  reason: string | null
  status: ActionStatus
  source: 'autopilot' | 'user'
  error: string | null
  created_at: string
  decided_at: string | null
  applied_at: string | null
}

export async function logAction(supabase: Supabase, a: {
  user_id: string; store_id: string; ad_campaign_id?: string | null; kind: ActionKind
  params?: Record<string, unknown>; reason?: string | null; status: ActionStatus; source: 'autopilot' | 'user'; error?: string | null
}): Promise<string | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('ad_actions').insert({
    user_id: a.user_id,
    store_id: a.store_id,
    ad_campaign_id: a.ad_campaign_id ?? null,
    kind: a.kind,
    params: a.params ?? {},
    reason: a.reason ?? null,
    status: a.status,
    source: a.source,
    error: a.error ?? null,
    ...(a.status !== 'proposed' ? { decided_at: now } : {}),
    ...(a.status === 'applied' ? { applied_at: now } : {}),
  }).select('id').maybeSingle()
  if (error) {
    // O propunere deja deschisă de același fel (indexul unic) nu e o eroare
    if (error.code !== '23505') logError('ad-actions', 'Acțiune netrecută în jurnal', { storeId: a.store_id, kind: a.kind, error: error.message })
    return null
  }
  return data?.id ?? null
}

/** O notificare pentru om (clopoțelul din antet). Titlul și mesajul sunt chei salvate. */
export async function notify(supabase: Supabase, userId: string, type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, title, message, type, is_read: false })
  if (error) logError('notifications', 'Notificare netrimisă', { userId, error: error.message })
}
