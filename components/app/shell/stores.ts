'use client'

import { useCallback, useEffect, useState } from 'react'
import { PLATFORM_NAMES } from '@/lib/commerce/platforms'

// =============================================
// Magazinele contului și cel activ, citite o dată pentru meniu și antet.
// Schimbarea magazinului reîncarcă pagina: toate datele sunt ale lui.
// =============================================

export type StoreItem = {
  id: string; platform: string; store_name: string | null; store_url: string
  /** Legăturile magazinului, pentru cardul din meniu: conexiunea, contul Google Ads, Merchant Center. */
  connection_status?: string | null
  google_ads_customer_id?: string | null
  merchant_center_id?: string | null
  platform_data?: { google_merchant?: { cont_id?: string | number | null } | null } | null
}

export const PLATFORM_NAME: Record<string, string> = PLATFORM_NAMES

export const storeLabel = (s: StoreItem) => s.store_name || s.store_url.replace(/^https?:\/\//, '').replace(/\/$/, '')

export function useStores() {
  const [stores, setStores] = useState<StoreItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)

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
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [])

  const active = stores.find(s => s.id === activeId) ?? stores[stores.length - 1] ?? null

  const choose = useCallback(async (s: StoreItem) => {
    if (s.id === active?.id) return
    setSwitching(s.id)
    try {
      const r = await fetch('/api/stores/active', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id: s.id }) })
      if (r.ok) { window.location.reload(); return }
    } catch {}
    setSwitching(null)
  }, [active?.id])

  return { stores, active, loaded, switching, choose }
}
