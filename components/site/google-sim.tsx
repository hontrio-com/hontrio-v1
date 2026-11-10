'use client'

import Image from 'next/image'
import { Google_Sans } from 'next/font/google'
import { useId, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronRight, EllipsisVertical, Grip, Keyboard, Menu, Mic, MousePointer2,
  Plus, RotateCw, Search, ShoppingBag, SlidersHorizontal, Star, Store, Truck, X,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

// =============================================
// Căutarea pe Google, ca în realitate: pagina Google, cineva scrie „lampă de
// birou", alege sugestia, se deschide pagina de rezultate, apar „Produse
// promovate" (anunțurile Google Shopping) și produsul tău e primul. Cursorul
// dă clic, vine comanda. Totul înaintează cu derularea (progress 0 → 1).
//
// Ce ține de Google e copiat după pagina reală (dimensiuni, culori, fonturi:
// Google Sans pentru interfață, Arial pentru rezultate). Ce ține de Hontrio
// (încadrarea produsului, cursorul, comanda, cardul cu ținta) e negru, cu
// fontul site-ului. Pozele de produs sunt generate (ElevenLabs · Seedream),
// datele sunt demonstrative. Totul e în `em`: pagina e desenată pentru o
// fereastră de 1100px (pe telefon, 400px) și se micșorează cu containerul.
// =============================================

const gsans = Google_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500'], display: 'swap' })
const SITE_FONT = { fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif' }

/** Momentele poveștii, pe progresul derulării (0 → 1). */
const T = {
  typeStart: 0.04, typeEnd: 0.26, select: 0.29, swap: 0.34,
  head: 0.37, cards: 0.4, cardGap: 0.022, cardDur: 0.05,
  mark: 0.62, cursor: 0.68, click: 0.8, order: 0.83,
}
const STEPS = [0, T.swap, T.mark, T.click, 1]
const stepAt = (p: number) => (p < T.swap ? 0 : p < T.mark ? 1 : p < T.click ? 2 : 3)

type Card = { img: string; ron: number; eur: number; oldRon?: number; oldEur?: number; ship?: [number, number]; rating?: [number, number] }
/** Primul e produsul tău; ceilalți, concurenții. */
const CARDS: Card[] = [
  { img: 'lamp-1', ron: 189, eur: 39, rating: [4.8, 37] },
  { img: 'lamp-2', ron: 199, eur: 41, oldRon: 229, oldEur: 47, ship: [19.99, 4.99], rating: [4.5, 91] },
  { img: 'lamp-5', ron: 174, eur: 36 },
  { img: 'lamp-3', ron: 219, eur: 45, oldRon: 249, oldEur: 52, ship: [14.99, 3.99], rating: [4.2, 14] },
  { img: 'lamp-10', ron: 259, eur: 54, rating: [4.6, 208] },
  { img: 'lamp-7', ron: 149, eur: 31, oldRon: 179, oldEur: 37, ship: [24.99, 5.99], rating: [3.9, 8] },
  { img: 'lamp-4', ron: 279, eur: 58, rating: [4.4, 52] },
]

type Frame = { typed: number; open: boolean; selected: boolean; results: boolean }
function frameAt(p: number, len: number): Frame {
  const k = Math.min(1, Math.max(0, (p - T.typeStart) / (T.typeEnd - T.typeStart)))
  const typed = Math.round(k * len)
  return { typed, open: typed >= 3 && p < T.swap, selected: p >= T.select && p < T.swap, results: p >= T.swap }
}
const same = (a: Frame, b: Frame) => a.typed === b.typed && a.open === b.open && a.selected === b.selected && a.results === b.results

function useFormats() {
  const { locale, intlLocale } = useT()
  const euro = locale !== 'ro'
  const fmt = new Intl.NumberFormat(intlLocale, { style: 'currency', currency: euro ? 'EUR' : 'RON', minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return { euro, money: (ron: number, eur: number) => fmt.format(euro ? eur : ron) }
}

// ─── Piese Google ────────────────────────────────────────────────────────────

/** Logo-ul Google, ca pe pagina de rezultate (viewBox 92×30). */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 92 30" className={className} aria-hidden>
      <path fill="#3186ff" d="M10.35 23.1c5.89.06 9.9-3.9 9.9-9.98q0-.75-.14-1.7h-9.8v2.93h6.87c-.36 3.83-3.06 5.82-6.76 5.82-4.15 0-7.33-3.12-7.33-7.66 0-4.47 3.03-7.6 7.33-7.6 2.16 0 3.76.67 5.35 2.3l2.05-2.14c-1.8-2.1-4.4-3.1-7.44-3.1-5.9 0-10.49 4.43-10.49 10.5 0 5.8 4.43 10.58 10.46 10.64" />
      <path fill="#fc413d" d="M29.33 23.1c4.41 0 7.6-3.23 7.6-7.72 0-4.4-3.12-7.67-7.6-7.67-4.23 0-7.57 3-7.57 7.67 0 4.45 3.15 7.73 7.57 7.73m0-2.68c-2.68 0-4.56-2.2-4.56-5.04s1.98-4.99 4.56-4.99c2.73 0 4.57 2.2 4.57 5 0 2.87-1.88 5.03-4.57 5.03" />
      <path fill="#ffbe00" d="M45.76 23.1c4.44 0 7.6-3.24 7.6-7.72 0-4.4-3.12-7.67-7.6-7.67-4.24 0-7.57 3-7.57 7.67 0 4.45 3.15 7.73 7.57 7.73m0-2.68c-2.68 0-4.56-2.2-4.56-5.04s1.98-4.99 4.56-4.99c2.73 0 4.57 2.2 4.57 5 0 2.87-1.88 5.03-4.57 5.03" />
      <path fill="#3186ff" d="M61.77 29.2q7.18 0 7.17-8.22V8.23h-2.93v1.8h-.06c-.92-1.43-2.66-2.23-4.62-2.23-4.24 0-6.82 3.23-6.82 7.54 0 4.3 2.51 7.46 6.93 7.46a5.5 5.5 0 0 0 4.47-2.26h.1v1.31c0 2.9-1.5 4.6-4.29 4.6-1.82 0-3.03-1-3.92-2.68l-2.66 1.17c1.4 2.96 3.4 4.26 6.63 4.26m0-9.2c-2.59 0-4.24-1.9-4.24-4.75 0-2.74 1.64-4.71 4.25-4.71s4.23 1.83 4.23 4.7c0 2.9-1.7 4.76-4.24 4.76" />
      <path fill="#00af57" d="M74.3 2.41h-3.08v20.23h3.08z" />
      <path fill="#fc413d" d="M83.4 23.08a7.4 7.4 0 0 0 6.34-3.52l-2.3-1.5a4.8 4.8 0 0 1-3.9 2.2 4.6 4.6 0 0 1-3.99-2.4l10.33-4.39a7 7 0 0 0-.28-1.07c-1.23-3.16-3.38-4.6-6.28-4.6-4.42 0-7.43 3.22-7.43 7.68 0 4.56 3.17 7.6 7.5 7.6m-4.51-7.61v-.17c0-2.93 1.68-4.9 4.32-4.9 1.26 0 2.39.57 3.15 1.9z" />
    </svg>
  )
}

/** Iconița Google Lens. */
function LensIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className={className} aria-hidden>
      <path d="M4 9V7a3 3 0 0 1 3-3h2M15 4h2a3 3 0 0 1 3 3v2M4 15v2a3 3 0 0 0 3 3h2" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="18" cy="18" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Iconița „Modul AI": lupa cu o steluță. */
function AiModeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} aria-hidden>
      <circle cx="10" cy="11" r="6" /><path d="m14.5 15.5 5 5" />
      <path d="M18 2.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SignIn() {
  const { t } = useT()
  return (
    <span className={cn(gsans.className, 'flex h-[4em] items-center rounded-full bg-[#0b57d0] px-[2.4em] text-white')}>
      <span className="text-[1.4em] font-medium">{t('site.gsim_signin')}</span>
    </span>
  )
}

