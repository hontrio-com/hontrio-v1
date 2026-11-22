'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Eye } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { useNow } from '@/components/app/time'

// =============================================
// Bara de jos, cât administratorul e în contul unui client: al cui e contul,
// cât mai poate rămâne și drumul înapoi în panoul de administrare. Pe orice
// pagină a platformei (e în Providers), ca să nu poată fi uitată.
// =============================================

export function ImpersonationBar() {
  const { data: session } = useSession()
  const { t } = useT()
  const now = useNow()
  const [leaving, setLeaving] = useState(false)
  const imp = session?.impersonator
  if (!imp) return null
  const minutes = now ? Math.max(1, Math.ceil((imp.until - now) / 60_000)) : null

  async function leave() {
    setLeaving(true)
    try {
      const r = await fetch('/api/auth/impersonation/stop', { method: 'POST' })
      const body = await r.json().catch(() => ({}))
      // O pagină nouă, întreagă: sesiunea s-a schimbat
      window.location.href = typeof body.redirect === 'string' ? body.redirect : '/admin/users'
    } catch {
      setLeaving(false)
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
      <div role="status" className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-neutral-950 py-1.5 pl-4 pr-1.5 text-white shadow-2xl ring-1 ring-white/10">
        <Eye className="size-4 shrink-0 text-white/60" />
        <p className="min-w-0 truncate text-[13px]">
          {t('admin.impersonating_as', { name: session.user?.name || session.user?.email || '' })}
          {minutes !== null && <span className="hidden text-white/50 sm:inline"> · {t('admin.impersonating_left', { count: minutes })}</span>}
        </p>
        <button onClick={leave} disabled={leaving}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-60">
          <ArrowLeft className="size-3.5" />{t('admin.impersonating_back')}
        </button>
      </div>
    </div>
  )
}
