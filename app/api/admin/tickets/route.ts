import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status  = searchParams.get('status') || ''
    const search  = searchParams.get('search') || ''
    const page    = parseInt(searchParams.get('page') || '1')
    const perPage = 20
    const from    = (page - 1) * perPage

    const supabase = createAdminClient()

    let query = supabase
      .from('tickets')
      .select('*, users!inner(name, email)', { count: 'exact' })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`subject.ilike.%${search}%,users.name.ilike.%${search}%,users.email.ilike.%${search}%`)
    }

    const { data: tickets, count, error } = await query
      .order('updated_at', { ascending: false })
      .range(from, from + perPage - 1)

    if (error) {
      return NextResponse.json({ error: 'Eroare la încărcarea tichetelor' }, { status: 500 })
    }

    // Status counts
    const { data: allTickets } = await supabase
      .from('tickets')
      .select('status')

    const statusCounts = {
      all:         allTickets?.length || 0,
      open:        allTickets?.filter((t: any) => t.status === 'open').length || 0,
      in_progress: allTickets?.filter((t: any) => t.status === 'in_progress').length || 0,
      resolved:    allTickets?.filter((t: any) => t.status === 'resolved').length || 0,
      closed:      allTickets?.filter((t: any) => t.status === 'closed').length || 0,
    }

    return NextResponse.json({
      tickets: tickets || [],
      total: count || 0,
      page,
      total_pages: Math.ceil((count || 0) / perPage),
      status_counts: statusCounts,
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}