function Caret({ className }: { className?: string }) {
  return <span className={cn('ml-[0.05em] inline-block h-[1.2em] w-[0.08em] shrink-0 bg-[#16171a] animate-[blink_1.05s_step-end_infinite] motion-reduce:animate-none', className)} />
}

/** O stea cu cinci colțuri (11×11), cu colțurile ușor rotunjite, ca la Google. */
const STAR = (() => {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 === 0 ? 5.1 : 2.15
    pts.push(`${(5.5 + r * Math.cos(a)).toFixed(2)} ${(5.85 + r * Math.sin(a)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
})()
const STAR_X = [0, 14.25, 28.5, 42.75, 57]

/** Stelele de recenzii, ca la Google: cinci stele, galbene cât nota și gri în rest. */
function Stars({ value }: { value: number }) {
  const id = useId()
  const row = (fill: string) => STAR_X.map(x => (
    <path key={x} d={STAR} transform={`translate(${x} 0)`} fill={fill} stroke={fill} strokeWidth={0.7} strokeLinejoin="round" />
  ))
  return (
    <svg viewBox="0 0 68 11" className="h-[1.1em] w-[6.8em] shrink-0" aria-hidden>
      <defs><clipPath id={id}><rect width={(value / 5) * 68} height="11" /></clipPath></defs>
      <g>{row('#dadce0')}</g>
      <g clipPath={`url(#${id})`}>{row('#fbbc04')}</g>
    </svg>
  )
}

/** Un card din „Produse promovate", la dimensiunile Google (130×304). */
function ProductCard({ card, index, progress }: { card: Card; index: number; progress: MotionValue<number> }) {
  const { t } = useT()
  const { money } = useFormats()
  const reduce = useReducedMotion()
  const start = T.cards + index * T.cardGap
  const opacity = useTransform(progress, [start, start + T.cardDur], [0, 1])
  const y = useTransform(progress, [start, start + T.cardDur], ['1.4em', '0em'])
  const press = useTransform(progress, [T.click, T.click + 0.012, T.click + 0.026], [1, 0.97, 1])
  const mine = index === 0
  const sale = card.oldRon !== undefined && card.oldEur !== undefined

  return (
    <motion.div style={{ opacity, y: reduce ? 0 : y, scale: mine ? press : 1 }}
      className="relative flex h-[30.4em] w-[13em] shrink-0 flex-col overflow-hidden rounded-[0.8em] border border-[#dadce0] bg-white pb-[0.6em]">
      <div className="relative h-[12.2em] w-full shrink-0 overflow-hidden bg-[#f4f4f4]">
        <Image src={`/site/shop/${card.img}.webp`} alt="" fill sizes="140px" className="object-cover" />
        {sale && (
          <span className="absolute left-[0.8em] top-[0.8em] rounded-[0.4em] bg-white px-[0.6em] py-[0.25em] shadow-[0_0.1em_0.2em_rgba(0,0,0,0.12)]">
            <span className="block text-[1.05em] font-bold uppercase leading-none tracking-[0.03em] text-[#16171a]">{t('site.gsim_sale')}</span>
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-[0.8em] pt-[0.9em]">
        <p className="line-clamp-2 text-[1.4em] leading-[1.571] text-[#1a0dab]">{t(`site.gsim_p${index}`)}</p>
        <p className="flex h-[2.2em] items-center gap-[0.4em] overflow-hidden whitespace-nowrap">
          <span className={cn('text-[1.4em] font-bold', sale ? 'text-[#146c2e]' : 'text-[#16171a]')}>{money(card.ron, card.eur)}</span>
          {sale && <span className="truncate text-[1.4em] text-[#656773] line-through">{money(card.oldRon!, card.oldEur!)}</span>}
        </p>
        <p className="flex h-[2.2em] items-center gap-[0.45em] overflow-hidden">
          <span className={cn('grid size-[1.8em] shrink-0 place-items-center rounded-full border', mine ? 'border-black bg-black text-white' : 'border-[#d2d2d2] bg-[#f1f3f4] text-[#80868b]' /* i18n-ignore */)}>
            <Store className="size-[1.1em]" strokeWidth={2.2} />
          </span>
          <span className="truncate text-[1.4em] text-[#16171a]">{mine ? t('site.gsim_your_store') : t('site.gsim_competitor', { n: index })}</span>
        </p>
        <p className="flex h-[2.2em] items-center gap-[0.4em] overflow-hidden whitespace-nowrap text-[#656773]">
          {card.ship
            ? <span className="truncate text-[1.4em]">{t('site.gsim_shipping', { price: money(card.ship[0], card.ship[1]) })}</span>
            : <><Truck className="size-[1.5em] shrink-0" strokeWidth={1.8} /><span className="text-[1.4em]">{t('site.gsim_free')}</span></>}
        </p>
        {card.rating
          ? <p className="flex h-[2.3em] items-center gap-[0.5em]"><Stars value={card.rating[0]} /><span className="text-[1.4em] text-[#656773]">({card.rating[1]})</span></p>
          : <p className="h-[2.3em]" />}
        <p className="truncate text-[1.4em] leading-[1.571] text-[#1a0dab]">{t('site.gsim_from')}</p>
      </div>
    </motion.div>
  )
}

/** Caseta de căutare de pe pagina Google, cu sugestiile sub ea. */
function HomeSearch({ frame, query, mobile = false }: { frame: Frame; query: string; mobile?: boolean }) {
  const { t } = useT()
  const typed = query.slice(0, frame.typed)
  const suggestions = [query, `${query} ${t('site.gsim_sugg_1')}`, `${query} ${t('site.gsim_sugg_2')}`, `${query} ${t('site.gsim_sugg_3')}`]
  return (
    <div className={cn('relative bg-white', frame.open
      ? 'rounded-t-[2.4em] shadow-[0_0.2em_0.8em_rgba(32,33,36,0.28)]'
      : cn('rounded-[2.4em] border border-[#dadce0]', frame.typed > 0 && 'border-transparent shadow-[0_0.1em_0.6em_rgba(32,33,36,0.28)]' /* i18n-ignore */))}>
      <div className={cn('flex items-center gap-[1.2em] px-[1.6em]', mobile ? 'h-[4.6em]' : 'h-[4.8em]')}>
        {mobile ? <Search className="size-[2em] shrink-0 text-[#9aa0a6]" /> : <Plus className="size-[2.2em] shrink-0 text-[#1f1f1f]" strokeWidth={1.8} />}
        <span className={cn(gsans.className, 'flex min-w-0 flex-1 items-center overflow-hidden whitespace-pre text-[1.6em] text-[#16171a]')}>
          {typed}<Caret />
        </span>
        {!mobile && <Keyboard className="size-[2.2em] shrink-0 text-[#1f1f1f]" strokeWidth={1.7} />}
        <Mic className="size-[2.2em] shrink-0 text-[#1f1f1f]" strokeWidth={1.8} />
        <LensIcon className="size-[2.2em] shrink-0 text-[#1f1f1f]" />
        {!mobile && (
          <span className={cn(gsans.className, 'flex h-[3.6em] shrink-0 items-center gap-[0.6em] rounded-full bg-[#f1f3f4] px-[1.2em] text-[#1f1f1f]')}>
            <AiModeIcon className="size-[1.8em]" /><span className="text-[1.4em] font-medium">{t('site.gsim_ai_mode')}</span>
          </span>
        )}
      </div>
      {frame.open && (
        <div className="absolute inset-x-0 top-full z-10 rounded-b-[2.4em] bg-white pb-[1.2em] shadow-[0_0.4em_0.6em_rgba(32,33,36,0.28)]">
          <div className="mx-[1.6em] mb-[0.6em] border-t border-[#e8eaed]" />
          {suggestions.map((s, i) => (
            <div key={s} className={cn('flex h-[3.4em] items-center gap-[1.4em] px-[1.6em]', frame.selected && i === 0 && 'bg-[#f1f3f4]')}>
              <Search className="size-[1.8em] shrink-0 text-[#9aa0a6]" />
              <span className={cn(gsans.className, 'truncate text-[1.6em] text-[#16171a]' /* i18n-ignore */)}>
                {s.startsWith(typed) ? <>{typed}<b className="font-bold">{s.slice(typed.length)}</b></> : s}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Caseta de căutare de pe pagina de rezultate. */
function ResultsSearch({ query, mobile = false }: { query: string; mobile?: boolean }) {
  return (
    <div className="flex h-[4.8em] items-center rounded-full border border-[#dadce0] bg-white pl-[2.2em] pr-[1.4em] shadow-[0_0.3em_1em_rgba(31,31,31,0.08)]">
      <span className={cn(gsans.className, 'min-w-0 flex-1 truncate text-[1.6em] text-[#16171a]')}>{query}</span>
      <X className="size-[2.4em] shrink-0 text-[#70757a]" strokeWidth={1.8} />
      <span className="mx-[1.2em] h-[2.6em] w-px shrink-0 bg-[#dadce0]" />
      <span className="flex items-center gap-[1.6em]">
        {!mobile && <Keyboard className="size-[2.2em] text-[#1f1f1f]" strokeWidth={1.7} />}
        <Mic className="size-[2.2em] text-[#1f1f1f]" strokeWidth={1.8} />
        <LensIcon className="size-[2.2em] text-[#1f1f1f]" />
      </span>
    </div>
  )
}

function Tabs({ mobile = false }: { mobile?: boolean }) {
  const { t } = useT()
  const tabs = [
    t('site.gsim_ai_mode'), t('site.gsim_tab_all'), t('site.gsim_images'), t('site.gsim_tab_short'),
    t('site.gsim_tab_videos'), t('site.gsim_tab_news'), 'Web', // i18n-ignore: numele filei, la fel în toate limbile
  ]
  return (
    <div className={cn(gsans.className, 'flex items-start gap-[2.4em] whitespace-nowrap')}>
      {tabs.map((tab, i) => (
        <span key={i} className={cn('relative pb-[0.8em] text-[1.4em] font-medium', i === 1 ? 'text-[#16171a]' : 'text-[#70757a]')}>
          {tab}
          {i === 1 && <span className="absolute inset-x-0 bottom-0 h-[0.21em] rounded-t-full bg-[#16171a]" />}
        </span>
      ))}
      {!mobile && (
        <>
          <span className="flex items-center gap-[0.2em] text-[#70757a]"><span className="text-[1.4em] font-medium">{t('site.gsim_tab_more')}</span><ChevronDown className="size-[1.6em]" /></span>
          <span className="ml-[1.2em] flex items-center gap-[0.2em] text-[#70757a]"><span className="text-[1.4em] font-medium">{t('site.gsim_tools')}</span><ChevronDown className="size-[1.6em]" /></span>
        </>
      )}
    </div>
  )
}

function SponsoredHeader() {
  const { t } = useT()
  return (
    <div>
      <p className={cn(gsans.className, 'text-[2em] leading-[1.3] text-[#202124]' /* i18n-ignore */)}>{t('site.gsim_sponsored')}</p>
      <div className="mt-[1.1em] h-px bg-[#dadce0]" />
      <div className="mt-[1.3em] flex items-center gap-[1.2em]">
        <span className="grid size-[2.6em] shrink-0 place-items-center rounded-full bg-[#f1f3f4]"><ShoppingBag className="size-[1.4em] text-[#5f6368]" strokeWidth={2} /></span>
        <div className="min-w-0">
          <p className={cn(gsans.className, 'text-[1.4em] leading-[1.2] text-[#16171a]' /* i18n-ignore */)}>{t('site.gsim_promoted')}</p>
          <p className="flex items-center gap-[0.4em] text-[#4e5059]"><span className="truncate text-[1.2em] leading-[1.35]">{t('site.gsim_promoted_sub')}</span><EllipsisVertical className="size-[1.4em] shrink-0" /></p>
        </div>
      </div>
    </div>
  )
}

// ─── Ce adaugă Hontrio peste pagină ──────────────────────────────────────────

/** Conturul negru în jurul produsului tău (apare la pasul 3). */
function YourRing({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [T.mark, T.mark + 0.035], [0, 1])
  const scale = useTransform(progress, [T.mark, T.mark + 0.035], [1.06, 1])
  return <motion.div style={{ opacity, scale }} className="pointer-events-none absolute -left-[0.6em] -top-[0.6em] z-10 h-[31.6em] w-[14.2em] rounded-[1.3em] border-[0.22em] border-black" />
}

/** Cursorul care vine dinspre căutare și dă clic pe produsul tău. */
function Pointer({ progress, from, to }: { progress: MotionValue<number>; from: [string, string]; to: [string, string] }) {
  const reduce = useReducedMotion()
  const left = useTransform(progress, [T.cursor, T.click], [from[0], to[0]])
  const top = useTransform(progress, [T.cursor, T.click], [from[1], to[1]])
  const opacity = useTransform(progress, [T.cursor - 0.01, T.cursor + 0.02], [0, 1])
  const scale = useTransform(progress, [T.click, T.click + 0.012, T.click + 0.026], [1, 0.75, 1])
  if (reduce) return null
  return (
    <motion.span style={{ left, top, opacity, scale }} className="pointer-events-none absolute z-40 block">
      <MousePointer2 className="size-[2.6em] fill-black text-white drop-shadow-[0_0.3em_0.6em_rgba(0,0,0,0.35)]" strokeWidth={1.3} />
    </motion.span>
  )
}

/** Fontul sistemului (San Francisco pe Mac și iPhone), ca o notificare adevărată. */
const SYSTEM_FONT = { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }

/**
 * După clic, vine comanda: o notificare de la Hontrio, ca cele de pe Mac (în colțul
 * ferestrei, intră din dreapta) sau de pe iPhone (sus, coboară).
 */
function OrderNotice({ progress, mobile = false }: { progress: MotionValue<number>; mobile?: boolean }) {
  const { t } = useT()
  const { money } = useFormats()
  const reduce = useReducedMotion()
  const opacity = useTransform(progress, [T.order, T.order + 0.025], [0, 1])
  const slide = useTransform(progress, [T.order, T.order + 0.035], mobile ? ['-130%', '0%'] : ['115%', '0%'])
  const style = reduce ? { opacity } : mobile ? { opacity, y: slide } : { opacity, x: slide }
  return (
    <motion.div style={{ ...style, ...SYSTEM_FONT }}
      className={cn('pointer-events-none absolute z-50 flex items-center border border-black/[0.06] bg-[#f6f6f6]/90 shadow-[0_1.2em_3em_-0.8em_rgba(0,0,0,0.35),0_0_0_0.05em_rgba(0,0,0,0.04)] backdrop-blur-2xl',
        mobile ? 'inset-x-[0.8em] top-[0.8em] gap-[1.1em] rounded-[2.2em] p-[1.2em]' : 'right-[1.2em] top-[1.2em] w-[36em] gap-[1.1em] rounded-[1.7em] p-[1.2em]' /* i18n-ignore */)}>
      <span className={cn('grid shrink-0 place-items-center border border-black/[0.06] bg-white shadow-[0_0.1em_0.3em_rgba(0,0,0,0.12)]', mobile ? 'size-[4em] rounded-[0.95em]' : 'size-[3.8em] rounded-[0.85em]')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="" className="h-[52%] w-auto" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-[1em]">
          <span className="truncate text-[1.3em] font-semibold text-[#1d1d1f]">{t('site.gsim_notif_title', { price: money(CARDS[0].ron, CARDS[0].eur) })}</span>
          <span className="shrink-0 text-[1.1em] text-[#8e8e93]">{t('site.gsim_notif_time')}</span>
        </span>
        <span className="block truncate text-[1.25em] text-[#3a3a3c]">{t('site.gsim_notif_body', { product: t('site.gsim_p0') })}</span>
      </span>
    </motion.div>
  )
}

// ─── Fereastra ───────────────────────────────────────────────────────────────

function DesktopWindow({ frame, progress, query }: { frame: Frame; progress: MotionValue<number>; query: string }) {
  const { t } = useT()
  const homeOpacity = useTransform(progress, [T.swap - 0.02, T.swap + 0.02], [1, 0])
  const resultsOpacity = useTransform(progress, [T.swap - 0.02, T.swap + 0.02], [0, 1])
  const headOpacity = useTransform(progress, [T.head, T.head + 0.04], [0, 1])
  const url = frame.results ? `google.com/search?q=${query.replace(/ /g, '+')}` : 'google.com'

  return (
    <div className="relative overflow-hidden rounded-[1.2em] border border-black/10 bg-white shadow-[0_0.1em_0.2em_rgba(0,0,0,0.04),0_5em_10em_-5em_rgba(0,0,0,0.45)]">
      {/* Browserul */}
      <div className="flex h-[3.8em] items-end gap-[1.2em] bg-[#dfe3e8] pl-[1.4em] pr-[1.2em]">
        <span className="mb-[1.35em] flex gap-[0.7em]">{[0, 1, 2].map(i => <span key={i} className="size-[1.1em] rounded-full bg-black/15" />)}</span>
        <span className="flex h-[3.1em] w-[25em] items-center gap-[0.8em] rounded-t-[0.9em] bg-white px-[1.2em]">
          <svg viewBox="0 0 24 24" className="size-[1.5em] shrink-0" aria-hidden>
            <path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3" />
            <path fill="#34a853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22" />
            <path fill="#fbbc04" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" />
            <path fill="#ea4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1" />
          </svg>
          <span className="min-w-0 flex-1 truncate text-[1.2em] text-[#1f1f1f]">
            {frame.results ? t('site.gsim_tab_results', { query }) : 'Google'}{/* i18n-ignore: titlul paginii Google */}
          </span>
          <X className="size-[1.3em] shrink-0 text-[#5f6368]" />
        </span>
        <span className="mb-[0.9em] ml-auto rounded-full bg-black px-[0.9em] py-[0.35em] text-white" style={SITE_FONT}>
          <span className="block text-[1.05em] font-semibold leading-none">{t('site.gsim_demo')}</span>
        </span>
      </div>
      <div className="flex h-[4.6em] items-center gap-[1.6em] border-b border-[#e3e3e3] px-[1.6em] text-[#5f6368]">
        <ArrowLeft className="size-[1.7em]" /><ArrowRight className="size-[1.7em] opacity-40" /><RotateCw className="size-[1.5em]" />
        <span className="flex h-[3.3em] min-w-0 flex-1 items-center gap-[1em] rounded-full bg-[#f1f3f4] px-[1.4em]">
          <SlidersHorizontal className="size-[1.4em] shrink-0" />
          <span className="truncate text-[1.35em] text-[#1f1f1f]">{url}</span>
        </span>
        <Star className="size-[1.6em]" />
      </div>

      {/* Pagina */}
      <div className="relative h-[55em] overflow-hidden bg-white font-[family-name:Arial,Helvetica,sans-serif] tracking-normal text-[#16171a]">
        {/* Pagina principală Google */}
        <motion.div style={{ opacity: homeOpacity }} className="absolute inset-0">
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-[2em] pt-[1.4em]">
            <span className="flex gap-[1.6em] text-[#1f1f1f]"><span className="text-[1.3em]">{t('site.gsim_about')}</span><span className="text-[1.3em]">Google Store</span>{/* i18n-ignore: nume de produs */}</span>
            <span className="flex items-center gap-[1.6em] text-[#1f1f1f]">
              <span className="text-[1.3em]">Gmail</span>{/* i18n-ignore: nume de produs */}
              <span className="text-[1.3em]">{t('site.gsim_images')}</span>
              <Grip className="size-[2.4em] text-[#5f6368]" />
              <SignIn />
            </span>
          </div>
          <GoogleLogo className="absolute left-1/2 top-[10.4em] h-[9.2em] w-[27.2em] -translate-x-1/2" />
          <div className="absolute left-1/2 top-[22.4em] z-10 w-[58.4em] -translate-x-1/2"><HomeSearch frame={frame} query={query} /></div>
          <div className={cn(gsans.className, 'absolute left-1/2 top-[30.6em] flex -translate-x-1/2 gap-[1.2em] text-[#3c4043]')}>
            <span className="flex h-[3.6em] items-center rounded-[0.8em] bg-[#f8f9fa] px-[1.6em]"><span className="text-[1.4em]">{t('site.gsim_btn_search')}</span></span>
            <span className="flex h-[3.6em] items-center rounded-[0.8em] bg-[#f8f9fa] px-[1.6em]"><span className="text-[1.4em]">{t('site.gsim_btn_lucky')}</span></span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-[#f2f2f2] text-[#70757a]">
            <p className="border-b border-[#dadce0] px-[3em] py-[1.4em]"><span className="text-[1.4em]">{t('site.gsim_country')}</span></p>
            <div className="flex justify-between px-[3em] py-[1.4em]">
              <span className="flex gap-[2.6em]"><span className="text-[1.3em]">{t('site.gsim_footer_ads')}</span><span className="text-[1.3em]">{t('site.gsim_footer_business')}</span><span className="text-[1.3em]">{t('site.gsim_footer_how')}</span></span>
              <span className="flex gap-[2.6em]"><span className="text-[1.3em]">{t('site.gsim_footer_privacy')}</span><span className="text-[1.3em]">{t('site.gsim_footer_terms')}</span><span className="text-[1.3em]">{t('site.gsim_footer_settings')}</span></span>
            </div>
          </div>
        </motion.div>

        {/* Pagina de rezultate */}
        <motion.div style={{ opacity: resultsOpacity }} className="absolute inset-0">
          <GoogleLogo className="absolute left-[2.8em] top-[2.7em] h-[3em] w-[9.2em]" />
          <div className="absolute left-[16.8em] top-[1.8em] w-[69em]"><ResultsSearch query={query} /></div>
          <span className="absolute right-[2em] top-[2.2em] flex items-center gap-[1.6em]"><Grip className="size-[2.4em] text-[#5f6368]" /><SignIn /></span>
          <div className="absolute left-[18.6em] top-[8.6em]"><Tabs /></div>
          <div className="absolute inset-x-0 top-[11.5em] h-px bg-[#ebebeb]" />

          <motion.div style={{ opacity: headOpacity }} className="absolute left-[18.6em] top-[13.6em] w-[86.6em]"><SponsoredHeader /></motion.div>

          <div className="absolute left-[18.6em] top-[23.6em] w-[86.6em]">
            <div className="flex gap-[0.8em] overflow-hidden">
              {CARDS.map((c, i) => <ProductCard key={c.img} card={c} index={i} progress={progress} />)}
            </div>
            <motion.span style={{ opacity: headOpacity }} className="absolute right-[-1.6em] top-[4.1em] grid size-[4em] place-items-center rounded-full bg-white shadow-[0_0.1em_0.3em_rgba(60,64,67,0.3),0_0.4em_0.8em_0.3em_rgba(60,64,67,0.15)]">
              <ChevronRight className="size-[2.2em] text-[#1f1f1f]" />
            </motion.span>
            <YourRing progress={progress} />
          </div>

          <Pointer progress={progress} from={['64em', '4em']} to={['24.6em', '30.4em']} />
        </motion.div>
      </div>
      <OrderNotice progress={progress} />
    </div>
  )
}

function MobileWindow({ frame, progress, query }: { frame: Frame; progress: MotionValue<number>; query: string }) {
  const { t } = useT()
  const homeOpacity = useTransform(progress, [T.swap - 0.02, T.swap + 0.02], [1, 0])
  const resultsOpacity = useTransform(progress, [T.swap - 0.02, T.swap + 0.02], [0, 1])
  const headOpacity = useTransform(progress, [T.head, T.head + 0.04], [0, 1])
  const url = frame.results ? `google.com/search?q=${query.replace(/ /g, '+')}` : 'google.com'

  return (
    <div className="relative overflow-hidden rounded-[2.4em] border border-black/10 bg-white shadow-[0_0.1em_0.2em_rgba(0,0,0,0.04),0_4em_8em_-4em_rgba(0,0,0,0.45)]">
      <div className="flex h-[5.4em] items-center gap-[1em] border-b border-[#e3e3e3] px-[1.2em] text-[#5f6368]">
        <span className="flex h-[3.6em] min-w-0 flex-1 items-center gap-[0.9em] rounded-full bg-[#f1f3f4] px-[1.3em]">
          <SlidersHorizontal className="size-[1.4em] shrink-0" />
          <span className="truncate text-[1.35em] text-[#1f1f1f]">{url}</span>
        </span>
        <span className="rounded-full bg-black px-[0.8em] py-[0.35em] text-white" style={SITE_FONT}>
          <span className="block text-[1em] font-semibold leading-none">{t('site.gsim_demo')}</span>
        </span>
      </div>

      <div className="relative h-[59.4em] overflow-hidden bg-white font-[family-name:Arial,Helvetica,sans-serif] tracking-normal text-[#16171a]">
        <motion.div style={{ opacity: homeOpacity }} className="absolute inset-0">
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-[1.4em] pt-[1.2em]">
            <Menu className="size-[2.2em] text-[#5f6368]" />
            <span className="flex items-center gap-[1.2em]"><Grip className="size-[2.2em] text-[#5f6368]" /><SignIn /></span>
          </div>
          <GoogleLogo className="absolute left-1/2 top-[11em] h-[5.4em] w-[16.6em] -translate-x-1/2" />
          <div className="absolute inset-x-[1.6em] top-[19.6em] z-10"><HomeSearch frame={frame} query={query} mobile /></div>
        </motion.div>

        <motion.div style={{ opacity: resultsOpacity }} className="absolute inset-0">
          <div className="absolute inset-x-0 top-0 flex h-[5.4em] items-center justify-between px-[1.4em]">
            <Menu className="size-[2.2em] text-[#5f6368]" />
            <GoogleLogo className="h-[2.6em] w-[8em]" />
            <SignIn />
          </div>
          <div className="absolute inset-x-[1.6em] top-[5.8em]"><ResultsSearch query={query} mobile /></div>
          <div className="absolute left-[1.6em] top-[12.2em] w-[60em]"><Tabs mobile /></div>
          <div className="absolute inset-x-0 top-[15em] h-px bg-[#ebebeb]" />

          <motion.div style={{ opacity: headOpacity }} className="absolute inset-x-[1.6em] top-[16.8em]"><SponsoredHeader /></motion.div>

          <div className="absolute left-[1.6em] top-[26.8em] w-[60em]">
            <div className="flex gap-[0.8em]">
              {CARDS.slice(0, 3).map((c, i) => <ProductCard key={c.img} card={c} index={i} progress={progress} />)}
            </div>
            <YourRing progress={progress} />
          </div>

          <Pointer progress={progress} from={['30em', '7em']} to={['8.4em', '33.6em']} />
        </motion.div>
      </div>
      <OrderNotice progress={progress} mobile />
    </div>
  )
}

/** Căutarea Google, legată de progresul derulării. */
export function GoogleSim({ progress }: { progress: MotionValue<number> }) {
  const { t } = useT()
  const query = t('site.gsim_query')
  const [frame, setFrame] = useState<Frame>(() => frameAt(0, query.length))
  useMotionValueEvent(progress, 'change', p => {
    const next = frameAt(p, query.length)
    setFrame(f => (same(f, next) ? f : next))
  })

  return (
    <div className="@container w-full select-none">
      <div role="img" aria-label={t('site.gsim_label')}
        className="mx-auto w-[40em] max-w-full text-left [font-size:min(calc(100cqw/40),calc((100svh_-_200px)/66))] @min-[640px]:w-[110em] @min-[640px]:[font-size:min(calc(100cqw/110),calc((100svh_-_200px)/63.8))]">
        <div className="@min-[640px]:hidden"><MobileWindow frame={frame} progress={progress} query={query} /></div>
        <div className="hidden @min-[640px]:block"><DesktopWindow frame={frame} progress={progress} query={query} /></div>
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

/** Cei patru pași ai poveștii, deasupra ferestrei, cu bara de progres. */
export function SimSteps({ progress }: { progress: MotionValue<number> }) {
  const { t } = useT()
  const [step, setStep] = useState(0)
  useMotionValueEvent(progress, 'change', p => setStep(stepAt(p)))
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3">
      <div className="flex w-full max-w-[280px] gap-1.5">
        {[0, 1, 2, 3].map(i => <StepBar key={i} progress={progress} index={i} />)}
      </div>
      <div className="relative h-6 w-full">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={step} initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
            transition={{ duration: 0.25 }} className="absolute inset-x-0 text-center text-[15px] font-medium text-neutral-900 sm:text-base">
            <span className="mr-2 font-mono text-[13px] text-neutral-400">{`0${step + 1}`}</span>{t(`site.gsim_step_${step + 1}`)}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
