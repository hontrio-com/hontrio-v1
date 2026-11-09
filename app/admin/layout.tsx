'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AdminSidebar } from '@/components/app/shell/admin-sidebar'
import { CommandMenu } from '@/components/app/shell/command-menu'
import { useStores } from '@/components/app/shell/stores'
import { Toaster } from '@/components/app/toaster'

// =============================================
// Rama panoului de administrare: aceeași construcție ca rama platformei
// (designul Bezeno), doar cu paginile de administrare în meniu.
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

  const user = { name: session?.user?.name || t('settings.default_user'), email: session?.user?.email || '' }
  const sidebar = (layoutId: string, onNavigate: () => void) => (
    <AdminSidebar pathname={pathname} user={user} layoutId={layoutId} onNavigate={onNavigate} onSearch={() => { setMobileOpen(false); setSearchOpen(true) }} />
  )

  return (
    <TooltipProvider delayDuration={200}>
      <div className="app flex min-h-screen bg-canvas text-neutral-950">
        <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 border-r border-line bg-rail lg:block">
          {sidebar('admin-nav-desktop', () => {})}
        </aside>

        <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-white/80 px-4 backdrop-blur-xl lg:hidden">
          <Link href="/admin/stats" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-black.png" alt="Hontrio" className="h-5 w-auto" />
          </Link>
          <button onClick={() => setMobileOpen(true)} className="grid size-9 place-items-center rounded-full border border-line bg-white" aria-label={t('sidebar.open_menu')}>
            <Menu className="size-4" />
          </button>
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
                {sidebar('admin-nav-mobile', () => setMobileOpen(false))}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-6 lg:px-10 lg:pt-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} admin stores={stores} activeStoreId={active?.id ?? null} onChooseStore={choose} />
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
