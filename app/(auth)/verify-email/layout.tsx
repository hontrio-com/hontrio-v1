import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'

// Titlul și descrierea se scriu în limba vizitatorului
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return {
    title: t('auth.verify_title'),
    description: t('auth.meta_verify_description'),
    robots: { index: false, follow: false },
  }
}

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children
}
