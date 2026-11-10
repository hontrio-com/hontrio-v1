'use client'

import { useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { Check, Clock, Hourglass, Layers, Lightbulb, PackageX, Rocket, SearchX, ShieldAlert, Sparkles, Tag, TrendingUp, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { NumberTicker } from '@/components/app/motion'
import { cn } from '@/lib/utils'
import { Reveal } from './fx'
import { SectionHeader } from './section'

// =============================================
// Funcțiile, ca o grilă de carduri (Magic UI · Bento Grid), fiecare cu o mică
// interfață vie din aplicație. Lumina de sub cursor e Magic UI · Magic Card.
// Cifrele din carduri sunt exemple coerente între ele.
// =============================================

function Card({ title, desc, children, className, delay = 0 }: { title: string; desc: string; children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <Reveal delay={delay} className={cn('h-full', className)}>
      <div ref={ref}
        onMouseMove={e => {
          const r = ref.current?.getBoundingClientRect()
          if (!r || !ref.current) return
          ref.current.style.setProperty('--x', `${e.clientX - r.left}px`)
          ref.current.style.setProperty('--y', `${e.clientY - r.top}px`)
        }}
        className="group relative flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_30px_60px_-36px_rgba(0,0,0,0.4)] sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(420px_circle_at_var(--x,50%)_var(--y,0%),rgba(10,10,10,0.05),transparent_45%)]" />
        <div className="relative flex-1">{children}</div>
        <div className="relative mt-5">
          <h3 className="text-[17px] font-semibold tracking-tight text-neutral-950">{title}</h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-500">{desc}</p>
        </div>
      </div>
    </Reveal>
  )
}

/** Produsele unei campanii: ce intră și de ce a ieșit un produs (cheltuiala și ROAS-ul pe 30 de zile). */
const PRODUCTS = [
  { key: 'site.feat_product_1', spend: 120, roas: 7.5, status: 'in' },
  { key: 'site.feat_product_2', spend: 95, roas: 3.4, status: 'in' },
  { key: 'site.feat_product_3', spend: null, roas: null, status: 'out' },
  { key: 'site.feat_product_4', spend: 80, roas: 0, status: 'no_sales' },
  { key: 'site.feat_product_5', spend: 140, roas: 0.9, status: 'loses' },
] as const

function CampaignProducts() {
  const { t, intlLocale } = useT()
  const one = (n: number) => new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)
  const money = (n: number) => new Intl.NumberFormat(intlLocale, { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(n)
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-neutral-50/70">
      <div className="grid grid-cols-[minmax(0,1fr)_64px_44px_auto] gap-3 border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400 sm:grid-cols-[minmax(0,1fr)_76px_52px_150px]">
        <span>{t('site.feat_col_product')}</span><span className="text-right">{t('site.feat_col_spend')}</span>
        <span className="text-right">ROAS</span>{/* i18n-ignore: termen Google Ads */}
        <span className="hidden sm:block" />
      </div>
      {PRODUCTS.map((p, i) => (
        <motion.div key={p.key} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.07 }}
          className="grid grid-cols-[minmax(0,1fr)_64px_44px_auto] items-center gap-3 border-b border-line/70 px-4 py-2.5 text-[13px] last:border-0 sm:grid-cols-[minmax(0,1fr)_76px_52px_150px]">
          <span className={cn('truncate font-medium', p.status === 'in' ? 'text-neutral-900' : 'text-neutral-400')}>{t(p.key)}</span>
          <span className="text-right tabular-nums text-neutral-600">{p.spend === null ? '—' : money(p.spend)}</span>
          <span className={cn('text-right font-semibold tabular-nums', p.roas !== null && p.roas < 1 ? 'text-red-600' : 'text-neutral-900')}>{p.roas === null ? '—' : one(p.roas)}</span>
          <span className={cn('col-span-3 justify-self-start rounded-full px-2 py-0.5 text-[11px] font-semibold sm:col-span-1 sm:justify-self-end',
            p.status === 'in' ? 'bg-black text-white' : p.status === 'out' ? 'bg-neutral-200/70 text-neutral-500' : 'bg-amber-50 text-amber-700')}>
            {t(`site.feat_status_${p.status}`)}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

function PilotModes() {
  const { t } = useT()
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<'approve' | 'auto'>('approve')
  // Oprirea de siguranță se aplică în ambele moduri; bugetul așteaptă mereu aprobarea omului
  const log = [
    { icon: ShieldAlert, key: 'site.feat_log_pause', applied: true },
    { icon: SearchX, key: 'site.feat_log_negatives', applied: mode === 'auto' },
    { icon: PackageX, key: 'site.feat_log_products', applied: mode === 'auto' },
    { icon: Rocket, key: 'site.feat_log_graduate', applied: mode === 'auto' },
    { icon: TrendingUp, key: 'site.feat_log_budget', applied: false },
  ]
  return (
    <div className="flex h-full flex-col">
      <div className="flex rounded-full bg-neutral-100 p-1 text-[13px] font-medium">
        {(['approve', 'auto'] as const).map(m => (
          <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
            className={cn('relative flex-1 rounded-full px-3 py-1.5 transition-colors', mode === m ? 'text-black' : 'text-neutral-500 hover:text-black')}>
            {mode === m && <motion.span layoutId="site-pilot-mode" className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
            <span className="relative">{t(`site.feat_mode_${m}`)}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={mode} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
          className="mt-3 min-h-[60px] text-[13px] leading-relaxed text-neutral-500">
          {t(`site.feat_mode_${mode}_desc`)}
        </motion.p>
      </AnimatePresence>
      <ul className="mt-2 space-y-2">
        {log.map(item => (
          <li key={item.key} className="flex items-center gap-3 rounded-xl border border-line bg-neutral-50/70 px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-neutral-700 ring-1 ring-line"><item.icon className="size-4" /></span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-neutral-800">{t(item.key)}</span>
            <motion.span layout className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              item.applied ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
              {item.applied ? <Check className="size-3" strokeWidth={3} /> : <Hourglass className="size-3" />}
              {item.applied ? t('site.preview_applied') : t('site.feat_log_waiting')}
            </motion.span>
          </li>
        ))}
      </ul>
      {/* Pilotul rulează din oră în oră: bara arată cum trece ora până la verificarea următoare */}
      <div className="mt-auto pt-5">
        <div className="flex items-center gap-2 text-[12px] font-medium text-neutral-500">
          <Clock className="size-3.5" />{t('site.feat_hourly')}
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
          <motion.span className="block h-full rounded-full bg-black" initial={{ width: '8%' }}
            animate={reduce ? { width: '60%' } : { width: ['8%', '100%'] }} transition={reduce ? { duration: 0 } : { duration: 8, ease: 'linear', repeat: Infinity }} />
        </div>
      </div>
    </div>
  )
}

const GROUP_TYPES = ['category', 'brand', 'price', 'sale', 'picked'] as const
const GROUP_ROWS = [
  { key: 'site.feat_group_row_1', budget: 60, roas: 4.6 },
  { key: 'site.feat_group_row_2', budget: 40, roas: 3.9 },
  { key: 'site.feat_group_row_3', budget: 25, roas: 5.8 },
] as const

function Groups() {
  const { t, intlLocale } = useT()
  const [on, setOn] = useState<(typeof GROUP_TYPES)[number]>('category')
  const money = (n: number) => new Intl.NumberFormat(intlLocale, { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(n)
  const one = (n: number) => new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {GROUP_TYPES.map(g => (
          <button key={g} type="button" onClick={() => setOn(g)} aria-pressed={on === g}
            className={cn('rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
              on === g ? 'border-black bg-black text-white' : 'border-line bg-white text-neutral-600 hover:border-neutral-400')}>
            {t(`site.feat_group_${g}`)}
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {GROUP_ROWS.map((row, i) => (
          <motion.li key={row.key} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-center gap-3 rounded-xl border border-line bg-neutral-50/70 px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white ring-1 ring-line"><Layers className="size-4 text-neutral-700" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-neutral-900">{t(row.key)}</span>
              <span className="block text-[11px] text-neutral-500">{t('site.feat_per_day', { value: money(row.budget) })}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[13px] font-bold tabular-nums">{one(row.roas)}</span>
              <span className="block text-[10px] uppercase tracking-wide text-neutral-400">ROAS</span>{/* i18n-ignore */}
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

function Rules() {
  const { t } = useT()
  const rules = ['site.feat_rule_loss', 'site.feat_rule_products', 'site.feat_rule_budget', 'site.feat_rule_learning'] as const
  return (
    <ul className="space-y-2">
      {rules.map((key, i) => (
        <motion.li key={key} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.07 }}
          className="flex items-start gap-2.5 rounded-xl border border-line bg-neutral-50/70 px-3 py-2.5 text-[12.5px] leading-snug text-neutral-700">
          <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-black text-white"><Check className="size-3" strokeWidth={3} /></span>
          {t(key)}
        </motion.li>
      ))}
    </ul>
  )
}

// Vânzările aduse de reclame pe ultimele 8 săptămâni (RON)
const WEEKS = [1900, 2600, 3050, 2800, 3450, 3700, 4100, 4520]

function Reports() {
  const { t, intlLocale } = useT()
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true })
  const money = (n: number) => new Intl.NumberFormat(intlLocale, { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(Math.round(n))
  return (
    <div ref={ref} className="rounded-2xl border border-line bg-neutral-50/70 p-4">
      <p className="text-[11.5px] text-neutral-500">{t('site.feat_reports_value')}</p>
      <p className="mt-1 text-2xl font-bold tracking-[-0.03em] tabular-nums"><NumberTicker value={WEEKS.reduce((a, b) => a + b, 0)} format={money} /></p>
      <div className="mt-4 flex h-20 items-end gap-1.5">
        {WEEKS.map((v, i) => (
          <motion.span key={i} className={cn('flex-1 rounded-md', i === WEEKS.length - 1 ? 'bg-black' : 'bg-neutral-300')}
            initial={{ height: '6%' }} animate={{ height: seen ? `${(v / Math.max(...WEEKS)) * 100}%` : '6%' }} transition={{ duration: 0.7, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }} />
        ))}
      </div>
    </div>
  )
}

function Recommendations() {
  const { t } = useT()
  const recs = [
    { key: 'site.feat_rec_rejected', sub: 'site.feat_rec_rejected_sub', icon: X, tone: 'bg-amber-500' },
    { key: 'site.feat_rec_price', sub: 'site.feat_rec_price_sub', icon: Tag, tone: 'bg-amber-500' },
    { key: 'site.feat_rec_gtin', sub: 'site.feat_rec_gtin_sub', icon: Lightbulb, tone: 'bg-neutral-300' },
  ] as const
  return (
    <ul className="grid h-full gap-2 sm:grid-cols-3">
      {recs.map((r, i) => (
        <motion.li key={r.key} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.08 }}
          className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-neutral-50/70 p-4">
          <span aria-hidden className={cn('absolute left-0 top-4 h-6 w-[3px] rounded-r-full', r.tone)} />
          <span className="grid size-8 place-items-center rounded-lg bg-white text-neutral-700 ring-1 ring-line"><r.icon className="size-4" /></span>
          <p className="mt-3 text-[13.5px] font-semibold leading-snug text-neutral-900">{t(r.key)}</p>
          <p className="mt-auto pt-3 text-[12px] leading-snug text-neutral-500">{t(r.sub)}</p>
        </motion.li>
      ))}
    </ul>
  )
}

export function Features() {
  const { t } = useT()
  return (
    <section id="features" className="scroll-mt-24 border-b border-line bg-neutral-50 px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeader badge={t('site.feat_badge')} icon={<Sparkles />} titleA={t('site.feat_title_a')} titleB={t('site.feat_title_b')} />
        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" title={t('site.feat_products_title')} desc={t('site.feat_products_desc')}><CampaignProducts /></Card>
          <Card className="lg:row-span-2" delay={0.05} title={t('site.feat_pilot_title')} desc={t('site.feat_pilot_desc')}><PilotModes /></Card>
          <Card delay={0.05} title={t('site.feat_groups_title')} desc={t('site.feat_groups_desc')}><Groups /></Card>
          <Card delay={0.1} title={t('site.feat_rules_title')} desc={t('site.feat_rules_desc')}><Rules /></Card>
          <Card delay={0.05} title={t('site.feat_reports_title')} desc={t('site.feat_reports_desc')}><Reports /></Card>
          <Card className="lg:col-span-2" delay={0.1} title={t('site.feat_recs_title')} desc={t('site.feat_recs_desc')}><Recommendations /></Card>
        </div>
      </div>
    </section>
  )
}
