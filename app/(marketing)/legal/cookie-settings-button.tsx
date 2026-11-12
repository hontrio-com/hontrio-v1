'use client'

import { openCookieSettings } from '@/components/cookie-consent'

/** Redeschide bannerul de cookie-uri, ca alegerea să se poată schimba oricând. */
export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={openCookieSettings}
      className="inline-flex h-10 items-center rounded-full bg-[#0a0a0a] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1f1f1f]">
      {label}
    </button>
  )
}
