'use client'

import { ChartColumn, Lock } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { delay, IsoFrame, isoStyles as s, Logo, Plane, Tile, u } from './primitives'

// =============================================
// Despre · Google Ads: contul de reclame al magazinului, o placă mare cu trei
// rânduri. Campania Shopping creată de Hontrio se ridică și se aprinde din când
// în când (Hontrio lucrează la ea). Celelalte campanii au un lacăt: se schimbă
// doar cu acordul omului. Rezultatele și conversiile au un punct care clipește:
// Hontrio le citește. Trebuie să rămână adevărat față de textul site.gdata_ads.
// =============================================

/** Contul: mărimea și înălțimea feței de sus (mijlocul este mijlocul planului). */
const BASE = { w: 236, d: 210, z: 8 }
/** Rândurile: mărimea și mijlocul fiecăruia pe y, față de mijlocul contului. */
const ROW = { w: 206, d: 34 }
const ROWS = [-6, 36, 78]

export function IsoAds({ label }: { label: string }) {
  const { t } = useT()
  const rows = [
    { id: 'hontrio', title: t('site.how_iso_campaign'), sub: t('site.about_iso_by_hontrio') },
    { id: 'others', title: t('site.about_iso_others'), sub: t('site.about_iso_with_approval') },
    { id: 'results', title: t('site.about_iso_results'), sub: t('site.about_iso_read') },
  ] as const

  return (
    <IsoFrame label={label}>
      <Plane dy={-4}>
        {/* O lumină slabă pe podea, sub cont */}
        <div className="absolute rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.07),transparent)]"
          style={{ left: u(-190), top: u(-190), width: u(380), height: u(380) }} />

        <Tile x={0} y={0} w={BASE.w} d={BASE.d} z={BASE.z} t={5} plates={2} radius={16}>
          <div className="absolute flex flex-col whitespace-nowrap" style={{ left: u(18), top: u(15), gap: u(4) }}>
            <span className="flex items-center text-white/50" style={{ gap: u(6), fontSize: u(11.5) }}>
              <Logo src="/site/logos/google-ads.svg" w={12.5} ratio={2442.4 / 2237} />
              Google Ads{/* i18n-ignore */}
            </span>
            <span className="font-semibold tracking-[-0.02em] text-white" style={{ fontSize: u(18), lineHeight: 1.1 }}>{t('site.about_iso_account')}</span>
          </div>
          {/* Locul campaniei Hontrio: se vede când rândul se ridică */}
          <span className="absolute border border-dashed border-white/15"
            style={{ left: u((BASE.w - ROW.w) / 2), top: u(BASE.d / 2 + ROWS[0] - ROW.d / 2), width: u(ROW.w), height: u(ROW.d), borderRadius: u(10) }} />
        </Tile>

        {rows.map((r, i) => (
          <Tile key={r.id} x={0} y={ROWS[i]} w={ROW.w} d={ROW.d} z={BASE.z + 4} t={4} radius={10}
            className={cn(r.id === 'hontrio' && s.hold)} style={r.id === 'hontrio' ? delay(-5.6) : undefined}>
            <span className="absolute grid place-items-center rounded-full border border-white/25 bg-white/[0.07] text-white/90"
              style={{ left: u(9), top: u(7), width: u(20), height: u(20) }}>
              {r.id === 'hontrio' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/logo-icon.png" alt="" draggable={false} className="invert" style={{ width: u(10), height: u(11) }} />
              )}
              {r.id === 'others' && <Lock strokeWidth={2} style={{ width: u(11), height: u(11) }} />}
              {r.id === 'results' && <ChartColumn strokeWidth={2} style={{ width: u(11), height: u(11) }} />}
            </span>
            <span className="absolute flex flex-col whitespace-nowrap" style={{ left: u(37), top: u(5), gap: u(1.5) }}>
              <span className={cn('font-semibold leading-[1.15] tracking-[-0.01em]', r.id === 'others' ? 'text-white/70' : 'text-white')} style={{ fontSize: u(11.5) }}>{r.title}</span>
              <span className="leading-[1.2] text-white/50" style={{ fontSize: u(9) }}>{r.sub}</span>
            </span>
            {r.id === 'results' && <span className={cn(s.wait, 'absolute rounded-full bg-white')} style={{ right: u(14), top: u(14.25), width: u(5.5), height: u(5.5) }} />}
          </Tile>
        ))}
      </Plane>
    </IsoFrame>
  )
}
