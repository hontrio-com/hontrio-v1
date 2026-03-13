import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Cron: verifică imagini stuck în 'processing' mai vechi de 10 minute
// Le marchează failed și returnează creditele
export async function GET() {
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
        const { data: user } = await supabase
          .from('users')
          .select('credits')
          .eq('id', img.user_id)
          .single()

        if (user) {
          const newBal = user.credits + img.credits_used
          await supabase.from('users').update({ credits: newBal }).eq('id', img.user_id)
          await supabase.from('credit_transactions').insert({
            user_id: img.user_id,
            type: 'refund',
            amount: img.credits_used,
            balance_after: newBal,
            description: 'Refund automat — generare imagine timeout',
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
    return NextResponse.json({ error: 'Eroare' }, { status: 500 })
  }
}
