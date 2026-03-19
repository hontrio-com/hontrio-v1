import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { KieClient } from '@/lib/kie/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return new Response('Unauthorized', { status: 401 })
  const userId = (session.user as any).id

  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('task_id')
  const imageRecordId = searchParams.get('image_record_id')

  if (!taskId) return new Response('task_id required', { status: 400 })

  const encoder = new TextEncoder()
  function send(data: object) {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  const stream = new ReadableStream({
    async start(controller) {
      const supabase = createAdminClient()
      const kie = new KieClient()
      const startTime = Date.now()
      const maxWait = 5 * 60 * 1000

      controller.enqueue(send({ type: 'start', taskId, timestamp: Date.now() }))

      let lastState = ''
      let aborted = false
      request.signal.addEventListener('abort', () => { aborted = true })

      while (true) {
        if (aborted) { try { controller.close() } catch {} return }
        const elapsed = Date.now() - startTime
        if (elapsed > maxWait) {
          controller.enqueue(send({ type: 'timeout', message: 'Generarea durează prea mult. Revino în câteva minute.' }))
          controller.close()
          return
        }

        try {
          const task = await kie.getTaskStatus(taskId)

          if (task.state !== lastState) {
            const labels: Record<string, string> = {
              waiting: 'Se așază în coadă...',
              queuing: 'Se pregătește generarea...',
              generating: 'AI construiește imaginea...',
            }
            controller.enqueue(send({
              type: 'progress',
              state: task.state,
              label: labels[task.state] || 'Se procesează...',
            }))
            lastState = task.state
          }

          if (task.state === 'success') {
            const result = JSON.parse(task.resultJson || '{}')
            const urls: string[] = result.resultUrls || []

            if (imageRecordId && urls[0]) {
              // Load image record — FIX: verificăm ownership cu user_id
              const { data: imgRecord } = await supabase
                .from('generated_images')
                .select('credits_used, product_id, user_id')
                .eq('id', imageRecordId)
                .eq('user_id', userId)
                .single()

              // Update image record to completed
              await supabase
                .from('generated_images')
                .update({
                  generated_image_url: urls[0],
                  variants: urls.length > 1 ? urls : null,
                  status: 'completed',
                  processing_time_ms: Date.now() - startTime,
                })
                .eq('id', imageRecordId)

              // Creditele au fost deduse la crearea taskului (/api/generate/image)
              // Aici doar salvăm rezultatul
            }

            controller.enqueue(send({
              type: 'done',
              urls,
              primary_url: urls[0],
              processing_ms: Date.now() - startTime,
            }))
            controller.close()
            return
          }

          if (task.state === 'fail') {
            if (imageRecordId) {
              await supabase.from('generated_images').update({ status: 'failed' }).eq('id', imageRecordId)
              
              // FIX: Refund creditele deduse la creare — generarea a eșuat
              const { data: failedImg } = await supabase
                .from('generated_images')
                .select('credits_used')
                .eq('id', imageRecordId)
                .eq('user_id', userId)
                .single()
              
              if (failedImg?.credits_used) {
                const { data: newBalance } = await supabase.rpc('refund_credits', {
                  p_user_id: userId,
                  p_amount: failedImg.credits_used,
                })
                if (typeof newBalance === 'number' && newBalance >= 0) {
                  await supabase.from('credit_transactions').insert({
                    user_id: userId, type: 'refund', amount: failedImg.credits_used,
                    balance_after: newBalance,
                    description: 'Refund — generare imagine eșuată',
                    reference_type: 'image_generation_refund', reference_id: imageRecordId,
                  })
                }
              }
            }
            controller.enqueue(send({ type: 'error', message: task.failMsg || 'Generarea a eșuat' }))
            controller.close()
            return
          }

        } catch (err: any) {
          controller.enqueue(send({ type: 'error', message: err.message || 'Eroare la verificarea statusului' }))
          controller.close()
          return
        }

        const interval = elapsed < 20000 ? 2500 : elapsed < 60000 ? 4000 : 7000
        if (aborted) { try { controller.close() } catch {} return }
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