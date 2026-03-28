import type { Metadata } from 'next'
import '@/styles/hblog.css'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Articole, ghiduri si resurse despre optimizarea magazinelor online cu AI. SEO, imagini de produs, automatizare si protectie comenzi pentru eCommerce.',
  keywords: ['blog ecommerce Romania', 'ghid SEO magazin online', 'optimizare produse AI', 'articole ecommerce AI'],
  openGraph: {
    title: 'Blog | Hontrio',
    description: 'Articole si ghiduri despre optimizarea magazinelor online cu AI.',
    url: 'https://hontrio.com/blog',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog | Hontrio',
    description: 'Articole si ghiduri despre optimizarea magazinelor online cu AI.',
  },
  alternates: { canonical: 'https://hontrio.com/blog' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
