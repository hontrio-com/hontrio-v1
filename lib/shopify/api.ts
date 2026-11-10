import { storedMessage } from '@/lib/i18n/stored'
import type { Params } from '@/lib/i18n/translate'
import type { ShopifyOrder, ShopifyShop, ShopifyVariant } from './types'

// =============================================
// Shopify — clientul GraphQL Admin API pentru modelul de reclame (numai
// citire). Tokenul aplicației merge în antet, niciodată în adresă.
//
// Shopify măsoară fiecare interogare în „puncte": una prea scumpă e refuzată
// (se reia cu pagini mai mici), iar când găleata e goală se așteaptă cât spune
// Shopify că se umple la loc. Câmpurile la care Shopify poate refuza accesul
// (adresa, pentru țara cumpărătorului) sunt opționale: pagina se reia fără
// ele, iar sincronizarea află asta.
// =============================================

export const API_VERSION = '2026-07'

export type ShopifyErrorCode = 'unauthorized' | 'access_denied' | 'not_found' | 'unavailable' | 'network' | 'bad_response' | 'too_expensive'

export class ShopifyError extends Error {
  /** Ce vede omul (în stores.last_error): cheia de traducere, cu parametri. `message` e pentru jurnal. */
  readonly stored: string
  constructor(message: string, public code: ShopifyErrorCode, public status: number | undefined, key: string, params?: Params) {
    super(message)
    this.stored = storedMessage(key, params)
  }
}

export type ShopifyPage<T> = { items: T[]; hasNext: boolean; endCursor: string | null }

type GraphqlError = { message: string; path?: (string | number)[]; extensions?: { code?: string } }
type Cost = { requestedQueryCost?: number; throttleStatus?: { currentlyAvailable: number; restoreRate: number } }
type Connection<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }

const TIMEOUT_MS = 30_000
const RETRIES = 2
const THROTTLE_RETRIES = 6
export const VARIANTS_PAGE = 50
export const ORDERS_PAGE = 10
// Liniile cerute pe comandă; peste atât, suma produselor vine din totaluri
export const ORDER_LINES = 30
export const IDS_PAGE = 250

/** Datele în filtrele de căutare Shopify: ISO în UTC, între ghilimele. */
export const shopifyDate = (iso: string) => `'${new Date(iso).toISOString().slice(0, 19)}Z'`

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const VARIANT_FIELDS = `
  legacyResourceId title sku barcode price compareAtPrice availableForSale inventoryQuantity updatedAt
  selectedOptions { name value }
  inventoryItem { tracked }
  media(first: 1) { nodes { preview { image { url } } } }
  product {
    legacyResourceId title handle status vendor productType onlineStoreUrl isGiftCard hasOnlyDefaultVariant updatedAt
    category { name }
    featuredMedia { preview { image { url } } }
  }`

const QUERIES = {
  shop: `query ShopInfo {
    shop {
      name currencyCode ianaTimezone taxesIncluded
      billingAddress { countryCodeV2 }
    }
    currentAppInstallation { accessScopes { handle } }
  }`,
  locales: `query Locales { shopLocales(published: true) { locale primary } }`,
  // i18n-ignore: interogare GraphQL, nu text
  variants: `query Variants($first: Int!, $after: String, $query: String) {
    productVariants(first: $first, after: $after, query: $query, sortKey: ID) {
      pageInfo { hasNextPage endCursor }
      nodes { ${VARIANT_FIELDS} }
    }
  }`,
  productIds: `query ProductIds($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: ID) {
      pageInfo { hasNextPage endCursor }
      nodes { legacyResourceId }
    }
  }`,
  orders: `query Orders($first: Int!, $after: String, $query: String, $lines: Int!, $withCountry: Boolean!) {
    orders(first: $first, after: $after, query: $query, sortKey: ID) {
      pageInfo { hasNextPage endCursor }
      nodes {
        legacyResourceId name createdAt updatedAt cancelledAt test
        displayFinancialStatus displayFulfillmentStatus sourceName currencyCode taxesIncluded
        totalPriceSet { shopMoney { amount } }
        totalTaxSet { shopMoney { amount } }
        totalDiscountsSet { shopMoney { amount } }
        totalShippingPriceSet { shopMoney { amount } }
        discountCodes paymentGatewayNames
        shippingAddress @include(if: $withCountry) { countryCodeV2 }
        billingAddress @include(if: $withCountry) { countryCodeV2 }
        customerJourneySummary { firstVisit { ...Visit } lastVisit { ...Visit } }
        lineItems(first: $lines) {
          pageInfo { hasNextPage }
          nodes {
            name quantity variantTitle
            variant { legacyResourceId }
            product { legacyResourceId }
            originalUnitPriceSet { shopMoney { amount } }
          }
        }
      }
    }
  }
  fragment Visit on CustomerVisit {
    landingPage referrerUrl source
    utmParameters { source medium campaign content term }
  }`,
  orderIds: `query OrderIds($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: ID) {
      pageInfo { hasNextPage endCursor }
      nodes { legacyResourceId }
    }
  }`,
}

