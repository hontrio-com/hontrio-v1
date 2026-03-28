import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import Script from 'next/script'
import { CookieConsent } from '@/components/cookie-consent'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hontrio.com'

export const metadata: Metadata = {
  metadataBase: new URL('https://hontrio.com'),
  title: {
    default: 'Hontrio - Platforma AI pentru magazine online',
    template: '%s | Hontrio',
  },
  description: 'Genereaza imagini profesionale, optimizeaza SEO, automatizeaza suportul cu AI si protejeaza comenzile. Tot ce are nevoie magazinul tau online, intr-o singura platforma.',
  keywords: [
    'platforma ecommerce Romania',
    'optimizare imagini produse AI',
    'SEO automat magazin online',
    'agent chat magazin online',
    'protectie comenzi COD Romania',
    'AI product image generator',
    'ecommerce SEO automation',
    'AI sales agent online store',
  ],
  authors: [{ name: 'Hontrio', url: 'https://hontrio.com' }],
  creator: 'Hontrio',
  publisher: 'Hontrio',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'ro_RO',
    alternateLocale: ['en_US'],
    url: 'https://hontrio.com',
    siteName: 'Hontrio',
    title: 'Hontrio - Platforma AI pentru magazine online',
    description: 'Imagini AI, SEO automat, agent de vanzari si protectie comenzi. Tot intr-o singura platforma.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Hontrio - AI Platform for eCommerce', type: 'image/png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hontrio - Platforma AI pentru magazine online',
    description: 'Imagini AI, SEO automat, agent de vanzari si protectie comenzi.',
    images: ['/opengraph-image'],
    creator: '@hontrio',
    site: '@hontrio',
  },
  alternates: {
    canonical: 'https://hontrio.com',
    languages: {
      ro: 'https://hontrio.com',
      en: 'https://hontrio.com',
      'x-default': 'https://hontrio.com',
    },
  },
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png' }],
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  category: 'technology',
  verification: {
    google: undefined, // will be added if needed
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://hontrio.com/#organization',
      name: 'Hontrio',
      legalName: 'SC VOID SFT GAMES SRL',
      url: 'https://hontrio.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://hontrio.com/logo-black.png',
        width: 200,
        height: 60,
      },
      description:
        'AI-powered eCommerce optimization platform for WooCommerce stores.',
      foundingDate: '2025',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+40750456096',
        contactType: 'customer service',
        email: 'contact@hontrio.com',
        availableLanguage: ['Romanian', 'English'],
      },
      sameAs: [
        'https://www.tiktok.com/@hontrioromania',
        'https://www.tiktok.com/@hontrio.com',
        'https://www.instagram.com/hontrioromania/',
        'https://www.instagram.com/hontrioglobal/',
        'https://www.facebook.com/profile.php?id=61564333583609',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://hontrio.com/#website',
      url: 'https://hontrio.com',
      name: 'Hontrio',
      description: 'AI Growth Engine for eCommerce',
      publisher: { '@id': 'https://hontrio.com/#organization' },
      inLanguage: ['en', 'ro'],
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://hontrio.com/blog?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://hontrio.com/#app',
      name: 'Hontrio',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'eCommerce',
      operatingSystem: 'Web',
      url: 'https://hontrio.com',
      description:
        'AI-powered platform for WooCommerce store optimization. Generate SEO descriptions, titles, product images, and detect fraud risk.',
      screenshot: 'https://hontrio.com/opengraph-image',
      publisher: { '@id': 'https://hontrio.com/#organization' },
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
          description: 'Starter plan - 150 credits/month',
        },
        {
          '@type': 'Offer',
          name: 'Professional',
          price: '49',
          priceCurrency: 'USD',
          billingIncrement: 'monthly',
          description: 'Professional plan - 400 credits/month',
        },
        {
          '@type': 'Offer',
          name: 'Enterprise',
          price: '99',
          priceCurrency: 'USD',
          billingIncrement: 'monthly',
          description: 'Enterprise plan - 900 credits/month',
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
    <html lang="ro">
      <head>
        {/* Google Consent Mode v2 — must be before GA4 */}
        <Script
          id="consent-mode-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                'ad_storage': 'denied',
                'analytics_storage': 'denied',
                'ad_user_data': 'denied',
                'ad_personalization': 'denied',
                'wait_for_update': 500
              });
              try {
                var c = localStorage.getItem('hontrio_cookie_consent');
                if (c === 'granted') {
                  gtag('consent', 'update', {
                    'analytics_storage': 'granted',
                    'ad_storage': 'granted',
                    'ad_user_data': 'granted',
                    'ad_personalization': 'granted'
                  });
                }
              } catch(e) {}
            `,
          }}
        />
        {/* GA4 */}
        {process.env.NODE_ENV === 'production' && (
          <>
            <Script
              id="ga4-script"
              strategy="afterInteractive"
              src="https://www.googletagmanager.com/gtag/js?id=G-5T68NF431T"
            />
            <Script
              id="ga4-config"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', 'G-5T68NF431T', { send_page_view: true });
                `,
              }}
            />
          </>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${outfit.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
        <CookieConsent />
      </body>
    </html>
  )
}
