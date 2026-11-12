import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { showAttachments } from '@/lib/tickets/attachments'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET /api/admin/tickets?status=&search=&page= — tichetele tuturor, pentru echipă.
// Căutarea intră într-un filtru PostgREST: caracterele lui speciale se scot.
// =============================================

const STATUSES = ['open', 'in_progress', 'resolved', 'closed']

export async function GET(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const search = (searchParams.get('search') || '').replace(/[,()*%\\"'.:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
    const perPage = 20
    const from = (page - 1) * perPage

    const supabase = createAdminClient()
    let query = supabase.from('tickets').select('*, users!inner(name, email)', { count: 'exact' })
    if (STATUSES.includes(status)) query = query.eq('status', status)
    if (search) query = query.or(`subject.ilike.*${search}*,users.name.ilike.*${search}*,users.email.ilike.*${search}*`)

    const { data: tickets, count, error } = await query.order('updated_at', { ascending: false }).range(from, from + perPage - 1)
    if (error) return NextResponse.json({ error: t('api.tickets_load_failed') }, { status: 500 })

    const [{ data: allTickets }, shown] = await Promise.all([
      supabase.from('tickets').select('status'),
      showAttachments(supabase, (tickets ?? []).map(x => x.attachments)),
    ])
    const statusCounts = {
      all: allTickets?.length || 0,
      open: allTickets?.filter(x => x.status === 'open').length || 0,
      in_progress: allTickets?.filter(x => x.status === 'in_progress').length || 0,
      resolved: allTickets?.filter(x => x.status === 'resolved').length || 0,
      closed: allTickets?.filter(x => x.status === 'closed').length || 0,
    }

    return NextResponse.json({
      tickets: (tickets ?? []).map((x, i) => ({ ...x, attachments: shown[i] })),
      total: count || 0,
      page,
      total_pages: Math.ceil((count || 0) / perPage),
      status_counts: statusCounts,
    })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
