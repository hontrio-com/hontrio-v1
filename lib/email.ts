import { tFor } from '@/lib/i18n/server'
import type { Locale } from '@/lib/i18n/config'

// Șabloanele primesc limba destinatarului și își iau textele din secțiunea
// `email` a dicționarului (subiect, corp, butoane, subsol).
// ⚠ În e-mailurile de cont nu intră nimic scris de vizitator (nici numele):
// înscrierea e publică, iar un text ales de altcineva ar ajunge în inboxul
// oricui, trimis de pe adresa Hontrio.

export function escHtml(str: string): string {
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
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.error('[Email] Resend error:', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return false
    }
    return true
  } catch (err) {
    console.error('[Email] sendEmail error:', (err as Error).message)
    return false
  }
}

// ─── Email wrapper template ──────────────────────────────────────────────────

export function emailWrapper(content: string, locale: Locale): string {
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

// ─── Bucățile comune ─────────────────────────────────────────────────────────

const title = (text: string) => `<h1 style="font-size:22px;font-weight:600;color:#171717;margin:0 0 8px;text-align:center">${text}</h1>`
const intro = (text: string) => `<p style="font-size:14px;color:#737373;text-align:center;margin:0 0 24px;line-height:1.6">${text}</p>`
const small = (text: string, last = false) => `<p style="font-size:12px;color:#a3a3a3;text-align:center;margin:0 0 ${last ? 0 : 4}px">${text}</p>`
const button = (href: string, label: string) => `<div style="text-align:center;margin-bottom:24px">
      <a href="${escHtml(href)}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;font-weight:500;padding:12px 32px;border-radius:8px;text-decoration:none">${label}</a>
    </div>`
const directLink = (label: string, href: string) => `<div style="margin-top:20px;padding:12px;background:#fafafa;border-radius:6px">
      <p style="font-size:11px;color:#a3a3a3;margin:0;word-break:break-all">${label} ${escHtml(href)}</p>
    </div>`

// ─── Confirmarea adresei (după înscriere) ────────────────────────────────────

export function buildVerifyEmail(verifyUrl: string, locale: Locale): EmailContent {
  const t = tFor(locale)
  const html = emailWrapper(`
    ${title(t('email.verify_title'))}
    ${intro(t('email.verify_intro'))}
    ${button(verifyUrl, t('email.verify_cta'))}
    ${small(t('email.verify_expires'))}
    ${small(t('email.verify_ignore'), true)}
    ${directLink(t('email.reset_direct_link'), verifyUrl)}
  `, locale)
  return { subject: t('email.verify_subject'), html }
}

// ─── Cineva a încercat să se înscrie cu o adresă care are deja cont ──────────

export function buildAccountExistsEmail(locale: Locale): EmailContent {
  const t = tFor(locale)
  const html = emailWrapper(`
    ${title(t('email.exists_title'))}
    ${intro(t('email.exists_intro'))}
    ${button(`${APP_URL}/login`, t('email.exists_cta'))}
    ${small(t('email.exists_forgot', { url: escHtml(`${APP_URL}/forgot-password`) }))}
    ${small(t('email.exists_ignore'), true)}
  `, locale)
  return { subject: t('email.exists_subject'), html }
}

// ─── Bun venit (după confirmarea adresei) ────────────────────────────────────

export function buildWelcomeEmail(locale: Locale): EmailContent {
  const t = tFor(locale)
  const html = emailWrapper(`
    ${title(t('email.welcome_title'))}
    ${intro(t('email.welcome_intro'))}
    <div style="background:#fafafa;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="font-size:13px;color:#525252;margin:0 0 12px;font-weight:600">${t('email.welcome_next_title')}</p>
      <p style="font-size:13px;color:#737373;margin:0 0 6px">1. ${t('email.welcome_step_store')}</p>
      <p style="font-size:13px;color:#737373;margin:0 0 6px">2. ${t('email.welcome_step_google')}</p>
      <p style="font-size:13px;color:#737373;margin:0 0 6px">3. ${t('email.welcome_step_tracking')}</p>
      <p style="font-size:13px;color:#737373;margin:0">4. ${t('email.welcome_step_launch')}</p>
    </div>
    ${button(`${APP_URL}/dashboard`, t('email.welcome_cta'))}
  `, locale)
  return { subject: t('email.welcome_subject'), html }
}

// ─── Resetarea parolei ───────────────────────────────────────────────────────

export function buildResetEmail(resetUrl: string, locale: Locale): EmailContent {
  const t = tFor(locale)
  const html = emailWrapper(`
    ${title(t('email.reset_title'))}
    ${intro(t('email.reset_intro'))}
    ${button(resetUrl, t('email.reset_cta'))}
    ${small(t('email.reset_expires'))}
    ${small(t('email.reset_ignore'), true)}
    ${directLink(t('email.reset_direct_link'), resetUrl)}
  `, locale)
  return { subject: t('email.reset_subject'), html }
}
