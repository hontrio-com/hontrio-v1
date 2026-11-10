'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useAnnouncementDismissed } from './header'

// Pe pagina principală, începutul paginii stă sub antet; pe celelalte pagini,
// conținutul începe sub antet: fâșia cu noutatea (36px, dacă n-a fost închisă) + bara (64px).
export function SiteMain({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const dismissed = useAnnouncementDismissed()
  return <main className={pathname === '/' ? undefined : dismissed ? 'pt-16' : 'pt-[100px]'}>{children}</main>
}
