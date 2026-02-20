'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import NotificationBell from '@/components/notification-bell'
import {
  LayoutDashboard, Package, ImageIcon, Search, CreditCard, Settings,
  LogOut, Menu, X, ChevronRight, Shield, Sparkles, AlertTriangle,
  MessageSquare, Zap, Crown, ArrowUpRight, Coins,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCredits } from '@/hooks/use-credits'

// Structured menu with sections
const menuSections = [
  {
    label: 'Principal',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Produse', href: '/products', icon: Package },
    ]
  },
  {
    label: 'Unelte',
    items: [
      { label: 'Imagini AI', href: '/images', icon: ImageIcon },
      { label: 'SEO', href: '/seo', icon: Search },
    ]
  },
  {
    label: 'Cont',
    items: [
      { label: 'Abonament', href: '/credits', icon: CreditCard },
      { label: 'Suport', href: '/support', icon: MessageSquare },
      { label: 'Setări', href: '/settings', icon: Settings },
    ]
  },
]

// Flatten for mobile
const allMenuItems = menuSections.flatMap(s => s.items)

// Search config
const searchablePages = [
  { label: 'Dashboard', href: '/dashboard', keywords: ['dashboard', 'acasă', 'home'] },
  { label: 'Produse', href: '/products', keywords: ['produse', 'products', 'catalog'] },
  { label: 'Imagini AI', href: '/images', keywords: ['imagini', 'images', 'generare', 'AI', 'foto'] },
  { label: 'SEO', href: '/seo', keywords: ['seo', 'optimizare', 'scor', 'score'] },
  { label: 'Abonament', href: '/credits', keywords: ['credite', 'credits', 'abonament', 'plan', 'upgrade'] },
  { label: 'Suport', href: '/support', keywords: ['suport', 'support', 'ajutor', 'tichet', 'help'] },
  { label: 'Setări', href: '/settings', keywords: ['setari', 'settings', 'profil', 'parolă', 'magazin'] },
  { label: 'Produs nou', href: '/products/new', keywords: ['produs nou', 'adaugă', 'creare', 'new product'] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const { credits: userCredits, plan: userPlan, avatarUrl } = useCredits()

  const userName = session?.user?.name || 'Utilizator'
  const userEmail = session?.user?.email || ''
  const userInitial = userName[0]?.toUpperCase() || 'U'
  const userRole = (session?.user as any)?.role || 'user'

  // Search results
  const searchResults = searchQuery.length > 0
    ? searchablePages.filter(p =>
        p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : []

  // Close search on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close search on navigate
  useEffect(() => {
    setSearchFocused(false)
    setSearchQuery('')
  }, [pathname])

  const navigateAndClose = (href: string) => {
    router.push(href)
    setSearchFocused(false)
    setSearchQuery('')
    setSidebarOpen(false)
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-gray-50/50 overflow-x-hidden">
        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* ===== SIDEBAR ===== */}
        <aside className={`fixed top-0 left-0 z-50 h-full bg-white border-r border-gray-100 transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
          ${collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'}
        `}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={`flex items-center h-16 border-b border-gray-100 ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
              {!collapsed ? (
                <Link href="/dashboard" className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-lg font-bold gradient-text">HONTRIO</span>
                </Link>
              ) : (
                <Link href="/dashboard">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                </Link>
              )}
              {!collapsed && (
                <button className="lg:hidden text-gray-400 hover:text-gray-600" onClick={() => setSidebarOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Structured Navigation */}
            <nav className={`flex-1 py-3 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
              {menuSections.map((section, si) => (
                <div key={section.label} className={si > 0 ? 'mt-5' : ''}>
                  {!collapsed && (
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-300 mb-2 px-3">{section.label}</p>
                  )}
                  {collapsed && si > 0 && <div className="mx-1 border-t border-gray-100 my-2" />}
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

                      const linkEl = (
                        <Link
                          key={item.href} href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200
                            ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}
                            ${isActive ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
                          `}
                        >
                          <item.icon className={`h-[18px] w-[18px] transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                          {!collapsed && <span>{item.label}</span>}
                          {!collapsed && isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />}
                        </Link>
                      )

                      return collapsed ? (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                          <TooltipContent side="right" sideOffset={10}>{item.label}</TooltipContent>
                        </Tooltip>
                      ) : linkEl
                    })}
                  </div>
                </div>
              ))}

              {/* Admin link */}
              {userRole === 'admin' && (
                <>
                  {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-300 mb-2 px-3 mt-5">Admin</p>}
                  {collapsed && <div className="mx-1 border-t border-gray-100 my-2" />}
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href="/admin/stats" className={`group flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all
                          ${pathname.startsWith('/admin') ? 'bg-red-50 text-red-600' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}>
                          <Shield className="h-[18px] w-[18px]" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={10}>Admin</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link href="/admin/stats" onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                        ${pathname.startsWith('/admin') ? 'bg-red-50 text-red-600' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}>
                      <Shield className="h-[18px] w-[18px]" /><span>Panou Admin</span>
                    </Link>
                  )}
                </>
              )}
            </nav>

            {/* Credits card — premium design */}
            {!collapsed && (
              <div className="mx-3 mb-3">
                {userCredits <= 0 ? (
                  /* Empty state */
                  <div className="rounded-2xl bg-red-600 p-4 text-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-red-100">Credite epuizate</span>
                      </div>
                      <span className="text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded-full capitalize">{userPlan}</span>
                    </div>
                    <p className="text-3xl font-bold">0</p>
                    <p className="text-[11px] text-red-200 mt-1">Cumpără credite pentru a continua</p>
                    <Link href="/credits">
                      <button className="w-full mt-3 h-9 rounded-xl bg-white text-red-700 text-xs font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" />Cumpără credite
                      </button>
                    </Link>
                  </div>
                ) : userCredits <= 5 ? (
                  /* Low state */
                  <div className="rounded-2xl bg-amber-600 p-4 text-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
                          <Coins className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-amber-100">Credite scăzute</span>
                      </div>
                      <span className="text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded-full capitalize">{userPlan}</span>
                    </div>
                    <p className="text-3xl font-bold">{userCredits}</p>
                    <div className="h-1.5 bg-white/20 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min((userCredits / 20) * 100, 100)}%` }} />
                    </div>
                    <Link href="/credits">
                      <button className="w-full mt-3 h-9 rounded-xl bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-colors flex items-center justify-center gap-1.5 border border-white/20">
                        <Coins className="h-3.5 w-3.5" />Suplimentează
                      </button>
                    </Link>
                  </div>
                ) : (
                  /* Normal state — solid blue */
                  <div className="rounded-2xl bg-blue-600 p-4 text-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
                          <Sparkles className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-blue-100">Credite disponibile</span>
                      </div>
                      <span className="text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded-full capitalize">{userPlan}</span>
                    </div>
                    <p className="text-3xl font-bold">{userCredits}</p>
                    <div className="h-1.5 bg-white/20 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min((userCredits / 100) * 100, 100)}%` }} />
                    </div>
                    <Link href="/credits">
                      <button className="w-full mt-3 h-9 rounded-xl bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-colors flex items-center justify-center gap-1.5 border border-white/20">
                        <Crown className="h-3.5 w-3.5" />Upgrade plan
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* User section */}
            <div className={`border-t border-gray-100 ${collapsed ? 'p-2' : 'p-3'}`}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => signOut({ callbackUrl: '/login' })}
                      className="w-full flex items-center justify-center p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                      <LogOut className="h-[18px] w-[18px]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>Deconectare</TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-sm font-medium">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                    <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                  </div>
                  <button onClick={() => signOut({ callbackUrl: '/login' })}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'}`}>

          {/* ===== TOP BAR ===== */}
          <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6">
            {/* Mobile menu button */}
            <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5 text-gray-600" />
            </button>

            {/* Collapse toggle */}
            <button className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 shrink-0"
              onClick={() => setCollapsed(!collapsed)}>
              <Menu className="h-4 w-4" />
            </button>

            {/* Search bar — hidden on mobile, shown on sm+ */}
            <div ref={searchRef} className="relative hidden sm:block flex-1 max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder="Caută produse, imagini, setări..."
                  className="w-full h-10 pl-10 pr-12 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-200 focus:bg-white transition-all"
                />
                <kbd className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
              </div>

              {/* Search results dropdown */}
              <AnimatePresence>
                {searchFocused && searchQuery.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute top-12 left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50"
                  >
                    {searchResults.length > 0 ? (
                      searchResults.map(result => (
                        <button key={result.href} onClick={() => navigateAndClose(result.href)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left">
                          <Search className="h-3.5 w-3.5 text-gray-400" />
                          {result.label}
                          <ArrowUpRight className="h-3 w-3 text-gray-300 ml-auto" />
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-400">Niciun rezultat</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile search icon + spacer — hidden on 640px+ */}
            <div className="contents" id="mobile-search-wrapper">
              <button
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 shrink-0"
                onClick={() => { setSearchFocused(true); setMobileSearchOpen(true) }}
                style={{ display: 'var(--mobile-only, none)' } as React.CSSProperties}
              >
                <Search className="h-5 w-5" />
              </button>
              <div className="flex-1" style={{ display: 'var(--mobile-only, none)' } as React.CSSProperties} />
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Cumpara Credite */}
              <Link href="/credits">
                <button className="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-4 rounded-xl text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-all">
                  <Coins className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="hidden md:inline">Cumpără Credite</span>
                  <span className="md:hidden">Credite</span>
                </button>
              </Link>

              {/* Upgrade Pachet */}
              <Link href="/credits">
                <button className="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all">
                  <Crown className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden md:inline">Upgrade Pachet</span>
                  <span className="md:hidden">Upgrade</span>
                </button>
              </Link>

              {/* Notification bell */}
              <NotificationBell />
            </div>
          </header>

          {/* Mobile search overlay */}
          <AnimatePresence>
            {mobileSearchOpen && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40 sm:hidden"
                onClick={() => setMobileSearchOpen(false)}
              >
                <motion.div
                  initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
                  className="bg-white p-4 shadow-lg"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Caută produse, imagini, setări..."
                      className="w-full h-11 pl-10 pr-10 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-300"
                      autoFocus
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => { setMobileSearchOpen(false); setSearchQuery('') }}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {searchQuery.length > 0 && (
                    <div className="mt-2 rounded-xl border border-gray-100 overflow-hidden">
                      {searchResults.length > 0 ? (
                        searchResults.map(result => (
                          <button key={result.href} onClick={() => { navigateAndClose(result.href); setMobileSearchOpen(false) }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0">
                            <Search className="h-3.5 w-3.5 text-gray-400" />
                            {result.label}
                            <ArrowUpRight className="h-3 w-3 text-gray-300 ml-auto" />
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-400">Niciun rezultat</div>
                      )}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Page content */}
          <main className="p-4 lg:p-8 max-w-7xl mx-auto">
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}