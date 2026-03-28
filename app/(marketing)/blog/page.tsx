'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, useReducedMotion, type MotionProps } from 'framer-motion'
import {
  BookOpen, Search, SearchX, ArrowRight, Clock, Eye, ChevronLeft, ChevronRight,
} from 'lucide-react'
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

interface PostsResponse {
  posts: BlogPost[]
  total: number
  page: number
  limit: number
}

// ─── Bilingual content ────────────────────────────────────────────────────────

const T = {
  ro: {
    heroBadge: 'Blog Hontrio',
    heroH1: 'Resurse si strategii pentru magazinul tau online',
    heroSub: 'Ghiduri practice, studii de caz si sfaturi de la echipa Hontrio pentru a-ti creste afacerea online.',
    searchPlaceholder: 'Cauta articole...',
    allCategories: 'Toate',
    featuredLabel: 'ARTICOL RECOMANDAT',
    readArticle: 'Citeste articolul',
    noResults: 'Niciun articol gasit',
    noResultsSub: 'Incearca alte cuvinte cheie sau sterge filtrele active.',
    clearFilters: 'Sterge filtrele',
    minRead: 'min citire',
    page: 'Pagina',
    of: 'din',
    prevPage: 'Inainte',
    nextPage: 'Urmator',
  },
  en: {
    heroBadge: 'Hontrio Blog',
    heroH1: 'Resources and strategies for your online store',
    heroSub: 'Practical guides, case studies and tips from the Hontrio team to grow your online business.',
    searchPlaceholder: 'Search articles...',
    allCategories: 'All',
    featuredLabel: 'FEATURED ARTICLE',
    readArticle: 'Read article',
    noResults: 'No articles found',
    noResultsSub: 'Try different keywords or clear your active filters.',
    clearFilters: 'Clear filters',
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

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category?: BlogCategory }) {
  if (!category) return null
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide"
      style={
        category.color
          ? { backgroundColor: `${category.color}20`, color: category.color }
          : { backgroundColor: '#f5f5f5', color: '#525252' }
      }
    >
      {category.name}
    </span>
  )
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
        <div className="mb-3">
          <CategoryBadge category={post.category} />
        </div>

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
              <span
                key={tag.id}
                className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-[11px] font-medium"
              >
                {tag.name}
              </span>
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

// ─── Featured post card ───────────────────────────────────────────────────────

