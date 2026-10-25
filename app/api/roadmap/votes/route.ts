import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'

const FEATURE_KEYS = ['shopify', 'ads', 'merchant', 'video', 'merchantpro', 'winning-products', 'price-analysis']

// GET /api/roadmap/votes — returns vote counts per feature
export async function GET() {
  const t = await getT()
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('roadmap_votes')
      .select('feature_key')

    if (error) {
      return NextResponse.json({ error: t('api.votes_load_failed') }, { status: 500 })
    }

    const counts: Record<string, number> = {}
    for (const key of FEATURE_KEYS) counts[key] = 0
    for (const row of data ?? []) {
      if (row.feature_key in counts) counts[row.feature_key]++
    }

    return NextResponse.json({ counts })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}

// POST /api/roadmap/votes — record a vote
// Body: { feature_key: string, session_id: string }
export async function POST(request: Request) {
  const t = await getT()
  try {
    const { feature_key, session_id } = await request.json()

    if (!feature_key || !session_id) {
      return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
    }

    if (!FEATURE_KEYS.includes(feature_key)) {
      return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('roadmap_votes')
      .insert({ feature_key, session_id })

    if (error) {
      // Unique constraint violation = already voted
      if (error.code === '23505') {
        return NextResponse.json({ error: t('api.already_voted'), code: 'DUPLICATE' }, { status: 409 })
      }
      return NextResponse.json({ error: t('api.vote_save_failed') }, { status: 500 })
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
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
