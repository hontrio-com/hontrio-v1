import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { findClusterMatches, extractCity, type ClusterCandidate } from '@/lib/risk/cluster'

// GET — caută clienți similari pentru un client dat
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const customer_id = searchParams.get('customer_id')
    const store_id = searchParams.get('store_id')
    if (!customer_id) return NextResponse.json({ error: 'customer_id obligatoriu' }, { status: 400 })

    const supabase = createAdminClient()

    // Ia clientul principal
    const { data: target } = await supabase
      .from('risk_customers')
      .select('id,name,phone,email,risk_score,risk_label,orders_refused,total_orders')
      .eq('id', customer_id)
      .eq('user_id', (session.user as any).id)
      .single()
    if (!target) return NextResponse.json({ error: 'Client negăsit' }, { status: 404 })

    // Ia ultima adresă de livrare
    const { data: lastOrder } = await supabase
      .from('risk_orders')
      .select('shipping_address')
      .eq('customer_id', customer_id)
      .order('ordered_at', { ascending: false })
      .limit(1)
      .single()

    const targetCandidate: ClusterCandidate = {
      id: target.id,
      name: target.name,
      phone: target.phone,
      email: target.email,
      shipping_address: lastOrder?.shipping_address || null,
      city: extractCity(lastOrder?.shipping_address || null),
    }

    // Ia toți ceilalți clienți din magazin
    let q = supabase.from('risk_customers')
      .select('id,name,phone,email')
      .eq('user_id', (session.user as any).id)
      .neq('id', customer_id)
    if (store_id) q = q.eq('store_id', store_id)
    const { data: allCustomers } = await q

    // Ia ultima adresă de livrare pentru fiecare client — esențial pentru similaritate adresă
    const customerIds = (allCustomers || []).map((c: any) => c.id)
    let addressMap: Record<string, string | null> = {}

    if (customerIds.length > 0) {
      // Ia ultima comandă per client cu o singură query
      const { data: lastOrders } = await supabase
        .from('risk_orders')
        .select('customer_id, shipping_address')
        .in('customer_id', customerIds)
        .order('ordered_at', { ascending: false })

      // Păstrează doar ultima adresă per client (prima din lista sortată desc)
      for (const o of (lastOrders || [])) {
        if (o.customer_id && !addressMap[o.customer_id]) {
          addressMap[o.customer_id] = o.shipping_address || null
        }
      }
    }

    const candidateList: ClusterCandidate[] = (allCustomers || []).map((c: any) => ({
      id: c.id, name: c.name, phone: c.phone, email: c.email,
      shipping_address: addressMap[c.id] || null,
      city: extractCity(addressMap[c.id] || null),
    }))

    const matches = findClusterMatches(targetCandidate, candidateList, 0.72)

    // Îmbogățește cu date complete
    if (matches.length > 0) {
      const matchIds = matches.map(m => m.matchedCustomerId)
      const { data: matchedCustomers } = await supabase
        .from('risk_customers')
        .select('id,name,phone,email,risk_score,risk_label,orders_refused,total_orders')
        .in('id', matchIds)

      const enriched = matches.map(m => {
        const c = (matchedCustomers || []).find((x: any) => x.id === m.matchedCustomerId)
        return { ...m, customer: c || null }
      })

      return NextResponse.json({ target, matches: enriched })
    }

    return NextResponse.json({ target, matches: [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — rulează clustering pe toți clienții unui store și detectează grupuri
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { store_id } = await req.json()

    const supabase = createAdminClient()

    let q = supabase.from('risk_customers')
      .select('id,name,phone,email,risk_score,risk_label,orders_refused,total_orders')
      .eq('user_id', (session.user as any).id)
    if (store_id) q = q.eq('store_id', store_id)
    const { data: customers } = await q

    if (!customers || customers.length < 2) {
      return NextResponse.json({ clusters: [], total: 0 })
    }

    // Ia adrese
    let aq = supabase.from('risk_orders')
      .select('customer_id,shipping_address')
      .eq('user_id', (session.user as any).id)
    if (store_id) aq = aq.eq('store_id', store_id)
    const { data: addresses } = await aq

    const lastAddressMap: Record<string, string | null> = {}
    for (const a of (addresses || [])) {
      if (a.customer_id && a.shipping_address) {
        lastAddressMap[a.customer_id] = a.shipping_address
      }
    }

    const candidates: ClusterCandidate[] = customers.map((c: any) => ({
      id: c.id, name: c.name, phone: c.phone, email: c.email,
      shipping_address: lastAddressMap[c.id] || null,
      city: extractCity(lastAddressMap[c.id] || null),
    }))

    // Găsește grupuri (union-find simplu)
    const groups: Map<string, Set<string>> = new Map()
    const processed = new Set<string>()

    for (const c of candidates) {
      if (processed.has(c.id)) continue
      const matches = findClusterMatches(c, candidates.filter(x => x.id !== c.id), 0.75)
      if (matches.length > 0) {
        const groupId = c.id
        if (!groups.has(groupId)) groups.set(groupId, new Set([c.id]))
        for (const m of matches) {
          groups.get(groupId)!.add(m.matchedCustomerId)
          processed.add(m.matchedCustomerId)
        }
        processed.add(c.id)
      }
    }

    const clusterResults = []
    for (const [primaryId, memberIds] of groups) {
      if (memberIds.size < 2) continue
      const members = customers.filter((c: any) => memberIds.has(c.id))
      const combinedRefusals = members.reduce((s: number, c: any) => s + (c.orders_refused || 0), 0)
      const combinedOrders = members.reduce((s: number, c: any) => s + (c.total_orders || 0), 0)
      const maxScore = Math.max(...members.map((c: any) => c.risk_score || 0))

      clusterResults.push({
        primaryId,
        memberCount: members.length,
        members: members.map((c: any) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, risk_score: c.risk_score, risk_label: c.risk_label })),
        combinedRefusals,
        combinedOrders,
        maxRiskScore: maxScore,
        riskLevel: maxScore >= 61 || combinedRefusals >= 3 ? 'high' : 'medium',
      })
    }

    clusterResults.sort((a, b) => b.combinedRefusals - a.combinedRefusals)
    return NextResponse.json({ clusters: clusterResults, total: clusterResults.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}