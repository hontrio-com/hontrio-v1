'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Menu, X, ChevronDown,
  Wand2, TrendingUp, Bot, ShieldCheck, ArrowUpRight,
  Instagram, Facebook,
} from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

// ─── Feature rows per column ──────────────────────────────────────────────────
const COL_1 = [
  { id: 'ai-images', icon: Wand2, href: '/features/ai-images', badge: false },
  { id: 'ai-agent',  icon: Bot,   href: '/features/ai-agent',  badge: false },
]
const COL_2 = [
  { id: 'seo',         icon: TrendingUp,  href: '/features/seo',          badge: false },
  { id: 'risk-shield', icon: ShieldCheck, href: '/features/risk-shield',  badge: true  },
]

// ─── Bilingual content ────────────────────────────────────────────────────────
const T = {
  en: {
    nav: {
      home: 'Home', features: 'Features', pricing: 'Pricing', caseStudies: 'Case Studies',
      signIn: 'Sign In', getStarted: 'Get Started →',
    },
    mega: {
      col1Label: 'AI & Content',
      col2Label: 'Optimization & Security',
      badge: 'New',
      featured: {
        eyebrow: 'Platform',
        title: '4 AI tools. One platform.',
        desc: 'From auto-generated product images to advanced fraud protection. Everything in one place.',
        cta: 'Explore all features',
      },
      items: {
        'ai-images':   { title: 'AI Images',    desc: 'Generate professional product photos in seconds with AI' },
        'ai-agent':    { title: 'AI Agent',      desc: 'Smart virtual assistant trained on your store catalog' },
        'seo':         { title: 'SEO Optimizer', desc: 'Automatically optimize every product for search engines' },
        'risk-shield': { title: 'Risk Shield',   desc: 'Detect and block fraudulent orders before they happen' },
      } as Record<string, { title: string; desc: string }>,
    },
    footer: {
      motto: 'A complete AI ecosystem for your online store, powered by artificial intelligence and smart automation.',
      product: 'Product',
      aiImages: 'AI Images', seoOptimizer: 'SEO Optimizer', aiAgent: 'AI Agent',
      riskShield: 'Risk Shield', pricing: 'Pricing',
      register: 'Register', login: 'Sign In',
      resources: 'Resources',
      blog: 'Blog', faq: 'FAQ', roadmap: 'Roadmap', support: 'Support',
      company: 'Company',
      about: 'About Us', contact: 'Contact', partnerships: 'Partnerships', careers: 'Careers',
      legal: 'Legal',
      terms: 'Terms & Conditions', privacy: 'Privacy Policy', cookies: 'Cookie Policy', gdpr: 'GDPR',
      copyright: `© ${new Date().getFullYear()} Hontrio. All rights reserved.`,
      startFree: 'Start for free',
    },
  },
  ro: {
    nav: {
      home: 'Acasă', features: 'Funcții', pricing: 'Prețuri', caseStudies: 'Studii de caz',
      signIn: 'Conectează-te', getStarted: 'Începe Gratuit →',
    },
    mega: {
      col1Label: 'AI & Conținut',
      col2Label: 'Optimizare & Securitate',
      badge: 'Nou',
      featured: {
        eyebrow: 'Platforma',
        title: '4 instrumente AI. Un singur loc.',
        desc: 'De la fotografii generate automat la protecție anti-fraudă. Totul integrat într-o singură platformă.',
        cta: 'Explorează funcțiile',
      },
      items: {
        'ai-images':   { title: 'Imagini AI',    desc: 'Generează fotografii profesionale pentru produse în câteva secunde' },
        'ai-agent':    { title: 'Agent AI',      desc: 'Asistent virtual inteligent antrenat pe catalogul magazinului tău' },
        'seo':         { title: 'SEO Optimizer', desc: 'Optimizare automată SEO pentru fiecare produs din magazin' },
        'risk-shield': { title: 'Risk Shield',   desc: 'Detectează și blochează comenzile frauduloase înainte să se întâmple' },
      } as Record<string, { title: string; desc: string }>,
    },
    footer: {
      motto: 'Un ecosistem AI complet pentru magazinul tău online, alimentat de inteligenta artificiala si automatizare inteligenta.',
      product: 'Produs',
      aiImages: 'Imagini AI', seoOptimizer: 'Optimizator SEO', aiAgent: 'Agent AI',
      riskShield: 'Risk Shield', pricing: 'Preturi',
      register: 'Inregistreaza-te', login: 'Conecteaza-te',
      resources: 'Resurse',
      blog: 'Blog', faq: 'FAQ', roadmap: 'Roadmap', support: 'Suport',
      company: 'Companie',
      about: 'Despre noi', contact: 'Contact', partnerships: 'Parteneriate', careers: 'Cariere',
      legal: 'Legal',
      terms: 'Termeni si conditii', privacy: 'Politica de confidentialitate', cookies: 'Politica Cookies', gdpr: 'GDPR',
      copyright: `© ${new Date().getFullYear()} Hontrio. Toate drepturile rezervate.`,
      startFree: 'Incepe gratuit',
    },
  },
}

