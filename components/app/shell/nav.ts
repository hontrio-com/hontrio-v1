import {
  BarChart3, CreditCard, LayoutDashboard, LifeBuoy, Lightbulb, Megaphone, Package, Settings, Shield, BookOpen, ImageIcon, Sparkles,
  type LucideIcon,
} from 'lucide-react'

// =============================================
// Harta platformei: ce pagini are, în ce grupe, și cuvintele după care le
// găsește căutarea (⌘K). Meniul, căutarea și calea din antet o citesc de aici.
// =============================================

export type NavItem = { label: string; href: string; icon: LucideIcon; keywords?: string[] }
export type NavGroup = { label: string | null; items: NavItem[]; admin?: boolean }

export const NAV: NavGroup[] = [
  {
    label: 'sidebar.section_ads',
    items: [
      { label: 'sidebar.dashboard', href: '/dashboard', icon: LayoutDashboard, keywords: ['dashboard', 'acasa', 'home', 'prezentare'] },
      { label: 'sidebar.campaigns', href: '/campaigns', icon: Megaphone, keywords: ['campanii', 'campaigns', 'reclame', 'ads', 'google', 'pmax', 'shopping'] },
      { label: 'sidebar.reports', href: '/reports', icon: BarChart3, keywords: ['rapoarte', 'reports', 'statistici', 'roas', 'vanzari'] },
    ],
  },
  {
    label: 'sidebar.section_store',
    items: [
      { label: 'sidebar.products', href: '/products', icon: Package, keywords: ['produse', 'products', 'catalog', 'stoc'] },
      { label: 'sidebar.ai_recommendations', href: '/recommendations', icon: Lightbulb, keywords: ['recomandari', 'recommendations', 'sugestii'] },
    ],
  },
  {
    label: 'sidebar.section_account',
    items: [
      { label: 'sidebar.settings', href: '/settings', icon: Settings, keywords: ['setari', 'settings', 'profil', 'integrari', 'google ads', 'merchant'] },
      { label: 'sidebar.subscription', href: '/credits', icon: CreditCard, keywords: ['credite', 'abonament', 'plan', 'upgrade', 'factura'] },
      { label: 'sidebar.support', href: '/support', icon: LifeBuoy, keywords: ['suport', 'support', 'ajutor', 'tichet'] },
    ],
  },
  {
    label: 'sidebar.admin',
    admin: true,
    items: [
      { label: 'dashboard.admin_panel', href: '/admin/stats', icon: Shield },
      { label: 'sidebar.blog', href: '/admin/blog', icon: BookOpen },
    ],
  },
]

/** Pagini care nu sunt în meniu, dar se găsesc din căutare. */
export const EXTRA_PAGES: NavItem[] = [
  { label: 'sidebar.ai_images', href: '/images', icon: ImageIcon, keywords: ['imagini', 'images', 'foto'] },
  { label: 'sidebar.brand_settings', href: '/settings?tab=brand', icon: Sparkles, keywords: ['brand', 'ton', 'nisa'] },
]

/** Pagina din meniu în care e omul acum (cea mai lungă potrivire de adresă). */
export function activeItem(pathname: string, admin: boolean): NavItem | null {
  const all = NAV.filter(g => !g.admin || admin).flatMap(g => g.items)
  const hits = all.filter(i => pathname === i.href || (i.href !== '/dashboard' && pathname.startsWith(i.href)) || (i.href === '/admin/stats' && pathname === '/admin'))
  return hits.sort((a, b) => b.href.length - a.href.length)[0] ?? null
}
