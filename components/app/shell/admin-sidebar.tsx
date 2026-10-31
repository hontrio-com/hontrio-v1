'use client'

import Link from 'next/link'
import { ArrowLeft, Search, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Badge, Kbd } from '@/components/app/badge'
import { NavLink } from '@/components/app/shell/sidebar'
import { ADMIN_NAV, activeAdminItem } from '@/components/app/shell/admin-nav'

// =============================================
// Meniul panoului de administrare: același aspect ca meniul platformei, cu
// drumul înapoi spre platformă, sus. Paginile stau pe grupe.
// =============================================

export function AdminSidebar({ pathname, user, onNavigate, onSearch }: {
  pathname: string
  user: { name: string; email: string }
  onNavigate: () => void
  onSearch: () => void
}) {
  const { t } = useT()
  const current = activeAdminItem(pathname)

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between pl-5 pr-3">
        <div className="flex items-center gap-2">
          <Link href="/admin/stats" onClick={onNavigate} className="flex items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-neutral-900/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-black.png" alt="Hontrio" className="h-[22px] w-auto" />
          </Link>
          <Badge tone="brand" className="h-[18px] px-1 text-[10px]">{t('admin.layout_badge')}</Badge>
        </div>
        <button onClick={onNavigate} aria-label={t('common.close')}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-black/[0.04] hover:text-neutral-700 lg:hidden">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-2 px-3 pb-2">
        <Link href="/dashboard" onClick={onNavigate}
          className="group flex h-8 items-center gap-2 rounded-lg bg-white px-2.5 text-[13px] font-medium text-neutral-700 shadow-[0_1px_2px_rgb(16_24_40/0.04)] ring-1 ring-black/[0.07] transition-colors hover:text-neutral-950 hover:ring-black/[0.12]">
          <ArrowLeft className="size-3.5 text-neutral-400 transition-transform group-hover:-translate-x-0.5" />
          {t('admin.back_to_platform')}
        </Link>
        <button onClick={onSearch}
          className="flex h-8 w-full items-center gap-2 rounded-lg bg-white px-2.5 text-[13px] text-neutral-500 shadow-[0_1px_2px_rgb(16_24_40/0.04)] ring-1 ring-black/[0.06] transition-colors hover:text-neutral-700 hover:ring-black/10">
          <Search className="size-3.5" />
          <span className="flex-1 text-left">{t('sidebar.search')}</span>
          <Kbd className="h-[18px] text-[10px]">⌘K</Kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {ADMIN_NAV.map((g, i) => (
          <div key={g.label} className={i > 0 ? 'mt-5' : 'mt-2'}>
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{t(g.label)}</p>
            <ul className="space-y-0.5">
              {g.items.map(item => (
                <li key={item.href}>
                  <NavLink item={item} active={current?.href === item.href} collapsed={false} onNavigate={onNavigate} label={t(item.label)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-black/[0.06] px-5 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[12px] font-semibold text-neutral-600">{user.name[0]?.toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-neutral-900">{user.name}</span>
          <span className="block truncate text-[11px] text-neutral-500">{user.email}</span>
        </span>
      </div>
    </div>
  )
}
