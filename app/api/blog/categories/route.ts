import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import slugify from 'slugify'

// ---------------------------------------------------------------------------
// GET /api/blog/categories — Public
// Returns all categories with a count of published posts.
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // Fetch categories + count of published posts via a subquery-style join
    const { data: categories, error } = await supabase
      .from('blog_categories')
      .select(
        `
        *,
        blog_posts ( count )
        `
      )
      .eq('blog_posts.status', 'published')
      .order('name', { ascending: true })

    if (error) {
      console.error('Blog categories fetch error:', error)
      return NextResponse.json({ error: 'Error loading categories' }, { status: 500 })
    }

    // Normalise: expose posts_count as a flat number
    const result = (categories ?? []).map((cat: any) => ({
      ...cat,
      posts_count: Array.isArray(cat.blog_posts)
        ? cat.blog_posts[0]?.count ?? 0
        : 0,
      blog_posts: undefined,
    }))

    return NextResponse.json({ categories: result })
  } catch (err) {
    console.error('GET /api/blog/categories error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/blog/categories — Admin only
// Body: { name, description?, color? }
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userRole = (session?.user as any)?.role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, color } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Generate unique slug
    const baseSlug = slugify(name, { lower: true, strict: true })
    let slug = baseSlug
    let suffix = 1
    while (true) {
      const { data: existing } = await supabase
        .from('blog_categories')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (!existing) break
      slug = `${baseSlug}-${suffix++}`
    }

    const { data: category, error } = await supabase
      .from('blog_categories')
      .insert({
        name,
        slug,
        description: description ?? null,
        color: color ?? null,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Blog category insert error:', error)
      return NextResponse.json({ error: 'Error creating category' }, { status: 500 })
    }

    return NextResponse.json({ category }, { status: 201 })
  } catch (err) {
    console.error('POST /api/blog/categories error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PUT /api/blog/categories — Admin only
// Body: { id, name, description?, color?, slug? }
// ---------------------------------------------------------------------------
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userRole = (session?.user as any)?.role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, description, color, slug: slugOverride } = body

    if (!id) {
      return NextResponse.json({ error: 'Category id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (color !== undefined) updateData.color = color

    // Resolve slug: explicit override wins, otherwise auto-generate from name
    if (slugOverride !== undefined) {
      updateData.slug = slugOverride
    } else if (name !== undefined) {
      const baseSlug = slugify(name, { lower: true, strict: true })
      let slug = baseSlug
      let suffix = 1
      while (true) {
        const { data: existing } = await supabase
          .from('blog_categories')
          .select('id')
          .eq('slug', slug)
          .neq('id', id)
          .maybeSingle()
        if (!existing) break
        slug = `${baseSlug}-${suffix++}`
      }
      updateData.slug = slug
    }

    const { data: category, error } = await supabase
      .from('blog_categories')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Blog category update error:', error)
      return NextResponse.json({ error: 'Error updating category' }, { status: 500 })
    }

    return NextResponse.json({ category })
  } catch (err) {
    console.error('PUT /api/blog/categories error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/blog/categories — Admin only
// Body: { id }
// ---------------------------------------------------------------------------
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userRole = (session?.user as any)?.role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Category id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Nullify category_id on all posts that reference this category
    const { error: unlinkError } = await supabase
      .from('blog_posts')
      .update({ category_id: null })
      .eq('category_id', id)

    if (unlinkError) {
      console.error('Blog category unlink error:', unlinkError)
      return NextResponse.json({ error: 'Error unlinking posts from category' }, { status: 500 })
    }

    const { error } = await supabase.from('blog_categories').delete().eq('id', id)

    if (error) {
      console.error('Blog category delete error:', error)
      return NextResponse.json({ error: 'Error deleting category' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/blog/categories error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
