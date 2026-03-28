import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// In-memory rate-limit store: Map<"ip:slug", timestamp>
// Rejects duplicate view increments from the same IP + slug within 24 hours.
// NOTE: This is per-instance (process) memory. It is intentionally simple and
// will reset on server restart / cold starts. For persistent dedup use Redis.
// ---------------------------------------------------------------------------
const viewRateLimit = new Map<string, number>()
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

// Periodic cleanup so the Map doesn't grow unbounded in long-lived processes
setInterval(() => {
  const now = Date.now()
  for (const [key, ts] of viewRateLimit.entries()) {
    if (now - ts > RATE_LIMIT_WINDOW_MS) {
      viewRateLimit.delete(key)
    }
  }
}, 60 * 60 * 1000) // run every hour

// ---------------------------------------------------------------------------
// POST /api/blog/views/[slug] — Public, no auth required
// Increments views_count for the published post with the given slug.
// ---------------------------------------------------------------------------
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    // Derive client IP (best-effort behind proxies / Vercel)
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'

    const rateLimitKey = `${ip}:${slug}`
    const now = Date.now()
    const lastSeen = viewRateLimit.get(rateLimitKey)

    if (lastSeen !== undefined && now - lastSeen < RATE_LIMIT_WINDOW_MS) {
      // Already counted this view within the 24-hour window — silently succeed
      return NextResponse.json({ success: true })
    }

    // Record the timestamp before the DB call to avoid race on slow queries
    viewRateLimit.set(rateLimitKey, now)

    const supabase = createAdminClient()

    // Fetch the current views_count for the published post
    const { data: post, error: fetchError } = await supabase
      .from('blog_posts')
      .select('id, views_count')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    if (fetchError || !post) {
      viewRateLimit.delete(rateLimitKey)
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Increment views_count
    const { error: updateError } = await supabase
      .from('blog_posts')
      .update({ views_count: (post.views_count ?? 0) + 1 })
      .eq('id', post.id)

    if (updateError) {
      console.error('Blog view increment error:', updateError)
      viewRateLimit.delete(rateLimitKey)
      return NextResponse.json({ error: 'Error incrementing views' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/blog/views/[slug] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
