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
    const [usersRes, transactionsRes, imagesRes, productsRes] = await Promise.all([
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
        .select('id, user_id, original_title, status, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    // Build user lookup
    const userMap: Record<string, { email: string; name: string | null }> = {}
    const allUsers = usersRes.data || []
    allUsers.forEach(u => {
      userMap[u.id] = { email: u.email, name: u.name }
    })

    // Also fetch user info for transactions/images that might reference users not in the recent list
    const allUserIds = new Set<string>()
    ;(transactionsRes.data || []).forEach(t => allUserIds.add(t.user_id))
    ;(imagesRes.data || []).forEach(i => allUserIds.add(i.user_id))
    ;(productsRes.data || []).forEach(p => allUserIds.add(p.user_id))

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

    // Credit transactions
    ;(transactionsRes.data || []).forEach(t => {
      const user = userMap[t.user_id]
      if (t.reference_type === 'image_generation') {
        activities.push({
          id: `img-tx-${t.id}`,
          type: 'image_generated',
          description: t.description || 'Imagine generată cu AI',
          user_email: user?.email || 'unknown',
          user_name: user?.name || null,
          created_at: t.created_at,
          metadata: { amount: t.amount },
        })
      } else if (t.reference_type === 'text_generation') {
        activities.push({
          id: `txt-tx-${t.id}`,
          type: 'text_generated',
          description: t.description || 'Text generat cu AI',
          user_email: user?.email || 'unknown',
          user_name: user?.name || null,
          created_at: t.created_at,
          metadata: { amount: t.amount },
        })
      } else if (t.reference_type === 'admin_action') {
        activities.push({
          id: `admin-tx-${t.id}`,
          type: 'credits_added',
          description: t.description || `${t.amount > 0 ? 'Credite adăugate' : 'Credite retrase'} de admin`,
          user_email: user?.email || 'unknown',
          user_name: user?.name || null,
          created_at: t.created_at,
          metadata: { amount: t.amount },
        })
      }
    })

    // Sort by date descending and limit
    activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({
      activities: activities.slice(0, 50),
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}