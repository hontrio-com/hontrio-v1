import { createAdminClient } from '@/lib/supabase/admin'
import { sseClients } from '@/lib/sse-store'

type SSEController = ReadableStreamDefaultController<Uint8Array>

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return new Response('userId lipsește', { status: 400, headers: CORS })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller: SSEController) {
      if (!sseClients.has(userId)) sseClients.set(userId, new Set())
      sseClients.get(userId)!.add(controller)

      // Trimite config-ul curent imediat la conectare
      const supabase = createAdminClient()
      supabase
        .from('agent_configs')
        .select('is_active, agent_name, welcome_message, widget_color, widget_position, widget_size, widget_bottom_offset, widget_button_shape, widget_button_label, widget_avatar_url, widget_intro_animation, widget_custom_css, quick_replies, whatsapp_number')
        .eq('user_id', userId)
        .single()
        .then(({ data: config }: { data: any }) => {
          if (config?.is_active) {
            try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(config)}\n\n`)) } catch {}
          }
        })

      // Heartbeat la 25s
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')) }
        catch { clearInterval(heartbeat); sseClients.get(userId)?.delete(controller) }
      }, 25000)

      // FIX: Timeout explicit de 30 minute — conexiunile nu rămân deschise indefinit
      const maxTimeout = setTimeout(() => {
        clearInterval(heartbeat)
        sseClients.get(userId)?.delete(controller)
        try {
          controller.enqueue(encoder.encode('event: timeout\ndata: {"reason":"max_duration"}\n\n'))
          controller.close()
        } catch {}
      }, 30 * 60 * 1000) // 30 minute

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        clearTimeout(maxTimeout)
        sseClients.get(userId)?.delete(controller)
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