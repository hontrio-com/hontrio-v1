import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Clock, Eye, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { ro as roLocale } from 'date-fns/locale'
import { createAdminClient } from '@/lib/supabase/admin'
import { ShareButtons, ViewTracker } from './_components'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlogCategory {
  id: string
  name: string
  slug: string
  description?: string
  color: string
  posts_count?: number
}

interface BlogTag {
  id: string
  name: string
  slug: string
  posts_count?: number
}

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt?: string
  content: string
  cover_image_url?: string
  cover_image_alt?: string
  category_id?: string
  category?: BlogCategory
  author_name: string
  author_avatar_url?: string
  status: 'draft' | 'published' | 'archived'
  featured: boolean
  read_time_minutes: number
  views_count: number
  seo_title?: string
  seo_description?: string
  seo_og_image_url?: string
  seo_keywords?: string
  published_at?: string
  created_at: string
  updated_at: string
  tags?: BlogTag[]
}

// ─── HTML Sanitizer ───────────────────────────────────────────────────────────
// Strips dangerous tags injected by AI-generated content (style, script, html, head, body)

function sanitizeArticleHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?(html|head|body|meta|link|title)[^>]*>/gi, '')
    .replace(/(<[^>]+)\s+style\s*=\s*(?:"[^"]*"|'[^']*')/gi, '$1')
    .trim()
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('blog_posts')
      .select(`
        *,
        category:blog_categories(*),
        tags:blog_posts_tags(tag:blog_tags(*))
      `)
      .eq('slug', slug)
      .single()

    if (error || !data) return null

    const tags = Array.isArray(data.tags)
      ? (data.tags as Array<{ tag: BlogTag }>).map((t) => t.tag).filter(Boolean)
      : []

    return { ...data, tags } as BlogPost
  } catch {
    return null
  }
}

async function getRelatedPosts(categoryId: string, excludeId: string): Promise<BlogPost[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, cover_image_alt, published_at, read_time_minutes, category:blog_categories(*)')
      .eq('category_id', categoryId)
      .eq('status', 'published')
      .neq('id', excludeId)
      .order('published_at', { ascending: false })
      .limit(3)

    return (data ?? []) as unknown as BlogPost[]
  } catch {
    return []
  }
}

// ─── generateStaticParams ─────────────────────────────────────────────────────

export async function generateStaticParams() {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('blog_posts')
      .select('slug')
      .eq('status', 'published')
    return (data ?? []).map((r: { slug: string }) => ({ slug: r.slug }))
  } catch {
    return []
  }
}

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post || post.status !== 'published') {
    return { title: 'Articol negasit | Blog Hontrio' }
  }

  const title = post.seo_title ?? post.title
  const description = post.seo_description ?? post.excerpt ?? ''
  const image = post.seo_og_image_url ?? post.cover_image_url
  const canonical = `https://hontrio.com/blog/${post.slug}`

  return {
    title: `${title} | Blog Hontrio`,
    description,
    keywords: post.seo_keywords ?? undefined,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: canonical,
      title,
      description,
      images: image ? [{ url: image, width: 1200, height: 630, alt: post.cover_image_alt ?? title }] : [],
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      authors: [post.author_name],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : [],
    },
  }
}

// ─── Related post card ────────────────────────────────────────────────────────

function RelatedCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col rounded-xl border border-neutral-200 bg-white hover:border-neutral-400 hover:shadow-sm transition-all duration-200 overflow-hidden"
    >
      <div className="aspect-video bg-neutral-100 overflow-hidden">
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt={post.cover_image_alt ?? post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-neutral-100" />
        )}
      </div>
      <div className="p-4">
        {post.category && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide mb-2"
            style={
              post.category.color
                ? { backgroundColor: `${post.category.color}20`, color: post.category.color }
                : { backgroundColor: '#f5f5f5', color: '#525252' }
            }
          >
            {post.category.name}
          </span>
        )}
        <h3 className="text-[14px] font-bold text-neutral-900 line-clamp-2 leading-snug group-hover:text-neutral-700 transition-colors">
          {post.title}
        </h3>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BlogPostPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post || post.status !== 'published') {
    notFound()
  }

  const relatedPosts = post.category_id
    ? await getRelatedPosts(post.category_id, post.id)
    : []

  const canonicalUrl = `https://hontrio.com/blog/${post.slug}`

  const dateStr = post.published_at
    ? format(new Date(post.published_at), 'dd MMM yyyy', { locale: roLocale })
    : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.seo_title ?? post.title,
    description: post.seo_description ?? post.excerpt ?? '',
    image: post.cover_image_url ?? post.seo_og_image_url,
    datePublished: post.published_at ?? post.created_at,
    dateModified: post.updated_at,
    author: {
      '@type': 'Person',
      name: post.author_name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Hontrio',
      logo: { '@type': 'ImageObject', url: 'https://hontrio.com/logo-black.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    ...(post.category ? { articleSection: post.category.name } : {}),
    ...(post.tags && post.tags.length > 0
      ? { keywords: post.tags.map((tag) => tag.name).join(', ') }
      : {}),
  }

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* View counter (client) */}
      <ViewTracker slug={slug} />

      <article className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-6 py-12">

          {/* ── 1. Breadcrumb ── */}
          <nav className="flex items-center gap-1.5 text-[12.5px] text-neutral-400 mb-10 flex-wrap">
            <Link href="/blog" className="hover:text-neutral-700 transition-colors">
              Blog
            </Link>
            {post.category && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <Link
                  href={`/blog/category/${post.category.slug}`}
                  className="hover:text-neutral-700 transition-colors"
                >
                  {post.category.name}
                </Link>
              </>
            )}
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-neutral-500 truncate max-w-[260px]">{post.title}</span>
          </nav>

          {/* ── 2. Header ── */}
          <header className="max-w-3xl mx-auto text-center mb-10">
            {post.category && (
              <div className="mb-5">
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold uppercase tracking-wide"
                  style={
                    post.category.color
                      ? { backgroundColor: `${post.category.color}20`, color: post.category.color }
                      : { backgroundColor: '#f5f5f5', color: '#525252' }
                  }
                >
                  {post.category.name}
                </span>
              </div>
            )}

            <h1
              className="font-extrabold text-neutral-900 tracking-tight leading-[1.1] mb-5"
              style={{ fontSize: 'clamp(28px, 5vw, 44px)' }}
            >
              {post.title}
            </h1>

            {post.excerpt && (
              <p
                className="text-[17px] text-neutral-500 leading-relaxed italic mb-7"
                style={{ opacity: 0.7 }}
              >
                {post.excerpt}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-2 text-[13px] text-neutral-500 mb-6">
              <div className="flex items-center gap-2">
                {post.author_avatar_url ? (
                  <img
                    src={post.author_avatar_url}
                    alt={post.author_name}
                    className="w-8 h-8 rounded-full object-cover"
                    width={32}
                    height={32}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-[12px] font-bold text-neutral-500">
                    {post.author_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-semibold text-neutral-700">{post.author_name}</span>
              </div>

              {dateStr && (
                <>
                  <span className="w-1 h-1 rounded-full bg-neutral-300" />
                  <span>{dateStr}</span>
                </>
              )}

              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {post.read_time_minutes} min
              </span>

              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {post.views_count.toLocaleString()}
              </span>
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex items-center justify-center flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/blog/tag/${tag.slug}`}
                    className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-500 text-[12px] font-medium hover:bg-neutral-200 hover:text-neutral-700 transition-colors"
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            )}
          </header>

          {/* ── 3. Cover image ── */}
          {post.cover_image_url && (
            <figure className="max-w-4xl mx-auto mb-12">
              <div className="rounded-2xl overflow-hidden aspect-video">
                <img
                  src={post.cover_image_url}
                  alt={post.cover_image_alt ?? post.title}
                  className="w-full h-full object-cover"
                  width={896}
                  height={504}
                />
              </div>
              {post.cover_image_alt && (
                <figcaption className="text-center text-[12px] text-neutral-400 mt-3">
                  {post.cover_image_alt}
                </figcaption>
              )}
            </figure>
          )}

          {/* ── 4. Content ── */}
          <div className="max-w-2xl mx-auto mb-16">
            <div
              className="hblog-prose"
              dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(post.content) }}
            />
          </div>

          {/* ── 5. Share section ── */}
          <div className="max-w-2xl mx-auto mb-16">
            <div className="border-t border-neutral-200 pt-8">
              <p className="text-[13px] font-semibold text-neutral-500 uppercase tracking-widest mb-4">
                Distribuie acest articol / Share this article
              </p>
              <ShareButtons title={post.title} url={canonicalUrl} />
            </div>
          </div>

          {/* ── 6. Related posts ── */}
          {relatedPosts.length > 0 && (
            <div className="max-w-4xl mx-auto">
              <div className="border-t border-neutral-200 pt-12">
                <h2 className="text-[20px] font-bold text-neutral-900 mb-6">
                  {post.category
                    ? `Mai multe din ${post.category.name}`
                    : 'Articole similare'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {relatedPosts.map((related) => (
                    <RelatedCard key={related.id} post={related} />
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </article>
    </>
  )
}
