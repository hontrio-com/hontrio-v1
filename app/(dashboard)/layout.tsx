'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import NotificationBell from '@/components/notification-bell'
import {
  LayoutDashboard, Package, ImageIcon, Search, CreditCard, Settings,
  LogOut, Menu, X, ChevronRight, Shield, Sparkles, AlertTriangle,
  MessageSquare, Zap, Crown, ArrowUpRight, Coins, Video, Bot,
  MessageCircle, TrendingUp, FileText, Star, Tag, Clock, Loader2,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCredits } from '@/hooks/use-credits'

const menuSections = [
  {
    label: '',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Produse', href: '/products', icon: Package },
    ]
  },
  {
    label: '',
    items: [
      { label: 'AI Agent', href: '/agent', icon: Bot },
      { label: 'Imagini AI', href: '/images', icon: ImageIcon },
      { label: 'Optimizare SEO', href: '/seo', icon: Search },
    ]
  },
  {
    label: '',
    items: [
      { label: 'Abonament', href: '/credits', icon: CreditCard },
      { label: 'Setări', href: '/settings', icon: Settings },
      { label: 'Suport', href: '/support', icon: MessageSquare },
    ]
  },
]

const allMenuItems = menuSections.flatMap(s => s.items)

const agentSubMenu = [
  { label: 'Configurare', href: '/agent', icon: Settings },
  { label: 'Triggeri', href: '/agent/triggers', icon: Zap },
  { label: 'Inbox', href: '/agent/inbox', icon: MessageCircle },
  { label: 'Insights', href: '/agent/insights', icon: TrendingUp },
]

const PAGES = [
  { label: 'Dashboard',       href: '/dashboard',        icon: LayoutDashboard, keywords: ['dashboard', 'acasă', 'home'] },
  { label: 'Produse',         href: '/products',         icon: Package,         keywords: ['produse', 'products', 'catalog'] },
  { label: 'Imagini AI',      href: '/images',           icon: ImageIcon,       keywords: ['imagini', 'images', 'generare', 'AI', 'foto', 'imagine'] },
  { label: 'Optimizare SEO',  href: '/seo',              icon: Search,          keywords: ['seo', 'optimizare', 'scor', 'score'] },
  { label: 'AI Agent',        href: '/agent',            icon: Bot,             keywords: ['agent', 'chat', 'asistent', 'conversatie', 'bot', 'ai'] },
  { label: 'Triggeri Agent',  href: '/agent/triggers',   icon: Zap,             keywords: ['triggeri', 'triggers', 'proactiv', 'exit', 'scroll'] },
  { label: 'Inbox Agent',     href: '/agent/inbox',      icon: MessageCircle,   keywords: ['inbox', 'mesaje', 'conversatii'] },
  { label: 'Abonament',       href: '/credits',          icon: CreditCard,      keywords: ['credite', 'credits', 'abonament', 'plan', 'upgrade', 'plata'] },
  { label: 'Suport',          href: '/support',          icon: MessageSquare,   keywords: ['suport', 'support', 'ajutor', 'tichet', 'help'] },
  { label: 'Setări',          href: '/settings',         icon: Settings,        keywords: ['setari', 'settings', 'profil', 'parolă', 'magazin', 'brand'] },
  { label: 'Setări Brand',    href: '/settings?tab=brand', icon: Sparkles,      keywords: ['brand', 'ton', 'nisa', 'limba', 'business'] },
  { label: 'Setări Credite',  href: '/settings?tab=credits', icon: CreditCard,  keywords: ['credite', 'tranzactii', 'pack', 'cumparare'] },
]

// ─── Search Dropdown Component ────────────────────────────────────────────────

const SEO_SCORE_COLOR = (score: number) => {
  if (score === 0)  return 'bg-gray-100 text-gray-500'
  if (score < 80)   return 'bg-amber-50 text-amber-600'
  return 'bg-emerald-50 text-emerald-600'
}

const STYLE_LABELS: Record<string, string> = {
  white_background: 'Fundal Alb',
  lifestyle: 'Lifestyle',
  premium_dark: 'Premium Dark',
  artisan: 'Artisan',
  seasonal: 'Sezonier',
  manual: 'Custom',
}

