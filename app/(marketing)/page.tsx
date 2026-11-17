import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'
import { Hero } from '@/components/site/hero'
import { HowItWorks } from '@/components/site/how'
import { OptimizeAds } from '@/components/site/optimize-ads'
import { GoogleData } from '@/components/site/google-data'
import { Compare } from '@/components/site/compare/compare'
import { PriceTeaser } from '@/components/site/price-teaser/price-teaser'
import { Faq } from '@/components/site/faq'
import { FinalCta } from '@/components/site/cta'

// Pagina principală: ce face Hontrio (căutarea Google din capul paginii), cum (trei pași
// ilustrați), pilotul automat la lucru direct în contul Google Ads, ce face Hontrio în
// conturile Google și de ce cere accesul (cu ce nu face cu datele și declarația Limited
// Use), de ce Hontrio și nu singur sau cu o agenție (o lună, zi cu zi), cât costă (unde
// merg banii), întrebările și îndemnul de la final. Pagina aceasta este App home page în
// verificarea aplicației OAuth la Google: secțiunea despre Google trebuie să rămână aici,
// cu textul vizibil de la server. Detaliile despre date sunt în /legal/privacy.
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
      <GoogleData />
      <Compare />
      <PriceTeaser />
      <Faq />
      <FinalCta />
    </>
  )
}
