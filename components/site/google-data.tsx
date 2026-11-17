'use client'

import Link from 'next/link'
import { ArrowUpRight, BanknoteX, BrainCircuit, ImageOff, Link2Off, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { TITLE, TITLE_SIZE, TwoTone } from './section'
import { IsoFilters } from './iso/primitives'
import { IsoAds } from './iso/ads'
import { IsoMerchant } from './iso/merchant'
import { IsoControl } from './iso/control'

// =============================================
// Ce face Hontrio în conturile Google ale magazinului, pe prima pagină și pe
// pagina „Despre Hontrio”. Este un panou negru ca la „Cum funcționează”, cu câte
// o ilustrație izometrică pentru Google Ads, Merchant Center și retragerea
// accesului. Dedesubt, pe același panou, stă ce nu face Hontrio cu datele, apoi
// declarația Limited Use, cu linkurile spre Politica de confidențialitate și
// spre regulile Google.
// Google cere ca pagina principală (App home page în verificarea aplicației
// OAuth, 17.11.2026) să explice limpede scopul aplicației și de ce cere datele
// omului. De aceea textul vine vizibil de la server, fără animații de apariție,
// și se mișcă doar ilustrațiile. Ce scrie aici trebuie să rămână adevărat față
// de cod: lib/google/oauth.ts (permisiunile), lib/merchant/sync.ts (eticheta din
// sursa „Hontrio”) și app/api/integrations/google/route.ts (deconectarea
// revocă accesul).
// =============================================

const STEPS = [
  // i18n-ignore-start (nume de produse Google)
  { id: 'ads', Art: IsoAds, title: 'Google Ads', text: 'site.gdata_ads', img: 'site.about_iso_ads_img' },
  { id: 'merchant', Art: IsoMerchant, title: 'Google Merchant Center', text: 'site.gdata_merchant', img: 'site.about_iso_merchant_img' },
  // i18n-ignore-end
  { id: 'control', Art: IsoControl, title: null, text: 'site.gdata_disconnect', img: 'site.about_iso_control_img' },
] as const

const NEVER: { n: 1 | 2 | 3 | 4; Icon: LucideIcon }[] = [
  { n: 1, Icon: BanknoteX },
  { n: 2, Icon: Link2Off },
  { n: 3, Icon: BrainCircuit },
  { n: 4, Icon: ImageOff },
]

const GOOGLE_POLICY = 'https://developers.google.com/terms/api-services-user-data-policy'
const POLICY_NAME = 'Google API Services User Data Policy' // i18n-ignore (numele documentului Google)

/** O iconiță pe fond închis: o plăcuță de sticlă, cu o margine deschisă sus, ca plăcile din ilustrații. */
const ICON = 'grid size-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-gradient-to-b from-white/[0.14] to-white/[0.03] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
const GLASS = 'rounded-[1.4rem] border border-white/10 bg-white/[0.035]'
const LINK = 'inline-flex items-center gap-1 font-semibold text-white underline decoration-white/30 underline-offset-[3px] transition-colors hover:decoration-white'

export function GoogleData() {
  const { t } = useT()
  return (
    <section id="google" className="scroll-mt-24 px-2 sm:px-4">
      <IsoFilters />
      <div className="mx-auto max-w-[1440px] rounded-[1.75rem] bg-black px-5 py-20 text-white sm:rounded-[2.5rem] sm:px-8 md:py-28 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className={cn('text-balance', TITLE_SIZE, TITLE)}>
            <TwoTone dark a={t('site.gdata_title_a')} b={t('site.gdata_title_b')} lineBreak="sm" />
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-[16px] leading-relaxed text-white/60 sm:text-[17px]">{t('site.gdata_desc')}</p>
        </div>

        <ol className="mx-auto mt-14 grid max-w-[460px] gap-16 md:mt-20 lg:max-w-[1240px] lg:grid-cols-3 lg:gap-10">
          {STEPS.map(({ id, Art, title, text, img }, i) => (
            <li key={id}>
              <Art label={t(img)} />
              <div className="mt-6 px-1">
                <p className="font-mono text-[13px] text-white/40">{`0${i + 1}`}</p>
                <h3 className="mt-2 text-[1.3rem] font-semibold tracking-[-0.025em]">{title ?? t('site.about_control_title')}</h3>
                <p className="mt-2 text-pretty text-[15px] leading-relaxed text-white/60">{t(text)}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Ce nu face Hontrio cu datele, apoi declarația Limited Use */}
        <div className="mx-auto mt-20 max-w-[460px] border-t border-white/10 pt-14 md:mt-24 md:pt-16 lg:max-w-[1240px]">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div>
              <h3 className="text-balance text-[1.8rem] font-bold leading-[1.08] tracking-[-0.04em] sm:text-[2.2rem]">
                <TwoTone dark a={t('site.about_never_title_a')} b={t('site.about_never_title_b')} />
              </h3>
              <p className="mt-4 max-w-md text-pretty text-[15.5px] leading-relaxed text-white/60">{t('site.about_never_desc')}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {NEVER.map(({ n, Icon }) => (
                <li key={n} className={cn(GLASS, 'flex gap-4 p-5')}>
                  <span className={ICON}><Icon aria-hidden className="size-[19px]" strokeWidth={1.7} /></span>
                  <p className="text-pretty text-[14.5px] leading-[1.55] text-white/75">{t(`site.gdata_never_${n}`)}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className={cn(GLASS, 'mt-10 flex flex-col gap-5 p-6 sm:flex-row sm:gap-6 sm:p-8')}>
            <span className={ICON}><ShieldCheck aria-hidden className="size-[19px]" strokeWidth={1.7} /></span>
            <div className="min-w-0">
              <p className="text-pretty text-[16px] font-medium leading-relaxed text-white/90 sm:text-[17px]">{t('site.gdata_limited')}</p>
              <p className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
                <Link href="/legal/privacy" className={LINK}>{t('site.gdata_privacy_link')}</Link>
                <a href={GOOGLE_POLICY} target="_blank" rel="noopener noreferrer" className={LINK}>
                  {POLICY_NAME}<ArrowUpRight aria-hidden className="size-3.5" />
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
