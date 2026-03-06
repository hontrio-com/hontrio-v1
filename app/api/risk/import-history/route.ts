import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateRiskScore, type CustomerHistory, type OrderContext } from '@/lib/risk/engine'
import { decrypt } from '@/lib/security/encryption'

function safeDecrypt(v: string|null): string {
  if (!v) return ''
  try { return v.includes(':') ? decrypt(v) : v } catch { return v }
}

function mapStatus(s: string): string {
  const m: Record<string,string> = {
    pending:'pending', processing:'processing', 'on-hold':'pending',
    completed:'collected', cancelled:'cancelled', refunded:'returned',
    failed:'cancelled', shipped:'shipped', delivered:'collected',
    returned:'returned', refused:'refused', 'not-home':'not_home',
    livrata:'collected', refuzata:'refused', returnata:'returned',
    expediat:'shipped', 'in-livrare':'shipped', nepreluat:'not_home',
  }
  const n = s.toLowerCase().replace(/[ăâ]/g,'a').replace(/î/g,'i').replace(/[șs]/g,'s').replace(/[țt]/g,'t')
  return m[n] || m[s.toLowerCase()] || 'pending'
}

function phoneLast9(p: string): string {
  return p.replace(/\s/g,'').replace(/^\+40/,'0').slice(-9)
}

