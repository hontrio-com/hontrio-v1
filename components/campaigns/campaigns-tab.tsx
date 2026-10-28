'use client'

import { useMemo, useState } from 'react'
import { BadgePercent, FolderTree, Megaphone, Plus, Tag, ListChecks } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Card } from '@/components/app/surface'
import { Button } from '@/components/app/button'
import { Segmented } from '@/components/app/tabs'
import { EmptyState } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { CampaignTable } from '@/components/campaigns/campaign-table'
import { STATUS_ORDER, type CampaignView } from '@/components/campaigns/views'
import type { Formats } from '@/components/app/formats'
import type { Plan } from '@/lib/campaigns/plan'

// =============================================
// Toate campaniile: filtrate după stare, cu banii pe 30 de zile și
// tendința. Dedesubt, de ce și cum faci o campanie pe o parte din catalog.
// =============================================

type Filter = 'all' | 'running' | 'drafts' | 'ended'

const IN: Record<Filter, (v: CampaignView) => boolean> = {
  all: () => true,
  running: v => v.status === 'running' || v.status === 'paused',
  drafts: v => v.status === 'draft' || v.status === 'not_launched',
  ended: v => v.status === 'ended',
}

export function CampaignsTab({ plan, views, f, onOpen, onNew, canCreate }: {
  plan: Plan; views: CampaignView[]; f: Formats; onOpen: (v: CampaignView) => void; onNew: () => void; canCreate: boolean
}) {
  const { t } = useT()
  const [filter, setFilter] = useState<Filter>('all')
  const list = useMemo(() => views.filter(IN[filter]).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]), [views, filter])
  const count = (k: Filter) => views.filter(IN[k]).length

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto [scrollbar-width:none]">
        <Segmented id="campaign-filter" value={filter} onChange={setFilter} items={(['all', 'running', 'drafts', 'ended'] as Filter[]).map(k => ({
          value: k, label: <span className="flex items-center gap-1.5">{t(`campaigns.filter_${k}`)}<span className="tabular-nums text-neutral-400">{count(k)}</span></span>,
        }))} />
      </div>

      <FadeIn>
        <Card className="overflow-hidden">
          {list.length
            ? <CampaignTable views={list} plan={plan} f={f} onOpen={onOpen} />
            : <EmptyState icon={<Megaphone />} title={t('campaigns.filter_empty_title')} description={t('campaigns.filter_empty_desc')} />}
        </Card>
      </FadeIn>

      {/* Ce poți face cu o campanie pe grupă */}
      <FadeIn delay={0.05}>
        <div className="relative overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-gradient-to-br from-white via-white to-brand-50/60 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="text-[15px] font-semibold text-neutral-900">{t('campaigns.board_new_title')}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{t('campaigns.board_new_desc')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { icon: FolderTree, key: 'campaigns.g_filter_categories' },
                  { icon: Tag, key: 'campaigns.g_filter_brands' },
                  { icon: BadgePercent, key: 'campaigns.g_filter_sale' },
                  { icon: ListChecks, key: 'campaigns.g_filter_manual' },
                ].map(x => (
                  <span key={x.key} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-[12px] font-medium text-neutral-600 ring-1 ring-neutral-200">
                    <x.icon className="size-3.5 text-neutral-400" />{t(x.key)}
                  </span>
                ))}
              </div>
            </div>
            <Button size="lg" onClick={onNew} disabled={!canCreate} className="shrink-0"><Plus />{t('campaigns.board_new')}</Button>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
