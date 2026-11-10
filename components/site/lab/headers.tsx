'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { ArrowRight, Bot, Calculator, ChevronDown, LayoutGrid, Lock, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { AuthLinks, Logo, MenuButton, MobileSheet, NAV, useScrolled } from '../header'

// =============================================
// Celelalte variante de antet (A e `SiteHeader`, capsula de sticlă):
//   B · Bară cu anunț — o fâșie neagră cu noutatea, apoi bara albă; la
//       derulare fâșia se strânge și bara capătă sticlă și o linie fină.
//   C · Insulă neagră — o pastilă neagră plutitoare (Aceternity · Floating
//       Navbar): se ascunde când cobori și revine când urci.
//   D · Meniu extins — bara cu „Produs" care deschide un panou mare, cu
//       funcțiile și un card către calculator (ca la Vercel / Linear).
// Niciuna nu are comutatorul de limbă (e în subsol).
// =============================================

const navLink = 'relative whitespace-nowrap px-3.5 py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-black'

// ─── B · Bară cu anunț ──────────────────────────────────────────────────────

export function HeaderBar({ base = '/' }: { base?: string }) {
  const { t } = useT()
  const scrolled = useScrolled(24)
  const [dismissed, setDismissed] = useState(false)
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
              <div className="relative mx-auto flex h-9 max-w-6xl items-center justify-center gap-2.5 px-12 text-[12.5px]">
                <span className="shrink-0 rounded-full bg-white px-2 py-px text-[10px] font-bold uppercase tracking-[0.12em] text-black">{t('site.announce_tag')}</span>
                <Link href={`${base}#features`} className="group flex min-w-0 items-center gap-1 text-white/80 transition hover:text-white">
                  <span className="truncate">{t('site.announce_text')}</span>
                  <ArrowRight className="size-3.5 shrink-0 transition group-hover:translate-x-0.5" />
                </Link>
                <button type="button" onClick={() => setDismissed(true)} aria-label={t('site.announce_close')}
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
            <Logo />
            <nav className="hidden items-center lg:flex" onMouseLeave={() => setHovered(null)}>
              {NAV.map(n => (
                <Link key={n.hash} href={`${base}#${n.hash}`} onMouseEnter={() => setHovered(n.hash)} className={navLink}>
                  {t(n.key)}
                  {hovered === n.hash && (
                    <motion.span layoutId="bar-underline" className="absolute inset-x-3.5 -bottom-[13px] h-[2px] rounded-full bg-black"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                  )}
                </Link>
              ))}
            </nav>
            <div className="hidden items-center justify-end gap-1.5 lg:flex"><AuthLinks /></div>
            <MenuButton open={open} onToggle={() => setOpen(o => !o)} />
          </div>
        </div>
      </header>
      <MobileSheet open={open} onClose={() => setOpen(false)} top={strip ? 108 : 72} base={base} />
    </>
  )
}

// ─── C · Insulă neagră ──────────────────────────────────────────────────────

