import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/config'
import type { TFunction } from '@/lib/i18n/translate'
import { tIn, type PilotMail } from '@/lib/ads/emails'
import { logError } from '@/lib/logger'

// =============================================
// E-mailurile facturării, în limba omului. Sunt e-mailuri de serviciu (factura,
// scadența, suspendarea), deci pleacă și dacă omul a oprit notificările pe
// e-mail. Factura merge la adresa de facturare a firmei; restul, la contul
// omului. Textele sunt funcții pure (tests/billing.test.ts); macheta și
// trimiterea sunt cele din lib/email.ts.
// =============================================

const APP_URL = (process.env.NEXTAUTH_URL || 'https://hontrio.com').replace(/\/+$/, '')
const BILLING_PAGE = `${APP_URL}/settings?tab=billing`

const toBilling = (t: TFunction) => ({ label: t('billing.email_cta_billing'), href: BILLING_PAGE })

/** Anunțul pornirii facturării, cu 30 de zile înainte (Termeni, art. 9.5). */
export function noticeMail(t: TFunction, p: { start: string }): PilotMail {
  return {
    subject: t('billing.email_notice_subject', { date: p.start }),
    title: t('billing.email_notice_title', { date: p.start }),
    paragraphs: [t('billing.email_notice_body', { date: p.start }), t('billing.email_notice_grid'), t('billing.email_notice_exit')],
    cta: toBilling(t),
  }
}

/** Factura lunii: suma, scadența, linkul public și plata cu cardul. */
export function invoiceMail(t: TFunction, p: { store: string; month: string; amount: string; due: string; number: string; viewUrl: string | null; payUrl: string | null }): PilotMail {
  return {
    subject: t('billing.email_invoice_subject', { month: p.month, store: p.store }),
    title: t('billing.email_invoice_title', { amount: p.amount }),
    paragraphs: [
      t('billing.email_invoice_body', { store: p.store, month: p.month, number: p.number, due: p.due }),
      p.payUrl ? t('billing.email_invoice_pay_card') : t('billing.email_invoice_pay_transfer'),
    ],
    cta: p.payUrl ? { label: t('billing.email_cta_pay'), href: p.payUrl } : p.viewUrl ? { label: t('billing.email_cta_invoice'), href: p.viewUrl } : toBilling(t),
  }
}

/** Factura a ajuns la scadență și nu e plătită. */
export function dueReminderMail(t: TFunction, p: { number: string; amount: string; due: string; payUrl: string | null }): PilotMail {
  return {
    subject: t('billing.email_due_subject', { number: p.number }),
    title: t('billing.email_due_subject', { number: p.number }),
    paragraphs: [t('billing.email_due_body', { number: p.number, amount: p.amount, due: p.due }), t('billing.email_due_ignore')],
    cta: p.payUrl ? { label: t('billing.email_cta_pay'), href: p.payUrl } : toBilling(t),
  }
}

/** A doua amintire, cu data la care se oprește pilotul. */
export function finalReminderMail(t: TFunction, p: { number: string; amount: string; store: string; suspendOn: string; payUrl: string | null }): PilotMail {
  return {
    subject: t('billing.email_final_subject', { number: p.number }),
    title: t('billing.email_final_subject', { number: p.number }),
    paragraphs: [t('billing.email_final_body', { number: p.number, amount: p.amount, store: p.store, date: p.suspendOn }), t('billing.email_final_campaigns')],
    cta: p.payUrl ? { label: t('billing.email_cta_pay'), href: p.payUrl } : toBilling(t),
  }
}

/** Pilotul s-a oprit pentru factura neplătită: campaniile rulează fără oprirea de siguranță. */
export function suspendedMail(t: TFunction, p: { number: string; store: string; payUrl: string | null }): PilotMail {
  return {
    subject: t('billing.email_suspended_subject', { store: p.store }),
    title: t('billing.email_suspended_subject', { store: p.store }),
    paragraphs: [t('billing.email_suspended_body', { number: p.number, store: p.store }), t('billing.email_suspended_campaigns')],
    cta: p.payUrl ? { label: t('billing.email_cta_pay'), href: p.payUrl } : toBilling(t),
  }
}

/** Plata a sosit (și, dacă era oprit, pilotul a pornit din nou). */
export function paidMail(t: TFunction, p: { number: string; resumed: boolean }): PilotMail {
  return {
    subject: t('billing.email_paid_subject', { number: p.number }),
    title: t('billing.email_paid_subject', { number: p.number }),
    paragraphs: [t('billing.email_paid_body', { number: p.number }), ...(p.resumed ? [t('billing.email_paid_resumed')] : [])],
    cta: toBilling(t),
  }
}

/** Lipsesc datele firmei: factura nu se poate emite până nu le completează. */
export function profileMissingMail(t: TFunction, p: { store: string; month: string; amount: string }): PilotMail {
  return {
    subject: t('billing.email_profile_subject'),
    title: t('billing.email_profile_subject'),
    paragraphs: [t('billing.email_profile_body', { store: p.store, month: p.month, amount: p.amount })],
    cta: toBilling(t),
  }
}

/** Corpul e-mailului în macheta Hontrio. Subsolul spune de ce vine și cu notificările oprite. */
export function billingBody(m: PilotMail, esc: (s: string) => string, t: TFunction): string {
  return `
    <h1 style="font-size:20px;font-weight:600;color:#171717;margin:0 0 16px;line-height:1.3">${esc(m.title)}</h1>
    ${m.paragraphs.map(p => `<p style="font-size:14px;color:#525252;margin:0 0 12px;line-height:1.6">${esc(p)}</p>`).join('')}
    <div style="text-align:center;margin:24px 0 8px">
      <a href="${esc(m.cta.href)}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;font-weight:500;padding:12px 28px;border-radius:8px;text-decoration:none">${esc(m.cta.label)}</a>
    </div>
    <p style="font-size:11px;color:#a3a3a3;text-align:center;margin:20px 0 0;line-height:1.5">${esc(t('billing.email_footer'))}</p>
  `
}

/** Limba și adresa contului; factura poate merge la altă adresă (`to`). */
export async function accountOf(userId: string): Promise<{ email: string; locale: Locale } | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('users').select('email, ui_locale').eq('id', userId).maybeSingle()
  if (!data?.email) return null
  return { email: String(data.email), locale: isLocale(data.ui_locale) ? data.ui_locale : DEFAULT_LOCALE }
}

/** Trimite un e-mail al facturării. O eroare nu oprește facturarea: se scrie în jurnal. */
export async function sendBillingEmail(userId: string, build: (t: TFunction, locale: Locale) => PilotMail, to?: string | null): Promise<boolean> {
  try {
    const account = await accountOf(userId)
    if (!account) return false
    const t = tIn(account.locale)
    const mail = build(t, account.locale)
    const { sendEmail, emailWrapper, escHtml } = await import('@/lib/email')
    return await sendEmail({ to: to || account.email, subject: mail.subject, html: emailWrapper(billingBody(mail, escHtml, t), account.locale) })
  } catch (err) {
    logError('billing-email', 'E-mailul facturării nu s-a trimis', { userId, error: err instanceof Error ? err.message : String(err) })
    return false
  }
}
