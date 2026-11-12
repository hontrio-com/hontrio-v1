import {
  Activity, BarChart3, MessageSquare, Send, TrendingUp, Users, Wifi,
} from 'lucide-react'
import type { NavItem } from '@/components/app/shell/nav'

// =============================================
// Harta panoului de administrare: paginile lui, pe grupe.
// =============================================

export const ADMIN_NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'admin.group_business',
    items: [
      { label: 'admin.nav_stats', href: '/admin/stats', icon: BarChart3 },
      { label: 'admin.nav_financial', href: '/admin/financial', icon: TrendingUp },
    ],
  },
  {
    label: 'admin.group_customers',
    items: [
      { label: 'admin.nav_users', href: '/admin/users', icon: Users },
      { label: 'admin.nav_tickets', href: '/admin/tickets', icon: MessageSquare },
      { label: 'admin.nav_broadcast', href: '/admin/broadcast', icon: Send },
    ],
  },
  {
    label: 'admin.group_system',
    items: [
      { label: 'admin.nav_activity', href: '/admin/activity', icon: Activity },
      { label: 'admin.nav_health', href: '/admin/health', icon: Wifi },
    ],
  },
]

/** Pagina din meniu în care e omul acum (cea mai lungă potrivire de adresă). */
export function activeAdminItem(pathname: string): NavItem | null {
  const hits = ADMIN_NAV.flatMap(g => g.items).filter(i => pathname === i.href || pathname.startsWith(`${i.href}/`))
  return hits.sort((a, b) => b.href.length - a.href.length)[0] ?? null
}
