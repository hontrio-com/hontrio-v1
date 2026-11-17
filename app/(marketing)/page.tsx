import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'
import { Hero } from '@/components/site/hero'
import { HowItWorks } from '@/components/site/how'
import { GoogleAccess } from '@/components/site/google-access'
import { OptimizeAds } from '@/components/site/optimize-ads'
import { Compare } from '@/components/site/compare/compare'
import { PriceTeaser } from '@/components/site/price-teaser/price-teaser'
import { Faq } from '@/components/site/faq'
import { FinalCta } from '@/components/site/cta'

// Pagina principală: ce face Hontrio (căutarea Google din capul paginii), cum (trei pași
// ilustrați), ce face Hontrio în conturile Google ale magazinului (de ce cere accesul, ce
// nu face cu datele, declarația Limited Use; cerută de verificarea aplicației OAuth la
// Google), pilotul automat la lucru direct în contul Google Ads, de ce Hontrio și nu
// singur sau cu o agenție (o lună, zi cu zi), cât costă (unde merg banii), întrebările și
// îndemnul de la final. Detaliile despre date sunt în /legal/privacy, legată din secțiunea
// despre Google și din subsolul fiecărei pagini.
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
      <GoogleAccess />
      <OptimizeAds />
      <Compare />
      <PriceTeaser />
      <Faq />
      <FinalCta />
    </>
  )
}
