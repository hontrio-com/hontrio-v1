'use client'

import Link from 'next/link'
import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { CalendarClock, Minus, Plus } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { feeShare, monthlyFee, pricingTier, PRICING, type PricingCurrency } from '@/lib/pricing'
import { Reveal } from './fx'
import { TITLE, TITLE_SIZE, TwoTone } from './section'

// =============================================
// Pagina de prețuri: mesajul (2% din vânzările aduse de Hontrio) cu treptele
// de sub el, calculatorul (cursor și sumă, în lei sau în euro), exemplele, ce
// se numără, ce nu plătești, întrebările și perioada de lansare. Toate cifrele
// vin din lib/pricing.ts, aceeași grilă pe care o va folosi facturarea.
// =============================================

const CURRENCIES = ['RON', 'EUR'] as const
const START: Record<PricingCurrency, number> = { RON: 25000, EUR: 5000 }
const SLIDER_STEPS = 1000
const SLIDER_MAX: Record<PricingCurrency, number> = { RON: 500000, EUR: 100000 }
const EXAMPLES: Record<PricingCurrency, number[]> = {
  RON: [5000, 8000, 10000, 25000, 50000, 75000, 100000, 200000, 500000],
  EUR: [1000, 1500, 2000, 5000, 10000, 50000],
}
const RULES = [1, 2, 3, 4, 5, 6, 7, 8] as const
const NOT_PAID = [1, 2, 3, 4, 5] as const
const QUESTIONS = [1, 2, 3, 4, 5, 6] as const

/** Cursorul urmează o curbă: prima lui parte acoperă sumele mici, unde se schimbă treapta. */
function salesAt(position: number, currency: PricingCurrency): number {
  const raw = SLIDER_MAX[currency] * (position / SLIDER_STEPS) ** 2
  const unit = currency === 'RON' ? (raw < 10000 ? 100 : raw < 100000 ? 500 : 1000) : (raw < 2000 ? 20 : raw < 20000 ? 100 : 500)
  return Math.round(raw / unit) * unit
}

function positionOf(sales: number, currency: PricingCurrency): number {
  return Math.min(SLIDER_STEPS, Math.round(Math.sqrt(Math.max(0, sales) / SLIDER_MAX[currency]) * SLIDER_STEPS))
}

/** Sumele, în limba paginii: „25.000 lei” sau „RON 25,000”, „5.000 €” sau „€5,000”. */
function useMoney() {
  const { t, intlLocale } = useT()
  const number = (value: number) => new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
  const money = (value: number, currency: PricingCurrency) =>
    t(currency === 'RON' ? 'site.pricing_money_ron' : 'site.pricing_money_eur', { value: number(value) })
  return { number, money }
}

/** Titlul unei secțiuni, în două tonuri, ca pe pagina principală. */
function Heading({ a, b, desc, as: Tag = 'h2', className }: { a: ReactNode; b: ReactNode; desc?: ReactNode; as?: 'h1' | 'h2'; className?: string }) {
  return (
    <div className={className}>
      <Tag className={cn('text-balance', TITLE, Tag === 'h1' ? 'text-[2.55rem] sm:text-6xl lg:text-[4.2rem]' : TITLE_SIZE)}>
        <TwoTone a={a} b={b} lineBreak={Tag === 'h1' ? 'sm' : false} />
      </Tag>
      {desc && <p className="mt-5 max-w-2xl text-pretty text-[16px] leading-relaxed text-neutral-500 sm:text-[17px]">{desc}</p>}
    </div>
  )
}

function CurrencySwitch({ value, onChange }: { value: PricingCurrency; onChange: (currency: PricingCurrency) => void }) {
  const { t } = useT()
  return (
    <div role="radiogroup" aria-label={t('site.pricing_currency_label')} className="inline-flex shrink-0 rounded-full border border-line bg-white p-1 text-[13px] font-semibold">
      {CURRENCIES.map(c => (
        <button key={c} type="button" role="radio" aria-checked={value === c} onClick={() => onChange(c)}
          className={cn('rounded-full px-3.5 py-1.5 transition-colors', value === c ? 'bg-[#0a0a0a] text-white' : 'text-neutral-500 hover:text-neutral-950')}>
          {t(c === 'RON' ? 'site.pricing_currency_ron' : 'site.pricing_currency_eur')}
        </button>
      ))}
    </div>
  )
}

