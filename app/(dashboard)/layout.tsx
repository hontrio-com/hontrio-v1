'use client'

import { useSession, signOut } from 'next-auth/react'
import { useT } from '@/lib/i18n/context'
import type { UILocale } from '@/lib/i18n/context'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import NotificationBell from '@/components/notification-bell'
import {
  LayoutDashboard, Shield, Package, ImageIcon, Search, CreditCard, Settings,
  LogOut, Menu, X, ChevronRight, Sparkles, AlertTriangle,
  MessageSquare, Zap, Crown, ArrowUpRight, Bot,
  MessageCircle, TrendingUp, FileText, Tag, Clock, Loader2,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCredits } from '@/hooks/use-credits'

// ─── Menu config ────────────────────────────────────────────────────────────

const menuSections = [
  { label: '', items: [
    { label: 'sidebar.dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'sidebar.products', href: '/products', icon: Package },
  ]},
  { label: '', items: [
    { label: 'sidebar.ai_agent', href: '/agent', icon: Bot },
    { label: 'sidebar.ai_images', href: '/images', icon: ImageIcon },
    { label: 'sidebar.seo', href: '/seo', icon: Search },
    { label: 'sidebar.risk_shield', href: '/risk', icon: Shield },
  ]},
  { label: '', items: [
    { label: 'sidebar.subscription', href: '/credits', icon: CreditCard },
    { label: 'sidebar.settings', href: '/settings', icon: Settings },
    { label: 'sidebar.support', href: '/support', icon: MessageSquare },
  ]},
]

const agentSubMenu = [
  { label: 'sidebar.config', href: '/agent', icon: Settings },
  { label: 'sidebar.triggers', href: '/agent/triggers', icon: Zap },
  { label: 'sidebar.inbox', href: '/agent/inbox', icon: MessageCircle },
  { label: 'sidebar.insights', href: '/agent/insights', icon: TrendingUp },
]

const seoSubMenu = [
  { label: 'sidebar.seo_optimize', href: '/seo', icon: Search },
  { label: 'sidebar.seo_competitors', href: '/seo/competitor', icon: TrendingUp },
]

const PAGES = [
  { label: 'sidebar.dashboard', href: '/dashboard', icon: LayoutDashboard, keywords: ['dashboard', 'acasa', 'home'] },
  { label: 'sidebar.products', href: '/products', icon: Package, keywords: ['produse', 'products', 'catalog'] },
  { label: 'sidebar.ai_images', href: '/images', icon: ImageIcon, keywords: ['imagini', 'images', 'generare', 'AI', 'foto'] },
  { label: 'sidebar.seo_optimize', href: '/seo', icon: Search, keywords: ['seo', 'optimizare', 'scor'] },
  { label: 'sidebar.ai_agent', href: '/agent', icon: Bot, keywords: ['agent', 'chat', 'asistent', 'bot'] },
  { label: 'sidebar.risk_shield', href: '/risk', icon: Shield, keywords: ['risk', 'retur', 'frauda', 'blacklist'] },
  { label: 'sidebar.agent_triggers', href: '/agent/triggers', icon: Zap, keywords: ['triggeri', 'triggers', 'proactiv'] },
  { label: 'sidebar.agent_inbox', href: '/agent/inbox', icon: MessageCircle, keywords: ['inbox', 'mesaje', 'conversatii'] },
  { label: 'sidebar.subscription', href: '/credits', icon: CreditCard, keywords: ['credite', 'abonament', 'plan', 'upgrade'] },
  { label: 'sidebar.support', href: '/support', icon: MessageSquare, keywords: ['suport', 'support', 'ajutor', 'tichet'] },
  { label: 'sidebar.settings', href: '/settings', icon: Settings, keywords: ['setari', 'settings', 'profil', 'parola'] },
  { label: 'sidebar.brand_settings', href: '/settings?tab=brand', icon: Sparkles, keywords: ['brand', 'ton', 'nisa'] },
]

// ─── Search Dropdown ────────────────────────────────────────────────────────

const STYLE_LABELS: Record<string, string> = { white_background: 'Fundal Alb', lifestyle: 'Lifestyle', premium_dark: 'Premium Dark', artisan: 'Artisan', seasonal: 'Sezonier', manual: 'Custom' }

function SearchDropdown({ results, loading, query, onNavigate }: { results: { products: any[]; images: any[]; pages: any[] }; loading: boolean; query: string; onNavigate: (h: string) => void }) {
  const { t } = useT()
  const hasAny = results.products.length > 0 || results.images.length > 0 || results.pages.length > 0
  if (loading && !hasAny) return <div className="flex items-center gap-2 px-4 py-4 text-sm text-neutral-400"><Loader2 className="h-4 w-4 animate-spin" />{t('common.loading')}</div>
  if (!hasAny) return <div className="px-4 py-5 text-center"><Search className="h-7 w-7 text-neutral-200 mx-auto mb-2" /><p className="text-sm text-neutral-400">{t('common.no_results')} "{query}"</p></div>
  return (
    <div className="py-1">
      {results.products.length > 0 && (<div>
        <div className="flex items-center gap-2 px-4 py-2 bg-neutral-50"><Package className="h-3.5 w-3.5 text-neutral-400" /><span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{t('sidebar.products')}</span>{loading && <Loader2 className="h-3 w-3 animate-spin text-neutral-300 ml-auto" />}</div>
        {results.products.map((p: any) => (
          <button key={p.id} onClick={() => onNavigate('/seo/' + p.id)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left group">
            {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0 border border-neutral-100" /> : <div className="h-9 w-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-neutral-300" /></div>}
            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-neutral-800 truncate group-hover:text-neutral-900">{p.optimized_title || p.original_title}</p>
              <div className="flex items-center gap-2 mt-0.5">{p.category && <span className="text-[10px] text-neutral-400 flex items-center gap-1"><Tag className="h-2.5 w-2.5" />{p.category}</span>}<span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500">SEO {p.seo_score || 0}</span></div>
            </div><ArrowUpRight className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 shrink-0" />
          </button>
        ))}
        <button onClick={() => onNavigate('/products?search=' + encodeURIComponent(query))} className="w-full flex items-center gap-2 px-4 py-2 text-xs text-neutral-500 hover:bg-neutral-50 transition-colors border-t border-neutral-50"><Search className="h-3 w-3" />{t('dashboard.view_all')} "{query}"<ArrowUpRight className="h-3 w-3 ml-auto" /></button>
      </div>)}
      {results.images.length > 0 && (<div>
        <div className="flex items-center gap-2 px-4 py-2 bg-neutral-50 border-t border-neutral-100"><ImageIcon className="h-3.5 w-3.5 text-neutral-400" /><span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{t('dashboard.ai_images_label')}</span></div>
        <div className="px-4 py-3 flex gap-2 overflow-x-auto">
          {results.images.map((img: any) => (<button key={img.id} onClick={() => onNavigate('/images')} className="shrink-0 group relative rounded-lg overflow-hidden border border-neutral-100 hover:border-neutral-300 transition-all"><img src={img.image_url} alt={img.product_title} className="h-16 w-16 object-cover" /></button>))}
        </div>
      </div>)}
      {results.pages.length > 0 && (<div>
        <div className="flex items-center gap-2 px-4 py-2 bg-neutral-50 border-t border-neutral-100"><FileText className="h-3.5 w-3.5 text-neutral-400" /><span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{t('dashboard.pages_label')}</span></div>
        {results.pages.map((p: any) => { const PIcon = p.icon || FileText; return (
          <button key={p.href} onClick={() => onNavigate(p.href)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left group">
            <div className="h-7 w-7 rounded-lg bg-neutral-100 group-hover:bg-neutral-200 flex items-center justify-center shrink-0 transition-colors"><PIcon className="h-3.5 w-3.5 text-neutral-500" /></div>
            <span className="text-sm text-neutral-700 flex-1">{p.label}</span><ArrowUpRight className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 shrink-0" />
          </button>
        )})}
      </div>)}
    </div>
  )
}

function useSearchShortcut(onOpen: () => void) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); onOpen() } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onOpen])
}

