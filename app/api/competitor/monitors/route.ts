import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeUrl } from '@/lib/competitor/url-utils'

// GET - list all monitors for user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('competitor_monitors')
      .select(`
        *,
        competitor_snapshots(seo_score, captured_at)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ monitors: [] })

    // Attach latest snapshot score to each monitor
    const monitors = (data || []).map((m: any) => {
      const snaps = m.competitor_snapshots || []
      const latest = snaps.sort((a: any, b: any) =>
        new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
      )[0]
      return {
        ...m,
        latest_score: latest?.seo_score ?? null,
        last_snapshot_at: latest?.captured_at ?? null,
        competitor_snapshots: undefined,
      }
    })

    return NextResponse.json({ monitors })
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST - add a new monitor
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { competitor_url, competitor_label, check_frequency_hours = 24 } = await request.json()
    if (!competitor_url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    const normalizedUrl = normalizeUrl(competitor_url)

    // Check limit: max 10 monitors per user
    const { count } = await supabase
      .from('competitor_monitors')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if ((count || 0) >= 10) {
      return NextResponse.json({ error: 'Limit of 10 monitored competitors reached' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('competitor_monitors')
      .upsert({
        user_id: userId,
        competitor_url: normalizedUrl,
        competitor_label: competitor_label || new URL(normalizedUrl).hostname.replace('www.', ''),
        check_frequency_hours,
        is_active: true,
      }, { onConflict: 'user_id,competitor_url' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Save error' }, { status: 500 })
    return NextResponse.json({ monitor: data })
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE - remove a monitor
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await supabase.from('competitor_monitors').delete().eq('id', id).eq('user_id', userId)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH - toggle active / change frequency
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { id, is_active, check_frequency_hours, competitor_label } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const updates: any = {}
    if (is_active !== undefined) updates.is_active = is_active
    if (check_frequency_hours !== undefined) updates.check_frequency_hours = check_frequency_hours
    if (competitor_label !== undefined) updates.competitor_label = competitor_label

    const { data, error } = await supabase
      .from('competitor_monitors')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Update error' }, { status: 500 })
    return NextResponse.json({ monitor: data })
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}