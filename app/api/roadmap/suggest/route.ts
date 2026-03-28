// POST /api/roadmap/suggest
// Sends a suggestion email via Resend (or logs if no API key)
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, message } = await request.json()
    if (!email || !message) {
      return NextResponse.json({ error: 'Email and message required' }, { status: 400 })
    }

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Hontrio <noreply@hontrio.com>',
          to: ['contact@hontrio.com'],
          subject: `Sugestie Roadmap -- ${email}`,
          html: `<p><strong>Email:</strong> ${email}</p><p><strong>Sugestie:</strong></p><p>${message.replace(/\n/g, '<br>')}</p>`,
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
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
