// =============================================
// Shopify — ce citește Hontrio din GraphQL Admin API, doar câmpurile folosite.
// ⚠ Despre cumpărător, interogarea comenzilor cere cel mult țara din adresă
// (și doar cât Shopify dă aplicației acces la adrese); nume, email, telefon nu.
// =============================================

/** Sumele vin ca text zecimal, în moneda magazinului. */
export type MoneyBag = { shopMoney: { amount: string } }

export type MediaPreview = { preview?: { image?: { url: string } | null } | null } | null

export type ShopifyProductRef = {
  legacyResourceId: string
  title: string
  handle: string
  /** ACTIVE | ARCHIVED | DRAFT | UNLISTED */
  status: string
  vendor: string
  productType: string
  /** Null = nu e publicat în magazinul online */
  onlineStoreUrl: string | null
  isGiftCard: boolean
  hasOnlyDefaultVariant: boolean
  updatedAt: string
  /** Categoria din taxonomia Shopify */
  category: { name: string } | null
  featuredMedia: MediaPreview
}

export type ShopifyVariant = {
  legacyResourceId: string
  /** „Default Title" la produsele fără variante */
  title: string
  sku: string | null
  barcode: string | null
  price: string
  compareAtPrice: string | null
  /** Ține cont de stoc și de vânzarea fără stoc */
  availableForSale: boolean
  inventoryQuantity: number | null
  updatedAt: string
  selectedOptions: { name: string; value: string }[]
  inventoryItem: { tracked: boolean } | null
  media: { nodes: MediaPreview[] } | null
  product: ShopifyProductRef
}

export type ShopifyVisit = {
  landingPage: string | null
  referrerUrl: string | null
  source: string | null
  utmParameters: { source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null } | null
}

export type ShopifyLineItem = {
  name: string
  quantity: number
  variantTitle: string | null
  variant: { legacyResourceId: string } | null
  product: { legacyResourceId: string } | null
  /** Prețul bucății înainte de reduceri, cu taxe dacă prețurile le includ */
  originalUnitPriceSet: MoneyBag
}

export type ShopifyOrder = {
  legacyResourceId: string
  /** „#1001" */
  name: string
  createdAt: string
  updatedAt: string
  cancelledAt: string | null
  test: boolean
  /** PENDING | AUTHORIZED | PARTIALLY_PAID | PAID | PARTIALLY_REFUNDED | REFUNDED | VOIDED | EXPIRED */
  displayFinancialStatus: string | null
  /** UNFULFILLED | PARTIALLY_FULFILLED | FULFILLED | ... */
  displayFulfillmentStatus: string
  /** web | pos | shopify_draft_order | iphone | android | id-ul unei aplicații (alt canal) */
  sourceName: string | null
  currencyCode: string
  taxesIncluded: boolean
  totalPriceSet: MoneyBag
  totalTaxSet: MoneyBag | null
  totalDiscountsSet: MoneyBag | null
  totalShippingPriceSet: MoneyBag
  discountCodes: string[]
  paymentGatewayNames: string[]
  shippingAddress?: { countryCodeV2: string | null } | null
  billingAddress?: { countryCodeV2: string | null } | null
  customerJourneySummary: { firstVisit: ShopifyVisit | null; lastVisit: ShopifyVisit | null } | null
  lineItems: { nodes: ShopifyLineItem[]; pageInfo: { hasNextPage: boolean } }
}

export type ShopifyShop = {
  name: string
  currencyCode: string
  ianaTimezone: string | null
  /** „Toate prețurile includ taxele" */
  taxesIncluded: boolean
  billingAddress: { countryCodeV2: string | null } | null
}
