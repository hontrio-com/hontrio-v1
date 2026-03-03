'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, Store, ArrowRight, ImageIcon, Loader2, SearchIcon,
  Grid3X3, LayoutList, X, ChevronLeft, ChevronRight as ChevronRightIcon,
  RefreshCw, Sparkles, TrendingUp, Eye, Filter, SlidersHorizontal,
  CheckCircle, Clock, AlertCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string
  original_title: string
  optimized_title: string | null
  original_images: string[] | null
  thumbnail_url: string | null
  category: string | null
  price: number | null
  status: string
  seo_score: number
  variations_count: number
}

type StatusCounts = {
  all: number
  draft: number
  optimized: number
  published: number
}

type SortOption = 'newest' | 'oldest' | 'seo_asc' | 'seo_desc' | 'price_asc' | 'price_desc'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: 'Draft',     color: 'bg-slate-100 text-slate-600',   icon: Clock },
  optimized: { label: 'Optimizat', color: 'bg-blue-50 text-blue-700',      icon: Sparkles },
  published: { label: 'Publicat',  color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle },
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest',    label: 'Cele mai noi' },
  { value: 'oldest',   label: 'Cele mai vechi' },
  { value: 'seo_desc', label: 'SEO ↓ cel mai bun' },
  { value: 'seo_asc',  label: 'SEO ↑ cel mai slab' },
  { value: 'price_desc', label: 'Preț ↓' },
  { value: 'price_asc',  label: 'Preț ↑' },
]

