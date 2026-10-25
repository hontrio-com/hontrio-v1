import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.hontrio.com'

// Titlul și descrierea se scriu în limba vizitatorului
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return {
    title: t('auth.create_account'),
    description: t('auth.meta_register_description'),
    alternates: {
      canonical: `${siteUrl}/register`,
      languages: {
        en: `${siteUrl}/register`,
        ro: `${siteUrl}/register`,
        'x-default': `${siteUrl}/register`,
      },
    },
    openGraph: {
      title: `${t('auth.create_account')} | Hontrio`,
      description: t('auth.meta_register_description'),
      url: `${siteUrl}/register`,
    },
    robots: { index: true, follow: true },
  }
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
