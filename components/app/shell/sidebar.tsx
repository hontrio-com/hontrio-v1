'use client'

import Link from 'next/link'
import { DropdownMenu } from 'radix-ui'
import { motion } from 'framer-motion'
import { Check, ChevronsUpDown, Crown, Languages, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, X, Zap } from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/app/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { NAV, activeItem, type NavItem } from '@/components/app/shell/nav'
import { PLATFORM_NAME, storeLabel, type StoreItem } from '@/components/app/shell/stores'

// =============================================
// Meniul platformei (ca la Linear): sus logo-ul, magazinul pe care lucrezi
// și căutarea, la mijloc paginile în grupe, jos creditele și contul tău.
// Se poate strânge la iconițe (rămâne iconița logo-ului).
// =============================================

type Props = {
  pathname: string
  admin: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  onNavigate: () => void
  onSearch: () => void
  stores: StoreItem[]
  activeStore: StoreItem | null
  switching: string | null
  onChooseStore: (s: StoreItem) => void
  user: { name: string; email: string; avatarUrl: string | null }
  credits: number
  plan: string
  onLogout: () => void
}

const menuItem = 'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-neutral-700 outline-none data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-950'
const menuContent = 'app z-50 min-w-[240px] rounded-xl border border-neutral-200/80 bg-white p-1.5 shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]'

