'use client'

import { Google_Sans } from 'next/font/google'
import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Bell, Check, ChevronDown, ChevronUp, CircleQuestionMark, Columns3, CreditCard, Download, ListFilter,
  Maximize2, Megaphone, Menu, MousePointer2, Plus, RotateCw, Search, Settings, SlidersHorizontal, Star, Trophy, Wrench, X,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import {
  ACCOUNT, BRAND_TERM, CAMPAIGN, CAMPAIGN_NAME, DAILY, P, PRODUCTS, STEPS, TERMS,
  frameAt, roasOf, sameFrame, stepAt, type Frame, type View,
} from './data'

// =============================================
// Contul Google Ads al magazinului, cu pilotul Hontrio la lucru: termenii de
// căutare (două căutări care au costat fără vânzări devin cuvinte negative
// exacte), produsele (două produse care cheltuie mai mult decât vând ies din
// campanie) și campania (bugetul urcă de la 40 la 48 RON pe zi, după ce aprobi
// tu). Totul înaintează cu derularea (progress 0 → 1), ca la căutarea Google
// din capul paginii.
//
// Ce ține de Google e o reconstituire a interfeței Google Ads (bara de sus,
// navigarea din stânga, tabelele, bara de selecție, mesajul de jos), cu
// fontul Google Sans pentru interfață și Roboto/Arial pentru tabele. Ce ține
// de Hontrio (cursorul pilotului, notificările, eticheta bugetului) e negru,
// cu fontul site-ului. Totul e în `em`: fereastra e desenată pentru 1120px
// (pe telefon, 400px) și se micșorează cu containerul.
// =============================================

const gsans = Google_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500'], display: 'swap' })
const SITE_FONT = { fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif' }
/** Fontul sistemului (San Francisco pe Mac și iPhone), pentru notificări. */
const SYSTEM_FONT = { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }
/** Tabelele Google Ads: Roboto, iar unde lipsește, Arial. */
const TABLE_FONT = 'font-[family-name:Roboto,Arial,Helvetica,sans-serif]'

// Culorile interfeței Google (Material 3)
const C = {
  text: '#1f1f1f', text2: '#444746', text3: '#5f6368', line: '#dadce0', soft: '#e3e3e3',
  page: '#f8fafd', chip: '#d3e3fd', onChip: '#041e49', blue: '#0b57d0', link: '#1a73e8', select: '#e8f0fe',
  green: '#1e8e3e', red: '#d93025', amber: '#e37400',
}

// ─── Geometria ferestrei de calculator (em, față de colțul aplicației) ────────
const TOP = 6.4
const RAIL = 8.8
const MENU = 23
const MAIN_X = RAIL + MENU
const PAD = 2.4
const CARD_Y = 11.4
const BAR_H = 4.8
const HEAD_H = 3.8
const ROW_H = 4.4
const rowCenter = (i: number) => TOP + CARD_Y + BAR_H + HEAD_H + ROW_H * i + ROW_H / 2
const CHECK_X = MAIN_X + PAD + 2.4
const BAR_Y = TOP + CARD_Y + BAR_H / 2
/** Butoanele din bara de selecție: unde încep, în card. */
const BTN_X = { first: 17, negative: 37, exclude: 26 }

function useMoney() {
  const { intlLocale } = useT()
  return useMemo(() => {
    const money = new Intl.NumberFormat(intlLocale, { style: 'currency', currency: 'RON', minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const int = new Intl.NumberFormat(intlLocale)
    const dec = new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const round = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 })
    return { money: (n: number) => money.format(n), int: (n: number) => int.format(n), dec: (n: number) => dec.format(n), round: (n: number) => round.format(n) }
  }, [intlLocale])
}

// ─── Piese Google Ads ─────────────────────────────────────────────────────────

/** Logo-ul Google Ads (fișierul oficial din /site/logos). */
function AdsLogo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/site/logos/google-ads.svg" alt="" className={className} />
}

/** Căsuța de bifat din tabele (Material 3). */
function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span className={cn('grid size-[1.8em] place-items-center rounded-[0.25em] border-[0.15em] transition-colors duration-150',
      checked ? 'border-[#0b57d0] bg-[#0b57d0]' : 'border-[#444746] bg-white')}>
      {checked && <Check className="size-[1.3em] text-white" strokeWidth={3.2} />}
    </span>
  )
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block size-[0.8em] shrink-0 rounded-full" style={{ background: color }} />
}

/** Bara de sus a Google Ads: logo, contul, căutarea și iconițele. */
function TopBar() {
  const { t } = useT()
  return (
    <div className={cn(gsans.className, 'absolute inset-x-0 top-0 flex items-center gap-[1.6em] border-b px-[2em]')} style={{ height: `${TOP}em`, borderColor: C.soft }}>
      <span className="flex items-center gap-[1em]">
        <AdsLogo className="h-[2.6em] w-auto" />
        <span className="text-[2.1em] text-[#444746]">Google Ads{/* i18n-ignore: nume de produs */}</span>
      </span>
      <span className="h-[3em] w-px bg-[#dadce0]" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-[1.4em] font-medium" style={{ color: C.text }}>{ACCOUNT.name}</span>
        <span className="text-[1.15em]" style={{ color: C.text3 }}>{ACCOUNT.id}</span>
      </span>
      <span className="ml-[2em] flex h-[4.4em] w-[46em] items-center gap-[1.2em] rounded-full bg-[#e9eef6] px-[1.6em]" style={{ color: C.text2 }}>
        <Search className="size-[2em] shrink-0" />
        <span className="truncate text-[1.5em]">{t('site.opt2_search')}</span>
      </span>
      <span className="ml-auto flex items-center gap-[1.8em]" style={{ color: C.text2 }}>
        <RotateCw className="size-[2em]" />
        <CircleQuestionMark className="size-[2.1em]" />
        <span className="relative"><Bell className="size-[2.1em]" /><span className="absolute -right-[0.2em] -top-[0.1em] size-[0.9em] rounded-full border-[0.15em] border-white bg-[#d93025]" /></span>
        <span className="grid size-[3.2em] place-items-center rounded-full bg-[#0b57d0] text-white"><span className="text-[1.5em] font-medium">M{/* i18n-ignore: inițiala contului */}</span></span>
      </span>
    </div>
  )
}

