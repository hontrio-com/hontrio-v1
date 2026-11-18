import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'
import { safeEqual } from '@/lib/ads/schedule'
import { billingConfig, checkPayments, closeMonth } from '@/lib/billing/run'
import { billingActive, todayRo } from '@/lib/billing/schedule'

// =============================================
// Cron (zilnic, dimineața): facturarea Hontrio (Termeni, art. 9 și 13).
//   1. din ziua 15: situațiile lunii trecute și facturile lor în SmartBill;
//   2. în fiecare zi: plățile din SmartBill, amintirile și suspendarea pilotului.
// Cât timp facturarea nu a pornit (perioada de lansare), nu face nimic.
// =============================================

export const maxDuration = 300

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || !safeEqual(request.headers.get('authorization') ?? '', `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) // i18n-ignore (răspuns pentru Vercel)
  }
  const deadline = Date.now() + 270_000
  const supabase = createAdminClient()
  const today = todayRo()
  try {
    const cfg = await billingConfig(supabase)
    // Facturile emise trebuie urmărite și după o oprire a facturării
    const close = billingActive(cfg.start_date, today) ? await closeMonth(supabase, today, deadline - 90_000) : null
    const payments = await checkPayments(supabase, today, deadline)
    return NextResponse.json({ today, close, payments })
  } catch (err) {
    logError('/api/cron/billing', 'Facturarea nu a rulat', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'billing' }, { status: 500 })
  }
}
