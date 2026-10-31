'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AdminSidebar } from '@/components/app/shell/admin-sidebar'
import { activeAdminItem } from '@/components/app/shell/admin-nav'
import { Topbar } from '@/components/app/shell/topbar'
import { CommandMenu } from '@/components/app/shell/command-menu'
import { useStores } from '@/components/app/shell/stores'
import { Toaster } from '@/components/app/toaster'

// =============================================
// Rama panoului de administrare: meniul lui, bara de sus (Panou de
// administrare › pagina) și conținutul. Aceeași construcție ca rama platformei,
// doar cu paginile de administrare în meniu.
// =============================================

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const { t } = useT()
  const pathname = usePathname()
  // Meniul de pe telefon e deschis doar pe pagina pe care l-ai deschis: o navigare îl închide
  const [menuAt, setMenuAt] = useState<string | null>(null)
  const mobileOpen = menuAt === pathname
  const setMobileOpen = (open: boolean) => setMenuAt(open ? pathname : null)
  const [searchOpen, setSearchOpen] = useState(false)
  const { stores, active, choose } = useStores()

  // ⌘K / Ctrl+K, de oriunde
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(o => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const page = activeAdminItem(pathname)
  const user = { name: session?.user?.name || t('settings.default_user'), email: session?.user?.email || '' }

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
          'fixed inset-y-0 left-0 z-50 w-[272px] border-r border-black/[0.06] bg-canvas transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:w-[248px] lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}>
          <AdminSidebar pathname={pathname} user={user} onNavigate={() => setMobileOpen(false)} onSearch={() => { setMobileOpen(false); setSearchOpen(true) }} />
        </aside>

        <div className="lg:pl-[248px]">
          <Topbar store={t('admin.layout_title')} page={page ? t(page.label) : null} onMenu={() => setMobileOpen(true)} onSearch={() => setSearchOpen(true)} />
          <main className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
            {children}
          </main>
        </div>

        <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} admin stores={stores} activeStoreId={active?.id ?? null} onChooseStore={choose} />
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
