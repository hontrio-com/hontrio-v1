'use client'

import { Activity, CreditCard, FileText, ImageIcon, RefreshCw, Send, Store, UserPlus, type LucideIcon } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card, Section } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useAdminData } from '@/components/admin/use-admin-data'
import { RefreshButton } from '@/components/admin/parts'

// =============================================
// Activitatea: tot ce s-a întâmplat pe platformă, pe zile.
// =============================================

type ActivityItem = {
  id: string; type: string; description: string
  user_email: string; user_name: string | null; created_at: string
}

const ICONS: Record<string, LucideIcon> = {
  user_registered: UserPlus,
  store_connected: Store,
  products_synced: RefreshCw,
  text_generated: FileText,
  image_generated: ImageIcon,
  product_published: Send,
  credits_added: CreditCard,
}

export default function AdminActivityPage() {
  const { t, intlLocale } = useT()
  const { data, loading, refresh } = useAdminData<{ activities: ActivityItem[] }>('/api/admin/activity')
  const activities = data?.activities ?? []
  const typeLabel = (type: string) => t.has(`admin.activity_type_${type}`) ? t(`admin.activity_type_${type}`) : type.replace(/_/g, ' ')

  const groups = new Map<string, ActivityItem[]>()
  for (const a of activities) {
    const date = new Date(a.created_at).toLocaleDateString(intlLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    groups.set(date, [...(groups.get(date) ?? []), a])
  }

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.nav_activity')} description={t('admin.activity_subtitle')} actions={<RefreshButton loading={loading} onClick={refresh} />} />

      {loading && !data ? (
        <Card className="space-y-3 p-5">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-11" />)}</Card>
      ) : activities.length === 0 ? (
        <Card><EmptyState icon={<Activity />} title={t('admin.activity_empty')} description={t('admin.activity_empty_desc')} /></Card>
      ) : (
        <div className="space-y-6">
          {[...groups].map(([date, items]) => (
            <Section key={date} title={<span className="first-letter:uppercase">{date}</span>}>
              <Card className="divide-y divide-neutral-100 overflow-hidden">
                {items.map(a => {
                  const Icon = ICONS[a.type] ?? Activity
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500"><Icon className="size-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-neutral-900">{a.description}</p>
                        <p className="mt-0.5 truncate text-[12px] text-neutral-500">
                          {a.user_name || a.user_email} · {new Date(a.created_at).toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <Badge className="hidden shrink-0 sm:inline-flex">{typeLabel(a.type)}</Badge>
                    </div>
                  )
                })}
              </Card>
            </Section>
          ))}
        </div>
      )}
    </FadeIn>
  )
}
