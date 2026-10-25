import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe, CREDIT_PACKS } from '@/lib/stripe/client'
import { getT } from '@/lib/i18n/server'

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const { pack_id } = await request.json()
    const userId = (session.user as any).id
    const userEmail = session.user.email

    if (!pack_id || !CREDIT_PACKS[pack_id]) {
      return NextResponse.json({ error: t('api.invalid_pack') }, { status: 400 })
    }

    const packConfig = CREDIT_PACKS[pack_id]
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
        metadata: { user_id: userId },
      })
      customerId = customer.id

      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
    }

    // Create checkout session for one-time payment
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            // Numele și descrierea apar pe pagina de plată Stripe, în limba omului
            product_data: {
              name: t('api.checkout_pack_name', { count: packConfig.credits }),
              description: t('api.checkout_pack_description', { count: packConfig.credits }),
            },
            unit_amount: packConfig.priceInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/credits?session_id={CHECKOUT_SESSION_ID}&credits_success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/credits?canceled=true`,
      metadata: {
        user_id: userId,
        pack_id,
        credits: String(packConfig.credits),
        type: 'credits',
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    console.error('Stripe credits checkout error:', error)
    return NextResponse.json(
      { error: error.message || t('api.checkout_failed') },
      { status: 500 }
    )
  }
}