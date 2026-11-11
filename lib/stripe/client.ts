import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

// Clientul Stripe. Deocamdată îl folosește doar webhook-ul, ca să verifice
// semnătura evenimentelor: Hontrio nu vinde nimic până la abonamentul nou, în
// funcție de vânzări.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia' as any,
  typescript: true,
})
