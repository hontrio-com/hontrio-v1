import LanguageSwitcher from '@/components/language-switcher'

// Paginile de cont, pe fundalul platformei (ca în CLIPPING): cardul stă la mijloc,
// limba se schimbă din colț.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app relative min-h-[100dvh] overflow-x-hidden bg-canvas text-neutral-950">
      <div className="absolute right-4 top-4 z-20"><LanguageSwitcher /></div>
      {children}
    </div>
  )
}