export function Sidebar(p: Props) {
  const { t, locale, setLocale, intlLocale } = useLocale()
  const current = activeItem(p.pathname, p.admin)
  const initial = (p.activeStore ? storeLabel(p.activeStore) : 'H')[0]?.toUpperCase() ?? 'H'

  return (
    <div className="flex h-full flex-col">
      {/* Logo-ul */}
      <div className={cn('flex h-16 shrink-0 items-center', p.collapsed ? 'justify-center px-2' : 'justify-between pl-5 pr-3')}>
        <Link href="/dashboard" onClick={p.onNavigate} className="flex items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-neutral-900/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.collapsed ? <img src="/logo-icon.png" alt="Hontrio" className="h-7 w-auto" /> : <img src="/logo-black.png" alt="Hontrio" className="h-[22px] w-auto" />}
        </Link>
        {!p.collapsed && (
          <>
            <button onClick={p.onToggleCollapsed} aria-label={t('sidebar.collapse')}
              className="hidden size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-black/[0.04] hover:text-neutral-700 lg:flex">
              <PanelLeftClose className="size-4" />
            </button>
            <button onClick={p.onNavigate} aria-label={t('common.close')}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-black/[0.04] hover:text-neutral-700 lg:hidden">
              <X className="size-4" />
            </button>
          </>
        )}
      </div>

      {/* Magazinul pe care lucrezi */}
      <div className={cn('pb-2', p.collapsed ? 'flex justify-center px-2' : 'px-3')}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button aria-label={t('sidebar.stores')}
              className={cn('group flex min-w-0 items-center gap-2.5 rounded-lg text-left outline-none transition-[background-color,box-shadow]',
                p.collapsed ? 'p-1 hover:bg-black/[0.04] data-[state=open]:bg-black/[0.05]'
                  : 'w-full bg-white px-2 py-1.5 shadow-[0_1px_2px_rgb(16_24_40/0.04)] ring-1 ring-black/[0.07] hover:ring-black/[0.12] data-[state=open]:ring-black/[0.14]')}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-[12px] font-semibold text-white">
                {initial}
              </span>
              {!p.collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-neutral-900">{p.activeStore ? storeLabel(p.activeStore) : t('sidebar.store_none')}</span>
                    <span className="block truncate text-[11px] text-neutral-500">{p.activeStore ? PLATFORM_NAME[p.activeStore.platform] ?? p.activeStore.platform : t('sidebar.action_connect_store')}</span>
                  </span>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-neutral-400 group-hover:text-neutral-600" />
                </>
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={6} className={menuContent}>
              <DropdownMenu.Label className="px-2 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{t('sidebar.stores')}</DropdownMenu.Label>
              {p.stores.map(s => (
                <DropdownMenu.Item key={s.id} className={menuItem} onSelect={() => p.onChooseStore(s)} disabled={!!p.switching}>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-[11px] font-semibold text-neutral-600">{storeLabel(s)[0]?.toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{storeLabel(s)}</span>
                    <span className="block text-[11px] text-neutral-400">{PLATFORM_NAME[s.platform] ?? s.platform}</span>
                  </span>
                  {s.id === p.activeStore?.id && <Check className="size-4 text-brand-600" />}
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-neutral-100" />
              <DropdownMenu.Item asChild className={menuItem}>
                <Link href="/settings?tab=integrations" onClick={p.onNavigate}><Plus className="size-4 text-neutral-400" />{t('sidebar.action_connect_store')}</Link>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Căutarea */}
      <div className={cn('pb-2', p.collapsed ? 'px-2' : 'px-3')}>
        {p.collapsed ? (
          <NavTip label={t('sidebar.search')}>
            <button onClick={p.onSearch} aria-label={t('sidebar.search')} className="flex h-8 w-full items-center justify-center rounded-lg text-neutral-500 hover:bg-black/[0.04] hover:text-neutral-800">
              <Search className="size-4" />
            </button>
          </NavTip>
        ) : (
          <button onClick={p.onSearch}
            className="flex h-8 w-full items-center gap-2 rounded-lg bg-white px-2.5 text-[13px] text-neutral-500 shadow-[0_1px_2px_rgb(16_24_40/0.04)] ring-1 ring-black/[0.06] transition-colors hover:text-neutral-700 hover:ring-black/10">
            <Search className="size-3.5" />
            <span className="flex-1 text-left">{t('sidebar.search')}</span>
            <Kbd className="h-[18px] text-[10px]">⌘K</Kbd>
          </button>
        )}
      </div>

      {/* Paginile */}
      <nav className={cn('flex-1 overflow-y-auto pb-3', p.collapsed ? 'px-2' : 'px-3')}>
        {NAV.filter(g => !g.admin || p.admin).map((g, i) => (
          <div key={g.label ?? i} className={cn(i > 0 && 'mt-5')}>
            {g.label && !p.collapsed && <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{t(g.label)}</p>}
            {g.label && p.collapsed && <div className="mx-2 mb-2 h-px bg-black/[0.06]" />}
            <ul className="space-y-0.5">
              {g.items.map(item => (
                <li key={item.href}>
                  <NavLink item={item} active={current?.href === item.href} collapsed={p.collapsed} onNavigate={p.onNavigate} label={t(item.label)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Creditele */}
      {!p.collapsed && (
        <div className="px-3 pb-2">
          <Link href="/credits" onClick={p.onNavigate}
            className="group block rounded-xl bg-white p-3 shadow-[0_1px_2px_rgb(16_24_40/0.04)] ring-1 ring-black/[0.06] transition-shadow hover:shadow-card">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-500"><Zap className="size-3.5 text-amber-500" />{t('common.credits_label')}</span>
              <span className="rounded-md bg-neutral-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {t.has(`credits.plan_${p.plan}`) ? t(`credits.plan_${p.plan}`) : p.plan}
              </span>
            </div>
            <p className="mt-1 text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-900">{new Intl.NumberFormat(intlLocale).format(p.credits)}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, p.credits)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
                className={cn('h-full rounded-full', p.credits <= 5 ? 'bg-red-500' : p.credits <= 20 ? 'bg-amber-500' : 'bg-brand-600')} />
            </div>
            <p className="mt-2 flex items-center gap-1 text-[12px] font-medium text-brand-700 group-hover:text-brand-800">
              <Crown className="size-3.5" />{t(p.credits <= 5 ? 'credits.buy_credits' : 'common.upgrade_plan')}
            </p>
          </Link>
        </div>
      )}

      {/* Contul */}
      <div className={cn('border-t border-black/[0.06] py-2', p.collapsed ? 'px-2' : 'px-3')}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className={cn('flex w-full items-center gap-2.5 rounded-lg py-1.5 text-left outline-none transition-colors hover:bg-black/[0.04] data-[state=open]:bg-black/[0.05]', p.collapsed ? 'justify-center px-1' : 'px-2')}>
              <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-[12px] font-semibold text-neutral-600">
                {p.user.avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.user.avatarUrl} alt="" className="size-full object-cover" />
                  : p.user.name[0]?.toUpperCase()}
              </span>
              {!p.collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-neutral-900">{p.user.name}</span>
                  <span className="block truncate text-[11px] text-neutral-500">{p.user.email}</span>
                </span>
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content side="top" align="start" sideOffset={8} className={menuContent}>
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
                        <span className="flex-1">{LOCALE_NAMES[l]}</span>{l === locale && <Check className="size-4 text-brand-600" />}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
              <DropdownMenu.Separator className="my-1 h-px bg-neutral-100" />
              <DropdownMenu.Item className={cn(menuItem, 'text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700')} onSelect={p.onLogout}>
                <LogOut className="size-4" />{t('common.logout')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        {p.collapsed && (
          <NavTip label={t('sidebar.expand')}>
            <button onClick={p.onToggleCollapsed} aria-label={t('sidebar.expand')} className="mt-1 hidden h-8 w-full items-center justify-center rounded-lg text-neutral-400 hover:bg-black/[0.04] hover:text-neutral-700 lg:flex">
              <PanelLeftOpen className="size-4" />
            </button>
          </NavTip>
        )}
      </div>
    </div>
  )
}

function NavTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="bg-neutral-900 text-white [&>span]:hidden">{label}</TooltipContent>
    </Tooltip>
  )
}

function NavLink({ item, active, collapsed, onNavigate, label }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate: () => void; label: string }) {
  const link = (
    <Link href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
      className={cn('group relative flex h-8 items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors',
        collapsed ? 'justify-center' : 'px-2',
        active ? 'text-neutral-950' : 'text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-900')}>
      {active && (
        <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_2px_rgb(16_24_40/0.06)] ring-1 ring-black/[0.06]"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
      )}
      <item.icon className={cn('relative size-4 shrink-0', active ? 'text-brand-600' : 'text-neutral-400 group-hover:text-neutral-600')} />
      {!collapsed && <span className="relative truncate">{label}</span>}
    </Link>
  )
  return collapsed ? <NavTip label={label}>{link}</NavTip> : link
}
