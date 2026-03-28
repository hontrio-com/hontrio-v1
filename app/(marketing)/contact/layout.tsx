import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contacteaza echipa Hontrio pentru suport tehnic, intrebari despre produse sau colaborari. Raspundem in maximum 24 de ore.',
  keywords: [
    'contact hontrio',
    'suport hontrio',
    'ajutor magazin online AI',
  ],
  openGraph: {
    title: 'Contact | Hontrio',
    description:
      'Contacteaza echipa Hontrio pentru suport tehnic, intrebari despre produse sau colaborari. Raspundem in maximum 24 de ore.',
    url: 'https://hontrio.com/contact',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact | Hontrio',
    description:
      'Contacteaza echipa Hontrio pentru suport tehnic, intrebari despre produse sau colaborari. Raspundem in maximum 24 de ore.',
  },
  alternates: {
    canonical: 'https://hontrio.com/contact',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
