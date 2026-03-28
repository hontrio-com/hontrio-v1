import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import slugify from 'slugify'

// ---------------------------------------------------------------------------
// GET /api/blog/posts
// Query params: status, category, tag, q, featured, page, limit
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userRole = (session?.user as any)?.role
    const isAdmin = userRole === 'admin'

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status') || 'published'
    const categorySlug = searchParams.get('category') || ''
    const tagSlug = searchParams.get('tag') || ''
    const q = searchParams.get('q') || ''
    const featuredParam = searchParams.get('featured') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '12')))
    const from = (page - 1) * limit
    const to = from + limit - 1

    const supabase = isAdmin ? createAdminClient() : await createServerSupabaseClient()

    let query = supabase
      .from('blog_posts')
      .select(
        `
        *,
        blog_categories ( id, name, slug, color ),
        blog_posts_tags ( blog_tags ( id, name, slug ) )
        `,
        { count: 'exact' }
      )

    // Non-admins can only see published posts
    if (!isAdmin) {
      query = query.eq('status', 'published')
    } else if (statusParam && statusParam !== 'all') {
      query = query.eq('status', statusParam)
    }

    // Filter by category slug (join through blog_categories)
    if (categorySlug) {
      // We need the category id first
      const supabaseAdmin = createAdminClient()
      const { data: cat } = await supabaseAdmin
        .from('blog_categories')
        .select('id')
        .eq('slug', categorySlug)
        .single()
      if (cat) {
        query = query.eq('category_id', cat.id)
      } else {
        // No matching category → return empty
        return NextResponse.json({ posts: [], total: 0, page, totalPages: 0 })
      }
    }

    // Filter by tag slug (join through blog_posts_tags + blog_tags)
    if (tagSlug) {
      const supabaseAdmin = createAdminClient()
      const { data: tag } = await supabaseAdmin
        .from('blog_tags')
        .select('id')
        .eq('slug', tagSlug)
        .single()
      if (tag) {
        // Get post ids that have this tag
        const { data: postTagRows } = await supabaseAdmin
          .from('blog_posts_tags')
          .select('post_id')
          .eq('tag_id', tag.id)
        const postIds = (postTagRows || []).map((r: any) => r.post_id)
        if (postIds.length === 0) {
          return NextResponse.json({ posts: [], total: 0, page, totalPages: 0 })
        }
        query = query.in('id', postIds)
      } else {
        return NextResponse.json({ posts: [], total: 0, page, totalPages: 0 })
      }
    }

    // Full-text search on title + excerpt
    if (q) {
      query = query.or(`title.ilike.%${q}%,excerpt.ilike.%${q}%`)
    }

    // Featured filter
    if (featuredParam === 'true') {
      query = query.eq('featured', true)
    } else if (featuredParam === 'false') {
      query = query.eq('featured', false)
    }

    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data: posts, error, count } = await query

    if (error) {
      console.error('Blog posts fetch error:', error)
      return NextResponse.json({ error: 'Error loading posts' }, { status: 500 })
    }

    const total = count ?? 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({ posts: posts ?? [], total, page, totalPages })
  } catch (err) {
    console.error('GET /api/blog/posts error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/blog/posts — Admin only
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userRole = (session?.user as any)?.role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      excerpt,
      content,
      cover_image_url,
      cover_image_alt,
      category_id,
      status,
      featured,
      seo_title,
      seo_description,
      seo_og_image_url,
      seo_keywords,
      tags, // optional: string[] of tag ids
    } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Generate a unique slug from title
    const baseSlug = slugify(title, { lower: true, strict: true })
    let slug = baseSlug
    let suffix = 1
    while (true) {
      const { data: existing } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (!existing) break
      slug = `${baseSlug}-${suffix++}`
    }

    // Calculate read time
    const wordCount = (content ?? '').trim().split(/\s+/).filter(Boolean).length
    const read_time_minutes = Math.max(1, Math.ceil(wordCount / 200))

    // Handle published_at
    const now = new Date().toISOString()
    const published_at =
      status === 'published' ? now : null

    // If featured, unset all other featured posts first
    if (featured === true) {
      await supabase
        .from('blog_posts')
        .update({ featured: false })
        .eq('featured', true)
    }

    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        title,
        slug,
        excerpt: excerpt ?? null,
        content: content ?? null,
        cover_image_url: cover_image_url ?? null,
        cover_image_alt: cover_image_alt ?? null,
        category_id: category_id ?? null,
        status: status ?? 'draft',
        featured: featured ?? false,
        read_time_minutes,
        published_at,
        seo_title: seo_title ?? null,
        seo_description: seo_description ?? null,
        seo_og_image_url: seo_og_image_url ?? null,
        seo_keywords: seo_keywords ?? null,
        views_count: 0,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Blog post insert error:', error)
      return NextResponse.json({ error: 'Error creating post' }, { status: 500 })
    }

    // Insert tags if provided
    if (Array.isArray(tags) && tags.length > 0) {
      const tagRows = tags.map((tag_id: string) => ({ post_id: post.id, tag_id }))
      const { error: tagError } = await supabase.from('blog_posts_tags').insert(tagRows)
      if (tagError) {
        console.error('Blog post tags insert error:', tagError)
      }
    }

    return NextResponse.json({ post }, { status: 201 })
  } catch (err) {
    console.error('POST /api/blog/posts error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
