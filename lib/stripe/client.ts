import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia' as any,
  typescript: true,
})

// Plan configuration - Update these with your actual Stripe Price IDs
export const STRIPE_PLANS: Record<string, {
  name: string
  priceId: string
  credits: number
  price: number
}> = {
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter_placeholder',
    credits: 200,
    price: 49,
  },
  professional: {
    name: 'Professional',
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || 'price_professional_placeholder',
    credits: 500,
    price: 99,
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_placeholder',
    credits: 2000,
    price: 249,
  },
}

// Credit pack configuration
export const CREDIT_PACKS: Record<string, {
  credits: number
  price: number
  priceInCents: number
}> = {
  pack_50: { credits: 50, price: 15, priceInCents: 1500 },
  pack_100: { credits: 100, price: 25, priceInCents: 2500 },
  pack_250: { credits: 250, price: 50, priceInCents: 5000 },
  pack_500: { credits: 500, price: 85, priceInCents: 8500 },
  pack_1000: { credits: 1000, price: 150, priceInCents: 15000 },
}