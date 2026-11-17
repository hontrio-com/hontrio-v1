import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'
import { AboutHero } from '@/components/site/about/hero'
import { AboutGoogle } from '@/components/site/about/google'
import { AboutData } from '@/components/site/about/data'
import { AboutCompany } from '@/components/site/about/company'
import { FinalCta } from '@/components/site/cta'

// =============================================
// Despre Hontrio (/about): ce face aplicația, ce face în conturile Google ale
// magazinului și de ce cere accesul, ce nu face cu datele, declarația Limited Use,
// firma și îndemnul de la final. Este „App home page” în verificarea aplicației
// OAuth la Google (17.11.2026): pagina este publică, pe domeniul verificat, cu
// link spre Politica de confidențialitate, iar tot textul vine vizibil de la
// server, fără animații de apariție. Legată din subsolul fiecărei pagini.
// =============================================

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return {
    title: { absolute: t('marketing.about_meta_title') },
    description: t('marketing.about_meta_description'),
    alternates: { canonical: 'https://hontrio.com/about' },
  }
}

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <AboutGoogle />
      <AboutData />
      <AboutCompany />
      <FinalCta reveal={false} />
    </>
  )
}
