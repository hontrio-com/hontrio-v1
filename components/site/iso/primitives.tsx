'use client'

import { useRef, type CSSProperties, type ReactNode } from 'react'
import { useInView } from 'framer-motion'
import { cn } from '@/lib/utils'
import s from './iso.module.css'

// =============================================
// Piesele ilustrațiilor izometrice: rama (se micșorează cu coloana și pornește
// animațiile doar cât e pe ecran), planul culcat și plăcile de pe el. Toate
// măsurile sunt în unități de desen (u): rama are 380 × 340, deci pe calculator
// 1u ≈ 1px. Pozițiile plăcilor sunt față de mijlocul planului: x merge spre
// dreapta-sus, y spre dreapta-jos, z în sus.
// =============================================

export { s as isoStyles }

/** O măsură în unități de desen. */
export const u = (n: number) => `calc(${n} * var(--u))`

/**
 * Întârzierea animației unei plăci (secunde). Negativă: animația pornește din mijlocul ciclului,
 * deci toate merg din prima clipă, fiecare în faza ei, fără să aștepte.
 */
export const delay = (seconds: number) => ({ '--delay': `${Math.round(seconds * 100) / 100}s` }) as CSSProperties

/**
 * Înclinarea planului (rotateX din iso.module.css): 46°, ca în ilustrațiile de pe opteo.com
 * (laturile plăcilor urcă la ~35°). Din ea: cât din x și y se vede pe orizontală și pe verticală.
 */
const TILT = (46 * Math.PI) / 180
const KX = Math.SQRT1_2
const KY = Math.SQRT1_2 * Math.cos(TILT)

/** Punctul de pe plan care se vede la (sx, sy) față de mijlocul ramei: așezarea se gândește pe ecran. */
export function at(sx: number, sy: number): [number, number] {
  const a = sx / KX
  const b = sy / KY
  return [(a - b) / 2, (a + b) / 2]
}

/** Rama unei ilustrații: o imagine pentru cititorul de ecran, cu animații doar cât se vede. */
export function IsoFrame({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  return (
    <div ref={ref} role="img" aria-label={label} data-play={inView ? '' : undefined} className={s.frame}>
      <div aria-hidden className={s.scene}>{children}</div>
    </div>
  )
}

/**
 * Planul culcat. E doar un punct (mijlocul ramei), ca să nu ocupe loc în pagină: totul se
 * așază față de el. `dy` îl coboară pe ecran (plăcile ridicate urcă desenul).
 */
export function Plane({ dy = 0, children }: { dy?: number; children: ReactNode }) {
  return (
    <div className={s.plane} style={{ '--dy': u(dy) } as CSSProperties}>
      {children}
    </div>
  )
}

/** Liniile de pe podea: un SVG de `size` × `size`, cu (0, 0) în mijlocul planului. */
export function Floor({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg className={s.floor} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} fill="none"
      style={{ left: u(-size / 2), top: u(-size / 2), width: u(size), height: u(size) }}>
      {children}
    </svg>
  )
}

type TileProps = {
  /** Mijlocul plăcii pe plan */
  x: number; y: number
  /** Lățimea (pe x) și adâncimea (pe y); fără `d`, placa e pătrată */
  w: number; d?: number
  /** Înălțimea feței de sus și grosimea unui strat */
  z?: number; t?: number
  /** Câte straturi are grosimea (ca un teanc) */
  plates?: 1 | 2 | 3
  radius?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/** O placă pe plan. Grosimea se desenează sub fața de sus, deci `z` e înălțimea feței. */
export function Tile({ x, y, w, d = w, z = 0, t = 5, plates = 1, radius, className, style, children }: TileProps) {
  return (
    <div
      className={cn(s.tile, plates === 2 && s.plates2, plates === 3 && s.plates3, className)}
      style={{
        left: u(x - w / 2), top: u(y - d / 2), width: u(w), height: u(d),
        transform: `translateZ(${u(z)})`, '--t': u(t),
        ...(radius !== undefined && { borderRadius: u(radius) }),
        ...style,
      } as CSSProperties}>
      {children}
    </div>
  )
}

/**
 * Filtrele pentru logo-uri, puse o singură dată în pagină: din logo-ul colorat rămâne
 * doar forma, albă, iar albul din el (litera „S" din Shopify, „Woo") devine gol, ca la
 * logo-urile monocrome oficiale. `iso-white-light` păstrează invers, doar albul (coșul
 * OpenCart, alb pe un cerc albastru). Luminozitatea (Rec. 709) devine transparență.
 */
export function IsoFilters() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id="iso-white" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -1.7008 -5.7216 -0.5776 0 7.44" />
        <feComposite in2="SourceAlpha" operator="in" />
      </filter>
      <filter id="iso-white-light" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.7008 5.7216 0.5776 0 -6.8" />
        <feComposite in2="SourceAlpha" operator="in" />
      </filter>
    </svg>
  )
}

/** Logo-urile se sting puțin spre față (din alb spre gri), ca pe opteo.com. */
const SHEEN = 'linear-gradient(225deg, #000 30%, rgba(0, 0, 0, 0.6))'

/** Un logo alb, culcat pe placă. `crop`: cât din lățimea imaginii se vede (de la stânga), pentru simbolul dintr-un logo cu nume. */
export function Logo({ src, w, ratio, light = false, crop = 1 }: { src: string; w: number; ratio: number; light?: boolean; crop?: number }) {
  const h = w / (ratio * crop)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" draggable={false} decoding="async"
      style={{
        width: u(w), height: u(h), objectFit: crop < 1 ? 'cover' : 'contain', objectPosition: 'left center',
        filter: `url(#${light ? 'iso-white-light' : 'iso-white'})`, maskImage: SHEEN, WebkitMaskImage: SHEEN,
      }} />
  )
}
