'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

// Antetul plutește peste pagină: pagina principală își face singură loc sub el
// (fundalul ei trece pe sub antet), celelalte primesc spațiul aici.
export function SiteMain({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return <main className={pathname === '/' ? undefined : 'pt-[60px]'}>{children}</main>
}
