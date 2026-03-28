import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Risk Shield',
  description:
    'Detecteaza automat comenzile cu risc de refuz COD. Scor de risc bazat pe 20+ semnale pentru fiecare comanda noua. Protejeaza-ti magazinul de colete neridicate.',
  keywords: [
    'protectie comenzi COD',
    'detectie frauda ecommerce',
    'risc comenzi Romania',
    'colete neridicate',
    'risk shield WooCommerce',
    'fraud detection ecommerce',
  ],
  openGraph: {
    title: 'Risk Shield | Hontrio',
    description:
      'Detecteaza automat comenzile cu risc de refuz COD. Scor de risc bazat pe 20+ semnale pentru fiecare comanda noua. Protejeaza-ti magazinul de colete neridicate.',
    url: 'https://hontrio.com/features/risk-shield',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Risk Shield | Hontrio',
    description:
      'Detecteaza automat comenzile cu risc de refuz COD. Scor de risc bazat pe 20+ semnale pentru fiecare comanda noua. Protejeaza-ti magazinul de colete neridicate.',
  },
  alternates: {
    canonical: 'https://hontrio.com/features/risk-shield',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
