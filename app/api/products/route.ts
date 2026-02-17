import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const userId = (session.user as any).id

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(0, 49999)

    if (error) {
      return NextResponse.json({ error: 'Eroare la încărcarea produselor' }, { status: 500 })
    }

    // For products without original_images, fetch generated images as fallback
    const productIds = (products || [])
      .filter(p => !p.original_images || p.original_images.length === 0)
      .map(p => p.id)

    let genImagesMap: Record<string, string> = {}
    if (productIds.length > 0) {
      const { data: genImages } = await supabase
        .from('generated_images')
        .select('product_id, generated_image_url')
        .in('product_id', productIds)
        .in('status', ['completed', 'published'])
        .order('created_at', { ascending: false })

      if (genImages) {
        // Take only the first (most recent) image per product
        for (const img of genImages) {
          if (!genImagesMap[img.product_id]) {
            genImagesMap[img.product_id] = img.generated_image_url
          }
        }
      }
    }

    // Also check for products that have original_images but want to show generated as well
    const allProductIds = (products || []).map(p => p.id)
    if (allProductIds.length > 0) {
      const { data: allGenImages } = await supabase
        .from('generated_images')
        .select('product_id, generated_image_url')
        .in('product_id', allProductIds)
        .in('status', ['completed', 'published'])
        .order('created_at', { ascending: false })

      if (allGenImages) {
        for (const img of allGenImages) {
          if (!genImagesMap[img.product_id]) {
            genImagesMap[img.product_id] = img.generated_image_url
          }
        }
      }
    }

    // Enrich products with a thumbnail_url field
    const enriched = (products || []).map(p => ({
      ...p,
      thumbnail_url:
        // Priority: generated image > original image > null
        genImagesMap[p.id] ||
        (p.original_images && p.original_images.length > 0 ? p.original_images[0] : null),
    }))

    return NextResponse.json({ products: enriched })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}