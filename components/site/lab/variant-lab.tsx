'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SiteHeader } from '../header'
import { Hero } from '../hero'
import { HeaderBar, HeaderIsland, HeaderMega } from './headers'
import { HeroShop } from './hero-shop'
import { HeroSearch } from './hero-search'
import { HeroLive } from './hero-live'
import { HeroRotate } from './hero-rotate'

// =============================================
// Pagina de variante (/variante): pagina principală întreagă, cu antetul și
// începutul alese dintr-un panou de jos (sau din taste: A–D și 1–5). Alegerea
// stă în adresă (?header=B&hero=3), ca s-o poți trimite. Pagina e temporară:
// după alegere, varianta câștigătoare intră în pagina principală, iar restul
// se șterge.
// =============================================

// i18n-ignore-start (pagină de lucru, temporară: numele variantelor nu se traduc)
const HEADERS = [
  { id: 'A', name: 'Capsulă de sticlă' },
  { id: 'B', name: 'Bară cu anunț' },
  { id: 'C', name: 'Insulă neagră' },
  { id: 'D', name: 'Meniu extins' },
] as const
const HEROES = [
  { id: '1', name: 'Comutator' },
  { id: '2', name: 'Produs în Google Shopping' },
  { id: '3', name: 'Căutare pe Google' },
  { id: '4', name: 'Profit live' },
  { id: '5', name: 'Categorii care se schimbă' },
] as const
// i18n-ignore-end

function HeaderVariant({ id }: { id: string }) {
  switch (id) {
    case 'B': return <HeaderBar base="" />
    case 'C': return <HeaderIsland base="" />
    case 'D': return <HeaderMega base="" />
    default: return <SiteHeader base="" />
  }
}

function HeroVariant({ id }: { id: string }) {
  switch (id) {
    case '2': return <HeroShop />
    case '3': return <HeroSearch />
    case '4': return <HeroLive />
    case '5': return <HeroRotate />
    default: return <Hero />
  }
}

function Choice({ label, items, value, onPick }: {
  label: string; items: readonly { id: string; name: string }[]; value: string; onPick: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45 sm:w-auto">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-white/[0.07] p-1">
        {items.map(it => (
          <button key={it.id} type="button" role="radio" aria-checked={it.id === value} title={it.name} onClick={() => onPick(it.id)}
            className={cn('relative grid size-8 place-items-center rounded-full text-[13px] font-semibold transition-colors', it.id === value ? 'text-black' : 'text-white/65 hover:text-white')}>
            {it.id === value && <motion.span layoutId={`lab-${label}`} className="absolute inset-0 rounded-full bg-white" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
            <span className="relative">{it.id}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function VariantLab({ header, hero, children }: { header: string; hero: string; children: ReactNode }) {
  const [h, setH] = useState(() => HEADERS.some(x => x.id === header) ? header : 'A')
  const [v, setV] = useState(() => HEROES.some(x => x.id === hero) ? hero : '1')
  const [open, setOpen] = useState(true)

  const pickHero = (id: string) => {
    setV(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Alegerea stă în adresă, ca s-o poți trimite
  useEffect(() => {
    window.history.replaceState(null, '', `?header=${h}&hero=${v}`)
  }, [h, v])

  // Taste: A–D schimbă antetul, 1–5 începutul (nu cât scrii într-un câmp)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return // i18n-ignore
      const k = e.key.toUpperCase()
      if (HEADERS.some(x => x.id === k)) setH(k)
      else if (HEROES.some(x => x.id === k)) {
        setV(k)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const headerName = HEADERS.find(x => x.id === h)?.name
  const heroName = HEROES.find(x => x.id === v)?.name

  return (
    <>
      <HeaderVariant key={h} id={h} />
      <main>
        <HeroVariant key={v} id={v} />
        {children}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-3">
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.div key="panel" initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto relative w-full max-w-[600px] rounded-[1.4rem] bg-[#0a0a0a]/95 p-2.5 text-white shadow-[0_24px_60px_-18px_rgba(0,0,0,0.65)] ring-1 ring-white/10 backdrop-blur-xl">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Choice label="Antet" items={HEADERS} value={h} onPick={setH} />{/* i18n-ignore */}
                <Choice label="Început" items={HEROES} value={v} onPick={pickHero} />{/* i18n-ignore */}
                <button type="button" onClick={() => setOpen(false)} aria-label="Ascunde panoul" title="Ascunde panoul" // i18n-ignore
                  className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white sm:static">
                  <ChevronDown className="size-4" />
                </button>
              </div>
              <p className="mt-2 px-1 text-[12px] leading-relaxed text-white/55">
                <span className="font-semibold text-white">{h}</span> · {headerName}
                <span className="mx-2 text-white/25">+</span>
                <span className="font-semibold text-white">{v}</span> · {heroName}
                <span className="hidden text-white/35 sm:inline"> · taste A–D și 1–5</span>{/* i18n-ignore */}
              </p>
            </motion.div>
          ) : (
            <motion.button key="mini" type="button" onClick={() => setOpen(true)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#0a0a0a] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_18px_40px_-14px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
              <Layers className="size-4" />{h} · {v}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
