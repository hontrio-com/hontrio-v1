'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, Bot, Layers, LayoutDashboard, Megaphone, Plus, Store } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { PageHeader } from '@/components/app/page-header'
import { PageTabs } from '@/components/app/tabs'
import { Badge } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Card } from '@/components/app/surface'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { isRunning } from '@/components/campaigns/live-campaigns'
import { useFormats } from '@/components/app/formats'
import { buildViews, type CampaignView } from '@/components/campaigns/views'
import { OverviewTab } from '@/components/campaigns/overview-tab'
import { CampaignsTab } from '@/components/campaigns/campaigns-tab'
import { PilotTab } from '@/components/campaigns/pilot-tab'
import { PlanTab } from '@/components/campaigns/plan-tab'
import { LaunchWizard } from '@/components/dashboard/launch-wizard'
import { CampaignTable } from '@/components/campaigns/campaign-table'
import { CampaignSheet } from '@/components/campaigns/campaign-sheet'
import { GroupEditor, type Step } from '@/components/campaigns/group-editor'
import type { CampaignsData } from '@/components/campaigns/types'
import { MAX_GROUPS, type ProductGroup } from '@/lib/campaigns/groups'
import type { MainType, Mode } from '@/lib/campaigns/plan'

// =============================================
// Campanii — patru file, de la ce contează cel mai des la detalii:
// Prezentarea (ce aduc campaniile, ce așteaptă pilotul de la tine), Campaniile
// (toate, cu fișa fiecăreia), Pilotul (propunerile, jurnalul, cum lucrează)
// și Planul campaniei principale (lansarea, bugetul, produsele). Fila
// aleasă stă în adresă (?tab=), ca un link sau „înapoi" să ducă tot acolo.
// Deasupra filelor: de ce n-a putut lucra pilotul la ultima trecere, dacă e cazul.
// =============================================

type Tab = 'overview' | 'campaigns' | 'pilot' | 'plan'
const TABS: Tab[] = ['overview', 'campaigns', 'pilot', 'plan']
type Settings = { daily_budget?: number | null; mode?: Mode; max_daily_budget?: number | null; campaign_type?: MainType }

/** Schimbă adresa fără să reîncarce pagina (Next.js ține pasul cu useSearchParams). */
function setQuery(change: (q: URLSearchParams) => void, push: boolean) {
  const q = new URLSearchParams(window.location.search)
  change(q)
  const url = `${window.location.pathname}${q.size ? `?${q}` : ''}`
  if (push) window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
}

