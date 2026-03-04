import crypto from 'crypto'

export type RiskFlag = {
  code: string
  label: string
  points: number
  severity: 'low' | 'medium' | 'high'
}

export type RiskScoreResult = {
  score: number
  label: 'trusted' | 'new' | 'watch' | 'problematic' | 'blocked'
  flags: RiskFlag[]
  recommendation: string
}

export type CustomerHistory = {
  totalOrders: number
  ordersCollected: number
  ordersRefused: number
  ordersNotHome: number
  ordersCancelled: number
  ordersToday: number
  lastOrderAt: string | null
  firstOrderAt: string | null
  accountCreatedAt: string | null
  phoneValidated: boolean
  isNewAccount: boolean
  addressChanges: number
}

export type OrderContext = {
  paymentMethod: 'cod' | 'card' | 'bank_transfer'
  totalValue: number
  currency: string
  orderedAt: string
  customerEmail: string
  shippingAddress: string
  inGlobalBlacklist: boolean
  globalReportCount: number
}

export type StoreRules = {
  max_orders_per_day: number
  min_collection_rate_pct: number
  flag_night_orders: boolean
  flag_temp_email: boolean
  flag_new_account_days: number
  flag_high_value_cod_ron: number
  score_watch_threshold: number
  score_problematic_threshold: number
  score_blocked_threshold: number
}

const DEFAULT_RULES: StoreRules = {
  max_orders_per_day: 3,
  min_collection_rate_pct: 50,
  flag_night_orders: true,
  flag_temp_email: true,
  flag_new_account_days: 7,
  flag_high_value_cod_ron: 500,
  score_watch_threshold: 41,
  score_problematic_threshold: 61,
  score_blocked_threshold: 81,
}

const TEMP_EMAIL_DOMAINS = [
  'mailinator.com', 'yopmail.com', 'guerrillamail.com', 'tempmail.com',
  'throwam.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'spam4.me', 'trashmail.com', 'dispostable.com', 'maildrop.cc',
  'fakeinbox.com', 'getairmail.com', 'spamgourmet.com', 'trashmail.at',
]

