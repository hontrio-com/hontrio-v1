import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SEO Optimizer',
  description:
    'Genereaza titluri, descrieri si meta description optimizate SEO pentru fiecare produs in secunde. Scor SEO real, standarde Google E-E-A-T, continut unic garantat.',
  keywords: [
    'SEO automat WooCommerce',
    'optimizare produse SEO',
    'titluri SEO AI',
    'meta description generator',
    'ecommerce SEO automation',
    'Google EEAT ecommerce',
  ],
  openGraph: {
    title: 'SEO Optimizer | Hontrio',
    description:
      'Genereaza titluri, descrieri si meta description optimizate SEO pentru fiecare produs in secunde. Scor SEO real, standarde Google E-E-A-T, continut unic garantat.',
    url: 'https://hontrio.com/features/seo',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SEO Optimizer | Hontrio',
    description:
      'Genereaza titluri, descrieri si meta description optimizate SEO pentru fiecare produs in secunde. Scor SEO real, standarde Google E-E-A-T, continut unic garantat.',
  },
  alternates: {
    canonical: 'https://hontrio.com/features/seo',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
