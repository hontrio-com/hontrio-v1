import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// GET /api/blog/posts/[id]
// ---------------------------------------------------------------------------
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const session = await getServerSession(authOptions)
    const userRole = (session?.user as any)?.role
    const isAdmin = userRole === 'admin'

    const supabase = isAdmin ? createAdminClient() : await createServerSupabaseClient()

    let query = supabase
      .from('blog_posts')
      .select(
        `
        *,
        blog_categories ( id, name, slug, color ),
        blog_posts_tags ( blog_tags ( id, name, slug ) )
        `
      )
      .eq('id', id)

    if (!isAdmin) {
      query = query.eq('status', 'published')
    }

    const { data: post, error } = await query.single()

    if (error || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    return NextResponse.json({ post })
  } catch (err) {
    console.error('GET /api/blog/posts/[id] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PUT /api/blog/posts/[id] — Admin only
// ---------------------------------------------------------------------------
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
      tags, // optional: string[] of tag ids — replaces existing tags
    } = body

    const supabase = createAdminClient()

    // Fetch the current post to check existing values
    const { data: existing, error: fetchError } = await supabase
      .from('blog_posts')
      .select('id, status, published_at, featured')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Recalculate read time if content provided
    const wordCount = (content ?? '').trim().split(/\s+/).filter(Boolean).length
    const read_time_minutes = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : undefined

    // Handle published_at: set only when transitioning to published and not already set
    let published_at: string | null | undefined = undefined
    if (status === 'published' && existing.published_at === null) {
      published_at = new Date().toISOString()
    } else if (status !== 'published') {
      // Keep existing published_at (don't reset it so history is preserved)
      published_at = undefined
    }

    // If setting featured=true, unset all others first
    if (featured === true && !existing.featured) {
      await supabase
        .from('blog_posts')
        .update({ featured: false })
        .eq('featured', true)
    }

    // Build update object — only include defined fields
    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (excerpt !== undefined) updateData.excerpt = excerpt
    if (content !== undefined) {
      updateData.content = content
      if (read_time_minutes !== undefined) updateData.read_time_minutes = read_time_minutes
    }
    if (cover_image_url !== undefined) updateData.cover_image_url = cover_image_url
    if (cover_image_alt !== undefined) updateData.cover_image_alt = cover_image_alt
    if (category_id !== undefined) updateData.category_id = category_id
    if (status !== undefined) updateData.status = status
    if (featured !== undefined) updateData.featured = featured
    if (seo_title !== undefined) updateData.seo_title = seo_title
    if (seo_description !== undefined) updateData.seo_description = seo_description
    if (seo_og_image_url !== undefined) updateData.seo_og_image_url = seo_og_image_url
    if (seo_keywords !== undefined) updateData.seo_keywords = seo_keywords
    if (published_at !== undefined) updateData.published_at = published_at
    updateData.updated_at = new Date().toISOString()

    const { data: post, error: updateError } = await supabase
      .from('blog_posts')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Blog post update error:', updateError)
      return NextResponse.json({ error: 'Error updating post' }, { status: 500 })
    }

    // Handle tags: replace all existing with new set
    if (Array.isArray(tags)) {
      // Delete existing tag associations
      const { error: deleteTagsError } = await supabase
        .from('blog_posts_tags')
        .delete()
        .eq('post_id', id)

      if (deleteTagsError) {
        console.error('Blog post tags delete error:', deleteTagsError)
      }

      // Insert new tags if any provided
      if (tags.length > 0) {
        const tagRows = tags.map((tag_id: string) => ({ post_id: id, tag_id }))
        const { error: insertTagsError } = await supabase
          .from('blog_posts_tags')
          .insert(tagRows)
        if (insertTagsError) {
          console.error('Blog post tags insert error:', insertTagsError)
        }
      }
    }

    return NextResponse.json({ post })
  } catch (err) {
    console.error('PUT /api/blog/posts/[id] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/blog/posts/[id] — Admin only
// ---------------------------------------------------------------------------
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const session = await getServerSession(authOptions)
    const userRole = (session?.user as any)?.role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()

    // Delete tag associations first (FK safety)
    await supabase.from('blog_posts_tags').delete().eq('post_id', id)

    const { error } = await supabase.from('blog_posts').delete().eq('id', id)

    if (error) {
      console.error('Blog post delete error:', error)
      return NextResponse.json({ error: 'Error deleting post' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/blog/posts/[id] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
