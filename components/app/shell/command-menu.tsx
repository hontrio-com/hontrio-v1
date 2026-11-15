'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { ArrowRight, CornerDownLeft, Package, Plus, Search, Store } from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'
import { Kbd } from '@/components/app/badge'
import { NAV } from '@/components/app/shell/nav'
import { PLATFORM_NAME, storeLabel, type StoreItem } from '@/components/app/shell/stores'

// =============================================
// Căutarea universală (⌘K), pe cmdk (github.com/pacocoursey/cmdk): orice
// pagină, orice produs, acțiunile des folosite și schimbarea magazinului,
// fără mouse. Ca la Linear și Vercel.
// =============================================

type Product = { id: string; title: string; thumbnail_url: string | null; category: string | null }

export function CommandMenu({ open, onOpenChange, admin, stores, activeStoreId, onChooseStore }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  admin: boolean
  stores: StoreItem[]
  activeStoreId: string | null
  onChooseStore: (s: StoreItem) => void
}) {
  const { t } = useLocale()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Product[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Sub două litere nu se caută: lista de produse rămâne goală
  const searching = query.trim().length >= 2
  const products = searching ? found : []

  // Produsele se caută pe server, după ce omul se oprește din scris
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!searching) return
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        const d = await r.json()
        setFound((d.products ?? []).slice(0, 6))
      } catch { setFound([]) }
    }, 250)
  }, [query, searching])

  // Fiecare deschidere începe cu o căutare goală
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) { setQuery(''); setFound([]) }
  }

  const go = (href: string) => { onOpenChange(false); router.push(href) }
  const pages = NAV.filter(g => !g.admin || admin).flatMap(g => g.items)

  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange} label={t('sidebar.search')} loop
      overlayClassName="fixed inset-0 z-[60] bg-neutral-950/20 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0"
      contentClassName="app fixed left-1/2 top-[12vh] z-[61] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
      <div className="flex items-center gap-3 border-b border-neutral-100 px-4">
        <Search className="size-[18px] shrink-0 text-neutral-400" />
        <Command.Input value={query} onValueChange={setQuery} placeholder={t('sidebar.command_placeholder')}
          className="h-14 w-full bg-transparent text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400" />
        {/* i18n-ignore: numele tastei, scris pe ea */}
        <Kbd>Esc</Kbd>
      </div>
      <Command.List className="max-h-[min(440px,60vh)] overflow-y-auto overscroll-contain p-2 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-neutral-400">
        <Command.Empty className="py-12 text-center text-[13px] text-neutral-500">{t('common.search_no_results', { query })}</Command.Empty>

        <Command.Group heading={t('sidebar.command_actions')}>
          <Item icon={<Plus />} onSelect={() => go('/campaigns?new=1')} keywords={['campanie', 'grupa', 'new', 'campaign']}>
            {t('sidebar.action_new_campaign')}
          </Item>
          <Item icon={<Store />} onSelect={() => go('/settings?tab=integrations')} keywords={['magazin', 'conectare', 'integrari', 'store']}>
            {t('sidebar.action_connect_store')}
          </Item>
        </Command.Group>

        <Command.Group heading={t('sidebar.command_pages')}>
          {pages.map(p => (
            <Item key={p.href} icon={<p.icon />} onSelect={() => go(p.href)} keywords={p.keywords} value={`${t(p.label)} ${p.href}`}>
              {t(p.label)}
            </Item>
          ))}
        </Command.Group>

        {stores.length > 1 && (
          <Command.Group heading={t('sidebar.command_stores')}>
            {stores.map(s => (
              <Item key={s.id} icon={<Store />} onSelect={() => { onOpenChange(false); onChooseStore(s) }} value={`store ${storeLabel(s)} ${s.id}`}
                hint={s.id === activeStoreId ? t('sidebar.store_active') : PLATFORM_NAME[s.platform] ?? s.platform}>
                {storeLabel(s)}
              </Item>
            ))}
          </Command.Group>
        )}

        {products.length > 0 && (
          <Command.Group heading={t('sidebar.products')} forceMount>
            {products.map(p => (
              <Item key={p.id} value={`product ${p.title} ${p.id}`} onSelect={() => go(`/products?search=${encodeURIComponent(p.title)}`)}
                icon={p.thumbnail_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.thumbnail_url} alt="" className="size-5 rounded object-cover" />
                  : <Package />}
                hint={p.category ?? undefined}>
                {p.title}
              </Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
      <div className="flex items-center gap-4 border-t border-neutral-100 bg-neutral-50/60 px-4 py-2.5 text-[12px] text-neutral-500">
        <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd>{t('sidebar.command_navigate')}</span>
        <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft className="size-3" /></Kbd>{t('sidebar.command_open')}</span>
      </div>
    </Command.Dialog>
  )
}

function Item({ icon, children, hint, onSelect, keywords, value }: {
  icon: ReactNode; children: ReactNode; hint?: string; onSelect: () => void; keywords?: string[]; value?: string
}) {
  return (
    <Command.Item onSelect={onSelect} keywords={keywords} value={value}
      className="group flex h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-[14px] text-neutral-700 data-[selected=true]:bg-neutral-100 data-[selected=true]:text-neutral-950">
      <span className="flex size-5 shrink-0 items-center justify-center text-neutral-400 group-data-[selected=true]:text-neutral-700 [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-[12px] text-neutral-400">{hint}</span>}
      <ArrowRight className="size-3.5 shrink-0 text-neutral-300 opacity-0 transition-opacity group-data-[selected=true]:opacity-100" />
    </Command.Item>
  )
}