function SeoIndicator({ score }: { score: number }) {
  if (!score || score === 0) return (
    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md font-medium">—</span>
  )
  const color = score >= 80 ? 'bg-emerald-50 text-emerald-700' : score >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold tabular-nums ${color}`}>
      SEO {score}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.draft
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function NoImagePlaceholder({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100`}>
      <ImageIcon className={`${size === 'sm' ? 'h-5 w-5' : 'h-8 w-8'} text-gray-200`} />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts]           = useState<Product[]>([])
  const [loading, setLoading]             = useState(true)
  const [syncing, setSyncing]             = useState(false)
  const [hasStore, setHasStore]           = useState(false)
  const [storeId, setStoreId]             = useState<string | null>(null)
  const [searchInput, setSearchInput]     = useState('')
  const [searchQuery, setSearchQuery]     = useState('')
  const [viewMode, setViewMode]           = useState<'grid' | 'list'>('grid')
  const [currentPage, setCurrentPage]     = useState(1)
  const [perPage, setPerPage]             = useState(50)
  const [totalProducts, setTotalProducts] = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [statusFilter, setStatusFilter]   = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy]               = useState<SortOption>('newest')
  const [statusCounts, setStatusCounts]   = useState<StatusCounts>({ all: 0, draft: 0, optimized: 0, published: 0 })
  const [categories, setCategories]       = useState<string[]>([])
  const [showFilters, setShowFilters]     = useState(false)
  const [hoveredId, setHoveredId]         = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch store
      const storeRes = await fetch('/api/stores')
      const storeData = await storeRes.json()
      const store = storeData.store
      setHasStore(!!store)
      if (store) setStoreId(store.id)

      // Build params
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: perPage.toString(),
        parent_only: 'true',
      })
      if (searchQuery)                        params.set('search', searchQuery)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter)

      const res = await fetch('/api/products?' + params)
      const data = await res.json()

      // Client-side sort (API doesn't have sort param yet)
      let sorted = data.products || []
      if (sortBy === 'oldest')    sorted = [...sorted].sort((a: Product, b: Product) => a.id.localeCompare(b.id))
      if (sortBy === 'seo_desc')  sorted = [...sorted].sort((a: Product, b: Product) => (b.seo_score || 0) - (a.seo_score || 0))
      if (sortBy === 'seo_asc')   sorted = [...sorted].sort((a: Product, b: Product) => (a.seo_score || 0) - (b.seo_score || 0))
      if (sortBy === 'price_desc') sorted = [...sorted].sort((a: Product, b: Product) => (b.price || 0) - (a.price || 0))
      if (sortBy === 'price_asc') sorted = [...sorted].sort((a: Product, b: Product) => (a.price || 0) - (b.price || 0))

      setProducts(sorted)
      setTotalProducts(data.total || 0)
      setTotalPages(data.total_pages || 0)
      if (data.status_counts) setStatusCounts(data.status_counts)
      if (data.categories)    setCategories(data.categories)
    } catch {
      console.error('Error loading products')
    } finally {
      setLoading(false)
    }
  }, [currentPage, perPage, searchQuery, statusFilter, categoryFilter, sortBy])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(searchInput); setCurrentPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleSync = async () => {
    if (!storeId || syncing) return
    setSyncing(true)
    try {
      const res = await fetch(`/api/stores/${storeId}/sync`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        await fetchProducts()
      } else {
        alert(data.error || 'Eroare la sincronizare')
      }
    } catch {
      alert('Eroare la sincronizare')
    } finally {
      setSyncing(false)
    }
  }

  const getPageNumbers = () => {
    const p: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) p.push(i)
    } else {
      p.push(1)
      if (currentPage > 3) p.push('...')
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) p.push(i)
      if (currentPage < totalPages - 2) p.push('...')
      p.push(totalPages)
    }
    return p
  }

  const getImageUrl = (p: Product) => p.thumbnail_url || p.original_images?.[0] || null

  const emptyMessage = () => {
    if (searchQuery) return { title: 'Niciun produs găsit', sub: `Nu există produse pentru "${searchQuery}".` }
    if (statusFilter === 'draft')     return { title: 'Niciun produs draft', sub: 'Toate produsele au fost optimizate sau publicate.' }
    if (statusFilter === 'optimized') return { title: 'Niciun produs optimizat', sub: 'Intră pe un produs și generează conținut AI.' }
    if (statusFilter === 'published') return { title: 'Niciun produs publicat', sub: 'Optimizează produse și publică-le în magazin.' }
    return { title: 'Niciun produs sincronizat', sub: 'Sincronizează magazinul pentru a importa produsele.' }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading && products.length === 0) return (
    <div className="space-y-5">
      <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
      <div className="flex gap-2">{[1,2,3,4].map(i => <div key={i} className="h-8 w-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {[1,2,3,4,5,6,7,8,9,10].map(i => (
          <div key={i} className="rounded-2xl bg-gray-100 animate-pulse" style={{ aspectRatio: '3/4' }} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Produse</h1>
            {hasStore && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-gray-400">{statusCounts.all} total</span>
                <span className="text-gray-200">·</span>
                <span className="text-sm text-slate-500">{statusCounts.draft} draft</span>
                <span className="text-gray-200">·</span>
                <span className="text-sm text-blue-500">{statusCounts.optimized} optimizate</span>
                <span className="text-gray-200">·</span>
                <span className="text-sm text-emerald-500">{statusCounts.published} publicate</span>
              </div>
            )}
          </div>

          {hasStore && (
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="hidden sm:flex border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>

              {/* Sync button */}
              <Button
                onClick={handleSync}
                disabled={syncing}
                variant="outline"
                className="rounded-xl h-10 px-4 border-gray-200 gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin text-blue-500' : 'text-gray-400'}`} />
                <span className="text-sm">{syncing ? 'Sincronizez...' : 'Sincronizează'}</span>
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── No Store State ───────────────────────────────────────────────────── */}
      {!hasStore ? (
        <Card className="border-dashed border-2 border-gray-200 rounded-2xl shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
              <Store className="h-8 w-8 text-blue-500" />
            </div>
            <CardTitle className="mb-2 text-lg">Conectează-ți magazinul</CardTitle>
            <CardDescription className="text-center max-w-sm mb-6">
              Pentru a vedea produsele tale, conectează mai întâi magazinul WooCommerce.
            </CardDescription>
            <Link href="/settings">
              <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">
                Conectează magazin <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Filters Row ─────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Caută produse..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 h-10 rounded-xl border-gray-200 bg-white"
              />
              {searchInput && (
                <button
                  onClick={() => { setSearchInput(''); setSearchQuery(''); setCurrentPage(1) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Status filter tabs */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {[
                { key: 'all', label: 'Toate', count: statusCounts.all },
                { key: 'draft', label: 'Draft', count: statusCounts.draft },
                { key: 'optimized', label: 'Optimizat', count: statusCounts.optimized },
                { key: 'published', label: 'Publicat', count: statusCounts.published },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setStatusFilter(tab.key); setCurrentPage(1) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    statusFilter === tab.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    statusFilter === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                  }`}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Extra filters toggle */}
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                showFilters || categoryFilter !== 'all' || sortBy !== 'newest'
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:text-gray-700'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filtre</span>
              {(categoryFilter !== 'all' || sortBy !== 'newest') && (
                <span className="h-2 w-2 rounded-full bg-blue-500" />
              )}
            </button>
          </div>

          {/* ── Extra Filters Panel ──────────────────────────────────────────── */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  {/* Category filter */}
                  {categories.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium">Categorie:</span>
                      <select
                        value={categoryFilter}
                        onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }}
                        className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="all">Toate categoriile</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Sort */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">Sortare:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      {sortOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Per page */}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-gray-500 font-medium">Pe pagină:</span>
                    <div className="flex gap-1">
                      {[50, 100, 500].map(n => (
                        <button
                          key={n}
                          onClick={() => { setPerPage(n); setCurrentPage(1) }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            perPage === n ? 'bg-blue-100 text-blue-700' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reset filters */}
                  {(categoryFilter !== 'all' || sortBy !== 'newest') && (
                    <button
                      onClick={() => { setCategoryFilter('all'); setSortBy('newest') }}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      <X className="h-3.5 w-3.5" />Resetează
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Result info ──────────────────────────────────────────────────── */}
          {!loading && (
            <p className="text-sm text-gray-400">
              {totalProducts} {totalProducts === 1 ? 'produs' : 'produse'}
              {searchQuery ? ` pentru "${searchQuery}"` : ''}
              {statusFilter !== 'all' ? ` · ${statusConfig[statusFilter]?.label || statusFilter}` : ''}
              {categoryFilter !== 'all' ? ` · ${categoryFilter}` : ''}
            </p>
          )}

          {/* ── Loading spinner ──────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-gray-500">Se încarcă...</span>
            </div>

          /* ── Empty state ─────────────────────────────────────────────────── */
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Package className="h-7 w-7 text-gray-300" />
              </div>
              <p className="text-gray-700 font-semibold mb-1">{emptyMessage().title}</p>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">{emptyMessage().sub}</p>
              {!searchQuery && statusFilter === 'all' && (
                <Button onClick={handleSync} disabled={syncing} variant="outline" className="mt-5 rounded-xl gap-2">
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  Sincronizează acum
                </Button>
              )}
            </div>

          /* ── GRID VIEW ────────────────────────────────────────────────────── */
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {products.map((product, i) => {
                const imgUrl = getImageUrl(product)
                const isHovered = hoveredId === product.id
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(i * 0.03, 0.3) }}
                  >
                    <Link href={`/products/${product.id}`}>
                      <div
                        className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200 flex flex-col cursor-pointer"
                        onMouseEnter={() => setHoveredId(product.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        {/* Image */}
                        <div className="relative aspect-square bg-gray-50 overflow-hidden">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={product.original_title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <NoImagePlaceholder />
                          )}

                          {/* Status badge - top left */}
                          <div className="absolute top-2 left-2">
                            <StatusBadge status={product.status} />
                          </div>

                          {/* Hover overlay with actions */}
                          <AnimatePresence>
                            {isHovered && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="absolute inset-0 bg-gray-900/40 flex items-center justify-center gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1.5 bg-white text-gray-900 text-xs font-semibold px-3 py-2 rounded-xl shadow-lg">
                                    <Eye className="h-3.5 w-3.5" />
                                    Detalii
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-lg">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    AI
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Variations badge */}
                          {product.variations_count > 0 && (
                            <div className="absolute bottom-2 right-2">
                              <span className="text-[10px] bg-gray-900/70 text-white px-1.5 py-0.5 rounded-md font-medium">
                                {product.variations_count} var.
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-3 flex flex-col flex-1">
                          <h3 className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">
                            {product.optimized_title || product.original_title}
                          </h3>
                          <div className="flex items-center justify-between mt-auto pt-2 gap-1">
                            <SeoIndicator score={product.seo_score} />
                            {product.price ? (
                              <span className="text-sm font-semibold text-gray-800 shrink-0">
                                {product.price} <span className="text-[10px] text-gray-400 font-normal">RON</span>
                              </span>
                            ) : product.category ? (
                              <span className="text-[10px] text-gray-400 truncate">{product.category}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </div>

          /* ── LIST VIEW ───────────────────────────────────────────────────── */
          ) : (
            <div className="space-y-1.5">
              {/* List header */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <div className="col-span-6">Produs</div>
                <div className="col-span-2">Categorie</div>
                <div className="col-span-1 text-center">SEO</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-2 text-right">Preț</div>
              </div>

              {products.map((product, i) => {
                const imgUrl = getImageUrl(product)
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.2) }}
                  >
                    <Link href={`/products/${product.id}`}>
                      <div className="grid grid-cols-12 gap-4 items-center bg-white rounded-xl border border-gray-100 px-4 py-3 hover:border-blue-100 hover:shadow-sm transition-all cursor-pointer group">
                        {/* Image + title */}
                        <div className="col-span-12 sm:col-span-6 flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-gray-50 overflow-hidden shrink-0">
                            {imgUrl
                              ? <img src={imgUrl} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              : <NoImagePlaceholder size="sm" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {product.optimized_title || product.original_title}
                            </p>
                            {product.variations_count > 0 && (
                              <p className="text-[11px] text-gray-400">{product.variations_count} variații</p>
                            )}
                          </div>
                        </div>

                        {/* Category */}
                        <div className="hidden sm:block col-span-2">
                          <p className="text-xs text-gray-400 truncate">{product.category || '—'}</p>
                        </div>

                        {/* SEO */}
                        <div className="hidden sm:flex col-span-1 justify-center">
                          <SeoIndicator score={product.seo_score} />
                        </div>

                        {/* Status */}
                        <div className="hidden sm:flex col-span-1 justify-center">
                          <StatusBadge status={product.status} />
                        </div>

                        {/* Price */}
                        <div className="hidden sm:block col-span-2 text-right">
                          {product.price
                            ? <span className="text-sm font-semibold text-gray-800">{product.price} <span className="text-xs text-gray-400 font-normal">RON</span></span>
                            : <span className="text-gray-300">—</span>
                          }
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* ── Pagination ───────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Pagina {currentPage} din {totalPages} ({totalProducts} produse)
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {getPageNumbers().map((pn, i) =>
                  pn === '...' ? (
                    <span key={'d' + i} className="px-2 text-gray-400 text-sm">...</span>
                  ) : (
                    <button
                      key={pn}
                      onClick={() => setCurrentPage(pn as number)}
                      className={`h-8 w-8 rounded-lg text-sm font-medium transition-all ${
                        currentPage === pn ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {pn}
                    </button>
                  )
                )}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}