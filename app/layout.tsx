import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter, Outfit } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { CookieConsent } from '@/components/cookie-consent'
import { getLocale, tFor } from '@/lib/i18n/server'
import { clientMessages } from '@/lib/i18n/dictionaries'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
// Inter rămâne pentru paginile vechi care îl cer direct
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' })
// Platforma (după autentificare) folosește Geist, ca în designul ales (Bezeno); Geist Mono pentru cifrele mici
const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-geist-sans', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })

// Titlul și descrierile se scriu în limba vizitatorului
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = tFor(locale)
  return {
  metadataBase: new URL('https://hontrio.com'),
  title: {
    default: t('marketing.meta_title'),
    template: '%s | Hontrio',
  },
  description: t('marketing.meta_description'),
  // Cuvinte-cheie SEO, în ambele limbi deodată: nu sunt text afișat  i18n-ignore-start
  keywords: [
    'reclame Google Ads magazin online',
    'Google Shopping magazin online',
    'campanii Performance Max',
    'pilot automat Google Ads',
    'campanii Google Shopping automate',
    'Google Ads automation for ecommerce',
    'Shopping ads management',
    'Google Shopping autopilot',
  ],
  // i18n-ignore-end
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
    locale: locale === 'ro' ? 'ro_RO' : 'en_US',
    alternateLocale: [locale === 'ro' ? 'en_US' : 'ro_RO'],
    url: 'https://hontrio.com',
    siteName: 'Hontrio',
    title: t('marketing.meta_title'),
    description: t('marketing.meta_og_description'),
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: t('marketing.meta_og_alt'), type: 'image/png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: t('marketing.meta_title'),
    description: t('marketing.meta_twitter_description'),
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
}

// Date structurate pentru motoarele de căutare (nu sunt text afișat)  i18n-ignore-start
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
        'Autopilot for online stores’ Google Shopping campaigns.',
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
      description: 'Google Shopping campaigns for online stores, built and looked after every day.',
      publisher: { '@id': 'https://hontrio.com/#organization' },
      inLanguage: ['en', 'ro'],
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
        'An autopilot for online stores’ Google Ads: Hontrio builds Google Shopping campaigns from the store’s products and looks after them every day.',
      screenshot: 'https://hontrio.com/opengraph-image',
      publisher: { '@id': 'https://hontrio.com/#organization' },
      // Fără prețuri până la abonamentul nou, în funcție de vânzări
      featureList: [
        'Google Shopping campaigns built from the store’s products',
        'Daily autopilot: safety pause, negative keywords, product exclusions',
        'Budget increases only with your approval',
        'Campaigns per category, brand, price, sale or hand-picked products',
        'Reports from Google Ads data',
        'Edinio, WooCommerce and Shopify integrations',
      ],
      inLanguage: ['en', 'ro'],
    },
  ],
}
// i18n-ignore-end

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Limba se alege pe server: pagina vine din prima randare în limba omului
  const locale = await getLocale()
  const { messages, fallback } = clientMessages(locale)
  return (
    <html lang={locale}>
      <head>
        {/* Google Analytics nu se încarcă de aici: îl încarcă bannerul de cookie-uri, doar după „Accept” */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${outfit.variable} ${inter.variable} ${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <Providers locale={locale} messages={messages} fallback={fallback}>
          {children}
          {/* În provider, ca bannerul de cookie-uri să fie și el tradus */}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  )
}
