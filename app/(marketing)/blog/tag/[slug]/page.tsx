'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, useReducedMotion, type MotionProps } from 'framer-motion'
import { BookOpen, Clock, ChevronLeft, ChevronRight, Search, SearchX, Hash } from 'lucide-react'
import { format } from 'date-fns'
import { ro as roLocale } from 'date-fns/locale'
import { useLocale } from '@/lib/i18n/context'

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

// ─── Bilingual content ────────────────────────────────────────────────────────

const T = {
  ro: {
    breadcrumbBlog: 'Blog',
    breadcrumbTag: 'Tag',
    tagLabel: 'Tag',
    articles: 'articole',
    headingPrefix: 'Articole cu tagul',
    searchPlaceholder: 'Cauta articole...',
    noResults: 'Niciun articol gasit',
    noResultsSub: 'Incearca alte cuvinte cheie.',
    clearSearch: 'Sterge cautarea',
    emptyTitle: 'Niciun articol momentan',
    emptySub: 'Nu exista articole publicate cu acest tag inca.',
    backToBlog: 'Inapoi la blog',
    minRead: 'min citire',
    page: 'Pagina',
    of: 'din',
    prevPage: 'Inainte',
    nextPage: 'Urmator',
  },
  en: {
    breadcrumbBlog: 'Blog',
    breadcrumbTag: 'Tag',
    tagLabel: 'Tag',
    articles: 'articles',
    headingPrefix: 'Articles tagged',
    searchPlaceholder: 'Search articles...',
    noResults: 'No articles found',
    noResultsSub: 'Try different keywords.',
    clearSearch: 'Clear search',
    emptyTitle: 'No articles yet',
    emptySub: 'No published articles with this tag yet.',
    backToBlog: 'Back to blog',
    minRead: 'min read',
    page: 'Page',
    of: 'of',
    prevPage: 'Previous',
    nextPage: 'Next',
  },
}

// ─── Animation helper ─────────────────────────────────────────────────────────

