import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-WC-Webhook-Signature' }

// GET — lista review requests (dashboard)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('review_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    return NextResponse.json({ requests: data || [] })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}

// POST — WooCommerce webhook order.completed SAU cron pentru trimitere
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Dacă e un cron job intern (send_pending)
    if (body.action === 'send_pending') {
      return await sendPendingReviews()
    }

    // WooCommerce webhook — order completed
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 }, )

    const supabase = createAdminClient()
    const { data: config } = await supabase.from('agent_configs').select('review_enabled,review_delay_days').eq('user_id', userId).single()
    if (!config?.review_enabled) return NextResponse.json({ ok: true, skipped: 'reviews disabled' }, { headers: CORS })

    // Extrage datele comenzii din webhook WooCommerce
    const order = body
    const orderId = String(order.id || order.order_id || '')
    const customerEmail = order.billing?.email || order.customer?.email || ''
    const customerName = order.billing?.first_name || order.customer?.first_name || ''
    const productNames = (order.line_items || []).map((item: any) => item.name).filter(Boolean)

    if (!orderId || !customerEmail) return NextResponse.json({ ok: false, error: 'Incomplete order data' }, { headers: CORS })

    const delayDays = config.review_delay_days || 7
    const scheduledAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('review_requests').upsert({
      user_id: userId, order_id: orderId,
      customer_email: customerEmail, customer_name: customerName,
      product_names: productNames, status: 'pending', scheduled_at: scheduledAt,
    }, { onConflict: 'user_id,order_id' })

    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS })
  }
}

async function sendPendingReviews() {
  try {
    const supabase = createAdminClient()
    const { data: pending } = await supabase
      .from('review_requests')
      .select('*, agent_configs!inner(review_enabled,review_google_url,review_site_enabled,review_email_subject,review_email_body,agent_name)')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .limit(50)

    if (!pending?.length) return NextResponse.json({ ok: true, sent: 0 })

    let sent = 0
    for (const req of pending) {
      const cfg = (req as any).agent_configs
      if (!cfg?.review_enabled) continue

      const subject = cfg.review_email_subject || `How was your experience? Leave a review!`
      const googleLink = cfg.review_google_url ? `<a href="${cfg.review_google_url}" style="...">⭐ Review on Google</a>` : ''
      const productList = (req.product_names || []).join(', ')

      const html = buildReviewEmail({
        customerName: req.customer_name || 'client',
        productNames: productList,
        googleUrl: cfg.review_google_url,
        reviewSiteEnabled: cfg.review_site_enabled,
        agentName: cfg.agent_name || 'Our Team',
        customBody: cfg.review_email_body,
      })

      const ok = await sendEmail({ to: req.customer_email, subject, html })
      if (ok) {
        await supabase.from('review_requests').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', req.id)
        sent++
      }
    }

    return NextResponse.json({ ok: true, sent })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

function buildReviewEmail(opts: { customerName: string; productNames: string; googleUrl?: string; reviewSiteEnabled?: boolean; agentName: string; customBody?: string }) {
  const { customerName, productNames, googleUrl, agentName, customBody } = opts
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:20px">
  <div style="max-width:540px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:linear-gradient(135deg,#1e40af,#2563eb);padding:28px;text-align:center">
      <p style="color:white;font-size:28px;margin:0">⭐</p>
      <h1 style="color:white;font-size:18px;margin:8px 0 0;font-weight:700">How did you like your order?</h1>
    </div>
    <div style="padding:28px">
      <p style="color:#374151;font-size:15px;margin:0 0 12px">Hi${customerName ? ` ${customerName}` : ''}!</p>
      ${customBody ? `<p style="color:#4b5563;font-size:14px">${customBody}</p>` : `
      <p style="color:#4b5563;font-size:14px;line-height:1.6">We hope you're satisfied with ${productNames ? `<strong>${productNames}</strong>` : 'your order'}. Your opinion matters enormously to us and to other customers!</p>
      `}
      <div style="margin:24px 0;display:flex;flex-direction:column;gap:10px">
        ${googleUrl ? `
        <a href="${googleUrl}" style="display:block;text-align:center;background:#4285f4;color:white;text-decoration:none;padding:13px 20px;border-radius:12px;font-weight:600;font-size:14px">
          ⭐ Leave a review on Google
        </a>` : ''}
      </div>
      <p style="color:#9ca3af;font-size:12px;margin:20px 0 0">With love, ${agentName}</p>
    </div>
    <div style="background:#f9fafb;padding:14px 28px;border-top:1px solid #f3f4f6;text-align:center">
      <p style="margin:0;font-size:11px;color:#9ca3af">Automated email sent via Hontrio · <a href="https://hontrio.com" style="color:#2563eb;text-decoration:none">hontrio.com</a></p>
    </div>
  </div>
</body></html>`
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS })
}