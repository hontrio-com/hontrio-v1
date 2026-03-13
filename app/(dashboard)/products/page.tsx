'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, ImageIcon, Loader2, Search, X, RefreshCw,
  ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUpRight,
  CheckCircle, AlertCircle, MinusCircle, Upload, Star,
  LayoutGrid, List, Filter, Sparkles, Store, ArrowRight,
  ChevronDown, Tag, TrendingUp, Zap,
} from 'lucide-react'
import Link from 'next/link'

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
  optimized_short_description: string | null
  optimized_long_description: string | null
  meta_description: string | null
}

type SortOption = 'newest' | 'oldest' | 'seo_desc' | 'seo_asc' | 'price_desc' | 'price_asc'

type FilterState = {
  seo: 'all' | 'unoptimized' | 'partial' | 'good' | 'published'
  sort: SortOption
  category: string
}

function getSeoTier(score: number, status: string): 'published' | 'good' | 'partial' | 'unoptimized' {
  if (status === 'published') return 'published'
  if (score >= 80) return 'good'
  if (score > 0) return 'partial'
  return 'unoptimized'
}

const TIER = {
  published:   { label: 'Publicat',    bg: 'bg-neutral-900', text: 'text-white',        dot: 'bg-white' },
  good:        { label: 'Optimizat',   bg: 'bg-neutral-100', text: 'text-neutral-700',  dot: 'bg-emerald-500' },
  partial:     { label: 'Parțial',     bg: 'bg-neutral-100', text: 'text-amber-600',    dot: 'bg-amber-400' },
  unoptimized: { label: 'Neoptimizat', bg: 'bg-neutral-100', text: 'text-neutral-400',  dot: 'bg-neutral-300' },
}

const SORT_OPTS: { value: SortOption; label: string }[] = [
  { value: 'newest',     label: 'Cele mai noi' },
  { value: 'oldest',    label: 'Cele mai vechi' },
  { value: 'seo_desc',  label: 'SEO: Cel mai bun' },
  { value: 'seo_asc',   label: 'SEO: Cel mai slab' },
  { value: 'price_desc', label: 'Preț descrescător' },
  { value: 'price_asc',  label: 'Preț crescător' },
]

const SEO_FILTERS = [
  { value: 'all',         label: 'Toate' },
  { value: 'unoptimized', label: 'Neoptimizate' },
  { value: 'partial',     label: 'Parțiale' },
  { value: 'good',        label: 'Optimizate' },
  { value: 'published',   label: 'Publicate' },
]

function ScoreBadge({ score }: { score: number }) {
  if (!score) return <span className="text-[10px] text-neutral-300 font-medium tabular-nums">—</span>
  const color = score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-500' : 'text-red-500'
  return <span className={`text-[11px] font-semibold tabular-nums ${color}`}>{score}</span>
}

function TierBadge({ score, status }: { score: number; status: string }) {
  const tier = getSeoTier(score, status)
  const t = TIER[tier]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${t.bg} ${t.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot} shrink-0`} />
      {t.label}
    </span>
  )
}

function NoImage({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  return (
    <div className="w-full h-full flex items-center justify-center bg-neutral-50">
      <ImageIcon className={`${s} text-neutral-200`} />
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-neutral-100 rounded-xl ${className || ''}`} />
}