export function calculateRiskScore(
  history: CustomerHistory,
  order: OrderContext,
  rules: Partial<StoreRules> = {}
): RiskScoreResult {
  const r = { ...DEFAULT_RULES, ...rules }
  const flags: RiskFlag[] = []
  let score = 0

  // ─── 1. COMPORTAMENT ISTORIC ───────────────────────────────

  if (history.totalOrders >= 3) {
    const collectionRate = history.totalOrders > 0
      ? (history.ordersCollected / history.totalOrders) * 100
      : 100

    if (collectionRate < r.min_collection_rate_pct) {
      const pts = collectionRate < 20 ? 40 : collectionRate < 35 ? 30 : 20
      flags.push({
        code: 'low_collection_rate',
        label: `Rată ridicare scăzută: ${collectionRate.toFixed(0)}%`,
        points: pts,
        severity: pts >= 30 ? 'high' : 'medium',
      })
      score += pts
    }
  }

  if (history.ordersRefused >= 2) {
    const pts = Math.min(history.ordersRefused * 10, 30)
    flags.push({
      code: 'multiple_refusals',
      label: `${history.ordersRefused} colete refuzate anterior`,
      points: pts,
      severity: history.ordersRefused >= 3 ? 'high' : 'medium',
    })
    score += pts
  }

  if (history.ordersCancelled >= 2) {
    const pts = Math.min(history.ordersCancelled * 8, 24)
    flags.push({
      code: 'multiple_cancellations',
      label: `${history.ordersCancelled} comenzi anulate anterior`,
      points: pts,
      severity: 'medium',
    })
    score += pts
  }

  if (history.ordersNotHome >= 3) {
    const pts = Math.min(history.ordersNotHome * 5, 20)
    flags.push({
      code: 'frequently_not_home',
      label: `${history.ordersNotHome} livrări eșuate (nu era acasă)`,
      points: pts,
      severity: 'low',
    })
    score += pts
  }

  // ─── 2. COMPORTAMENT COMANDĂ CURENTĂ ──────────────────────

  if (history.ordersToday >= r.max_orders_per_day) {
    const pts = history.ordersToday >= 6 ? 30 : history.ordersToday >= 4 ? 20 : 15
    flags.push({
      code: 'multiple_orders_today',
      label: `${history.ordersToday} comenzi în aceeași zi`,
      points: pts,
      severity: history.ordersToday >= 6 ? 'high' : 'medium',
    })
    score += pts
  }

  if (r.flag_night_orders) {
    const hour = new Date(order.orderedAt).getHours()
    if (hour >= 0 && hour < 6) {
      flags.push({
        code: 'night_order',
        label: 'Comandă plasată noaptea (00:00–06:00)',
        points: 5,
        severity: 'low',
      })
      score += 5
    }
  }

  // ─── 3. DATE CLIENT ────────────────────────────────────────

  if (r.flag_temp_email && order.customerEmail) {
    const domain = order.customerEmail.split('@')[1]?.toLowerCase()
    if (domain && TEMP_EMAIL_DOMAINS.includes(domain)) {
      flags.push({
        code: 'temp_email',
        label: `Email temporar detectat: ${domain}`,
        points: 20,
        severity: 'high',
      })
      score += 20
    }
  }

  if (history.isNewAccount && r.flag_new_account_days > 0) {
    const pts = 10
    flags.push({
      code: 'new_account',
      label: `Cont nou (sub ${r.flag_new_account_days} zile)`,
      points: pts,
      severity: 'low',
    })
    score += pts
  }

  if (!history.phoneValidated) {
    flags.push({
      code: 'unvalidated_phone',
      label: 'Număr de telefon nevalidat',
      points: 8,
      severity: 'low',
    })
    score += 8
  }

  if (history.addressChanges >= 3) {
    const pts = Math.min(history.addressChanges * 5, 20)
    flags.push({
      code: 'address_changes',
      label: `${history.addressChanges} adrese de livrare diferite`,
      points: pts,
      severity: 'medium',
    })
    score += pts
  }

  // ─── 4. VALOARE COMANDĂ ───────────────────────────────────

  if (order.paymentMethod === 'cod' && order.totalValue >= r.flag_high_value_cod_ron) {
    const pts = order.totalValue >= 1000 ? 20 : order.totalValue >= 750 ? 15 : 10
    flags.push({
      code: 'high_value_cod',
      label: `COD valoare mare: ${order.totalValue} ${order.currency}`,
      points: pts,
      severity: order.totalValue >= 1000 ? 'high' : 'medium',
    })
    score += pts
  }

  // ─── 5. BLACKLIST GLOBAL ──────────────────────────────────

  if (order.inGlobalBlacklist) {
    const pts = order.globalReportCount >= 4 ? 40 : order.globalReportCount >= 2 ? 25 : 15
    flags.push({
      code: 'global_blacklist',
      label: `Raportat de ${order.globalReportCount} magazine diferite`,
      points: pts,
      severity: order.globalReportCount >= 4 ? 'high' : 'medium',
    })
    score += pts
  }

  // ─── 6. PRIMUL CLIENT (no history) ────────────────────────
  if (history.totalOrders === 0) {
    flags.push({
      code: 'first_order',
      label: 'Prima comandă — fără istoric',
      points: 5,
      severity: 'low',
    })
    score += 5
  }

  // ─── CLAMP & LABEL ────────────────────────────────────────
  score = Math.min(Math.max(score, 0), 100)

  let label: RiskScoreResult['label']
  let recommendation: string

  if (score >= r.score_blocked_threshold) {
    label = 'blocked'
    recommendation = 'Blochează comanda. Solicită plată în avans sau refuză expedierea.'
  } else if (score >= r.score_problematic_threshold) {
    label = 'problematic'
    recommendation = 'Pune comanda în hold. Sună clientul înainte de expediere pentru confirmare.'
  } else if (score >= r.score_watch_threshold) {
    label = 'watch'
    recommendation = 'Monitorizează clientul. Verifică manual istoricul înainte de expediere.'
  } else if (history.totalOrders === 0) {
    label = 'new'
    recommendation = 'Client nou. Procesează normal, monitorizează prima comandă.'
  } else {
    label = 'trusted'
    recommendation = 'Client de încredere. Procesează normal.'
  }

  return { score, label, flags, recommendation }
}

// ─── HASH pentru blacklist global ────────────────────────────
export function hashIdentifier(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value.toLowerCase().trim())
    .digest('hex')
}

// ─── Label display helpers ────────────────────────────────────
export const LABEL_CONFIG = {
  trusted:     { label: 'Trusted',      bg: 'bg-gray-100',  text: 'text-gray-600',  dot: 'bg-gray-400'  },
  new:         { label: 'Nou',          bg: 'bg-gray-100',  text: 'text-gray-500',  dot: 'bg-gray-300'  },
  watch:       { label: 'Watch',        bg: 'bg-gray-200',  text: 'text-gray-700',  dot: 'bg-gray-500'  },
  problematic: { label: 'Problematic',  bg: 'bg-gray-800',  text: 'text-white',     dot: 'bg-gray-300'  },
  blocked:     { label: 'Blocat',       bg: 'bg-gray-900',  text: 'text-white',     dot: 'bg-white'     },
} as const