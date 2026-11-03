'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Check, ChevronDown, ChevronUp, CreditCard, Crown, ExternalLink, FileText, Gift, ImageIcon, Plus, Receipt, Rocket,
  Settings, Shield, Sparkles, Zap,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { PACKS, PACK_IDS, PAID_PLANS, perCreditUsd } from '@/lib/billing/catalog'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app/page-header'
import { PageTabs } from '@/components/app/tabs'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Button, textActionStyles } from '@/components/app/button'
import { Skeleton } from '@/components/app/feedback'
import { FadeIn, NumberTicker } from '@/components/app/motion'
import { ProgressBar } from '@/components/app/progress'

// =============================================
// Abonament și credite — planul curent cu creditele rămase, planurile,
// pachetele de credite și istoricul. Plata se face prin Stripe; fila aleasă
// stă în adresă (?tab=), iar după o plată pagina deschide istoricul.
// =============================================

type Transaction = {
  id: string; type: string; amount: number; balance_after: number
  description: string; reference_type: string; created_at: string
}
type Tab = 'plans' | 'credits' | 'history'
type Translate = (k: string, p?: Record<string, string | number>) => string

const TABS: Tab[] = ['plans', 'credits', 'history']

const getPlans = (t: Translate) => [
  {
    id: 'free', name: t('credits.plan_free'), price: 0, period: '',
    description: t('credits.test_platform'),
    icon: Gift, credits: 20, popular: false,
    features: [t('credits.credits_included', { count: 20 }), t('credits.ai_text_gen'), t('credits.ai_image_gen'), t('credits.feat_1_store'), t('credits.email_support')],
    limitations: [t('credits.no_bulk_gen'), t('credits.no_priority_support')],
  },
  {
    id: 'starter', name: t('credits.plan_starter'), price: PAID_PLANS.starter.priceUsd, period: t('credits.per_month_label'),
    description: t('credits.test_platform'),
    icon: Zap, credits: PAID_PLANS.starter.credits, popular: false,
    features: [t('credits.feat_credits_month', { count: PAID_PLANS.starter.credits }), t('credits.feat_unlimited_text'), t('credits.feat_all_styles'), t('credits.feat_1_store'), t('credits.feat_priority_support'), t('credits.feat_full_seo')],
    limitations: [],
  },
  {
    id: 'professional', name: t('credits.plan_professional'), price: PAID_PLANS.professional.priceUsd, period: t('credits.per_month_label'),
    description: t('credits.plan_for_growing'),
    icon: Rocket, credits: PAID_PLANS.professional.credits, popular: true,
    features: [t('credits.feat_credits_month', { count: PAID_PLANS.professional.credits }), t('credits.feat_includes_starter'), t('credits.feat_batch_gen'), t('credits.feat_3_stores'), t('credits.feat_priority_247'), t('credits.feat_advanced_reports')],
    limitations: [],
  },
  {
    id: 'enterprise', name: t('credits.plan_enterprise'), price: PAID_PLANS.enterprise.priceUsd, period: t('credits.per_month_label'),
    description: t('credits.plan_for_scale'),
    icon: Crown, credits: PAID_PLANS.enterprise.credits, popular: false,
    features: [t('credits.feat_credits_month', { count: PAID_PLANS.enterprise.credits }), t('credits.feat_includes_pro'), t('credits.feat_unlimited_stores'), t('credits.feat_dedicated_manager'), t('credits.feat_sla'), t('credits.feat_personal_training')],
    limitations: [],
  },
]

// Prețurile vin din lib/billing/catalog.ts, aceleași cu care se încasează
const PACK_OPTIONS = PACK_IDS.map(id => ({
  id, credits: PACKS[id].credits, price: PACKS[id].priceUsd, perCredit: perCreditUsd(id), popular: id === 'pack_300',
}))

const getCosts = (t: Translate) => [
  { label: t('credits.ai_text_gen'), cost: 3, icon: FileText },
  { label: t('credits.image_white'), cost: 6, icon: ImageIcon },
  { label: t('credits.image_lifestyle'), cost: 7, icon: ImageIcon },
  { label: t('credits.image_premium'), cost: 7, icon: ImageIcon },
  { label: t('credits.image_seasonal'), cost: 8, icon: ImageIcon },
  { label: t('credits.auto_gen_3x_label'), cost: 18, icon: Sparkles },
]

function txIcon(refType: string) {
  if (refType === 'image_generation') return ImageIcon
  if (refType === 'text_generation') return FileText
  return Plus
}

