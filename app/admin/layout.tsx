'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Users,
  BarChart3,
  DollarSign,
  Shield,
  Sparkles,
  Activity,
  Settings,
  Package,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const adminMenuItems = [
  { label: 'Statistici', href: '/admin/stats', icon: BarChart3 },
  { label: 'Utilizatori', href: '/admin/users', icon: Users },
  { label: 'Tichete', href: '/admin/tickets', icon: MessageSquare },
  { label: 'Costuri API', href: '/admin/costs', icon: DollarSign },
  { label: 'Activitate', href: '/admin/activity', icon: Activity },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 h-14 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard')}
          className="rounded-xl text-gray-500 hover:text-gray-900 -ml-2 mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Dashboard
        </Button>

        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-gray-900">Admin Panel</span>
          <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">Admin</Badge>
        </div>

        <div className="flex-1" />

        <span className="text-xs text-gray-400">{session?.user?.email}</span>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-100 min-h-[calc(100vh-3.5rem)] sticky top-14">
          <nav className="p-3 space-y-1 mt-2">
            {adminMenuItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-red-50 text-red-600 shadow-sm shadow-red-100'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className={`h-[18px] w-[18px] ${isActive ? 'text-red-600' : 'text-gray-400'}`} />
                  {item.label}
                  {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-red-600" />}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6 max-w-7xl">
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
  )
}