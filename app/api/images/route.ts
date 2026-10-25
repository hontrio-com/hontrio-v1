import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'

export async function GET() {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const supabase = createAdminClient()
    const userId = (session.user as any).id

    // Ia imaginile cu titlul produsului
    const { data: images, error } = await supabase
      .from('generated_images')
      .select(`
        *,
        products:product_id (original_title, optimized_title)
      `)
      .eq('user_id', userId)
      .in('status', ['completed', 'published'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Images error:', error)
      return NextResponse.json({ error: t('api.images_load_failed') }, { status: 500 })
    }

    // Formateaza pentru frontend
    const formatted = (images || []).map((img: any) => ({
      ...img,
      product_title: img.products?.optimized_title || img.products?.original_title || t('api.unknown_product'),
      products: undefined,
    }))

    return NextResponse.json({ images: formatted })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
// DELETE — șterge una sau mai multe imagini
export async function DELETE(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { image_ids } = await request.json()

    if (!Array.isArray(image_ids) || image_ids.length === 0) {
      return NextResponse.json({ error: t('api.no_images_selected') }, { status: 400 })
    }

    // Cap la 50 imagini per cerere
    const ids = image_ids.slice(0, 50)

    const supabase = createAdminClient()

    // Verifică ownership — toate imaginile trebuie să aparțină userului
    const { data: images } = await supabase
      .from('generated_images')
      .select('id, generated_image_url')
      .eq('user_id', userId)
      .in('id', ids)

    if (!images || images.length === 0) {
      return NextResponse.json({ error: t('api.images_not_found') }, { status: 404 })
    }

    // Șterge din DB
    const { error } = await supabase
      .from('generated_images')
      .delete()
      .eq('user_id', userId)
      .in('id', ids)

    if (error) {
      console.error('[Images DELETE]', error)
      return NextResponse.json({ error: t('api.delete_failed') }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deleted: images.length,
    })
  } catch (err) {
    console.error('[Images DELETE]', err)
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
