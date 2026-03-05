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
  refusalProbability: number
  refusalProbabilityReason: string
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
  daysSinceLastRefusal?: number
  avgOrderValue?: number
  previousOrderValues?: number[]
  uniquePhoneCount?: number
  lastOrderStatus?: string
  refusalStreak?: number
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
  billingCity?: string
  shippingCity?: string
  phonePrefix?: string
  productCount?: number
  isFirstOrderAfterRefusal?: boolean
  minutesSinceRegistration?: number
  shippingDifferentFromBilling?: boolean
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
  ml_weights?: MLWeights
}

export type MLWeights = {
  w_collection_rate: number
  w_refusals: number
  w_cancellations: number
  w_not_home: number
  w_night_orders: number
  w_high_value_cod: number
  w_new_account: number
  w_temp_email: number
  w_address_changes: number
  total_predictions: number
  correct_predictions: number
  last_trained_at: string | null
}

export const DEFAULT_ML_WEIGHTS: MLWeights = {
  w_collection_rate: 1.0, w_refusals: 1.0, w_cancellations: 1.0,
  w_not_home: 1.0, w_night_orders: 1.0, w_high_value_cod: 1.0,
  w_new_account: 1.0, w_temp_email: 1.0, w_address_changes: 1.0,
  total_predictions: 0, correct_predictions: 0, last_trained_at: null,
}

const DEFAULT_RULES: StoreRules = {
  max_orders_per_day: 3, min_collection_rate_pct: 50,
  flag_night_orders: true, flag_temp_email: true, flag_new_account_days: 7,
  flag_high_value_cod_ron: 500, score_watch_threshold: 41,
  score_problematic_threshold: 61, score_blocked_threshold: 81,
}

const TEMP_EMAIL_DOMAINS = [
  'mailinator.com','yopmail.com','guerrillamail.com','tempmail.com','throwam.com',
  'sharklasers.com','guerrillamailblock.com','grr.la','spam4.me','trashmail.com',
  'dispostable.com','maildrop.cc','fakeinbox.com','getairmail.com','spamgourmet.com',
  'trashmail.at','10minutemail.com','tempinbox.com','trashmail.io','discard.email',
]

const RANDOM_DIGITS_EMAIL_RE = /[a-z]+\.[a-z]+\d{4,}@/i

const INCOMPLETE_ADDRESS_PATTERNS = [
  /^strada\s+(mare|mica|noua|veche|principala)$/i,
  /^acas[aă]$/i,
  /^str\s*\.?\s*\d+$/i,
  /^nr\s*\.\s*\d+$/i,
  /^\d+\s*,?\s*\d*$/,
]

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max)
}

