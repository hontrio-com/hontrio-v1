'use client'

import Image from 'next/image'
import { useT } from '@/lib/i18n/context'
import { at, delay, IsoFrame, isoStyles as s, Logo, Plane, Tile, u } from './primitives'

// =============================================
// 2. Lansezi: campania Shopping e o placă mare; produsele magazinului cad pe
// ea unul câte unul, în locurile lor, apoi apare bugetul ales de om. Pozele
// sunt cele din căutarea de sus (generate, alb-negru), întoarse în negativ
// ca să fie albe pe plăcile negre. La final totul se stinge și o ia de la capăt.
// =============================================

/** Ciclul animației (secunde) și pauza dintre două produse; ca în iso.module.css. */
const CYCLE = 8.4
const GAP = 0.55

/** Campania: mijlocul, mărimea și înălțimea feței de sus. */
const [bx, by] = at(0, 36)
const BASE = { x: bx, y: by, w: 240, d: 170, z: 10 }
/** Locurile produselor, față de mijlocul campaniei. */
const SLOTS = [-74, 0, 74].map(dx => ({ dx, dy: 40 }))
const CARD = 58
const PRODUCTS = ['lamp-1', 'lamp-4', 'lamp-7']
const BUDGET = at(10, -86)

export function IsoLaunch({ label }: { label: string }) {
  const { t } = useT()
  return (
    <IsoFrame label={label}>
      <Plane dy={17}>
        <Tile x={BASE.x} y={BASE.y} w={BASE.w} d={BASE.d} z={BASE.z} t={5} plates={2} radius={16}>
          <div className="absolute flex flex-col whitespace-nowrap" style={{ left: u(19), top: u(17), gap: u(4) }}>
            <span className="flex items-center text-white/50" style={{ gap: u(6), fontSize: u(11.5) }}>
              <Logo src="/site/logos/google-ads.svg" w={12.5} ratio={2442.4 / 2237} />
              Google Ads
            </span>
            <span className="font-semibold tracking-[-0.02em] text-white" style={{ fontSize: u(21), lineHeight: 1.1 }}>{t('site.how_iso_campaign')}</span>
          </div>
          {SLOTS.map(slot => (
            <span key={slot.dx} className="absolute border border-dashed border-white/20"
              style={{ left: u(BASE.w / 2 + slot.dx - CARD / 2), top: u(BASE.d / 2 + slot.dy - CARD / 2), width: u(CARD), height: u(CARD), borderRadius: u(9) }} />
          ))}
        </Tile>

        {/* Produsele, pe rând */}
        {SLOTS.map((slot, i) => (
          <Tile key={PRODUCTS[i]} x={BASE.x + slot.dx} y={BASE.y + slot.dy} w={CARD} z={BASE.z + 4} t={4} radius={9}
            className={`${s.drop} overflow-hidden`} style={delay(i * GAP - CYCLE)}>
            <Image src={`/site/shop/${PRODUCTS[i]}.webp`} alt="" width={96} height={96} sizes="72px" draggable={false}
              className="absolute inset-0 size-full object-cover mix-blend-lighten [filter:grayscale(1)_invert(1)_contrast(1.08)]" />
          </Tile>
        ))}

        {/* Bugetul pe zi, ales de om */}
        <Tile x={BUDGET[0]} y={BUDGET[1]} w={160} d={60} z={34} t={6} radius={12} className={s.pop}
          style={delay(2.2 - CYCLE)}>
          <div className="absolute flex flex-col whitespace-nowrap" style={{ left: u(15), top: u(11), gap: u(2) }}>
            <span className="text-white/50" style={{ fontSize: u(11) }}>{t('site.how_iso_budget_label')}</span>
            <span className="font-semibold tracking-[-0.02em] text-white" style={{ fontSize: u(21), lineHeight: 1.1 }}>{t('site.how_iso_budget')}</span>
          </div>
        </Tile>
      </Plane>
    </IsoFrame>
  )
}
