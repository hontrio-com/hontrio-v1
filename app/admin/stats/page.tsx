'use client'

import { Package, Store, Users } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardHeader } from '@/components/app/surface'
import { StatCard } from '@/components/app/kpi'
import { FadeIn } from '@/components/app/motion'
import { useFormats } from '@/components/app/formats'
import { useNow } from '@/components/app/time'
import { useAdminData } from '@/components/admin/use-admin-data'
import { LoadError, PageSkeleton, RefreshButton, UserAvatar } from '@/components/admin/parts'

// =============================================
// Statisticile platformei: câți oameni, magazine și produse sunt și cine
// s-a înscris ultimul. Banii stau în Raportul financiar.
// =============================================

type Stats = {
  totalUsers: number; totalStores: number; totalProducts: number
  recentUsers: { id: string; email: string; name: string | null; created_at: string }[]
}

export default function AdminStatsPage() {
  const { t, intlLocale } = useT()
  const f = useFormats('USD')
  const now = useNow()
  const { data: stats, loading, refresh } = useAdminData<Stats>('/api/admin/stats')

  if (loading && !stats) return <PageSkeleton tiles={3} />
  if (!stats?.recentUsers) return <LoadError />

  const month = now ? new Date(now).toLocaleDateString(intlLocale, { month: 'long', year: 'numeric' }) : ''
  const counters = [
    { label: t('admin.nav_users'), value: stats.totalUsers, icon: <Users /> },
    { label: t('admin.stats_stores'), value: stats.totalStores, icon: <Store /> },
    { label: t('common.products'), value: stats.totalProducts, icon: <Package /> },
  ]

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.stats_title')} description={t('admin.stats_subtitle', { date: month })}
        actions={<RefreshButton loading={loading} onClick={refresh} />} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {counters.map(c => <StatCard key={c.label} label={c.label} value={f.int.format(c.value)} icon={c.icon} />)}
      </div>

      <Card>
        <CardHeader title={t('admin.stats_recent_users')} description={t('admin.stats_total_count', { count: stats.totalUsers })} />
        <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
          {stats.recentUsers.map(user => (
            <li key={user.id} className="flex items-center gap-3 px-5 py-2.5">
              <UserAvatar name={user.name} email={user.email} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-neutral-900">{user.name || user.email}</p>
                <p className="truncate text-[12px] text-neutral-500">{user.email}</p>
              </div>
              <p className="shrink-0 text-[12px] tabular-nums text-neutral-400">{f.date.format(new Date(user.created_at))}</p>
            </li>
          ))}
        </ul>
      </Card>
    </FadeIn>
  )
}