const glass = (alpha: number): React.CSSProperties => ({
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  backgroundColor: `rgba(255,255,255,${alpha})`,
})

// ─── Mega menu feature row ────────────────────────────────────────────────────
function FeatureRow({
  icon: Icon, id, href, badge, label, badgeLabel, onClick,
}: {
  icon: React.ElementType; id: string; href: string; badge?: boolean
  label: { title: string; desc: string }; badgeLabel: string; onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group flex items-start gap-3 p-3 -mx-3 rounded-xl hover:bg-neutral-100 transition-colors duration-150"
    >
      <div className="shrink-0 w-8 h-8 rounded-lg bg-white border border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.06)] flex items-center justify-center mt-0.5">
        <Icon className="h-[15px] w-[15px] text-neutral-600" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-neutral-900 leading-tight">{label.title}</span>
          {badge && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-neutral-900 text-white rounded-full">
              {badgeLabel}
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-neutral-500 leading-snug mt-0.5 line-clamp-2">{label.desc}</p>
      </div>
    </Link>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────
function MarketingHeader() {
  const { locale } = useLocale()
  const t = locale === 'ro' ? T.ro : T.en

  const [scrolled,       setScrolled]       = useState(false)
  const [megaOpen,       setMegaOpen]       = useState(false)
  const [mobileOpen,     setMobileOpen]     = useState(false)
  const [mobileFeatOpen, setMobileFeatOpen] = useState(false)
  const [isMounted,      setIsMounted]      = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setIsMounted(true), [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Prevent page scroll while mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const openMega      = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setMegaOpen(true) }
  const closeMega     = () => { closeTimer.current = setTimeout(() => setMegaOpen(false), 120) }
  const cancelClose   = () => { if (closeTimer.current) clearTimeout(closeTimer.current) }
  const closeMegaNow  = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setMegaOpen(false) }

  const allFeats = [...COL_1, ...COL_2]

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 relative ${
        scrolled ? 'border-b border-neutral-900/10 shadow-[0_2px_28px_rgba(0,0,0,0.05)]' : ''
      }`}
      style={scrolled ? glass(0.93) : { backdropFilter: 'none', WebkitBackdropFilter: 'none', backgroundColor: 'transparent' }}
    >
      {/* ── Aurora layer (syncs with hero via background-attachment:fixed) ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          ['--aurora' as string]: 'repeating-linear-gradient(100deg,#3b82f6_10%,#a5b4fc_15%,#93c5fd_20%,#ddd6fe_25%,#60a5fa_30%)',
          ['--white-gradient' as string]: 'repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)',
          ['--transparent' as string]: 'transparent',
        }}
      >
        <div className="after:animate-aurora pointer-events-none absolute -inset-[10px] opacity-40 blur-[10px] invert filter will-change-transform [background-image:var(--white-gradient),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%] [--aurora:repeating-linear-gradient(100deg,#3b82f6_10%,#a5b4fc_15%,#93c5fd_20%,#ddd6fe_25%,#60a5fa_30%)] [--white-gradient:repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)] after:[background-size:200%,_100%] after:[background-attachment:fixed] after:mix-blend-difference after:content-[''] [mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]" />
      </div>

      {/* ── Main bar ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center">
            <img src="/logo-black.png" className="h-[22px] w-auto" alt="Hontrio" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">

            <Link
              href="/"
              className="px-3.5 py-1.5 text-[13.5px] font-medium text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-black/[0.04] transition-all duration-150"
            >
              {t.nav.home}
            </Link>

            {/* Features trigger */}
            <div onMouseEnter={openMega} onMouseLeave={closeMega}>
              <button
                className={`flex items-center gap-1 px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg transition-all duration-150 ${
                  megaOpen
                    ? 'text-neutral-900 bg-black/[0.04]'
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-black/[0.04]'
                }`}
              >
                {t.nav.features}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${megaOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <Link
              href="/pricing"
              className="px-3.5 py-1.5 text-[13.5px] font-medium text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-black/[0.04] transition-all duration-150"
            >
              {t.nav.pricing}
            </Link>

            <Link
              href="/case-studies"
              className="px-3.5 py-1.5 text-[13.5px] font-medium text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-black/[0.04] transition-all duration-150"
            >
              {t.nav.caseStudies}
            </Link>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-1.5">
            <Link
              href="/login"
              className="px-3.5 py-1.5 text-[13.5px] font-medium text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-black/[0.04] transition-all duration-150"
            >
              {t.nav.signIn}
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center px-4 py-1.5 rounded-[10px] bg-neutral-900 text-white text-[13.5px] font-medium hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150 shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
            >
              {t.nav.getStarted}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-black/[0.05] transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen
              ? <X className="h-[18px] w-[18px] text-neutral-700" />
              : <Menu className="h-[18px] w-[18px] text-neutral-700" />
            }
          </button>
        </div>
      </div>

      {/* ── Mega Menu ────────────────────────────────────────────────────── */}
      <div
        className={`hidden md:block absolute left-0 right-0 transition-all duration-200 origin-top z-10 ${
          megaOpen
            ? 'opacity-100 scale-y-100 pointer-events-auto'
            : 'opacity-0 scale-y-95 pointer-events-none'
        }`}
        style={glass(0.98)}
        onMouseEnter={cancelClose}
        onMouseLeave={closeMega}
      >
        <div className="border-y border-neutral-200/70 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
          <div className="max-w-7xl mx-auto px-8 py-8">
            <div className="grid grid-cols-[1fr_1fr_288px] gap-10">

              {/* Column 1 */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-4 px-3">
                  {t.mega.col1Label}
                </p>
                <div className="flex flex-col gap-1">
                  {COL_1.map((feat) => (
                    <FeatureRow
                      key={feat.id}
                      icon={feat.icon}
                      id={feat.id}
                      href={feat.href}
                      label={t.mega.items[feat.id]}
                      badgeLabel={t.mega.badge}
                      onClick={closeMegaNow}
                    />
                  ))}
                </div>
              </div>

              {/* Column 2 */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-4 px-3">
                  {t.mega.col2Label}
                </p>
                <div className="flex flex-col gap-1">
                  {COL_2.map((feat) => (
                    <FeatureRow
                      key={feat.id}
                      icon={feat.icon}
                      id={feat.id}
                      href={feat.href}
                      badge={'badge' in feat ? feat.badge : false}
                      label={t.mega.items[feat.id]}
                      badgeLabel={t.mega.badge}
                      onClick={closeMegaNow}
                    />
                  ))}
                </div>
              </div>

              {/* Column 3 - Featured panel */}
              <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-5 flex flex-col">
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-neutral-400 mb-3">
                  {t.mega.featured.eyebrow}
                </p>
                <p className="text-[15px] font-bold text-neutral-900 leading-snug">
                  {t.mega.featured.title}
                </p>
                <p className="text-[12.5px] text-neutral-500 leading-relaxed mt-2 flex-1">
                  {t.mega.featured.desc}
                </p>
                <Link
                  href="/features"
                  onClick={closeMegaNow}
                  className="mt-5 flex items-center gap-1.5 text-[13px] font-semibold text-neutral-900 hover:text-neutral-600 transition-colors group w-fit"
                >
                  {t.mega.featured.cta}
                  <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-150" />
                </Link>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile Menu — full-screen overlay ────────────────────────── */}
      {isMounted && mobileOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex flex-col bg-white">
          {/* Top bar */}
          <div className="flex items-center justify-between h-14 px-5 border-b border-neutral-100 shrink-0">
            <Link href="/" onClick={() => setMobileOpen(false)}>
              <img src="/logo-black.png" className="h-[22px] w-auto" alt="Hontrio" />
            </Link>
            <button
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-black/[0.05] transition-colors"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-[18px] w-[18px] text-neutral-700" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-1">
            {/* Primary nav links */}
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center px-3 py-3 text-[17px] font-semibold text-neutral-900 rounded-xl hover:bg-neutral-50 transition-colors"
            >
              {t.nav.home}
            </Link>

            {/* Features section */}
            <div>
              <button
                className="flex items-center justify-between w-full px-3 py-3 text-[17px] font-semibold text-neutral-900 rounded-xl hover:bg-neutral-50 transition-colors"
                onClick={() => setMobileFeatOpen(!mobileFeatOpen)}
              >
                {t.nav.features}
                <ChevronDown className={`h-4.5 w-4.5 text-neutral-400 transition-transform duration-200 ${mobileFeatOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${mobileFeatOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="mt-2 mb-1 grid grid-cols-2 gap-2 px-1">
                  {allFeats.map((feat) => {
                    const Icon = feat.icon
                    const label = t.mega.items[feat.id]
                    const hasBadge = 'badge' in feat && feat.badge
                    return (
                      <Link
                        key={feat.id}
                        href={feat.href}
                        onClick={() => setMobileOpen(false)}
                        className="flex flex-col gap-2.5 p-3.5 rounded-2xl border border-neutral-100 bg-neutral-50 hover:bg-neutral-100 hover:border-neutral-200 transition-all"
                      >
                        <div className="w-8 h-8 rounded-xl bg-white border border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.06)] flex items-center justify-center">
                          <Icon className="h-[15px] w-[15px] text-neutral-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[13px] font-semibold text-neutral-900 leading-tight">{label.title}</span>
                            {hasBadge && (
                              <span className="px-1 py-0.5 text-[9px] font-bold bg-neutral-900 text-white rounded-full leading-none">
                                {t.mega.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11.5px] text-neutral-500 leading-snug line-clamp-2">{label.desc}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>

            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              className="flex items-center px-3 py-3 text-[17px] font-semibold text-neutral-900 rounded-xl hover:bg-neutral-50 transition-colors"
            >
              {t.nav.pricing}
            </Link>
            <Link
              href="/case-studies"
              onClick={() => setMobileOpen(false)}
              className="flex items-center px-3 py-3 text-[17px] font-semibold text-neutral-900 rounded-xl hover:bg-neutral-50 transition-colors"
            >
              {t.nav.caseStudies}
            </Link>
          </div>

          {/* Bottom CTAs */}
          <div className="shrink-0 px-5 py-5 border-t border-neutral-100 flex flex-col gap-2.5">
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center w-full px-5 py-3.5 rounded-[12px] bg-neutral-900 text-white text-[15px] font-semibold hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.14)]"
            >
              {t.nav.getStarted}
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center w-full px-5 py-3.5 rounded-[12px] border border-neutral-200 text-neutral-700 text-[15px] font-semibold hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.98] transition-all"
            >
              {t.nav.signIn}
            </Link>
          </div>
        </div>,
        document.body
      )}
    </header>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function MarketingFooter() {
  const { locale } = useLocale()
  const t = (locale === 'ro' ? T.ro : T.en).footer

  const linkCls = 'text-sm text-neutral-400 hover:text-white transition-colors duration-200'

  return (
    <footer className="bg-neutral-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-10">

          {/* Col 1 — Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <img src="/logo-black.png" className="h-6 w-auto invert mb-4" alt="Hontrio" />
            <p className="text-sm text-neutral-400 leading-relaxed max-w-xs">{t.motto}</p>
          </div>

          {/* Col 2 — Produs */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">{t.product}</h3>
            <ul className="space-y-2.5">
              {[
                { label: t.aiImages,     href: '/features/ai-images' },
                { label: t.seoOptimizer, href: '/features/seo' },
                { label: t.aiAgent,      href: '/features/ai-agent' },
                { label: t.riskShield,   href: '/features/risk-shield' },
                { label: t.pricing,      href: '/pricing' },
              ].map((l) => (
                <li key={l.label}><Link href={l.href} className={linkCls}>{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Resurse */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">{t.resources}</h3>
            <ul className="space-y-2.5">
              {[
                { label: t.blog,     href: '/blog' },
                { label: t.faq,      href: '/#faq' },
                { label: t.roadmap,  href: '/roadmap' },
                { label: t.support,  href: '/support' },
              ].map((l) => (
                <li key={l.label}><Link href={l.href} className={linkCls}>{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Companie */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">{t.company}</h3>
            <ul className="space-y-2.5">
              {[
                { label: t.about,        href: '/about' },
                { label: t.contact,      href: '/contact' },
                { label: t.partnerships, href: '/partnerships' },
                { label: t.careers,      href: '/careers' },
              ].map((l) => (
                <li key={l.label}><Link href={l.href} className={linkCls}>{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Col 5 — Legal */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">{t.legal}</h3>
            <ul className="space-y-2.5">
              {[
                { label: t.terms,   href: '/legal/terms' },
                { label: t.privacy, href: '/legal/privacy' },
                { label: t.cookies, href: '/legal/cookies' },
                { label: t.gdpr,    href: '/legal/gdpr' },
              ].map((l) => (
                <li key={l.label}><Link href={l.href} className={linkCls}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-500">{t.copyright}</p>

          {/* Social icons */}
          <div className="flex items-center gap-3">
            <Link href="https://facebook.com/hontrio" target="_blank" rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all">
              <Facebook className="h-3.5 w-3.5" />
            </Link>
            <Link href="https://instagram.com/hontrio" target="_blank" rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all">
              <Instagram className="h-3.5 w-3.5" />
            </Link>
            <Link href="https://tiktok.com/@hontrio" target="_blank" rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
              </svg>
            </Link>
          </div>

          {/* Discrete CTA */}
          <Link
            href="/register"
            className="text-xs font-medium text-neutral-500 hover:text-white border border-neutral-800 hover:border-neutral-600 px-4 py-1.5 rounded-full transition-all duration-200"
          >
            {t.startFree}
          </Link>
        </div>
      </div>
    </footer>
  )
}

// ─── Layout ──────────────────────────────────────────────────────────────────
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </>
  )
}
