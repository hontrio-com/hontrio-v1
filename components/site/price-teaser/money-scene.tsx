'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { at, Floor, IsoFrame, isoStyles as iso, Logo, Plane, u } from '../iso/primitives'
import s from './price-teaser.module.css'

// =============================================
// Ilustrația variantei C („Unde merg banii”), în stilul celor din „Cum
// funcționează”: banii unei luni sunt teancuri de plăci, toate la aceeași
// scară (o placă = 5.000 de lei sau 1.000 €), deci înălțimile se compară
// cinstit. Vânzările stau în teancul magazinului; de acolo, liniile duc spre
// Google (reclamele) și spre Hontrio (taxa). Între Google și Hontrio nu e
// nicio linie: banii reclamelor nu trec prin Hontrio. Fără taxă (luna
// gratuită), locul Hontrio rămâne doar conturat.
// =============================================

/** Grosimea unei plăci (unități de desen). */
export const PLATE = 8

/**
 * Cât se ridică fața de sus pentru o grosime dată, ca teancul să stea pe podea: grosimea e
 * desenată în jos pe ecran (umbra plină din iso.module.css), fața urcă prin translateZ.
 * Planul e înclinat la 46° (ca în primitives.tsx), deci z = grosimea · √2 / tg 46°.
 */
const LIFT = Math.SQRT2 / Math.tan((46 * Math.PI) / 180)
const r2 = (n: number) => Math.round(n * 100) / 100

type StackProps = {
  spot: [number, number]
  w: number
  /** Grosimea teancului (unități), din sumă */
  height: number
  /** Câte plăci pot fi cel mult: același număr de straturi în orice exemplu, ca trecerea să fie lină */
  layers: number
  empty?: boolean
  children?: ReactNode
}

/** Un teanc de plăci care stă pe podea; crește și scade lin când se schimbă suma. */
function Stack({ spot: [x, y], w, height, layers, empty = false, children }: StackProps) {
  const offsets = Array.from({ length: layers }, (_, k) => r2(Math.min((k + 1) * PLATE, height)))
  const boxShadow = empty ? 'none' : offsets.flatMap(o => [
    `calc(${-o} * var(--u)) calc(${o} * var(--u)) 0 0 var(--side)`,
    `calc(${-o} * var(--u)) calc(${o} * var(--u)) 0 1px var(--rim)`,
  ]).join(', ')
  return (
    <div className={cn(iso.tile, s.grow)}
      style={{
        left: u(x - w / 2), top: u(y - w / 2), width: u(w), height: u(w), borderRadius: u(12),
        transform: `translateZ(${u(r2(height * LIFT))})`, boxShadow,
        ...(empty && { background: 'transparent', borderStyle: 'dashed', borderColor: 'rgba(255, 255, 255, 0.32)' }),
      } as CSSProperties}>
      {children}
    </div>
  )
}

/** Eticheta de pe fața unui teanc: semnul în colț, numele și suma jos. */
function Face({ icon, name, amount, big = false }: { icon: ReactNode; name: string; amount: string; big?: boolean }) {
  return (
    <>
      <span className="absolute grid place-items-center rounded-full border border-white/25 bg-white/[0.07] text-white/90"
        style={{ left: u(11), top: u(11), width: u(big ? 28 : 24), height: u(big ? 28 : 24) }}>
        {icon}
      </span>
      <span className="absolute flex flex-col whitespace-nowrap" style={{ left: u(11), bottom: u(big ? 12 : 10), gap: u(2) }}>
        <span className="leading-[1.2] text-white/55" style={{ fontSize: u(big ? 11 : 9.5) }}>{name}</span>
        <span className="font-semibold leading-[1.1] tracking-[-0.02em] text-white" style={{ fontSize: u(big ? 19 : 14.5) }}>{amount}</span>
      </span>
    </>
  )
}

/** Locurile teancurilor, pe ecran (față de mijlocul ramei). */
const STORE = { spot: at(-80, 44), w: 112 }
const GOOGLE = { spot: at(98, -40), w: 80 }
const HONTRIO = { spot: at(98, 92), w: 80 }
/** De unde vin cumpărătorii: din marginea din stânga, jos. */
const BUYERS = at(-200, 130)

export function MoneyScene({ label, salesName, sales, ads, fee, heights }: {
  label: string
  salesName: string
  sales: string
  ads: string
  fee: string
  /** Grosimile teancurilor (unități); taxa 0 = luna gratuită */
  heights: { sales: number; ads: number; fee: number }
}) {
  const free = heights.fee === 0
  return (
    <IsoFrame label={label}>
      <Plane dy={-12}>
        {/* O lumină slabă pe podea, sub magazin */}
        <div className="absolute rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.08),transparent)]"
          style={{ left: u(STORE.spot[0] - 160), top: u(STORE.spot[1] - 160), width: u(320), height: u(320) }} />
        {/* Banii curg: de la cumpărători în magazin, din magazin spre Google și spre Hontrio */}
        <Floor size={480}>
          <line x1={BUYERS[0]} y1={BUYERS[1]} x2={STORE.spot[0]} y2={STORE.spot[1]} stroke="rgba(255,255,255,0.3)" strokeWidth={1} className={iso.flow} />
          <line x1={STORE.spot[0]} y1={STORE.spot[1]} x2={GOOGLE.spot[0]} y2={GOOGLE.spot[1]} stroke="rgba(255,255,255,0.42)" strokeWidth={1} className={iso.flow} />
          <line x1={STORE.spot[0]} y1={STORE.spot[1]} x2={HONTRIO.spot[0]} y2={HONTRIO.spot[1]} stroke="rgba(255,255,255,0.42)" strokeWidth={1}
            className={cn(iso.flow, 'transition-opacity duration-500', free && 'opacity-30')} />
        </Floor>

        <Stack spot={GOOGLE.spot} w={GOOGLE.w} height={heights.ads} layers={2}>
          <Face icon={<Logo src="/site/logos/google-ads.svg" w={12} ratio={2442.4 / 2237} />} name="Google Ads" amount={ads} />
        </Stack>
        <Stack spot={HONTRIO.spot} w={HONTRIO.w} height={heights.fee} layers={1} empty={free}>
          <Face name="Hontrio" amount={fee} icon={
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo-icon.png" alt="" draggable={false} className="invert" style={{ width: u(11), height: u(11.9) }} />
          } />
        </Stack>
        <Stack spot={STORE.spot} w={STORE.w} height={heights.sales} layers={10}>
          <Face big icon={<Store strokeWidth={1.8} style={{ width: u(14), height: u(14) }} />} name={salesName} amount={sales} />
        </Stack>
      </Plane>
    </IsoFrame>
  )
}
