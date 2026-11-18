// =============================================
// SmartBill Cloud (API V1): factura lunară Hontrio, starea plății și seriile.
// Specificația: https://api.smartbill.ro/smartbill-api-spec.yaml
//
// Autentificarea: Basic, `email:token` (SmartBill Cloud → Integrări → API).
// Limita: 30 de apeluri la 10 secunde pe token; peste ea, accesul se blochează
// 10 minute, deci apelurile merg unul câte unul. VOID SFT GAMES SRL nu este
// plătitoare de TVA, așa că produsul de pe factură nu are câmpuri de TVA.
// Linkul „Plătește cu cardul” îl generează SmartBill, prin procesatorul
// conectat în contul lui (Netopia, euPlatesc sau Stripe).
// =============================================

const BASE = 'https://ws.smartbill.ro/SBORO/api'

export type SmartBillConfig = {
  username: string
  token: string
  /** CIF-ul firmei emitente, exact ca în SmartBill Cloud. */
  cif: string
  /** Seria facturilor, exact ca în SmartBill Cloud. */
  series: string
  /** Unitatea de măsură, exact ca în cont (implicit „buc”). */
  unit: string
  /** Butonul „Plătește cu cardul” pe factură. */
  cardLink: boolean
}

/** Configurarea din mediu; null = SmartBill nelegat (facturile nu se pot emite). */
export function smartBillConfig(env: Record<string, string | undefined> = process.env): SmartBillConfig | null {
  const username = env.SMARTBILL_USERNAME?.trim()
  const token = env.SMARTBILL_TOKEN?.trim()
  const cif = env.SMARTBILL_CIF?.trim()
  const series = env.SMARTBILL_SERIES?.trim()
  if (!username || !token || !cif || !series) return null
  return { username, token, cif, series, unit: env.SMARTBILL_UNIT?.trim() || 'buc', cardLink: env.SMARTBILL_CARD_LINK?.trim() !== 'false' }
}

export class SmartBillError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'SmartBillError'
  }
}

/** Mesajul de eroare SmartBill, curat: prima propoziție din `errorText` (poate avea HTML) sau `errors[].message`. */
export function smartBillErrorText(body: unknown): string | null {
  const b = body as { errorText?: unknown; errors?: { message?: unknown; param?: unknown }[] } | null
  const text = typeof b?.errorText === 'string' ? b.errorText.split('<')[0].trim() : ''
  if (text) return text.slice(0, 300)
  const first = Array.isArray(b?.errors) ? b!.errors[0] : undefined
  if (first && typeof first.message === 'string') return `${first.message}${typeof first.param === 'string' ? ` (${first.param})` : ''}`.slice(0, 300)
  return null
}

async function call<T>(cfg: SmartBillConfig, method: 'GET' | 'POST' | 'PUT', path: string, opts: { query?: Record<string, string>; body?: unknown } = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v)
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.username}:${cfg.token}`).toString('base64')}`,
      Accept: 'application/json',
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  })
  const body = await res.json().catch(() => null)
  const error = smartBillErrorText(body)
  if (!res.ok || error) throw new SmartBillError(error ?? `HTTP ${res.status}`, res.status)
  return body as T
}

// ─── Factura ─────────────────────────────────────────────────────────────────

export type InvoiceClient = {
  name: string
  vat_code: string
  reg_com: string | null
  is_vat_payer: boolean
  address: string
  city: string
  county: string | null
  /** Codul țării, ISO (ex. „RO”). */
  country: string
  email: string
}

export type InvoiceInput = {
  client: InvoiceClient
  currency: 'RON' | 'EUR'
  amount: number
  issueDate: string
  dueDate: string
  /** Denumirea serviciului pe factură (luna și magazinul). */
  line: string
  /** Mențiunile de pe factură (comenzile numărate, creditul). */
  mentions: string
}

/** Codul fiscal pe factură: „RO” + CUI pentru plătitorii români de TVA, CUI-ul simplu altfel; codul străin, cum e. */
export function clientVatCode(c: Pick<InvoiceClient, 'vat_code' | 'is_vat_payer' | 'country'>): string {
  const code = c.vat_code.trim().toUpperCase().replace(/\s+/g, '')
  if (c.country.toUpperCase() !== 'RO') return code
  const digits = code.replace(/^RO/, '')
  return c.is_vat_payer ? `RO${digits}` : digits
}

/** Corpul cererii de emitere (POST /invoice/v2). Fără câmpuri de TVA: emitentul nu e plătitor. */
export function invoicePayload(cfg: SmartBillConfig, inv: InvoiceInput): Record<string, unknown> {
  const ro = inv.client.country.toUpperCase() === 'RO'
  return {
    companyVatCode: cfg.cif,
    seriesName: cfg.series,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    currency: inv.currency,
    language: ro ? 'RO' : 'EN',
    client: {
      name: inv.client.name,
      vatCode: clientVatCode(inv.client),
      ...(inv.client.reg_com ? { regCom: inv.client.reg_com } : {}),
      isTaxPayer: inv.client.is_vat_payer,
      address: inv.client.address,
      city: inv.client.city,
      ...(inv.client.county ? { county: inv.client.county } : {}),
      country: inv.client.country.toUpperCase(),
      email: inv.client.email,
      saveToDb: false,
    },
    products: [{
      name: inv.line,
      code: 'HONTRIO',
      isService: true,
      quantity: 1,
      price: inv.amount,
      measuringUnitName: cfg.unit,
      currency: inv.currency,
      saveToDb: false,
    }],
    mentions: inv.mentions,
    ...(cfg.cardLink ? { paymentUrl: 'Generate URL' } : {}),
    sendEmail: false,
  }
}

export type IssuedInvoice = { series: string; number: string; viewUrl: string | null; payUrl: string | null }

/** Emite factura. O eroare SmartBill aruncă SmartBillError cu mesajul ei. */
export async function createInvoice(cfg: SmartBillConfig, inv: InvoiceInput): Promise<IssuedInvoice> {
  const r = await call<{ number?: string; series?: string; url?: string; documentViewUrl?: string }>(cfg, 'POST', '/invoice/v2', { body: invoicePayload(cfg, inv) })
  if (!r.number || !r.series) throw new SmartBillError('Factura nu are număr', 502) // i18n-ignore (jurnal)
  return { series: r.series, number: r.number, viewUrl: r.documentViewUrl || null, payUrl: r.url || null }
}

export type PaymentStatus = { paid: boolean; paidAmount: number; unpaidAmount: number; total: number }

/** Cât s-a încasat dintr-o factură (din SmartBill, unde se văd și transferurile, și plățile cu cardul). */
export async function paymentStatus(cfg: SmartBillConfig, series: string, number: string): Promise<PaymentStatus> {
  const r = await call<{ paid?: boolean; paidAmount?: number; unpaidAmount?: number; invoiceTotalAmount?: number }>(
    cfg, 'GET', '/invoice/paymentstatus', { query: { cif: cfg.cif, seriesname: series, number } },
  )
  return { paid: !!r.paid, paidAmount: Number(r.paidAmount) || 0, unpaidAmount: Number(r.unpaidAmount) || 0, total: Number(r.invoiceTotalAmount) || 0 }
}

/** Seriile de facturi din cont (verificarea configurării, în administrare). */
export async function invoiceSeries(cfg: SmartBillConfig): Promise<string[]> {
  const r = await call<{ list?: { name?: string }[] }>(cfg, 'GET', '/series', { query: { cif: cfg.cif, type: 'f' } })
  return (r.list ?? []).map(s => s.name).filter((x): x is string => !!x)
}
