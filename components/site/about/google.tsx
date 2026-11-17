'use client'

import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { TITLE, TITLE_SIZE, TwoTone } from '../section'
import { IsoFilters } from '../iso/primitives'
import { IsoAds } from '../iso/ads'
import { IsoMerchant } from '../iso/merchant'
import { IsoControl } from '../iso/control'

// =============================================
// „Despre Hontrio” · ce face Hontrio în conturile Google ale magazinului, în
// panoul negru al secțiunii „Cum funcționează”, cu câte o ilustrație izometrică:
// Google Ads, Merchant Center și retragerea accesului. Google cere ca pagina să
// explice limpede de ce aplicația cere datele omului (verificarea aplicației
// OAuth, 17.11.2026), deci textul vine vizibil de la server, fără animații de
// apariție; se mișcă doar ilustrațiile. Ce scrie aici trebuie să rămână adevărat
// față de cod: lib/google/oauth.ts (permisiunile), lib/merchant/sync.ts (eticheta
// din sursa „Hontrio”), app/api/integrations/google/route.ts (deconectarea
// revocă accesul).
// =============================================

const STEPS = [
  // i18n-ignore-start (nume de produse Google)
  { id: 'ads', Art: IsoAds, title: 'Google Ads', text: 'site.gdata_ads', img: 'site.about_iso_ads_img' },
  { id: 'merchant', Art: IsoMerchant, title: 'Google Merchant Center', text: 'site.gdata_merchant', img: 'site.about_iso_merchant_img' },
  // i18n-ignore-end
  { id: 'control', Art: IsoControl, title: null, text: 'site.gdata_disconnect', img: 'site.about_iso_control_img' },
] as const

export function AboutGoogle() {
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
      </div>
    </section>
  )
}
