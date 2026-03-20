import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.hontrio.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'HONTRIO — AI Growth Engine for eCommerce',
    template: '%s | Hontrio',
  },
  description:
    'Hontrio is the AI-powered platform for WooCommerce stores. Generate SEO product descriptions, optimize titles, create AI product images, and protect against fraud — all in one place.',
  keywords: [
    'ecommerce AI',
    'WooCommerce optimization',
    'product SEO',
    'AI product descriptions',
    'ecommerce automation',
    'AI product images',
    'fraud detection ecommerce',
    'optimizare produse WooCommerce',
    'AI ecommerce Romania',
  ],
  authors: [{ name: 'Hontrio', url: siteUrl }],
  creator: 'Hontrio',
  publisher: 'Hontrio',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['ro_RO'],
    url: siteUrl,
    siteName: 'Hontrio',
    title: 'HONTRIO — AI Growth Engine for eCommerce',
    description:
      'Optimize your WooCommerce store with AI. Generate product descriptions, SEO titles, AI images, and protect against fraud — all in one platform.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Hontrio — AI Growth Engine for eCommerce',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HONTRIO — AI Growth Engine for eCommerce',
    description:
      'Optimize your WooCommerce store with AI. Generate descriptions, SEO titles, AI images, and protect against fraud.',
    images: ['/opengraph-image'],
    creator: '@hontrio',
    site: '@hontrio',
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      en: siteUrl,
      ro: siteUrl,
      'x-default': siteUrl,
    },
  },
  icons: {
    icon: [
      { url: '/logo-icon.png', type: 'image/png' },
    ],
    shortcut: '/logo-icon.png',
    apple: '/logo-icon.png',
  },
  category: 'technology',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Hontrio',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo-black.png`,
        width: 200,
        height: 60,
      },
      description:
        'AI-powered eCommerce optimization platform for WooCommerce stores.',
      foundingDate: '2025',
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'Hontrio',
      description: 'AI Growth Engine for eCommerce',
      publisher: { '@id': `${siteUrl}/#organization` },
      inLanguage: ['en', 'ro'],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/#app`,
      name: 'Hontrio',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'eCommerce',
      operatingSystem: 'Web',
      url: siteUrl,
      description:
        'AI-powered platform for WooCommerce store optimization. Generate SEO descriptions, titles, product images, and detect fraud risk.',
      screenshot: `${siteUrl}/opengraph-image`,
      publisher: { '@id': `${siteUrl}/#organization` },
      offers: [
        {
          '@type': 'Offer',
          name: 'Free',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free plan with 20 credits',
        },
        {
          '@type': 'Offer',
          name: 'Starter',
          price: '19',
          priceCurrency: 'USD',
          billingIncrement: 'monthly',
          description: 'Starter plan — 150 credits/month',
        },
        {
          '@type': 'Offer',
          name: 'Professional',
          price: '49',
          priceCurrency: 'USD',
          billingIncrement: 'monthly',
          description: 'Professional plan — 400 credits/month',
        },
        {
          '@type': 'Offer',
          name: 'Enterprise',
          price: '99',
          priceCurrency: 'USD',
          billingIncrement: 'monthly',
          description: 'Enterprise plan — 900 credits/month',
        },
      ],
      featureList: [
        'AI-generated product descriptions',
        'SEO title optimization',
        'AI product image generation',
        'Fraud & risk detection',
        'AI sales agent',
        'WooCommerce integration',
        'Competitor SEO analysis',
        'Bulk product optimization',
      ],
      inLanguage: ['en', 'ro'],
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${outfit.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
