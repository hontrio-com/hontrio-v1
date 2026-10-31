'use client'

import { CreditCard, FileText, ImageIcon, Package, Store, Users } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardHeader, Section } from '@/components/app/surface'
import { DataRow, Metric, StatCard } from '@/components/app/kpi'
import { Badge, type Tone } from '@/components/app/badge'
import { FadeIn } from '@/components/app/motion'
import { useFormats } from '@/components/app/formats'
import { useNow } from '@/components/app/time'
import { useAdminData } from '@/components/admin/use-admin-data'
import { LoadError, PageSkeleton, PlanBadge, PlanDistribution, RefreshButton, UserAvatar } from '@/components/admin/parts'

// =============================================
// Statisticile platformei: câți oameni și ce fac ei, cum stă luna curentă cu
// banii (în dolari, moneda abonamentelor) și ce s-a întâmplat ultima oară.
// =============================================

type Financial = {
  mrr: number; monthlySubscriptionRevenue: number; monthlyCreditPackRevenue: number
  totalMonthlyRevenue: number; totalMonthlyApiCost: number
  monthlyProfit: number; profitMargin: number
  totalRevenue: number; totalApiCost: number; totalProfit: number
  totalImageCost: number; totalTextCost: number; totalTextGenerations: number
  arpu: number; costPerCredit: number; revenuePerCredit: number; totalPaidUsers: number
  planDistribution: Record<string, number>
}
type Stats = {
  totalUsers: number; totalStores: number; totalProducts: number; totalImages: number
  totalCreditsUsed: number
  recentUsers: { id: string; email: string; name: string; plan: string; credits: number; created_at: string }[]
  recentJobs: { id: string; type: string; status: string; created_at: string; user_email: string; user_name: string | null }[]
  financial: Financial
}

const PLAN_PRICES: Record<string, number> = { free: 0, starter: 19, professional: 49, enterprise: 99 }
// i18n-ignore-start: coduri scurte, la fel în orice limbă
const JOB_STATUS: Record<string, { tone: Tone; label: string }> = {
  completed: { tone: 'green', label: 'OK' },
  failed: { tone: 'red', label: 'ERR' },
  processing: { tone: 'amber', label: '…' },
}
// i18n-ignore-end

