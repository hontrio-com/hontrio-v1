import { SiteHeader } from '@/components/site/header'
import { SiteFooter } from '@/components/site/footer'
import { SiteMain } from '@/components/site/main'

// Site-ul de prezentare: antetul care plutește, pagina și subsolul negru.
// Fontul și culorile sunt cele ale platformei (clasa `app`: Geist).
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app min-h-screen bg-white text-neutral-950">
      <SiteHeader />
      <SiteMain>{children}</SiteMain>
      <SiteFooter />
    </div>
  )
}
