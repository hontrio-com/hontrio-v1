import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/products/categories
// Returns distinct categories from user's synced products
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: products } = await supabase
      .from('products')
      .select('category')
      .eq('user_id', userId)
      .not('category', 'is', null)

    // Deduplicate and count
    const countMap: Record<string, number> = {}
    for (const p of products || []) {
      if (p.category) countMap[p.category] = (countMap[p.category] || 0) + 1
    }

    const categories = Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({ id: String(i + 1), name, count }))

    return NextResponse.json({ categories })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}