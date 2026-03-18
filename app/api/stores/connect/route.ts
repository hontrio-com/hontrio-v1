import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/security/encryption'
import { validateStoreUrl } from '@/lib/security/validate-url'
import { rateLimit } from '@/lib/security/rate-limit'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Rate limit: 5 connect attempts per 10 minutes
    const rl = rateLimit(`store-connect:${userId}`, 5, 10 * 60 * 1000)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Prea multe încercări. Așteaptă câteva minute.' },
        { status: 429 }
      )
    }

    const { store_url, consumer_key, consumer_secret } = await request.json()

    if (!store_url || !consumer_key || !consumer_secret) {
      return NextResponse.json(
        { error: 'Toate câmpurile sunt obligatorii' },
        { status: 400 }
      )
    }

    // Validate & sanitize URL (SSRF protection)
    const urlValidation = validateStoreUrl(store_url)
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: urlValidation.error },
        { status: 400 }
      )
    }
    const cleanUrl = urlValidation.cleaned

    // Validate API key format
    if (typeof consumer_key !== 'string' || !consumer_key.startsWith('ck_') || consumer_key.length < 10) {
      return NextResponse.json(
        { error: 'Consumer Key invalid. Trebuie să înceapă cu ck_' },
        { status: 400 }
      )
    }
    if (typeof consumer_secret !== 'string' || !consumer_secret.startsWith('cs_') || consumer_secret.length < 10) {
      return NextResponse.json(
        { error: 'Consumer Secret invalid. Trebuie să înceapă cu cs_' },
        { status: 400 }
      )
    }

    // Test connection with WooCommerce (HTTPS only)
    try {
      const testUrl = `${cleanUrl}/wp-json/wc/v3/system_status`
      const authHeader = 'Basic ' + Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64')

      const testRes = await fetch(testUrl, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (!testRes.ok) {
        return NextResponse.json(
          { error: 'Nu s-a putut conecta la WooCommerce. Verifică URL-ul și cheile API.' },
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Nu s-a putut accesa magazinul. Verifică URL-ul.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Check if this store_url is already connected by ANY user
    const { data: existingByUrl } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('store_url', cleanUrl)
      .maybeSingle()

    if (existingByUrl) {
      if (existingByUrl.user_id === userId) {
        return NextResponse.json(
          { error: 'Ai deja acest magazin conectat.' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Acest magazin este deja conectat la un alt cont.' },
        { status: 400 }
      )
    }

    // Check if user already has a store
    const { data: existingStore } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existingStore) {
      return NextResponse.json(
        { error: 'Ai deja un magazin conectat. Deconectează-l mai întâi.' },
        { status: 400 }
      )
    }

    // Encrypt API keys before storing (AES-256-GCM)
    let encryptedKey: string
    let encryptedSecret: string
    try {
      encryptedKey = encrypt(consumer_key)
      encryptedSecret = encrypt(consumer_secret)
    } catch (encErr) {
      console.error('Encryption error:', encErr)
      return NextResponse.json(
        { error: 'Eroare la criptarea cheilor API. Verifică ENCRYPTION_KEY în .env' },
        { status: 500 }
      )
    }

    // Save store with encrypted credentials
    const { data: store, error } = await supabase
      .from('stores')
      .insert({
        user_id: userId,
        platform: 'woocommerce',
        store_url: cleanUrl,
        api_key: encryptedKey,
        api_secret: encryptedSecret,
        sync_status: 'active',
        webhook_secret: crypto.randomUUID(),
      })
      .select()
      .single()

    if (error) {
      console.error('Store insert error:', error.message, error.code, error.details)
      return NextResponse.json(
        { error: 'Eroare la salvarea magazinului: ' + error.message },
        { status: 500 }
      )
    }

    // Auto-register WooCommerce webhooks via REST API (fire-and-forget)
    // This works alongside the plugin approach — whichever happens first wins
    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.hontrio.com'
    const webhookUrl = `${appUrl}/api/risk/webhook`
    const wcAuth = 'Basic ' + Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64')
    void (async () => {
      try {
        // Check existing webhooks to avoid duplicates
        const listRes = await fetch(`${cleanUrl}/wp-json/wc/v3/webhooks?per_page=50`, {
          headers: { Authorization: wcAuth }, signal: AbortSignal.timeout(15000),
        })
        const existing: any[] = listRes.ok ? await listRes.json() : []
        const hontrioWebhooks = Array.isArray(existing)
          ? existing.filter((w: any) => w.delivery_url?.includes('/api/risk/webhook'))
          : []
        const registeredTopics = new Set(hontrioWebhooks.map((w: any) => w.topic))

        for (const topic of ['order.created', 'order.updated']) {
          if (registeredTopics.has(topic)) continue
          await fetch(`${cleanUrl}/wp-json/wc/v3/webhooks`, {
            method: 'POST',
            headers: { Authorization: wcAuth, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `Hontrio Risk Shield — ${topic}`,
              topic, delivery_url: webhookUrl,
              secret: store.webhook_secret, status: 'active',
            }),
            signal: AbortSignal.timeout(15000),
          })
        }
        console.log('[StoreConnect] Webhooks registered via WooCommerce API for store:', cleanUrl)
      } catch (e: any) {
        // Non-fatal — user can still use the plugin approach
        console.warn('[StoreConnect] Webhook auto-registration failed (non-fatal):', e.message)
      }
    })()

    return NextResponse.json({ store })
  } catch (err) {
    console.error('Stores connect unexpected error:', err)
    return NextResponse.json(
      { error: 'Eroare internă: ' + (err as Error).message },
      { status: 500 }
    )
  }
}