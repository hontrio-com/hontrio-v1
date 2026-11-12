'use client'

import { at, delay, Floor, IsoFrame, isoStyles as s, Logo, Plane, Tile, u } from './primitives'

// =============================================
// 1. Conectezi: platformele de magazin și Google, câte o placă cu logo-ul lor
// (alb, din fișierele oficiale), legate prin linii punctate de placa Hontrio
// din mijloc. Sus magazinele care merg acum, jos cele care se fac înainte de
// lansare (Gomag, MerchantPro, OpenCart), în lateral Google Ads și Merchant
// Center. Liniuțele curg spre Hontrio, plăcile plutesc, fiecare în ritmul ei.
// =============================================

/** Coloanele și rândurile plăcilor, pe ecran. */
const COL = 128
const ROW = 104
const TILE = 68

type Platform = { name: string; src: string; w: number; ratio: number; screen: [number, number]; light?: boolean; crop?: number }

// i18n-ignore-start (nume de produse și fișiere)
const PLATFORMS: Platform[] = [
  { name: 'Edinio', src: '/site/logos/edinio.svg', w: 46, ratio: 3000 / 750.2, screen: [-COL, -ROW] },
  { name: 'WooCommerce', src: '/site/logos/woocommerce.svg', w: 40, ratio: 2500 / 1494, screen: [0, -ROW] },
  { name: 'Shopify', src: '/site/logos/shopify.svg', w: 27, ratio: 2192 / 2500, screen: [COL, -ROW] },
  { name: 'Google Ads', src: '/site/logos/google-ads.svg', w: 32, ratio: 2442.4 / 2237, screen: [-COL, 0] },
  { name: 'Merchant Center', src: '/site/logos/google-merchant-center.svg', w: 29, ratio: 1, screen: [COL, 0] },
  { name: 'Gomag', src: '/site/logos/gomag.png', w: 46, ratio: 298 / 92, screen: [-COL, ROW] },
  { name: 'MerchantPro', src: '/site/logos/merchantpro.png', w: 38, ratio: 624 / 56, crop: 119 / 624, screen: [0, ROW] },
  { name: 'OpenCart', src: '/site/logos/opencart.png', w: 56, ratio: 1, light: true, screen: [COL, ROW] },
]
// i18n-ignore-end

const SPOTS = PLATFORMS.map(p => at(...p.screen))

export function IsoConnect({ label }: { label: string }) {
  return (
    <IsoFrame label={label}>
      <Plane dy={13}>
        {/* O lumină slabă pe podea, sub Hontrio */}
        <div className="absolute rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.075),transparent)]"
          style={{ left: u(-170), top: u(-170), width: u(340), height: u(340) }} />
        {/* Liniile de pe podea, de la fiecare platformă spre Hontrio */}
        <Floor size={480}>
          {SPOTS.map(([x, y], i) => (
            <line key={PLATFORMS[i].name} x1={x} y1={y} x2={0} y2={0} stroke="rgba(255,255,255,0.42)" strokeWidth={1} className={s.flow} />
          ))}
        </Floor>

        {PLATFORMS.map((p, i) => (
          <Tile key={p.name} x={SPOTS[i][0]} y={SPOTS[i][1]} w={TILE} z={22} t={6} radius={10} className={`${s.float} grid place-items-center`}
            style={delay(-((i * 2.3) % 5.6))}>
            <Logo src={p.src} w={p.w} ratio={p.ratio} light={p.light} crop={p.crop} />
          </Tile>
        ))}

        {/* Hontrio: placa mare, un teanc de trei straturi; logo-ul în negativ, ca în subsol */}
        <Tile x={0} y={0} w={92} z={16} t={5} plates={3} radius={13} className="grid place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" draggable={false} className="invert" style={{ width: u(37), height: u(40) }} />
        </Tile>
      </Plane>
    </IsoFrame>
  )
}
