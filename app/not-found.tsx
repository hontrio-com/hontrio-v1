import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'
import { ErrorScreen } from '@/components/app/error-screen'

// Orice adresă care nu există (pe site și în platformă) și orice notFound()
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('errors.not_found_title'), robots: { index: false, follow: false } }
}

export default function NotFound() {
  return <ErrorScreen kind="not_found" />
}
