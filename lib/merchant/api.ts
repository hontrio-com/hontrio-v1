// =============================================
// Merchant API v1 (REST) — clientul Hontrio pentru Merchant Center-ul omului.
// Content API for Shopping s-a oprit pe 18.08.2026; Merchant API folosește
// același drept OAuth (`auth/content`) pe care îl cere deja conectarea Google.
// Câmpurile vin din definițiile oficiale google/shopping/merchant/*/v1.
// =============================================

const BASE_URL = 'https://merchantapi.googleapis.com'

export class MerchantApiError extends Error {
  constructor(message: string, public httpStatus: number, public reason: string | null) {
    super(message)
  }
}

async function request<T>(path: string, accessToken: string, init: { method?: string; body?: unknown; query?: Record<string, string> } = {}): Promise<T> {
  const url = new URL(`${BASE_URL}/${path}`)
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v)
  const res = await fetch(url, {
    method: init.method || 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30000),
  })
  if (res.status === 204) return {} as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = (data as { error?: { message?: string; status?: string; details?: { reason?: string }[] } }).error
    throw new MerchantApiError(
      err?.message || `Merchant API: HTTP ${res.status}`, // i18n-ignore: detaliu tehnic (marcă + cod HTTP)
      res.status,
      err?.details?.find(d => d.reason)?.reason || err?.status || null,
    )
  }
  return data as T
}

// ─── Produsele ───────────────────────────────────────────────────────────────

export type McPrice = { amountMicros?: string; currencyCode?: string }

export type McProduct = {
  name: string
  offerId: string
  contentLanguage: string
  feedLabel: string
  /** Sursa principală din care vine produsul. */
  dataSource?: string
  productAttributes?: {
    title?: string
    link?: string
    gtins?: string[]
    mpn?: string
    brand?: string
    price?: McPrice
    availability?: string
    googleProductCategory?: string
    costOfGoodsSold?: McPrice
    customLabel0?: string
    customLabel1?: string
    customLabel2?: string
    customLabel3?: string
    customLabel4?: string
  }
  productStatus?: {
    destinationStatuses?: { reportingContext?: string; approvedCountries?: string[]; pendingCountries?: string[]; disapprovedCountries?: string[] }[]
    itemLevelIssues?: {
      code?: string; severity?: string; resolution?: string; attribute?: string; reportingContext?: string
      description?: string; detail?: string; documentation?: string; applicableCountries?: string[]
    }[]
  }
}

/** Toate produsele procesate ale contului (după regulile și sursele suplimentare). */
export async function listProducts(accessToken: string, accountId: string, max = 20_000): Promise<McProduct[]> {
  const all: McProduct[] = []
  let pageToken: string | undefined
  do {
    const data = await request<{ products?: McProduct[]; nextPageToken?: string }>(
      `products/v1/accounts/${accountId}/products`, accessToken,
      { query: { pageSize: '1000', ...(pageToken ? { pageToken } : {}) } },
    )
    all.push(...(data.products ?? []))
    pageToken = data.nextPageToken
  } while (pageToken && all.length < max)
  return all
}

// ─── Sursele de date ─────────────────────────────────────────────────────────

export type DataSourceReference = { self?: boolean; primaryDataSourceName?: string; supplementalDataSourceName?: string }

export type McDataSource = {
  name: string
  dataSourceId?: string
  displayName?: string
  input?: string
  primaryProductDataSource?: { feedLabel?: string; contentLanguage?: string; defaultRule?: { takeFromDataSources?: DataSourceReference[] } }
  supplementalProductDataSource?: { feedLabel?: string; contentLanguage?: string; referencingPrimaryDataSources?: DataSourceReference[] }
}

export async function listDataSources(accessToken: string, accountId: string): Promise<McDataSource[]> {
  const all: McDataSource[] = []
  let pageToken: string | undefined
  do {
    const data = await request<{ dataSources?: McDataSource[]; nextPageToken?: string }>(
      `datasources/v1/accounts/${accountId}/dataSources`, accessToken,
      { query: { pageSize: '1000', ...(pageToken ? { pageToken } : {}) } },
    )
    all.push(...(data.dataSources ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)
  return all
}

/** O sursă suplimentară API fără etichetă și limbă: se aplică oricărei surse principale. */
export function createSupplementalDataSource(accessToken: string, accountId: string, displayName: string): Promise<McDataSource> {
  return request<McDataSource>(`datasources/v1/accounts/${accountId}/dataSources`, accessToken, {
    method: 'POST',
    body: { displayName, supplementalProductDataSource: {} },
  })
}

/** Înlocuiește regula implicită a unei surse principale (lista se trimite întreagă). */
export function setDefaultRule(accessToken: string, primaryName: string, takeFromDataSources: DataSourceReference[]): Promise<McDataSource> {
  return request<McDataSource>(`datasources/v1/${primaryName}`, accessToken, {
    method: 'PATCH',
    query: { updateMask: 'primaryProductDataSource.defaultRule' },
    body: { name: primaryName, primaryProductDataSource: { defaultRule: { takeFromDataSources } } },
  })
}

// ─── Datele trimise de Hontrio (sursa suplimentară) ──────────────────────────

export type ProductInput = {
  offerId: string
  contentLanguage: string
  feedLabel: string
  productAttributes: Record<string, unknown>
}

export function insertProductInput(accessToken: string, accountId: string, dataSource: string, input: ProductInput): Promise<unknown> {
  return request(`products/v1/accounts/${accountId}/productInputs:insert`, accessToken, {
    method: 'POST',
    query: { dataSource },
    body: input,
  })
}

/** Numele codat (base64url fără padding), ca un `offerId` cu „/" sau „~" să nu strice adresa. */
export function productInputName(accountId: string, contentLanguage: string, feedLabel: string, offerId: string): string {
  const encoded = Buffer.from(`${contentLanguage}~${feedLabel}~${offerId}`, 'utf8').toString('base64url')
  return `accounts/${accountId}/productInputs/${encoded}`
}

export function deleteProductInput(accessToken: string, name: string, dataSource: string): Promise<unknown> {
  return request(`products/v1/${name}`, accessToken, { method: 'DELETE', query: { dataSource } })
}

// ─── Rapoartele ──────────────────────────────────────────────────────────────

/** Un rând de raport: o singură cheie, numele tabelei în camelCase (ex. `priceCompetitivenessProductView`). */
export type ReportRow = Record<string, Record<string, unknown> | undefined>

export async function searchReports(accessToken: string, accountId: string, query: string, max = 5000): Promise<ReportRow[]> {
  const all: ReportRow[] = []
  let pageToken: string | undefined
  do {
    const data = await request<{ results?: ReportRow[]; nextPageToken?: string }>(
      `reports/v1/accounts/${accountId}/reports:search`, accessToken,
      { method: 'POST', body: { query, pageSize: 1000, ...(pageToken ? { pageToken } : {}) } },
    )
    all.push(...(data.results ?? []))
    pageToken = data.nextPageToken
  } while (pageToken && all.length < max)
  return all
}

export function priceOf(p: McPrice | undefined): number | null {
  const n = Number(p?.amountMicros)
  return Number.isFinite(n) && p?.amountMicros !== undefined ? n / 1_000_000 : null
}
