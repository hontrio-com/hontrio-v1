'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useCredits } from '@/hooks/use-credits'
import { Sidebar } from '@/components/app/shell/sidebar'
import { Topbar } from '@/components/app/shell/topbar'
import { CommandMenu } from '@/components/app/shell/command-menu'
import { activeItem } from '@/components/app/shell/nav'
import { storeLabel, useStores } from '@/components/app/shell/stores'

// =============================================
// Rama platformei: meniul din stânga (magazinul, căutarea, paginile,
// creditele, contul), bara de sus (unde ești) și conținutul paginii.
// Căutarea universală se deschide cu ⌘K / Ctrl+K de oriunde.
// =============================================

const COLLAPSED_KEY = 'hontrio:sidebar-collapsed'

// Meniul strâns se ține minte pe dispozitiv (și se potrivește între filele deschise)
const collapsedStore = {
  subscribe(onChange: () => void) {
    window.addEventListener('storage', onChange)
    window.addEventListener(COLLAPSED_KEY, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(COLLAPSED_KEY, onChange)
    }
  },
  get(): boolean {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
  },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const { t } = useT()
  const pathname = usePathname()
  // Meniul de pe telefon e deschis doar pe pagina pe care l-ai deschis: o navigare îl închide
  const [menuAt, setMenuAt] = useState<string | null>(null)
  const mobileOpen = menuAt === pathname
  const setMobileOpen = (open: boolean) => setMenuAt(open ? pathname : null)
  const collapsed = useSyncExternalStore(collapsedStore.subscribe, collapsedStore.get, () => false)
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

  const toggleCollapsed = useCallback(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsedStore.get() ? '0' : '1') } catch {}
    window.dispatchEvent(new Event(COLLAPSED_KEY))
  }, [])

  // ⌘K / Ctrl+K, de oriunde
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(o => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const page = activeItem(pathname, admin)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="app min-h-screen bg-white text-neutral-900">
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-neutral-950/30 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)} />
          )}
        </AnimatePresence>

        <aside className={cn(
          'fixed inset-y-0 left-0 z-50 w-[272px] border-r border-black/[0.06] bg-canvas transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-16' : 'lg:w-[248px]',
        )}>
          <Sidebar
            pathname={pathname}
            admin={admin}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            onNavigate={() => setMobileOpen(false)}
            onSearch={() => { setMobileOpen(false); setSearchOpen(true) }}
            stores={stores}
            activeStore={active}
            switching={switching}
            onChooseStore={choose}
            user={{ name: userName, email: userEmail, avatarUrl }}
            credits={credits}
            plan={plan}
            onLogout={() => signOut({ callbackUrl: '/login' })}
          />
        </aside>

        <div className={cn('transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]', collapsed ? 'lg:pl-16' : 'lg:pl-[248px]')}>
          <Topbar store={active ? storeLabel(active) : null} page={page ? t(page.label) : null}
            onMenu={() => setMobileOpen(true)} onSearch={() => setSearchOpen(true)} />
          <main className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
            {children}
          </main>
        </div>

        <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} admin={admin} stores={stores} activeStoreId={active?.id ?? null} onChooseStore={choose} />
      </div>
    </TooltipProvider>
  )
}
