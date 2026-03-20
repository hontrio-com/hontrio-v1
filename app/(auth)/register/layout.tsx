import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.hontrio.com'

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your free Hontrio account. Get 20 free AI credits and start optimizing your WooCommerce store — no credit card required.',
  alternates: {
    canonical: `${siteUrl}/register`,
    languages: {
      en: `${siteUrl}/register`,
      ro: `${siteUrl}/register`,
      'x-default': `${siteUrl}/register`,
    },
  },
  openGraph: {
    title: 'Create Account | Hontrio',
    description: 'Create your free Hontrio account. Get 20 free AI credits and start optimizing your WooCommerce store — no credit card required.',
    url: `${siteUrl}/register`,
  },
  robots: { index: true, follow: true },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
