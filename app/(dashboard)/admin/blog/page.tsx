'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Tag, Search, FileText, Eye, Pencil, Trash2,
  ExternalLink, Star, ChevronLeft, ChevronRight, X,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

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
  cover_image_url?: string
  status: 'draft' | 'published' | 'archived'
  featured: boolean
  read_time_minutes: number
  views_count: number
  published_at?: string
  created_at: string
  updated_at: string
  category?: BlogCategory
  tags?: BlogTag[]
}

interface Stats {
  total: number
  published: number
  drafts: number
  totalViews: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: BlogPost['status'] }) {
  const map = {
    draft: 'bg-neutral-100 text-neutral-600',
    published: 'bg-green-50 text-green-700',
    archived: 'bg-orange-50 text-orange-700',
  }
  const labels = { draft: 'Draft', published: 'Publicat', archived: 'Arhivat' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  )
}

// ─── Delete modal ────────────────────────────────────────────────────────────

function DeleteModal({
  post,
  onCancel,
  onConfirm,
  loading,
}: {
  post: BlogPost
  onCancel: () => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
      >
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-[17px] font-bold text-neutral-900">Sterge articolul?</h2>
          <button onClick={onCancel} className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-neutral-500 mb-1">
          <span className="font-medium text-neutral-700">&quot;{post.title}&quot;</span>
        </p>
        <p className="text-sm text-neutral-400 mb-6">Aceasta actiune este ireversibila.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Anuleaza
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Se sterge...' : 'Sterge definitiv'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminBlogPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [posts, setPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, drafts: 0, totalViews: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auth guard
  useEffect(() => {
    if (sessionStatus === 'loading') return
    if ((session?.user as any)?.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [session, sessionStatus, router])

  // Fetch categories once
  useEffect(() => {
    fetch('/api/blog/categories', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setCategories(d.categories || []))
      .catch(() => {})
  }, [])

  const fetchPosts = useCallback(async (q: string, status: string, cat: string, pg: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), limit: '15' })
      if (status && status !== 'all') params.set('status', status)
      if (cat) params.set('category', cat)
      if (q) params.set('q', q)
      const res = await fetch(`/api/blog/posts?${params}`, { credentials: 'include' })
      const data = await res.json()
      const raw: any[] = data.posts || []
      const mapped: BlogPost[] = raw.map((p: any) => ({
        ...p,
        category: p.blog_categories ?? undefined,
        tags: (p.blog_posts_tags || []).map((pt: any) => pt.blog_tags).filter(Boolean),
      }))
      setPosts(mapped)
      setTotalPages(data.totalPages || 1)

      // Build stats from full fetch (all statuses)
      if (status === 'all' && !q && !cat && pg === 1) {
        const allRes = await fetch('/api/blog/posts?limit=1000', { credentials: 'include' })
        const allData = await allRes.json()
        const allPosts: any[] = allData.posts || []
        setStats({
          total: allData.total || 0,
          published: allPosts.filter((p: any) => p.status === 'published').length,
          drafts: allPosts.filter((p: any) => p.status === 'draft').length,
          totalViews: allPosts.reduce((acc: number, p: any) => acc + (p.views_count || 0), 0),
        })
      }
    } catch {
      // silently ignore network errors
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      fetchPosts(search, statusFilter, categoryFilter, 1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, statusFilter, categoryFilter, fetchPosts])

  // Re-fetch on page change
  useEffect(() => {
    fetchPosts(search, statusFilter, categoryFilter, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  async function toggleFeatured(post: BlogPost) {
    const optimistic = posts.map(p => p.id === post.id ? { ...p, featured: !p.featured } : p)
    setPosts(optimistic)
    try {
      await fetch(`/api/blog/posts/${post.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: !post.featured }),
      })
    } catch {
      setPosts(posts) // revert on error
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await fetch(`/api/blog/posts/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setPosts(prev => prev.filter(p => p.id !== deleteTarget.id))
      setStats(prev => ({ ...prev, total: prev.total - 1 }))
      setDeleteTarget(null)
    } catch {
      // silently ignore
    } finally {
      setDeleteLoading(false)
    }
  }

  if (sessionStatus === 'loading') return null

  const isEmpty = !loading && posts.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 style={{ fontSize: 28, fontWeight: 800 }} className="text-neutral-900">Blog</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/blog/categories">
            <button className="flex items-center gap-2 h-9 px-4 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
              <Tag className="h-4 w-4" />
              Categorii
            </button>
          </Link>
          <Link href="/admin/blog/new">
            <button className="flex items-center gap-2 h-9 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium transition-colors">
              <Plus className="h-4 w-4" />
              Articol nou
            </button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total articole', value: stats.total },
          { label: 'Publicate', value: stats.published },
          { label: 'Draft-uri', value: stats.drafts },
          { label: 'Total vizualizari', value: stats.totalViews },
        ].map(s => (
          <div key={s.label} className="bg-white border border-neutral-200 rounded-xl p-4">
            <p className="text-xs text-neutral-400 opacity-50 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-neutral-900">{s.value.toLocaleString('ro-RO')}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cauta articol..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 transition-colors"
          >
            <option value="all">Toate</option>
            <option value="draft">Draft</option>
            <option value="published">Publicat</option>
            <option value="archived">Arhivat</option>
          </select>
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
            className="h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 transition-colors"
          >
            <option value="">Toate categoriile</option>
            {categories.map(c => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FileText className="h-16 w-16 text-neutral-200 mb-4" />
          <p className="text-lg font-semibold text-neutral-700 mb-1">Niciun articol inca</p>
          <p className="text-sm text-neutral-400 mb-6">Creeaza primul articol pentru blogul Hontrio.</p>
          <Link href="/admin/blog/new">
            <button className="flex items-center gap-2 h-9 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium transition-colors">
              <Plus className="h-4 w-4" />
              Creeaza articol
            </button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">Articol</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Categorie</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-center text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Featured</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Data</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3 hidden xl:table-cell">Vizualizari</th>
                <th className="text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">Actiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {posts.map(post => (
                <tr key={post.id} className="hover:bg-neutral-50 transition-colors">
                  {/* Articol */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {post.cover_image_url ? (
                        <img
                          src={post.cover_image_url}
                          alt={post.title}
                          className="h-12 w-12 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-neutral-100 shrink-0 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-neutral-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate max-w-xs">{post.title}</p>
                        {post.excerpt && (
                          <p className="text-xs text-neutral-400 truncate max-w-xs mt-0.5">{post.excerpt}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Categorie */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    {post.category ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: post.category.color || '#6366f1' }}
                      >
                        {post.category.name}
                      </span>
                    ) : (
                      <span className="text-neutral-300 text-sm">-</span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge status={post.status} />
                  </td>
                  {/* Featured */}
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <button
                      onClick={() => toggleFeatured(post)}
                      className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
                      title={post.featured ? 'Elimina din recomandate' : 'Marcheaza ca recomandat'}
                    >
                      <Star
                        className={`h-4 w-4 ${post.featured ? 'fill-amber-400 text-amber-400' : 'text-neutral-300 opacity-30'}`}
                      />
                    </button>
                  </td>
                  {/* Data + Limba */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-col gap-1">
                      {post.published_at ? (
                        <span className="text-xs text-neutral-400">{formatDate(post.published_at)}</span>
                      ) : (
                        <span className="text-xs text-neutral-300">Draft</span>
                      )}
                      <span className="text-xs text-neutral-400">
                        {(post as any).locale === 'en' ? '🇬🇧 EN' : '🇷🇴 RO'}
                      </span>
                    </div>
                  </td>
                  {/* Vizualizari */}
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex items-center gap-1 text-xs text-neutral-400">
                      <Eye className="h-3.5 w-3.5" />
                      {post.views_count.toLocaleString('ro-RO')}
                    </div>
                  </td>
                  {/* Actiuni */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/blog/${post.id}/edit`}>
                        <button
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                          title="Editeaza"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </Link>
                      <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                        <button
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                          title="Deschide in tab nou"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </a>
                      <button
                        onClick={() => setDeleteTarget(post)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Sterge"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
            .reduce<(number | '...')[]>((acc, n, idx, arr) => {
              if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('...')
              acc.push(n)
              return acc
            }, [])
            .map((n, idx) =>
              n === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-neutral-400 text-sm">...</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n as number)}
                  className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${
                    page === n
                      ? 'bg-neutral-900 text-white'
                      : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {n}
                </button>
              )
            )}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            post={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            loading={deleteLoading}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
