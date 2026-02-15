import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const { store_url, consumer_key, consumer_secret } = await request.json()
    const userId = (session.user as any).id

    if (!store_url || !consumer_key || !consumer_secret) {
      return NextResponse.json(
        { error: 'Toate câmpurile sunt obligatorii' },
        { status: 400 }
      )
    }

    // Curata URL-ul
    const cleanUrl = store_url.replace(/\/+$/, '')

    // Testeaza conexiunea cu WooCommerce folosind Basic Auth
    console.log('Testing WooCommerce connection...')
    try {
      const testUrl = `${cleanUrl}/wp-json/wc/v3/system_status`
      const authHeader = 'Basic ' + Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64')
      
      const testRes = await fetch(testUrl, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
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

    // Verifica daca are deja un magazin
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

    // Salveaza magazinul
    const { data: store, error } = await supabase
      .from('stores')
      .insert({
        user_id: userId,
        platform: 'woocommerce',
        store_url: cleanUrl,
        api_key: consumer_key,
        api_secret: consumer_secret,
        sync_status: 'active',
        webhook_secret: crypto.randomUUID(),
      })
      .select()
      .single()

    if (error) {
      console.error('Store creation error:', error)
      return NextResponse.json(
        { error: 'Eroare la salvarea magazinului' },
        { status: 500 }
      )
    }

    console.log('Store connected:', store.id)

    return NextResponse.json({ store })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json(
      { error: 'Eroare internă de server' },
      { status: 500 }
    )
  }
}