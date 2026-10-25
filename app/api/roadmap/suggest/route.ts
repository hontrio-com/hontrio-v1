// POST /api/roadmap/suggest
// Sends a suggestion email via Resend (or logs if no API key)
// Rută publică: tot ce vine de la vizitator se verifică și se escapează în HTML
import { NextResponse } from 'next/server'
import { getT, tFor } from '@/lib/i18n/server'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'

const MAX_EMAIL = 254
const MAX_MESSAGE = 5000

const escHtml = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export async function POST(request: Request) {
  const t = await getT()
  try {
    // Fiecare sugestie trimite un e-mail: câteva pe oră de la o adresă IP ajung
    const rl = rateLimit(`roadmap-suggest:${getClientIp(request)}`, 5, 60 * 60 * 1000)
    if (!rl.success) return NextResponse.json({ error: t('api.rate_limited') }, { status: 429 })

    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!email || !message) {
      return NextResponse.json({ error: t('api.email_message_required') }, { status: 400 })
    }
    if (email.length > MAX_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: t('api.email_invalid') }, { status: 400 })
    }
    if (message.length > MAX_MESSAGE) {
      return NextResponse.json({ error: t('api.message_too_long') }, { status: 400 })
    }

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      // E-mail intern, pentru echipa Hontrio: mereu în română
      const te = tFor('ro')
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Hontrio <noreply@hontrio.com>',
          to: ['contact@hontrio.com'],
          // Adresa a trecut deja de verificarea de mai sus (fără spații sau rânduri noi)
          subject: te('email.roadmap_subject', { email }),
          html: `<p><strong>${te('email.roadmap_email_label')}</strong> ${escHtml(email)}</p><p><strong>${te('email.roadmap_suggestion_label')}</strong></p><p>${escHtml(message).replace(/\n/g, '<br>')}</p>`,
        }),
      })
      if (!res.ok) {
        console.error('Resend error:', await res.text())
      }
    } else {
      console.log('Roadmap suggestion (no RESEND_API_KEY):', { email, message })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/roadmap/suggest error:', err)
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
