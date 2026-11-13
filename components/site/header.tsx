'use client'

import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'
import { useSession } from 'next-auth/react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

// =============================================
// Antetul site-ului: sus, o fâșie neagră cu noutatea (se poate închide și
// rămâne închisă), apoi bara albă cu logo-ul, secțiunile paginii și butoanele
// de cont. La derulare fâșia se strânge, iar bara capătă sticlă și o linie
// fină. Pe telefon, meniul se deschide ca o foaie sub antet. Limba se schimbă
// din subsol.
// =============================================

// În ordinea secțiunilor de pe prima pagină (prețurile nu mai au pagina lor)
const NAV = [
  { id: 'how', href: '/#how', key: 'site.nav_how' },
  { id: 'optimize', href: '/#optimize', key: 'site.nav_autopilot' },
  { id: 'pricing', href: '/#pricing', key: 'site.nav_pricing' },
  { id: 'faq', href: '/#faq', key: 'site.nav_faq' },
] as const

export const primaryPill = 'group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full bg-[#0a0a0a] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_22px_-8px_rgba(0,0,0,0.55)] transition-[background-color,transform] hover:bg-[#1f1f1f] active:scale-[0.98]'

/** Lumina care trece peste butonul principal la hover. */
export function Shine() {
  return <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden" />
}

// ─── Fâșia cu noutatea ───────────────────────────────────────────────────────
// Închisă o dată, rămâne închisă (în browser). Când se schimbă anunțul, se
// schimbă și cheia, ca noul anunț să apară tuturor.
const ANNOUNCE_KEY = 'hontrio_announce_launch_free'
const listeners = new Set<() => void>()
let dismissedNow = false

function readDismissed() {
  if (dismissedNow) return true
  try { return localStorage.getItem(ANNOUNCE_KEY) === '1' } catch { return false }
}

function dismissAnnouncement() {
  dismissedNow = true
  try { localStorage.setItem(ANNOUNCE_KEY, '1') } catch { /* fără stocare, rămâne închisă doar acum */ }
  listeners.forEach(l => l())
}

/** A închis omul fâșia cu noutatea? (pe server: nu) */
export function useAnnouncementDismissed() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    readDismissed,
    () => false,
  )
}

/** A trecut derularea de `after` pixeli? */
function useScrolled(after = 24) {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', v => setScrolled(v > after))
  return scrolled
}

/** „Intră în cont" și „Creează cont" sau, cu sesiune, „Mergi în platformă". */
function AuthLinks() {
  const { t } = useT()
  const { status } = useSession()
  const pill = cn(primaryPill, 'h-9 whitespace-nowrap px-4 text-sm')
  const arrow = <ArrowRight className="relative size-3.5 transition group-hover:translate-x-0.5" />
  if (status === 'authenticated') {
    return <Link href="/dashboard" className={pill}><Shine /><span className="relative">{t('site.nav_platform')}</span>{arrow}</Link>
  }
  return (
    <>
      <Link href="/login" className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-black/[0.06] hover:text-black">
        {t('site.nav_login')}
      </Link>
      <Link href="/register" className={pill}><Shine /><span className="relative">{t('site.nav_signup')}</span>{arrow}</Link>
    </>
  )
}

/** Meniul de pe telefon: o foaie sub antet, cu secțiunile și butoanele de cont. */
function MobileSheet({ open, onClose, top }: { open: boolean; onClose: () => void; top: number }) {
  const { t } = useT()
  const { status } = useSession()
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.2 }} style={{ top }}
          className="fixed inset-x-3 z-50 rounded-3xl border border-line bg-white/95 p-3 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:hidden">
          {NAV.map(n => (
            <Link key={n.id} href={n.href} onClick={onClose} className="block rounded-2xl px-4 py-3 text-base font-medium text-neutral-800 hover:bg-black/5">
              {t(n.key)}
            </Link>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-3">
            {status === 'authenticated' ? (
              <Link href="/dashboard" onClick={onClose} className={cn(primaryPill, 'col-span-2 h-11 text-sm')}>{t('site.nav_platform')}</Link>
            ) : (
              <>
                <Link href="/login" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-white text-sm font-semibold text-neutral-900">{t('site.nav_login')}</Link>
                <Link href="/register" onClick={onClose} className={cn(primaryPill, 'h-11 text-sm')}>{t('site.nav_signup')}</Link>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function SiteHeader() {
  const { t } = useT()
  const scrolled = useScrolled()
  const dismissed = useAnnouncementDismissed()
  const [hovered, setHovered] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const strip = !dismissed && !scrolled

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50">
        <AnimatePresence initial={false}>
          {strip && (
            <motion.div initial={{ height: 0 }} animate={{ height: 36 }} exit={{ height: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden bg-[#0a0a0a] text-white">
              {/* Pe telefon, fără eticheta „Lansare”: așa încape tot textul */}
              <div className="relative mx-auto flex h-9 max-w-6xl items-center justify-center gap-2.5 px-10 text-[12px] sm:px-12 sm:text-[12.5px]">
                <span className="hidden shrink-0 rounded-full bg-white px-2 py-px text-[10px] font-bold uppercase tracking-[0.12em] text-black sm:block">{t('site.announce_tag')}</span>
                <Link href="/#pricing" className="group flex min-w-0 items-center gap-1.5 text-white/80 transition hover:text-white">
                  <span className="truncate">{t('site.announce_text')}</span>
                  <span className="hidden shrink-0 font-medium text-white sm:inline">{t('site.announce_link')}</span>
                  <ArrowRight className="size-3 shrink-0 transition group-hover:translate-x-0.5" />
                </Link>
                <button type="button" onClick={dismissAnnouncement} aria-label={t('site.announce_close')}
                  className="absolute right-3 grid size-6 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white">
                  <X className="size-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn('border-b transition-[background-color,border-color,box-shadow] duration-300',
          scrolled || open ? 'border-line bg-white/80 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl' : 'border-transparent bg-transparent')}>
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 lg:grid lg:grid-cols-[1fr_auto_1fr]">
            <Link href="/" aria-label={t('site.nav_home')} className="flex shrink-0 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-black.png" alt="Hontrio" className="h-[22px] w-auto" />
            </Link>

            <nav className="hidden items-center lg:flex" onMouseLeave={() => setHovered(null)}>
              {NAV.map(n => (
                <Link key={n.id} href={n.href} onMouseEnter={() => setHovered(n.id)}
                  className="relative whitespace-nowrap px-3.5 py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-black">
                  {t(n.key)}
                  {hovered === n.id && (
                    <motion.span layoutId="site-nav-underline" className="absolute inset-x-3.5 -bottom-[13px] h-[2px] rounded-full bg-black"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                  )}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center justify-end gap-1.5 lg:flex"><AuthLinks /></div>

            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={open ? t('site.nav_close') : t('site.nav_menu')}
              className="grid size-10 place-items-center rounded-full transition hover:bg-black/[0.06] lg:hidden">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      <MobileSheet open={open} onClose={() => setOpen(false)} top={strip ? 108 : 72} />
    </>
  )
}
