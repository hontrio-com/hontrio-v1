// Paginile de cont, pe fundalul platformei (ca în CLIPPING): cardul stă la mijloc.
// Limba vine din țara omului (`detectLocale`) și se schimbă doar din Setări.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app relative min-h-[100dvh] overflow-x-hidden bg-canvas text-neutral-950">
      {children}
    </div>
  )
}