function SubscriptionView() {
  const { t, intlLocale } = useT()
  const PLANS = getPlans(t)
  const COSTS = getCosts(t)
  const { data: session, update: updateSession } = useSession()
  const params = useSearchParams()
  const paid = params.get('success') === 'true' || params.get('credits_success') === 'true'
  const tabParam = params.get('tab') as Tab | null
  // După o plată, istoricul arată ce s-a adăugat
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : paid ? 'history' : 'plans'
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [checkoutId, setCheckoutId] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)

  const userPlan = (session?.user as { plan?: string } | undefined)?.plan || 'free'

  // Întoarcerea din Stripe: un mesaj (și planul nou în sesiune)
  useEffect(() => {
    if (params.get('success') === 'true') {
      toast.success(t('credits.subscription_activated'))
      updateSession() // planul nou se vede imediat
    }
    if (params.get('credits_success') === 'true') toast.success(t('credits.credits_purchased_success'))
    if (params.get('canceled') === 'true') toast.error(t('credits.payment_cancelled'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => { fetchCredits() }, [])

  async function fetchCredits() {
    try { const r = await fetch('/api/credits'); const d = await r.json(); setBalance(d.balance || 0); setTransactions(d.transactions || []) }
    catch {} finally { setLoading(false) }
  }

  const goTab = (next: Tab) => {
    const q = new URLSearchParams(window.location.search)
    for (const k of ['success', 'credits_success', 'canceled']) q.delete(k)
    if (next === 'plans') q.delete('tab'); else q.set('tab', next)
    window.history.pushState(null, '', `${window.location.pathname}${q.size ? `?${q}` : ''}`)
  }

  async function handleSubscribe(planId: string) {
    if (planId === 'free') return
    setCheckoutId(planId)
    try {
      const r = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: planId }) })
      const d = await r.json()
      if (d.url) window.location.href = d.url
      else toast.error(d.error || t('credits.error_payment'))
    } catch { toast.error(t('common.error_connection')) }
    finally { setCheckoutId('') }
  }

  async function handleBuyPack(packId: string) {
    setCheckoutId(packId)
    try {
      const r = await fetch('/api/stripe/credits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pack_id: packId }) })
      const d = await r.json()
      if (d.url) window.location.href = d.url
      else toast.error(d.error || t('credits.error_payment_init'))
    } catch { toast.error(t('common.error_connection')) }
    finally { setCheckoutId('') }
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const r = await fetch('/api/stripe/portal', { method: 'POST' }); const d = await r.json()
      if (d.url) window.location.href = d.url
      else toast.error(d.error || t('credits.no_active_subscription'))
    } catch { toast.error(t('common.error_connection')) }
    finally { setPortalLoading(false) }
  }

  const currentPlan = PLANS.find(p => p.id === userPlan) || PLANS[0]
  const planIdx = PLANS.findIndex(p => p.id === userPlan)
  const totalUsed = transactions.filter(tx => tx.type === 'usage').reduce((s, tx) => s + Math.abs(tx.amount), 0)
  const displayed = showAll ? transactions : transactions.slice(0, 8)
  const fmtInt = new Intl.NumberFormat(intlLocale)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-72 max-w-full" /></div>
        <Skeleton className="h-[120px] rounded-xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[380px] rounded-xl" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('credits.title')} description={t('credits.manage_plan_desc')}
        actions={userPlan !== 'free' && <Button loading={portalLoading} onClick={handlePortal}>{!portalLoading && <Settings />}{t('credits.manage_btn')}</Button>} />

      {/* Planul curent și creditele rămase */}
      <FadeIn>
        <Card>
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white"><currentPlan.icon className="size-5" /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[16px] font-semibold tracking-[-0.01em] text-neutral-900">{t('credits.plan_name', { name: currentPlan.name })}</p>
                  {userPlan !== 'free' && <Badge tone="green" dot>{t('common.active')}</Badge>}
                </div>
                <p className="mt-0.5 text-[13px] text-neutral-500">{currentPlan.description}</p>
              </div>
            </div>
            <div className="sm:w-64">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-neutral-500">{t('credits.credits_remaining')}</span>
                <span className="text-[24px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-neutral-950">
                  <NumberTicker value={balance} format={n => fmtInt.format(Math.round(n))} />
                </span>
              </div>
              <ProgressBar value={currentPlan.credits ? (balance / currentPlan.credits) * 100 : 0} className="mt-2.5" />
            </div>
          </div>
        </Card>
      </FadeIn>

      <PageTabs id="credits" value={tab} onChange={goTab} items={[
        { value: 'plans', label: t('credits.tab_plans'), icon: <Sparkles /> },
        { value: 'credits', label: t('credits.buy_more'), icon: <CreditCard /> },
        { value: 'history', label: t('credits.tab_history'), icon: <Receipt />, count: transactions.length || undefined },
      ]} />

      <FadeIn key={tab}>
        {/* ═══ PLANURI ═══ */}
        {tab === 'plans' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {PLANS.map((plan, i) => {
                const isCurrent = userPlan === plan.id
                const isUpgrade = i > planIdx
                return (
                  <div key={plan.id} className={cn('relative flex flex-col rounded-xl border bg-white p-5 shadow-card transition-shadow hover:shadow-raised',
                    plan.popular ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200/80')}>
                    {plan.popular && <Badge tone="brand" className="absolute -top-2.5 left-5 h-5 text-[11px]">{t('campaigns.recommended')}</Badge>}
                    <div className="flex items-center gap-3">
                      <span className={cn('flex size-9 items-center justify-center rounded-lg', plan.popular ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600')}><plan.icon className="size-4" /></span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-neutral-900">{plan.name}</p>
                        <p className="truncate text-[12px] text-neutral-500">{plan.description}</p>
                      </div>
                    </div>
                    <div className="mt-5">
                      {plan.price === 0
                        ? <p className="text-[30px] font-semibold leading-none tracking-[-0.03em] text-neutral-950">{t('credits.plan_free')}</p>
                        : <p className="text-[30px] font-semibold leading-none tracking-[-0.03em] text-neutral-950">${plan.price}<span className="ml-1 text-[14px] font-normal tracking-normal text-neutral-500">{plan.period}</span></p>}
                      <p className="mt-2 text-[12px] text-neutral-500"><span className="font-medium text-neutral-800">{t('credits.credits_count', { count: plan.credits })}</span> {t('credits.included_word', { count: plan.credits })}</p>
                    </div>
                    <ul className="mt-5 flex-1 space-y-2 border-t border-neutral-100 pt-5">
                      {plan.features.map(feat => (
                        <li key={feat} className="flex items-start gap-2 text-[13px] text-neutral-700">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-neutral-900" strokeWidth={2.5} />{feat}
                        </li>
                      ))}
                      {plan.limitations.map(lim => (
                        <li key={lim} className="flex items-start gap-2 text-[13px] text-neutral-400 line-through">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-neutral-300" />{lim}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5">
                      {isCurrent ? (
                        <Button disabled className="w-full"><Check />{t('credits.current_plan_btn')}</Button>
                      ) : isUpgrade ? (
                        <Button variant={plan.popular ? 'primary' : 'secondary'} loading={checkoutId === plan.id} onClick={() => handleSubscribe(plan.id)} className="w-full">
                          {checkoutId !== plan.id && <Zap />}{checkoutId === plan.id ? t('credits.processing_checkout') : t('credits.upgrade_to', { plan: plan.name })}
                        </Button>
                      ) : (
                        <Button variant="ghost" loading={portalLoading} onClick={handlePortal} className="w-full">{t('credits.manage_btn')}</Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-neutral-500">
              <Shield className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
              <span><span className="font-medium text-neutral-700">{t('credits.secure_stripe')}.</span> {t('credits.payments_secure_desc')}</span>
            </p>
          </div>
        )}

        {/* ═══ CREDITE ═══ */}
        {tab === 'credits' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title={t('credits.buy_credits')} description={t('credits.credits_no_expire')} />
              <ul className="space-y-2 p-5">
                {PACK_OPTIONS.map(pack => (
                  <li key={pack.id} className={cn('flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors',
                    pack.popular ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200/80 hover:border-neutral-300')}>
                    <div className="flex items-center gap-3">
                      <span className={cn('flex size-9 items-center justify-center rounded-lg', pack.popular ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500')}><Sparkles className="size-4" /></span>
                      <div>
                        <p className="flex items-center gap-2 text-[14px] font-semibold text-neutral-900">
                          {t('credits.credits_count', { count: pack.credits })}
                          {pack.popular && <Badge tone="brand" className="h-5 text-[11px]">{t('credits.popular')}</Badge>}
                        </p>
                        <p className="text-[12px] tabular-nums text-neutral-500">${pack.perCredit.toFixed(2)} / {t('credits.per_credit')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[15px] font-semibold tabular-nums text-neutral-900">${pack.price}</p>
                      <Button size="sm" variant={pack.popular ? 'primary' : 'secondary'} loading={checkoutId === pack.id} disabled={!!checkoutId} onClick={() => handleBuyPack(pack.id)}>
                        {t('credits.buy_btn')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader title={t('credits.costs_title')} />
                <ul className="divide-y divide-neutral-100 px-5 pb-2 pt-3">
                  {COSTS.map(item => (
                    <li key={item.label} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                      <span className="flex items-center gap-2 text-neutral-600"><item.icon className="size-3.5 text-neutral-400" />{item.label}</span>
                      <Badge>{item.cost} {t('common.credits_short')}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
              <p className="flex items-start gap-2 px-1 text-[12px] leading-relaxed text-neutral-500">
                <Shield className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />{t('credits.transactions_secure_stripe')}
              </p>
            </div>
          </div>
        )}

        {/* ═══ ISTORIC ═══ */}
        {tab === 'history' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title={t('credits.transaction_history')} description={t('credits.transactions_total', { count: transactions.length })} />
              {transactions.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <p className="text-[14px] font-medium text-neutral-700">{t('credits.no_transactions')}</p>
                  <p className="mt-1 text-[13px] text-neutral-500">{t('credits.transactions_appear')}</p>
                </div>
              ) : (
                <>
                  <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
                    {displayed.map(tx => {
                      const Icon = txIcon(tx.reference_type)
                      return (
                        <li key={tx.id} className="flex items-center gap-3 px-5 py-3">
                          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tx.amount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500')}>
                            <Icon className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] text-neutral-800">
                              {translateStored(t, tx.description) || (t.has(`credits.tx_type_${tx.type}`) ? t(`credits.tx_type_${tx.type}`) : tx.type)}
                            </p>
                            <p className="text-[12px] text-neutral-400">
                              {new Date(tx.created_at).toLocaleDateString(intlLocale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={cn('text-[13px] font-semibold tabular-nums', tx.amount > 0 ? 'text-emerald-600' : 'text-neutral-800')}>{tx.amount > 0 ? '+' : ''}{tx.amount}</p>
                            <p className="text-[11px] tabular-nums text-neutral-400">{t('settings.balance_label')} {tx.balance_after}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  {transactions.length > 8 && (
                    <div className="border-t border-neutral-100 px-5 py-3">
                      <button onClick={() => setShowAll(s => !s)} className={cn(textActionStyles, 'text-[12px]')}>
                        {showAll ? <>{t('credits.show_less')}<ChevronUp /></> : <>{t('credits.show_all', { count: transactions.length })}<ChevronDown /></>}
                      </button>
                    </div>
                  )}
                </>
              )}
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader title={t('credits.usage_summary')} />
                <div className="space-y-4 px-5 pb-5 pt-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className="text-neutral-500">{t('credits.credits_used')}</span>
                      <span className="font-semibold tabular-nums text-neutral-900">{fmtInt.format(totalUsed)}</span>
                    </div>
                    <ProgressBar value={currentPlan.credits ? (totalUsed / currentPlan.credits) * 100 : 0} barClassName="bg-neutral-400" />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className="text-neutral-500">{t('credits.credits_remaining')}</span>
                      <span className="font-semibold tabular-nums text-neutral-900">{fmtInt.format(balance)}</span>
                    </div>
                    <ProgressBar value={currentPlan.credits ? (balance / currentPlan.credits) * 100 : 0} />
                  </div>
                  <dl className="space-y-2 border-t border-neutral-100 pt-4">
                    {[
                      { label: t('credits.texts_generated'), icon: FileText, count: transactions.filter(tx => tx.reference_type === 'text_generation').length },
                      { label: t('credits.images_generated'), icon: ImageIcon, count: transactions.filter(tx => tx.reference_type === 'image_generation').length },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between text-[13px]">
                        <dt className="flex items-center gap-2 text-neutral-500"><item.icon className="size-3.5" />{item.label}</dt>
                        <dd className="font-medium tabular-nums text-neutral-900">{item.count}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Card>

              {userPlan !== 'free' && (
                <Card>
                  <CardHeader title={t('credits.billing')} description={t('credits.manage_stripe_desc')} />
                  <div className="px-5 pb-5 pt-4">
                    <Button loading={portalLoading} onClick={handlePortal} className="w-full">{!portalLoading && <ExternalLink />}{t('credits.billing_portal')}</Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </FadeIn>
    </div>
  )
}

// useSearchParams cere o graniță Suspense la randarea statică
export default function SubscriptionPage() {
  return <Suspense fallback={null}><SubscriptionView /></Suspense>
}
