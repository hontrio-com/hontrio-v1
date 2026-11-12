'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

// =============================================
// Cloudflare Turnstile: verificarea „ești om?" de pe paginile de cont
// (înscriere, parolă uitată). Apare doar cu NEXT_PUBLIC_TURNSTILE_SITE_KEY
// setat; scriptul se încarcă doar aici. Jetonul e de unică folosință: după un
// răspuns cu eroare, pagina remontează widgetul (`key`) ca să ia altul.
// =============================================

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

/** Widgetul e pornit (există cheia publică). */
export const turnstileOn = SITE_KEY.length > 0

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const callback = useRef(onToken)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => { callback.current = onToken }, [onToken])

  useEffect(() => {
    const api = window.turnstile
    if (!turnstileOn || !loaded || !box.current || !api) return
    const id = api.render(box.current, {
      sitekey: SITE_KEY,
      theme: 'light',
      size: 'flexible',
      callback: (token: string) => callback.current(token),
      'expired-callback': () => callback.current(''),
      'error-callback': () => callback.current(''),
    })
    return () => { window.turnstile?.remove(id) }
  }, [loaded])

  if (!turnstileOn) return null
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive"
        onLoad={() => setLoaded(true)} onReady={() => setLoaded(true)} />
      <div ref={box} className="min-h-[65px]" />
    </>
  )
}
