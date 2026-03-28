import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Roadmap',
  description:
    'Urmareste evolutia platformei Hontrio. Voteaza functiile pe care le vrei implementate urmatoare. Transparenta totala despre ce construim si de ce.',
  keywords: [
    'roadmap hontrio',
    'functii viitoare hontrio',
    'vot functii AI ecommerce',
  ],
  openGraph: {
    title: 'Roadmap | Hontrio',
    description:
      'Urmareste evolutia platformei Hontrio. Voteaza functiile pe care le vrei implementate urmatoare. Transparenta totala despre ce construim si de ce.',
    url: 'https://hontrio.com/roadmap',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Roadmap | Hontrio',
    description:
      'Urmareste evolutia platformei Hontrio. Voteaza functiile pe care le vrei implementate urmatoare. Transparenta totala despre ce construim si de ce.',
  },
  alternates: {
    canonical: 'https://hontrio.com/roadmap',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
