import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'
import { Hero } from '@/components/site/hero'
import { HowItWorks } from '@/components/site/how'
import { Why } from '@/components/site/why'
import { Features } from '@/components/site/features'
import { OptimizeAds } from '@/components/site/optimize-ads'
import { DataUse } from '@/components/site/data'
import { Faq } from '@/components/site/faq'
import { FinalCta } from '@/components/site/cta'

// Pagina principală: ce face Hontrio, cum (trei pași, imediat după început),
// de ce (o săptămână din jurnalul pilotului), funcțiile, pilotul la lucru direct în
// contul Google Ads, ce face cu datele (cerut și de Google pentru accesul la
// reclame), întrebările și îndemnul de la final.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return {
    title: { absolute: t('marketing.meta_title') },
    description: t('marketing.meta_description'),
    alternates: { canonical: 'https://hontrio.com' },
  }
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Why />
      <Features />
      <OptimizeAds />
      <DataUse />
      <Faq />
      <FinalCta />
    </>
  )
}
