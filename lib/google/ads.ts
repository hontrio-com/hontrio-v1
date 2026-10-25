// =============================================
// Google Ads API (REST) — client minimal
// https://developers.google.com/google-ads/api/rest/overview
// =============================================

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v26'
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`

export class GoogleAdsApiError extends Error {
  constructor(
    message: string,
    public httpStatus: number,
    // ex: 'authorizationError.USER_PERMISSION_DENIED'
    public errorCode: string | null,
  ) {
    super(message)
  }
}

/** "123-456-7890" / "customers/1234567890" → "1234567890" */
export function normalizeCustomerId(id: string): string {
  return id.replace(/^customers\//, '').replace(/-/g, '')
}

/** "1234567890" → "123-456-7890", cum apare în interfața Google Ads */
export function formatCustomerId(id: string): string {
  return id.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')
}

async function request<T>(
  path: string,
  accessToken: string,
  init: { method?: string; body?: unknown; loginCustomerId?: string | null } = {},
): Promise<T> {
  // Fără header `developer-token`: tokenurile au fost retrase pe 9 sept. 2026.
  // Nivelul de acces vine din proiectul Google Cloud al clientului OAuth.
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
  if (init.loginCustomerId) headers['login-customer-id'] = init.loginCustomerId

  const res = await fetch(`${BASE_URL}/${path}`, {
    method: init.method || 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw parseError(res.status, data)
  return data as T
}

type ApiErrorBody = {
  error?: {
    message?: string
    details?: { errors?: { errorCode?: Record<string, string>; message?: string }[] }[]
  }
}

function parseError(status: number, data: ApiErrorBody): GoogleAdsApiError {
  const failure = data?.error?.details?.find(d => Array.isArray(d?.errors))
  const first = failure?.errors?.[0]
  let errorCode: string | null = null
  if (first?.errorCode) {
    const [group, value] = Object.entries(first.errorCode)[0] || []
    if (group) errorCode = `${group}.${value}`
  }
  const message = first?.message || data?.error?.message || `Google Ads API: HTTP ${status}` // i18n-ignore: detaliu tehnic (marcă + cod HTTP)
  return new GoogleAdsApiError(message, status, errorCode)
}

/** Rulează o interogare GAQL și întoarce toate rândurile (cu paginare). */
export async function search<T>(
  accessToken: string,
  customerId: string,
  query: string,
  loginCustomerId?: string | null,
): Promise<T[]> {
  const rows: T[] = []
  let pageToken: string | undefined
  do {
    const data = await request<{ results?: T[]; nextPageToken?: string }>(
      `customers/${customerId}/googleAds:search`,
      accessToken,
      { method: 'POST', body: { query, ...(pageToken ? { pageToken } : {}) }, loginCustomerId },
    )
    rows.push(...(data.results || []))
    pageToken = data.nextPageToken
  } while (pageToken)
  return rows
}

/** ID-urile conturilor la care utilizatorul are acces direct. */
export async function listAccessibleCustomers(accessToken: string): Promise<string[]> {
  const data = await request<{ resourceNames?: string[] }>('customers:listAccessibleCustomers', accessToken)
  return (data.resourceNames || []).map(normalizeCustomerId)
}

// ─── Descoperirea conturilor ──────────────────────────────────────────────────

export type DiscoveredAccount = {
  customerId: string
  loginCustomerId: string | null
  descriptiveName: string | null
  currencyCode: string | null
  timeZone: string | null
  isManager: boolean
  isTestAccount: boolean
  status: string | null
}

export const MAX_ACCOUNTS = 200

// Câmpurile comune din resursele `customer` și `customer_client` (REST, camelCase)
type CustomerFields = {
  id?: string
  descriptiveName?: string
  currencyCode?: string
  timeZone?: string
  manager?: boolean
  testAccount?: boolean
  status?: string
}

/**
 * Toate conturile Google Ads pe care utilizatorul le poate folosi:
 * conturile cu acces direct + conturile client de sub conturile manager (nivelul 1).
 * Erorile per cont sunt colectate, nu opresc descoperirea.
 */
export async function discoverAccounts(accessToken: string): Promise<{ accounts: DiscoveredAccount[]; errors: GoogleAdsApiError[] }> {
  const accounts = new Map<string, DiscoveredAccount>()
  const errors: GoogleAdsApiError[] = []

  const ids = await listAccessibleCustomers(accessToken)

  for (const id of ids) {
    if (accounts.size >= MAX_ACCOUNTS) break
    try {
      const [row] = await search<{ customer?: CustomerFields }>(accessToken, id, `
        SELECT customer.id, customer.descriptive_name, customer.currency_code,
               customer.time_zone, customer.manager, customer.test_account, customer.status
        FROM customer`)
      const c = row?.customer
      if (!c) continue

      if (!accounts.has(id)) {
        accounts.set(id, {
          customerId: id,
          loginCustomerId: null,
          descriptiveName: c.descriptiveName ?? null,
          currencyCode: c.currencyCode ?? null,
          timeZone: c.timeZone ?? null,
          isManager: !!c.manager,
          isTestAccount: !!c.testAccount,
          status: c.status ?? null,
        })
      }

      if (c.manager) {
        const children = await search<{ customerClient?: CustomerFields }>(accessToken, id, `
          SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code,
                 customer_client.time_zone, customer_client.manager, customer_client.test_account,
                 customer_client.status
          FROM customer_client
          WHERE customer_client.level = 1`, id)
        for (const r of children) {
          const cc = r.customerClient
          if (!cc?.id) continue
          const childId = String(cc.id)
          if (accounts.has(childId) || accounts.size >= MAX_ACCOUNTS) continue
          accounts.set(childId, {
            customerId: childId,
            loginCustomerId: id,
            descriptiveName: cc.descriptiveName ?? null,
            currencyCode: cc.currencyCode ?? null,
            timeZone: cc.timeZone ?? null,
            isManager: !!cc.manager,
            isTestAccount: !!cc.testAccount,
            status: cc.status ?? null,
          })
        }
      }
    } catch (err) {
      if (err instanceof GoogleAdsApiError) errors.push(err)
      else throw err
    }
  }

  return { accounts: [...accounts.values()], errors }
}