// Comanda apartine clientului daca telefon (ultimele 9 cifre) SAU email se potriveste exact
function belongs(wooOrder: any, phone: string|null, email: string|null): boolean {
  const bPhone = (wooOrder.billing?.phone||'').replace(/\s/g,'')
  const bEmail = (wooOrder.billing?.email||'').toLowerCase().trim()
  const phoneOk = phone && bPhone && phoneLast9(bPhone) === phoneLast9(phone)
  const emailOk = email && bEmail && bEmail === email.toLowerCase().trim()
  return !!(phoneOk || emailOk)
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { customer_id } = await req.json()
    if (!customer_id) return NextResponse.json({ error: 'customer_id obligatoriu' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: customer } = await supabase.from('risk_customers').select('*')
      .eq('id', customer_id).eq('user_id', session.user.id).single()
    if (!customer) return NextResponse.json({ error: 'Client negăsit' }, { status: 404 })

    const { data: store } = await supabase.from('stores')
      .select('id, store_url, api_key, api_secret, user_id').eq('id', customer.store_id).single()
    if (!store) return NextResponse.json({ error: 'Magazin negăsit' }, { status: 404 })

    const ck = safeDecrypt(store.api_key), cs = safeDecrypt(store.api_secret)
    if (!ck || !cs) return NextResponse.json({ error: 'Credențiale API lipsă. Reconectează magazinul.' }, { status: 400 })

    const base = store.store_url.replace(/\/$/, '')
    const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64')

    const fetchPage = async (qp: Record<string,string>) => {
      const url = new URL(`${base}/wp-json/wc/v3/orders`)
      Object.entries(qp).forEach(([k,v]) => url.searchParams.set(k,v))
      const res = await fetch(url.toString(), {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) {
        const txt = await res.text().catch(()=>'')
        throw new Error(`WooCommerce ${res.status}: ${txt.slice(0,200)}`)
      }
      return { data: await res.json(), pages: parseInt(res.headers.get('x-wp-totalpages')||'1') }
    }

    const seen = new Set<number>()
    const wooOrders: any[] = []

    console.log('[ImportHistory] start for customer:', customer_id, 'phone:', customer.phone, 'email:', customer.email)

    // Cauta dupa email — parametru direct WooCommerce, cel mai precis
    if (customer.email) {
      try {
        for (let p=1; p<=10; p++) {
          const { data, pages } = await fetchPage({ billing_email: customer.email, per_page:'100', page:String(p), orderby:'date', order:'desc' })
          console.log(`[ImportHistory] email page ${p}/${pages}: ${data?.length||0} results`)
          for (const o of (data||[])) {
            if (!seen.has(o.id) && belongs(o, null, customer.email)) {
              seen.add(o.id); wooOrders.push(o)
            }
          }
          if (p >= pages) break
        }
      } catch(e:any) { console.error('[ImportHistory] email fetch error:', e.message) }
    }

    // Cauta dupa telefon (ultimele 9 cifre pentru compatibilitate +40)
    if (customer.phone) {
      const clean = customer.phone.replace(/\s/g,'')
      try {
        for (let p=1; p<=10; p++) {
          const { data, pages } = await fetchPage({ search: clean, per_page:'100', page:String(p), orderby:'date', order:'desc' })
          console.log(`[ImportHistory] phone page ${p}/${pages}: ${data?.length||0} results`)
          for (const o of (data||[])) {
            if (!seen.has(o.id) && belongs(o, customer.phone, null)) {
              seen.add(o.id); wooOrders.push(o)
            }
          }
          if (p >= pages) break
        }
      } catch(e:any) { console.error('[ImportHistory] phone fetch error:', e.message) }
    }

    console.log('[ImportHistory] total found in WooCommerce after strict filter:', wooOrders.length)

    if (wooOrders.length === 0) {
      return NextResponse.json({
        ok: true, imported: 0, updated: 0, reassigned: 0,
        total_in_woocommerce: 0, total_in_db: customer.total_orders || 0,
        new_score: customer.risk_score, new_label: customer.risk_label,
        message: 'Nicio comandă găsită în WooCommerce pentru acest client.',
      })
    }

    // Ia toate comenzile existente in TOT store-ul
    const { data: allExisting } = await supabase.from('risk_orders')
      .select('external_order_id, customer_id').eq('store_id', store.id)
    const existMap = new Map<string,string>((allExisting||[]).map((o:any) => [String(o.external_order_id), o.customer_id]))

    const toInsert: any[] = []
    let updated = 0, reassigned = 0

    for (const woo of wooOrders) {
      const extId = String(woo.id)
      const status = mapStatus(woo.status||'pending')
      const owner = existMap.get(extId)

      if (owner) {
        if (owner === customer_id) {
          // Comanda noastra — actualizeaza status
          await supabase.from('risk_orders')
            .update({ order_status: status, updated_at: new Date().toISOString() })
            .eq('store_id', store.id).eq('external_order_id', extId)
          updated++
        } else {
          // Comanda la alt customer_id — verifica daca e acelasi om (bug vechi)
          const { data: other } = await supabase.from('risk_customers')
            .select('phone, email').eq('id', owner).single()
          const samePhone = customer.phone && other?.phone &&
            phoneLast9(customer.phone) === phoneLast9(other.phone)
          const sameEmail = customer.email && other?.email &&
            customer.email.toLowerCase() === other.email.toLowerCase()
          if (samePhone || sameEmail) {
            // Acelasi om, profil duplicat din bug vechi — reatribuim
            await supabase.from('risk_orders')
              .update({ customer_id, order_status: status, updated_at: new Date().toISOString() })
              .eq('store_id', store.id).eq('external_order_id', extId)
            reassigned++
          }
          // Altfel: alt om complet, nu atingem
        }
        continue
      }

      // Comanda noua
      const b = woo.billing||{}, s = woo.shipping||{}
      const pm = (woo.payment_method||'').toLowerCase()
      toInsert.push({
        store_id: store.id, user_id: store.user_id, customer_id,
        external_order_id: extId, order_number: woo.number ? String(woo.number) : null,
        customer_phone: b.phone||customer.phone, customer_email: b.email||customer.email,
        customer_name: [b.first_name,b.last_name].filter(Boolean).join(' ')||customer.name,
        shipping_address: [s.address_1||b.address_1, s.city||b.city, s.country||b.country].filter(Boolean).join(', '),
        payment_method: pm.includes('cod')||pm.includes('cash')?'cod':pm.includes('card')?'card':'bank_transfer',
        total_value: parseFloat(woo.total||'0'), currency: woo.currency||'RON',
        order_status: status, risk_score_at_order: 0, risk_flags: [],
        ordered_at: woo.date_created||new Date().toISOString(), updated_at: new Date().toISOString(),
      })
    }

    // Insereaza comenzile noi in batch
    for (let i=0; i<toInsert.length; i+=50) {
      await supabase.from('risk_orders').insert(toInsert.slice(i, i+50))
    }

    // Recalculeaza contoarele din DB (sursa de adevar, nu numarare manuala)
    const { data: myOrders } = await supabase.from('risk_orders')
      .select('order_status').eq('customer_id', customer_id).eq('store_id', store.id)

    let tc=0,tr=0,tn=0,tcan=0
    for (const o of (myOrders||[])) {
      if (o.order_status==='collected') tc++
      else if (['refused','returned'].includes(o.order_status)) tr++
      else if (o.order_status==='not_home') tn++
      else if (o.order_status==='cancelled') tcan++
    }
    const total = (myOrders||[]).length

    const history: CustomerHistory = {
      totalOrders: total, ordersCollected: tc, ordersRefused: tr,
      ordersNotHome: tn, ordersCancelled: tcan, ordersToday: 0,
      lastOrderAt: customer.last_order_at, firstOrderAt: customer.first_order_at,
      accountCreatedAt: null,
      phoneValidated: !!(customer.phone?.match(/^(07\d{8}|02\d{8}|03\d{8})$/)),
      isNewAccount: false, addressChanges: 1,
    }
    const orderCtx: OrderContext = {
      paymentMethod: 'cod', totalValue: 0, currency: 'RON',
      orderedAt: customer.last_order_at||new Date().toISOString(),
      customerEmail: customer.email||'', shippingAddress: '',
      inGlobalBlacklist: customer.in_global_blacklist||false, globalReportCount: 0,
    }
    const result = calculateRiskScore(history, orderCtx, {})
    const finalLabel = customer.manual_label_override || result.label

    await supabase.from('risk_customers').update({
      orders_collected: tc, orders_refused: tr, orders_not_home: tn, orders_cancelled: tcan,
      total_orders: total, risk_score: result.score, risk_label: finalLabel,
      updated_at: new Date().toISOString(),
    }).eq('id', customer_id)

    return NextResponse.json({
      ok: true,
      imported: toInsert.length,
      updated,
      reassigned,
      total_in_woocommerce: wooOrders.length,
      total_in_db: total,
      new_score: result.score,
      new_label: finalLabel,
    })
  } catch (err: any) {
    console.error('[ImportHistory] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}