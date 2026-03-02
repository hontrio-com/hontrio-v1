import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-cache, no-store',
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId lipsește' }, { status: 400, headers: CORS })
    }

    const supabase = createAdminClient()

    const { data: config, error } = await supabase
      .from('agent_configs')
      .select('is_active, agent_name, welcome_message, widget_color, widget_position, widget_size, widget_bottom_offset, whatsapp_number')
      .eq('user_id', userId)
      .single()

    // Dacă nu există config deloc, returnăm defaults în loc de 403
    // Ca widgetul să funcționeze chiar dacă agentul nu e configurat complet
    if (!config) {
      return NextResponse.json({
        agent_name: 'Asistent',
        welcome_message: 'Bună! Cu ce te pot ajuta?',
        widget_color: '#2563eb',
        widget_position: 'bottom-right',
        widget_size: 'medium',
        widget_bottom_offset: 20,
        has_whatsapp: false,
        quick_replies: ['Caut un produs', 'Am o întrebare', 'Livrare & retur'],
      }, { headers: CORS })
    }

    // Dacă există dar e inactiv, tot returnăm 403 cu CORS
    if (!config.is_active) {
      return NextResponse.json({ error: 'Agent inactiv' }, { status: 403, headers: CORS })
    }

    const { data: store } = await supabase
      .from('stores')
      .select('store_name, store_url')
      .eq('user_id', userId)
      .single()

    const storeName = store?.store_name || ''

    return NextResponse.json({
      agent_name: config.agent_name + (storeName ? ` — ${storeName}` : ''),
      welcome_message: config.welcome_message,
      widget_color: config.widget_color || '#2563eb',
      widget_position: config.widget_position || 'bottom-right',
      widget_size: config.widget_size || 'medium',
      widget_bottom_offset: config.widget_bottom_offset || 20,
      has_whatsapp: !!config.whatsapp_number,
      quick_replies: ['Caut un produs', 'Am o întrebare', 'Livrare & retur'],
    }, { headers: CORS })

  } catch (err) {
    console.error('[Public Config]', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500, headers: CORS })
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS })
}