function fadeUp(reduced: boolean, delay = 0): MotionProps {
  if (reduced) return {}
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] as [number, number, number, number], delay },
  }
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post, isRO, minRead }: { post: BlogPost; isRO: boolean; minRead: string }) {
  const dateStr = post.published_at
    ? format(new Date(post.published_at), 'dd MMM yyyy', { locale: isRO ? roLocale : undefined })
    : null

  const displayTags = (post.tags ?? []).slice(0, 3)
  const extraTags = (post.tags?.length ?? 0) - 3

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col rounded-2xl border border-neutral-200 bg-white hover:border-neutral-400 hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      <div className="aspect-video bg-neutral-100 overflow-hidden shrink-0">
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt={post.cover_image_alt ?? post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-neutral-300" />
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-5">
        {/* Category badge */}
        {post.category && (
          <div className="mb-3">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide"
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

        <h3 className="text-[15px] font-bold text-neutral-900 leading-snug line-clamp-2 mb-2 group-hover:text-neutral-700 transition-colors">
          {post.title}
        </h3>

        {post.excerpt && (
          <p
            className="text-[13px] text-neutral-500 leading-relaxed line-clamp-3 flex-1 mb-3"
            style={{ opacity: 0.65 }}
          >
            {post.excerpt}
          </p>
        )}

        {displayTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {displayTags.map((tag) => (
              <Link
                key={tag.id}
                href={`/blog/tag/${tag.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-[11px] font-medium hover:bg-neutral-200 transition-colors"
              >
                {tag.name}
              </Link>
            ))}
            {extraTags > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-[11px] font-medium">
                +{extraTags}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 text-[12px] text-neutral-400 pt-3 border-t border-neutral-100 mt-auto">
          {dateStr && <span>{dateStr}</span>}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {post.read_time_minutes} {minRead}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const LIMIT = 12

function BlogTagPageInner() {
  const { locale } = useLocale()
  const isRO = locale === 'ro'
  const t = isRO ? T.ro : T.en
  const reduced = useReducedMotion() ?? false
  const params = useParams()
  const slug = params.slug as string
  const router = useRouter()
  const searchParams = useSearchParams()

  const qParam = searchParams.get('q') ?? ''
  const pageParam = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  const [search, setSearch] = useState(qParam)
  const [tag, setTag] = useState<BlogTag | null>(null)
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const totalPages = Math.ceil(total / LIMIT)

  // Fetch tag info
  useEffect(() => {
    fetch('/api/blog/tags')
      .then((r) => r.json())
      .then((json) => {
        const list: BlogTag[] = json.tags ?? json ?? []
        const found = list.find((tg) => tg.slug === slug)
        if (found) setTag(found)
      })
      .catch(() => undefined)
  }, [slug])

  // Fetch posts
  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams()
    p.set('tag', slug)
    p.set('page', String(pageParam))
    p.set('limit', String(LIMIT))
    p.set('status', 'published')
    p.set('locale', locale)
    if (qParam) p.set('q', qParam)

    fetch(`/api/blog/posts?${p.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        setPosts(json.posts ?? [])
        setTotal(json.total ?? 0)
      })
      .catch(() => { setPosts([]); setTotal(0) })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, qParam, pageParam])

  const pushParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString())
      for (const [key, val] of Object.entries(updates)) {
        if (val) p.set(key, val)
        else p.delete(key)
      }
      p.delete('page')
      router.push(`/blog/tag/${slug}?${p.toString()}`)
    },
    [searchParams, router, slug]
  )

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      pushParams({ q: value || undefined })
    }, 300)
  }

  const handlePage = (p: number) => {
    const ps = new URLSearchParams(searchParams.toString())
    ps.set('page', String(p))
    router.push(`/blog/tag/${slug}?${ps.toString()}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const displayName = tag?.name ?? slug

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ── */}
      <section className="relative pt-16 pb-12 bg-white border-b border-neutral-100 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative max-w-4xl mx-auto px-6">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12.5px] text-neutral-400 mb-8 flex-wrap">
            <Link href="/blog" className="hover:text-neutral-700 transition-colors">
              {t.breadcrumbBlog}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-neutral-400">{t.breadcrumbTag}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-neutral-500">#{displayName}</span>
          </nav>

          <motion.div
            {...(reduced ? {} : {
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
            })}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
                <Hash className="h-5 w-5 text-neutral-500" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                  {t.tagLabel}
                </p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[13px] font-bold bg-neutral-100 text-neutral-700">
                    #{displayName}
                  </span>
                  {total > 0 && (
                    <span className="text-[13px] text-neutral-400">{total} {t.articles}</span>
                  )}
                </div>
              </div>
            </div>

            <h1 className="text-[28px] md:text-[40px] font-extrabold text-neutral-900 tracking-tight leading-[1.1] mb-4">
              {t.headingPrefix}{' '}
              <span className="text-neutral-500">#{displayName}</span>
            </h1>

            {/* Search */}
            <div className="max-w-md">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/[0.06] transition-all"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Post grid ── */}
      <section className="max-w-7xl mx-auto px-6 py-12">

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden animate-pulse">
                <div className="aspect-video bg-neutral-100" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-neutral-100 rounded" />
                  <div className="h-4 bg-neutral-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && posts.length === 0 && qParam && (
          <motion.div {...fadeUp(reduced, 0)} className="flex flex-col items-center justify-center py-24 text-center">
            <SearchX className="h-12 w-12 text-neutral-300 mb-4" />
            <h2 className="text-xl font-bold text-neutral-900 mb-2">{t.noResults}</h2>
            <p className="text-neutral-500 text-[15px] mb-6 max-w-sm">{t.noResultsSub}</p>
            <button
              onClick={() => { setSearch(''); pushParams({ q: undefined }) }}
              className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-[13px] font-semibold hover:bg-neutral-800 transition-colors"
            >
              {t.clearSearch}
            </button>
          </motion.div>
        )}

        {!loading && posts.length === 0 && !qParam && (
          <motion.div {...fadeUp(reduced, 0)} className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen className="h-12 w-12 text-neutral-300 mb-4" />
            <h2 className="text-xl font-bold text-neutral-900 mb-2">{t.emptyTitle}</h2>
            <p className="text-neutral-500 text-[15px] mb-6 max-w-sm">{t.emptySub}</p>
            <Link
              href="/blog"
              className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-[13px] font-semibold hover:bg-neutral-800 transition-colors"
            >
              {t.backToBlog}
            </Link>
          </motion.div>
        )}

        {!loading && posts.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post, i) => (
                <motion.div key={post.id} {...fadeUp(reduced, Math.min(i * 0.05, 0.3))}>
                  <PostCard post={post} isRO={isRO} minRead={t.minRead} />
                </motion.div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-12">
                <button
                  onClick={() => handlePage(pageParam - 1)}
                  disabled={pageParam <= 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 text-[13px] font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t.prevPage}
                </button>
                <span className="text-[13px] text-neutral-500 px-2">
                  {t.page} {pageParam} {t.of} {totalPages}
                </span>
                <button
                  onClick={() => handlePage(pageParam + 1)}
                  disabled={pageParam >= totalPages}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 text-[13px] font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t.nextPage}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default function BlogTagPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <BlogTagPageInner />
    </Suspense>
  )
}
