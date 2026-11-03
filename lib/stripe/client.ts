import Stripe from 'stripe'
import { PACKS, PAID_PLANS } from '@/lib/billing/catalog'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia' as any,
  typescript: true,
})

// Prețurile și creditele vin din lib/billing/catalog.ts. Aici se adaugă doar ce
// îi trebuie lui Stripe: Price ID-ul fiecărui abonament (din env) și suma în cenți
// a fiecărui pachet.
function stripePlan(plan: keyof typeof PAID_PLANS, priceId: string | undefined) {
  const { name, credits, priceUsd } = PAID_PLANS[plan]
  return { name, credits, price: priceUsd, priceId: priceId || `price_${plan}_placeholder` }
}

export const STRIPE_PLANS: Record<string, {
  name: string
  priceId: string
  credits: number
  price: number
}> = {
  starter: stripePlan('starter', process.env.STRIPE_STARTER_PRICE_ID),
  professional: stripePlan('professional', process.env.STRIPE_PROFESSIONAL_PRICE_ID),
  enterprise: stripePlan('enterprise', process.env.STRIPE_ENTERPRISE_PRICE_ID),
}

// Pachetele de credite, cu prețul în USD și în cenți (cât se încasează)
export const CREDIT_PACKS: Record<string, {
  credits: number
  price: number
  priceInCents: number
}> = Object.fromEntries(
  Object.entries(PACKS).map(([id, p]) => [id, { credits: p.credits, price: p.priceUsd, priceInCents: Math.round(p.priceUsd * 100) }]),
)