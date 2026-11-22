'use client'

import { SessionProvider } from 'next-auth/react'
import { LanguageProvider } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/config'
import type { Messages } from '@/lib/i18n/translate'
import { ImpersonationBar } from '@/components/app/shell/impersonation-bar'

export function Providers({ locale, messages, fallback, children }: {
  locale: Locale
  messages: Messages
  fallback: Messages | null
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <LanguageProvider locale={locale} messages={messages} fallback={fallback}>
        {children}
        {/* Administratorul în contul unui client: drumul înapoi, pe orice pagină */}
        <ImpersonationBar />
      </LanguageProvider>
    </SessionProvider>
  )
}
