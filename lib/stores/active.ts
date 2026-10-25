import { createAdminClient } from '@/lib/supabase/admin'

// =============================================
// Magazinul activ al contului. Un cont poate lega mai multe magazine
// (Edinio, WooCommerce, Shopify); paginile lucrează pe cel ales de om
// (users.active_store_id), iar fără alegere, pe cel mai nou.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>
type Result<T> = { data: T | null; error: { message: string } | null }

/** Magazinul pe care lucrează paginile, cu coloanele cerute. */
export async function getActiveStore<T = Record<string, unknown>>(supabase: Supabase, userId: string, columns: string): Promise<Result<T>> {
  const { data: user, error: eUser } = await supabase.from('users').select('active_store_id').eq('id', userId).maybeSingle()
  if (eUser) return { data: null, error: eUser }

  if (user?.active_store_id) {
    const { data, error } = await supabase.from('stores').select(columns)
      .eq('id', user.active_store_id).eq('user_id', userId).maybeSingle()
    if (error) return { data: null, error }
    if (data) return { data: data as unknown as T, error: null }
  }
  // Fără alegere (sau magazinul ales a dispărut): cel mai nou
  const { data, error } = await supabase.from('stores').select(columns)
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return { data: (data as unknown as T) ?? null, error }
}

/** Alege magazinul activ; doar dintre magazinele omului. */
export async function setActiveStore(supabase: Supabase, userId: string, storeId: string): Promise<boolean> {
  const { data: store } = await supabase.from('stores').select('id').eq('id', storeId).eq('user_id', userId).maybeSingle()
  if (!store) return false
  const { error } = await supabase.from('users').update({ active_store_id: storeId }).eq('id', userId)
  return !error
}
