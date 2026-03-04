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
      return NextResponse.json({ error: 'Eroare la încărcarea imaginilor' }, { status: 500 })
    }

    // Formateaza pentru frontend
    const formatted = (images || []).map((img: any) => ({
      ...img,
      product_title: img.products?.optimized_title || img.products?.original_title || 'Produs necunoscut',
      products: undefined,
    }))

    return NextResponse.json({ images: formatted })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}