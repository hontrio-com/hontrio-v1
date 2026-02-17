import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const supabase = createAdminClient()

    // Fetch recent data from multiple tables in parallel
    const [usersRes, transactionsRes, imagesRes, productsRes, jobsRes, storesRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, email, name, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('credit_transactions')
        .select('id, user_id, type, amount, description, reference_type, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('generated_images')
        .select('id, user_id, style, status, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('products')
        .select('id, user_id, original_title, optimized_title, status, created_at, updated_at, published_at')
        .order('updated_at', { ascending: false })
        .limit(20),
      supabase
        .from('generation_jobs')
        .select('id, user_id, type, status, created_at, completed_at')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('stores')
        .select('id, user_id, store_url, platform, created_at, last_sync_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // Build user lookup
    const userMap: Record<string, { email: string; name: string | null }> = {}
    const allUsers = usersRes.data || []
    allUsers.forEach(u => {
      userMap[u.id] = { email: u.email, name: u.name }
    })

    // Fetch missing user info
    const allUserIds = new Set<string>()
    ;(transactionsRes.data || []).forEach(t => allUserIds.add(t.user_id))
    ;(imagesRes.data || []).forEach(i => allUserIds.add(i.user_id))
    ;(productsRes.data || []).forEach(p => allUserIds.add(p.user_id))
    ;(jobsRes.data || []).forEach(j => allUserIds.add(j.user_id))
    ;(storesRes.data || []).forEach(s => allUserIds.add(s.user_id))

    const missingUserIds = [...allUserIds].filter(id => !userMap[id])
    if (missingUserIds.length > 0) {
      const { data: missingUsers } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', missingUserIds)
      ;(missingUsers || []).forEach(u => {
        userMap[u.id] = { email: u.email, name: u.name }
      })
    }

    // Build activity feed
    const activities: any[] = []

    // User registrations
    allUsers.forEach(u => {
      activities.push({
        id: `user-${u.id}`,
        type: 'user_registered',
        description: `Utilizator nou înregistrat: ${u.name || u.email}`,
        user_email: u.email,
        user_name: u.name,
        created_at: u.created_at,
        metadata: {},
      })
    })

    // Store connections
    ;(storesRes.data || []).forEach(s => {
      const user = userMap[s.user_id]
      activities.push({
        id: `store-${s.id}`,
        type: 'store_connected',
        description: `Magazin conectat: ${s.store_url.replace(/^https?:\/\//, '')}`,
        user_email: user?.email || 'unknown',
        user_name: user?.name || null,
        created_at: s.created_at,
        metadata: { platform: s.platform },
      })

      // Store syncs
      if (s.last_sync_at) {
        activities.push({
          id: `sync-${s.id}`,
          type: 'products_synced',
          description: `Produse sincronizate din ${s.store_url.replace(/^https?:\/\//, '')}`,
          user_email: user?.email || 'unknown',
          user_name: user?.name || null,
          created_at: s.last_sync_at,
          metadata: {},
        })
      }
    })

    // Generation jobs
    ;(jobsRes.data || []).forEach(j => {
      const user = userMap[j.user_id]
      const typeLabel = j.type === 'image' ? 'Imagine generată cu AI' :
                        j.type === 'text' ? 'Text generat cu AI' :
                        j.type === 'full_product' ? 'Produs complet generat' : 'Generare AI'
      activities.push({
        id: `job-${j.id}`,
        type: j.type === 'image' ? 'image_generated' : 'text_generated',
        description: `${typeLabel} (${j.status === 'completed' ? 'succes' : j.status === 'failed' ? 'eșuat' : 'în lucru'})`,
        user_email: user?.email || 'unknown',
        user_name: user?.name || null,
        created_at: j.created_at,
        metadata: { status: j.status, type: j.type },
      })
    })

    // Credit transactions (purchases and admin actions)
    ;(transactionsRes.data || []).forEach(t => {
      const user = userMap[t.user_id]

      if (t.type === 'purchase') {
        activities.push({
          id: `purchase-${t.id}`,
          type: 'credits_added',
          description: t.description || `${t.amount} credite achiziționate`,
          user_email: user?.email || 'unknown',
          user_name: user?.name || null,
          created_at: t.created_at,
          metadata: { amount: t.amount },
        })
      } else if (t.reference_type === 'admin_action') {
        activities.push({
          id: `admin-${t.id}`,
          type: 'credits_added',
          description: t.description || `${t.amount > 0 ? 'Credite adăugate' : 'Credite retrase'} de admin`,
          user_email: user?.email || 'unknown',
          user_name: user?.name || null,
          created_at: t.created_at,
          metadata: { amount: t.amount },
        })
      }
    })

    // Published products
    ;(productsRes.data || []).forEach(p => {
      if (p.published_at) {
        const user = userMap[p.user_id]
        activities.push({
          id: `publish-${p.id}`,
          type: 'product_published',
          description: `Produs publicat: ${p.optimized_title || p.original_title || 'Fără titlu'}`,
          user_email: user?.email || 'unknown',
          user_name: user?.name || null,
          created_at: p.published_at,
          metadata: {},
        })
      }
    })

    // Sort by date descending and limit
    activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({
      activities: activities.slice(0, 50),
    })
  } catch (err) {
    console.error('Activity error:', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}