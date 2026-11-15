'use client'

import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import { ArrowUp, ArrowUpRight } from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'
import { openCookieSettings } from '@/components/cookie-consent'
import { BrandMark, GOOGLE, STORES } from './brands'

// =============================================
// Subsolul site-ului (ca în CLIPPING): negru, coloanele de linkuri și logo-urile
// cu care funcționează Hontrio. Fără logo-ul mare HONTRIO de jos: proprietarul
// l-a scos (14.11.2026). Tot aici se redeschide alegerea despre cookie-uri.
// Limba nu se alege pe site: vine din țara vizitatorului (`detectLocale`).
// Datele firmei (Legea nr. 365/2002, art. 5) sunt în paginile legale, legate
// de aici: Termeni, Confidențialitate.
// =============================================

type FooterLink = { label: string; href: string } | { label: string; onClick: () => void }

// Logo-urile, albe pe negru: detaliile albe din ele (literele Woo, „S”-ul Shopify, coșul OpenCart) rămân decupate
const WHITE_LOGO = '[filter:grayscale(1)_invert(1)_brightness(2.2)]'
// Anul, o dată la încărcare (nu la fiecare randare)
const YEAR = String(new Date().getFullYear())

export function SiteFooter() {
  const { t } = useLocale()
  const reduce = useReducedMotion()

  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: t('site.footer_product'),
      links: [
        { label: t('site.nav_how'), href: '/#how' },
        { label: t('site.nav_autopilot'), href: '/#optimize' },
        { label: t('site.nav_pricing'), href: '/#pricing' },
        { label: t('site.nav_faq'), href: '/#faq' },
      ],
    },
    {
      title: t('site.footer_account'),
      links: [
        { label: t('site.nav_signup'), href: '/register' },
        { label: t('site.nav_login'), href: '/login' },
      ],
    },
    {
      title: t('site.footer_legal'),
      links: [
        { label: t('site.footer_terms'), href: '/legal/terms' },
        { label: t('site.footer_privacy'), href: '/legal/privacy' },
        { label: t('site.footer_cookies'), href: '/legal/cookies' },
        { label: t('site.footer_dpa'), href: '/legal/dpa' },
        { label: t('site.footer_cookie_settings'), onClick: openCookieSettings },
      ],
    },
  ]
  const linkStyle = 'group inline-flex items-center gap-1 text-left text-sm text-white/70 transition hover:text-white'

  return (
    <footer className="relative overflow-hidden bg-[#070707] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-white/[0.06] blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 pt-20">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-3 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="sm:col-span-3 md:col-span-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-black.png" alt="Hontrio" className="h-6 w-auto invert" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">{t('site.footer_tagline')}</p>
            <a href="mailto:contact@hontrio.com" className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:border-white/30 hover:text-white">
              contact@hontrio.com{/* i18n-ignore */}<ArrowUpRight className="size-3" />
            </a>
          </div>

          {columns.map(col => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{col.title}</p>
              <ul className="mt-5 space-y-3">
                {col.links.map(l => (
                  <li key={l.label}>
                    {'href' in l ? (
                      <Link href={l.href} className={linkStyle}>
                        {l.label}
                        <ArrowUpRight className="size-3 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                      </Link>
                    ) : (
                      <button type="button" onClick={l.onClick} className={linkStyle}>{l.label}</button>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 border-y border-white/10 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{t('site.footer_works_with')}</p>
          <ul className="mt-6 grid grid-cols-2 items-center gap-x-6 gap-y-6 opacity-70 [--logo:20px] sm:grid-cols-4 lg:flex lg:justify-between">
            {[...STORES, ...GOOGLE].map(b => (
              <li key={b.name} className="flex min-w-0">
                <BrandMark brand={b} imgClassName={WHITE_LOGO} nameClassName="text-[13.5px] font-medium text-white" />
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pb-10 pt-6 text-xs text-white/40 md:flex-row">
          <span>{t('site.footer_rights', { year: YEAR })}</span>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
            className="group flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-white/60 transition hover:border-white/30 hover:text-white">
            {t('site.footer_top')}<ArrowUp className="size-3.5 transition group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </footer>
  )
}