function FeaturedPostCard({
  post, isRO, label, readLabel,
}: {
  post: BlogPost; isRO: boolean; label: string; readLabel: string
}) {
  const dateStr = post.published_at
    ? format(new Date(post.published_at), 'dd MMM yyyy', { locale: isRO ? roLocale : undefined })
    : null

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden grid md:grid-cols-[55%_45%] shadow-sm hover:shadow-md hover:border-neutral-400 transition-all duration-200">
      <div className="aspect-video md:aspect-auto bg-neutral-100 overflow-hidden min-h-[220px]">
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt={post.cover_image_alt ?? post.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-neutral-300" />
          </div>
        )}
      </div>

      <div className="flex flex-col justify-between p-8">
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <CategoryBadge category={post.category} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{label}</span>
          </div>
          <h2 className="text-[22px] md:text-[26px] font-extrabold text-neutral-900 leading-snug tracking-tight mb-3">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-[14px] text-neutral-500 leading-relaxed line-clamp-3">{post.excerpt}</p>
          )}
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2.5 mb-5">
            {post.author_avatar_url ? (
              <img
                src={post.author_avatar_url}
                alt={post.author_name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-[12px] font-bold text-neutral-500">
                {post.author_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex items-center gap-2 text-[13px] text-neutral-500">
              <span className="font-semibold text-neutral-700">{post.author_name}</span>
              {dateStr && (
                <>
                  <span className="w-1 h-1 rounded-full bg-neutral-300" />
                  <span>{dateStr}</span>
                </>
              )}
            </div>
          </div>

          <Link
            href={`/blog/${post.slug}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-[13px] font-semibold hover:bg-neutral-800 active:scale-[0.98] transition-all duration-150 shadow-sm"
          >
            {readLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page, total, limit, onPage, prevLabel, nextLabel, pageLabel, ofLabel,
}: {
  page: number; total: number; limit: number
  onPage: (p: number) => void
  prevLabel: string; nextLabel: string; pageLabel: string; ofLabel: string
}) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-3 mt-12">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 text-[13px] font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        {prevLabel}
      </button>

      <span className="text-[13px] text-neutral-500 px-2">
        {pageLabel} {page} {ofLabel} {totalPages}
      </span>

      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 text-[13px] font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {nextLabel}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const LIMIT = 12

function BlogPageInner() {
  const { locale } = useLocale()
  const isRO = locale === 'ro'
  const t = isRO ? T.ro : T.en
  const reduced = useReducedMotion() ?? false
  const router = useRouter()
  const searchParams = useSearchParams()

  const qParam = searchParams.get('q') ?? ''
  const categoryParam = searchParams.get('category') ?? ''
  const pageParam = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  const [search, setSearch] = useState(qParam)
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [data, setData] = useState<PostsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Push updated URL params
  const pushParams = useCallback(
    (updates: Record<string, string | undefined>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, val] of Object.entries(updates)) {
        if (val) params.set(key, val)
        else params.delete(key)
      }
      if (resetPage) params.delete('page')
      router.push(`/blog?${params.toString()}`)
    },
    [searchParams, router]
  )

  // Fetch categories once
  useEffect(() => {
    fetch('/api/blog/categories')
      .then((r) => r.json())
      .then((json) => setCategories(json.categories ?? json ?? []))
      .catch(() => setCategories([]))
  }, [])

  // Sync search input when URL changes externally
  useEffect(() => {
    setSearch(qParam)
  }, [qParam])

  // Fetch posts when URL params change
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (qParam) params.set('q', qParam)
    if (categoryParam) params.set('category', categoryParam)
    params.set('page', String(pageParam))
    params.set('limit', String(LIMIT))
    params.set('status', 'published')

    fetch(`/api/blog/posts?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch(() => setData({ posts: [], total: 0, page: 1, limit: LIMIT }))
      .finally(() => setLoading(false))
  }, [qParam, categoryParam, pageParam])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      pushParams({ q: value || undefined })
    }, 300)
  }

  const handleCategoryClick = (slug: string) => {
    pushParams({ category: slug || undefined })
  }

  const handlePage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.push(`/blog?${params.toString()}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleClear = () => {
    setSearch('')
    router.push('/blog')
  }

  const posts = data?.posts ?? []
  const featured = posts.find((p) => p.featured)
  const grid = featured ? posts.filter((p) => p.id !== featured.id) : posts
  const hasFilters = !!(qParam || categoryParam)

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ── */}
      <section className="relative pt-20 pb-14 bg-white overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-neutral-900/[0.03] rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <motion.div {...fadeUp(reduced, 0)}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/[0.06] border border-neutral-900/[0.12] text-xs font-semibold text-neutral-700 mb-7">
              <BookOpen className="h-3.5 w-3.5" />
              {t.heroBadge}
            </div>
          </motion.div>

          <motion.h1
            {...fadeUp(reduced, 0.08)}
            className="text-[32px] md:text-[48px] font-extrabold text-neutral-900 tracking-tight leading-[1.1] mb-5"
          >
            {t.heroH1}
          </motion.h1>

          <motion.p
            {...fadeUp(reduced, 0.16)}
            className="text-[17px] text-neutral-500 leading-relaxed mb-8 max-w-xl mx-auto"
          >
            {t.heroSub}
          </motion.p>

          {/* Search bar */}
          <motion.div {...fadeUp(reduced, 0.22)} className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/[0.06] transition-all"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Category filter bar ── */}
      {categories.length > 0 && (
        <div className="sticky top-14 z-30 bg-white/90 backdrop-blur-md border-b border-neutral-100">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => handleCategoryClick('')}
              className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-medium border transition-all duration-150 ${
                !categoryParam
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
              }`}
            >
              {t.allCategories}
            </button>
            {categories.map((cat) => {
              const active = categoryParam === cat.slug
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.slug)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-medium border transition-all duration-150 ${
                    active
                      ? 'text-white border-transparent'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                  }`}
                  style={
                    active && cat.color
                      ? { backgroundColor: cat.color, borderColor: cat.color }
                      : active
                      ? { backgroundColor: '#171717', borderColor: '#171717' }
                      : undefined
                  }
                >
                  {cat.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <section className="max-w-7xl mx-auto px-6 py-12">

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden animate-pulse">
                <div className="aspect-video bg-neutral-100" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-neutral-100 rounded w-1/4" />
                  <div className="h-5 bg-neutral-100 rounded" />
                  <div className="h-4 bg-neutral-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && posts.length === 0 && (
          <motion.div
            {...fadeUp(reduced, 0)}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <SearchX className="h-12 w-12 text-neutral-300 mb-4" />
            <h2 className="text-xl font-bold text-neutral-900 mb-2">{t.noResults}</h2>
            <p className="text-neutral-500 text-[15px] mb-6 max-w-sm">{t.noResultsSub}</p>
            {hasFilters && (
              <button
                onClick={handleClear}
                className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-[13px] font-semibold hover:bg-neutral-800 transition-colors"
              >
                {t.clearFilters}
              </button>
            )}
          </motion.div>
        )}

        {/* Posts */}
        {!loading && posts.length > 0 && (
          <>
            {/* Featured post */}
            {featured && (
              <motion.div {...fadeUp(reduced, 0)} className="mb-12">
                <FeaturedPostCard
                  post={featured}
                  isRO={isRO}
                  label={t.featuredLabel}
                  readLabel={t.readArticle}
                />
              </motion.div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {grid.map((post, i) => (
                <motion.div key={post.id} {...fadeUp(reduced, Math.min(i * 0.05, 0.3))}>
                  <PostCard post={post} isRO={isRO} minRead={t.minRead} />
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {data && (
              <Pagination
                page={data.page}
                total={data.total}
                limit={data.limit}
                onPage={handlePage}
                prevLabel={t.prevPage}
                nextLabel={t.nextPage}
                pageLabel={t.page}
                ofLabel={t.of}
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default function BlogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <BlogPageInner />
    </Suspense>
  )
}
