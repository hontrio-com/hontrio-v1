'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

// =============================================
// Antetul site-ului (ca în CLIPPING): sus e pe toată lățimea și transparent;
// la derulare se strânge într-o capsulă de sticlă. Pe telefon, meniul se
// deschide ca o foaie sub antet. Limba se schimbă din subsol.
//
// Piesele de aici (logo, linkurile, butoanele de cont, foaia de pe telefon)
// le folosesc și celelalte variante de antet.
// =============================================

/** Secțiunile paginii principale; `base` e „/" pe alte pagini și „" pe pagina principală. */
export const NAV = [
  { hash: 'how', key: 'site.nav_how' },
  { hash: 'features', key: 'site.nav_features' },
  { hash: 'calculator', key: 'site.nav_calculator' },
  { hash: 'faq', key: 'site.nav_faq' },
] as const

export const primaryPill = 'group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full bg-[#0a0a0a] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_22px_-8px_rgba(0,0,0,0.55)] transition-[background-color,transform] hover:bg-[#1f1f1f] active:scale-[0.98]'
/** Butonul principal pe fundal negru. */
export const whitePill = 'group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full bg-white font-semibold text-black transition-[background-color,transform] hover:bg-neutral-200 active:scale-[0.98]'

/** Lumina care trece peste butonul principal la hover. */
export function Shine() {
  return <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden" />
}

/** A trecut derularea de `after` pixeli? */
export function useScrolled(after = 24) {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', v => setScrolled(v > after))
  return scrolled
}

export function Logo({ invert = false, className }: { invert?: boolean; className?: string }) {
  const { t } = useT()
  return (
    <Link href="/" aria-label={t('site.nav_home')} className={cn('flex shrink-0 items-center', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-black.png" alt="Hontrio" className={cn('h-[22px] w-auto', invert && 'invert')} />
    </Link>
  )
}

/** „Intră în cont" și „Creează cont" sau, cu sesiune, „Mergi în platformă". */
export function AuthLinks({ dark = false }: { dark?: boolean }) {
  const { t } = useT()
  const { status } = useSession()
  const pill = cn(dark ? whitePill : primaryPill, 'h-9 whitespace-nowrap px-4 text-sm')
  const arrow = <ArrowRight className="relative size-3.5 transition group-hover:translate-x-0.5" />
  if (status === 'authenticated') {
    return <Link href="/dashboard" className={pill}>{!dark && <Shine />}<span className="relative">{t('site.nav_platform')}</span>{arrow}</Link>
  }
  return (
    <>
      <Link href="/login" className={cn('whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition',
        dark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-neutral-700 hover:bg-black/[0.06] hover:text-black')}>
        {t('site.nav_login')}
      </Link>
      <Link href="/register" className={pill}>{!dark && <Shine />}<span className="relative">{t('site.nav_signup')}</span>{arrow}</Link>
    </>
  )
}

export function MenuButton({ open, onToggle, dark = false, className }: { open: boolean; onToggle: () => void; dark?: boolean; className?: string }) {
  const { t } = useT()
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? t('site.nav_close') : t('site.nav_menu')}
      className={cn('grid size-10 place-items-center rounded-full transition lg:hidden', dark ? 'text-white hover:bg-white/10' : 'hover:bg-black/[0.06]', className)}>
      {open ? <X className="size-5" /> : <Menu className="size-5" />}
    </button>
  )
}

/** Meniul de pe telefon: o foaie sub antet, cu secțiunile și butoanele de cont. */
export function MobileSheet({ open, onClose, top, base = '/', dark = false, children }: {
  open: boolean; onClose: () => void; top: number; base?: string; dark?: boolean; children?: ReactNode
}) {
  const { t } = useT()
  const { status } = useSession()
  const signedIn = status === 'authenticated'
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.2 }} style={{ top }}
          className={cn('fixed inset-x-3 z-50 rounded-3xl border p-3 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:hidden',
            dark ? 'border-white/10 bg-[#0a0a0a]/95 text-white' : 'border-line bg-white/95')}>
          {children}
          {NAV.map(n => (
            <Link key={n.hash} href={`${base}#${n.hash}`} onClick={onClose}
              className={cn('block rounded-2xl px-4 py-3 text-base font-medium', dark ? 'text-white/85 hover:bg-white/10' : 'text-neutral-800 hover:bg-black/5')}>
              {t(n.key)}
            </Link>
          ))}
          <div className={cn('mt-2 grid grid-cols-2 gap-2 border-t pt-3', dark ? 'border-white/10' : 'border-line')}>
            {signedIn ? (
              <Link href="/dashboard" onClick={onClose} className={cn(dark ? whitePill : primaryPill, 'col-span-2 h-11 text-sm')}>{t('site.nav_platform')}</Link>
            ) : (
              <>
                <Link href="/login" onClick={onClose} className={cn('inline-flex h-11 items-center justify-center rounded-full border text-sm font-semibold',
                  dark ? 'border-white/15 text-white' : 'border-line bg-white text-neutral-900')}>{t('site.nav_login')}</Link>
                <Link href="/register" onClick={onClose} className={cn(dark ? whitePill : primaryPill, 'h-11 text-sm')}>{t('site.nav_signup')}</Link>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function SiteHeader({ base = '/' }: { base?: string }) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const scrolled = useScrolled()
  const [hovered, setHovered] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

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
            <Logo className="pl-1" />

            <nav className="hidden items-center lg:flex" onMouseLeave={() => setHovered(null)}>
              {NAV.map(n => (
                <Link key={n.hash} href={`${base}#${n.hash}`} onMouseEnter={() => setHovered(n.hash)}
                  className="relative whitespace-nowrap px-3.5 py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-black">
                  {hovered === n.hash && (
                    <motion.span layoutId="site-nav-hover" className="absolute inset-0 rounded-full bg-black/[0.06]"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                  )}
                  <span className="relative">{t(n.key)}</span>
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-1.5 lg:flex"><AuthLinks /></div>
            <MenuButton open={open} onToggle={() => setOpen(o => !o)} />
          </div>
        </motion.header>
      </div>

      <MobileSheet open={open} onClose={() => setOpen(false)} top={76} base={base} />
    </>
  )
}
