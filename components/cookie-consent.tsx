'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

// =============================================
// Acordul pentru cookie-uri (Legea nr. 506/2004, art. 4 alin. (5)).
// Google Analytics e în modul „basic” al Consent Mode: fără „Accept”, scriptul
// Google nu se încarcă deloc și nimic nu pleacă la Google. Cu acord, doar
// analytics_storage (reclamele rămân refuzate, semnalele Google oprite).
// Alegerea stă 12 luni în cookie-ul strict necesar `hontrio_consent`, comun
// pentru hontrio.com și app.hontrio.com, și se schimbă oricând din „Setări
// cookie” (subsolul site-ului, Politica de cookie-uri): la retragere, măsurarea
// se oprește și cookie-urile _ga se șterg. Lista cookie-urilor e în
// app/(marketing)/legal/cookies: ce se schimbă aici se schimbă și acolo.
// =============================================

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

const GA_ID = 'G-5T68NF431T' // i18n-ignore: ID-ul de măsurare Google Analytics
const COOKIE = 'hontrio_consent'
// Alt număr = altă întrebare: alegerile vechi (bannerul de dinainte, în localStorage) nu mai contează
const VERSION = '2'
const MAX_AGE = 365 * 24 * 60 * 60

type Choice = 'granted' | 'denied'

// ─── Alegerea, ca sursă externă pentru React ────────────────────────────────
const listeners = new Set<() => void>()
let settingsOpen = false
const emit = () => listeners.forEach(l => l())

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function readChoice(): Choice | null {
  const raw = document.cookie.split('; ').find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  if (!raw) return null
  const [version, choice] = decodeURIComponent(raw).split('.')
  return version === VERSION && (choice === 'granted' || choice === 'denied') ? choice : null
}

/** Pe hontrio.com cookie-ul e comun cu subdomeniile; în rest (localhost), al gazdei. */
function domainAttr(): string {
  const host = window.location.hostname
  return host === 'hontrio.com' || host.endsWith('.hontrio.com') ? '; domain=.hontrio.com' : ''
}

function saveChoice(choice: Choice) {
  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${COOKIE}=${VERSION}.${choice}.${Date.now()}; path=/; max-age=${MAX_AGE}; samesite=lax${domainAttr()}${secure}`
  try { localStorage.removeItem('hontrio_cookie_consent') } catch { /* fără stocare, n-avem ce curăța */ }
  settingsOpen = false
  emit()
}

/** Redeschide bannerul („Setări cookie-uri”), ca alegerea să se poată schimba oricând. */
export function openCookieSettings() {
  settingsOpen = true
  emit()
}

function closeCookieSettings() {
  settingsOpen = false
  emit()
}

// ─── Google Analytics ────────────────────────────────────────────────────────
const gaDisable = `ga-disable-${GA_ID}`

/** Încarcă GA4 doar după acord (și doar în producție). */
function loadAnalytics() {
  if (process.env.NODE_ENV !== 'production') return
  const flags = window as unknown as Record<string, unknown>
  flags[gaDisable] = false
  if (window.gtag) {
    window.gtag('consent', 'update', { analytics_storage: 'granted' })
    return
  }
  const queue = (window.dataLayer ??= [])
  // gtag.js așteaptă obiectul `arguments`, nu un tablou
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    queue.push(arguments)
  }
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)
}

/** La retragerea acordului: GA nu mai trimite nimic, iar cookie-urile _ga se șterg. */
function stopAnalytics() {
  const flags = window as unknown as Record<string, unknown>
  flags[gaDisable] = true
  window.gtag?.('consent', 'update', { analytics_storage: 'denied' })
  const host = window.location.hostname
  const domains = ['', `; domain=${host}`, `; domain=.${host}`, '; domain=.hontrio.com']
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0]
    if (name !== '_ga' && !name.startsWith('_ga_')) continue
    for (const domain of domains) document.cookie = `${name}=; path=/; max-age=0${domain}`
  }
}

export function CookieConsent() {
  const { t } = useT()
  // Pe server și la hidratare: nimic (alegerea e doar în browser)
  const state = useSyncExternalStore(subscribe, () => `${readChoice() ?? 'none'}|${settingsOpen ? 'open' : 'closed'}`, () => 'server')
  const [choice, panel] = state.split('|')

  useEffect(() => {
    if (choice === 'granted') loadAnalytics()
  }, [choice])

  const show = state !== 'server' && (choice === 'none' || panel === 'open')
  const decided = choice === 'granted' || choice === 'denied'

  // Cât acoperă bannerul din josul ecranului, ca variabilă CSS (`--consent-h`): paginile de
  // cont lasă atâta loc jos, ca formularul să rămână deasupra bannerului (app/(auth)/layout.tsx)
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = bar.current
    if (!show || !el) return
    const root = document.documentElement
    const measure = () => root.style.setProperty('--consent-h', `${el.offsetHeight + (parseFloat(getComputedStyle(el).bottom) || 0)}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--consent-h')
    }
  }, [show])

  function accept() {
    saveChoice('granted')
  }

  function decline() {
    saveChoice('denied')
    stopAnalytics()
  }

  // Amândouă butoanele arată la fel: refuzul nu e mai greu de ales decât acceptul
  const button = 'flex-1 rounded-xl bg-neutral-900 px-6 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-neutral-800 sm:flex-none sm:py-2.5'

  return (
    <AnimatePresence>
      {show && (
        // O bandă lată, la mijloc, jos. Pe telefon e mai scundă (fără titlu și fără fraza despre
        // „Setări cookie-uri”, care rămân în Politica de cookie-uri), cu butoanele dedesubt
        <motion.div
          ref={bar}
          role="dialog"
          aria-label={t('common.cookie_title')}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          // `app`: același font ca site-ul și platforma (bannerul stă în afara lor, în rădăcină)
          className="app fixed inset-x-0 bottom-3 z-50 px-3 sm:bottom-6 sm:px-4"
        >
          <div className="relative mx-auto flex max-w-5xl flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-[0_8px_40px_rgba(0,0,0,0.12)] sm:flex-row sm:items-center sm:gap-8 sm:py-4 sm:pl-6 sm:pr-5">
            <div className={`min-w-0 flex-1 ${decided ? 'pr-8 sm:pr-0' : ''}`}>
              <p className="hidden text-[13px] font-semibold text-neutral-900 sm:block">{t('common.cookie_title')}</p>
              <p className="text-[12.5px] leading-relaxed text-neutral-500 sm:mt-1">
                {t('site.cookie_text')}{' '}
                {decided
                  ? t(choice === 'granted' ? 'site.cookie_now_on' : 'site.cookie_now_off')
                  : <span className="hidden sm:inline">{t('site.cookie_hint')}</span>}{' '}
                <a href="/legal/cookies" className="whitespace-nowrap underline transition-colors hover:text-neutral-700">{t('common.cookie_policy')}</a>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={decline} className={button}>{t('common.cookie_decline')}</button>
              <button type="button" onClick={accept} className={button}>{t('common.cookie_accept')}</button>
              {decided && (
                <button type="button" onClick={closeCookieSettings} aria-label={t('site.cookie_close')}
                  className="absolute right-3 top-3 grid size-7 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 sm:static sm:ml-1">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
