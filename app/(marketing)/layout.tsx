'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import type { UILocale } from '@/lib/i18n/context'

// ─── Language Context (needed for setLocale) ─────────────────────────────────
import { useLocale } from '@/lib/i18n/context'

// ─── Nav content ─────────────────────────────────────────────────────────────
const navEn = {
  features: 'Features',
  pricing: 'Pricing',
  testimonials: 'Testimonials',
  faq: 'FAQ',
  signIn: 'Sign In',
  getStarted: 'Get Started',
  motto: 'A complete ecosystem for your online store, powered by artificial intelligence and smart automation.',
  product: 'Product',
  account: 'Account',
  allFeatures: 'All Features',
  aiImages: 'AI Images',
  seoOptimizer: 'SEO Optimizer',
  aiAgent: 'AI Agent',
  riskShield: 'Risk Shield',
  register: 'Register',
  login: 'Sign In',
  copyright: `© ${new Date().getFullYear()} Hontrio. All rights reserved.`,
}

const navRo = {
  features: 'Funcții',
  pricing: 'Prețuri',
  testimonials: 'Recenzii',
  faq: 'FAQ',
  signIn: 'Conectează-te',
  getStarted: 'Începe Gratuit',
  motto: 'Un ecosistem complet pentru magazinul tău online, alimentat de inteligență artificială și automatizare inteligentă.',
  product: 'Produs',
  account: 'Cont',
  allFeatures: 'Toate Funcțiile',
  aiImages: 'Imagini AI',
  seoOptimizer: 'Optimizator SEO',
  aiAgent: 'Agent AI',
  riskShield: 'Risk Shield',
  register: 'Înregistrează-te',
  login: 'Conectează-te',
  copyright: `© ${new Date().getFullYear()} Hontrio. Toate drepturile rezervate.`,
}

// ─── Language Toggle Pill ─────────────────────────────────────────────────────
function LangToggle({ locale, setLocale }: { locale: UILocale; setLocale: (l: UILocale) => void }) {
  return (
    <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1">
      <button
        onClick={() => setLocale('ro')}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
          locale === 'ro'
            ? 'bg-white text-neutral-900 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-700'
        }`}
      >
        <span>🇷🇴</span> RO
      </button>
      <button
        onClick={() => setLocale('en')}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
          locale === 'en'
            ? 'bg-white text-neutral-900 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-700'
        }`}
      >
        <span>🇬🇧</span> EN
      </button>
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────
function MarketingHeader() {
  const { locale, setLocale } = useLocale()
  const c = locale === 'ro' ? navRo : navEn
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = [
    { label: c.features, href: '#features' },
    { label: c.pricing, href: '#pricing' },
    { label: c.testimonials, href: '#testimonials' },
    { label: c.faq, href: '#faq' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <img src="/logo-black.png" className="h-6 w-auto" alt="Hontrio" />
          </Link>

          {/* Center nav — desktop only */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right — desktop */}
          <div className="hidden md:flex items-center gap-3">
            <LangToggle locale={locale} setLocale={setLocale} />
            <Link
              href="/login"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-200"
            >
              {c.signIn}
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors duration-200"
            >
              {c.getStarted}
            </Link>
          </div>

          {/* Mobile: hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5 text-neutral-600" />
            ) : (
              <Menu className="h-5 w-5 text-neutral-600" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <div
        className={`md:hidden border-t border-neutral-100 bg-white overflow-hidden transition-all duration-200 ${
          mobileOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 py-4 flex flex-col gap-4">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="border-t border-neutral-100 pt-4 flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
            >
              {c.signIn}
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
            >
              {c.getStarted}
            </Link>
            <LangToggle locale={locale} setLocale={setLocale} />
          </div>
        </div>
      </div>
    </header>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function MarketingFooter() {
  const { locale, setLocale } = useLocale()
  const c = locale === 'ro' ? navRo : navEn

  return (
    <footer className="bg-neutral-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <img src="/logo-black.png" className="h-6 w-auto invert mb-4" alt="Hontrio" />
            <p className="text-sm text-neutral-400 leading-relaxed max-w-xs">
              {c.motto}
            </p>
          </div>

          {/* Product links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">
              {c.product}
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: c.aiImages, href: '#features' },
                { label: c.seoOptimizer, href: '#features' },
                { label: c.aiAgent, href: '#features' },
                { label: c.riskShield, href: '#features' },
                { label: c.pricing, href: '#pricing' },
              ].map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm text-neutral-400 hover:text-white transition-colors duration-200"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Account links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">
              {c.account}
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: c.login, href: '/login' },
                { label: c.register, href: '/register' },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-neutral-400 hover:text-white transition-colors duration-200"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Language toggle */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-4">
              Language / Limbă
            </h3>
            <div className="flex items-center gap-1 bg-neutral-900 rounded-full p-1 w-fit">
              <button
                onClick={() => setLocale('ro')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                  locale === 'ro'
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                🇷🇴 RO
              </button>
              <button
                onClick={() => setLocale('en')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                  locale === 'en'
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                🇬🇧 EN
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-500">{c.copyright}</p>
          <div className="flex items-center gap-1 bg-neutral-900 rounded-full p-1">
            <button
              onClick={() => setLocale('ro')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                locale === 'ro'
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              🇷🇴 RO
            </button>
            <button
              onClick={() => setLocale('en')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                locale === 'en'
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              🇬🇧 EN
            </button>
          </div>
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
