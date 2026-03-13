import { NextResponse } from 'next/server'
import { notifyConfigChange } from '@/lib/sse-store'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: config } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Also get store info for widget snippet generation
    const { data: store } = await supabase
      .from('stores')
      .select('id, store_url, store_name')
      .eq('user_id', userId)
      .single()

    return NextResponse.json({
      config: config || null,
      store: store || null,
    })
  } catch (err) {
    console.error('[Agent Config GET]', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const body = await request.json()

    const allowed = [
      'is_active', 'agent_name', 'welcome_message',
      'whatsapp_number', 'whatsapp_message',
      'widget_position', 'widget_color', 'widget_size', 'widget_bottom_offset',
      'widget_button_shape', 'widget_button_label', 'widget_avatar_url',
      'widget_intro_animation', 'widget_custom_css', 'quick_replies',
      'language', 'max_products_shown', 'show_prices', 'show_images',
      'notify_email', 'notify_on_escalation', 'notify_on_problem', 'notify_on_no_answer',
    ]

    const safeData: Record<string, any> = { user_id: userId, updated_at: new Date().toISOString() }
    for (const [k, v] of Object.entries(body)) {
      if (allowed.includes(k)) safeData[k] = v
    }

    const supabase = createAdminClient()

    // Get store_id
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (store) safeData.store_id = store.id

    const { data, error } = await supabase
      .from('agent_configs')
      .upsert(safeData, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error

    // FIX: Notifică widget-ul via SSE că config-ul s-a schimbat
    try { notifyConfigChange(userId, data) } catch {}

    return NextResponse.json({ success: true, config: data })
  } catch (err: any) {
    console.error('[Agent Config POST]', err)
    return NextResponse.json({ error: err.message || 'Eroare internă' }, { status: 500 })
  }
}