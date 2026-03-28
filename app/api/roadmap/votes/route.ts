import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const FEATURE_KEYS = ['shopify', 'ads', 'merchant', 'video', 'merchantpro', 'winning-products', 'price-analysis']

// GET /api/roadmap/votes — returns vote counts per feature
export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('roadmap_votes')
      .select('feature_key')

    if (error) {
      return NextResponse.json({ error: 'Failed to load votes' }, { status: 500 })
    }

    const counts: Record<string, number> = {}
    for (const key of FEATURE_KEYS) counts[key] = 0
    for (const row of data ?? []) {
      if (row.feature_key in counts) counts[row.feature_key]++
    }

    return NextResponse.json({ counts })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/roadmap/votes — record a vote
// Body: { feature_key: string, session_id: string }
export async function POST(request: Request) {
  try {
    const { feature_key, session_id } = await request.json()

    if (!feature_key || !session_id) {
      return NextResponse.json({ error: 'feature_key and session_id required' }, { status: 400 })
    }

    if (!FEATURE_KEYS.includes(feature_key)) {
      return NextResponse.json({ error: 'Invalid feature_key' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('roadmap_votes')
      .insert({ feature_key, session_id })

    if (error) {
      // Unique constraint violation = already voted
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already voted', code: 'DUPLICATE' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to save vote' }, { status: 500 })
    }

    // Return updated counts
    const { data: allVotes } = await supabase
      .from('roadmap_votes')
      .select('feature_key')

    const counts: Record<string, number> = {}
    for (const key of FEATURE_KEYS) counts[key] = 0
    for (const row of allVotes ?? []) {
      if (row.feature_key in counts) counts[row.feature_key]++
    }

    return NextResponse.json({ success: true, counts })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
