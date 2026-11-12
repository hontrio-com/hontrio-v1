'use client'

import { OctagonPause, PackageMinus, SearchX, TrendingUp, type LucideIcon } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { at, delay, IsoFrame, isoStyles as s, Plane, Tile, u } from './primitives'

// =============================================
// 3. Pilotul are grijă: tabla unei zile, cu ce a făcut pilotul la trecerea lui
// (regulile din docs/campanii/SPECIFICATIE.md §6): cuvinte negative pentru
// căutările care au costat fără vânzări, un produs scos, oprirea de siguranță
// și o creștere de buget de 20%, care așteaptă aprobarea omului. Plăcile se
// aprind pe rând, ca o verificare; dedesubt, zilele săptămânii, câte una pe tură.
// =============================================

/** O tură a pilotului (o zi) și pasul dintre două acțiuni, în secunde; ca în iso.module.css. */
const DAY = 7
const STEP = 1.25

/** Tabla: mijlocul, mărimea și înălțimea feței de sus. */
const [bx, by] = at(0, -16)
const BOARD = { x: bx, y: by, w: 236, z: 10 }
const CELL = 102
const OFF = 57
/** Zilele: un rând drept pe ecran, sub tablă. */
const DAYS = Array.from({ length: 7 }, (_, i) => at(-108 + i * 36, 128))

type Action = { id: 'negatives' | 'product' | 'stop' | 'budget'; icon: LucideIcon; at: [number, number] }
// Pe rând, în sensul acelor de ceas: stânga, sus, dreapta, iar bugetul în față
const ACTIONS: Action[] = [
  { id: 'negatives', icon: SearchX, at: [-OFF, -OFF] },
  { id: 'product', icon: PackageMinus, at: [OFF, -OFF] },
  { id: 'stop', icon: OctagonPause, at: [OFF, OFF] },
  { id: 'budget', icon: TrendingUp, at: [-OFF, OFF] },
]

/** Ziua aprinsă când animațiile lipsesc (joi). */
const TODAY = 3
/** O săptămână oarecare care începe luni (2 noiembrie 2026), pentru inițialele zilelor. */
const MONDAY = Date.UTC(2026, 10, 2)

export function IsoPilot({ label }: { label: string }) {
  const { t, intlLocale } = useT()
  const weekday = new Intl.DateTimeFormat(intlLocale, { weekday: 'narrow', timeZone: 'UTC' })
  const days = Array.from({ length: 7 }, (_, i) => weekday.format(new Date(MONDAY + i * 86_400_000)))

  return (
    <IsoFrame label={label}>
      <Plane dy={0}>
        <Tile x={BOARD.x} y={BOARD.y} w={BOARD.w} z={BOARD.z} t={5} plates={2} radius={16}>
          {/* Locurile acțiunilor: se văd când placa se ridică */}
          {ACTIONS.map(a => (
            <span key={a.id} className="absolute border border-dashed border-white/15"
              style={{ left: u(BOARD.w / 2 + a.at[0] - CELL / 2), top: u(BOARD.w / 2 + a.at[1] - CELL / 2), width: u(CELL), height: u(CELL), borderRadius: u(12) }} />
          ))}
        </Tile>

        {ACTIONS.map((a, i) => {
          const Icon = a.icon
          const budget = a.id === 'budget'
          return (
            <Tile key={a.id} x={BOARD.x + a.at[0]} y={BOARD.y + a.at[1]} w={CELL} z={BOARD.z + 5} t={5} radius={12}
              className={cn(budget ? s.hold : s.check, budget && s.lit)} style={delay(i * STEP - DAY)}>
              <span className="absolute grid place-items-center rounded-full border border-white/25 bg-white/[0.07] text-white/90"
                style={{ left: u(12), top: u(12), width: u(27), height: u(27) }}>
                <Icon strokeWidth={1.8} style={{ width: u(14), height: u(14) }} />
              </span>
              {budget && <span className={cn(s.wait, 'absolute rounded-full bg-white')} style={{ right: u(14), top: u(23), width: u(5.5), height: u(5.5) }} />}
              <span className="absolute flex flex-col" style={{ left: u(12), right: u(10), bottom: u(11), gap: u(2.5) }}>
                <span className={cn('font-semibold leading-[1.15] tracking-[-0.01em] text-white', budget && 'whitespace-nowrap')} style={{ fontSize: u(13) }}>
                  {t(budget ? 'site.how_iso_budget_up' : `site.how_iso_${a.id}`)}
                </span>
                {budget && <span className="leading-[1.2] text-white/55" style={{ fontSize: u(10) }}>{t('site.how_iso_waiting')}</span>}
              </span>
            </Tile>
          )
        })}

        {/* Zilele săptămânii: câte una pe tură */}
        {days.map((d, i) => (
          <Tile key={i} x={DAYS[i][0]} y={DAYS[i][1]} w={24} z={4} t={3} radius={6}
            className={cn(s.day, i === TODAY && s.today, 'grid place-items-center font-medium')}
            style={{ ...delay((i - 7) * DAY), fontSize: u(10.5) }}>
            {d}
          </Tile>
        ))}
      </Plane>
    </IsoFrame>
  )
}
