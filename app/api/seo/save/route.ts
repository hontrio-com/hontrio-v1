import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// Fields that can be saved via SEO optimizer
const ALLOWED_FIELDS = [
  'optimized_title',
  'meta_description',
  'optimized_short_description',
  'optimized_long_description',
  'focus_keyword',
  'secondary_keywords',
  'seo_score',
  'seo_suggestions',
]

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { product_id, fields, action } = body

    if (!product_id) {
      return NextResponse.json({ error: 'product_id lipsește' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Load current product
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('user_id', userId)
      .single()

    if (!product) {
      return NextResponse.json({ error: 'Produs negăsit' }, { status: 404 })
    }

    // ── ACTION: REVERT ─────────────────────────────────────────────────────────
    if (action === 'revert') {
      const { field } = body

      if (!field || !ALLOWED_FIELDS.includes(field)) {
        return NextResponse.json({ error: 'Câmp invalid pentru revert' }, { status: 400 })
      }

      // Map optimized fields back to originals
      const revertMap: Record<string, string | null> = {
        optimized_title: product.original_title || null,
        meta_description: null,
        optimized_short_description: product.original_short_description || null,
        optimized_long_description: product.original_description || null,
        focus_keyword: null,
        secondary_keywords: null,
        seo_score: null,
        seo_suggestions: null,
      }

      const revertValue = revertMap[field]

      await supabase
        .from('products')
        .update({ [field]: revertValue })
        .eq('id', product_id)

      return NextResponse.json({
        success: true,
        reverted_field: field,
        reverted_value: revertValue,
      })
    }

    // ── ACTION: SAVE FIELDS ────────────────────────────────────────────────────
    if (!fields || typeof fields !== 'object') {
      return NextResponse.json({ error: 'fields lipsesc' }, { status: 400 })
    }

    // Sanitize — only allow whitelisted fields
    const safeUpdate: Record<string, any> = {}
    for (const [key, value] of Object.entries(fields)) {
      if (ALLOWED_FIELDS.includes(key)) {
        safeUpdate[key] = value
      }
    }

    if (Object.keys(safeUpdate).length === 0) {
      return NextResponse.json({ error: 'Niciun câmp valid de salvat' }, { status: 400 })
    }

    // Auto-update status
    safeUpdate.status = 'optimized'

    // Calculeaza seo_score pe baza campurilor completate
    const mergedProduct = { ...product, ...safeUpdate }
    let score = 0
    if (mergedProduct.optimized_title) {
      const tLen = mergedProduct.optimized_title.length
      score += tLen >= 50 && tLen <= 70 ? 25 : 15
    }
    if (mergedProduct.meta_description) {
      const mLen = mergedProduct.meta_description.length
      score += mLen >= 120 && mLen <= 155 ? 25 : 15
    }
    if (mergedProduct.optimized_short_description) score += 15
    if (mergedProduct.optimized_long_description) score += 20
    if (mergedProduct.focus_keyword) score += 15
    if (score > 0) safeUpdate.seo_score = Math.min(score, 100)

    const { error: updateError } = await supabase
      .from('products')
      .update(safeUpdate)
      .eq('id', product_id)
      .eq('user_id', userId)

    if (updateError) {
      return NextResponse.json({ error: 'Eroare la salvare: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, saved_fields: Object.keys(safeUpdate) })
  } catch (err) {
    console.error('[SEO Save] Error:', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}