function SearchDropdown({
  results, loading, query, onNavigate
}: {
  results: { products: any[]; images: any[]; pages: any[] }
  loading: boolean
  query: string
  onNavigate: (href: string) => void
}) {
  const hasProducts = results.products.length > 0
  const hasImages   = results.images.length > 0
  const hasPages    = results.pages.length > 0
  const hasAny      = hasProducts || hasImages || hasPages

  if (loading && !hasAny) {
    return (
      <div className="flex items-center gap-2 px-4 py-4 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />Caută...
      </div>
    )
  }

  if (!hasAny) {
    return (
      <div className="px-4 py-5 text-center">
        <Search className="h-8 w-8 text-gray-200 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Niciun rezultat pentru <span className="font-medium text-gray-600">"{query}"</span></p>
      </div>
    )
  }

  return (
    <div className="py-1">
      {/* Products */}
      {hasProducts && (
        <div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50">
            <Package className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Produse</span>
            {loading && <Loader2 className="h-3 w-3 animate-spin text-gray-300 ml-auto" />}
          </div>
          {results.products.map((p: any) => (
            <button key={p.id} onClick={() => onNavigate('/seo/' + p.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left group">
              {p.image_url
                ? <img src={p.image_url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0 border border-gray-100" />
                : <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-gray-300" /></div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-700">
                  {p.optimized_title || p.original_title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {p.category && <span className="text-[10px] text-gray-400 flex items-center gap-1"><Tag className="h-2.5 w-2.5" />{p.category}</span>}
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${SEO_SCORE_COLOR(p.seo_score || 0)}`}>
                    SEO {p.seo_score || 0}
                  </span>
                </div>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-400 shrink-0" />
            </button>
          ))}
          <button onClick={() => onNavigate('/products?search=' + encodeURIComponent(query))}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-50">
            <Search className="h-3 w-3" />
            Vezi toate produsele cu "{query}"
            <ArrowUpRight className="h-3 w-3 ml-auto" />
          </button>
        </div>
      )}

      {/* Images */}
      {hasImages && (
        <div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-t border-gray-100">
            <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Imagini AI</span>
          </div>
          <div className="px-4 py-3 flex gap-2 overflow-x-auto">
            {results.images.map((img: any) => (
              <button key={img.id} onClick={() => onNavigate('/images')}
                className="shrink-0 group relative rounded-xl overflow-hidden border border-gray-100 hover:border-blue-200 transition-all">
                <img src={img.image_url} alt={img.product_title} className="h-20 w-20 object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-end">
                  <div className="w-full p-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-all">
                    <p className="text-[9px] text-white font-medium truncate">{img.product_title}</p>
                    <p className="text-[8px] text-gray-300">{STYLE_LABELS[img.style] || img.style}</p>
                  </div>
                </div>
              </button>
            ))}
            <button onClick={() => onNavigate('/images')}
              className="shrink-0 h-20 w-20 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-blue-500 transition-all">
              <ImageIcon className="h-5 w-5" />
              <span className="text-[9px] font-medium">Toate</span>
            </button>
          </div>
        </div>
      )}

      {/* Pages */}
      {hasPages && (
        <div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-t border-gray-100">
            <FileText className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Pagini</span>
          </div>
          {results.pages.map((p: any) => {
            const PIcon = p.icon || FileText
            return (
              <button key={p.href} onClick={() => onNavigate(p.href)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left group">
                <div className="h-7 w-7 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                  <PIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-blue-600" />
                </div>
                <span className="text-sm text-gray-700 group-hover:text-blue-700 flex-1">{p.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-400 shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Keyboard shortcut helper ──────────────────────────────────────────────────

function useSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpen])
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
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
  useSearchShortcut(() => {
    setSearchFocused(true)
    searchInputRef.current?.focus()
  })

  const userName = session?.user?.name || 'Utilizator'
  const userEmail = session?.user?.email || ''
  const userInitial = userName[0]?.toUpperCase() || 'U'
  const userRole = (session?.user as any)?.role || 'user'
  const isAgentSection = pathname.startsWith('/agent')

  useEffect(() => {
    if (!session?.user) return
    if (userRole === 'admin') return
    fetch('/api/user/me')
      .then(r => r.json())
      .then(data => {
        if (data.user && data.user.onboarding_completed === false) {
          window.location.href = '/onboarding'
        }
      })
      .catch(() => {})
  }, [session, userRole])

  // Search: pages are filtered locally, products+images fetched from API
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults({ products: [], images: [], pages: [] })
      return
    }
    const matchedPages = PAGES.filter(p =>
      p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    setSearchResults(prev => ({ ...prev, pages: matchedPages }))

    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch('/api/search?q=' + encodeURIComponent(searchQuery))
        const data = await res.json()
        setSearchResults(prev => ({ ...prev, products: data.products || [], images: data.images || [] }))
      } catch {} finally { setSearchLoading(false) }
    }, 300)
  }, [searchQuery])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setSearchFocused(false)
    setSearchQuery('')
    setSearchResults({ products: [], images: [], pages: [] })
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
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        <aside className={`fixed top-0 left-0 z-50 h-full bg-white border-r border-gray-100 transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
          ${collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'}
        `}>
          <div className="flex flex-col h-full">
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

            <nav className={`flex-1 py-3 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
              {menuSections.map((section, si) => (
                <div key={si} className={si > 0 ? 'mt-1' : ''}>
                  {si > 0 && <div className={`border-t border-gray-100 ${collapsed ? 'mx-1' : 'mx-2'} mb-1`} />}
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isAgentItem = item.href === '/agent'
                      const isActive = !isAgentItem && (
                        pathname === item.href ||
                        (item.href !== '/dashboard' && pathname.startsWith(item.href))
                      )
                      const isAgentActive = isAgentItem && isAgentSection

                      const content = (
                        <div key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200
                              ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}
                              ${(isActive || isAgentActive) ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
                            `}
                          >
                            <item.icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${(isActive || isAgentActive) ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                            {!collapsed && <span>{item.label}</span>}
                            {!collapsed && isAgentItem && (
                              <ChevronRight className={`ml-auto h-3.5 w-3.5 transition-transform duration-200 ${isAgentSection ? 'rotate-90 text-blue-400' : 'text-gray-300'}`} />
                            )}
                            {!collapsed && !isAgentItem && isActive && (
                              <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
                            )}
                          </Link>

                          {/* Submeniu expandat - sidebar normal */}
                          {isAgentItem && isAgentSection && !collapsed && (
                            <div className="mt-1 ml-3 border-l-2 border-blue-100 pl-2 space-y-0.5 pb-1">
                              {agentSubMenu.map(sub => {
                                const isSubActive = pathname === sub.href
                                return (
                                  <Link key={sub.href} href={sub.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all
                                      ${isSubActive ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}>
                                    <sub.icon className={`h-3.5 w-3.5 shrink-0 ${isSubActive ? 'text-blue-500' : 'text-gray-300'}`} />
                                    <span>{sub.label}</span>
                                    {isSubActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />}
                                  </Link>
                                )
                              })}
                            </div>
                          )}

                          {/* Submeniu - sidebar collapsed */}
                          {isAgentItem && isAgentSection && collapsed && (
                            <div className="mt-1 space-y-0.5">
                              {agentSubMenu.map(sub => {
                                const isSubActive = pathname === sub.href
                                return (
                                  <Tooltip key={sub.href}>
                                    <TooltipTrigger asChild>
                                      <Link href={sub.href}
                                        className={`flex items-center justify-center p-2.5 rounded-xl transition-all
                                          ${isSubActive ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}>
                                        <sub.icon className="h-[18px] w-[18px]" />
                                      </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" sideOffset={10}>{sub.label}</TooltipContent>
                                  </Tooltip>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )

                      return collapsed && !isAgentItem ? (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild><div>{content}</div></TooltipTrigger>
                          <TooltipContent side="right" sideOffset={10}>{item.label}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <div key={item.href}>{content}</div>
                      )
                    })}
                  </div>
                </div>
              ))}

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

            {!collapsed && (
              <div className="mx-3 mb-3">
                {userCredits <= 0 ? (
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

        <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'}`}>
          <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6">
            <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
            <button className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 shrink-0"
              onClick={() => setCollapsed(!collapsed)}>
              <Menu className="h-4 w-4" />
            </button>

            <div ref={searchRef} className="relative hidden sm:block flex-1 max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder="Caută produse, imagini, setări..."
                  className="w-full h-10 pl-10 pr-12 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-200 focus:bg-white transition-all"
                />
                <kbd className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
              </div>
              <AnimatePresence>
                {searchFocused && searchQuery.length >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute top-12 left-0 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 max-h-[520px] overflow-y-auto"
                  >
                    <SearchDropdown
                      results={searchResults}
                      loading={searchLoading}
                      query={searchQuery}
                      onNavigate={navigateAndClose}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link href="/credits">
                <button className="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-4 rounded-xl text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-all">
                  <Coins className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="hidden md:inline">Cumpără Credite</span>
                  <span className="md:hidden">Credite</span>
                </button>
              </Link>
              <Link href="/credits">
                <button className="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all">
                  <Crown className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden md:inline">Upgrade Pachet</span>
                  <span className="md:hidden">Upgrade</span>
                </button>
              </Link>
              <NotificationBell />
            </div>
          </header>

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
                  {searchQuery.length >= 2 && (
                    <div className="mt-2 rounded-xl border border-gray-100 overflow-hidden max-h-[60vh] overflow-y-auto">
                      <SearchDropdown
                        results={searchResults}
                        loading={searchLoading}
                        query={searchQuery}
                        onNavigate={(href) => { navigateAndClose(href); setMobileSearchOpen(false) }}
                      />
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

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