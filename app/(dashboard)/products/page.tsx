'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, Plus, Store, ArrowRight, ImageIcon, Loader2, SearchIcon,
  Grid3X3, LayoutList, Eye, SlidersHorizontal, X, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight as ChevronRightIcon, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'

type Product = {
  id: string; original_title: string; optimized_title: string | null
  original_images: string[] | null; thumbnail_url: string | null
  category: string | null; price: number | null; status: string
  seo_score: number; parent_id: string | null; variant_name: string | null
  variations_count: number
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [hasStore, setHasStore] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [totalProducts, setTotalProducts] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [statusCounts, setStatusCounts] = useState({ all: 0, draft: 0, optimized: 0, published: 0 })
  const [expandedProducts, setExpandedProducts] = useState<Record<string, Product[]>>({})
  const [loadingVariations, setLoadingVariations] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const storeRes = await fetch('/api/stores')
      const storeData = await storeRes.json()
      setHasStore(!!storeData.store)
      const params = new URLSearchParams({ page: currentPage.toString(), per_page: perPage.toString(), parent_only: 'true' })
      if (searchQuery) params.set('search', searchQuery)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      const res = await fetch('/api/products?' + params)
      const data = await res.json()
      setProducts(data.products || [])
      setTotalProducts(data.total || 0)
      setTotalPages(data.total_pages || 0)
      setCategories(data.categories || [])
      setStatusCounts(data.status_counts || { all: 0, draft: 0, optimized: 0, published: 0 })
    } catch { console.error('Error loading products') }
    finally { setLoading(false) }
  }, [currentPage, perPage, searchQuery, statusFilter, categoryFilter])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(searchInput); setCurrentPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const toggleVariations = async (productId: string) => {
    if (expandedProducts[productId]) {
      const n = { ...expandedProducts }; delete n[productId]; setExpandedProducts(n); return
    }
    setLoadingVariations(productId)
    try {
      const res = await fetch('/api/products/' + productId + '/variations')
      const data = await res.json()
      setExpandedProducts(prev => ({ ...prev, [productId]: data.variations || [] }))
    } catch {} finally { setLoadingVariations(null) }
  }

  const activeFilters = (statusFilter !== 'all' ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0)
  const statusOptions = [
    { value: 'all', label: 'Toate', count: statusCounts.all },
    { value: 'draft', label: 'Draft', count: statusCounts.draft },
    { value: 'optimized', label: 'Optimizate', count: statusCounts.optimized },
    { value: 'published', label: 'Publicate', count: statusCounts.published },
  ]

  const getPageNumbers = () => {
    const p: (number|string)[] = []
    if (totalPages <= 7) { for (let i=1;i<=totalPages;i++) p.push(i) }
    else {
      p.push(1)
      if (currentPage > 3) p.push('...')
      for (let i=Math.max(2,currentPage-1);i<=Math.min(totalPages-1,currentPage+1);i++) p.push(i)
      if (currentPage < totalPages-2) p.push('...')
      p.push(totalPages)
    }
    return p
  }

  if (loading && products.length === 0) return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
      <div className="h-12 bg-gray-200 rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="aspect-[3/4] bg-white rounded-2xl animate-pulse" />)}
      </div>
    </div>
  )

  const ProductCard = ({ product, isVariation = false }: { product: Product; isVariation?: boolean }) => (
    <div className={`group bg-white rounded-2xl border overflow-hidden card-hover shadow-sm flex flex-col h-full ${isVariation ? 'border-blue-100 bg-blue-50/30' : 'border-gray-100'}`}>
      <div className="relative aspect-square bg-gray-50 overflow-hidden shrink-0">
        {(product.thumbnail_url || (product.original_images && product.original_images.length > 0)) ? (
          <img src={product.thumbnail_url || product.original_images![0]} alt={product.original_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 text-gray-200" /></div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge className={`text-[10px] border-0 shadow-sm ${product.status === 'published' ? 'bg-green-500 text-white' : product.status === 'optimized' ? 'bg-blue-500 text-white' : 'bg-white/90 backdrop-blur text-gray-600'}`}>
            {product.status === 'published' ? 'Publicat' : product.status === 'optimized' ? 'Optimizat' : 'Draft'}
          </Badge>
          {isVariation && <Badge className="text-[10px] border-0 shadow-sm bg-indigo-500 text-white">Variație</Badge>}
        </div>
        {product.seo_score > 0 && (
          <div className="absolute top-2 right-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${product.seo_score >= 80 ? 'bg-green-500 text-white' : product.seo_score >= 50 ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'}`}>{product.seo_score}</div>
          </div>
        )}
        {!isVariation && product.variations_count > 0 && (
          <div className="absolute bottom-2 left-2">
            <Badge className="text-[10px] border-0 shadow-sm bg-indigo-600 text-white gap-1"><Layers className="h-3 w-3" />{product.variations_count} variații</Badge>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
          <Link href={'/products/' + product.id}>
            <Button size="sm" className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 bg-white text-gray-900 hover:bg-white/90 rounded-xl shadow-lg h-9 px-4 text-xs font-medium">
              <Eye className="h-3.5 w-3.5 mr-1.5" />Detalii
            </Button>
          </Link>
        </div>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug min-h-[2.5rem]">{product.optimized_title || product.original_title}</h3>
        {isVariation && product.variant_name && <p className="text-[11px] text-indigo-500 mt-0.5 truncate">{product.variant_name}</p>}
        <div className="flex items-center justify-between mt-auto pt-1.5">
          {product.category ? <span className="text-[11px] text-gray-400 truncate mr-2">{product.category}</span> : <span />}
          {product.price ? <span className="text-sm font-semibold text-gray-900 shrink-0">{product.price} <span className="text-xs text-gray-400">RON</span></span> : <span />}
        </div>
      </div>
    </div>
  )

  const ProductRow = ({ product, isVariation = false }: { product: Product; isVariation?: boolean }) => (
    <div className={`group flex items-center gap-4 rounded-xl border p-3 hover:shadow-md transition-all ${isVariation ? 'bg-blue-50/50 border-blue-100 ml-8' : 'bg-white border-gray-100 hover:border-blue-100'}`}>
      <div className="h-14 w-14 rounded-xl bg-gray-50 overflow-hidden shrink-0">
        {(product.thumbnail_url || (product.original_images && product.original_images.length > 0)) ? (
          <img src={product.thumbnail_url || product.original_images![0]} alt="" className="h-full w-full object-cover" />
        ) : <div className="h-full w-full flex items-center justify-center"><ImageIcon className="h-5 w-5 text-gray-200" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{product.optimized_title || product.original_title}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${product.status === 'published' ? 'bg-green-50 text-green-700' : product.status === 'optimized' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {product.status === 'published' ? 'Publicat' : product.status === 'optimized' ? 'Optimizat' : 'Draft'}
          </Badge>
          {isVariation && product.variant_name && <span className="text-[11px] text-indigo-500 truncate">{product.variant_name}</span>}
          {!isVariation && product.variations_count > 0 && <Badge className="text-[10px] border-0 bg-indigo-50 text-indigo-600 gap-1"><Layers className="h-3 w-3" />{product.variations_count}</Badge>}
          {product.category && !isVariation && <span className="text-[11px] text-gray-400">{product.category}</span>}
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-4">
        {product.seo_score > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${product.seo_score >= 80 ? 'bg-green-500' : product.seo_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: product.seo_score + '%' }} />
            </div>
            <span className={`text-xs font-medium min-w-[2rem] ${product.seo_score >= 80 ? 'text-green-600' : product.seo_score >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{product.seo_score}</span>
          </div>
        )}
        {product.price && <span className="text-sm font-semibold text-gray-900 min-w-[4rem] text-right">{product.price} RON</span>}
      </div>
      <div className="flex items-center gap-1">
        {!isVariation && product.variations_count > 0 && (
          <button onClick={(e) => { e.preventDefault(); toggleVariations(product.id) }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            {loadingVariations === product.id ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : expandedProducts[product.id] ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>
        )}
        <Link href={'/products/' + product.id}><ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" /></Link>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Produse</h1>
            <p className="text-gray-500 text-sm mt-0.5">{statusCounts.all} produse &bull; {statusCounts.optimized} optimizate &bull; {statusCounts.published} publicate</p>
          </div>
          <Link href="/products/new"><Button className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5"><Plus className="h-4 w-4 mr-2" />Produs nou</Button></Link>
        </div>
      </motion.div>

      {!hasStore ? (
        <Card className="border-dashed border-2 border-gray-200 rounded-2xl shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-5"><Store className="h-8 w-8 text-blue-500" /></div>
            <CardTitle className="mb-2 text-lg">Conectează-ți magazinul</CardTitle>
            <CardDescription className="text-center max-w-sm mb-6">Pentru a începe să optimizezi produse cu AI, conectează mai întâi magazinul tău WooCommerce.</CardDescription>
            <Link href="/settings"><Button className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">Conectează magazin<ArrowRight className="h-4 w-4 ml-2" /></Button></Link>
          </CardContent>
        </Card>
      ) : statusCounts.all === 0 ? (
        <Card className="border-dashed border-2 border-gray-200 rounded-2xl shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-yellow-50 flex items-center justify-center mb-5"><Package className="h-8 w-8 text-yellow-500" /></div>
            <CardTitle className="mb-2 text-lg">Niciun produs sincronizat</CardTitle>
            <CardDescription className="text-center max-w-sm mb-6">Magazinul este conectat. Mergi la Setări și sincronizează produsele.</CardDescription>
            <Link href="/settings"><Button className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">Mergi la Setări<ArrowRight className="h-4 w-4 ml-2" /></Button></Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Caută produse..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-10 h-10 rounded-xl border-gray-200 bg-white" />
              {searchInput && <button onClick={() => { setSearchInput(''); setSearchQuery(''); setCurrentPage(1) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={`h-10 rounded-xl border-gray-200 gap-2 ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}>
                <SlidersHorizontal className="h-4 w-4" />Filtre
                {activeFilters > 0 && <Badge className="bg-blue-600 text-white text-[10px] h-5 w-5 p-0 flex items-center justify-center rounded-full">{activeFilters}</Badge>}
              </Button>
              <div className="hidden sm:flex border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setViewMode('grid')} className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}><Grid3X3 className="h-4 w-4" /></button>
                <button onClick={() => setViewMode('list')} className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutList className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex flex-wrap gap-3 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400 font-medium">Status:</span>
                    {statusOptions.map(opt => (
                      <button key={opt.value} onClick={() => { setStatusFilter(opt.value); setCurrentPage(1) }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === opt.value ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{opt.label} ({opt.count})</button>
                    ))}
                  </div>
                  {categories.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 font-medium">Categorie:</span>
                      <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700">
                        <option value="all">Toate</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                  {activeFilters > 0 && <button onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setCurrentPage(1) }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50">Resetează</button>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Count + per page */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{totalProducts} produse{searchQuery ? ` pentru "${searchQuery}"` : ''}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Pe pagină:</span>
              {[50, 100, 500].map(n => (
                <button key={n} onClick={() => { setPerPage(n); setCurrentPage(1) }} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${perPage === n ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{n}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /><span className="ml-2 text-sm text-gray-500">Se încarcă...</span></div>
          ) : products.length === 0 ? (
            <div className="text-center py-16"><SearchIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">Niciun produs găsit</p></div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map(product => (
                <div key={product.id} className="space-y-2">
                  <ProductCard product={product} />
                  {product.variations_count > 0 && (
                    <button onClick={() => toggleVariations(product.id)} className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 ml-1">
                      {loadingVariations === product.id ? <Loader2 className="h-3 w-3 animate-spin" /> : expandedProducts[product.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {expandedProducts[product.id] ? 'Ascunde' : `${product.variations_count} variații`}
                    </button>
                  )}
                  {expandedProducts[product.id] && expandedProducts[product.id].map(v => (
                    <div key={v.id} className="ml-2 border-l-2 border-indigo-200 pl-2"><ProductCard product={v} isVariation /></div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {products.map(product => (
                <div key={product.id}>
                  <ProductRow product={product} />
                  <AnimatePresence>
                    {expandedProducts[product.id] && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1 mt-1">
                        {expandedProducts[product.id].map(v => <ProductRow key={v.id} product={v} isVariation />)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">Pagina {currentPage} din {totalPages} ({totalProducts} produse)</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="h-4 w-4" /></button>
                {getPageNumbers().map((pn, i) => pn === '...' ? <span key={'d'+i} className="px-2 text-gray-400 text-sm">...</span> : (
                  <button key={pn} onClick={() => setCurrentPage(pn as number)} className={`h-8 w-8 rounded-lg text-sm font-medium transition-all ${currentPage === pn ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{pn}</button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRightIcon className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}