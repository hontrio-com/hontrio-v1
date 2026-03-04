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
    credits: 150,
    price: 99,
  },
  professional: {
    name: 'Professional',
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || 'price_professional_placeholder',
    credits: 400,
    price: 249,
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_placeholder',
    credits: 1000,
    price: 499,
  },
}

// Credit pack configuration
export const CREDIT_PACKS: Record<string, {
  credits: number
  price: number
  priceInCents: number
}> = {
  pack_50:   { credits: 50,   price: 29,  priceInCents: 2900  },
  pack_100:  { credits: 100,  price: 49,  priceInCents: 4900  },
  pack_300:  { credits: 300,  price: 119, priceInCents: 11900 },
  pack_500:  { credits: 500,  price: 179, priceInCents: 17900 },
  pack_1000: { credits: 1000, price: 299, priceInCents: 29900 },
}