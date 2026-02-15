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

    const userId = (session.user as any).id
    const body = await request.json()

    const {
      title, short_description, long_description,
      regular_price, sale_price, sku, category, tags,
      product_type, manage_stock, stock_quantity,
      weight, dimensions, meta_description, attributes,
      ai_title, ai_short_description, ai_long_description,
      ai_meta_description, ai_benefits, publish,
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Titlul este obligatoriu' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: store } = await supabase
      .from('stores').select('*').eq('user_id', userId).single()

    const finalTitle = ai_title || title
    const finalShortDesc = ai_short_description || short_description || ''
    const finalLongDesc = ai_long_description || long_description || ''
    const finalMetaDesc = ai_meta_description || meta_description || ''

    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert({
        user_id: userId,
        store_id: store?.id || null,
        original_title: title,
        optimized_title: ai_title || null,
        original_description: long_description || short_description || '',
        optimized_short_description: ai_short_description || null,
        optimized_long_description: ai_long_description || null,
        meta_description: ai_meta_description || null,
        benefits: ai_benefits?.length > 0 ? ai_benefits : null,
        category: category || null,
        price: regular_price ? parseFloat(regular_price) : null,
        status: 'draft',
        seo_score: ai_title ? 75 : 0,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Eroare la salvarea produsului' }, { status: 500 })
    }

    return NextResponse.json({
      product_id: product.id,
      success: true,
      published: false,
    })
  } catch (error: any) {
    console.error('Create product error:', error)
    return NextResponse.json({ error: 'Eroare la crearea produsului' }, { status: 500 })
  }
}