// ─── Layout ─────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const { t } = useT()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<{ products: any[]; images: any[]; pages: any[] }>({ products: [], images: [], pages: [] })
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { credits: userCredits, plan: userPlan, avatarUrl } = useCredits()
  const searchInputRef = useRef<HTMLInputElement>(null)
  useSearchShortcut(() => { setSearchFocused(true); searchInputRef.current?.focus() })

  const userName = session?.user?.name || 'Utilizator'
  const userEmail = session?.user?.email || ''
  const userInitial = userName[0]?.toUpperCase() || 'U'
  const userRole = (session?.user as any)?.role || 'user'
  const isAgentSection = pathname.startsWith('/agent')
  const isSeoSection = pathname.startsWith('/seo')

  useEffect(() => { if (!session?.user || userRole === 'admin') return; fetch('/api/user/me').then(r => r.json()).then(d => { if (d.user?.onboarding_completed === false) window.location.href = '/onboarding' }).catch(() => {}) }, [session, userRole])

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults({ products: [], images: [], pages: [] }); return }
    const matchedPages = PAGES.filter(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()) || p.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase())))
    setSearchResults(prev => ({ ...prev, pages: matchedPages }))
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(async () => { setSearchLoading(true); try { const res = await fetch('/api/search?q=' + encodeURIComponent(searchQuery)); const data = await res.json(); setSearchResults(prev => ({ ...prev, products: data.products || [], images: data.images || [] })) } catch {} finally { setSearchLoading(false) } }, 300)
  }, [searchQuery])

  useEffect(() => { const h = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocused(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  useEffect(() => { setSearchFocused(false); setSearchQuery(''); setSearchResults({ products: [], images: [], pages: [] }) }, [pathname])

  const navigateAndClose = (href: string) => { router.push(href); setSearchFocused(false); setSearchQuery(''); setSidebarOpen(false) }

  // ─── Render submenu helper ──────────────────────────────────────────────

  function renderSubMenu(items: typeof agentSubMenu, isSection: boolean) {
    if (!isSection) return null
    if (collapsed) return (
      <div className="mt-1 space-y-0.5">
        {items.map(sub => { const isSubActive = sub.href === '/seo/competitor' ? pathname.startsWith('/seo/competitor') : sub.href === '/seo' ? (pathname === '/seo' || (pathname.startsWith('/seo/') && !pathname.startsWith('/seo/competitor'))) : pathname === sub.href; return (
          <Tooltip key={sub.href}><TooltipTrigger asChild><Link href={sub.href} className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${isSubActive ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50'}`}><sub.icon className="h-[18px] w-[18px]" /></Link></TooltipTrigger><TooltipContent side="right" sideOffset={10}>{t(sub.label)}</TooltipContent></Tooltip>
        )})}
      </div>
    )
    return (
      <div className="mt-1 ml-3 border-l-2 border-neutral-100 pl-2 space-y-0.5 pb-1">
        {items.map(sub => { const isSubActive = sub.href === '/seo/competitor' ? pathname.startsWith('/seo/competitor') : sub.href === '/seo' ? (pathname === '/seo' || (pathname.startsWith('/seo/') && !pathname.startsWith('/seo/competitor'))) : pathname === sub.href; return (
          <Link key={sub.href} href={sub.href} onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${isSubActive ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50'}`}>
            <sub.icon className={`h-3.5 w-3.5 shrink-0 ${isSubActive ? 'text-neutral-700' : 'text-neutral-300'}`} /><span>{t(sub.label)}</span>
            {isSubActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-neutral-900" />}
          </Link>
        )})}
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-neutral-50/50 overflow-x-hidden">
        {/* Mobile overlay */}
        <AnimatePresence>{sidebarOpen && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />)}</AnimatePresence>

        {/* ═══ SIDEBAR ═══ */}
        <aside className={`fixed top-0 left-0 z-50 h-full bg-white border-r border-neutral-100 transition-all duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 ${collapsed ? 'lg:w-[72px]' : 'lg:w-[250px]'}`}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={`flex items-center h-16 border-b border-neutral-100 ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
              {!collapsed ? (
                <Link href="/dashboard" className="flex items-center gap-2"><img src="/logo-black.png" alt="Hontrio" style={{ height: 22, width: 'auto' }} /></Link>
              ) : (
                <Link href="/dashboard"><img src="/logo-icon.png" alt="Hontrio" style={{ height: 28, width: 'auto' }} /></Link>
              )}
              {!collapsed && <button className="lg:hidden text-neutral-400 hover:text-neutral-600" onClick={() => setSidebarOpen(false)}><X className="h-5 w-5" /></button>}
            </div>

            {/* Nav */}
            <nav className={`flex-1 py-3 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
              {menuSections.map((section, si) => (
                <div key={si} className={si > 0 ? 'mt-1' : ''}>
                  {si > 0 && <div className={`border-t border-neutral-100 ${collapsed ? 'mx-1' : 'mx-2'} mb-1`} />}
                  <div className="space-y-0.5">
                    {section.items.map(item => {
                      const isAgent = item.href === '/agent'; const isSeo = item.href === '/seo'
                      const isActive = !isAgent && !isSeo && (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)))
                      const isAgentActive = isAgent && isAgentSection; const isSeoActive = isSeo && isSeoSection
                      const active = isActive || isAgentActive || isSeoActive

                      const link = (
                        <div key={item.href}>
                          <Link href={item.href} onClick={() => setSidebarOpen(false)}
                            className={`group flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200 ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'} ${active ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'}`}>
                            <item.icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? 'text-neutral-900' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                            {!collapsed && <span>{t(item.label)}</span>}
                            {!collapsed && (isAgent || isSeo) && <ChevronRight className={`ml-auto h-3.5 w-3.5 transition-transform duration-200 ${(isAgentActive || isSeoActive) ? 'rotate-90 text-neutral-400' : 'text-neutral-300'}`} />}
                            {!collapsed && !isAgent && !isSeo && active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-neutral-900" />}
                          </Link>
                          {isAgent && renderSubMenu(agentSubMenu, isAgentSection)}
                          {isSeo && renderSubMenu(seoSubMenu, isSeoSection)}
                        </div>
                      )

                      return collapsed && !isAgent && !isSeo ? (
                        <Tooltip key={item.href}><TooltipTrigger asChild><div>{link}</div></TooltipTrigger><TooltipContent side="right" sideOffset={10}>{t(item.label)}</TooltipContent></Tooltip>
                      ) : <div key={item.href}>{link}</div>
                    })}
                  </div>
                </div>
              ))}

              {userRole === 'admin' && (<>
                {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-300 mb-2 px-3 mt-5">Admin</p>}
                {collapsed && <div className="mx-1 border-t border-neutral-100 my-2" />}
                {collapsed ? (
                  <Tooltip><TooltipTrigger asChild><Link href="/admin/stats" className={`group flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all ${pathname.startsWith('/admin') ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'}`}><Shield className="h-[18px] w-[18px]" /></Link></TooltipTrigger><TooltipContent side="right" sideOffset={10}>Admin</TooltipContent></Tooltip>
                ) : (
                  <Link href="/admin/stats" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${pathname.startsWith('/admin') ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'}`}><Shield className="h-[18px] w-[18px]" /><span>{t('dashboard.admin_panel')}</span></Link>
                )}
              </>)}
            </nav>

            {/* Credits card */}
            {!collapsed && (
              <div className="mx-3 mb-3">
                <div className="rounded-xl p-4 bg-neutral-900 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-neutral-400">{t('common.credits_label')}</span>
                    <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">{userPlan}</span>
                  </div>
                  <p className="text-2xl font-bold">{userCredits}</p>
                  <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${userCredits <= 5 ? 'bg-red-400' : userCredits <= 20 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min((userCredits / 100) * 100, 100)}%` }} />
                  </div>
                  <Link href="/credits">
                    <button className="w-full mt-3 h-8 rounded-lg bg-white/10 text-white text-[12px] font-medium hover:bg-white/15 transition-colors flex items-center justify-center gap-1.5 border border-white/10">
                      {userCredits <= 5 ? <><Zap className="h-3 w-3" />{t('credits.buy_credits')}</> : <><Crown className="h-3 w-3" />{t('common.upgrade_plan')}</>}
                    </button>
                  </Link>
                </div>
              </div>
            )}

            {/* User */}
            <div className={`border-t border-neutral-100 ${collapsed ? 'p-2' : 'p-3'}`}>
              {collapsed ? (
                <Tooltip><TooltipTrigger asChild><button onClick={() => signOut({ callbackUrl: '/login' })} className="w-full flex items-center justify-center p-2.5 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-all"><LogOut className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent side="right" sideOffset={10}>{t('common.logout')}</TooltipContent></Tooltip>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-neutral-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {avatarUrl ? <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" /> : <span className="text-sm font-semibold text-neutral-500">{userInitial}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-neutral-900 truncate">{userName}</p>
                    <p className="text-[11px] text-neutral-400 truncate">{userEmail}</p>
                  </div>
                  <button onClick={() => signOut({ callbackUrl: '/login' })} className="p-1.5 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all"><LogOut className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ═══ MAIN ═══ */}
        <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-[250px]'}`}>
          {/* TOPBAR */}
          <header className="sticky top-0 z-30 h-14 bg-white/80 backdrop-blur-md border-b border-neutral-100 flex items-center gap-2 px-3 sm:px-4 lg:px-6">
            <button className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors shrink-0" onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5 text-neutral-600" /></button>
            <button className="hidden lg:flex p-1.5 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-400 hover:text-neutral-600 shrink-0" onClick={() => setCollapsed(!collapsed)}><Menu className="h-4 w-4" /></button>

            {/* Search */}
            <div ref={searchRef} className="relative hidden sm:block flex-1 max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-300 pointer-events-none" />
                <input ref={searchInputRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={() => setSearchFocused(true)}
                  placeholder={t('common.search_placeholder')} className="w-full h-10 pl-10 pr-12 rounded-xl bg-neutral-50 border border-neutral-100 text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-300 focus:bg-white transition-all" />
                <kbd className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
              </div>
              <AnimatePresence>{searchFocused && searchQuery.length >= 2 && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                  className="absolute top-12 left-0 right-0 bg-white rounded-xl shadow-xl border border-neutral-100 overflow-hidden z-50 max-h-[520px] overflow-y-auto">
                  <SearchDropdown results={searchResults} loading={searchLoading} query={searchQuery} onNavigate={navigateAndClose} />
                </motion.div>
              )}</AnimatePresence>
            </div>

            {/* Mobile search trigger */}
            <button className="p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-400 shrink-0 sm:hidden" onClick={() => { setSearchFocused(true); setMobileSearchOpen(true) }}><Search className="h-5 w-5" /></button>
            <div className="flex-1 sm:hidden" />

            {/* Right actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Link href="/credits"><button className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-medium text-neutral-600 hover:bg-neutral-100 border border-neutral-100 transition-all"><Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" /><span className="hidden md:inline">{t('common.credits_label')}</span></button></Link>
              <Link href="/credits"><button className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold text-white bg-neutral-900 hover:bg-neutral-800 transition-all"><Crown className="h-3.5 w-3.5 shrink-0" /><span className="hidden md:inline">{t("common.upgrade")}</span></button></Link>
              <NotificationBell />
            </div>
          </header>

          {/* Mobile search overlay */}
          <AnimatePresence>{mobileSearchOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 sm:hidden" onClick={() => setMobileSearchOpen(false)}>
              <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="bg-white p-4 shadow-lg" onClick={e => e.stopPropagation()}>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-300 pointer-events-none" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('common.search_placeholder')} className="w-full h-11 pl-10 pr-10 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-300" autoFocus />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" onClick={() => { setMobileSearchOpen(false); setSearchQuery('') }}><X className="h-4 w-4" /></button>
                </div>
                {searchQuery.length >= 2 && (<div className="mt-2 rounded-xl border border-neutral-100 overflow-hidden max-h-[60vh] overflow-y-auto"><SearchDropdown results={searchResults} loading={searchLoading} query={searchQuery} onNavigate={(h) => { navigateAndClose(h); setMobileSearchOpen(false) }} /></div>)}
              </motion.div>
            </motion.div>
          )}</AnimatePresence>

          <main className="p-4 lg:p-8 max-w-7xl mx-auto">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}