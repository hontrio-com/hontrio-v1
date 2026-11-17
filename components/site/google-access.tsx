import Link from 'next/link'
import { ArrowUpRight, X } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'
import { BrandMark, GOOGLE, type Brand } from './brands'
import { TITLE, TITLE_SIZE, TwoTone } from './section'

// =============================================
// Ce face Hontrio în conturile Google ale magazinului (după „Cum funcționează”):
// pentru ce cere acces la Google Ads și la Merchant Center, ce citește și ce
// schimbă în fiecare, ce nu face cu datele, declarația Limited Use și cum se
// retrage accesul. Google cere ca pagina principală să explice limpede scopul
// aplicației și de ce cere datele omului (verificarea aplicației OAuth,
// 17.11.2026). Componentă de server, fără animații: textul trebuie să existe
// vizibil în pagina trimisă de server, pentru verificarea automată a Google.
// Ce scrie aici trebuie să rămână adevărat față de cod: lib/google/oauth.ts
// (permisiunile), lib/merchant/sync.ts (eticheta din sursa „Hontrio”),
// app/api/integrations/google/route.ts (deconectarea revocă accesul).
// =============================================

const GOOGLE_POLICY = 'https://developers.google.com/terms/api-services-user-data-policy'
// i18n-ignore-start (nume de produse și de documente Google)
const ADS: Brand = GOOGLE[0]
const MERCHANT: Brand = { ...GOOGLE[1], name: 'Google Merchant Center' }
const POLICY_NAME = 'Google API Services User Data Policy'
// i18n-ignore-end

const NEVER = [1, 2, 3, 4] as const

const CARD = 'rounded-[2rem] border border-line p-7 sm:p-9'
const LINK = 'inline-flex items-center gap-1 font-semibold text-neutral-950 underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:decoration-neutral-950'

function Service({ brand, text }: { brand: Brand; text: string }) {
  return (
    <article className={cn(CARD, 'bg-white shadow-[0_30px_80px_-50px_rgba(0,0,0,0.35)]')}>
      <h3 className="[--logo:26px]">
        <BrandMark brand={brand} nameClassName="text-[18px] font-semibold tracking-[-0.015em] text-neutral-950" />
      </h3>
      <p className="mt-5 text-pretty text-[15.5px] leading-[1.7] text-neutral-600">{text}</p>
    </article>
  )
}

export async function GoogleAccess() {
  const t = await getT()
  return (
    <section id="google" className="scroll-mt-24 px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className={cn('text-balance', TITLE_SIZE, TITLE)}>
            <TwoTone a={t('site.gdata_title_a')} b={t('site.gdata_title_b')} lineBreak="sm" />
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-[16px] leading-relaxed text-neutral-500 sm:text-[17px]">{t('site.gdata_desc')}</p>
        </div>

        <div className="mt-14 grid gap-4 md:mt-16 lg:grid-cols-3">
          <Service brand={ADS} text={t('site.gdata_ads')} />
          <Service brand={MERCHANT} text={t('site.gdata_merchant')} />
          <article className={cn(CARD, 'bg-neutral-50/80')}>
            <h3 className="text-[18px] font-semibold tracking-[-0.015em] text-neutral-950">{t('site.gdata_never_title')}</h3>
            <ul className="mt-5 space-y-3.5">
              {NEVER.map(n => (
                <li key={n} className="flex gap-3 text-pretty text-[15.5px] leading-[1.6] text-neutral-600">
                  <X aria-hidden className="mt-[0.3em] size-4 shrink-0 text-neutral-400" strokeWidth={2.4} />
                  <span>{t(`site.gdata_never_${n}`)}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="mx-auto mt-12 max-w-3xl text-center text-[15px] leading-relaxed text-neutral-500">
          <p className="text-pretty">{t('site.gdata_limited')}</p>
          <p className="mt-3 text-pretty">{t('site.gdata_disconnect')}</p>
          <p className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[14.5px]">
            <Link href="/legal/privacy" className={LINK}>{t('site.gdata_privacy_link')}</Link>
            <a href={GOOGLE_POLICY} target="_blank" rel="noopener noreferrer" className={LINK}>
              {POLICY_NAME}<ArrowUpRight aria-hidden className="size-3.5" />
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
