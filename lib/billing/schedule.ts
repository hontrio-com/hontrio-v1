import { utcToLocal } from '@/lib/commerce/time'
import { lastDay, previousPeriod } from '@/lib/billing/statement'

// =============================================
// Calendarul facturării, în ora României (VOID SFT GAMES SRL e în România):
//   - luna se închide în ultima ei zi; factura se emite pe 15 ale lunii
//     următoare (Termeni, art. 9.3), cu termen de plată de 10 zile;
//   - neplata: amintire la scadență, a doua după 7 zile (cu anunțul
//     suspendării), iar la 14 zile după scadență pilotul se oprește până la
//     plată (art. 13; campaniile rămân în Google Ads);
//   - pornirea facturării: cel puțin 30 de zile după anunț (art. 9.5).
// Funcții pure, verificate în tests/billing.test.ts.
// =============================================

export const BILLING_TZ = 'Europe/Bucharest'
export const ISSUE_DAY = 15
export const DUE_DAYS = 10
export const FINAL_REMINDER_AFTER = 7
export const SUSPEND_AFTER = 14
export const NOTICE_DAYS = 30

/** Ziua de azi în România, „AAAA-LL-ZZ”. */
export function todayRo(now: number = Date.now()): string {
  return utcToLocal(new Date(now).toISOString(), BILLING_TZ).slice(0, 10)
}

/** O zi plus n zile, „AAAA-LL-ZZ”. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Zilele dintre două zile „AAAA-LL-ZZ” (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** Cea mai devreme zi de pornire, dacă anunțul pleacă azi. */
export const earliestStart = (today: string) => addDays(today, NOTICE_DAYS)

/** Facturarea e pornită azi: data de start a venit. */
export function billingActive(startDate: string | null, today: string): boolean {
  return !!startDate && today >= startDate
}

/**
 * Luna de închis azi: cea trecută, din ziua 15 încolo, dacă se termină după pornirea
 * facturării (o lună încheiată înainte de start nu se numără). null = nimic de închis.
 */
export function periodToClose(today: string, startDate: string | null): string | null {
  if (!startDate || Number(today.slice(8, 10)) < ISSUE_DAY) return null
  const period = previousPeriod(today)
  return lastDay(period) >= startDate ? period : null
}

/** Ziua de pornire a socotelii într-o lună: data de start, dacă e în lună, altfel prima zi. */
export function countFrom(period: string, startDate: string): string {
  const first = `${period}-01`
  return startDate > first ? startDate : first
}

export type DunningStep = 'none' | 'remind_due' | 'remind_final' | 'suspend'

/** Pasul de urmat azi pentru o factură neplătită. */
export function dunningStep(s: { due_date: string; reminders: number; suspended: boolean }, today: string): DunningStep {
  const late = daysBetween(s.due_date, today)
  if (late < 0) return 'none'
  if (late >= SUSPEND_AFTER && !s.suspended) return 'suspend'
  if (late >= FINAL_REMINDER_AFTER && s.reminders < 2) return 'remind_final'
  if (s.reminders < 1) return 'remind_due'
  return 'none'
}
