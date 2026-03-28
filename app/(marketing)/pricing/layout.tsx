import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Preturi',
  description:
    'Planuri simple si transparente pentru magazine online de orice dimensiune. Incearca Hontrio gratuit, fara card de credit. Credite lunare pentru imagini AI, SEO si agent.',
  keywords: [
    'preturi hontrio',
    'abonament ecommerce AI',
    'plan gratuit AI magazin',
    'hontrio pricing',
    'cost optimizare magazin online',
  ],
  openGraph: {
    title: 'Preturi | Hontrio',
    description:
      'Planuri simple si transparente pentru magazine online de orice dimensiune. Incearca Hontrio gratuit, fara card de credit. Credite lunare pentru imagini AI, SEO si agent.',
    url: 'https://hontrio.com/pricing',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Preturi | Hontrio',
    description:
      'Planuri simple si transparente pentru magazine online de orice dimensiune. Incearca Hontrio gratuit, fara card de credit. Credite lunare pentru imagini AI, SEO si agent.',
  },
  alternates: {
    canonical: 'https://hontrio.com/pricing',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
