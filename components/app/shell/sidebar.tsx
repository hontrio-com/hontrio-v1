'use client'

import Link from 'next/link'
import { DropdownMenu } from 'radix-ui'
import { motion } from 'framer-motion'
import { Check, ChevronsUpDown, Languages, LogOut, Megaphone, Plus, Search, Settings, ShoppingBag, Store } from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import NotificationBell from '@/components/notification-bell'
import { NAV, activeItem, type NavItem } from '@/components/app/shell/nav'
import { PLATFORM_NAME, storeLabel, type StoreItem } from '@/components/app/shell/stores'

// =============================================
// Meniul platformei, în designul Bezeno: sus logo-ul (cu notificările) și
// butonul negru pentru o campanie nouă; la mijloc paginile, în grupe cu
// etichete mici, cea deschisă pe o pastilă albă cu un punct negru; jos
// magazinul activ cu legăturile lui și contul tău.
// =============================================

type Props = {
  pathname: string
  admin: boolean
  onNavigate: () => void
  onSearch: () => void
  stores: StoreItem[]
  activeStore: StoreItem | null
  switching: string | null
  onChooseStore: (s: StoreItem) => void
  user: { name: string; email: string; avatarUrl: string | null }
  onLogout: () => void
  /** Id unic pentru pastila paginii active (meniul de pe telefon are altul). */
  layoutId: string
}

const menuItem = 'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-neutral-700 outline-none data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-950'
const menuContent = 'app z-50 min-w-[248px] rounded-2xl border border-line bg-white p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.3)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]'

