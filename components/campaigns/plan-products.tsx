'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ImageIcon, Loader2, Search, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Input } from '@/components/app/input'
import { Segmented } from '@/components/app/tabs'
import { Table, Td, Th, Tr } from '@/components/app/table'
import type { Formats } from '@/components/app/formats'
import type { Plan, PlanOffer } from '@/lib/campaigns/plan'
import type { AdsMode } from '@/lib/commerce/ads-data'

// =============================================
// Produsele campaniei principale: ce intră, ce e în campaniile tale pe
// grupe și ce rămâne afară (cu motivul). Un produs se scoate sau se
// readuce dintr-un clic; ce se repară doar în magazin spune unde.
// =============================================

type Tab = 'included' | 'groups' | 'excluded'

// Motivele care nu se pot întoarce din Hontrio: se repară în magazin
const FIXED = new Set(['out_of_stock', 'google_rejected', 'price_unconfirmed', 'not_in_merchant'])
const PER_PAGE = 50

export function PlanProducts({ plan, groupNames, f, onChanged, onError, onOpenGroup }: {
  plan: Plan
  groupNames: Map<string, string>
  f: Formats
  onChanged: () => Promise<unknown>
  onError: (text: string) => void
  onOpenGroup: (groupId: string) => void
}) {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>('included')
  const [search, setSearch] = useState('')
  // Căutarea pleacă spre server după o scurtă pauză în scris, nu la fiecare literă
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<{ key: string; total: number; offers: PlanOffer[] } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  // O pagină din fila aleasă, din baza de date (un catalog mare nu vine întreg). Planul reîncărcat (după o
  // schimbare) e alt obiect: pagina se recitește
  const key = JSON.stringify([tab, q, page])
  useEffect(() => {
    let alive = true
    fetch('/api/campaigns/plan/offers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filter: tab, q, page, per_page: PER_PAGE }),
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<{ total: number; offers: PlanOffer[] }> })
      .then(d => { if (alive) { setResult({ key, total: d.total, offers: d.offers }); setFailedKey(null) } })
      .catch(() => { if (alive) setFailedKey(key) })
    return () => { alive = false }
  }, [key, tab, q, page, plan])

  const total = result?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PER_PAGE))
  const current = Math.min(page, pages)
  const visible = result?.offers ?? []
  const loading = !result && failedKey !== key
  const pending = !!result && result.key !== key && failedKey !== key

  async function setMode(offer: PlanOffer, mode: AdsMode) {
    setBusy(s => new Set(s).add(offer.offer_id))
    try {
      const r = await fetch('/api/campaigns/offers', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer_ids: [offer.offer_id], mode }),
      })
      if (!r.ok) throw new Error()
      await onChanged()
    } catch {
      onError(t('campaigns.save_error'))
    } finally {
      setBusy(s => { const next = new Set(s); next.delete(offer.offer_id); return next })
    }
  }

  const tabs = (['included', 'groups', 'excluded'] as Tab[]).filter(k => k !== 'groups' || plan.counts.in_groups > 0)
  const countOf = (k: Tab) => (k === 'included' ? plan.counts.included : k === 'groups' ? plan.counts.in_groups : plan.counts.excluded)

  return (
    <Card className="overflow-hidden">
      <CardHeader title={t('campaigns.products_title')} description={t('campaigns.products_hint')} />
      <div className="flex flex-col gap-3 px-5 pb-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Segmented id="plan-products" value={tab} onChange={k => { setTab(k); setPage(1) }} items={tabs.map(k => ({
          value: k, label: <span className="flex items-center gap-1.5">{t(`campaigns.seg_${k}`)}<span className="tabular-nums text-neutral-400">{f.int.format(countOf(k))}</span></span>,
        }))} />
        <div className="relative sm:w-72">
          <Input icon={<Search />} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t('campaigns.search_placeholder')} className="pr-8" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:text-neutral-600" aria-label={t('common.close')}>
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="flex justify-center border-t border-neutral-100 py-14"><Loader2 className="size-5 animate-spin text-neutral-300" /></p>
      ) : visible.length === 0 ? (
        <p className="border-t border-neutral-100 py-14 text-center text-[13px] text-neutral-400">{q ? t('catalog.no_results') : failedKey === key ? t('catalog.load_error') : t(`campaigns.empty_${tab}`)}</p>
      ) : (
        <Table className={cn('min-w-[760px] transition-opacity', pending && 'opacity-60')}>
          <thead>
            <tr>
              <Th>{t('catalog.col_product')}</Th>
              <Th align="right">{t('campaigns.col_sales')}</Th>
              <Th align="right" title={t('campaigns.col_ads_hint')}>{t('campaigns.col_ads_spend')}</Th>
              <Th align="right" title={t('campaigns.col_ads_hint')}>{t('campaigns.kpi_roas')}</Th>
              {tab !== 'included' && <Th>{t(tab === 'groups' ? 'campaigns.col_group' : 'campaigns.col_reason')}</Th>}
              <Th className="w-px" />
            </tr>
          </thead>
          <tbody>
            {visible.map(o => {
              const saving = busy.has(o.offer_id)
              return (
                <Tr key={o.offer_id}>
                  <Td>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-50 ring-1 ring-inset ring-neutral-200/70">
                        {o.image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={o.image_url} alt="" loading="lazy" className="size-full object-cover" />
                          : <ImageIcon className="size-4 text-neutral-300" />}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-medium leading-snug text-neutral-900">{o.title}</p>
                        {(o.variant_title || (o.mode === 'include' && o.reason === null)) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {o.variant_title && <span className="text-[12px] text-neutral-500">{o.variant_title}</span>}
                            {o.mode === 'include' && o.reason === null && <Badge tone="brand">{t('campaigns.included_by_you')}</Badge>}
                          </div>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td align="right" className="whitespace-nowrap">
                    {o.units > 0 ? (
                      <>
                        <p className="font-medium text-neutral-900">{t('catalog.units', { count: Number(o.units) })}</p>
                        <p className="text-[12px] text-neutral-400">{f.money.format(o.revenue)}</p>
                      </>
                    ) : <span className="text-neutral-300">—</span>}
                  </Td>
                  {/* Ce a raportat Google pentru produs în 30 de zile (toate campaniile Shopping și PMax) */}
                  <Td align="right" className="whitespace-nowrap">
                    {o.ads30 && o.ads30.cost > 0 ? (
                      <>
                        <p className="font-medium text-neutral-900">{f.money.format(o.ads30.cost)}</p>
                        <p className="text-[12px] text-neutral-400">{t('campaigns.ads_sold', { value: f.money.format(o.ads30.value) })}</p>
                      </>
                    ) : <span className="text-neutral-300">—</span>}
                  </Td>
                  <Td align="right" className="whitespace-nowrap">
                    {o.ads30 && o.ads30.cost > 0
                      ? <span className={cn('font-medium', o.ads30.value < o.ads30.cost ? 'text-red-600' : 'text-neutral-700')}>{f.num.format(Math.round((o.ads30.value / o.ads30.cost) * 100) / 100)}</span>
                      : <span className="text-neutral-300">—</span>}
                  </Td>
                  {tab === 'excluded' && (
                    <Td>
                      <Badge tone={FIXED.has(o.reason!) ? 'red' : o.reason === 'manual' ? 'neutral' : 'amber'}>
                        {t.has(`campaigns.reason_${o.reason}`) ? t(`campaigns.reason_${o.reason}`) : t('campaigns.reason_generic')}
                      </Badge>
                    </Td>
                  )}
                  {tab === 'groups' && <Td><Badge tone="outline">{groupNames.get(o.group_id ?? '') ?? '—'}</Badge></Td>}
                  <Td align="right" className="whitespace-nowrap">
                    {saving ? <Loader2 className="ml-auto size-4 animate-spin text-neutral-400" />
                      : o.reason === 'in_group' ? (
                        o.group_id ? <Button size="xs" onClick={() => onOpenGroup(o.group_id!)}>{t('campaigns.action_see_group')}</Button> : null
                      )
                      : o.reason === null ? (
                        o.mode === 'include'
                          ? <Button size="xs" onClick={() => setMode(o, 'auto')}>{t('campaigns.action_auto')}</Button>
                          : <Button size="xs" variant="ghost" onClick={() => setMode(o, 'exclude')}>{t('campaigns.action_exclude')}</Button>
                      )
                      : FIXED.has(o.reason) ? <span className="text-[12px] text-neutral-400">{t('campaigns.fix_in_store', { platform: plan.platform.name })}</span>
                      : o.reason === 'manual' ? <Button size="xs" onClick={() => setMode(o, 'auto')}>{t('campaigns.action_restore')}</Button>
                      : <Button size="xs" onClick={() => setMode(o, 'include')}>{t('campaigns.action_include')}</Button>}
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-5 py-3 text-[12px] text-neutral-500">
          <span className="tabular-nums">{t('catalog.page_of', { from: f.int.format((current - 1) * PER_PAGE + 1), to: f.int.format(Math.min(current * PER_PAGE, total)), total: f.int.format(total) })}</span>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={current === 1} aria-label={t('catalog.prev')}><ChevronLeft /></Button>
            <Button size="icon" variant="ghost" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={current === pages} aria-label={t('catalog.next')}><ChevronRight /></Button>
          </div>
        </div>
      )}
    </Card>
  )
}
