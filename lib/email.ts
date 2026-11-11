import { tFor } from '@/lib/i18n/server'
import type { Locale } from '@/lib/i18n/config'

// Șabloanele primesc limba destinatarului și își iau textele din secțiunea
// `email` a dicționarului (subiect, corp, butoane, subsol).

function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@hontrio.com'
const APP_URL = process.env.NEXTAUTH_URL || 'https://hontrio.com'

type EmailPayload = {
  to: string
  subject: string
  html: string
}

/** Un e-mail gata de trimis: subiectul și corpul, în limba destinatarului. */
export type EmailContent = {
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — email not sent')
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[Email] Resend error:', err)
      return false
    }
    return true
  } catch (err) {
    console.error('[Email] sendEmail error:', err)
    return false
  }
}

// ─── Email wrapper template ──────────────────────────────────────────────────

function emailWrapper(content: string, locale: Locale): string {
  const t = tFor(locale)
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5">
    <!-- Header -->
    <div style="padding:32px 32px 0;text-align:center">
      <img src="${APP_URL}/logo-black.png" alt="Hontrio" height="28" style="display:inline-block" />
    </div>
    <!-- Content -->
    <div style="padding:32px">${content}</div>
    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center">
      <p style="margin:0;font-size:11px;color:#a3a3a3">Hontrio &mdash; ${t('email.footer_tagline')}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#a3a3a3"><a href="${APP_URL}" style="color:#a3a3a3">hontrio.com</a></p>
    </div>
  </div>
</body></html>`
}

// ─── Welcome email (after registration) ──────────────────────────────────────

export function buildWelcomeEmail(name: string, locale: Locale): EmailContent {
  const t = tFor(locale)
  const html = emailWrapper(`
    <h1 style="font-size:22px;font-weight:600;color:#171717;margin:0 0 8px;text-align:center">${t('email.welcome_title', { name: escHtml(name) })}</h1>
    <p style="font-size:14px;color:#737373;text-align:center;margin:0 0 24px;line-height:1.6">${t('email.welcome_intro')}</p>
    <div style="background:#fafafa;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="font-size:13px;color:#525252;margin:0 0 12px;font-weight:600">${t('email.welcome_next_title')}</p>
      <p style="font-size:13px;color:#737373;margin:0 0 6px">1. ${t('email.welcome_step_store')}</p>
      <p style="font-size:13px;color:#737373;margin:0 0 6px">2. ${t('email.welcome_step_google')}</p>
      <p style="font-size:13px;color:#737373;margin:0 0 6px">3. ${t('email.welcome_step_tracking')}</p>
      <p style="font-size:13px;color:#737373;margin:0">4. ${t('email.welcome_step_launch')}</p>
    </div>
    <div style="text-align:center">
      <a href="${APP_URL}/dashboard" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;font-weight:500;padding:12px 32px;border-radius:8px;text-decoration:none">${t('email.welcome_cta')}</a>
    </div>
  `, locale)
  return { subject: t('email.welcome_subject'), html }
}

// ─── Password reset email ────────────────────────────────────────────────────

export function buildResetEmail(resetUrl: string, locale: Locale): EmailContent {
  const t = tFor(locale)
  const html = emailWrapper(`
    <h1 style="font-size:22px;font-weight:600;color:#171717;margin:0 0 8px;text-align:center">${t('email.reset_title')}</h1>
    <p style="font-size:14px;color:#737373;text-align:center;margin:0 0 24px;line-height:1.6">${t('email.reset_intro')}</p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${resetUrl}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;font-weight:500;padding:12px 32px;border-radius:8px;text-decoration:none">${t('email.reset_cta')}</a>
    </div>
    <p style="font-size:12px;color:#a3a3a3;text-align:center;margin:0 0 4px">${t('email.reset_expires')}</p>
    <p style="font-size:12px;color:#a3a3a3;text-align:center;margin:0">${t('email.reset_ignore')}</p>
    <div style="margin-top:20px;padding:12px;background:#fafafa;border-radius:6px">
      <p style="font-size:11px;color:#a3a3a3;margin:0;word-break:break-all">${t('email.reset_direct_link')} ${resetUrl}</p>
    </div>
  `, locale)
  return { subject: t('email.reset_subject'), html }
}

export function buildEscalationEmail(opts: {
  agentName: string
  storeName: string
  visitorMessage: string
  intent: string
  sessionUrl?: string
  conversationHistory?: Array<{ role: string; content: string }>
  locale: Locale
}): string {
  const { agentName, storeName, visitorMessage, intent, conversationHistory = [], locale } = opts
  const t = tFor(locale)

  const intentLabel: Record<string, string> = {
    escalate: `🔴 ${t('email.escalation_intent_escalate')}`,
    problem: `⚠️ ${t('email.escalation_intent_problem')}`,
    order_tracking: `📦 ${t('email.escalation_intent_order_tracking')}`,
  }

  const historyHtml = conversationHistory.slice(-6).map(m => `
    <div style="margin:6px 0;padding:8px 12px;border-radius:8px;background:${m.role === 'user' ? '#f3f4f6' : '#eff6ff'};font-size:13px;">
      <span style="font-weight:600;color:${m.role === 'user' ? '#374151' : '#2563eb'}">${m.role === 'user' ? `👤 ${t('email.escalation_customer')}` : `🤖 ${escHtml(agentName)}`}:</span>
      <span style="color:#4b5563;margin-left:6px">${escHtml(m.content)}</span>
    </div>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:20px">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e40af,#2563eb);padding:24px;text-align:center">
      <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:0 0 4px">Hontrio Agent — ${storeName}</p>
      <h1 style="color:white;font-size:20px;margin:0;font-weight:700">${intentLabel[intent] || `🔔 ${t('email.escalation_intent_default')}`}</h1>
    </div>

    <!-- Body -->
    <div style="padding:24px">
      <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:12px 16px;margin-bottom:20px">
        <p style="margin:0;font-size:13px;color:#92400e;font-weight:600">${t('email.escalation_last_message')}</p>
        <p style="margin:8px 0 0;font-size:14px;color:#78350f">"${escHtml(visitorMessage)}"</p>
      </div>

      ${conversationHistory.length > 0 ? `
      <p style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">${t('email.escalation_recent_conversation')}</p>
      ${historyHtml}
      ` : ''}

      <div style="margin-top:20px;padding:16px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0">
        <p style="margin:0;font-size:13px;color:#166534">💡 ${t('email.escalation_respond_hint')}</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center">
      <p style="margin:0;font-size:11px;color:#9ca3af">${t('email.escalation_footer')} · <a href="https://hontrio.com" style="color:#2563eb;text-decoration:none">hontrio.com</a></p>
    </div>
  </div>
</body>
</html>`
}