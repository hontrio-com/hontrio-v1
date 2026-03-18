import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    console.log('Fetching product:', id, 'for user:', userId)

    // Ia produsul
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    console.log('Product:', product)
    console.log('Error:', error)

    if (error || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Ia imaginile generate
    const { data: images } = await supabase
      .from('generated_images')
      .select('*')
      .eq('product_id', id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    return NextResponse.json({
      product,
      images: images || [],
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}