import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'
import { TITLE, TITLE_SIZE, TwoTone } from '../section'

// =============================================
// „Despre Hontrio” · firma care face Hontrio: titlul, câteva rânduri și linkurile
// spre documentele legale, iar alături o fișă albă cu datele firmei (aceleași ca
// în documentele legale, `Company` din app/(marketing)/legal/legal-page.tsx) și
// adresele de e-mail. Google cere ca pagina principală să arate limpede cine
// face aplicația.
// =============================================

const DOCS = [
  { href: '/legal/terms', key: 'site.footer_terms' },
  { href: '/legal/privacy', key: 'site.footer_privacy' },
  { href: '/legal/cookies', key: 'site.footer_cookies' },
  { href: '/legal/dpa', key: 'site.footer_dpa' },
] as const

const LINK = 'font-semibold text-neutral-950 underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:decoration-neutral-950'

export async function AboutCompany() {
  const t = await getT()
  // i18n-ignore-start (datele firmei, la fel în ambele limbi)
  const rows = [
    { label: t('site.about_company_name'), value: 'VOID SFT GAMES SRL' },
    { label: 'CUI', value: '43474393' },
    { label: t('site.about_company_reg'), value: 'J18/1054/2020' },
    { label: t('site.about_company_office'), value: t('site.about_company_office_value') },
  ]
  const mails = [
    { to: 'contact@hontrio.com', note: t('site.about_company_general') },
    { to: 'privacy@hontrio.com', note: t('site.about_company_privacy') },
  ]
  // i18n-ignore-end

  return (
    <section className="px-5 pb-24 md:pb-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <h2 className={cn('text-balance', TITLE_SIZE, TITLE)}>
            <TwoTone a={t('site.about_company_title_a')} b={t('site.about_company_title_b')} />
          </h2>
          <p className="mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-neutral-500 sm:text-[17px]">{t('site.about_company_desc')}</p>
          <nav aria-label={t('site.about_company_docs')} className="mt-8">
            <ul className="flex flex-wrap gap-x-6 gap-y-3 text-[14.5px]">
              {DOCS.map(d => <li key={d.href}><Link href={d.href} className={LINK}>{t(d.key)}</Link></li>)}
            </ul>
          </nav>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-line bg-white p-7 shadow-[0_40px_100px_-60px_rgba(0,0,0,0.5)] sm:p-9">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-neutral-100 blur-3xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-black.png" alt="Hontrio" className="relative h-6 w-auto" />
          <dl className="relative mt-8 divide-y divide-line border-y border-line text-[14.5px]">
            {rows.map(r => (
              <div key={r.label} className="grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
                <dt className="text-neutral-500">{r.label}</dt>
                <dd className="font-medium text-neutral-950">{r.value}</dd>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
              <dt className="text-neutral-500">E-mail{/* i18n-ignore */}</dt>
              <dd className="space-y-1.5">
                {mails.map(m => (
                  <p key={m.to}>
                    <a href={`mailto:${m.to}`} className={LINK}>{m.to}</a>
                    <span className="text-neutral-500"> · {m.note}</span>
                  </p>
                ))}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
