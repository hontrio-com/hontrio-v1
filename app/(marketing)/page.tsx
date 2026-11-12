import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'
import { Hero } from '@/components/site/hero'
import { HowItWorks } from '@/components/site/how'
import { OptimizeAds } from '@/components/site/optimize-ads'
import { Faq } from '@/components/site/faq'
import { FinalCta } from '@/components/site/cta'

// Pagina principală: ce face Hontrio, cum (trei pași, imediat după început),
// pilotul automat la lucru direct în contul Google Ads, întrebările și îndemnul
// de la final. Ce face Hontrio cu datele (cu declarația Limited Use cerută de
// Google) e în /legal/privacy, legată din subsol.
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
      <OptimizeAds />
      <Faq />
      <FinalCta />
    </>
  )
}
