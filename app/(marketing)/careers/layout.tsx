import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cariere',
  description:
    'Alatura-te echipei Hontrio. Construim viitorul comertului online cu AI. Pozitii deschise in development, marketing si product.',
  keywords: [
    'cariere hontrio',
    'joburi tech Romania',
    'angajari startup ecommerce AI',
  ],
  openGraph: {
    title: 'Cariere | Hontrio',
    description:
      'Alatura-te echipei Hontrio. Construim viitorul comertului online cu AI. Pozitii deschise in development, marketing si product.',
    url: 'https://hontrio.com/careers',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cariere | Hontrio',
    description:
      'Alatura-te echipei Hontrio. Construim viitorul comertului online cu AI. Pozitii deschise in development, marketing si product.',
  },
  alternates: {
    canonical: 'https://hontrio.com/careers',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
