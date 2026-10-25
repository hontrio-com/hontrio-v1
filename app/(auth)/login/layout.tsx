import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.hontrio.com'

// Titlul și descrierea se scriu în limba vizitatorului
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return {
    title: t('auth.meta_login_title'),
    description: t('auth.meta_login_description'),
    alternates: {
      canonical: `${siteUrl}/login`,
      languages: {
        en: `${siteUrl}/login`,
        ro: `${siteUrl}/login`,
        'x-default': `${siteUrl}/login`,
      },
    },
    openGraph: {
      title: `${t('auth.meta_login_title')} | Hontrio`,
      description: t('auth.meta_login_description'),
      url: `${siteUrl}/login`,
    },
    robots: { index: true, follow: true },
  }
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
