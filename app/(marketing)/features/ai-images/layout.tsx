import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Image Generation',
  description:
    'Transforma fotografiile obisnuite in imagini profesionale in secunde. Fundal alb, lifestyle, premium dark si alte stiluri AI pentru orice canal de vanzare sau marketplace.',
  keywords: [
    'generare imagini AI',
    'imagini produse AI',
    'fundal alb automat',
    'AI product images',
    'ecommerce product photography AI',
    'imagini eMag fundal alb',
  ],
  openGraph: {
    title: 'AI Image Generation | Hontrio',
    description:
      'Transforma fotografiile obisnuite in imagini profesionale in secunde. Fundal alb, lifestyle, premium dark si alte stiluri AI pentru orice canal de vanzare sau marketplace.',
    url: 'https://hontrio.com/features/ai-images',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Image Generation | Hontrio',
    description:
      'Transforma fotografiile obisnuite in imagini profesionale in secunde. Fundal alb, lifestyle, premium dark si alte stiluri AI pentru orice canal de vanzare sau marketplace.',
  },
  alternates: {
    canonical: 'https://hontrio.com/features/ai-images',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
