import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe, STRIPE_PLANS } from '@/lib/stripe/client'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const { plan } = await request.json()
    const userId = (session.user as any).id
    const userEmail = session.user.email

    if (!plan || !STRIPE_PLANS[plan]) {
      return NextResponse.json({ error: 'Plan invalid' }, { status: 400 })
    }

    const planConfig = STRIPE_PLANS[plan]
    const supabase = createAdminClient()

    // Check if user already has a Stripe customer ID
    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    let customerId = user?.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail!,
        metadata: {
          user_id: userId,
        },
      })
      customerId = customer.id

      // Save customer ID to database
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
    }

    // Create checkout session for subscription
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/credits?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/credits?canceled=true`,
      metadata: {
        user_id: userId,
        plan,
        type: 'subscription',
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          plan,
        },
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Eroare la crearea sesiunii de plată' },
      { status: 500 }
    )
  }
}