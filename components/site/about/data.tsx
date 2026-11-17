import Link from 'next/link'
import { ArrowUpRight, BanknoteX, BrainCircuit, ImageOff, Link2Off, ShieldCheck, type LucideIcon } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'
import { TITLE, TITLE_SIZE, TwoTone } from '../section'

// =============================================
// „Despre Hontrio” · ce nu face Hontrio cu datele din conturile Google: patru
// carduri, fiecare cu iconița lui, apoi declarația Limited Use cerută de Google,
// cu linkurile spre Politica de confidențialitate și spre regulile Google.
// Componentă de server, fără animații: textul este pentru oameni și pentru
// verificarea automată a Google deopotrivă.
// =============================================

const GOOGLE_POLICY = 'https://developers.google.com/terms/api-services-user-data-policy'
const POLICY_NAME = 'Google API Services User Data Policy' // i18n-ignore (numele documentului Google)

const NEVER: { n: 1 | 2 | 3 | 4; Icon: LucideIcon }[] = [
  { n: 1, Icon: BanknoteX },
  { n: 2, Icon: Link2Off },
  { n: 3, Icon: BrainCircuit },
  { n: 4, Icon: ImageOff },
]

/** Iconița unui card: o plăcuță neagră, cu o margine deschisă sus, ca plăcile din ilustrații. */
const ICON = 'grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-neutral-800 to-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_14px_28px_-14px_rgba(0,0,0,0.7)]'
const CARD = 'rounded-[1.75rem] border border-line'
const LINK = 'inline-flex items-center gap-1 font-semibold text-neutral-950 underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:decoration-neutral-950'

export async function AboutData() {
  const t = await getT()
  return (
    <section className="px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className={cn('text-balance', TITLE_SIZE, TITLE)}>
            <TwoTone a={t('site.about_never_title_a')} b={t('site.about_never_title_b')} />
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-neutral-500 sm:text-[17px]">{t('site.about_never_desc')}</p>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 md:mt-16 lg:grid-cols-4">
          {NEVER.map(({ n, Icon }) => (
            <li key={n} className={cn(CARD, 'flex flex-col bg-white p-6 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.35)] sm:p-7')}>
              <div className="flex items-start justify-between">
                <span className={ICON}><Icon aria-hidden className="size-[22px]" strokeWidth={1.7} /></span>
                <span className="font-mono text-[13px] text-neutral-400">{`0${n}`}</span>
              </div>
              <p className="mt-10 text-pretty text-[15.5px] leading-[1.6] text-neutral-700">{t(`site.gdata_never_${n}`)}</p>
            </li>
          ))}
        </ul>

        <div className={cn(CARD, 'mt-4 bg-neutral-50/80 p-6 sm:p-10')}>
          <div className="flex flex-col gap-6 sm:flex-row sm:gap-7">
            <span className={ICON}><ShieldCheck aria-hidden className="size-[22px]" strokeWidth={1.7} /></span>
            <div className="min-w-0">
              <p className="text-pretty text-[17px] font-medium leading-relaxed tracking-[-0.01em] text-neutral-900 sm:text-[19px]">{t('site.gdata_limited')}</p>
              <p className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14.5px]">
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
