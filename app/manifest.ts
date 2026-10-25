import type { MetadataRoute } from 'next'
import { getT } from '@/lib/i18n/server'

// Descrierea aplicației la instalare (PWA), în limba vizitatorului
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getT()
  return {
    name: 'Hontrio',
    short_name: 'Hontrio',
    description: t('marketing.manifest_description'),
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  }
}
