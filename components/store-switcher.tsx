'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2, Store } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

// =============================================
// Comutatorul de magazin din antet: un cont poate avea mai multe magazine,
// iar paginile lucrează pe cel activ. Apare doar de la două magazine.
// =============================================

type StoreItem = { id: string; platform: string; store_name: string | null; store_url: string }

const PLATFORM: Record<string, string> = { edinio: 'Edinio', woocommerce: 'WooCommerce', shopify: 'Shopify' }

const labelOf = (s: StoreItem) => s.store_name || s.store_url.replace(/^https?:\/\//, '')

export default function StoreSwitcher() {
  const { t } = useT()
  const [stores, setStores] = useState<StoreItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/stores')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d) return
        setStores(d.stores ?? [])
        setActiveId(d.active_store_id ?? null)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (stores.length < 2) return null
  const active = stores.find(s => s.id === activeId) ?? stores[stores.length - 1]

  // Toate paginile își iau datele din magazinul activ: după schimbare se reîncarcă
  async function choose(s: StoreItem) {
    if (s.id === active.id) { setOpen(false); return }
    setSwitching(s.id)
    try {
      const r = await fetch('/api/stores/active', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id: s.id }) })
      if (r.ok) { window.location.reload(); return }
    } catch {}
    setSwitching(null)
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open} title={t('common.active_store')}
        className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-medium text-neutral-700 border border-neutral-100 hover:bg-neutral-100 transition-all max-w-[220px]">
        <Store className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
        <span className="truncate hidden md:inline">{labelOf(active)}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-neutral-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 top-11 w-64 bg-white rounded-xl shadow-xl border border-neutral-100 py-1 z-50">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{t('common.active_store')}</p>
          {stores.map(s => (
            <button key={s.id} role="option" aria-selected={s.id === active.id} onClick={() => choose(s)} disabled={!!switching}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 disabled:opacity-60 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-neutral-800 truncate">{labelOf(s)}</p>
                <p className="text-[11px] text-neutral-400">{PLATFORM[s.platform] ?? s.platform}</p>
              </div>
              {switching === s.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400 shrink-0" />
                : s.id === active.id && <Check className="h-4 w-4 text-neutral-900 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
