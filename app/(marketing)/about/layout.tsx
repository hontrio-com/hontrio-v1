import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Despre Noi',
  description:
    'Echipa din spatele Hontrio. Construim instrumente AI pentru magazine online din Romania si Europa — imagini, SEO, agent de vanzari si protectie comenzi.',
  keywords: [
    'despre hontrio',
    'echipa hontrio',
    'SC VOID SFT GAMES SRL',
    'platforma AI Romania ecommerce',
  ],
  openGraph: {
    title: 'Despre Noi | Hontrio',
    description:
      'Echipa din spatele Hontrio. Construim instrumente AI pentru magazine online din Romania si Europa — imagini, SEO, agent de vanzari si protectie comenzi.',
    url: 'https://hontrio.com/about',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Despre Noi | Hontrio',
    description:
      'Echipa din spatele Hontrio. Construim instrumente AI pentru magazine online din Romania si Europa — imagini, SEO, agent de vanzari si protectie comenzi.',
  },
  alternates: {
    canonical: 'https://hontrio.com/about',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
