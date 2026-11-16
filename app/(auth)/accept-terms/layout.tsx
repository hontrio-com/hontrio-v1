import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'

// Titlul, în limba omului; pagina cere cont, deci nu se indexează (ca în robots.ts)
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return {
    title: t('auth.terms_gate_title'),
    robots: { index: false, follow: false },
  }
}

export default function AcceptTermsLayout({ children }: { children: React.ReactNode }) {
  return children
}
