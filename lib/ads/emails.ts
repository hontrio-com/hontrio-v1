import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_LOCALE, INTL_LOCALE, SOURCE_LOCALE, isLocale, type Locale } from '@/lib/i18n/config'
import { MESSAGES } from '@/lib/i18n/dictionaries'
import { createT, type TFunction } from '@/lib/i18n/translate'
import { logError } from '@/lib/logger'

// =============================================
// E-mailurile pilotului, în limba omului (users.ui_locale), doar dacă n-a
// oprit notificările pe e-mail (users.preferences.emailNotifications,
// implicit pornite):
//   - oprirea de siguranță a pus o campanie pe pauză;
//   - oprirea n-a reușit, pilotul n-a putut citi contul sau Hontrio a pierdut
//     accesul la Google (campaniile rulează fără protecție);
//   - propuneri noi care așteaptă aprobarea (cel mult unul pe zi pe magazin).
//
// Textele se construiesc aici (funcții pure, verificate în teste); machetele
// și trimiterea sunt cele din lib/email.ts, încărcat doar la trimitere (aduce
// traducerea serverului, care nu se poate importa în afara lui Next).
// =============================================

const APP_URL = (process.env.NEXTAUTH_URL || 'https://hontrio.com').replace(/\/+$/, '')

/** Ce spune un e-mail al pilotului, ca text simplu (macheta îl transformă în HTML). */
export type PilotMail = {
  subject: string
  title: string
  paragraphs: string[]
  cta: { label: string; href: string }
}

/** Traducerea într-o limbă știută, fără cererea curentă (cronul n-are una). */
export function tIn(locale: Locale): TFunction {
  return createT(locale, MESSAGES[locale], locale === SOURCE_LOCALE ? undefined : MESSAGES[SOURCE_LOCALE])
}

/** Suma în moneda contului, scrisă în limba omului. */
export function moneyIn(locale: Locale, currency: string): (n: number) => string {
  try {
    const f = new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency, maximumFractionDigits: 2 })
    return n => f.format(n)
  } catch {
    return n => `${n.toFixed(2)} ${currency}`
  }
}

const toCampaigns = (t: TFunction) => ({ label: t('notifications.email_cta_campaigns'), href: `${APP_URL}/campaigns?tab=pilot` })

/** (a) Oprirea de siguranță a pus campania pe pauză. */
export function lossLimitMail(t: TFunction, p: { store: string; campaign: string; spend: string }): PilotMail {
  return {
    subject: t('notifications.email_loss_limit_subject', { name: p.campaign }),
    title: t('notifications.email_loss_limit_subject', { name: p.campaign }),
    paragraphs: [
      t('notifications.email_loss_limit_body', { name: p.campaign, store: p.store, spend: p.spend }),
      t('notifications.email_loss_limit_next'),
    ],
    cta: toCampaigns(t),
  }
}

/** (b) Oprirea de siguranță n-a reușit: campania rulează mai departe. */
export function protectionFailedMail(t: TFunction, p: { store: string; campaign: string }): PilotMail {
  return {
    subject: t('notifications.email_protection_failed_subject', { name: p.campaign }),
    title: t('notifications.email_protection_failed_subject', { name: p.campaign }),
    paragraphs: [
      t('notifications.email_protection_failed_body', { name: p.campaign, store: p.store }),
      t('notifications.email_protection_failed_next'),
    ],
    cta: { label: t('notifications.email_cta_google_ads'), href: 'https://ads.google.com/' },
  }
}

/** (b) Hontrio a pierdut accesul la Google: pilotul nu mai poate opri nimic. */
export function accessLostMail(t: TFunction): PilotMail {
  return {
    subject: t('notifications.email_access_lost_subject'),
    title: t('notifications.email_access_lost_subject'),
    paragraphs: [t('notifications.email_access_lost_body'), t('notifications.email_access_lost_next')],
    cta: { label: t('notifications.email_cta_settings'), href: `${APP_URL}/settings?tab=integrations` },
  }
}

/** (b) Pilotul n-a putut citi contul Google Ads: oprirea de siguranță n-a rulat. */
export function pilotBlockedMail(t: TFunction, p: { store: string }): PilotMail {
  return {
    subject: t('notifications.email_pilot_blocked_subject', { store: p.store }),
    title: t('notifications.email_pilot_blocked_subject', { store: p.store }),
    paragraphs: [t('notifications.email_pilot_blocked_body', { store: p.store }), t('notifications.email_pilot_blocked_next')],
    cta: toCampaigns(t),
  }
}

/** (c) Propuneri noi care așteaptă aprobarea omului. */
export function proposalsMail(t: TFunction, p: { store: string; count: number }): PilotMail {
  return {
    subject: t('notifications.email_proposals_subject', { store: p.store }),
    title: t('notifications.email_proposals_subject', { store: p.store }),
    paragraphs: [t('notifications.email_proposals_body', { count: p.count, store: p.store }), t('notifications.email_proposals_next')],
    cta: toCampaigns(t),
  }
}

/** Corpul e-mailului, în interiorul machetei Hontrio; `esc` scapă textele (numele magazinului, al campaniei). */
export function mailBody(m: PilotMail, esc: (s: string) => string, t: TFunction): string {
  return `
    <h1 style="font-size:20px;font-weight:600;color:#171717;margin:0 0 16px;line-height:1.3">${esc(m.title)}</h1>
    ${m.paragraphs.map(p => `<p style="font-size:14px;color:#525252;margin:0 0 12px;line-height:1.6">${esc(p)}</p>`).join('')}
    <div style="text-align:center;margin:24px 0 8px">
      <a href="${esc(m.cta.href)}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;font-weight:500;padding:12px 28px;border-radius:8px;text-decoration:none">${esc(m.cta.label)}</a>
    </div>
    <p style="font-size:11px;color:#a3a3a3;text-align:center;margin:20px 0 0;line-height:1.5">${esc(t('notifications.email_footer_prefs'))}</p>
  `
}

type Recipient = { email: string; locale: Locale }

/** Cui scriem: adresa și limba omului, dacă n-a oprit notificările pe e-mail (implicit pornite). */
async function recipient(userId: string): Promise<Recipient | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('users').select('email, ui_locale, preferences').eq('id', userId).maybeSingle()
  if (!data?.email) return null
  const prefs = (data.preferences ?? {}) as { emailNotifications?: unknown }
  if (prefs.emailNotifications === false) return null
  return { email: String(data.email), locale: isLocale(data.ui_locale) ? data.ui_locale : DEFAULT_LOCALE }
}

/** Trimite un e-mail al pilotului. Nu oprește niciodată pilotul: o eroare se scrie în jurnal. */
export async function sendPilotEmail(userId: string, build: (t: TFunction, locale: Locale) => PilotMail): Promise<boolean> {
  try {
    const to = await recipient(userId)
    if (!to) return false
    const t = tIn(to.locale)
    const mail = build(t, to.locale)
    // lib/email.ts aduce traducerea serverului (server-only): se încarcă doar aici, la trimitere
    const { sendEmail, emailWrapper, escHtml } = await import('@/lib/email')
    return await sendEmail({ to: to.email, subject: mail.subject, html: emailWrapper(mailBody(mail, escHtml, t), to.locale) })
  } catch (err) {
    logError('pilot-email', 'E-mailul pilotului nu s-a trimis', { userId, error: err instanceof Error ? err.message : String(err) })
    return false
  }
}
