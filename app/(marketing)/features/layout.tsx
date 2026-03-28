import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Functii',
  description:
    'AI Images, SEO Optimizer, AI Agent si Risk Shield — toate instrumentele de care ai nevoie pentru a creste vanzarile magazinului tau online.',
  keywords: [
    'functii hontrio',
    'AI ecommerce',
    'imagini AI produse',
    'SEO automat',
    'agent chat magazin',
    'protectie comenzi',
  ],
  openGraph: {
    title: 'Functii | Hontrio',
    description:
      'AI Images, SEO Optimizer, AI Agent si Risk Shield — toate instrumentele de care ai nevoie pentru a creste vanzarile magazinului tau online.',
    url: 'https://hontrio.com/features',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Functii | Hontrio',
    description:
      'AI Images, SEO Optimizer, AI Agent si Risk Shield — toate instrumentele de care ai nevoie pentru a creste vanzarile magazinului tau online.',
  },
  alternates: {
    canonical: 'https://hontrio.com/features',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
