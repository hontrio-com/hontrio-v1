import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/client'
import Stripe from 'stripe'

// =============================================
// POST /api/stripe/webhook — evenimentele trimise de Stripe.
// Creditele și planurile vechi (imaginile AI) nu mai există, deci deocamdată nu
// se face nimic cu evenimentele: doar se verifică semnătura și se confirmă
// primirea, ca Stripe să nu le retrimită. Abonamentul nou, în funcție de
// vânzări, își va trata aici plățile.
// Răspunsurile sunt pentru Stripe, nu pentru oameni.
// =============================================

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 }) // i18n-ignore
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 }) // i18n-ignore
  }

  return NextResponse.json({ received: true, type: event.type })
}
