'use client'

import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { NavLink } from '@/components/app/shell/sidebar'
import { ADMIN_NAV, activeAdminItem } from '@/components/app/shell/admin-nav'

// =============================================
// Meniul panoului de administrare: același aspect ca meniul platformei
// (designul Bezeno), cu drumul înapoi spre platformă în locul butonului negru.
// =============================================

export function AdminSidebar({ pathname, user, layoutId, onNavigate, onSearch }: {
  pathname: string
  user: { name: string; email: string }
  layoutId: string
  onNavigate: () => void
  onSearch: () => void
}) {
  const { t } = useT()
  const current = activeAdminItem(pathname)

  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-5">
      <div className="flex items-center gap-2 px-2">
        <Link href="/admin/stats" onClick={onNavigate} className="flex items-center rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-black/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-black.png" alt="Hontrio" className="h-[22px] w-auto select-none" draggable={false} />
        </Link>
        <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">{t('admin.layout_badge')}</span>
      </div>

      <Link href="/dashboard" onClick={onNavigate}
        className="group mt-6 flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-black">
        <ArrowLeft className="size-4 transition group-hover:-translate-x-0.5" />{t('admin.back_to_platform')}
      </Link>

      <button onClick={onSearch}
        className="mt-3 flex h-10 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm text-neutral-400 transition hover:border-neutral-300 hover:text-neutral-600">
        <Search className="size-4" />
        <span className="flex-1 text-left">{t('sidebar.search')}</span>
        <span className="rounded-md border border-line px-1.5 py-px font-mono text-[10px] text-neutral-400">⌘K</span>
      </button>

      <nav className="mt-6 flex flex-1 flex-col gap-6 overflow-y-auto [scrollbar-width:none]">
        {ADMIN_NAV.map(g => (
          <div key={g.label}>
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{t(g.label)}</div>
            <div className="flex flex-col gap-0.5">
              {g.items.map(item => (
                <NavLink key={item.href} item={item} label={t(item.label)} active={current?.href === item.href} layoutId={layoutId} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 flex items-center gap-3 rounded-2xl p-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neutral-700 to-black text-sm font-bold text-white ring-2 ring-white">
          {(user.name || user.email).slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-neutral-900">{user.name}</span>
          <span className="block truncate text-xs text-neutral-400">{user.email}</span>
        </span>
      </div>
    </div>
  )
}
