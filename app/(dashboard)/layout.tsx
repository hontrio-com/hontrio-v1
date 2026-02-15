'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Package,
  ImageIcon,
  Search,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCredits } from '@/hooks/use-credits'

const menuItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Produse', href: '/products', icon: Package },
  { label: 'Imagini', href: '/images', icon: ImageIcon },
  { label: 'SEO', href: '/seo', icon: Search },
  { label: 'Abonament', href: '/credits', icon: CreditCard },
  { label: 'Setări', href: '/settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Live credits from API instead of session
  const { credits: userCredits, plan: userPlan } = useCredits()

  const userName = session?.user?.name || 'Utilizator'
  const userEmail = session?.user?.email || ''
  const userInitial = userName[0]?.toUpperCase() || 'U'
  const userRole = (session?.user as any)?.role || 'user'

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-gray-50/50">
        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside
          className={`fixed top-0 left-0 z-50 h-full bg-white border-r border-gray-100 transition-all duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
            lg:translate-x-0
            ${collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'}
          `}
        >
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
                <button
                  className="lg:hidden text-gray-400 hover:text-gray-600"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Navigation */}
            <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
              {menuItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

                const linkContent = (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200
                      ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}
                      ${isActive
                        ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    <item.icon className={`h-[18px] w-[18px] transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && isActive && (
                      <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
                    )}
                  </Link>
                )

                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        {linkContent}
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={10}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return linkContent
              })}

              {/* Admin link */}
              {userRole === 'admin' && (
                <>
                  <div className={`${collapsed ? 'mx-1' : 'mx-3'} border-t border-gray-100 my-3`} />
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href="/admin/stats"
                          className={`group flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all
                            ${pathname.startsWith('/admin')
                              ? 'bg-red-50 text-red-600'
                              : 'text-red-400 hover:text-red-600 hover:bg-red-50'
                            }
                          `}
                        >
                          <Shield className="h-[18px] w-[18px]" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={10}>Admin</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link
                      href="/admin/stats"
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                        ${pathname.startsWith('/admin')
                          ? 'bg-red-50 text-red-600'
                          : 'text-red-400 hover:text-red-600 hover:bg-red-50'
                        }
                      `}
                    >
                      <Shield className="h-[18px] w-[18px]" />
                      <span>Admin</span>
                    </Link>
                  )}
                </>
              )}
            </nav>

            {/* Credits card — 3 states */}
            {!collapsed && (
              <div className="mx-3 mb-3">
                {userCredits <= 0 ? (
                  <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Credite epuizate
                      </span>
                      <Badge variant="secondary" className="bg-red-200/60 text-red-700 text-xs capitalize">
                        {userPlan}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-red-900">0</p>
                    <Link href="/credits">
                      <Button size="sm" className="w-full mt-2 text-xs bg-red-600 hover:bg-red-700 text-white h-8 rounded-lg">
                        Fă upgrade acum
                      </Button>
                    </Link>
                  </div>
                ) : userCredits <= 5 ? (
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-yellow-700 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Credite scăzute
                      </span>
                      <Badge variant="secondary" className="bg-yellow-200/60 text-yellow-800 text-xs capitalize">
                        {userPlan}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-yellow-900">{userCredits}</p>
                    <div className="h-1.5 bg-yellow-200 rounded-full mt-2">
                      <div
                        className="h-full bg-yellow-500 rounded-full"
                        style={{ width: `${Math.min((userCredits / 20) * 100, 100)}%` }}
                      />
                    </div>
                    <Link href="/credits">
                      <Button size="sm" variant="ghost" className="w-full mt-2 text-xs text-yellow-700 hover:text-yellow-800 hover:bg-yellow-100/50 h-8">
                        Suplimentează credite
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-blue-600">Credite disponibile</span>
                      <Badge variant="secondary" className="bg-white/80 text-blue-700 text-xs capitalize">
                        {userPlan}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">{userCredits}</p>
                    <div className="h-1.5 bg-blue-100 rounded-full mt-2">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                        style={{ width: `${Math.min((userCredits / 20) * 100, 100)}%` }}
                      />
                    </div>
                    <Link href="/credits">
                      <Button size="sm" variant="ghost" className="w-full mt-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100/50 h-8">
                        Upgrade plan
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
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
                    <button
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="w-full flex items-center justify-center p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <LogOut className="h-[18px] w-[18px]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>Deconectare</TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-sm font-medium">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                    <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'}`}>
          {/* Top bar */}
          <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center px-4 lg:px-8">
            <button
              className="lg:hidden mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>

            <button
              className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              onClick={() => setCollapsed(!collapsed)}
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-gray-500">
                  Plan <span className="font-medium text-gray-700 capitalize">{userPlan}</span>
                </span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="p-4 lg:p-8 max-w-7xl mx-auto">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}