function CampaignsView() {
  const { t } = useT()
  const params = useSearchParams()
  const tabParam = params.get('tab') as Tab | null
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'overview'
  const wantsNew = params.get('new') === '1'

  const [data, setData] = useState<CampaignsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // `nonce` repornește editorul la fiecare deschidere; conținutul rămâne cât panoul se închide
  const [editor, setEditor] = useState<{ open: boolean; group: ProductGroup | null; step: Step; nonce: number }>({ open: false, group: null, step: 1, nonce: 0 })
  const [sheet, setSheet] = useState<{ open: boolean; key: string | null }>({ open: false, key: null })
  const [handledNew, setHandledNew] = useState(false)
  const scrollTarget = useRef<string | null>(null)

  // Starea se schimbă doar în callback-urile răspunsului, nu în efectul care pornește încărcarea
  const load = useCallback((): Promise<CampaignsData | null> =>
    fetch('/api/campaigns/plan')
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<CampaignsData> })
      .then(body => { setData(body); setFailed(false); return body })
      .catch(() => { setFailed(true); return null })
      .finally(() => setLoading(false)), [])

  useEffect(() => { load() }, [load])

  // După schimbarea filei: la ce trebuia arătat în ea (ex. lansarea)
  useEffect(() => {
    const id = scrollTarget.current
    if (!id) return
    scrollTarget.current = null
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [tab])

  const currency = data?.store?.currency || 'RON'
  const f = useFormats(currency)
  const plan = data?.plan ?? null
  const views = useMemo(() => (data?.plan ? buildViews(data.plan, data.groups ?? [], data.campaigns ?? []) : []), [data])
  const groupNames = useMemo(() => new Map((data?.groups ?? []).map(g => [g.group.id, g.group.name])), [data])
  const live = data?.campaigns ?? []
  const groups = data?.groups ?? []
  const proposals = data?.proposals ?? []
  const full = groups.filter(g => g.group.status !== 'ended').length >= MAX_GROUPS

  // ?new=1 (din căutarea ⌘K): editorul unei campanii noi, o dată
  if (wantsNew && plan && !handledNew) {
    setHandledNew(true)
    if (!full) setEditor(e => ({ open: true, group: null, step: 1, nonce: e.nonce + 1 }))
  }
  if (!wantsNew && handledNew) setHandledNew(false)

  const goTab = (next: Tab, target?: string) => {
    scrollTarget.current = target ?? null
    if (next === tab) {
      if (target) document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setQuery(q => { if (next === 'overview') q.delete('tab'); else q.set('tab', next) }, true)
  }
  const openEditor = (group: ProductGroup | null, step: Step = 1) => {
    setNotice(null)
    setEditor(e => ({ open: true, group, step, nonce: e.nonce + 1 }))
  }
  const closeEditor = (open: boolean) => {
    setEditor(e => ({ ...e, open }))
    if (!open && wantsNew) setQuery(q => q.delete('new'), false)
  }
  const openView = (v: CampaignView) => setSheet({ open: true, key: v.key })
  const openGroup = (id: string) => setSheet({ open: true, key: id })

  async function saveSettings(body: Settings): Promise<boolean> {
    try {
      const r = await fetch('/api/campaigns/plan', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error()
      // Bugetul, modul pilotului și tipul campaniei schimbă planul: îl socotește serverul
      const fresh = await load()
      // Salvat, dar pagina a rămas cu planul vechi: omul trebuie să știe, altfel vede alt tip sau alt buget
      if (!fresh) setNotice(t('campaigns.reload_error'))
      return !!fresh
    } catch {
      setNotice(t('campaigns.save_error'))
      return false
    }
  }

  const header = (tabs?: React.ReactNode, extra?: { meta?: React.ReactNode; actions?: React.ReactNode }) => (
    <PageHeader title={t('campaigns.title')} description={t('campaigns.page_description')} meta={extra?.meta} actions={extra?.actions}>{tabs}</PageHeader>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {header(<div className="flex gap-6 border-b border-neutral-200 pb-3">{['w-[84px]', 'w-[92px]', 'w-[56px]', 'w-[48px]'].map(w => <Skeleton key={w} className={`h-5 ${w}`} />)}</div>)}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[136px] rounded-xl" />)}</div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-[320px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      </div>
    )
  }

  if (failed && !data) {
    return (
      <div className="space-y-6">
        {header()}
        <Card>
          <EmptyState icon={<AlertCircle />} title={t('campaigns.load_error')} description={t('campaigns.load_error_hint')}
            action={<Button variant="primary" onClick={load}>{t('catalog.retry')}</Button>} />
        </Card>
      </div>
    )
  }

  if (!data?.store || !data.store.supported || !plan) {
    return (
      <div className="space-y-6">
        {header()}
        <Card>
          <EmptyState icon={<Store />}
            title={data?.store ? t('catalog.unsupported_title') : t('campaigns.no_store_title')}
            description={data?.store ? t('catalog.unsupported_desc') : t('campaigns.no_store_desc')}
            action={!data?.store && <Button asChild variant="primary"><Link href="/settings?tab=integrations">{t('catalog.connect_store')}</Link></Button>} />
        </Card>
      </div>
    )
  }

  // Campania principală rulează (sau stă pe pauză): planul ei arată campania, nu lansarea
  const running = live.some(c => !c.group_id && c.segment !== 'group' && isRunning(c))
  // Pilotul lucrează cât timp rulează orice campanie Hontrio, și a unei grupe
  const piloting = live.some(isRunning)
  const sheetView = sheet.key ? views.find(v => v.key === sheet.key) ?? null : null
  const mode = plan.settings.mode

  const meta = piloting
    ? <Badge tone="green" live>{t('campaigns.meta_pilot_on', { mode: t(`campaigns.mode_${mode}`) })}</Badge>
    : <Badge>{t('campaigns.meta_pilot_off')}</Badge>
  const actions = (
    <Button variant="primary" onClick={() => openEditor(null)} disabled={full} title={full ? t('campaigns.group_limit', { max: MAX_GROUPS }) : undefined}>
      <Plus />{t('campaigns.board_new')}
    </Button>
  )
  const tabs = (
    <PageTabs id="campaigns" value={tab} onChange={next => goTab(next)} items={[
      { value: 'overview', label: t('campaigns.tab_overview'), icon: <LayoutDashboard /> },
      { value: 'campaigns', label: t('campaigns.tab_campaigns'), icon: <Megaphone />, count: views.length },
      { value: 'pilot', label: t('campaigns.tab_pilot'), icon: <Bot />, count: proposals.length, attention: true },
      { value: 'plan', label: t('campaigns.tab_plan'), icon: <Layers /> },
    ]} />
  )

  const pilotError = data.store.pilot?.error ?? null
  // Contul Google Ads fără buget: campaniile sunt pornite, dar Google nu le arată
  const budgetSpent = live.some(c => c.status === 'active') && !!data.audit?.result?.checks.some(c => c.id === 'account_budget_spent')

  return (
    <div className="space-y-6">
      {header(tabs, { meta, actions })}

      {/* Pilotul n-a putut lucra (cont necitit, acces pierdut): oprirea de siguranță așteaptă */}
      {pilotError && (
        <Callout tone="danger" title={t('campaigns.pilot_error_title')}>
          {translateStored(t, pilotError)} {t('campaigns.pilot_error_hint')}
        </Callout>
      )}

      {budgetSpent && (
        <Callout tone="danger" title={t('campaigns.budget_spent_title')}>
          {t('campaigns.budget_spent_body')}
        </Callout>
      )}

      {(notice || success) && (
        <div className="space-y-2">
          {notice && <Callout tone="warning" onClose={() => setNotice(null)}>{notice}</Callout>}
          {success && <Callout tone="success" onClose={() => setSuccess(null)}>{success}</Callout>}
        </div>
      )}

      {tab === 'overview' && (live.length > 0 ? (
        <OverviewTab plan={plan} views={views} series={data.series ?? []} storeCounted={!!data.store_counted} liveAt={data.store.pilot?.live_at ?? null} mode={mode} proposals={proposals} journal={data.journal ?? []}
          f={f} onOpen={openView} onTab={next => goTab(next)} onNew={() => openEditor(null)} />
      ) : (
        <div className="space-y-6">
          <FadeIn>
            <LaunchWizard plan={plan} audit={data.audit ?? null} f={f}
              store={{ name: data.store.store_name ?? null, offers: plan.summary.offers, orders: null }}
              onChanged={async () => (await load())?.plan ?? null}
              onLaunched={text => { setNotice(null); setSuccess(text); load() }} />
          </FadeIn>
          {views.length > 1 && (
            <FadeIn delay={0.05}>
              <Card className="overflow-hidden">
                <div className="px-5 pb-4 pt-5">
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-900">{t('campaigns.board_title')}</h3>
                  <p className="mt-0.5 text-[13px] text-neutral-500">{t('campaigns.overview_campaigns_hint')}</p>
                </div>
                <CampaignTable views={views} plan={plan} f={f} onOpen={openView} compact />
              </Card>
            </FadeIn>
          )}
        </div>
      ))}

      {tab === 'campaigns' && <CampaignsTab plan={plan} views={views} f={f} onOpen={openView} onNew={() => openEditor(null)} canCreate={!full} />}

      {tab === 'pilot' && (
        <PilotTab mode={mode} maxDailyBudget={plan.settings.max_daily_budget} currency={currency} proposals={proposals} journal={data.journal ?? []}
          campaigns={live} groupNames={groupNames} piloting={piloting} f={f} onSaveSettings={saveSettings} onChanged={load} onError={setNotice} />
      )}

      {tab === 'plan' && (
        <PlanTab plan={plan} audit={data.audit ?? null} running={running} currency={currency} groupNames={groupNames} f={f}
          onSaveSettings={saveSettings} onChanged={load} onError={setNotice} onOpenGroup={openGroup} onOpenMain={() => openGroup('main')}
          onLaunched={text => { setNotice(null); setSuccess(text); goTab('overview') }} />
      )}

      <CampaignSheet view={sheetView} open={sheet.open && !!sheetView} onOpenChange={open => setSheet(s => ({ ...s, open }))} plan={plan} f={f}
        onEdit={(g, step) => { setSheet(s => ({ ...s, open: false })); openEditor(g.group, step) }}
        onPlan={() => { setSheet(s => ({ ...s, open: false })); goTab('plan') }}
        onChanged={load} />

      <GroupEditor session={editor.nonce} open={editor.open} onOpenChange={closeEditor} group={editor.group} initialStep={editor.step}
        plan={plan} groups={groups} campaigns={live} audit={data.audit ?? null} today={data.today ?? new Date().toISOString().slice(0, 10)}
        currency={currency} f={f} onSaved={load} onLaunched={text => { setNotice(null); setSuccess(text) }} />
    </div>
  )
}

// useSearchParams cere o graniță Suspense la randarea statică
export default function CampaignsPage() {
  return <Suspense fallback={null}><CampaignsView /></Suspense>
}
