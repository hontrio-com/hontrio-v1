'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useT } from '@/lib/i18n/context'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

function updateConsent(granted: boolean) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: granted ? 'granted' : 'denied',
    ad_user_data: granted ? 'granted' : 'denied',
    ad_personalization: granted ? 'granted' : 'denied',
  })
}

export function CookieConsent() {
  const { t } = useT()
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      const consent = localStorage.getItem('hontrio_cookie_consent')
      if (!consent) setShow(true)
    } catch {
      setShow(true)
    }
  }, [])

  function accept() {
    try { localStorage.setItem('hontrio_cookie_consent', 'granted') } catch {}
    updateConsent(true)
    setShow(false)
  }

  function decline() {
    try { localStorage.setItem('hontrio_cookie_consent', 'denied') } catch {}
    updateConsent(false)
    setShow(false)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50"
        >
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-5">
            <p className="text-[13px] font-semibold text-neutral-900 mb-1">🍪 {t('common.cookie_title')}</p>
            <p className="text-[12px] text-neutral-500 leading-relaxed mb-4">
              {t('common.cookie_text')}{' '}
              <a href="/legal/cookies" className="underline hover:text-neutral-700 transition-colors">
                {t('common.cookie_policy')}
              </a>
            </p>
            <div className="flex gap-2">
              <button
                onClick={decline}
                className="flex-1 py-2 text-[12px] font-medium text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
              >
                {t('common.cookie_decline')}
              </button>
              <button
                onClick={accept}
                className="flex-1 py-2 text-[12px] font-semibold text-white bg-neutral-900 rounded-xl hover:bg-neutral-800 transition-colors"
              >
                {t('common.cookie_accept')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
