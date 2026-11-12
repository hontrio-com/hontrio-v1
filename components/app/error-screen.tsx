'use client'

import Link from 'next/link'
import { ArrowLeft, Compass, RotateCcw, TriangleAlert } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Button } from '@/components/app/button'

// =============================================
// Ecranul pentru o adresă care nu există (404) și pentru o eroare
// neașteptată: logoul, apoi un card alb cu ce s-a întâmplat și ce poți face.
// Alb-negru, ca paginile de cont.
// =============================================

export function ErrorScreen({ kind, digest, onRetry }: {
  kind: 'not_found' | 'error'
  /** Codul erorii (de la Next), ca omul să-l poată trimite la suport. */
  digest?: string
  onRetry?: () => void
}) {
  const { t } = useT()
  const notFound = kind === 'not_found'
  return (
    <main className="app flex min-h-[100dvh] items-center justify-center bg-canvas px-5 py-14 text-neutral-950">
      <div className="w-full max-w-[420px]">
        <Link href="/" aria-label={t('errors.home')} className="mx-auto mb-8 flex w-fit rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-black/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-black.png" alt="Hontrio" className="h-7 w-auto" />
        </Link>
        <div className="rounded-[1.25rem] border border-line bg-white p-7 shadow-[var(--shadow-surface)]">
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-black text-white [&_svg]:size-5">
            {notFound ? <Compass /> : <TriangleAlert />}
          </div>
          {notFound && <p className="text-[12px] font-semibold tracking-[0.08em] text-neutral-400 tabular-nums">404</p>}
          <h1 className="mt-1 text-xl font-bold tracking-[-0.02em] text-neutral-950">{t(notFound ? 'errors.not_found_title' : 'errors.error_title')}</h1>
          <p className="mt-1 text-sm leading-relaxed text-neutral-500">{t(notFound ? 'errors.not_found_desc' : 'errors.error_desc')}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {onRetry && <Button variant="primary" onClick={onRetry}><RotateCcw />{t('errors.retry')}</Button>}
            <Button asChild variant={onRetry ? 'secondary' : 'primary'}>
              <Link href="/"><ArrowLeft />{t('errors.home')}</Link>
            </Button>
          </div>
          {!notFound && (
            <p className="mt-5 text-[12px] text-neutral-500">
              <a href="mailto:contact@hontrio.com" className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-[3px] hover:decoration-neutral-900">contact@hontrio.com</a>
              {digest && <span className="ml-2 text-neutral-400">· {t('errors.code', { code: digest })}</span>}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