// ─── Mesajul și treptele ─────────────────────────────────────────────────────

function Intro({ currency, onCurrency }: { currency: PricingCurrency; onCurrency: (c: PricingCurrency) => void }) {
  const { t } = useT()
  const { number, money } = useMoney()
  const g = PRICING[currency]
  const steps = [
    { range: t('site.pricing_step_free_range', { to: money(g.freeUpTo, currency) }), price: t('site.pricing_free') },
    { range: t('site.pricing_step_flat_range', { from: money(g.freeUpTo, currency), to: money(g.flatUpTo, currency) }), price: t('site.pricing_step_flat_price', { fee: money(g.flatFee, currency) }) },
    { range: t('site.pricing_step_percent_range', { from: money(g.flatUpTo, currency) }), price: t('site.pricing_step_percent_price', { percent: number(g.percent) }) },
  ]
  return (
    <section className="px-5 pb-20 pt-12 md:pb-24 md:pt-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <Heading as="h1" a={t('site.pricing_title_a')} b={t('site.pricing_title_b')} desc={t('site.pricing_desc')} />
        </Reveal>

        <Reveal delay={0.08} className="mt-10 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{t('site.pricing_steps_title')}</h2>
            <CurrencySwitch value={currency} onChange={onCurrency} />
          </div>
          <dl className="mt-4 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
            {steps.map(s => (
              <div key={s.range} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
                <dt className="text-[15px] text-neutral-600">{s.range}</dt>
                <dd className="text-[17px] font-semibold tracking-tight text-neutral-950">{s.price}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[13.5px] leading-relaxed text-neutral-500">{t('site.pricing_steps_note')} {t('site.pricing_vat')}</p>
          <p className="mt-2 text-[13.5px] font-medium text-neutral-900">{t('site.pricing_launch_short')}</p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Calculatorul ────────────────────────────────────────────────────────────

function Calculator({ currency, onCurrency, text, onText }: {
  currency: PricingCurrency; onCurrency: (c: PricingCurrency) => void; text: string; onText: (text: string) => void
}) {
  const { t } = useT()
  const { number, money } = useMoney()
  const id = useId()
  const g = PRICING[currency]
  const sales = Number(text) || 0
  const fee = monthlyFee(sales, currency)
  const tier = pricingTier(sales, currency)
  const position = positionOf(sales, currency)
  const explain = tier === 'free' ? t('site.pricing_calc_free', { limit: money(g.freeUpTo, currency) })
    : tier === 'flat' ? t('site.pricing_calc_flat', { limit: money(g.flatUpTo, currency) })
    : t('site.pricing_calc_percent', { percent: number(g.percent), sales: money(sales, currency) })

  return (
    <section id="calculator" className="scroll-mt-24 border-t border-line px-5 py-24 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="lg:pt-2">
          <Heading a={t('site.pricing_calc_title_a')} b={t('site.pricing_calc_title_b')} desc={t('site.pricing_calc_desc')} />
        </Reveal>

        <Reveal delay={0.08} className="rounded-[1.75rem] border border-line bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_40px_80px_-60px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor={id} className="text-[14px] font-semibold text-neutral-900">{t('site.pricing_calc_sales')}</label>
            <CurrencySwitch value={currency} onChange={onCurrency} />
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 transition-colors focus-within:border-neutral-900">
            <input id={id} type="text" inputMode="numeric" autoComplete="off" value={text}
              onChange={e => onText(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9))}
              className="h-14 w-full min-w-0 bg-transparent text-[1.6rem] font-semibold tabular-nums tracking-tight text-neutral-950 outline-none" />
            <span className="shrink-0 text-[15px] font-medium text-neutral-500">{t(currency === 'RON' ? 'site.pricing_currency_ron' : 'site.pricing_currency_eur')}</span>
          </div>
          <input type="range" min={0} max={SLIDER_STEPS} step={1} value={position}
            onChange={e => onText(String(salesAt(Number(e.target.value), currency)))}
            aria-label={t('site.pricing_calc_sales')} aria-valuetext={money(sales, currency)}
            className="range-mono mt-6 w-full" style={{ '--pct': `${(position / SLIDER_STEPS) * 100}%` } as CSSProperties} />
          <div className="mt-2 flex justify-between gap-4 text-[12px] tabular-nums text-neutral-400">
            <span>{money(0, currency)}</span>
            <span>{t('site.pricing_calc_max', { value: money(SLIDER_MAX[currency], currency) })}</span>
          </div>

          <div className="mt-8 border-t border-line pt-6" aria-live="polite">
            <p className="text-[13px] font-medium text-neutral-500">{t('site.pricing_calc_fee')}</p>
            <p className="mt-2 text-[2.6rem] font-bold leading-none tracking-[-0.04em] tabular-nums text-neutral-950">
              {fee === 0 ? t('site.pricing_free') : money(fee, currency)}
            </p>
            <p className="mt-4 text-[14.5px] text-neutral-700">{explain}</p>
            {/* Taxa fixă e singura treaptă unde procentul real diferă de grilă */}
            {tier === 'flat' && <p className="mt-1 text-[14px] text-neutral-500">{t('site.pricing_share', { value: number(feeShare(sales, currency)) })}</p>}
            {fee > 0 && <p className="mt-4 text-[13px] leading-relaxed text-neutral-500">{t('site.pricing_calc_launch')}</p>}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Exemplele ───────────────────────────────────────────────────────────────

function Examples({ currency }: { currency: PricingCurrency }) {
  const { t } = useT()
  const { number, money } = useMoney()
  return (
    <section className="px-5 pb-24 md:pb-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <Heading a={t('site.pricing_examples_title_a')} b={t('site.pricing_examples_title_b')} desc={t('site.pricing_examples_desc')} />
        </Reveal>
        <Reveal delay={0.08}>
          <table className="w-full text-left text-[14.5px]">
            <thead>
              <tr className="border-b border-neutral-900 text-[12.5px] text-neutral-500">
                <th scope="col" className="py-3 pr-3 font-medium">{t('site.pricing_calc_sales')}</th>
                <th scope="col" className="py-3 pr-3 text-right font-medium">{t('site.pricing_calc_fee')}</th>
                <th scope="col" className="py-3 text-right font-medium">{t('site.pricing_examples_share')}</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLES[currency].map(sales => {
                const fee = monthlyFee(sales, currency)
                return (
                  <tr key={sales} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap py-3.5 pr-3 tabular-nums text-neutral-700">{money(sales, currency)}</td>
                    <td className="whitespace-nowrap py-3.5 pr-3 text-right font-semibold tabular-nums text-neutral-950">{fee === 0 ? t('site.pricing_free') : money(fee, currency)}</td>
                    <td className="py-3.5 text-right tabular-nums text-neutral-500">{`${number(feeShare(sales, currency))}%`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Ce se numără, ce nu plătești ────────────────────────────────────────────

function Rules() {
  const { t, locale } = useT()
  return (
    <section id="rules" className="scroll-mt-24 border-t border-line px-5 py-24 md:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <Heading a={t('site.pricing_rules_title_a')} b={t('site.pricing_rules_title_b')} desc={
            <>{t('site.pricing_rules_desc')}{' '}
              <Link href={locale === 'ro' ? '/legal/terms#tarife' : '/legal/terms#fees'} className="font-semibold text-neutral-950 underline decoration-neutral-300 underline-offset-[3px] hover:decoration-neutral-950">
                {t('site.pricing_terms_link')}
              </Link>
            </>
          } />
        </Reveal>
        <ol className="mt-14 grid grid-cols-1 gap-x-10 gap-y-9 md:grid-cols-2">
          {RULES.map((n, i) => (
            <Reveal as="li" key={n} delay={0.03 * i} y={12} className="flex gap-4 border-t border-line pt-5">
              <span className="w-6 shrink-0 font-mono text-[13px] text-neutral-400">{String(n).padStart(2, '0')}</span>
              <div>
                <h3 className="text-[16.5px] font-semibold tracking-tight text-neutral-950">{t(`site.pricing_rule${n}_title`)}</h3>
                <p className="mt-1.5 text-pretty text-[15px] leading-relaxed text-neutral-500">{t(`site.pricing_rule${n}_text`)}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

function NotPaid() {
  const { t } = useT()
  return (
    <section className="px-5 pb-24 md:pb-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="rounded-[1.75rem] border border-line bg-neutral-50 p-6 sm:p-10">
          <h2 className="text-[1.6rem] font-bold tracking-[-0.03em] text-neutral-950 sm:text-[2rem]">{t('site.pricing_notpay_title')}</h2>
          <ul className="mt-6 grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
            {NOT_PAID.map(n => (
              <li key={n} className="flex gap-3 text-[15.5px] leading-relaxed text-neutral-700">
                <span aria-hidden className="mt-1 grid size-5 shrink-0 place-items-center rounded-full border border-neutral-300 bg-white"><Minus className="size-3 text-neutral-600" /></span>
                <span>{t(`site.pricing_notpay_${n}`)}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Întrebările și perioada de lansare ──────────────────────────────────────

function PricingFaq() {
  const { t } = useT()
  return (
    <section id="faq" className="scroll-mt-24 border-t border-line px-5 py-24 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <Heading a={t('site.pricing_faq_title_a')} b={t('site.pricing_faq_title_b')} />
        </Reveal>
        <div className="space-y-3">
          {QUESTIONS.map((n, i) => (
            <Reveal key={n} delay={i * 0.04} y={14}>
              <details open={n === 1} className="group overflow-hidden rounded-3xl border border-line bg-white/70 transition-colors open:border-black open:bg-white open:shadow-[0_24px_60px_-35px_rgba(0,0,0,0.45)] hover:border-neutral-300">
                <summary className="flex cursor-pointer list-none items-center gap-4 p-5 md:p-6 [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-xs text-neutral-400 group-open:text-black">{String(n).padStart(2, '0')}</span>
                  <h3 className="flex-1 text-[16px] font-semibold tracking-tight text-neutral-950 md:text-[17px]">{t(`site.pricing_faq_q${n}`)}</h3>
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-950 transition group-open:rotate-45 group-open:bg-[#0a0a0a] group-open:text-white">
                    <Plus className="size-4" />
                  </span>
                </summary>
                <p className="px-5 pb-6 pl-[3.25rem] text-[15px] leading-relaxed text-neutral-500 md:px-6 md:pl-[3.6rem]">{t(`site.pricing_faq_a${n}`)}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function LaunchNote() {
  const { t } = useT()
  return (
    <section className="px-5 pb-24 md:pb-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="flex flex-col gap-5 rounded-[1.75rem] border border-neutral-900 bg-white p-6 sm:flex-row sm:items-start sm:p-10">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#0a0a0a] text-white"><CalendarClock className="size-5" /></span>
          <div>
            <h2 className="text-[1.4rem] font-bold tracking-[-0.03em] text-neutral-950">{t('site.pricing_launch_title')}</h2>
            <p className="mt-2 max-w-3xl text-pretty text-[15.5px] leading-relaxed text-neutral-600">{t('site.pricing_launch_text')}</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/** Toată pagina; moneda (lei pentru română, euro pentru engleză) și suma sunt comune secțiunilor. */
export function Pricing() {
  const { locale } = useT()
  const initial: PricingCurrency = locale === 'ro' ? 'RON' : 'EUR'
  const [currency, setCurrency] = useState<PricingCurrency>(initial)
  const [text, setText] = useState(String(START[initial]))

  // Altă monedă, altă scară: suma pornește de la exemplul ei
  function changeCurrency(next: PricingCurrency) {
    if (next === currency) return
    setCurrency(next)
    setText(String(START[next]))
  }

  return (
    <>
      <Intro currency={currency} onCurrency={changeCurrency} />
      <Calculator currency={currency} onCurrency={changeCurrency} text={text} onText={setText} />
      <Examples currency={currency} />
      <Rules />
      <NotPaid />
      <PricingFaq />
      <LaunchNote />
    </>
  )
}