/** Navigarea din stânga: „Creați" și secțiunile mari, cu „Campanii" aleasă. */
function NavRail() {
  const { t } = useT()
  const items = [
    { icon: Megaphone, label: t('site.opt2_nav_campaigns'), on: true },
    { icon: Trophy, label: t('site.opt2_nav_goals') },
    { icon: Wrench, label: t('site.opt2_nav_tools') },
    { icon: CreditCard, label: t('site.opt2_nav_billing') },
    { icon: Settings, label: t('site.opt2_nav_admin') },
  ]
  return (
    <div className={cn(gsans.className, 'absolute bottom-0 left-0 flex flex-col items-center gap-[1.6em] pt-[1.6em]')} style={{ top: `${TOP}em`, width: `${RAIL}em` }}>
      <span className="flex flex-col items-center gap-[0.5em]">
        <span className="grid size-[5.2em] place-items-center rounded-[1.6em] bg-white shadow-[0_0.1em_0.3em_rgba(60,64,67,0.3),0_0.4em_0.8em_0.3em_rgba(60,64,67,0.15)]">
          <Plus className="size-[2.4em]" style={{ color: C.blue }} strokeWidth={2.2} />
        </span>
        <span className="text-[1.15em] font-medium" style={{ color: C.text2 }}>{t('site.opt2_nav_create')}</span>
      </span>
      {items.map(it => (
        <span key={it.label} className="flex flex-col items-center gap-[0.4em]">
          <span className={cn('grid h-[3.2em] w-[5.6em] place-items-center rounded-full', it.on && 'bg-[#d3e3fd]')}>
            <it.icon className="size-[2em]" style={{ color: it.on ? C.onChip : C.text2 }} strokeWidth={1.8} />
          </span>
          <span className={cn('text-[1.15em]', it.on ? 'font-medium' : '')} style={{ color: it.on ? C.onChip : C.text2 }}>{it.label}</span>
        </span>
      ))}
    </div>
  )
}

function MenuItem({ k, on = false, sub = false }: { k: string; on?: boolean; sub?: boolean }) {
  const { t } = useT()
  return (
    <span className={cn('mx-[1.2em] flex h-[3.4em] items-center rounded-full pr-[1.2em] transition-colors duration-300', sub ? 'pl-[3.2em]' : 'pl-[1.6em]', on && 'bg-[#d3e3fd]')}>
      <span className={cn('truncate text-[1.35em]', on && 'font-medium')} style={{ color: on ? C.onChip : C.text }}>{t(`site.opt2_menu_${k}`)}</span>
    </span>
  )
}

function MenuGroup({ k, open = false }: { k: string; open?: boolean }) {
  const { t } = useT()
  const Chevron = open ? ChevronUp : ChevronDown
  return (
    <span className="mx-[1.2em] flex h-[3.4em] items-center justify-between pl-[1.6em] pr-[1.2em]">
      <span className="truncate text-[1.35em]" style={{ color: C.text }}>{t(`site.opt2_menu_${k}`)}</span>
      <Chevron className="size-[1.6em] shrink-0" style={{ color: C.text2 }} />
    </span>
  )
}

/** Meniul paginii: secțiunile campaniei, cu pagina de acum aleasă. */
function PageMenu({ view }: { view: View }) {
  return (
    <div className={cn(gsans.className, 'absolute bottom-0 overflow-hidden border-r pt-[1.2em]')} style={{ top: `${TOP}em`, left: `${RAIL}em`, width: `${MENU}em`, borderColor: C.soft }}>
      <MenuItem k="overview" />
      <MenuItem k="recs" />
      <MenuGroup k="insights" open />
      <MenuItem k="terms" sub on={view === 'terms'} />
      <MenuItem k="when" sub />
      <MenuGroup k="campaigns_group" open />
      <MenuItem k="campaigns" sub on={view === 'campaigns'} />
      <MenuItem k="adgroups" sub />
      <MenuItem k="products" sub on={view === 'products'} />
      <MenuItem k="listing" sub />
      <MenuGroup k="audiences" />
      <MenuItem k="history" />
    </div>
  )
}

/** Capul paginii: campania aleasă, intervalul de date și titlul paginii. */
function PageHead({ title }: { title: string }) {
  const { t } = useT()
  return (
    <div className={gsans.className}>
      <div className="flex items-start justify-between" style={{ height: '4.6em', paddingTop: '1.6em' }}>
        <span className="flex flex-col">
          <span className="text-[1.1em]" style={{ color: C.text3 }}>{t('site.opt2_campaign')}</span>
          <span className="flex items-center gap-[0.6em]">
            <Dot color={C.green} />
            <span className="text-[1.4em] font-medium" style={{ color: C.text }}>{CAMPAIGN_NAME}</span>
            <ChevronDown className="size-[1.6em]" style={{ color: C.text2 }} />
          </span>
        </span>
        <span className="flex items-center gap-[1em]" style={{ color: C.text2 }}>
          <span className="text-[1.2em]">{t('site.opt2_range')}</span>
          <span className="flex items-center gap-[0.4em] rounded-[0.6em] border px-[1em] py-[0.5em]" style={{ borderColor: C.line }}>
            <span className="text-[1.3em]" style={{ color: C.text }}>{t('site.opt2_dates')}</span>
            <ChevronDown className="size-[1.5em]" />
          </span>
          <ArrowLeft className="size-[1.6em]" /><ArrowRight className="size-[1.6em] opacity-40" />
        </span>
      </div>
      <p className="text-[2.2em] leading-[1.4]" style={{ color: C.text, marginTop: '0.5em' }}>{title}</p>
    </div>
  )
}

