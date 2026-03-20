import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.hontrio.com'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Hontrio account and start optimizing your WooCommerce store with AI.',
  alternates: {
    canonical: `${siteUrl}/login`,
    languages: {
      en: `${siteUrl}/login`,
      ro: `${siteUrl}/login`,
      'x-default': `${siteUrl}/login`,
    },
  },
  openGraph: {
    title: 'Sign In | Hontrio',
    description: 'Sign in to your Hontrio account and start optimizing your WooCommerce store with AI.',
    url: `${siteUrl}/login`,
  },
  robots: { index: true, follow: true },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