export function Sidebar(p: Props) {
  const { t } = useLocale()
  const current = activeItem(p.pathname, p.admin)

  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-5">
      {/* Logo-ul și notificările */}
      <div className="flex items-center justify-between px-2">
        <Link href="/dashboard" onClick={p.onNavigate} className="flex items-center rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-black/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-black.png" alt="Hontrio" className="h-[22px] w-auto select-none" draggable={false} />
        </Link>
        <NotificationBell />
      </div>

      {/* Acțiunea principală */}
      <Link href="/campaigns?new=1" onClick={p.onNavigate}
        className="group mt-6 flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_20px_-8px_rgba(0,0,0,0.5)] transition hover:bg-neutral-800">
        <Plus className="size-4 transition group-hover:rotate-90" />{t('sidebar.new_campaign')}
      </Link>

      {/* Căutarea (⌘K) */}
      <button onClick={p.onSearch}
        className="mt-3 flex h-10 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm text-neutral-400 transition hover:border-neutral-300 hover:text-neutral-600">
        <Search className="size-4" />
        <span className="flex-1 text-left">{t('sidebar.search')}</span>
        <span className="rounded-md border border-line px-1.5 py-px font-mono text-[10px] text-neutral-400">⌘K</span>
      </button>

      {/* Paginile */}
      <nav className="mt-6 flex flex-1 flex-col gap-6 overflow-y-auto [scrollbar-width:none]">
        {NAV.filter(g => !g.admin || p.admin).map((g, i) => (
          <div key={g.label ?? i}>
            {g.label && <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{t(g.label)}</div>}
            <div className="flex flex-col gap-0.5">
              {g.items.map(item => (
                <NavLink key={item.href} item={item} label={t(item.label)} active={current?.href === item.href} layoutId={p.layoutId} onNavigate={p.onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 space-y-2">
        <StoreCard {...p} />
        <UserCard {...p} />
      </div>
    </div>
  )
}

export function NavLink({ item, label, active, layoutId, onNavigate }: {
  item: NavItem; label: string; active: boolean; layoutId: string; onNavigate: () => void
}) {
  return (
    <Link href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
      className={cn('relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
        active ? 'text-black' : 'text-neutral-500 hover:bg-neutral-100/70 hover:text-black')}>
      {active && (
        <motion.span layoutId={layoutId} className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.06)]"
          transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
      )}
      <item.icon className="relative size-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
      <span className="relative truncate">{label}</span>
      {active &&<span className="relative ml-auto size-1.5 rounded-full bg-black" />}
    </Link>
  )
}

/** Magazinul activ (cu schimbarea lui) și legăturile lui, ca „Channels" la Bezeno. */
function StoreCard(p: Props) {
  const { t } = useLocale()
  const s = p.activeStore
  const merchant = !!(s?.merchant_center_id || s?.platform_data?.google_merchant?.cont_id)
  const links = [
    { key: 'store', icon: Store, on: s?.connection_status === 'active', label: s ? PLATFORM_NAME[s.platform] ?? s.platform : t('sidebar.store_none') },
    { key: 'ads', icon: Megaphone, on: !!s?.google_ads_customer_id, label: 'Google Ads' },
    { key: 'merchant', icon: ShoppingBag, on: merchant, label: 'Merchant Center' },
  ]
  const connected = links.filter(l => l.on).length

  return (
    <div className="rounded-2xl border border-line bg-white p-3.5">
      {!s ? (
        // Fără magazin nu e nimic de schimbat: legătura duce direct la conectare
        <Link href="/settings?tab=integrations" onClick={p.onNavigate} className="group flex w-full items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate font-semibold text-neutral-900">{t('sidebar.store_none_short')}</span>
          <span className="flex shrink-0 items-center gap-1 font-medium text-black">
            {t('sidebar.connect')}<Plus className="size-3" />
          </span>
        </Link>
      ) : (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="group flex w-full items-center justify-between gap-2 text-left text-xs outline-none" aria-label={t('sidebar.stores')}>
            <span className="min-w-0 truncate font-semibold text-neutral-900">{storeLabel(s)}</span>
            <span className="flex shrink-0 items-center gap-1 text-neutral-400 transition group-hover:text-black">
              {p.stores.length > 1 ? t('sidebar.switch_store') : t('sidebar.manage_store')}<ChevronsUpDown className="size-3" />
            </span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="top" align="start" sideOffset={10} className={menuContent}>
            <DropdownMenu.Label className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{t('sidebar.stores')}</DropdownMenu.Label>
            {p.stores.map(item => (
              <DropdownMenu.Item key={item.id} className={menuItem} onSelect={() => p.onChooseStore(item)} disabled={!!p.switching}>
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-neutral-100 text-[11px] font-bold text-neutral-600">{storeLabel(item)[0]?.toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-neutral-900">{storeLabel(item)}</span>
                  <span className="block text-[11px] text-neutral-400">{PLATFORM_NAME[item.platform] ?? item.platform}</span>
                </span>
                {item.id === s?.id && <Check className="size-4 text-black" />}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-neutral-100" />
            <DropdownMenu.Item asChild className={menuItem}>
              <Link href="/settings?tab=integrations" onClick={p.onNavigate}><Plus className="size-4 text-neutral-400" />{t('sidebar.action_connect_store')}</Link>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      )}
      <Link href="/settings?tab=integrations" onClick={p.onNavigate} className="group mt-3 flex items-center gap-1.5" aria-label={t('sidebar.connections', { count: connected, total: links.length })}>
        {links.map(l => (
          <span key={l.key} title={`${l.label}${l.on ? ` · ${t('sidebar.connected')}` : ''}`}
            className={cn('grid size-8 place-items-center rounded-lg transition [&_svg]:size-3.5', l.on ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-400')}>
            <l.icon />
          </span>
        ))}
        <span className="ml-auto text-[11px] text-neutral-400 transition group-hover:text-black">{t('sidebar.connections', { count: connected, total: links.length })}</span>
      </Link>
    </div>
  )
}

/** Contul: inițiala, numele și emailul, cu meniul (setări, limba) și ieșirea. */
function UserCard(p: Props) {
  const { t, locale, setLocale } = useLocale()
  const initial = (p.user.name || p.user.email).slice(0, 1).toUpperCase()
  return (
    <div className="flex items-center gap-1 rounded-2xl p-1">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left outline-none transition-colors hover:bg-neutral-100/70 data-[state=open]:bg-neutral-100">
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-neutral-700 to-black text-sm font-bold text-white ring-2 ring-white">
              {p.user.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={p.user.avatarUrl} alt="" className="size-full object-cover" />
                : initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-neutral-900">{p.user.name}</span>
              <span className="block truncate text-xs text-neutral-400">{p.user.email}</span>
            </span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="top" align="start" sideOffset={10} className={menuContent}>
            <DropdownMenu.Item asChild className={menuItem}>
              <Link href="/settings" onClick={p.onNavigate}><Settings className="size-4 text-neutral-400" />{t('sidebar.settings')}</Link>
            </DropdownMenu.Item>
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className={menuItem}>
                <Languages className="size-4 text-neutral-400" /><span className="flex-1">{t('sidebar.language')}</span>
                <span className="text-[12px] text-neutral-400">{LOCALE_NAMES[locale]}</span>
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent sideOffset={6} className={cn(menuContent, 'min-w-[160px]')}>
                  {LOCALES.map(l => (
                    <DropdownMenu.Item key={l} className={menuItem} onSelect={() => setLocale(l)}>
                      <span className="flex-1">{LOCALE_NAMES[l]}</span>{l === locale && <Check className="size-4 text-black" />}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <button onClick={p.onLogout} title={t('common.logout')} aria-label={t('common.logout')}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-black">
        <LogOut className="size-4" />
      </button>
    </div>
  )
}
