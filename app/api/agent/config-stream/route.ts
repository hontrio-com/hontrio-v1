import { createAdminClient } from '@/lib/supabase/admin'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Map de clienți conectați per userId: userId -> Set<controller>
const clients = new Map<string, Set<ReadableStreamDefaultController>>()

// Funcție publică apelată din config route când se salvează
export function notifyConfigChange(userId: string, config: any) {
  const userClients = clients.get(userId)
  if (!userClients || userClients.size === 0) return
  const data = `data: ${JSON.stringify(config)}\n\n`
  const encoder = new TextEncoder()
  for (const ctrl of userClients) {
    try { ctrl.enqueue(encoder.encode(data)) } catch { userClients.delete(ctrl) }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return new Response('userId lipsește', { status: 400, headers: CORS })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Înregistrează clientul
      if (!clients.has(userId)) clients.set(userId, new Set())
      clients.get(userId)!.add(controller)

      // Trimite config-ul curent imediat la conectare
      const supabase = createAdminClient()
      supabase
        .from('agent_configs')
        .select('is_active, agent_name, welcome_message, widget_color, widget_position, widget_size, widget_bottom_offset, widget_button_shape, widget_button_label, widget_avatar_url, widget_intro_animation, widget_custom_css, quick_replies, whatsapp_number')
        .eq('user_id', userId)
        .single()
        .then(({ data: config }) => {
          if (config?.is_active) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(config)}\n\n`))
            } catch {}
          }
        })

      // Heartbeat la 25s ca să nu se închidă conexiunea
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')) }
        catch { clearInterval(heartbeat); clients.get(userId)?.delete(controller) }
      }, 25000)

      // Cleanup la disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        clients.get(userId)?.delete(controller)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS })
}