'use client'

import Image from 'next/image'
import { Check, Tag } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { at, delay, IsoFrame, isoStyles as s, Logo, Plane, Tile, u } from './primitives'

// =============================================
// Despre · Merchant Center: produsele magazinului pe o placă mare, fiecare cu
// starea lui (aprobat sau, la problema găsită de Google, un semn de exclamare).
// Produsele se ridică pe rând, ca la o citire. Deasupra plutește sursa de date
// separată „Hontrio”, unde Hontrio pune doar etichete. Pozele sunt cele din
// căutarea de pe prima pagină, întoarse în negativ. Trebuie să rămână adevărat
// față de textul site.gdata_merchant.
// =============================================

/** O citire a tuturor produselor și pasul dintre două produse, în secunde (ciclul `check`). */
const CYCLE = 7
const STEP = 0.85

const BASE = { w: 236, d: 200, z: 8 }
const CARD = 50
/** Produsele: trei coloane (x) și două rânduri (y), față de mijlocul plăcii. */
const COLS = [-66, 0, 66]
const LINES = [4, 62]
const PRODUCTS = ['lamp-2', 'lamp-5', 'lamp-10', 'lamp-3', 'lamp-1', 'lamp-7']
/** Produsul cu o problemă găsită de Google (al cincilea). */
const ISSUE = 4
/** Sursa „Hontrio”: plutește deasupra colțului din spate. */
const SOURCE = at(96, -86)

export function IsoMerchant({ label }: { label: string }) {
  const { t } = useT()
  return (
    <IsoFrame label={label}>
      <Plane dy={14}>
        <div className="absolute rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.07),transparent)]"
          style={{ left: u(-190), top: u(-190), width: u(380), height: u(380) }} />

        <Tile x={0} y={0} w={BASE.w} d={BASE.d} z={BASE.z} t={5} plates={2} radius={16}>
          <div className="absolute flex flex-col whitespace-nowrap" style={{ left: u(18), top: u(15), gap: u(4) }}>
            <span className="flex items-center text-white/50" style={{ gap: u(6), fontSize: u(11.5) }}>
              <Logo src="/site/logos/google-merchant-center.svg" w={12} ratio={1} />
              Merchant Center{/* i18n-ignore */}
            </span>
            <span className="font-semibold tracking-[-0.02em] text-white" style={{ fontSize: u(18), lineHeight: 1.1 }}>{t('site.about_iso_products')}</span>
          </div>
        </Tile>

        {PRODUCTS.map((p, i) => {
          const x = COLS[i % 3]
          const y = LINES[Math.floor(i / 3)]
          const issue = i === ISSUE
          return (
            <Tile key={p} x={x} y={y} w={CARD} z={BASE.z + 4} t={4} radius={9}
              className={cn(s.check, 'overflow-hidden', issue && 'opacity-45')} style={delay(i * STEP - CYCLE)}>
              <Image src={`/site/shop/${p}.webp`} alt="" width={96} height={96} sizes="64px" draggable={false}
                className="absolute inset-0 size-full object-cover mix-blend-lighten [filter:grayscale(1)_invert(1)_contrast(1.08)]" />
              <span className={cn('absolute grid place-items-center rounded-full font-bold',
                issue ? 'border border-white/70 bg-black text-white' : 'bg-white text-black')}
                style={{ right: u(4), top: u(4), width: u(13), height: u(13), fontSize: u(9) }}>
                {issue ? '!' : <Check strokeWidth={3.2} style={{ width: u(8), height: u(8) }} />}
              </span>
            </Tile>
          )
        })}

        {/* Sursa de date separată, cu etichetele puse de Hontrio */}
        <Tile x={SOURCE[0]} y={SOURCE[1]} w={154} d={46} z={28} t={6} radius={12} className={s.float} style={delay(-2.4)}>
          <span className="absolute grid place-items-center rounded-full border border-white/25 bg-white/[0.07] text-white/90"
            style={{ left: u(10), top: u(11), width: u(24), height: u(24) }}>
            <Tag strokeWidth={2} style={{ width: u(12), height: u(12) }} />
          </span>
          <span className="absolute flex flex-col whitespace-nowrap" style={{ left: u(42), top: u(8.5), gap: u(2) }}>
            <span className="font-semibold leading-[1.15] tracking-[-0.01em] text-white" style={{ fontSize: u(12.5) }}>{t('site.about_iso_source')}</span>
            <span className="leading-[1.2] text-white/50" style={{ fontSize: u(9.5) }}>{t('site.about_iso_labels_only')}</span>
          </span>
        </Tile>
      </Plane>
    </IsoFrame>
  )
}
