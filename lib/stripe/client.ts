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
    price: 19,
  },
  professional: {
    name: 'Professional',
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || 'price_professional_placeholder',
    credits: 400,
    price: 49,
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_placeholder',
    credits: 900,
    price: 99,
  },
}

// Credit pack configuration — prices in USD cents
export const CREDIT_PACKS: Record<string, {
  credits: number
  price: number
  priceInCents: number
}> = {
  pack_50:   { credits: 50,   price: 9,  priceInCents: 900  },
  pack_100:  { credits: 100,  price: 15, priceInCents: 1500 },
  pack_300:  { credits: 300,  price: 35, priceInCents: 3500 },
  pack_500:  { credits: 500,  price: 55, priceInCents: 5500 },
  pack_1000: { credits: 1000, price: 99, priceInCents: 9900 },
}