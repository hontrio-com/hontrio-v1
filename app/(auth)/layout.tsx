import { MotionPanel } from '@/components/onboarding/motion-panel'

// Paginile de cont, în aspectul onboarding-ului: în stânga logo-ul și formularul, în
// dreapta clipul motion design (doar pe ecranele late; pe telefon rămâne formularul).
// Jos, coloana lasă loc cât bannerul de cookie-uri (`--consent-h`, pus de CookieConsent),
// ca formularul să nu ajungă sub el. Limba vine din țara omului (`detectLocale`) și se
// schimbă doar din Setări.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app grid min-h-dvh bg-white text-neutral-950 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      <section className="flex min-h-dvh flex-col px-5 pt-5 sm:px-10 lg:px-14" style={{ paddingBottom: 'calc(1.25rem + var(--consent-h, 0px))' }}>
        <header className="flex h-9 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-black.png" alt="Hontrio" className="h-5 w-auto sm:h-6" />
        </header>
        <div className="flex flex-1 items-center py-10">
          <div className="w-full max-w-[440px]">{children}</div>
        </div>
      </section>

      <aside className="hidden p-3 lg:block">
        <div className="sticky top-3 h-[calc(100dvh-1.5rem)]">
          <MotionPanel />
        </div>
      </aside>
    </div>
  )
}
