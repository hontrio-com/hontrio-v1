import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET /api/admin/activity — ce s-a întâmplat ultima oară pe platformă:
// conturi noi, magazine conectate și sincronizările lor.
// =============================================

export async function GET() {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
    }

    const supabase = createAdminClient()

    const [usersRes, storesRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, email, name, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('stores')
        .select('id, user_id, store_url, platform, created_at, last_sync_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // Cine e fiecare om
    const userMap: Record<string, { email: string; name: string | null }> = {}
    const allUsers = usersRes.data || []
    allUsers.forEach(u => {
      userMap[u.id] = { email: u.email, name: u.name }
    })

    const missingUserIds = [...new Set((storesRes.data || []).map(s => s.user_id))].filter(id => !userMap[id])
    if (missingUserIds.length > 0) {
      const { data: missingUsers } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', missingUserIds)
      ;(missingUsers || []).forEach(u => {
        userMap[u.id] = { email: u.email, name: u.name }
      })
    }

    const activities: any[] = []

    // Conturile noi
    allUsers.forEach(u => {
      activities.push({
        id: `user-${u.id}`,
        type: 'user_registered',
        description: t('api.activity_user_registered', { name: u.name || u.email }),
        user_email: u.email,
        user_name: u.name,
        created_at: u.created_at,
        metadata: {},
      })
    })

    // Magazinele conectate și ultima lor sincronizare
    ;(storesRes.data || []).forEach(s => {
      const user = userMap[s.user_id]
      activities.push({
        id: `store-${s.id}`,
        type: 'store_connected',
        description: t('api.activity_store_connected', { store: s.store_url.replace(/^https?:\/\//, '') }),
        user_email: user?.email || t('api.unknown_user'),
        user_name: user?.name || null,
        created_at: s.created_at,
        metadata: { platform: s.platform },
      })

      if (s.last_sync_at) {
        activities.push({
          id: `sync-${s.id}`,
          type: 'products_synced',
          description: t('api.activity_products_synced', { store: s.store_url.replace(/^https?:\/\//, '') }),
          user_email: user?.email || t('api.unknown_user'),
          user_name: user?.name || null,
          created_at: s.last_sync_at,
          metadata: {},
        })
      }
    })

    // Cele mai noi întâi
    activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({
      activities: activities.slice(0, 50),
    })
  } catch (err) {
    console.error('Activity error:', err)
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
