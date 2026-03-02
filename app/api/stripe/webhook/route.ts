import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe, STRIPE_PLANS, CREDIT_PACKS } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {
      // ===== SUBSCRIPTION CREATED / UPDATED =====
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = session.metadata

        if (!metadata?.user_id) break

        if (metadata.type === 'subscription') {
          // Subscription checkout completed
          const plan = metadata.plan
          const planConfig = STRIPE_PLANS[plan]

          if (planConfig) {
            // Update user plan and add credits
            const { data: user } = await supabase
              .from('users')
              .select('credits')
              .eq('id', metadata.user_id)
              .single()

            const currentCredits = user?.credits || 0
            const newCredits = currentCredits + planConfig.credits

            await supabase
              .from('users')
              .update({
                plan,
                credits: newCredits,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: session.subscription as string,
              })
              .eq('id', metadata.user_id)

            // Log credit transaction
            await supabase.from('credit_transactions').insert({
              user_id: metadata.user_id,
              type: 'purchase',
              amount: planConfig.credits,
              balance_after: newCredits,
              description: `Abonament ${planConfig.name} — ${planConfig.credits} credite`,
              reference_type: 'subscription',
            })
          }
        } else if (metadata.type === 'credits') {
          // Credit pack purchase completed
          const credits = parseInt(metadata.credits || '0')

          if (credits > 0) {
            const { data: user } = await supabase
              .from('users')
              .select('credits')
              .eq('id', metadata.user_id)
              .single()

            const currentCredits = user?.credits || 0
            const newCredits = currentCredits + credits

            await supabase
              .from('users')
              .update({
                credits: newCredits,
                stripe_customer_id: session.customer as string,
              })
              .eq('id', metadata.user_id)

            // Log credit transaction
            await supabase.from('credit_transactions').insert({
              user_id: metadata.user_id,
              type: 'purchase',
              amount: credits,
              balance_after: newCredits,
              description: `Pachet ${credits} credite cumpărat`,
              reference_type: 'credit_purchase',
            })
          }
        }
        break
      }

      // ===== SUBSCRIPTION RENEWED (monthly billing) =====
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string }
        const subscriptionId = (invoice.subscription ?? (invoice as any).parent?.subscription_details?.subscription) as string

        // Skip the first invoice (handled by checkout.session.completed)
        if (invoice.billing_reason === 'subscription_create') break

        if (subscriptionId) {
          // Find user by subscription ID
          const { data: user } = await supabase
            .from('users')
            .select('id, credits, plan')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (user && user.plan && STRIPE_PLANS[user.plan]) {
            const planCredits = STRIPE_PLANS[user.plan].credits
            const newCredits = user.credits + planCredits

            await supabase
              .from('users')
              .update({ credits: newCredits })
              .eq('id', user.id)

            await supabase.from('credit_transactions').insert({
              user_id: user.id,
              type: 'purchase',
              amount: planCredits,
              balance_after: newCredits,
              description: `Reînnoire abonament ${STRIPE_PLANS[user.plan].name} — ${planCredits} credite`,
              reference_type: 'subscription_renewal',
            })
          }
        }
        break
      }

      // ===== SUBSCRIPTION CANCELLED =====
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.user_id

        if (userId) {
          await supabase
            .from('users')
            .update({
              plan: 'free',
              stripe_subscription_id: null,
            })
            .eq('id', userId)

          await supabase.from('credit_transactions').insert({
            user_id: userId,
            type: 'refund',
            amount: 0,
            balance_after: 0,
            description: 'Abonament anulat — plan schimbat la Free',
            reference_type: 'subscription_cancelled',
          })
        }
        break
      }

      // ===== PAYMENT FAILED =====
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string }
        const subscriptionId = (invoice.subscription ?? (invoice as any).parent?.subscription_details?.subscription) as string

        if (subscriptionId) {
          const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (user) {
            await supabase.from('credit_transactions').insert({
              user_id: user.id,
              type: 'usage',
              amount: 0,
              balance_after: 0,
              description: 'Plata abonamentului a eșuat',
              reference_type: 'payment_failed',
            })
          }
        }
        break
      }
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}