export function calculateRiskScore(
  history: CustomerHistory,
  order: OrderContext,
  rules: Partial<StoreRules> = {}
): RiskScoreResult {
  const r = { ...DEFAULT_RULES, ...rules }
  const w = rules.ml_weights || DEFAULT_ML_WEIGHTS
  const flags: RiskFlag[] = []
  let score = 0

  // ── 1. COMPORTAMENT ISTORIC ──────────────────────────────────────────────
  if (history.totalOrders >= 3) {
    const collectionRate = (history.ordersCollected / history.totalOrders) * 100
    if (collectionRate < r.min_collection_rate_pct) {
      const basePts = collectionRate < 20 ? 40 : collectionRate < 35 ? 30 : 20
      const pts = Math.round(basePts * w.w_collection_rate)
      flags.push({ code: 'low_collection_rate', label: `Rată ridicare scăzută: ${collectionRate.toFixed(0)}%`, points: pts, severity: pts >= 30 ? 'high' : 'medium' })
      score += pts
    }
  }

  if (history.ordersRefused >= 2) {
    const basePts = Math.min(history.ordersRefused * 10, 30)
    const pts = Math.round(basePts * w.w_refusals)
    flags.push({ code: 'multiple_refusals', label: `${history.ordersRefused} colete refuzate anterior`, points: pts, severity: history.ordersRefused >= 3 ? 'high' : 'medium' })
    score += pts
  }

  if ((history.refusalStreak || 0) >= 2) {
    const pts = Math.min((history.refusalStreak!) * 12, 36)
    flags.push({ code: 'refusal_streak', label: `${history.refusalStreak} refuzuri consecutive`, points: pts, severity: 'high' })
    score += pts
  }

  if (order.isFirstOrderAfterRefusal && (history.daysSinceLastRefusal || 999) < 3) {
    flags.push({ code: 'reorder_after_refusal', label: `Comandă la ${history.daysSinceLastRefusal}z după un refuz`, points: 20, severity: 'high' })
    score += 20
  }

  if (history.ordersCancelled >= 2) {
    const basePts = Math.min(history.ordersCancelled * 8, 24)
    const pts = Math.round(basePts * w.w_cancellations)
    flags.push({ code: 'multiple_cancellations', label: `${history.ordersCancelled} comenzi anulate anterior`, points: pts, severity: 'medium' })
    score += pts
  }

  if (history.ordersNotHome >= 3) {
    const basePts = Math.min(history.ordersNotHome * 5, 20)
    const pts = Math.round(basePts * w.w_not_home)
    flags.push({ code: 'frequently_not_home', label: `${history.ordersNotHome} livrări eșuate (nu era acasă)`, points: pts, severity: 'low' })
    score += pts
  }

  // ── 2. COMPORTAMENT COMANDĂ CURENTĂ ─────────────────────────────────────
  if (history.ordersToday >= r.max_orders_per_day) {
    const pts = history.ordersToday >= 6 ? 30 : history.ordersToday >= 4 ? 20 : 15
    flags.push({ code: 'multiple_orders_today', label: `${history.ordersToday} comenzi în aceeași zi`, points: pts, severity: history.ordersToday >= 6 ? 'high' : 'medium' })
    score += pts
  }

  if (r.flag_night_orders) {
    const hour = new Date(order.orderedAt).getHours()
    if (hour >= 0 && hour < 6) {
      const pts = Math.round(5 * w.w_night_orders)
      flags.push({ code: 'night_order', label: 'Comandă plasată noaptea (00:00–06:00)', points: pts, severity: 'low' })
      score += pts
    }
  }

  // ── 3. DATE CLIENT ────────────────────────────────────────────────────────
  if (r.flag_temp_email && order.customerEmail) {
    const domain = order.customerEmail.split('@')[1]?.toLowerCase()
    if (domain && TEMP_EMAIL_DOMAINS.includes(domain)) {
      const pts = Math.round(20 * w.w_temp_email)
      flags.push({ code: 'temp_email', label: `Email temporar detectat: ${domain}`, points: pts, severity: 'high' })
      score += pts
    }
  }

  if (order.customerEmail && RANDOM_DIGITS_EMAIL_RE.test(order.customerEmail)) {
    flags.push({ code: 'random_digits_email', label: `Email cu pattern suspect: ${order.customerEmail.split('@')[0]}`, points: 8, severity: 'low' })
    score += 8
  }

  if (history.isNewAccount && r.flag_new_account_days > 0) {
    const pts = Math.round(10 * w.w_new_account)
    flags.push({ code: 'new_account', label: `Cont nou (sub ${r.flag_new_account_days} zile)`, points: pts, severity: 'low' })
    score += pts
  }

  if ((order.minutesSinceRegistration !== undefined) && order.minutesSinceRegistration < 10) {
    flags.push({ code: 'instant_order_after_registration', label: `Comandă la ${order.minutesSinceRegistration} min după înregistrare`, points: 15, severity: 'medium' })
    score += 15
  }

  if (!history.phoneValidated) {
    flags.push({ code: 'unvalidated_phone', label: 'Număr de telefon nevalidat', points: 8, severity: 'low' })
    score += 8
  }

  if (history.addressChanges >= 3) {
    const basePts = Math.min(history.addressChanges * 5, 20)
    const pts = Math.round(basePts * w.w_address_changes)
    flags.push({ code: 'address_changes', label: `${history.addressChanges} adrese de livrare diferite`, points: pts, severity: 'medium' })
    score += pts
  }

  if (order.shippingAddress) {
    const addrLower = order.shippingAddress.toLowerCase().trim()
    const isIncomplete = INCOMPLETE_ADDRESS_PATTERNS.some(p => p.test(addrLower)) ||
      addrLower.length < 8 || !/\d/.test(addrLower)
    if (isIncomplete) {
      flags.push({ code: 'incomplete_address', label: 'Adresă de livrare incompletă sau suspectă', points: 12, severity: 'medium' })
      score += 12
    }
  }

  if (order.shippingDifferentFromBilling && order.paymentMethod === 'card') {
    flags.push({ code: 'billing_shipping_mismatch', label: 'Adresă billing diferită de livrare (card)', points: 15, severity: 'medium' })
    score += 15
  }

  if ((history.uniquePhoneCount || 1) >= 3) {
    const pts = Math.min(((history.uniquePhoneCount || 1) - 2) * 10, 25)
    flags.push({ code: 'multiple_identities', label: `${history.uniquePhoneCount} identități diferite detectate`, points: pts, severity: 'high' })
    score += pts
  }

  // ── 4. VALOARE COMANDĂ ───────────────────────────────────────────────────
  if (order.paymentMethod === 'cod' && order.totalValue >= r.flag_high_value_cod_ron) {
    const basePts = order.totalValue >= 1000 ? 20 : order.totalValue >= 750 ? 15 : 10
    const pts = Math.round(basePts * w.w_high_value_cod)
    flags.push({ code: 'high_value_cod', label: `COD valoare mare: ${order.totalValue} ${order.currency}`, points: pts, severity: order.totalValue >= 1000 ? 'high' : 'medium' })
    score += pts
  }

  if (history.avgOrderValue && history.totalOrders >= 3) {
    const ratio = order.totalValue / history.avgOrderValue
    if (ratio >= 3 && order.totalValue > 200) {
      flags.push({ code: 'value_spike', label: `Valoare de ${ratio.toFixed(1)}x față de medie (${history.avgOrderValue.toFixed(0)} RON)`, points: 10, severity: 'medium' })
      score += 10
    }
  }

  // ── 5. BLACKLIST GLOBAL ───────────────────────────────────────────────────
  if (order.inGlobalBlacklist) {
    const pts = order.globalReportCount >= 4 ? 40 : order.globalReportCount >= 2 ? 25 : 15
    flags.push({ code: 'global_blacklist', label: `Raportat de ${order.globalReportCount} magazine diferite`, points: pts, severity: order.globalReportCount >= 4 ? 'high' : 'medium' })
    score += pts
  }

  // ── 6. PRIMA COMANDĂ ─────────────────────────────────────────────────────
  if (history.totalOrders === 0) {
    flags.push({ code: 'first_order', label: 'Prima comandă — fără istoric', points: 5, severity: 'low' })
    score += 5
  }

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

  const { probability, reason } = calculateRefusalProbability(history, order, score)
  return { score, label, flags, recommendation, refusalProbability: probability, refusalProbabilityReason: reason }
}

