'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, Plus, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useCredits } from '@/hooks/use-credits'
import { Sidebar } from '@/components/app/shell/sidebar'
import { CommandMenu } from '@/components/app/shell/command-menu'
import { Toaster } from '@/components/app/toaster'
import { useStores } from '@/components/app/shell/stores'

// =============================================
// Rama platformei, în designul Bezeno: meniul fix în stânga (pe telefon, o
// bară sus și meniul care glisează din stânga), iar pagina pe un fundal gri
// foarte deschis, centrată. Căutarea universală se deschide cu ⌘K / Ctrl+K.
// =============================================

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const { t } = useT()
  const pathname = usePathname()
  // Meniul de pe telefon e deschis doar pe pagina pe care l-ai deschis: o navigare îl închide
  const [menuAt, setMenuAt] = useState<string | null>(null)
  const mobileOpen = menuAt === pathname
  const setMobileOpen = (open: boolean) => setMenuAt(open ? pathname : null)
  const [searchOpen, setSearchOpen] = useState(false)
  const { credits, plan, avatarUrl } = useCredits()
  const { stores, active, switching, choose } = useStores()

  const userName = session?.user?.name || t('settings.default_user')
  const userEmail = session?.user?.email || ''
  const userRole = (session?.user as { role?: string } | undefined)?.role || 'user'
  const admin = userRole === 'admin'

  // Un cont nou își face întâi pașii de pornire (adminii nu)
  useEffect(() => {
    if (!session?.user || admin) return
    fetch('/api/user/me').then(r => r.json()).then(d => { if (d.user?.onboarding_completed === false) window.location.href = '/onboarding' }).catch(() => {})
  }, [session, admin])

  // ⌘K / Ctrl+K, de oriunde
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(o => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sidebar = (layoutId: string, onNavigate: () => void) => (
    <Sidebar pathname={pathname} admin={admin} layoutId={layoutId} onNavigate={onNavigate}
      onSearch={() => { setMobileOpen(false); setSearchOpen(true) }}
      stores={stores} activeStore={active} switching={switching} onChooseStore={choose}
      user={{ name: userName, email: userEmail, avatarUrl }} credits={credits} plan={plan}
      onLogout={() => signOut({ callbackUrl: '/login' })} />
  )

  return (
    <TooltipProvider delayDuration={200}>
      <div className="app flex min-h-screen bg-canvas text-neutral-950">
        {/* Meniul, pe desktop */}
        <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 border-r border-line bg-rail lg:block">
          {sidebar('nav-active-desktop', () => {})}
        </aside>

        {/* Bara de sus, pe telefon */}
        <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-white/80 px-4 backdrop-blur-xl lg:hidden">
          <Link href="/dashboard" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-black.png" alt="Hontrio" className="h-5 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/campaigns?new=1" className="grid size-9 place-items-center rounded-full bg-black text-white" aria-label={t('sidebar.new_campaign')}>
              <Plus className="size-4" />
            </Link>
            <button onClick={() => setMobileOpen(true)} className="grid size-9 place-items-center rounded-full border border-line bg-white" aria-label={t('sidebar.open_menu')}>
              <Menu className="size-4" />
            </button>
          </div>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)}
                className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm lg:hidden" />
              <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                className="fixed inset-y-0 left-0 z-50 w-[86%] max-w-[320px] bg-rail shadow-2xl lg:hidden">
                <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 z-10 grid size-9 place-items-center rounded-full hover:bg-neutral-100" aria-label={t('sidebar.close_menu')}>
                  <X className="size-4" />
                </button>
                {sidebar('nav-active-mobile', () => setMobileOpen(false))}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-6 lg:px-10 lg:pt-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} admin={admin} stores={stores} activeStoreId={active?.id ?? null} onChooseStore={choose} />
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
