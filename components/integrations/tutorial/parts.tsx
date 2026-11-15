'use client'

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { animate, motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { VIEW, W } from './player'

// =============================================
// Piesele comune ale scenelor din ghid: pagina panoului la mărime reală, cadrele
// camerei, ținta cursorului (cu „hover" când ajunge acolo), textul tastat,
// ecranele care se schimbă și cardul Hontrio de la final, în care se lipesc
// datele copiate.
// =============================================

/** Fereastra în care e desenat panoul: 1280 px lățime, ca un laptop obișnuit. */
export const PAGE_W = 1280
/** Cât din pânză ocupă un pixel al panoului. */
export const UNIT = W / PAGE_W
/** Înălțimea ferestrei, în pixeli ai panoului. */
export const PAGE_H = Math.round(VIEW / UNIT)

/**
 * Panoul platformei, desenat la mărime reală (dimensiuni, fonturi și culori ca
 * în original) și micșorat pe pânză; camera se apropie de ce contează.
 * `height` > PAGE_H: pagina e mai lungă decât fereastra (camera coboară pe ea).
 */
export function Page({ height = PAGE_H, className, style, children }: { height?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div data-unit={UNIT} className={cn('absolute left-0 top-0 origin-top-left overflow-hidden', className)} style={{ width: PAGE_W, height, transform: `scale(${UNIT})`, ...style }}>
      {children}
    </div>
  )
}

/** Un cadru invizibil al camerei: zona din pagină pe care o încadrează (în pixeli ai panoului). */
export function Frame({ id, x, y, w, h }: { id: string; x: number; y: number; w: number; h: number }) {
  return <span aria-hidden data-t={id} className="pointer-events-none absolute" style={{ left: x, top: y, width: w, height: h }} />
}

/** Ținta cursorului: `data-t`, plus `data-hot` cât timp cursorul e (sau ajunge) pe ea. */
export const hit = (id: string, hot: string | undefined) => ({ 'data-t': id, 'data-hot': hot === id ? '' : undefined })

/** Clasele de „hover": se aprind când ajunge cursorul (drumul lui durează ~0,6 s). */
export const hover = 'transition-[background-color,color,box-shadow,border-color] duration-150 data-hot:delay-[520ms]'

/** Cât după începutul bătăii vine clicul (drumul cursorului + apăsarea), pentru efectele imediate. */
export const CLICK_AT = 0.7

/** Un ecran al scenei: toate stau în pagină (ca țintele să poată fi măsurate), se vede doar cel activ. */
export function Screen({ on, className, children }: { on: boolean; className?: string; children: ReactNode }) {
  return (
    <motion.div initial={false} animate={{ opacity: on ? 1 : 0 }} transition={{ duration: 0.22 }}
      className={cn('absolute inset-0', !on && 'pointer-events-none', className)}>
      {children}
    </motion.div>
  )
}

/** Text tastat literă cu literă cât e `typing`; gata scris după aceea. */
export function Typed({ text, typing, done, className }: { text: string; typing: boolean; done: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion() === true
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (!typing || reduced) {
      el.textContent = done || typing ? text : ''
      return
    }
    el.textContent = ''
    const run = animate(0, text.length, {
      duration: text.length * 0.075, delay: 0.15, ease: 'linear',
      onUpdate: v => { el.textContent = text.slice(0, Math.round(v)) },
    })
    return () => run.stop()
  }, [text, typing, done, reduced])
  // Conținutul îl scrie efectul (React nu pune nimic aici, ca să nu se certe pe text)
  return (
    <span className={cn('inline-flex items-center', className)}>
      <span ref={ref} />
      {typing && <span className="ml-px inline-block h-[1.05em] w-px animate-pulse bg-current" />}
    </span>
  )
}

/** O valoare lipită: apare cu o clipire scurtă a câmpului (`delay`: când clicul e în aceeași bătaie). */
function Pasted({ value, on, mono, delay = 0 }: { value: string; on: boolean; mono?: boolean; delay?: number }) {
  return (
    <motion.span initial={false} animate={{ backgroundColor: on ? ['#e9e9e9', '#ffffff'] : '#ffffff' }} transition={{ duration: 0.6, delay: on ? delay : 0 }}
      className="flex h-[25px] items-center overflow-hidden rounded-[7px] px-2 ring-1 ring-[#e3e3e3] transition-[box-shadow] duration-150 group-data-hot:ring-[#0a0a0a] group-data-hot:delay-[520ms]">
      <motion.span initial={false} animate={{ opacity: on ? 1 : 0 }} transition={{ duration: 0.15, delay: on ? delay : 0 }}
        className={cn('truncate text-[9.5px] text-neutral-900', mono && 'font-mono text-[9px] tracking-[-0.01em]')}>{value}</motion.span>
    </motion.span>
  )
}

/** `delay`: lipirea se vede imediat după clicul din aceeași bătaie (secunde de la începutul ei). */
export type CardField = { id: string; label: string; value: string; pasted: boolean; mono?: boolean; delay?: number }

/**
 * Cardul Hontrio de la finalul fiecărei scene: formularul de conectare, cu datele
 * lipite pe rând și butonul apăsat. Apare peste panoul platformei, ca o filă nouă.
 */
export function HontrioCard({ on, title, fields, hot, connected }: { on: boolean; title: string; fields: CardField[]; hot: string | undefined; connected: boolean }) {
  const { t } = useT()
  return (
    // Apare puțin după ce camera începe să se depărteze (altfel s-ar vedea mărit, pe jumătate transparent)
    <motion.div initial={false} animate={{ opacity: on ? 1 : 0 }} transition={{ duration: on ? 0.2 : 0.1, delay: on ? 0.3 : 0 }} className={cn('absolute inset-0 bg-black/25', !on && 'pointer-events-none')}>
      {/* transition: none, ca la camera din player: altfel tranziția globală pe transform întârzie arcul */}
      <motion.div initial={false} animate={on ? { y: 0, scale: 1 } : { y: 14, scale: 0.97 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }} style={{ transition: 'none' }}
        data-t="h-card" className="absolute left-[90px] top-[22px] w-[300px] rounded-[13px] bg-white p-[14px] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.5)] ring-1 ring-black/[0.06] [font-family:var(--font-geist-sans),system-ui,sans-serif]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-black.png" alt="" className="h-[10px] w-auto" />
        <p className="mt-2.5 text-[13px] font-bold leading-tight tracking-[-0.03em] text-neutral-950">{title}</p>
        <div className="mt-2.5 space-y-2">
          {fields.map(f => (
            <div key={f.id} {...hit(f.id, hot)} className="group">
              <span className="mb-1 block text-[8px] font-semibold tracking-[0.02em] text-neutral-500">{f.label}</span>
              <Pasted value={f.value} on={f.pasted} mono={f.mono} delay={f.delay} />
            </div>
          ))}
        </div>
        <span {...hit('h-connect', hot)} className={cn('mt-3 flex h-[27px] items-center justify-center gap-1 rounded-full bg-neutral-950 text-[10px] font-semibold text-white', hover, 'data-hot:bg-neutral-700')}>
          {connected ? <><Check className="size-3" strokeWidth={3} />{t('onboarding.connected_label')}</> : t('onboarding.connect_store')}
        </span>
      </motion.div>
    </motion.div>
  )
}
