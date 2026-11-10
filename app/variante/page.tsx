import type { Metadata } from 'next'
import { VariantLab } from '@/components/site/lab/variant-lab'
import { Why } from '@/components/site/why'
import { HowItWorks } from '@/components/site/how'
import { ProfitCalculator } from '@/components/site/calculator'
import { Features } from '@/components/site/features'
import { DataUse } from '@/components/site/data'
import { Faq } from '@/components/site/faq'
import { FinalCta } from '@/components/site/cta'
import { SiteFooter } from '@/components/site/footer'

// Pagina de lucru pentru alegerea antetului și a începutului paginii principale
// (temporară, nu apare în căutări). Restul paginii e cel de pe hontrio.com.
export const metadata: Metadata = {
  title: 'Variante', // i18n-ignore
  robots: { index: false, follow: false },
}

type Params = Promise<Record<string, string | string[] | undefined>>

export default async function VariantePage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  return (
    <div className="app min-h-screen bg-white text-neutral-950">
      <VariantLab header={one(params.header).toUpperCase()} hero={one(params.hero)}>
        <Why />
        <HowItWorks />
        <ProfitCalculator />
        <Features />
        <DataUse />
        <Faq />
        <FinalCta />
      </VariantLab>
      <SiteFooter />
    </div>
  )
}
