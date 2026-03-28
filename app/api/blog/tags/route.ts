import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import slugify from 'slugify'

// ---------------------------------------------------------------------------
// GET /api/blog/tags — Public
// Returns all tags with a count of published posts.
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''

    const supabase = await createServerSupabaseClient()

    let tagsQuery = supabase
      .from('blog_tags')
      .select('*')
      .order('name', { ascending: true })

    if (q) {
      tagsQuery = tagsQuery.ilike('name', `%${q}%`)
    }

    const { data: tags, error } = await tagsQuery

    if (error) {
      console.error('Blog tags fetch error:', error)
      return NextResponse.json({ error: 'Error loading tags' }, { status: 500 })
    }

    // To get an accurate published posts count per tag we run a dedicated query
    // using the admin client so we can filter on blog_posts.status cleanly.
    const supabaseAdmin = createAdminClient()
    const { data: countRows } = await supabaseAdmin
      .from('blog_posts_tags')
      .select('tag_id, blog_posts!inner( id )')
      .eq('blog_posts.status', 'published')

    // Build a map: tag_id → count
    const countMap: Record<string, number> = {}
    if (countRows) {
      for (const row of countRows as any[]) {
        countMap[row.tag_id] = (countMap[row.tag_id] ?? 0) + 1
      }
    }

    const result = (tags ?? []).map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      created_at: tag.created_at,
      posts_count: countMap[tag.id] ?? 0,
    }))

    return NextResponse.json({ tags: result })
  } catch (err) {
    console.error('GET /api/blog/tags error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/blog/tags — Admin only
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
        .from('blog_tags')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (!existing) break
      slug = `${baseSlug}-${suffix++}`
    }

    const { data: tag, error } = await supabase
      .from('blog_tags')
      .insert({
        name,
        slug,
        description: description ?? null,
        color: color ?? null,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Blog tag insert error:', error)
      return NextResponse.json({ error: 'Error creating tag' }, { status: 500 })
    }

    return NextResponse.json({ tag }, { status: 201 })
  } catch (err) {
    console.error('POST /api/blog/tags error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PUT /api/blog/tags — Admin only
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
      return NextResponse.json({ error: 'Tag id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (color !== undefined) updateData.color = color

    // Resolve slug
    if (slugOverride !== undefined) {
      updateData.slug = slugOverride
    } else if (name !== undefined) {
      const baseSlug = slugify(name, { lower: true, strict: true })
      let slug = baseSlug
      let suffix = 1
      while (true) {
        const { data: existing } = await supabase
          .from('blog_tags')
          .select('id')
          .eq('slug', slug)
          .neq('id', id)
          .maybeSingle()
        if (!existing) break
        slug = `${baseSlug}-${suffix++}`
      }
      updateData.slug = slug
    }

    const { data: tag, error } = await supabase
      .from('blog_tags')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Blog tag update error:', error)
      return NextResponse.json({ error: 'Error updating tag' }, { status: 500 })
    }

    return NextResponse.json({ tag })
  } catch (err) {
    console.error('PUT /api/blog/tags error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/blog/tags — Admin only
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
      return NextResponse.json({ error: 'Tag id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Remove all post-tag associations first
    const { error: unlinkError } = await supabase
      .from('blog_posts_tags')
      .delete()
      .eq('tag_id', id)

    if (unlinkError) {
      console.error('Blog tag unlink error:', unlinkError)
      return NextResponse.json({ error: 'Error unlinking posts from tag' }, { status: 500 })
    }

    const { error } = await supabase.from('blog_tags').delete().eq('id', id)

    if (error) {
      console.error('Blog tag delete error:', error)
      return NextResponse.json({ error: 'Error deleting tag' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/blog/tags error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
