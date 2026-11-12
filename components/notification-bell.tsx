'use client'

import { useEffect, useState } from 'react'
import { Popover } from 'radix-ui'
import { Bell, Check, CheckCheck, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
// Notificările pilotului se salvează ca chei de traducere; anunțurile din admin, ca text
import { translateStored } from '@/lib/i18n/stored'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/app/badge'
import { Button, textActionStyles } from '@/components/app/button'
import { useNow } from '@/components/app/time'

// =============================================
// Clopoțelul din bara de sus: notificările contului (propunerile pilotului,
// lansările, anunțurile), cu cele necitite numărate. Se reîmprospătează la
// un minut, doar cât pagina e vizibilă.
// =============================================

type Notification = {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  is_global: boolean
  is_read: boolean
  created_at: string
}

const TYPE = {
  info: { icon: Info, color: 'text-neutral-500' },
  success: { icon: CircleCheck, color: 'text-emerald-600' },
  warning: { icon: TriangleAlert, color: 'text-amber-600' },
  error: { icon: CircleAlert, color: 'text-red-600' },
}

export default function NotificationBell() {
  const { t, intlLocale } = useT()
  const now = useNow()
  // Numerele din notificările pilotului (ex. ROAS 3,5), în formatul limbii
  const num = (n: number) => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }).format(n)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    // Starea se schimbă doar în callback-urile răspunsului, nu în efect
    const fetchNotifications = () =>
      fetch('/api/notifications')
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (!data) return
          setNotifications(data.notifications || [])
          setUnreadCount(data.unreadCount || 0)
        })
        .catch(() => {
          // Clopoțelul tace: încearcă din nou la următorul minut
        })
    fetchNotifications()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifications()
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: [notificationId] }),
      })
      setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n)))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // Rămâne necitită; se poate încerca din nou
    }
  }

  const markAllAsRead = async () => {
    setMarkingAll(true)
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {
      // Rămân necitite; se poate încerca din nou
    } finally {
      setMarkingAll(false)
    }
  }

  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const diffMin = Math.floor(((now || date.getTime()) - date.getTime()) / 60000)
    const diffH = Math.floor(diffMin / 60)
    const diffD = Math.floor(diffH / 24)
    if (diffMin < 1) return t('common.time_just_now')
    if (diffMin < 60) return t('common.time_minutes_ago', { count: diffMin })
    if (diffH < 24) return t('common.time_hours_ago', { count: diffH })
    if (diffD < 7) return t('common.time_days_ago', { count: diffD })
    return date.toLocaleDateString(intlLocale, { day: 'numeric', month: 'short' })
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button aria-label={t('notifications.title')}
          className="relative rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 data-[state=open]:bg-neutral-100 data-[state=open]:text-neutral-800">
          <Bell className="size-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} collisionPadding={16}
          className="app z-50 w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-semibold text-neutral-900">{t('notifications.title')}</p>
              {unreadCount > 0 && <Badge tone="brand">{t('notifications.unread_count', { count: unreadCount })}</Badge>}
            </div>
            {unreadCount > 0 && (
              <Button size="xs" variant="ghost" loading={markingAll} onClick={markAllAsRead}>
                {!markingAll && <CheckCheck />}{t('notifications.mark_all_read')}
              </Button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 ring-1 ring-neutral-200/70"><Bell className="size-4" /></span>
                <p className="mt-3 text-[13px] font-medium text-neutral-800">{t('notifications.no_notifications')}</p>
                <p className="mt-0.5 text-[12px] text-neutral-500">{t('notifications.all_caught_up')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {notifications.map(notif => {
                  const type = TYPE[notif.type] || TYPE.info
                  return (
                    <li key={notif.id} className={cn('flex gap-3 px-4 py-3 transition-colors hover:bg-neutral-50/70', !notif.is_read && 'bg-neutral-50/60')}>
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-neutral-200/80">
                        <type.icon className={cn('size-4', type.color)} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn('text-[13px]', notif.is_read ? 'font-medium text-neutral-600' : 'font-semibold text-neutral-900')}>
                            {translateStored(t, notif.title, num)}
                          </p>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="text-[11px] text-neutral-400">{timeAgo(notif.created_at)}</span>
                            {!notif.is_read && <span className="size-1.5 rounded-full bg-neutral-900" />}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-neutral-500">{translateStored(t, notif.message, num)}</p>
                        {(notif.is_global || !notif.is_read) && (
                          <div className="mt-1.5 flex items-center gap-3">
                            {notif.is_global && <Badge className="h-[18px] px-1.5 text-[10px]">{t('notifications.announcement')}</Badge>}
                            {!notif.is_read && (
                              <button onClick={() => markAsRead(notif.id)} className={cn(textActionStyles, 'text-[11px] [&_svg]:size-3')}>
                                <Check />{t('notifications.mark_read')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
