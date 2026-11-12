import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'
import { Pricing } from '@/components/site/pricing'
import { FinalCta } from '@/components/site/cta'

// Pagina de prețuri: grila (lib/pricing.ts), calculatorul, regulile de numărare
// (aceleași ca în Termeni, art. 9) și îndemnul de la final, ca pe pagina principală.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return {
    title: t('site.pricing_meta_title'),
    description: t('site.pricing_meta_description'),
    alternates: { canonical: 'https://hontrio.com/pricing' },
  }
}

export default function PricingPage() {
  return (
    <>
      <Pricing />
      <FinalCta />
    </>
  )
}