/** Bara de deasupra tabelului: filtrul și iconițele, sau, cu rânduri bifate, acțiunile. */
function TableBar({ selected, pressed, actions, second }: { selected: number; pressed: boolean; actions: [string, string]; second: number }) {
  const { t } = useT()
  const reduce = useReducedMotion()
  return (
    <div className={cn(gsans.className, 'relative border-b')} style={{ height: `${BAR_H}em`, borderColor: C.line }}>
      <div className="absolute inset-0 flex items-center gap-[1.2em] px-[1.6em]" style={{ color: C.text2 }}>
        <ListFilter className="size-[1.9em]" />
        <span className="text-[1.35em]">{t('site.opt2_filter')}</span>
        <span className="ml-auto flex items-center gap-[2em]">
          <Search className="size-[1.9em]" /><SlidersHorizontal className="size-[1.8em]" /><Columns3 className="size-[1.9em]" /><Download className="size-[1.9em]" /><Maximize2 className="size-[1.7em]" />
        </span>
      </div>
      <AnimatePresence initial={false}>
        {selected > 0 && (
          <motion.div key="bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.18 }}
            className="absolute inset-0 rounded-t-[0.8em] bg-[#d3e3fd]">
            <span className="absolute left-[1.6em] top-1/2 -translate-y-1/2 text-[1.4em] font-medium" style={{ color: C.onChip }}>{t('site.opt2_selected', { count: selected })}</span>
            {actions.map((label, i) => (
              <span key={label} className={cn('absolute top-1/2 flex h-[3.4em] -translate-y-1/2 items-center rounded-full px-[1.2em] transition-colors duration-150', i === 1 && pressed && 'bg-[#a8c7fa]')}
                style={{ left: `${i === 0 ? BTN_X.first : second}em` }}>
                <span className="whitespace-nowrap text-[1.35em] font-medium" style={{ color: C.blue }}>{label}</span>
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Un rând de tabel: se poate bifa, primește „Exclus", apoi se estompează și se strânge. */
function Row({ cols, children, selected, done, gone, className }: { cols: string; children: ReactNode; selected: boolean; done: boolean; gone: boolean; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div initial={false} animate={{ height: gone ? 0 : `${ROW_H}em`, opacity: gone ? 0 : done ? 0.45 : 1 }}
      transition={{ duration: reduce ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden">
      <div className={cn('grid items-center border-b transition-colors duration-200', className)}
        style={{ gridTemplateColumns: cols, height: `${ROW_H}em`, borderColor: C.soft, background: selected && !done ? C.select : 'white' }}>
        {children}
      </div>
    </motion.div>
  )
}

function Cell({ children, right = false, className }: { children: ReactNode; right?: boolean; className?: string }) {
  return <span className={cn('min-w-0 truncate px-[0.8em] text-[1.3em]', right && 'text-right tabular-nums', className)} style={{ color: C.text }}>{children}</span>
}

/** Capul unei coloane: ca în Google Ads, un nume lung trece pe al doilea rând. */
function HeadCell({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return <span className={cn('line-clamp-2 min-w-0 px-[0.8em] text-[1.2em] font-medium leading-[1.25]', right && 'text-right')} style={{ color: C.text2 }}>{children}</span>
}

/** Mesajul de jos, ca în Google Ads, după o modificare. */
function Snackbar({ text }: { text: string | null }) {
  const { t } = useT()
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {text && (
        <motion.div key={text} initial={reduce ? false : { opacity: 0, y: '1em' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          className={cn(gsans.className, 'absolute bottom-[2em] left-[2.4em] z-30 flex items-center gap-[2.4em] rounded-[0.5em] bg-[#303030] px-[1.6em] py-[1.2em] shadow-[0_0.3em_0.6em_rgba(0,0,0,0.3)]')}>
          <span className="whitespace-nowrap text-[1.35em] text-[#f2f2f2]">{text}</span>
          <span className="text-[1.35em] font-medium text-[#a8c7fa]">{t('site.opt2_undo')}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Vederile, pe calculator ──────────────────────────────────────────────────

const TERM_COLS = '4.8em minmax(0,1fr) 10.4em 6.4em 7.4em 10.2em 7.6em 11.8em'
const PRODUCT_COLS = '4.8em minmax(0,1fr) 9em 10em 6.4em 10em 7.6em 8.6em'

function TermsView({ frame }: { frame: Frame }) {
  const { t } = useT()
  const f = useMoney()
  return (
    <>
      <PageHead title={t('site.opt2_menu_terms')} />
      <div className={cn(TABLE_FONT, 'absolute overflow-hidden rounded-[0.8em] border bg-white')} style={{ top: `${CARD_Y}em`, left: `${PAD}em`, right: `${PAD}em`, bottom: '-1em', borderColor: C.line }}>
        <TableBar selected={frame.done ? 0 : frame.selected} pressed={frame.pressed} actions={[t('site.opt2_add_keyword'), t('site.opt2_add_negative')]} second={BTN_X.negative} />
        <div className="grid items-center border-b" style={{ gridTemplateColumns: TERM_COLS, height: `${HEAD_H}em`, borderColor: C.line }}>
          <span className="grid place-items-center"><Checkbox checked={false} /></span>
          <HeadCell>{t('site.opt2_col_term')}</HeadCell><HeadCell>{t('site.opt2_col_added')}</HeadCell>
          <HeadCell right>{t('site.opt2_col_clicks')}</HeadCell><HeadCell right>{t('site.opt2_col_impr')}</HeadCell>
          <HeadCell right>{t('site.opt2_col_cost')}</HeadCell><HeadCell right>{t('site.opt2_col_conv')}</HeadCell><HeadCell right>{t('site.opt2_col_value')}</HeadCell>
        </div>
        {TERMS.map((term, i) => {
          const drop = !!term.drop
          const selected = drop && i < frame.selected
          return (
            <Row key={term.id} cols={TERM_COLS} selected={selected} done={drop && frame.done} gone={drop && frame.gone}>
              <span className="grid place-items-center"><Checkbox checked={selected || (drop && frame.done)} /></span>
              <Cell>{term.id === 'brand' ? BRAND_TERM : t(`site.opt2_term_${term.id}`)}</Cell>
              <Cell className={drop && frame.done ? 'font-medium' : ''}>{drop && frame.done ? t('site.opt2_excluded') : t('site.opt2_none')}</Cell>
              <Cell right>{f.int(term.clicks)}</Cell><Cell right>{f.int(term.impr)}</Cell>
              <Cell right>{f.money(term.cost)}</Cell><Cell right>{f.dec(term.conv)}</Cell><Cell right>{f.money(term.value)}</Cell>
            </Row>
          )
        })}
      </div>
    </>
  )
}

function ProductsView({ frame }: { frame: Frame }) {
  const { t } = useT()
  const f = useMoney()
  return (
    <>
      <PageHead title={t('site.opt2_menu_products')} />
      <div className={cn(TABLE_FONT, 'absolute overflow-hidden rounded-[0.8em] border bg-white')} style={{ top: `${CARD_Y}em`, left: `${PAD}em`, right: `${PAD}em`, bottom: '-1em', borderColor: C.line }}>
        <TableBar selected={frame.done ? 0 : frame.selected} pressed={frame.pressed} actions={[t('site.opt2_edit'), t('site.opt2_exclude')]} second={BTN_X.exclude} />
        <div className="grid items-center border-b" style={{ gridTemplateColumns: PRODUCT_COLS, height: `${HEAD_H}em`, borderColor: C.line }}>
          <span className="grid place-items-center"><Checkbox checked={false} /></span>
          <HeadCell>{t('site.opt2_col_product')}</HeadCell><HeadCell>{t('site.opt2_col_status')}</HeadCell>
          <HeadCell right>{t('site.opt2_col_price')}</HeadCell><HeadCell right>{t('site.opt2_col_clicks')}</HeadCell>
          <HeadCell right>{t('site.opt2_col_cost')}</HeadCell><HeadCell right>{t('site.opt2_col_conv')}</HeadCell><HeadCell right>{t('site.opt2_col_roas')}</HeadCell>
        </div>
        {PRODUCTS.map(p => {
          const drop = !!p.drop
          // Pilotul bifează întâi aplica (al treilea rând), apoi becurile (al cincilea)
          const order = p.id === 'sconce' ? 1 : p.id === 'bulbs' ? 2 : 0
          const selected = drop && frame.selected >= order
          const roas = roasOf(p.value, p.cost)
          return (
            <Row key={p.id} cols={PRODUCT_COLS} selected={selected} done={drop && frame.done} gone={drop && frame.gone}>
              <span className="grid place-items-center"><Checkbox checked={selected || (drop && frame.done)} /></span>
              <span className="flex min-w-0 flex-col px-[0.8em] leading-tight">
                <span className="truncate text-[1.3em]" style={{ color: C.link }}>{t(`site.opt2_prod_${p.id}`)}</span>
                <span className="truncate text-[1.1em]" style={{ color: C.text3 }}>{t('site.opt2_item', { id: p.item })}</span>
              </span>
              <span className="flex min-w-0 items-center gap-[0.6em] px-[0.8em]">
                <Dot color={drop && frame.done ? '#9aa0a6' : C.green} />
                <span className={cn('truncate text-[1.3em]', drop && frame.done && 'font-medium')} style={{ color: C.text }}>{drop && frame.done ? t('site.opt2_excluded') : t('site.opt2_eligible')}</span>
              </span>
              <Cell right>{f.money(p.price)}</Cell><Cell right>{f.int(p.clicks)}</Cell><Cell right>{f.money(p.cost)}</Cell>
              <Cell right>{f.dec(p.conv)}</Cell>
              <Cell right className={roas < 1 ? 'font-medium' : ''}>{f.dec(roas)}</Cell>
            </Row>
          )
        })}
      </div>
    </>
  )
}

/** Graficul campaniei pe 30 de zile: clicurile (albastru) și costul (roșu), fiecare pe axa lui. */
function TrendChart() {
  const path = (pick: (d: (typeof DAILY)[number]) => number, min: number, max: number) =>
    DAILY.map((d, i) => `${i === 0 ? 'M' : 'L'}${(i / (DAILY.length - 1)) * 1000} ${(1 - (pick(d) - min) / (max - min)) * 100}`).join(' ')
  return (
    <svg viewBox="0 -6 1000 112" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
      {[0, 33, 66, 100].map(y => <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="#e3e3e3" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      <path d={path(d => d.clicks, 30, 60)} fill="none" stroke="#1a73e8" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <path d={path(d => d.cost, 28, 44)} fill="none" stroke="#d93025" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

/** Eticheta Hontrio de lângă buget, după aprobare. */
function BudgetChip({ show }: { show: boolean }) {
  const { t } = useT()
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {show && (
        <motion.span initial={reduce ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          className="inline-flex items-center gap-[0.4em] whitespace-nowrap rounded-full bg-black px-[0.8em] py-[0.3em] text-white" style={SITE_FONT}>
          <Check className="size-[1.1em]" strokeWidth={3} /><span className="text-[1.05em] font-semibold">{t('site.opt2_budget_chip')}</span>
        </motion.span>
      )}
    </AnimatePresence>
  )
}

function CampaignsView({ frame }: { frame: Frame }) {
  const { t } = useT()
  const f = useMoney()
  const reduce = useReducedMotion()
  const budget = frame.approved ? CAMPAIGN.to : CAMPAIGN.from
  const cards = [
    { label: t('site.opt2_col_clicks'), value: f.int(CAMPAIGN.clicks), color: '#1a73e8' },
    { label: t('site.opt2_col_cost'), value: f.money(CAMPAIGN.cost), color: '#d93025' },
    { label: t('site.opt2_col_conv'), value: f.dec(CAMPAIGN.conv) },
    { label: t('site.opt2_col_roas'), value: f.dec(roasOf(CAMPAIGN.value, CAMPAIGN.cost)) },
  ]
  // Bugetul are loc și pentru eticheta Hontrio de sub el; starea trece pe două rânduri
  const cols = '4.8em 3.2em minmax(0,1fr) 16.8em 13em 12em 8.4em'
  return (
    <>
      <PageHead title={t('site.opt2_menu_campaigns')} />
      <div className={cn(gsans.className, 'absolute overflow-hidden rounded-[0.8em] border bg-white')} style={{ top: `${CARD_Y}em`, left: `${PAD}em`, right: `${PAD}em`, height: '16.4em', borderColor: C.line }}>
        <div className="grid grid-cols-4 border-b" style={{ borderColor: C.line }}>
          {cards.map((c, i) => (
            <span key={c.label} className="relative flex flex-col gap-[0.3em] px-[1.6em] py-[1.1em]" style={{ background: c.color ? 'white' : '#f8f9fa', borderLeft: i ? `1px solid ${C.line}` : undefined }}>
              {c.color && <span className="absolute inset-x-0 top-0 h-[0.35em]" style={{ background: c.color }} />}
              <span className="flex items-center gap-[0.4em]" style={{ color: C.text2 }}><span className="text-[1.25em]">{c.label}</span><ChevronDown className="size-[1.3em]" /></span>
              <span className="text-[2em]" style={{ color: C.text }}>{c.value}</span>
            </span>
          ))}
        </div>
        <div className="absolute inset-x-[1.6em] bottom-[1em] top-[8.2em]"><TrendChart /></div>
      </div>
      <div className={cn(TABLE_FONT, 'absolute overflow-hidden rounded-[0.8em] border bg-white')} style={{ top: `${CARD_Y + 17.4}em`, left: `${PAD}em`, right: `${PAD}em`, borderColor: C.line }}>
        <div className="grid items-center border-b" style={{ gridTemplateColumns: cols, height: `${HEAD_H}em`, borderColor: C.line }}>
          <span className="grid place-items-center"><Checkbox checked={false} /></span><span />
          <HeadCell>{t('site.opt2_col_campaign')}</HeadCell><HeadCell>{t('site.opt2_col_budget')}</HeadCell><HeadCell>{t('site.opt2_col_status')}</HeadCell>
          <HeadCell right>{t('site.opt2_col_cost')}</HeadCell><HeadCell right>{t('site.opt2_col_roas')}</HeadCell>
        </div>
        <div className="grid items-center" style={{ gridTemplateColumns: cols, height: '6.6em' }}>
          <span className="grid place-items-center"><Checkbox checked={false} /></span>
          <span className="grid place-items-center"><Dot color={C.green} /></span>
          <span className="flex min-w-0 flex-col px-[0.8em] leading-tight">
            <span className="truncate text-[1.3em]" style={{ color: C.link }}>{CAMPAIGN_NAME}</span>
            <span className="truncate text-[1.1em]" style={{ color: C.text3 }}>Shopping{/* i18n-ignore: tipul campaniei în Google Ads */}</span>
          </span>
          <span className="flex min-w-0 flex-col items-start gap-[0.35em] px-[0.8em]">
            <motion.span key={budget} initial={reduce || !frame.approved ? false : { backgroundColor: '#fde293' }} animate={{ backgroundColor: 'rgba(253,226,147,0)' }} transition={{ duration: 1.4 }}
              className="whitespace-nowrap rounded-[0.3em] text-[1.3em] tabular-nums" style={{ color: C.text }}>
              {t('site.opt2_per_day', { value: f.money(budget) })}
            </motion.span>
            <BudgetChip show={frame.approved} />
          </span>
          <span className="flex min-w-0 items-start gap-[0.6em] px-[0.8em]">
            {!frame.approved && <span className="mt-[0.15em] grid size-[1.6em] shrink-0 place-items-center rounded-full text-white" style={{ background: C.amber }}><span className="text-[1em] font-bold">!{/* i18n-ignore: semn */}</span></span>}
            <span className="line-clamp-2 text-[1.3em] leading-[1.3]" style={{ color: C.text }}>{frame.approved ? t('site.opt2_status_eligible') : t('site.opt2_status_limited')}</span>
          </span>
          <Cell right>{f.money(CAMPAIGN.cost)}</Cell>
          <Cell right>{f.dec(roasOf(CAMPAIGN.value, CAMPAIGN.cost))}</Cell>
        </div>
      </div>
    </>
  )
}

// ─── Ce adaugă Hontrio peste pagină ──────────────────────────────────────────

/** Cursorul pilotului, cu eticheta lui (ca un coleg care lucrează în același cont). */
function PilotCursor({ progress }: { progress: MotionValue<number> }) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const r0 = rowCenter(0), r1 = rowCenter(1), r2 = rowCenter(2), r4 = rowCenter(4)
  const negX = MAIN_X + PAD + BTN_X.negative + 6
  const exX = MAIN_X + PAD + BTN_X.exclude + 3
  const times = [0, P.cursorIn, P.sel1 - 0.01, P.sel2 - 0.01, P.negClick - 0.01, 0.26, P.products + 0.02, P.sel3 - 0.01, P.sel4 - 0.01, P.exClick - 0.01, 0.6, 1]
  const left = useTransform(progress, times, [100, 100, CHECK_X, CHECK_X, negX, 98, 100, CHECK_X, CHECK_X, exX, 98, 98].map(x => `${x - 0.5}em`))
  const top = useTransform(progress, times, [12, 12, r0, r1, BAR_Y, 44, 12, r2, r4, BAR_Y, 44, 44].map(y => `${y - 0.4}em`))
  const opacity = useTransform(progress, [0, P.cursorIn - 0.005, P.cursorIn + 0.01, 0.255, 0.28, P.products + 0.01, P.products + 0.03, 0.595, 0.62], [0, 0, 1, 1, 0, 0, 1, 1, 0])
  const clicks = [P.sel1, P.sel2, P.negClick, P.sel3, P.sel4, P.exClick]
  const scale = useTransform(progress, clicks.flatMap(c => [c - 0.006, c, c + 0.008]), clicks.flatMap(() => [1, 0.78, 1]))
  if (reduce) return null
  return (
    <motion.span style={{ left, top, opacity }} className="pointer-events-none absolute z-40 block">
      <motion.span style={{ scale }} className="block origin-top-left">
        <MousePointer2 className="size-[2.6em] fill-black text-white drop-shadow-[0_0.3em_0.6em_rgba(0,0,0,0.35)]" strokeWidth={1.3} />
      </motion.span>
      <span className="absolute left-[2em] top-[2.2em] whitespace-nowrap rounded-[0.5em] rounded-tl-none bg-black px-[0.7em] py-[0.3em] text-white" style={SITE_FONT}>
        <span className="block text-[1.1em] font-semibold">{t('site.opt2_cursor')}</span>
      </span>
    </motion.span>
  )
}

/** O notificare Hontrio, ca pe Mac (în colțul ferestrei) sau pe iPhone (sus). */
function Notice({ which, approved, mobile = false }: { which: 1 | 2 | 3 | null; approved: boolean; mobile?: boolean }) {
  const { t } = useT()
  const f = useMoney()
  const reduce = useReducedMotion()
  const [a, b] = TERMS.filter(x => x.drop).map(x => t(`site.opt2_term_${x.id}`))
  const sconce = PRODUCTS.find(p => p.id === 'sconce')!
  const bulbs = PRODUCTS.find(p => p.id === 'bulbs')!
  const content = which === 1
    ? { title: t('site.opt2_n1_title'), body: t('site.opt2_n1_body', { a, b, spend: f.money(TERMS.filter(x => x.drop).reduce((s, x) => s + x.cost, 0)) }) }
    : which === 2
      ? { title: t('site.opt2_n2_title'), body: t('site.opt2_n2_body', { a: t('site.opt2_prod_sconce'), spend: f.money(sconce.cost), b: t('site.opt2_prod_bulbs'), roas: f.dec(roasOf(bulbs.value, bulbs.cost)) }) }
      : which === 3
        ? (approved
          ? { title: t('site.opt2_approved'), body: t('site.opt2_n3_done', { to: f.money(CAMPAIGN.to) }) }
          : { title: t('site.opt2_n3_title', { to: f.money(CAMPAIGN.to), from: f.money(CAMPAIGN.from) }), body: t('site.opt2_n3_body', { roas: f.dec(roasOf(CAMPAIGN.value, CAMPAIGN.cost)) }) })
        : null
  const key = which === 3 ? `3-${approved}` : String(which)
  const from = mobile ? { opacity: 0, y: '-120%' } : { opacity: 0, x: '110%' }
  return (
    <AnimatePresence mode="wait">
      {content && (
        <motion.div key={key} initial={reduce ? { opacity: 0 } : from} animate={{ opacity: 1, x: 0, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }} style={SYSTEM_FONT}
          className={cn('pointer-events-none absolute z-50 border border-black/[0.06] bg-[#f6f6f6]/90 shadow-[0_1.2em_3em_-0.8em_rgba(0,0,0,0.35),0_0_0_0.05em_rgba(0,0,0,0.04)] backdrop-blur-2xl',
            // Pe telefon, sub bara cu adresa (eticheta „date demonstrative" rămâne la vedere)
            mobile ? 'inset-x-[0.8em] top-[6em] rounded-[2.2em] p-[1.2em]' : 'right-[1.2em] top-[1.2em] w-[38em] rounded-[1.7em] p-[1.2em]' /* i18n-ignore */)}>
          <div className="flex items-start gap-[1.1em]">
            <span className={cn('grid shrink-0 place-items-center border border-black/[0.06] bg-white shadow-[0_0.1em_0.3em_rgba(0,0,0,0.12)]', mobile ? 'size-[4em] rounded-[0.95em]' : 'size-[3.8em] rounded-[0.85em]')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-icon.png" alt="" className="h-[52%] w-auto" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-[1em]">
                <span className="line-clamp-2 text-[1.3em] font-semibold leading-[1.3] text-[#1d1d1f]">{content.title}</span>
                <span className="shrink-0 pt-[0.15em] text-[1.1em] text-[#8e8e93]">{t('site.opt2_now')}</span>
              </span>
              <span className="mt-[0.1em] block text-[1.2em] leading-[1.35] text-[#3a3a3c]">{content.body}</span>
            </span>
          </div>
          {which === 3 && !approved && (
            <div className="mt-[1em] grid grid-cols-2 gap-[0.8em]">
              <span className="grid h-[3em] place-items-center rounded-[0.9em] bg-black/[0.06]"><span className="text-[1.2em] font-medium text-[#1d1d1f]">{t('site.opt2_reject')}</span></span>
              <span className="grid h-[3em] place-items-center rounded-[0.9em] bg-black"><span className="text-[1.2em] font-semibold text-white">{t('site.opt2_approve')}</span></span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Bara browserului: fila cu titlul paginii, adresa și eticheta „date demonstrative". */
function BrowserBar({ title, path }: { title: string; path: string }) {
  const { t } = useT()
  return (
    <>
      <div className="flex h-[3.8em] items-end gap-[1.2em] bg-[#dfe3e8] pl-[1.4em] pr-[1.2em]">
        <span className="mb-[1.35em] flex gap-[0.7em]">{[0, 1, 2].map(i => <span key={i} className="size-[1.1em] rounded-full bg-black/15" />)}</span>
        <span className={cn(gsans.className, 'flex h-[3.1em] w-[30em] items-center gap-[0.8em] rounded-t-[0.9em] bg-white px-[1.2em]')}>
          <AdsLogo className="h-[1.3em] w-auto shrink-0" />
          <span className="min-w-0 flex-1 truncate text-[1.2em] text-[#1f1f1f]">{title}</span>
          <X className="size-[1.3em] shrink-0 text-[#5f6368]" />
        </span>
        {/* Lângă filă, nu în colț: notificările de sus din dreapta nu trebuie s-o acopere */}
        <span className="mb-[0.9em] rounded-full bg-black px-[0.9em] py-[0.35em] text-white" style={SITE_FONT}>
          <span className="block text-[1.05em] font-semibold leading-none">{t('site.opt2_demo')}</span>
        </span>
      </div>
      <div className="flex h-[4.6em] items-center gap-[1.6em] border-b border-[#e3e3e3] px-[1.6em] text-[#5f6368]">
        <ArrowLeft className="size-[1.7em]" /><ArrowRight className="size-[1.7em] opacity-40" /><RotateCw className="size-[1.5em]" />
        <span className="flex h-[3.3em] min-w-0 flex-1 items-center gap-[1em] rounded-full bg-[#f1f3f4] px-[1.4em]">
          <SlidersHorizontal className="size-[1.4em] shrink-0" />
          <span className="truncate text-[1.35em] text-[#1f1f1f]">{path}</span>
        </span>
        <Star className="size-[1.6em]" />
      </div>
    </>
  )
}

// i18n-ignore-start (adresele paginilor din Google Ads)
const PATHS: Record<View, string> = {
  terms: 'ads.google.com/aw/searchterms?campaignId=21854076093',
  products: 'ads.google.com/aw/products?campaignId=21854076093',
  campaigns: 'ads.google.com/aw/campaigns?campaignId=21854076093',
}
// i18n-ignore-end

const PAGE_KEY: Record<View, string> = { terms: 'site.opt2_menu_terms', products: 'site.opt2_menu_products', campaigns: 'site.opt2_menu_campaigns' }

function DesktopWindow({ frame, progress }: { frame: Frame; progress: MotionValue<number> }) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const page = t(PAGE_KEY[frame.view])
  const snack = frame.snack === 'terms' ? t('site.opt2_snack_terms') : frame.snack === 'products' ? t('site.opt2_snack_products') : frame.snack === 'campaigns' ? t('site.opt2_snack_budget') : null
  return (
    <div className="relative overflow-hidden rounded-[1.2em] border border-black/10 bg-white shadow-[0_0.1em_0.2em_rgba(0,0,0,0.04),0_5em_10em_-5em_rgba(0,0,0,0.45)]">
      {/* i18n-ignore: titlul filei, ca în Google Ads */}
      <BrowserBar title={`${page} – ${ACCOUNT.name} – Google Ads`} path={PATHS[frame.view]} />
      <div className="relative h-[54em] overflow-hidden bg-white tracking-normal">
        <TopBar />
        <NavRail />
        <PageMenu view={frame.view} />
        <div className="absolute bottom-0 right-0 overflow-hidden" style={{ top: `${TOP}em`, left: `${MAIN_X}em`, background: C.page }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={frame.view} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.2 }}
              className="absolute inset-0" style={{ paddingLeft: `${PAD}em`, paddingRight: `${PAD}em` }}>
              {frame.view === 'terms' ? <TermsView frame={frame} /> : frame.view === 'products' ? <ProductsView frame={frame} /> : <CampaignsView frame={frame} />}
            </motion.div>
          </AnimatePresence>
          <Snackbar text={snack} />
        </div>
        <PilotCursor progress={progress} />
      </div>
      <Notice which={frame.notice} approved={frame.approved} />
    </div>
  )
}

// ─── Telefonul ────────────────────────────────────────────────────────────────

/**
 * Un rând pe telefon, ca în lista Google Ads de pe mobil: numele și starea sus, cifrele dedesubt.
 * Se bifează, primește „Exclus", apoi se estompează și se strânge, ca pe calculator.
 */
function MobileRow({ name, status, meta, link = false, selected, done, gone }: {
  name: string; status: string; meta: string; link?: boolean; selected: boolean; done: boolean; gone: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div initial={false} animate={{ height: gone ? 0 : '5.8em', opacity: gone ? 0 : done ? 0.45 : 1 }} transition={{ duration: reduce ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
      <div className="flex h-[5.8em] items-center gap-[1.2em] border-b px-[1.2em] transition-colors duration-200" style={{ borderColor: C.soft, background: selected && !done ? C.select : 'white' }}>
        <Checkbox checked={selected || done} />
        <span className="flex min-w-0 flex-1 flex-col gap-[0.25em]">
          <span className="flex items-baseline justify-between gap-[1em]">
            <span className="truncate text-[1.35em]" style={{ color: link ? C.link : C.text }}>{name}</span>
            <span className={cn('shrink-0 text-[1.2em]', done && 'font-medium')} style={{ color: done ? C.text : C.text2 }}>{status}</span>
          </span>
          <span className="truncate text-[1.15em] tabular-nums" style={{ color: C.text3 }}>{meta}</span>
        </span>
      </div>
    </motion.div>
  )
}

function MobileView({ frame }: { frame: Frame }) {
  const { t } = useT()
  const f = useMoney()
  if (frame.view === 'campaigns') {
    const budget = frame.approved ? CAMPAIGN.to : CAMPAIGN.from
    return (
      <div className={cn(gsans.className, 'space-y-[1.2em] px-[1.6em]')}>
        <div className="grid grid-cols-2 overflow-hidden rounded-[0.8em] border bg-white" style={{ borderColor: C.line }}>
          {[{ label: t('site.opt2_col_cost'), value: f.money(CAMPAIGN.cost), color: '#d93025' }, { label: t('site.opt2_col_roas'), value: f.dec(roasOf(CAMPAIGN.value, CAMPAIGN.cost)), color: '#1a73e8' }].map((c, i) => (
            <span key={c.label} className="relative flex flex-col gap-[0.3em] px-[1.4em] py-[1em]" style={{ borderLeft: i ? `1px solid ${C.line}` : undefined }}>
              <span className="absolute inset-x-0 top-0 h-[0.35em]" style={{ background: c.color }} />
              <span className="text-[1.2em]" style={{ color: C.text2 }}>{c.label}</span>
              <span className="text-[1.9em]" style={{ color: C.text }}>{c.value}</span>
            </span>
          ))}
        </div>
        <div className="h-[13em] rounded-[0.8em] border bg-white px-[1.2em] py-[1.4em]" style={{ borderColor: C.line }}><TrendChart /></div>
        <div className="rounded-[0.8em] border bg-white p-[1.4em]" style={{ borderColor: C.line }}>
          <span className="flex items-center gap-[0.6em]"><Dot color={C.green} /><span className="truncate text-[1.35em] font-medium" style={{ color: C.link }}>{CAMPAIGN_NAME}</span></span>
          <div className="mt-[1.2em] grid grid-cols-2 gap-[1em]">
            <span className="flex flex-col items-start gap-[0.4em]">
              <span className="text-[1.15em]" style={{ color: C.text3 }}>{t('site.opt2_col_budget')}</span>
              <span className="text-[1.45em] tabular-nums" style={{ color: C.text }}>{t('site.opt2_per_day', { value: f.money(budget) })}</span>
              <BudgetChip show={frame.approved} />
            </span>
            <span className="flex flex-col gap-[0.4em]">
              <span className="text-[1.15em]" style={{ color: C.text3 }}>{t('site.opt2_col_status')}</span>
              <span className="flex items-start gap-[0.5em]">
                {!frame.approved && <span className="mt-[0.1em] grid size-[1.5em] shrink-0 place-items-center rounded-full text-white" style={{ background: C.amber }}><span className="text-[0.95em] font-bold">!{/* i18n-ignore: semn */}</span></span>}
                <span className="text-[1.3em] leading-snug" style={{ color: C.text }}>{frame.approved ? t('site.opt2_status_eligible') : t('site.opt2_status_limited')}</span>
              </span>
            </span>
          </div>
        </div>
      </div>
    )
  }
  const terms = frame.view === 'terms'
  return (
    <div className="px-[1.6em]">
      <div className={cn(TABLE_FONT, 'overflow-hidden rounded-[0.8em] border bg-white')} style={{ borderColor: C.line }}>
        <div className="flex h-[3.6em] items-center justify-between border-b px-[0.4em]" style={{ borderColor: C.line }}>
          <HeadCell>{t(terms ? 'site.opt2_col_term' : 'site.opt2_col_product')}</HeadCell>
          <HeadCell right>{t(terms ? 'site.opt2_col_added' : 'site.opt2_col_status')}</HeadCell>
        </div>
        {terms
          ? TERMS.map((term, i) => {
            const drop = !!term.drop
            const done = drop && frame.done
            return (
              <MobileRow key={term.id} name={term.id === 'brand' ? BRAND_TERM : t(`site.opt2_term_${term.id}`)}
                status={done ? t('site.opt2_excluded') : t('site.opt2_none')}
                meta={`${t('site.opt2_col_cost')} ${f.money(term.cost)} · ${t('site.opt2_col_conv')} ${f.round(term.conv)}`}
                selected={drop && i < frame.selected} done={done} gone={drop && frame.gone} />
            )
          })
          : PRODUCTS.map(p => {
            const drop = !!p.drop
            const done = drop && frame.done
            const order = p.id === 'sconce' ? 1 : p.id === 'bulbs' ? 2 : 0
            return (
              <MobileRow key={p.id} name={t(`site.opt2_prod_${p.id}`)} link
                status={done ? t('site.opt2_excluded') : t('site.opt2_eligible')}
                meta={`${t('site.opt2_col_cost')} ${f.money(p.cost)} · ${t('site.opt2_col_roas_short')} ${f.dec(roasOf(p.value, p.cost))}`}
                selected={drop && frame.selected >= order} done={done} gone={drop && frame.gone} />
            )
          })}
      </div>
    </div>
  )
}

function MobileWindow({ frame }: { frame: Frame }) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const snack = frame.snack === 'terms' ? t('site.opt2_snack_terms') : frame.snack === 'products' ? t('site.opt2_snack_products') : frame.snack === 'campaigns' ? t('site.opt2_snack_budget') : null
  return (
    <div className="relative overflow-hidden rounded-[2.4em] border border-black/10 bg-white shadow-[0_0.1em_0.2em_rgba(0,0,0,0.04),0_4em_8em_-4em_rgba(0,0,0,0.45)]">
      <div className="flex h-[5.4em] items-center gap-[1em] border-b border-[#e3e3e3] px-[1.2em] text-[#5f6368]">
        <span className="flex h-[3.6em] min-w-0 flex-1 items-center gap-[0.9em] rounded-full bg-[#f1f3f4] px-[1.3em]">
          <SlidersHorizontal className="size-[1.4em] shrink-0" />
          <span className="truncate text-[1.35em] text-[#1f1f1f]">ads.google.com{/* i18n-ignore: adresa */}</span>
        </span>
        <span className="rounded-full bg-black px-[0.8em] py-[0.35em] text-white" style={SITE_FONT}>
          <span className="block text-[1em] font-semibold leading-none">{t('site.opt2_demo')}</span>
        </span>
      </div>
      <div className="relative h-[58em] overflow-hidden tracking-normal" style={{ background: C.page }}>
        <div className={cn(gsans.className, 'flex h-[5.6em] items-center gap-[1.2em] border-b bg-white px-[1.4em]')} style={{ borderColor: C.soft }}>
          <Menu className="size-[2.2em]" style={{ color: C.text2 }} />
          <AdsLogo className="h-[2.2em] w-auto" />
          <span className="text-[1.8em] text-[#444746]">Google Ads{/* i18n-ignore: nume de produs */}</span>
          <span className="ml-auto flex items-center gap-[1.4em]" style={{ color: C.text2 }}>
            <Bell className="size-[2em]" />
            <span className="grid size-[3em] place-items-center rounded-full bg-[#0b57d0] text-white"><span className="text-[1.4em] font-medium">M{/* i18n-ignore: inițiala contului */}</span></span>
          </span>
        </div>
        <div className={cn(gsans.className, 'px-[1.6em] pb-[1.2em] pt-[1.4em]' /* i18n-ignore */)}>
          <span className="text-[1.15em]" style={{ color: C.text3 }}>{`${ACCOUNT.name} · ${ACCOUNT.id}`}</span>
          <span className="mt-[0.3em] flex items-center gap-[0.6em]">
            <Dot color={C.green} /><span className="truncate text-[1.35em] font-medium" style={{ color: C.text }}>{CAMPAIGN_NAME}</span><ChevronDown className="size-[1.5em] shrink-0" style={{ color: C.text2 }} />
          </span>
          <div className="mt-[1em] flex items-center justify-between">
            <span className="text-[2em]" style={{ color: C.text }}>{t(PAGE_KEY[frame.view])}</span>
            <span className="flex items-center gap-[0.3em] rounded-[0.6em] border bg-white px-[0.8em] py-[0.4em]" style={{ borderColor: C.line, color: C.text2 }}>
              <span className="text-[1.15em]">{t('site.opt2_range')}</span><ChevronDown className="size-[1.3em]" />
            </span>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={frame.view} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.2 }}>
            <MobileView frame={frame} />
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {snack && (
            <motion.div key={snack} initial={reduce ? false : { opacity: 0, y: '1em' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className={cn(gsans.className, 'absolute inset-x-[1.6em] bottom-[1.6em] z-30 flex items-center justify-between gap-[1.6em] rounded-[0.5em] bg-[#303030] px-[1.4em] py-[1.1em]')}>
              <span className="truncate text-[1.3em] text-[#f2f2f2]">{snack}</span>
              <span className="text-[1.3em] font-medium text-[#a8c7fa]">{t('site.opt2_undo')}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Notice which={frame.notice} approved={frame.approved} mobile />
    </div>
  )
}

/** Contul Google Ads, cu pilotul la lucru, legat de progresul derulării. */
export function AdsSim({ progress }: { progress: MotionValue<number> }) {
  const { t } = useT()
  const [frame, setFrame] = useState<Frame>(() => frameAt(0))
  useMotionValueEvent(progress, 'change', p => {
    const next = frameAt(p)
    setFrame(f => (sameFrame(f, next) ? f : next))
  })
  return (
    <div className="@container w-full select-none">
      <div role="img" aria-label={t('site.opt2_label')}
        className="mx-auto w-[40em] max-w-full text-left [font-size:min(calc(100cqw/40),calc((100svh_-_210px)/64))] @min-[640px]:w-[112em] @min-[640px]:[font-size:min(calc(100cqw/112),calc((100svh_-_210px)/63))]">
        <div className="@min-[640px]:hidden"><MobileWindow frame={frame} /></div>
        <div className="hidden @min-[640px]:block"><DesktopWindow frame={frame} progress={progress} /></div>
      </div>
    </div>
  )
}

function StepBar({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const scaleX = useTransform(progress, [STEPS[index], STEPS[index + 1]], [0, 1])
  return (
    <span className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
      <motion.span style={{ scaleX, transformOrigin: '0% 50%' }} className="block h-full rounded-full bg-black" />
    </span>
  )
}

/** Cei trei pași, deasupra ferestrei, cu bara de progres. */
export function AdsSteps({ progress }: { progress: MotionValue<number> }) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  useMotionValueEvent(progress, 'change', p => setStep(stepAt(p)))
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3">
      <div className="flex w-full max-w-[220px] gap-1.5">
        {[0, 1, 2].map(i => <StepBar key={i} progress={progress} index={i} />)}
      </div>
      {/* Pe telefon, textul pasului poate ocupa două rânduri */}
      <div className="relative h-11 w-full sm:h-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={step} initial={reduce ? false : { opacity: 0, y: 6, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={reduce ? undefined : { opacity: 0, y: -6, filter: 'blur(4px)' }}
            transition={{ duration: 0.25 }} className="absolute inset-x-0 text-balance text-center text-[15px] font-medium leading-snug text-neutral-900 sm:text-base">
            <span className="mr-2 font-mono text-[13px] text-neutral-400">{`0${step + 1}`}</span>{t(`site.opt2_step_${step + 1}`)}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
