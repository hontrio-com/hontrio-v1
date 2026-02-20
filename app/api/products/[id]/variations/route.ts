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
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createAdminClient()
    const userId = (session.user as any).id

    const { data: variations, error } = await supabase
      .from('products')
      .select('*')
      .eq('parent_id', id)
      .eq('user_id', userId)
      .order('variant_name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Eroare' }, { status: 500 })
    }

    // Get generated images for variations
    const varIds = (variations || []).map(v => v.id)
    let genImagesMap: Record<string, string> = {}

    if (varIds.length > 0) {
      const { data: genImages } = await supabase
        .from('generated_images')
        .select('product_id, generated_image_url')
        .in('product_id', varIds)
        .in('status', ['completed', 'published'])
        .order('created_at', { ascending: false })

      if (genImages) {
        for (const img of genImages) {
          if (!genImagesMap[img.product_id]) {
            genImagesMap[img.product_id] = img.generated_image_url
          }
        }
      }
    }

    const enriched = (variations || []).map(v => ({
      ...v,
      thumbnail_url:
        genImagesMap[v.id] ||
        (v.original_images && v.original_images.length > 0 ? v.original_images[0] : null),
    }))

    return NextResponse.json({ variations: enriched })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}