'use client'

import { useSyncExternalStore } from 'react'
import { useT } from '@/lib/i18n/context'

// =============================================
// „Acum 5 minute", „ieri": ora de acum, reîmprospătată în fiecare minut cât
// e ceva pe ecran care o folosește, ca timpul relativ să rămână adevărat.
// =============================================

let now = 0
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  if (!timer) timer = setInterval(() => { now = Date.now(); listeners.forEach(l => l()) }, 60_000)
  return () => {
    listeners.delete(onChange)
    if (!listeners.size && timer) { clearInterval(timer); timer = null }
  }
}

// Aceeași valoare la citiri apropiate (cerința lui useSyncExternalStore), nouă după o jumătate de minut
function snapshot() {
  const t = Date.now()
  if (t - now > 30_000) now = t
  return now
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, () => 0)
}

/** Cât timp a trecut de la o dată ISO, în limba omului: „acum 5 minute", „acum 3 ore", „ieri". */
export function useTimeAgo(): (iso: string) => string {
  const { intlLocale } = useT()
  const current = useNow()
  const relative = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' })
  return (iso: string) => {
    const mins = Math.round((Date.parse(iso) - current) / 60_000)
    if (Math.abs(mins) < 60) return relative.format(mins, 'minute')
    const hours = Math.round(mins / 60)
    return Math.abs(hours) < 24 ? relative.format(hours, 'hour') : relative.format(Math.round(hours / 24), 'day')
  }
}
