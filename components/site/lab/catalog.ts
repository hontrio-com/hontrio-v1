import { Armchair, Droplet, Headphones, LampDesk, Shirt, Watch, type LucideIcon } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

// =============================================
// Produsele demonstrative din variantele începutului de pagină (reclame
// Google Shopping, căutări, categorii). Numele sunt în `site.prod_*`, prețul
// în lei pentru română și în euro pentru engleză, ca în calculator.
// =============================================

export type ProductId = 'lamp' | 'headphones' | 'watch' | 'armchair' | 'serum' | 'shirt'

export type Product = { id: ProductId; icon: LucideIcon; ron: number; eur: number; margin: number }

export const PRODUCTS: Product[] = [
  { id: 'lamp', icon: LampDesk, ron: 189, eur: 39, margin: 0.45 },
  { id: 'headphones', icon: Headphones, ron: 349, eur: 69, margin: 0.3 },
  { id: 'watch', icon: Watch, ron: 529, eur: 109, margin: 0.38 },
  { id: 'armchair', icon: Armchair, ron: 899, eur: 179, margin: 0.52 },
  { id: 'serum', icon: Droplet, ron: 119, eur: 24, margin: 0.62 },
  { id: 'shirt', icon: Shirt, ron: 179, eur: 36, margin: 0.48 },
]

/** Pragul de profit (ROAS), cu TVA 21%, ca în calculator: (1 + TVA) ÷ marjă. */
export const breakEven = (margin: number) => 1.21 / margin
/** Ținta pentru obiectivul „echilibrat" (păstrezi 25% din marjă). */
export const targetRoas = (margin: number) => breakEven(margin) / 0.75

export function useShop() {
  const { t, locale, intlLocale } = useT()
  const euro = locale !== 'ro'
  const currency = new Intl.NumberFormat(intlLocale, { style: 'currency', currency: euro ? 'EUR' : 'RON', maximumFractionDigits: 0 })
  const decimal = new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return {
    t,
    euro,
    money: (n: number) => currency.format(Math.round(n)),
    price: (p: Product) => currency.format(euro ? p.eur : p.ron),
    roas: (n: number) => decimal.format(n),
  }
}
