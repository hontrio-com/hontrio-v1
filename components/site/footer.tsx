'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { ArrowUp, ArrowUpRight, Globe } from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

// =============================================
// Subsolul site-ului (ca în CLIPPING): negru, coloanele de linkuri și, jos,
// logo-ul mare, aprins de o lumină care urmărește cursorul. Tot aici se
// schimbă limba (antetul rămâne curat).
// =============================================

const BRANDS = ['Edinio', 'WooCommerce', 'Shopify', 'Google Ads', 'Merchant Center'] // i18n-ignore: nume de produse
const LOGO_MASK = '[mask-image:url(/logo-black.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]'
// Anul, o dată la încărcare (nu la fiecare randare)
const YEAR = String(new Date().getFullYear())

/** Română | English. Alegerea se ține minte și pagina se reîncarcă în limba nouă. */
function LanguageSwitch() {
  const { locale, setLocale, t } = useLocale()
  return (
    <div role="group" aria-label={t('common.language_change')} className="flex items-center gap-1 rounded-full border border-white/10 p-1">
      <Globe aria-hidden className="ml-1.5 mr-0.5 size-3.5 text-white/40" />
      {LOCALES.map(l => (
        <button key={l} type="button" lang={l} onClick={() => setLocale(l)} aria-pressed={l === locale}
          className={cn('rounded-full px-2.5 py-1 transition-colors', l === locale ? 'bg-white text-black' : 'text-white/60 hover:text-white')}>
          {LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  )
}

export function SiteFooter() {
  const { t } = useLocale()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const mx = useSpring(useMotionValue(50), { stiffness: 120, damping: 20 })
  const my = useSpring(useMotionValue(40), { stiffness: 120, damping: 20 })
  const glow = useMotionTemplate`radial-gradient(380px circle at ${mx}% ${my}%, rgba(255,255,255,0.95), rgba(255,255,255,0.28) 40%, rgba(255,255,255,0.06) 70%)`

  const columns = [
    {
      title: t('site.footer_product'),
      links: [
        { label: t('site.nav_how'), href: '/#how' },
        { label: t('site.nav_features'), href: '/#features' },
        { label: t('site.nav_calculator'), href: '/#calculator' },
        { label: t('site.nav_faq'), href: '/#faq' },
        { label: t('site.footer_blog'), href: '/blog' },
      ],
    },
    {
      title: t('site.footer_account'),
      links: [
        { label: t('site.nav_signup'), href: '/register' },
        { label: t('site.nav_login'), href: '/login' },
        { label: t('site.footer_contact'), href: '/contact' },
      ],
    },
    {
      title: t('site.footer_legal'),
      links: [
        { label: t('site.footer_terms'), href: '/legal/terms' },
        { label: t('site.footer_privacy'), href: '/legal/privacy' },
        { label: t('site.footer_cookies'), href: '/legal/cookies' },
      ],
    },
  ]

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
                  <li key={l.href}>
                    <Link href={l.href} className="group inline-flex items-center gap-1 text-sm text-white/70 transition hover:text-white">
                      {l.label}
                      <ArrowUpRight className="size-3 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-5 border-y border-white/10 py-6 md:flex-row md:items-center">
          <span className="text-sm text-white/50">{t('site.footer_works_with')}</span>
          <ul className="flex flex-wrap items-center gap-2">
            {BRANDS.map(b => (
              <li key={b} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70">{b}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 py-6 text-xs text-white/40 md:flex-row">
          <span>{t('site.footer_rights', { year: YEAR })}</span>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <LanguageSwitch />
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
              className="group flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-white/60 transition hover:border-white/30 hover:text-white">
              {t('site.footer_top')}<ArrowUp className="size-3.5 transition group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Logo-ul mare, aprins de lumina care urmărește cursorul */}
      <div ref={ref} aria-hidden className="relative mx-auto max-w-[1400px] select-none px-4 pb-6"
        onMouseMove={e => {
          const r = ref.current?.getBoundingClientRect()
          if (!r) return
          mx.set(((e.clientX - r.left) / r.width) * 100)
          my.set(((e.clientY - r.top) / r.height) * 100)
        }}>
        <motion.div initial={reduce ? false : { y: '30%', opacity: 0 }} whileInView={{ y: '0%', opacity: 1 }} viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} className="relative aspect-[772/106] w-full">
          <div className={`absolute inset-0 bg-gradient-to-b from-white/[0.16] to-white/[0.03] ${LOGO_MASK}`} />
          <motion.div style={{ backgroundImage: glow }} className={`absolute inset-0 ${LOGO_MASK}`} />
        </motion.div>
      </div>
    </footer>
  )
}