function calculateRefusalProbability(
  history: CustomerHistory,
  order: OrderContext,
  riskScore: number
): { probability: number; reason: string } {
  let prob = riskScore * 0.5
  const reasons: string[] = []

  if (history.totalOrders >= 3) {
    const refusalRate = ((history.ordersRefused + history.ordersNotHome) / history.totalOrders) * 100
    prob += refusalRate * 0.4
    if (refusalRate > 50) reasons.push(`${refusalRate.toFixed(0)}% rată refuz istorică`)
  }

  if ((history.daysSinceLastRefusal || 999) < 14) {
    prob += 15
    reasons.push(`refuz în urmă cu ${history.daysSinceLastRefusal} zile`)
  }

  if (order.isFirstOrderAfterRefusal) {
    prob += 20
    reasons.push('comandă după refuz anterior')
  }

  if (order.paymentMethod === 'cod' && order.totalValue > 500) {
    prob += 10
    reasons.push(`COD ${order.totalValue} RON`)
  }

  if (history.totalOrders === 0) prob = Math.max(prob, 15)

  prob = Math.min(Math.max(Math.round(prob), 0), 99)
  const reason = reasons.length > 0
    ? `Bazat pe: ${reasons.join(', ')}`
    : prob < 20 ? 'Client cu comportament bun' : 'Bazat pe scorul de risc calculat'

  return { probability: prob, reason }
}

