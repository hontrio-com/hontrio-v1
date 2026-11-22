'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LifeBuoy } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Card } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { linkStyles } from '@/components/app/button'
import { Skeleton } from '@/components/app/feedback'
import { useNow } from '@/components/app/time'
import { Section } from '@/components/settings/layout'

// =============================================
// Setări → Securitate: accesul echipei Hontrio pentru suport (Termeni, art.
// 10.5). Ce înseamnă și fiecare intrare a echipei în cont, din jurnal
// (GET /api/user/support-access). Fără Termenii care o spun acceptați,
// echipa nu poate intra, iar textul trimite la acceptarea lor.
// =============================================

type Entry = { id: string; started_at: string; ended_at: string | null }

export function SupportAccess() {
  const { t, intlLocale } = useT()
  const now = useNow()
  const [data, setData] = useState<{ allowed: boolean; entries: Entry[] } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/user/support-access')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setFailed(true))
  }, [])

  const when = (iso: string) => new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

  return (
    <Section title={t('settings.support_access_title')} description={t('settings.support_access_desc')}>
      <Card>
        <div className="space-y-3 p-5 text-[13px] leading-relaxed text-neutral-600">
          {!data && !failed && <Skeleton className="h-16" />}
          {failed && <p>{t('settings.support_access_failed')}</p>}
          {data && !data.allowed && (
            <p>
              {t('settings.support_access_off')}{' '}
              <Link href="/accept-terms" className={linkStyles}>{t('settings.support_access_terms')}</Link>
            </p>
          )}
          {data && data.allowed && data.entries.length === 0 && <p>{t('settings.support_access_none')}</p>}
          {data && data.entries.length > 0 && (
            <ul className="divide-y divide-neutral-100">
              {data.entries.map(e => {
                const open = !e.ended_at
                return (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex items-center gap-2 text-neutral-800">
                      <LifeBuoy className="size-3.5 text-neutral-400" />{t('settings.support_access_entry', { start: when(e.started_at) })}
                    </span>
                    {open && now
                      ? <Badge tone="brand" dot live>{t('settings.support_access_open')}</Badge>
                      : <span className="text-[12px] text-neutral-500">{e.ended_at ? t('settings.support_access_ended', { end: when(e.ended_at) }) : ''}</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>
    </Section>
  )
}
