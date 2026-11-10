import type { StoreSetup } from '@/lib/commerce/setup'
import type { Offer } from '@/lib/commerce/ads-data'
import type { AuditRaw } from '@/lib/google/audit'

// Datele de pornire ale testelor: un magazin Edinio în România, cu Merchant
// Center legat și conversia setată.

export function setup(over: Partial<StoreSetup> = {}): StoreSetup {
  return {
    platform: 'edinio',
    platformName: 'Edinio',
    pricesIncludeVat: true,
    assumedVatRate: 0.21,
    merchant: { status: 'ok', via: 'Edinio', href: 'https://edinio.test/merchant' },
    conversion: { status: 'ok', via: 'Edinio', href: 'https://edinio.test/ads' },
    feed: { country: 'RO', language: 'ro' },
    googleStatusKnown: true,
    productsHref: 'https://edinio.test/products',
    ...over,
  }
}

export function offer(id: string, over: Partial<Offer> = {}): Offer {
  return {
    offer_id: id,
    title: `Produs ${id}`,
    product_name: null,
    variant_title: null,
    image_url: null,
    category: null,
    price: 100,
    compare_at_price: null,
    available: true,
    stock: null,
    gtin: null,
    mpn: null,
    brand: null,
    google_status: 'active',
    ads_mode: 'auto',
    merchant_offer_id: null,
    merchant_issues: null,
    ads_auto_reason: null,
    ...over,
  }
}

export function auditRaw(over: Partial<AuditRaw> = {}): AuditRaw {
  return {
    customer: [{ customer: { id: '1234567890', descriptiveName: 'Magazin', currencyCode: 'RON', timeZone: 'Europe/Bucharest', autoTaggingEnabled: true } }],
    productLinks: [{ productLink: { type: 'MERCHANT_CENTER', merchantCenter: { merchantCenterId: '555' } } }],
    conversionActions: [{ conversionAction: { id: '9', name: 'Cumpărare', status: 'ENABLED', category: 'PURCHASE', origin: 'WEBSITE', primaryForGoal: true } }],
    goals: [{ customerConversionGoal: { category: 'PURCHASE', origin: 'WEBSITE', biddable: true } }],
    campaigns: [],
    metrics30: [],
    ...over,
  }
}
