import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET   /api/notifications — notificările contului și anunțurile globale
// POST  /api/notifications — trimite o notificare (doar admin)
// PATCH /api/notifications — { notification_ids } sau { mark_all }: citite
//   Fiecare om își marchează doar notificările lui; un anunț global se
//   marchează citit doar pentru el (notification_reads), nu pentru toți.
// =============================================

const ROUTE = '/api/notifications'
const VALID_TYPES = ['info', 'warning', 'success', 'error']

type Supabase = ReturnType<typeof createAdminClient>

/** Anunțurile globale citite de om, dintre cele date. */
async function readGlobals(supabase: Supabase, userId: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const { data, error } = await supabase.from('notification_reads').select('notification_id').eq('user_id', userId).in('notification_id', ids)
  if (error) logApiError(ROUTE, 500, 'Citirile anunțurilor n-au putut fi încărcate', { userId, error: error.message })
  return new Set((data ?? []).map(r => String(r.notification_id)))
}

export async function GET() {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    const userId = session.user.id
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${userId},is_global.eq.true`)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      logApiError(ROUTE, 500, 'Notificările n-au putut fi încărcate', { userId, error: error.message })
      return NextResponse.json({ error: t('api.notifications_load_failed') }, { status: 500 })
    }

    const list = data ?? []
    const read = await readGlobals(supabase, userId, list.filter(n => n.is_global).map(n => String(n.id)))
    const notifications = list.map(n => (n.is_global ? { ...n, is_read: read.has(String(n.id)) } : n))
    return NextResponse.json({ notifications, unreadCount: notifications.filter(n => !n.is_read).length })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
    const adminId = session.user.id

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 200) : ''
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 2000) : ''
    if (!title || !message) return NextResponse.json({ error: t('api.title_message_required') }, { status: 400 })
    const type = typeof body?.type === 'string' && VALID_TYPES.includes(body.type) ? body.type : 'info'

    const supabase = createAdminClient()
    if (body?.is_global === true) {
      const { data, error } = await supabase
        .from('notifications')
        .insert({ user_id: null, title, message, type, is_global: true, created_by: adminId })
        .select()
        .single()
      if (error) {
        logApiError(ROUTE, 500, 'Anunțul n-a putut fi trimis', { error: error.message })
        return NextResponse.json({ error: t('api.notification_send_failed') }, { status: 500 })
      }
      return NextResponse.json({ notification: data, message: t('api.notification_sent_global') })
    }

    const targetId = typeof body?.user_id === 'string' ? body.user_id : ''
    if (!targetId) return NextResponse.json({ error: t('api.user_id_missing') }, { status: 400 })
    const { data: user } = await supabase.from('users').select('id').eq('id', targetId).maybeSingle()
    if (!user) return NextResponse.json({ error: t('api.user_not_found') }, { status: 404 })

    const { data, error } = await supabase
      .from('notifications')
      .insert({ user_id: targetId, title, message, type, is_global: false, created_by: adminId })
      .select()
      .single()
    if (error) {
      logApiError(ROUTE, 500, 'Notificarea n-a putut fi trimisă', { error: error.message })
      return NextResponse.json({ error: t('api.notification_send_failed') }, { status: 500 })
    }
    return NextResponse.json({ notification: data, message: t('api.notification_sent') })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    const userId = session.user.id

    const body = await request.json().catch(() => null) as { notification_ids?: unknown; mark_all?: unknown } | null
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    let globalIds: string[] = []
    if (body?.mark_all === true) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
      const { data } = await supabase.from('notifications').select('id').eq('is_global', true).order('created_at', { ascending: false }).limit(50)
      globalIds = (data ?? []).map(n => String(n.id))
    } else if (Array.isArray(body?.notification_ids) && body.notification_ids.length) {
      const ids = [...new Set(body.notification_ids.filter((x): x is string | number => typeof x === 'string' || typeof x === 'number').map(String))].slice(0, 100)
      if (!ids.length) return NextResponse.json({ error: t('api.nothing_to_update') }, { status: 400 })
      // Doar notificările omului...
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).in('id', ids)
      // ...și, pentru el, anunțurile globale dintre ele
      const { data } = await supabase.from('notifications').select('id').eq('is_global', true).in('id', ids)
      globalIds = (data ?? []).map(n => String(n.id))
    } else {
      return NextResponse.json({ error: t('api.nothing_to_update') }, { status: 400 })
    }

    if (globalIds.length) {
      const { error } = await supabase.from('notification_reads')
        .upsert(globalIds.map(id => ({ user_id: userId, notification_id: id, read_at: now })), { onConflict: 'user_id,notification_id', ignoreDuplicates: true })
      if (error) logApiError(ROUTE, 500, 'Anunțurile n-au putut fi marcate citite', { userId, error: error.message })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