/** Toate erorile țin de câmpurile date (ex. accesul la adresă): restul răspunsului e bun. */
function onlyAt(errors: GraphqlError[], fields: string[]): boolean {
  return errors.length > 0 && errors.every(e => (e.path ?? []).some(p => typeof p === 'string' && fields.includes(p)))
}

function failure(errors: GraphqlError[]): ShopifyError {
  // Mesajele lui Shopify (în engleză) ajung la om ca detaliu
  const detail = errors.map(e => e.message).join('; ')
  const denied = errors.some(e => e.extensions?.code === 'ACCESS_DENIED')
  return new ShopifyError(`Shopify: ${detail || 'răspuns gol'}`, denied ? 'access_denied' : 'bad_response', undefined,
    !detail ? 'sync.shopify_empty_response' : denied ? 'sync.shopify_access_denied' : 'sync.shopify_error',
    detail ? { detail: detail.slice(0, 500) } : undefined)
}

export class ShopifyApi {
  private endpoint: string

  /** `shop` = domeniul myshopify (ex. magazin.myshopify.com); o adresă întreagă se folosește ca atare. */
  constructor(shop: string, private token: string) {
    const base = /^https?:\/\//.test(shop) ? shop.replace(/\/+$/, '') : `https://${shop.replace(/\/+$/, '')}`
    this.endpoint = `${base}/admin/api/${API_VERSION}/graphql.json`
  }

