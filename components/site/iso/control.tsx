'use client'

import { ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { at, Floor, IsoFrame, isoStyles as s, Logo, Plane, Tile, u } from './primitives'

// =============================================
// Despre · retragerea accesului: Hontrio (placa din stânga) este legat prin linii
// punctate de Google Ads și de Merchant Center. În față stă comutatorul din Setări.
// La fiecare tură (9s, în iso.module.css) comutatorul se stinge, liniile și
// plăcile Google se sting, apare „Acces anulat”, apoi totul revine. Fără animații
// rămâne starea conectată. Trebuie să rămână adevărat față de site.gdata_disconnect.
// =============================================

const HONTRIO = at(-96, -8)
const ACCOUNTS = [
  // i18n-ignore-start (nume de produse și fișiere)
  { name: 'Google Ads', src: '/site/logos/google-ads.svg', w: 32, ratio: 2442.4 / 2237, at: at(98, -54) },
  { name: 'Merchant Center', src: '/site/logos/google-merchant-center.svg', w: 29, ratio: 1, at: at(98, 34) },
  // i18n-ignore-end
]
const TOGGLE = at(0, 92)
const REVOKED = at(-18, -98)

export function IsoControl({ label }: { label: string }) {
  const { t } = useT()
  return (
    <IsoFrame label={label}>
      <Plane dy={6}>
        <div className="absolute rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.07),transparent)]"
          style={{ left: u(-180), top: u(-180), width: u(360), height: u(360) }} />

        {/* Legăturile de pe podea, de la conturile Google spre Hontrio */}
        <Floor size={480}>
          <g className={s.linked}>
            {ACCOUNTS.map(a => (
              <line key={a.name} x1={a.at[0]} y1={a.at[1]} x2={HONTRIO[0]} y2={HONTRIO[1]} stroke="rgba(255,255,255,0.42)" strokeWidth={1} className={s.flow} />
            ))}
          </g>
        </Floor>

        <Tile x={HONTRIO[0]} y={HONTRIO[1]} w={88} z={16} t={5} plates={3} radius={13} className="grid place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" draggable={false} className="invert" style={{ width: u(35), height: u(38) }} />
        </Tile>

        {ACCOUNTS.map(a => (
          <Tile key={a.name} x={a.at[0]} y={a.at[1]} w={68} z={22} t={6} radius={10} className={cn(s.fade, 'grid place-items-center')}>
            <Logo src={a.src} w={a.w} ratio={a.ratio} />
          </Tile>
        ))}

        {/* Comutatorul din Setări */}
        <Tile x={TOGGLE[0]} y={TOGGLE[1]} w={176} d={54} z={12} t={5} plates={2} radius={14}>
          <span className="absolute flex flex-col whitespace-nowrap" style={{ left: u(15), top: u(9.5), gap: u(3) }}>
            <span className="text-white/50" style={{ fontSize: u(10.5) }}>{t('site.about_iso_google_account')}</span>
            <span className="relative font-semibold tracking-[-0.02em] text-white" style={{ fontSize: u(15), lineHeight: 1.15 }}>
              <span className={s.on}>{t('site.about_iso_connected')}</span>
              <span className={cn(s.off, 'absolute left-0 top-0')}>{t('site.about_iso_disconnected')}</span>
            </span>
          </span>
          <span className={cn(s.track, 'absolute rounded-full border border-white/70')} style={{ right: u(14), top: u(16), width: u(40), height: u(22) }}>
            <span className={cn(s.knob, 'absolute rounded-full')} style={{ left: u(2), top: u(2), width: u(16), height: u(16) }} />
          </span>
        </Tile>

        {/* Accesul anulat: apare după ce comutatorul s-a stins */}
        <Tile x={REVOKED[0]} y={REVOKED[1]} w={148} d={44} z={30} t={6} radius={12} className={s.revoked}>
          <span className="absolute grid place-items-center rounded-full bg-white text-black"
            style={{ left: u(10), top: u(10), width: u(24), height: u(24) }}>
            <ShieldCheck strokeWidth={2.2} style={{ width: u(13), height: u(13) }} />
          </span>
          <span className="absolute whitespace-nowrap font-semibold tracking-[-0.01em] text-white"
            style={{ left: u(42), top: u(13.5), fontSize: u(13), lineHeight: 1.2 }}>
            {t('site.about_iso_revoked')}
          </span>
        </Tile>
      </Plane>
    </IsoFrame>
  )
}
