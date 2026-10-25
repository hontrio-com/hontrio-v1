import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { KieClient } from '@/lib/kie/client'
import { getT } from '@/lib/i18n/server'
import { storedMessage } from '@/lib/i18n/stored'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return new Response(t('api.unauthorized'), { status: 401 })
  const userId = (session.user as any).id

  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('task_id')
  const imageRecordId = searchParams.get('image_record_id')

  if (!taskId) return new Response(t('api.invalid_request'), { status: 400 })

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
          controller.enqueue(send({ type: 'timeout', message: t('api.generation_timeout') }))
          controller.close()
          return
        }

        try {
          const task = await kie.getTaskStatus(taskId)

          if (task.state !== lastState) {
            const labels: Record<string, string> = {
              waiting: t('api.generation_queued'),
              queuing: t('api.generation_preparing'),
              generating: t('api.generation_building'),
            }
            controller.enqueue(send({
              type: 'progress',
              state: task.state,
              label: labels[task.state] || t('common.processing'),
            }))
            lastState = task.state
          }

          if (task.state === 'success') {
            const result = JSON.parse(task.resultJson || '{}')
            const urls: string[] = result.resultUrls || []

            if (imageRecordId && urls[0]) {
              // Load image record — FIX: verify ownership with user_id
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

              // Credits were deducted at task creation (/api/generate/image)
              // Here we only save the result
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
              
              // FIX: Refund credits deducted at creation — generation failed
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
                    description: storedMessage('api.tx_refund_image_failed'),
                    reference_type: 'image_generation_refund', reference_id: imageRecordId,
                  })
                }
              }
            }
            controller.enqueue(send({ type: 'error', message: task.failMsg || t('api.generation_failed') }))
            controller.close()
            return
          }

        } catch (err: any) {
          controller.enqueue(send({ type: 'error', message: err.message || t('api.generation_status_failed') }))
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