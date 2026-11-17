import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'
import { AboutHero } from '@/components/site/about/hero'
import { GoogleData } from '@/components/site/google-data'
import { AboutCompany } from '@/components/site/about/company'
import { FinalCta } from '@/components/site/cta'

// =============================================
// Despre Hontrio (/about): ce face aplicația, ce face în conturile Google ale
// magazinului (aceeași secțiune ca pe prima pagină: de ce cere accesul, ce nu face
// cu datele, declarația Limited Use), firma și îndemnul de la final. Tot textul
// vine vizibil de la server, fără animații de apariție. Legată din subsolul
// fiecărei pagini. App home page în verificarea aplicației OAuth la Google rămâne
// prima pagină (hotărârea proprietarului, 17.11.2026).
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
      <GoogleData />
      <AboutCompany />
      <FinalCta reveal={false} />
    </>
  )
}
