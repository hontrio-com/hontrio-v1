import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'

// =============================================
// Titlul din fila browserului pentru paginile platformei și ale administrării,
// în limba omului („Campanii | Hontrio", după șablonul din app/layout.tsx).
// Paginile sunt componente de client, deci titlul îl dă un layout mic al lor:
//   export const generateMetadata = pageTitle('sidebar.campaigns')
// =============================================

export function pageTitle(key: string) {
  return async function generateMetadata(): Promise<Metadata> {
    const t = await getT()
    return { title: t(key) }
  }
}