export function HeaderIsland({ base = '/' }: { base?: string }) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const [hidden, setHidden] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  // Se ascunde când cobori (după primul ecran) și revine imediat ce urci
  useMotionValueEvent(scrollY, 'change', v => setHidden(v > 180 && v > (scrollY.getPrevious() ?? 0)))
  const away = hidden && !open

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3">
        <motion.header initial={false} animate={{ y: away ? -90 : 0, opacity: away ? 0 : 1 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34 }}
          className="pointer-events-auto flex h-[54px] w-full max-w-[900px] items-center justify-between gap-2 rounded-full bg-[#0a0a0a]/[0.92] pl-5 pr-2 text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
          <Logo invert />
          <nav className="hidden items-center lg:flex" onMouseLeave={() => setHovered(null)}>
            {NAV.map(n => (
              <Link key={n.hash} href={`${base}#${n.hash}`} onMouseEnter={() => setHovered(n.hash)}
                className="relative whitespace-nowrap px-3.5 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white">
                {hovered === n.hash && (
                  <motion.span layoutId="island-hover" className="absolute inset-0 rounded-full bg-white/10"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                )}
                <span className="relative">{t(n.key)}</span>
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-1 lg:flex"><AuthLinks dark /></div>
          <MenuButton open={open} onToggle={() => setOpen(o => !o)} dark />
        </motion.header>
      </div>
      <MobileSheet open={open} onClose={() => setOpen(false)} top={76} base={base} dark />
    </>
  )
}

// ─── D · Meniu extins ───────────────────────────────────────────────────────

const PRODUCT_ITEMS = [
  { id: 'pilot', hash: 'features', icon: Bot },
  { id: 'breakeven', hash: 'calculator', icon: Calculator },
  { id: 'groups', hash: 'features', icon: LayoutGrid },
  { id: 'data', hash: 'data', icon: Lock },
] as const

export function HeaderMega({ base = '/' }: { base?: string }) {
  const { t } = useT()
  const scrolled = useScrolled(8)
  const [menu, setMenu] = useState(false)
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  // Escape sau un clic în afară închid panoul
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setMenu(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown) }
  }, [menu])

  return (
    <>
      <header className={cn('fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-300',
        scrolled || menu || open ? 'border-line bg-white/85 backdrop-blur-xl' : 'border-transparent bg-transparent')}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
          <div className="flex items-center gap-7">
            <Logo />
            <nav className="hidden items-center lg:flex">
              <div ref={wrap} className="relative" onMouseEnter={() => setMenu(true)} onMouseLeave={() => setMenu(false)}>
                {/* Cu mouse-ul, panoul e deja deschis de hover: clicul îl lasă deschis. De la tastatură, Enter îl deschide și îl închide. */}
                <button type="button" onClick={e => setMenu(m => (e.detail > 0 ? true : !m))} aria-expanded={menu} aria-controls="site-mega-panel"
                  className={cn('flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-colors', menu ? 'bg-black/[0.06] text-black' : 'text-neutral-600 hover:text-black')}>
                  {t('site.menu_product')}
                  <ChevronDown className={cn('size-3.5 transition-transform duration-200', menu && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {menu && (
                    <motion.div id="site-mega-panel" initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }} className="absolute left-0 top-full origin-top-left pt-3">
                      <div className="grid w-[660px] grid-cols-[1.3fr_1fr] gap-2 rounded-[1.5rem] border border-line bg-white p-2 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.4)]">
                        <ul>
                          {PRODUCT_ITEMS.map(item => (
                            <li key={item.id}>
                              <Link href={`${base}#${item.hash}`} onClick={() => setMenu(false)} className="group flex items-start gap-3 rounded-2xl p-3 transition hover:bg-neutral-50">
                                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-neutral-800 transition group-hover:border-black group-hover:bg-black group-hover:text-white">
                                  <item.icon className="size-4" />
                                </span>
                                <span>
                                  <span className="block text-sm font-semibold text-neutral-950">{t(`site.menu_${item.id}_title`)}</span>
                                  <span className="mt-0.5 block text-[13px] leading-snug text-neutral-500">{t(`site.menu_${item.id}_desc`)}</span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                        <Link href={`${base}#calculator`} onClick={() => setMenu(false)}
                          className="group relative flex flex-col justify-between overflow-hidden rounded-[1.1rem] bg-[#0a0a0a] p-5 text-white">
                          <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
                          <div className="relative">
                            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/60">{t('site.nav_calculator')}</span>
                            <p className="mt-4 text-lg font-semibold leading-snug tracking-tight">{t('site.menu_promo_title')}</p>
                            <p className="mt-2 text-[13px] leading-relaxed text-white/55">{t('site.menu_promo_desc')}</p>
                          </div>
                          <div className="relative mt-6">
                            <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
                              <div className="absolute inset-y-0 left-0 w-[62%] rounded-full bg-white" />
                              <span className="absolute inset-y-0 left-[46%] w-0.5 bg-black" />
                            </div>
                            <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold">
                              {t('site.menu_promo_cta')}<ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <Link href={`${base}#how`} className={navLink}>{t('site.nav_how')}</Link>
              <Link href={`${base}#faq`} className={navLink}>{t('site.nav_faq')}</Link>
              <Link href="/blog" className={navLink}>{t('site.footer_blog')}</Link>
            </nav>
          </div>
          <div className="hidden items-center gap-1.5 lg:flex"><AuthLinks /></div>
          <MenuButton open={open} onToggle={() => setOpen(o => !o)} />
        </div>
      </header>
      <MobileSheet open={open} onClose={() => setOpen(false)} top={72} base={base} />
    </>
  )
}