function Dropdown({ label, options, value, onChange }: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 h-9 px-2.5 rounded-xl border border-neutral-200 bg-white text-[12px] font-medium text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 transition-all max-w-[140px]">
        <span className="truncate">{current?.label || label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-neutral-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="absolute top-11 left-0 z-30 min-w-[160px] bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
            {options.map(o => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-[12px] transition-colors hover:bg-neutral-50 ${o.value === value ? 'text-neutral-900 font-semibold' : 'text-neutral-500'}`}>
                {o.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GridCard({ product, selected, onSelect }: {
  product: Product
  selected: boolean
  onSelect: (id: string) => void
}) {
  const [hover, setHover] = useState(false)
  const title = product.optimized_title || product.original_title
  const img = product.thumbnail_url || product.original_images?.[0]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`group relative bg-white border rounded-xl overflow-hidden transition-all duration-200 cursor-pointer
        ${selected ? 'border-neutral-900 ring-1 ring-neutral-900/10' : 'border-neutral-200 hover:border-neutral-300 hover:shadow-sm'}`}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>

      <div className={`absolute top-2.5 left-2.5 z-10 transition-opacity duration-150 ${hover || selected ? 'opacity-100' : 'opacity-0'}`}>
        <button onClick={e => { e.preventDefault(); onSelect(product.id) }}
          className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all
            ${selected ? 'bg-neutral-900 border-neutral-900' : 'bg-white/90 backdrop-blur-sm border-neutral-300 hover:border-neutral-500'}`}>
          {selected && <span className="text-white text-[10px]">✓</span>}
        </button>
      </div>

      <Link href={`/seo/${product.id}`}>
        <div className="aspect-square relative overflow-hidden bg-neutral-50">
          {img
            ? <img src={img} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <NoImage size="lg" />
          }
          <AnimatePresence>
            {hover && product.seo_score > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                <div className="flex items-center gap-1.5 w-full">
                  <div className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full" style={{ width: `${product.seo_score}%` }} />
                  </div>
                  <span className="text-white text-[11px] font-semibold tabular-nums">{product.seo_score}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-3">
          <p className="text-[13px] font-medium text-neutral-900 line-clamp-2 leading-snug mb-2">{title}</p>
          <div className="flex items-center justify-between">
            <TierBadge score={product.seo_score} status={product.status} />
            {product.price != null && (
              <span className="text-[12px] font-semibold text-neutral-900 tabular-nums">{product.price} lei</span>
            )}
          </div>
          {product.category && (
            <p className="text-[10px] text-neutral-400 mt-1.5 flex items-center gap-1 truncate">
              <Tag className="h-2.5 w-2.5 shrink-0" />{product.category}
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

function ListRow({ product, selected, onSelect, index }: {
  product: Product
  selected: boolean
  onSelect: (id: string) => void
  index: number
}) {
  const title = product.optimized_title || product.original_title
  const img = product.thumbnail_url || product.original_images?.[0]
  const hasText = !!(product.optimized_short_description || product.optimized_long_description)
  const hasImage = !!(product.thumbnail_url)

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }}
      className={`group flex items-center gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 transition-colors
        ${selected ? 'bg-neutral-50' : 'hover:bg-neutral-50/70'}`}>

      <button onClick={() => onSelect(product.id)}
        className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-all
          ${selected ? 'bg-neutral-900 border-neutral-900' : 'border-neutral-200 group-hover:border-neutral-400'}`}>
        {selected && <span className="text-white text-[10px]">✓</span>}
      </button>

      <Link href={`/seo/${product.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="h-10 w-10 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
          {img ? <img src={img} alt={title} className="h-full w-full object-cover" /> : <NoImage size="sm" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-neutral-900 truncate">{title}</p>
          {product.category && (
            <p className="text-[11px] text-neutral-400 truncate mt-0.5">{product.category}</p>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1">
            <div className={`h-5 w-5 rounded-md flex items-center justify-center ${hasText ? 'bg-neutral-900' : 'bg-neutral-100'}`}>
              <Sparkles className={`h-2.5 w-2.5 ${hasText ? 'text-white' : 'text-neutral-300'}`} />
            </div>
            <div className={`h-5 w-5 rounded-md flex items-center justify-center ${hasImage ? 'bg-neutral-900' : 'bg-neutral-100'}`}>
              <ImageIcon className={`h-2.5 w-2.5 ${hasImage ? 'text-white' : 'text-neutral-300'}`} />
            </div>
          </div>

          <div className="w-10 text-right">
            <ScoreBadge score={product.seo_score} />
          </div>

          {product.price != null && (
            <div className="w-16 text-right">
              <span className="text-[12px] font-medium text-neutral-600 tabular-nums">{product.price} lei</span>
            </div>
          )}

          <TierBadge score={product.seo_score} status={product.status} />
        </div>

        <ArrowRight className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0 ml-1" />
      </Link>
    </motion.div>
  )
}

function EmptyState({ hasSearch, onClear }: { hasSearch: boolean; onClear: () => void }) {
  if (hasSearch) return (
    <div className="text-center py-20">
      <div className="h-14 w-14 rounded-xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
        <Search className="h-6 w-6 text-neutral-300" />
      </div>
      <p className="text-[14px] font-medium text-neutral-500 mb-1">Niciun produs găsit</p>
      <p className="text-[13px] text-neutral-400 mb-4">Încearcă un alt termen de căutare</p>
      <button onClick={onClear} className="h-8 px-4 rounded-xl border border-neutral-200 text-[12px] font-medium text-neutral-600 hover:bg-neutral-50 transition-all">
        Resetează căutarea
      </button>
    </div>
  )

  return (
    <div className="text-center py-20">
      <div className="h-16 w-16 rounded-xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
        <Store className="h-7 w-7 text-neutral-300" />
      </div>
      <p className="text-[15px] font-semibold text-neutral-700 mb-1">Niciun produs sincronizat</p>
      <p className="text-[13px] text-neutral-400 mb-5">Conectează-ți magazinul pentru a importa produsele</p>
      <Link href="/settings">
        <button className="h-9 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[13px] font-medium transition-all">
          Conectează magazinul
        </button>
      </Link>
    </div>
  )
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [categories, setCategories] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const [filters, setFilters] = useState<FilterState>({ seo: 'all', sort: 'newest', category: 'all' })
  const perPage = view === 'grid' ? 24 : 30
  const totalPages = Math.ceil(total / perPage)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
  }, [search])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        parent_only: 'true',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filters.seo !== 'all' && { seo_filter: filters.seo }),
        ...(filters.category !== 'all' && { category: filters.category }),
      })
      const res = await fetch(`/api/products?${params}`)
      const data = await res.json()
      let prods = data.products || []

      if (filters.sort === 'oldest') prods = [...prods].reverse()
      else if (filters.sort === 'seo_desc') prods = [...prods].sort((a: Product, b: Product) => b.seo_score - a.seo_score)
      else if (filters.sort === 'seo_asc') prods = [...prods].sort((a: Product, b: Product) => a.seo_score - b.seo_score)
      else if (filters.sort === 'price_desc') prods = [...prods].sort((a: Product, b: Product) => (b.price || 0) - (a.price || 0))
      else if (filters.sort === 'price_asc') prods = [...prods].sort((a: Product, b: Product) => (a.price || 0) - (b.price || 0))

      setProducts(prods)
      setTotal(data.total || 0)

      if (categories.length === 0) {
        const cats = [...new Set(prods.map((p: Product) => p.category).filter(Boolean))] as string[]
        setCategories(cats)
      }
    } catch { } finally { setLoading(false) }
  }, [page, perPage, debouncedSearch, filters])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const stats = {
    total,
    unoptimized: products.filter(p => p.seo_score === 0 && p.status !== 'published').length,
    good: products.filter(p => p.seo_score >= 80 && p.status !== 'published').length,
    published: products.filter(p => p.status === 'published').length,
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const toggleSelectAll = () => {
    if (selected.size === products.length) setSelected(new Set())
    else setSelected(new Set(products.map(p => p.id)))
  }

  const clearFilters = () => { setSearch(''); setFilters({ seo: 'all', sort: 'newest', category: 'all' }); setPage(1) }
  const hasActiveFilters = filters.seo !== 'all' || filters.sort !== 'newest' || filters.category !== 'all' || search

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">Produse</h1>
          <p className="text-[13px] text-neutral-400 mt-0.5">
            {total > 0 ? `${total} produse în catalog` : 'Gestionează și optimizează produsele'}
          </p>
        </div>
        <button
          onClick={async () => {
            setSyncing(true)
            try { await fetch('/api/stores/current/sync', { method: 'POST' }) } catch { }
            await fetchProducts()
            setSyncing(false)
          }}
          disabled={syncing}
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-neutral-200 bg-white text-[12px] font-medium text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 transition-all disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sincronizează</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total produse',  value: total,            filter: 'all',         accent: '' },
          { label: 'Neoptimizate',   value: stats.unoptimized, filter: 'unoptimized', accent: '' },
          { label: 'Optimizate',     value: stats.good,        filter: 'good',        accent: 'text-emerald-600' },
          { label: 'Publicate',      value: stats.published,   filter: 'published',   accent: '' },
        ].map(s => {
          const active = filters.seo === s.filter
          return (
            <button key={s.filter} onClick={() => { setFilters(f => ({ ...f, seo: s.filter as any })); setPage(1) }}
              className={`text-left p-4 rounded-xl border transition-all ${active ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}>
              <p className={`text-[22px] font-bold tabular-nums ${active ? 'text-white' : (s.accent || 'text-neutral-900')}`}>
                {loading ? '—' : s.value}
              </p>
              <p className={`text-[11px] mt-0.5 ${active ? 'text-neutral-400' : 'text-neutral-400'}`}>{s.label}</p>
            </button>
          )
        })}
      </div>

      {/* Main card */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col gap-2 p-3 border-b border-neutral-100">
          {/* Row 1: search */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-300 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Caută produse..."
              className="w-full h-9 pl-9 pr-8 rounded-xl bg-neutral-50 border border-neutral-100 text-[13px] text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:border-neutral-300 focus:bg-white transition-all" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Row 2: filters + view toggle */}
          <div className="flex items-center gap-2">
            <Dropdown label="Sortare" options={SORT_OPTS} value={filters.sort}
              onChange={v => setFilters(f => ({ ...f, sort: v as SortOption }))} />

            {categories.length > 0 && (
              <Dropdown label="Categorie"
                options={[{ value: 'all', label: 'Toate categoriile' }, ...categories.map(c => ({ value: c, label: c }))]}
                value={filters.category} onChange={v => { setFilters(f => ({ ...f, category: v })); setPage(1) }} />
            )}

            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1 h-9 px-2.5 rounded-xl text-[12px] text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-all">
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            <div className="flex items-center border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50 p-0.5 ml-auto">
              {(['grid', 'list'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`h-7 w-7 flex items-center justify-center rounded-lg transition-all ${view === v ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}>
                  {v === 'grid' ? <LayoutGrid className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SEO filter tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-neutral-50 overflow-x-auto">
          {SEO_FILTERS.map(f => (
            <button key={f.value}
              onClick={() => { setFilters(prev => ({ ...prev, seo: f.value as any })); setPage(1) }}
              className={`shrink-0 h-7 px-3 rounded-lg text-[12px] font-medium transition-all
                ${filters.seo === f.value ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Bulk bar */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 flex items-center gap-3 overflow-hidden">
              <span className="text-[12px] font-medium text-neutral-700">{selected.size} selectate</span>
              <div className="h-3 w-px bg-neutral-200" />
              <button onClick={toggleSelectAll} className="text-[12px] text-neutral-500 hover:text-neutral-900 transition-colors">
                {selected.size === products.length ? 'Deselectează tot' : 'Selectează tot'}
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-medium transition-all">
                  <Sparkles className="h-3 w-3" />
                  Optimizează SEO ({selected.size})
                </button>
                <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-neutral-200 bg-white text-[12px] font-medium text-neutral-600 hover:border-neutral-300 transition-all">
                  <ImageIcon className="h-3 w-3" />
                  Generează imagini
                </button>
                <button onClick={() => setSelected(new Set())}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 transition-all">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 p-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-square" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-neutral-50">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-5 w-5 rounded-md" />
                  <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20 hidden sm:block" />
                </div>
              ))}
            </div>
          )
        ) : products.length === 0 ? (
          <EmptyState hasSearch={!!(debouncedSearch || filters.seo !== 'all')} onClear={clearFilters} />
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 p-4">
            {products.map(p => (
              <GridCard key={p.id} product={p} selected={selected.has(p.id)} onSelect={toggleSelect} />
            ))}
          </div>
        ) : (
          <div>
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-neutral-50 border-b border-neutral-100">
              <button onClick={toggleSelectAll}
                className="h-5 w-5 rounded-md border border-neutral-200 flex items-center justify-center shrink-0 hover:border-neutral-400 transition-colors">
                {selected.size === products.length && products.length > 0 && <span className="text-neutral-900 text-[10px]">✓</span>}
              </button>
              <div className="w-10 shrink-0" />
              <span className="flex-1 text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Produs</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider w-10 text-right">AI</span>
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider w-10 text-right">SEO</span>
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider w-16 text-right">Preț</span>
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider w-20">Status</span>
              </div>
              <div className="w-5" />
            </div>
            {products.map((p, i) => (
              <ListRow key={p.id} product={p} selected={selected.has(p.id)} onSelect={toggleSelect} index={i} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100">
            <p className="text-[12px] text-neutral-400">
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} din {total} produse
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number
                if (totalPages <= 5) p = i + 1
                else if (page <= 3) p = i + 1
                else if (page >= totalPages - 2) p = totalPages - 4 + i
                else p = page - 2 + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`h-8 w-8 flex items-center justify-center rounded-lg text-[12px] font-medium transition-all
                      ${page === p ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-500 hover:bg-neutral-50'}`}>
                    {p}
                  </button>
                )
              })}

              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}