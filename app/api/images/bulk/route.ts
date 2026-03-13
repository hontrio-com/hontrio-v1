import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

const STYLE_COSTS: Record<string, number> = {
  white_bg: 2, lifestyle: 3, premium_dark: 3, industrial: 3, seasonal: 4, manual: 3,
}

// POST — create bulk job
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const {
      style,
      product_ids,       // explicit list OR use priority filter
      priority = 'normal', // 'normal' | 'high_sales' | 'no_image' | 'category'
      priority_config,   // { category: 'Electronics', limit: 50 }
      auto_publish = false,
      max_products = 100,
    } = await request.json()

    if (!style) return NextResponse.json({ error: 'Stilul este obligatoriu' }, { status: 400 })
    const creditCost = STYLE_COSTS[style] || 3

    // FIX: Cap max_products server-side — clientul nu poate cere mai mult de 200
    const safeMaxProducts = Math.min(Math.max(1, max_products || 100), 200)

    // Determine product list
    let products: { id: string; original_title: string; optimized_title: string | null }[] = []

    if (product_ids?.length > 0) {
      // Explicit product list
      const { data } = await supabase
        .from('products')
        .select('id, original_title, optimized_title')
        .eq('user_id', userId)
        .in('id', product_ids.slice(0, 200))
      products = data || []
    } else {
      // Priority-based selection
      let query = supabase
        .from('products')
        .select('id, original_title, optimized_title, original_images, total_sales')
        .eq('user_id', userId)
        .limit(safeMaxProducts)

      if (priority === 'no_image') {
        query = query.or('original_images.is.null,original_images.eq.{}')
      } else if (priority === 'high_sales') {
        query = query.order('total_sales', { ascending: false, nullsFirst: false })
      } else if (priority === 'category' && priority_config?.category) {
        query = query.eq('category', priority_config.category)
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data } = await query
      products = (data || []).slice(0, safeMaxProducts)
    }

    if (products.length === 0) {
      return NextResponse.json({ error: 'Niciun produs selectat pentru procesare' }, { status: 400 })
    }

    const creditsEstimated = products.length * creditCost

    // Check credits
    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single()
    if (!user || user.credits < creditsEstimated) {
      return NextResponse.json({
        error: `Credite insuficiente. Estimat: ${creditsEstimated}, disponibil: ${user?.credits || 0}`,
        credits_needed: creditsEstimated,
        credits_available: user?.credits || 0,
      }, { status: 400 })
    }

    // Create job
    const { data: job, error: jobErr } = await supabase
      .from('image_bulk_jobs')
      .insert({
        user_id: userId,
        style,
        status: 'queued',
        total_items: products.length,
        credits_estimated: creditsEstimated,
        priority,
        priority_config,
        auto_publish,
      })
      .select()
      .single()

    if (jobErr || !job) return NextResponse.json({ error: 'Eroare la crearea job-ului' }, { status: 500 })

    // Create items
    const items = products.map(p => ({
      job_id: job.id,
      user_id: userId,
      product_id: p.id,
      product_title: p.optimized_title || p.original_title,
      status: 'queued',
    }))

    await supabase.from('image_bulk_items').insert(items)

    return NextResponse.json({
      success: true,
      job_id: job.id,
      total_products: products.length,
      credits_estimated: creditsEstimated,
      estimated_minutes: Math.ceil(products.length * 1.5), // ~90s per image
    })
  } catch (err: any) {
    console.error('[BulkCreate]', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

// GET — list jobs with progress
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')

    if (jobId) {
      // Single job detail with items
      const { data: job } = await supabase
        .from('image_bulk_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .single()

      const { data: items } = await supabase
        .from('image_bulk_items')
        .select('*, generated_images(generated_image_url, status)')
        .eq('job_id', jobId)
        .order('created_at')

      return NextResponse.json({ job, items: items || [] })
    }

    // List all jobs
    const { data: jobs } = await supabase
      .from('image_bulk_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ jobs: jobs || [] })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

// DELETE — cancel a queued job
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const { id } = await request.json()
    const supabase = createAdminClient()

    await supabase
      .from('image_bulk_jobs')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('user_id', userId)
      .in('status', ['queued', 'processing'])

    await supabase
      .from('image_bulk_items')
      .update({ status: 'skipped' })
      .eq('job_id', id)
      .eq('status', 'queued')

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}