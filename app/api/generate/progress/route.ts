import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { KieClient } from '@/lib/kie/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/generate/progress?task_id=xxx&image_record_id=xxx
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('task_id')
  const imageRecordId = searchParams.get('image_record_id')

  if (!taskId) {
    return new Response('task_id required', { status: 400 })
  }

  const encoder = new TextEncoder()

  function send(data: object) {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  const stream = new ReadableStream({
    async start(controller) {
      const supabase = createAdminClient()
      const kie = new KieClient()
      const startTime = Date.now()
      const maxWait = 5 * 60 * 1000 // 5 min max for SSE

      // Phase labels for UI
      const phases = [
        { state: 'waiting',    pct: 5,  label: 'Se asazã în coadã...' },
        { state: 'queuing',    pct: 15, label: 'Se pregateste generarea...' },
        { state: 'generating', pct: 40, label: 'AI construieste imaginea...' },
      ]

      // Send initial event
      controller.enqueue(send({ type: 'start', taskId, timestamp: Date.now() }))

      let lastState = ''
      let progressPct = 5

      while (true) {
        const elapsed = Date.now() - startTime
        if (elapsed > maxWait) {
          controller.enqueue(send({ type: 'timeout', message: 'Generarea dureaza prea mult. Revino in câteva minute.' }))
          controller.close()
          return
        }

        try {
          const task = await kie.getTaskStatus(taskId)

          // Progress simulation within generating state
          if (task.state === 'generating' && lastState === 'generating') {
            progressPct = Math.min(95, progressPct + Math.random() * 8)
          } else {
            const phase = phases.find(p => p.state === task.state)
            if (phase) progressPct = phase.pct
          }

          if (task.state !== lastState) {
            const phase = phases.find(p => p.state === task.state)
            controller.enqueue(send({
              type: 'progress',
              state: task.state,
              pct: progressPct,
              label: phase?.label || 'Se proceseaza...',
            }))
            lastState = task.state
          } else if (task.state === 'generating') {
            // Send incremental progress updates during generation
            controller.enqueue(send({
              type: 'progress',
              state: task.state,
              pct: Math.round(progressPct),
              label: 'AI construieste imaginea...',
            }))
          }

          if (task.state === 'success') {
            const result = JSON.parse(task.resultJson || '{}')
            const urls: string[] = result.resultUrls || []

            // Update DB record if we have it
            if (imageRecordId && urls[0]) {
              await supabase
                .from('generated_images')
                .update({
                  generated_image_url: urls[0],
                  variants: urls.length > 1 ? urls : null,
                  status: 'completed',
                  processing_time_ms: Date.now() - startTime,
                })
                .eq('id', imageRecordId)
            }

            controller.enqueue(send({
              type: 'done',
              urls,
              primary_url: urls[0],
              pct: 100,
              processing_ms: Date.now() - startTime,
            }))
            controller.close()
            return
          }

          if (task.state === 'fail') {
            if (imageRecordId) {
              await supabase
                .from('generated_images')
                .update({ status: 'failed' })
                .eq('id', imageRecordId)
            }
            controller.enqueue(send({
              type: 'error',
              message: task.failMsg || 'Generarea a eșuat',
            }))
            controller.close()
            return
          }

        } catch (err: any) {
          controller.enqueue(send({ type: 'error', message: err.message || 'Eroare la verificarea statusului' }))
          controller.close()
          return
        }

        // Adaptive poll interval
        const interval = elapsed < 20000 ? 2500 : elapsed < 60000 ? 4000 : 7000
        await new Promise(r => setTimeout(r, interval))
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}