'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

// =============================================
// Antetul site-ului (ca în CLIPPING): sus e pe toată lățimea și transparent;
// la derulare se strânge într-o capsulă de sticlă. Pe telefon, meniul se
// deschide ca o foaie sub antet.
// =============================================

const NAV = [
  { href: '/#how', key: 'site.nav_how' },
  { href: '/#features', key: 'site.nav_features' },
  { href: '/#calculator', key: 'site.nav_calculator' },
  { href: '/#faq', key: 'site.nav_faq' },
] as const

/** RO | EN, ca o pastilă. Alegerea se ține minte și pagina se reîncarcă în limba nouă. */
function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale()
  return (
    <div role="group" aria-label={t('common.language_change')} className={cn('inline-flex h-8 items-center rounded-full border border-line bg-white/70 p-0.5 text-[11px] font-semibold', className)}>
      {LOCALES.map(l => (
        <button key={l} type="button" onClick={() => setLocale(l)} aria-pressed={l === locale} title={LOCALE_NAMES[l]}
          className={cn('h-full rounded-full px-2.5 uppercase tracking-wide transition-colors', l === locale ? 'bg-black text-white' : 'text-neutral-500 hover:text-black')}>
          {l}
        </button>
      ))}
    </div>
  )
}

export const primaryPill = 'group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full bg-[#0a0a0a] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_22px_-8px_rgba(0,0,0,0.55)] transition-[background-color,transform] hover:bg-[#1f1f1f] active:scale-[0.98]'

/** Lumina care trece peste butonul principal la hover. */
export function Shine() {
  return <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden" />
}

export function SiteHeader() {
  const { t } = useLocale()
  const { status } = useSession()
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  useMotionValueEvent(scrollY, 'change', v => setScrolled(v > 24))
  const signedIn = status === 'authenticated'

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3">
        <motion.header initial={false}
          animate={{
            maxWidth: scrolled ? 1040 : 1200,
            marginTop: scrolled ? 12 : 0,
            borderRadius: scrolled ? 999 : 0,
            paddingLeft: scrolled ? 10 : 20,
            paddingRight: scrolled ? 10 : 20,
          }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
          className="pointer-events-auto relative w-full">
          {/* Sticla, doar după ce începe derularea */}
          <motion.div aria-hidden initial={false} animate={{ opacity: scrolled || open ? 1 : 0 }} transition={{ duration: 0.25 }}
            className="absolute inset-0 rounded-[inherit] border border-line bg-white/75 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.28)] backdrop-blur-xl" />

          <div className="relative flex h-[60px] items-center justify-between gap-4">
            <Link href="/" aria-label={t('site.nav_home')} className="flex shrink-0 items-center pl-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-black.png" alt="Hontrio" className="h-[22px] w-auto" />
            </Link>

            <nav className="hidden items-center lg:flex" onMouseLeave={() => setHovered(null)}>
              {NAV.map(n => (
                <Link key={n.href} href={n.href} onMouseEnter={() => setHovered(n.href)}
                  className="relative whitespace-nowrap px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-black lg:px-3.5">
                  {hovered === n.href && (
                    <motion.span layoutId="site-nav-hover" className="absolute inset-0 rounded-full bg-black/[0.06]"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                  )}
                  <span className="relative">{t(n.key)}</span>
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-1.5 lg:flex">
              <LocaleToggle className="mr-1" />
              {signedIn ? (
                <Link href="/dashboard" className={cn(primaryPill, 'h-9 whitespace-nowrap px-4 text-sm')}>
                  <Shine /><span className="relative">{t('site.nav_platform')}</span><ArrowRight className="relative size-3.5 transition group-hover:translate-x-0.5" />
                </Link>
              ) : (
                <>
                  <Link href="/login" className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-black/[0.06] hover:text-black">
                    {t('site.nav_login')}
                  </Link>
                  <Link href="/register" className={cn(primaryPill, 'h-9 whitespace-nowrap px-4 text-sm')}>
                    <Shine /><span className="relative">{t('site.nav_signup')}</span><ArrowRight className="relative size-3.5 transition group-hover:translate-x-0.5" />
                  </Link>
                </>
              )}
            </div>

            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={open ? t('site.nav_close') : t('site.nav_menu')}
              className="grid size-10 place-items-center rounded-full transition hover:bg-black/[0.06] lg:hidden">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </motion.header>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-3 top-[76px] z-50 rounded-3xl border border-line bg-white/95 p-3 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:hidden">
            {NAV.map(n => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-base font-medium text-neutral-800 hover:bg-black/5">
                {t(n.key)}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-line px-2 pt-3">
              <LocaleToggle />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {signedIn ? (
                <Link href="/dashboard" onClick={() => setOpen(false)} className={cn(primaryPill, 'col-span-2 h-11 text-sm')}>{t('site.nav_platform')}</Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-white text-sm font-semibold text-neutral-900">{t('site.nav_login')}</Link>
                  <Link href="/register" onClick={() => setOpen(false)} className={cn(primaryPill, 'h-11 text-sm')}>{t('site.nav_signup')}</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
