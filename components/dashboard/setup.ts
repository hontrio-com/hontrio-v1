import { Calculator, Megaphone, Rocket, ScanBarcode, Store, type LucideIcon } from 'lucide-react'
import type { BlockerId, Plan } from '@/lib/campaigns/plan'

// =============================================
// Drumul până la prima campanie, în cinci pași, citit din planul campaniei
// (`plan.blockers`): aceeași sursă pentru antetul Dashboard-ului (harta cu
// razele) și pentru panoul cu pași. Lansarea e mereu ultima: pasul de acum e
// primul de pregătire neterminat, altfel lansarea.
// =============================================

export type StepId = 'store' | 'google' | 'tracking' | 'costs' | 'launch'
export type StepState = 'done' | 'current' | 'next'
export type Blocker = Plan['blockers'][number]

export const STEPS: { id: StepId; icon: LucideIcon; blockers: readonly BlockerId[] }[] = [
  { id: 'store', icon: Store, blockers: ['store'] },
  { id: 'google', icon: Megaphone, blockers: ['google_ads', 'ads_account', 'currency', 'account_manager'] },
  {
    id: 'tracking', icon: ScanBarcode,
    blockers: ['merchant', 'merchant_not_linked', 'merchant_other', 'merchant_choose', 'conversion', 'purchase_missing', 'purchase_not_primary', 'purchase_no_value'],
  },
  { id: 'costs', icon: Calculator, blockers: ['costs', 'no_offers', 'too_many_exclusions'] },
  { id: 'launch', icon: Rocket, blockers: ['audit'] },
]

/** Pașii pe care îi spune auditul contului: după reparație, verificarea se reface ca să se vadă. */
export const FROM_AUDIT: readonly BlockerId[] = ['account_manager', 'merchant_not_linked', 'merchant_other', 'merchant_choose', 'purchase_missing', 'purchase_not_primary', 'purchase_no_value']

export type SetupStep = { id: StepId; icon: LucideIcon; open: Blocker[]; state: StepState; index: number }

export type Setup = {
  steps: SetupStep[]
  current: StepId
  /** Primul pas de pregătire neterminat; null = se poate lansa. */
  blocking: StepId | null
  done: number
  total: number
  left: number
}

export function setupOf(plan: Plan): Setup {
  const open = STEPS.map(s => ({ ...s, open: plan.blockers.filter(b => s.blockers.includes(b.id)) }))
  const blocking = open.find(s => s.id !== 'launch' && s.open.length > 0)?.id ?? null
  const current: StepId = blocking ?? 'launch'
  const done = open.filter(s => s.id !== 'launch' && !s.open.length).length
  const steps = open.map((s, index) => ({
    ...s, index,
    state: (s.id === current ? 'current' : s.id !== 'launch' && !s.open.length ? 'done' : 'next') as StepState,
  }))
  return { steps, current, blocking, done, total: STEPS.length, left: STEPS.length - done }
}

/** Textul unui pas care lipsește, din dicționarul paginii Campanii (aceleași cuvinte în ambele locuri). */
export function blockerText(t: ((key: string, params?: Record<string, string | number>) => string) & { has: (key: string) => boolean }, b: Blocker): string {
  const params = Object.fromEntries(Object.entries(b.params ?? {}).map(([k, v]) => [k, String(v)]))
  const step = `${b.id}${b.variant ? `_${b.variant}` : ''}`
  return t.has(`campaigns.blocker_${step}`) ? t(`campaigns.blocker_${step}`, params)
    : t.has(`campaigns.blocker_${b.id}`) ? t(`campaigns.blocker_${b.id}`, params) : t('campaigns.blocker_generic')
}

/** 1234567890 → 123-456-7890, cum îl arată Google Ads. */
export function customerId(id: string): string {
  return id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id
}
