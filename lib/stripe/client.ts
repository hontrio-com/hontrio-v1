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
    credits: 250,
    price: 99,
  },
  professional: {
    name: 'Professional',
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || 'price_professional_placeholder',
    credits: 750,
    price: 249,
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_placeholder',
    credits: 2000,
    price: 499,
  },
}

// Credit pack configuration
export const CREDIT_PACKS: Record<string, {
  credits: number
  price: number
  priceInCents: number
}> = {
  pack_50:   { credits: 50,   price: 39,  priceInCents: 3900  },
  pack_100:  { credits: 100,  price: 69,  priceInCents: 6900  },
  pack_300:  { credits: 300,  price: 159, priceInCents: 15900 },
  pack_500:  { credits: 500,  price: 249, priceInCents: 24900 },
  pack_1000: { credits: 1000, price: 399, priceInCents: 39900 },
}