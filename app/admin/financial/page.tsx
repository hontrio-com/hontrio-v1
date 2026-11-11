'use client'

import { UserPlus, Wallet } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardHeader } from '@/components/app/surface'
import { StatCard } from '@/components/app/kpi'
import { BarTrend } from '@/components/app/charts'
import { Callout } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useFormats } from '@/components/app/formats'
import { useNow } from '@/components/app/time'
import { useAdminData } from '@/components/admin/use-admin-data'
import { LoadError, PageSkeleton, RefreshButton } from '@/components/admin/parts'

// =============================================
// Raportul financiar: încasările și conturile noi pe ultimele 12 luni.
// Hontrio nu încasează încă nimic (abonamentul în funcție de vânzări nu există
// încă), deci veniturile sunt 0 până atunci.
// =============================================

type FinancialData = {
  monthly: { label: string; newUsers: number }[]
  revenue: { thisMonth: number; allTime: number }
}

export default function FinancialPage() {
  const { t, intlLocale } = useT()
  const f = useFormats('USD')
  const now = useNow()
  const { data, loading, refresh } = useAdminData<FinancialData>('/api/admin/financial')

  if (loading && !data) return <PageSkeleton tiles={3} />
  if (!data?.monthly) return <LoadError />

  const usd = (n: number) => f.money.format(n)
  const month = now ? new Date(now).toLocaleDateString(intlLocale, { month: 'long', year: 'numeric' }) : ''
  const newThisMonth = data.monthly[data.monthly.length - 1]?.newUsers ?? 0

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.financial_title')} description={month} actions={<RefreshButton loading={loading} onClick={refresh} />} />

      <Callout>{t('admin.financial_no_billing')}</Callout>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('admin.financial_revenue_this_month')} value={usd(data.revenue.thisMonth)} icon={<Wallet />} />
        <StatCard label={t('admin.financial_total_revenue')} value={usd(data.revenue.allTime)} icon={<Wallet />} />
        <StatCard label={t('admin.financial_new_users_this_month')} value={f.int.format(newThisMonth)} icon={<UserPlus />} />
      </div>

      <Card>
        <CardHeader title={t('admin.financial_new_users_12_months')} description={t('admin.financial_monthly_trend')} />
        <div className="px-3 pb-4 pt-4">
          <BarTrend data={data.monthly.map(m => ({ label: m.label, value: m.newUsers }))}
            format={n => f.int.format(n)} axisFormat={n => f.compact.format(n)} height={220} />
        </div>
      </Card>
    </FadeIn>
  )
}