export default function AdminStatsPage() {
  const { t, intlLocale } = useT()
  const f = useFormats('USD')
  const now = useNow()
  const { data: stats, loading, refresh } = useAdminData<Stats>('/api/admin/stats')

  if (loading && !stats) return <PageSkeleton tiles={5} />
  if (!stats?.financial) return <LoadError />

  const fin = stats.financial
  const usd = (n: number) => f.money.format(n)
  const usd2 = (n: number) => f.money2.format(n)
  const month = now ? new Date(now).toLocaleDateString(intlLocale, { month: 'long', year: 'numeric' }) : ''
  const jobType = (type: string) => t.has(`admin.job_type_${type}`) ? t(`admin.job_type_${type}`) : type
  const counters = [
    { label: t('admin.nav_users'), value: stats.totalUsers, icon: <Users /> },
    { label: t('admin.stats_stores'), value: stats.totalStores, icon: <Store /> },
    { label: t('common.products'), value: stats.totalProducts, icon: <Package /> },
    { label: t('sidebar.ai_images'), value: stats.totalImages, icon: <ImageIcon /> },
    { label: t('admin.stats_credits_used'), value: stats.totalCreditsUsed, icon: <CreditCard /> },
  ]

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.stats_title')} description={t('admin.stats_subtitle', { date: month })}
        actions={<RefreshButton loading={loading} onClick={refresh} />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {counters.map(c => <StatCard key={c.label} label={c.label} value={f.int.format(c.value)} icon={c.icon} />)}
      </div>

      <Section title={t('admin.stats_financial_dashboard')} description={`${t('admin.stats_current_month')} · ${month}`}
        action={(
          <div className="text-right">
            <p className="text-[20px] font-semibold leading-none tracking-[-0.02em] text-neutral-950 tabular-nums">{usd(fin.totalMonthlyRevenue)}</p>
            <p className="mt-1 text-[12px] text-neutral-500">{t('admin.stats_total_monthly_revenue')}</p>
          </div>
        )}>
        <Card className="overflow-hidden">
          <div className="grid grid-cols-2 gap-px bg-neutral-100 lg:grid-cols-4">
            <Metric label={t('admin.mrr')} value={usd(fin.mrr)} note={t('admin.stats_subscribers', { count: fin.totalPaidUsers })} />
            <Metric label={t('admin.financial_subscriptions')} value={usd(fin.monthlySubscriptionRevenue)} note={t('admin.stats_current_month')} />
            <Metric label={t('admin.financial_credit_packs')} value={usd(fin.monthlyCreditPackRevenue)} note={t('admin.stats_individual_packs')} />
            <Metric label={t('admin.financial_api_cost')} value={usd2(fin.totalMonthlyApiCost)} note="OpenAI + KIE" /* i18n-ignore */ />
            <Metric label={t('admin.financial_profit')} value={usd(fin.monthlyProfit)} note={t('admin.stats_current_month')} />
            <Metric label={t('admin.stats_profit_margin')} value={`${f.num.format(fin.profitMargin)}%`} />
            <Metric label={t('admin.arpu')} value={usd2(fin.arpu)} note={t('admin.stats_arpu_sub')} />
            <Metric label={t('admin.stats_cost_per_credit')} value={`$${fin.costPerCredit.toFixed(4)}`} note={t('admin.stats_revenue_per_credit', { value: fin.revenuePerCredit.toFixed(3) })} />
          </div>
        </Card>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('admin.stats_all_time')} />
          <dl className="divide-y divide-neutral-100 px-5 pb-3 pt-2">
            <DataRow label={t('admin.financial_total_revenue')} value={usd(fin.totalRevenue)} strong />
            <DataRow label={t('admin.financial_total_api_cost')} value={usd2(fin.totalApiCost)} />
            <DataRow label={t('admin.financial_total_profit')} value={usd(fin.totalProfit)} strong />
            <DataRow label={t('admin.stats_image_cost')} value={usd2(fin.totalImageCost)} />
            <DataRow label={t('admin.stats_text_cost')} value={`$${fin.totalTextCost.toFixed(4)}`} />
            <DataRow label={t('admin.stats_texts_generated')} value={f.int.format(fin.totalTextGenerations)} />
          </dl>
        </Card>
        <Card>
          <CardHeader title={t('admin.plan_distribution')} />
          <div className="px-5 pb-5 pt-4">
            <PlanDistribution plans={fin.planDistribution} total={stats.totalUsers} note={p => t('admin.stats_price_per_month', { price: PLAN_PRICES[p] ?? 0 })} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('admin.stats_recent_users')} description={t('admin.stats_total_count', { count: stats.totalUsers })} />
          <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
            {stats.recentUsers.slice(0, 6).map(user => (
              <li key={user.id} className="flex items-center gap-3 px-5 py-2.5">
                <UserAvatar name={user.name} email={user.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-neutral-900">{user.name || user.email}</p>
                  <p className="truncate text-[12px] text-neutral-500">{user.email}</p>
                </div>
                <div className="shrink-0 text-right">
                  <PlanBadge plan={user.plan} />
                  <p className="mt-0.5 text-[12px] tabular-nums text-neutral-400">{user.credits} {t('common.credits_short')}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={t('admin.stats_recent_generations')} action={<Badge tone="green" live>{t('admin.stats_live')}</Badge>} />
          <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
            {stats.recentJobs.slice(0, 8).map(job => {
              const status = JOB_STATUS[job.status] ?? { tone: 'neutral' as Tone, label: 'Q' }
              return (
                <li key={job.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 [&_svg]:size-3.5">
                    {job.type === 'image' ? <ImageIcon /> : <FileText />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-neutral-900">{jobType(job.type)}</p>
                    <p className="truncate text-[12px] text-neutral-500">
                      {job.user_name || job.user_email} · {new Date(job.created_at).toLocaleString(intlLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title={t('admin.api_price_reference')} />
        <div className="mt-3 grid grid-cols-1 gap-px border-t border-neutral-100 bg-neutral-100 sm:grid-cols-2">
          {[
            { name: 'OpenAI GPT-4o-mini', icon: <FileText />, lines: [t('admin.stats_gpt_price'), t('admin.stats_gpt_per_generation'), t('admin.stats_gpt_tokens')] }, // i18n-ignore
            { name: 'KIE Nano Banana Pro', icon: <ImageIcon />, lines: [t('admin.stats_kie_price'), t('admin.stats_kie_avg'), t('admin.stats_kie_via')] }, // i18n-ignore
          ].map(api => (
            <div key={api.name} className="bg-white px-5 py-4">
              <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-neutral-900 [&_svg]:size-4 [&_svg]:text-neutral-400">{api.icon}{api.name}</p>
              {api.lines.map(line => <p key={line} className="text-[12px] leading-relaxed text-neutral-500">{line}</p>)}
            </div>
          ))}
        </div>
      </Card>
    </FadeIn>
  )
}
