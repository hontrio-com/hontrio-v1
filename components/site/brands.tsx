import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

// =============================================
// Cu ce se conectează Hontrio, cu logo-urile oficiale: platformele de magazin și
// Google. Aceeași listă apare sub căutarea din capul paginii (color) și în subsol
// (alb). Gomag, MerchantPro și OpenCart se fac înainte de lansare (hotărârea
// proprietarului, 12.11.2026).
// =============================================

/** `wordmark`: numele e deja în logo, deci fără text alături. `scale`: înălțimea față de celelalte. */
export type Brand = { name: string; src: string; wordmark?: boolean; scale?: number }

// i18n-ignore-start (nume de produse)
export const STORES: Brand[] = [
  { name: 'Edinio', src: '/site/logos/edinio.svg', wordmark: true, scale: 0.93 },
  { name: 'WooCommerce', src: '/site/logos/woocommerce.svg' },
  { name: 'Shopify', src: '/site/logos/shopify.svg' },
  { name: 'Gomag', src: '/site/logos/gomag.png', wordmark: true, scale: 1.07 },
  { name: 'MerchantPro', src: '/site/logos/merchantpro.png', wordmark: true, scale: 0.64 },
  { name: 'OpenCart', src: '/site/logos/opencart.png' },
]
export const GOOGLE: Brand[] = [
  { name: 'Google Ads', src: '/site/logos/google-ads.svg' },
  { name: 'Merchant Center', src: '/site/logos/google-merchant-center.svg' },
]
// i18n-ignore-end

/**
 * Un logo și, când logo-ul nu are numele în el, numele alături. Mărimea vine din
 * variabila `--logo` a părintelui (înălțimea unui logo obișnuit); dacă nu e loc,
 * logo-ul se micșorează cât să încapă.
 */
export function BrandMark({ brand, imgClassName, nameClassName }: { brand: Brand; imgClassName?: string; nameClassName?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-[calc(var(--logo)*0.36)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.src} alt={brand.wordmark ? brand.name : ''} style={{ '--s': brand.scale ?? 1 } as CSSProperties}
        className={cn('h-[calc(var(--logo)*var(--s))] w-auto min-w-0 max-w-full object-contain', imgClassName)} />
      {!brand.wordmark && <span className={cn('truncate', nameClassName)}>{brand.name}</span>}
    </span>
  )
}