export function recalibrateWeights(
  currentWeights: MLWeights,
  predictedLabel: string,
  actualOutcome: 'collected' | 'refused' | 'returned' | 'not_home' | 'cancelled',
  flagsActivated: string[]
): MLWeights {
  const w = { ...currentWeights }
  const wasCorrect =
    (actualOutcome === 'collected' && ['trusted', 'new'].includes(predictedLabel)) ||
    (['refused', 'returned', 'not_home'].includes(actualOutcome) && ['problematic', 'blocked', 'watch'].includes(predictedLabel))

  w.total_predictions++
  if (wasCorrect) w.correct_predictions++

  if (!wasCorrect && w.total_predictions >= 10) {
    const adj = actualOutcome === 'collected' ? -0.05 : +0.05
    if (flagsActivated.includes('low_collection_rate')) w.w_collection_rate = clamp(w.w_collection_rate + adj, 0.3, 2.0)
    if (flagsActivated.includes('multiple_refusals')) w.w_refusals = clamp(w.w_refusals + adj, 0.3, 2.0)
    if (flagsActivated.includes('multiple_cancellations')) w.w_cancellations = clamp(w.w_cancellations + adj, 0.3, 2.0)
    if (flagsActivated.includes('frequently_not_home')) w.w_not_home = clamp(w.w_not_home + adj, 0.3, 2.0)
    if (flagsActivated.includes('night_order')) w.w_night_orders = clamp(w.w_night_orders + adj, 0.3, 2.0)
    if (flagsActivated.includes('high_value_cod')) w.w_high_value_cod = clamp(w.w_high_value_cod + adj, 0.3, 2.0)
    if (flagsActivated.includes('new_account')) w.w_new_account = clamp(w.w_new_account + adj, 0.3, 2.0)
    if (flagsActivated.includes('temp_email')) w.w_temp_email = clamp(w.w_temp_email + adj, 0.3, 2.0)
    if (flagsActivated.includes('address_changes')) w.w_address_changes = clamp(w.w_address_changes + adj, 0.3, 2.0)
  }

  w.last_trained_at = new Date().toISOString()
  return w
}

export function hashIdentifier(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex')
}

export const LABEL_CONFIG = {
  trusted:     { label: 'Trusted',      bg: 'bg-gray-100',  text: 'text-gray-600',  dot: 'bg-gray-400'  },
  new:         { label: 'Nou',          bg: 'bg-gray-100',  text: 'text-gray-500',  dot: 'bg-gray-300'  },
  watch:       { label: 'Watch',        bg: 'bg-gray-200',  text: 'text-gray-700',  dot: 'bg-gray-500'  },
  problematic: { label: 'Problematic',  bg: 'bg-gray-800',  text: 'text-white',     dot: 'bg-gray-300'  },
  blocked:     { label: 'Blocat',       bg: 'bg-gray-900',  text: 'text-white',     dot: 'bg-white'     },
} as const

export type FinancialLoss = {
  productLoss: number
  shippingLoss: number
  returnShippingLoss: number
  repackagingLoss: number
  totalLoss: number
  currency: string
}

export function calculateFinancialLoss(
  refusedOrders: Array<{ total_value: number; currency: string }>,
  shippingCostPerOrder = 15,
  returnShippingCost = 12,
  repackagingCostPct = 0.05
): FinancialLoss {
  let productLoss = 0, shippingLoss = 0, returnShippingLoss = 0, repackagingLoss = 0
  for (const order of refusedOrders) {
    productLoss += order.total_value
    shippingLoss += shippingCostPerOrder
    returnShippingLoss += returnShippingCost
    repackagingLoss += order.total_value * repackagingCostPct
  }
  return {
    productLoss: Math.round(productLoss),
    shippingLoss: Math.round(shippingLoss),
    returnShippingLoss: Math.round(returnShippingLoss),
    repackagingLoss: Math.round(repackagingLoss),
    totalLoss: Math.round(productLoss + shippingLoss + returnShippingLoss + repackagingLoss),
    currency: refusedOrders[0]?.currency || 'RON',
  }
}