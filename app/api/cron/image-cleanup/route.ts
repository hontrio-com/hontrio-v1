import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { storedMessage } from '@/lib/i18n/stored'

// Cron: verifică imagini stuck în 'processing' mai vechi de 10 minute
// Le marchează failed și returnează creditele
// Răspunsurile JSON sunt pentru Vercel; descrierea rambursării se salvează ca cheie de traducere.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) // i18n-ignore
  }

  try {
    const supabase = createAdminClient()
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    const { data: stuck } = await supabase
      .from('generated_images')
      .select('id, user_id, credits_used')
      .eq('status', 'processing')
      .lt('created_at', tenMinAgo)
      .limit(50)

    if (!stuck?.length) {
      return NextResponse.json({ cleaned: 0 })
    }

    let refunded = 0
    for (const img of stuck) {
      await supabase
        .from('generated_images')
        .update({ status: 'failed' })
        .eq('id', img.id)

      if (img.credits_used > 0) {
        const { data: newBalance } = await supabase.rpc('refund_credits', {
          p_user_id: img.user_id,
          p_amount: img.credits_used
        })
        if (typeof newBalance === 'number' && newBalance >= 0) {
          await supabase.from('credit_transactions').insert({
            user_id: img.user_id,
            type: 'refund',
            amount: img.credits_used,
            balance_after: newBalance,
            description: storedMessage('api.tx_refund_image_timeout'),
            reference_type: 'image_generation_timeout',
            reference_id: img.id,
          })
          refunded++
        }
      }
    }

    console.log(`[Cron/ImageCleanup] Cleaned ${stuck.length} stuck images, refunded ${refunded}`)
    return NextResponse.json({ cleaned: stuck.length, refunded })
  } catch (err) {
    console.error('[Cron/ImageCleanup]', err)
    return NextResponse.json({ error: 'Eroare' }, { status: 500 }) // i18n-ignore
  }
}
