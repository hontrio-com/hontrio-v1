'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ImageIcon, Loader2, Search, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Input } from '@/components/app/input'
import { Segmented } from '@/components/app/tabs'
import { Table, Td, Th, Tr } from '@/components/app/table'
import type { Formats } from '@/components/campaigns/formats'
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
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    const inTab = (o: PlanOffer) => tab === 'included' ? o.reason === null : tab === 'groups' ? o.reason === 'in_group' : o.reason !== null && o.reason !== 'in_group'
    return plan.offers.filter(o => inTab(o) && (!q || o.title.toLowerCase().includes(q) || (o.variant_title ?? '').toLowerCase().includes(q)))
  }, [plan.offers, tab, search])
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE))
  const current = Math.min(page, pages)
  const visible = list.slice((current - 1) * PER_PAGE, current * PER_PAGE)
  // Sub 1%, o zecimală: o marjă de −0,4% nu e „0%"
  const pct = (m: number) => `${Math.abs(m) < 0.01 && m !== 0 ? f.num.format(m * 100) : f.int.format(Math.round(m * 100))}%`

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

      {visible.length === 0 ? (
        <p className="border-t border-neutral-100 py-14 text-center text-[13px] text-neutral-400">{search ? t('catalog.no_results') : t(`campaigns.empty_${tab}`)}</p>
      ) : (
        <Table className="min-w-[760px]">
          <thead>
            <tr>
              <Th>{t('catalog.col_product')}</Th>
              <Th align="right">{t('campaigns.col_sales')}</Th>
              <Th align="right">{t('catalog.col_margin')}</Th>
              <Th align="right" title={t('campaigns.col_break_even_hint')}>{t('campaigns.col_break_even')}</Th>
              {tab !== 'included' && <Th>{t(tab === 'groups' ? 'campaigns.col_group' : 'campaigns.col_reason')}</Th>}
              <Th className="w-px" />
            </tr>
          </thead>
          <tbody>
            {visible.map(o => {
              const overTarget = o.reason === null && plan.target_roas !== null && (o.break_even === null ? o.margin !== null : o.break_even > plan.target_roas)
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
                  <Td align="right" className="whitespace-nowrap">
                    {o.margin !== null && o.cost_price !== null ? (
                      <>
                        <p className={cn('font-semibold', o.margin <= 0 ? 'text-red-600' : o.margin_issue ? 'text-amber-600' : 'text-emerald-600')}>{pct(o.margin)}</p>
                        <p className="text-[12px] text-neutral-400">{f.money.format(o.price - o.cost_price)}</p>
                      </>
                    ) : <span className="text-[12px] text-neutral-400" title={t('campaigns.no_cost_hint')}>{t('campaigns.no_cost')}</span>}
                  </Td>
                  <Td align="right" className="whitespace-nowrap">
                    {o.break_even !== null ? (
                      <span className={overTarget ? 'font-semibold text-amber-600' : 'text-neutral-700'}
                        title={overTarget ? t('campaigns.over_target_hint', { roas: f.num.format(plan.target_roas!) }) : undefined}>
                        {f.num.format(o.break_even)}
                      </span>
                    ) : <span className={cn('text-[12px]', o.margin !== null ? 'text-red-500' : 'text-neutral-300')}>{o.margin !== null ? t('campaigns.never_profitable') : '—'}</span>}
                  </Td>
                  {tab === 'excluded' && (
                    <Td>
                      <Badge tone={FIXED.has(o.reason!) ? 'red' : o.reason === 'manual' ? 'neutral' : 'amber'}>
                        {t.has(`campaigns.reason_${o.reason}`) ? t(`campaigns.reason_${o.reason}`) : t('campaigns.reason_generic')}
                      </Badge>
                    </Td>
                  )}
                  {tab === 'groups' && <Td><Badge tone="sky">{groupNames.get(o.group_id ?? '') ?? '—'}</Badge></Td>}
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
          <span className="tabular-nums">{t('catalog.page_of', { from: f.int.format((current - 1) * PER_PAGE + 1), to: f.int.format(Math.min(current * PER_PAGE, list.length)), total: f.int.format(list.length) })}</span>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={current === 1} aria-label={t('catalog.prev')}><ChevronLeft /></Button>
            <Button size="icon" variant="ghost" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={current === pages} aria-label={t('catalog.next')}><ChevronRight /></Button>
          </div>
        </div>
      )}
    </Card>
  )
}
