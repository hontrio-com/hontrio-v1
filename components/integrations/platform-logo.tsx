import { PLATFORM_NAMES, type CommercePlatform } from '@/lib/commerce/platforms'
import { cn } from '@/lib/utils'

// =============================================
// Logo-urile oficiale ale platformelor de magazin (din public/site/logos), la
// aceeași mărime vizuală: cele lungi, cu numele scris în logo, mai joase.
// =============================================

const LOGOS: Record<CommercePlatform, { src: string; wordmark: boolean; height: number }> = {
  edinio: { src: '/site/logos/edinio.svg', wordmark: true, height: 22 },
  woocommerce: { src: '/site/logos/woocommerce.svg', wordmark: false, height: 22 },
  shopify: { src: '/site/logos/shopify.svg', wordmark: false, height: 28 },
  gomag: { src: '/site/logos/gomag.png', wordmark: true, height: 22 },
  merchantpro: { src: '/site/logos/merchantpro.png', wordmark: true, height: 13 },
  opencart: { src: '/site/logos/opencart.png', wordmark: false, height: 28 },
}

/**
 * Logo-ul platformei; cu `named`, și numele alături când logo-ul nu-l are deja.
 * `scale` le mărește sau le micșorează pe toate la fel.
 */
export function PlatformLogo({ platform, named = false, scale = 1, className, nameClassName }: {
  platform: CommercePlatform; named?: boolean; scale?: number; className?: string; nameClassName?: string
}) {
  const logo = LOGOS[platform]
  const name = PLATFORM_NAMES[platform]
  const withName = named && !logo.wordmark
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.src} alt={withName ? '' : name} style={{ height: Math.round(logo.height * scale) }} className="w-auto max-w-full shrink-0 object-contain" />
      {withName && <span className={cn('truncate font-semibold', nameClassName)}>{name}</span>}
    </span>
  )
}
