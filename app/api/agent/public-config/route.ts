import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public endpoint — no auth needed, used by the widget embed
// Only returns safe, non-sensitive config fields
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId lipsește' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: config } = await supabase
      .from('agent_configs')
      .select('is_active, agent_name, welcome_message, widget_color, widget_position, widget_size, whatsapp_number')
      .eq('user_id', userId)
      .single()

    if (!config || !config.is_active) {
      return NextResponse.json({ error: 'Agent inactiv' }, { status: 403 })
    }

    // Load store name for context
    const { data: store } = await supabase
      .from('stores')
      .select('store_name, store_url')
      .eq('user_id', userId)
      .single()

    const storeName = store?.store_name || ''

    return NextResponse.json({
      agent_name: config.agent_name + (storeName ? ` ${storeName}` : ''),
      welcome_message: config.welcome_message,
      widget_color: config.widget_color,
      widget_position: config.widget_position,
      widget_size: config.widget_size,
      has_whatsapp: !!config.whatsapp_number,
      quick_replies: ['Caut un produs', 'Am o întrebare', 'Livrare & retur'],
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60',
      }
    })
  } catch (err) {
    console.error('[Public Config]', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    }
  })
}