  private async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<{ data: T | null; errors: GraphqlError[] }> {
    let last: ShopifyError | null = null
    let throttled = 0
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      if (attempt) await sleep(1500 * attempt)
      let res: Response
      try {
        res = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'X-Shopify-Access-Token': this.token, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: 'no-store',
        })
      } catch (err) {
        const code = String((err as { cause?: { code?: string } }).cause?.code ?? '')
        last = new ShopifyError(`Shopify nu a răspuns: ${code || (err as Error).message}`, 'network', undefined, 'sync.shopify_no_response')
        if (code === 'ENOTFOUND') break
        continue
      }

      if (res.status === 429 || res.status >= 500) {
        last = new ShopifyError(`Shopify e indisponibil (${res.status})`, 'unavailable', res.status, 'sync.shopify_unavailable', { status: res.status })
        const wait = Number(res.headers.get('retry-after'))
        if (wait > 0) await sleep(Math.min(wait, 10) * 1000)
        continue
      }
      // Token invalid: aplicația a fost dezinstalată sau accesul retras
      if (res.status === 401) throw new ShopifyError('Shopify a refuzat accesul aplicației', 'unauthorized', 401, 'sync.shopify_access_revoked')
      if (res.status === 402 || res.status === 423) throw new ShopifyError(`Magazinul Shopify e închis sau blocat (${res.status})`, 'unavailable', res.status, 'sync.shopify_store_closed', { status: res.status })
      if (res.status === 404) throw new ShopifyError('Magazinul Shopify nu există (404)', 'not_found', 404, 'sync.shopify_not_found')
      const body = await res.json().catch(() => null) as { data?: T; errors?: GraphqlError[] | string; extensions?: { cost?: Cost } } | null
      if (!res.ok || body === null) throw new ShopifyError(`Shopify a răspuns ${res.status}`, 'bad_response', res.status, 'sync.shopify_bad_response', { status: res.status })

      const errors: GraphqlError[] = Array.isArray(body.errors) ? body.errors : body.errors ? [{ message: String(body.errors) }] : []
      if (errors.some(e => e.extensions?.code === 'THROTTLED') && throttled < THROTTLE_RETRIES) {
        // Cât lipsește din găleată, la viteza cu care se umple
        const cost = body.extensions?.cost
        const missing = (cost?.requestedQueryCost ?? 100) - (cost?.throttleStatus?.currentlyAvailable ?? 0)
        const rate = cost?.throttleStatus?.restoreRate || 50
        await sleep(Math.min(10_000, Math.max(500, (missing / rate) * 1000)))
        throttled++
        attempt--
        continue
      }
      if (errors.some(e => e.extensions?.code === 'MAX_COST_EXCEEDED')) throw new ShopifyError('Interogarea e prea scumpă pentru Shopify', 'too_expensive', undefined, 'sync.shopify_too_expensive')
      return { data: body.data ?? null, errors }
    }
    throw last ?? new ShopifyError('Cererea către Shopify a eșuat', 'unavailable', undefined, 'sync.shopify_no_response')
  }

  /**
   * O pagină dintr-o listă. Cu prea multe puncte se reia cu jumătate; când doar
   * câmpul opțional `optional.fields` e refuzat, se reia fără el.
   */
  private async page<T>(query: string, key: string, variables: Record<string, unknown> & { first: number },
    optional?: { flag: string; fields: string[] }): Promise<ShopifyPage<T> & { optionalDenied: boolean }> {
    let first = variables.first
    let withOptional = optional ? variables[optional.flag] === true : false
    for (;;) {
      try {
        const vars = { ...variables, first, ...(optional ? { [optional.flag]: withOptional } : {}) }
        const { data, errors } = await this.request<Record<string, Connection<T>>>(query, vars)
        if (optional && withOptional && onlyAt(errors, optional.fields)) {
          withOptional = false
          continue
        }
        const c = data?.[key]
        if (errors.length || !c) throw failure(errors)
        return {
          items: c.nodes,
          hasNext: c.pageInfo.hasNextPage,
          endCursor: c.pageInfo.endCursor,
          optionalDenied: !!optional && variables[optional.flag] === true && !withOptional,
        }
      } catch (err) {
        if (!(err instanceof ShopifyError) || err.code !== 'too_expensive' || first <= 1) throw err
        first = Math.floor(first / 2)
      }
    }
  }

  /** Magazinul și drepturile aplicației. */
  async shop(): Promise<{ shop: ShopifyShop; scopes: string[] | null }> {
    const { data, errors } = await this.request<{ shop: ShopifyShop; currentAppInstallation: { accessScopes: { handle: string }[] } | null }>(QUERIES.shop)
    if (errors.length || !data?.shop) throw failure(errors)
    return { shop: data.shop, scopes: data.currentAppInstallation?.accessScopes.map(s => s.handle) ?? null }
  }

  /** Limba principală; cere `read_locales`, deci lipsa ei nu e o eroare. */
  async primaryLocale(): Promise<string | null> {
    try {
      const { data } = await this.request<{ shopLocales: { locale: string; primary: boolean }[] }>(QUERIES.locales)
      return data?.shopLocales?.find(l => l.primary)?.locale ?? null
    } catch {
      return null
    }
  }

  /** Variantele (ofertele), cu produsul lor, în ordinea id-ului: paginile nu se decalează. */
  async variants(opts: { after: string | null; query?: string }): Promise<ShopifyPage<ShopifyVariant>> {
    const r = await this.page<ShopifyVariant>(QUERIES.variants, 'productVariants',
      { first: VARIANTS_PAGE, after: opts.after, query: opts.query ?? null })
    return { items: r.items, hasNext: r.hasNext, endCursor: r.endCursor }
  }

  /** Id-urile produselor care se potrivesc filtrului (ex. modificate de la o dată). */
  productIds(opts: { after: string | null; query: string }): Promise<ShopifyPage<{ legacyResourceId: string }>> {
    return this.page(QUERIES.productIds, 'products', { first: IDS_PAGE, after: opts.after, query: opts.query })
  }

  /** Comenzile, cu liniile lor; țara cumpărătorului doar cât dă Shopify acces la adrese. */
  async orders(opts: { after: string | null; query: string; withCountry: boolean }): Promise<ShopifyPage<ShopifyOrder> & { countryDenied: boolean }> {
    const r = await this.page<ShopifyOrder>(QUERIES.orders, 'orders',
      { first: ORDERS_PAGE, after: opts.after, query: opts.query, lines: ORDER_LINES, withCountry: opts.withCountry },
      { flag: 'withCountry', fields: ['shippingAddress', 'billingAddress'] })
    return { ...r, countryDenied: r.optionalDenied }
  }

  orderIds(opts: { after: string | null; query: string }): Promise<ShopifyPage<{ legacyResourceId: string }>> {
    return this.page(QUERIES.orderIds, 'orders', { first: IDS_PAGE, after: opts.after, query: opts.query })
  }

  /** Shopify anunță adresa dată când aplicația e dezinstalată. Abonarea existentă e în regulă. */
  async subscribeUninstalled(uri: string): Promise<void> {
    // Adresa intră ca literal (JSON e un șir GraphQL valid): tipul variabilei diferă între versiuni
    // i18n-ignore: mutație GraphQL, nu text
    const mutation = `mutation Subscribe {
      webhookSubscriptionCreate(topic: APP_UNINSTALLED, webhookSubscription: { uri: ${JSON.stringify(uri)} }) {
        userErrors { message }
      }
    }`
    const { data, errors } = await this.request<{ webhookSubscriptionCreate: { userErrors: { message: string }[] } | null }>(mutation)
    const userErrors = (data?.webhookSubscriptionCreate?.userErrors ?? []).filter(e => !/already been taken/i.test(e.message))
    if (errors.length || userErrors.length) {
      const detail = [...errors, ...userErrors].map(e => e.message).join('; ')
      throw new ShopifyError(`Abonarea la dezinstalare a eșuat: ${detail}`, 'bad_response', undefined, 'sync.shopify_error', { detail: detail.slice(0, 500) })
    }
  }
}
