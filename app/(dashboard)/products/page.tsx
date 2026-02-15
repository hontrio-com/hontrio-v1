'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Plus,
  Store,
  ArrowRight,
  ImageIcon,
  Loader2,
  SearchIcon,
  Filter,
  Grid3X3,
  LayoutList,
  ChevronDown,
  Eye,
  Sparkles,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
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
}

const fadeInUp = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [hasStore, setHasStore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    async function fetchData() {
      try {
        const storeRes = await fetch('/api/stores')
        const storeData = await storeRes.json()
        setHasStore(!!storeData.store)

        const productsRes = await fetch('/api/products')
        const productsData = await productsRes.json()
        if (productsData.products) {
          setProducts(productsData.products)
        }
      } catch {
        console.error('Error loading data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const categories = useMemo(() => {
    const cats = products.map(p => p.category).filter(Boolean) as string[]
    return [...new Set(cats)]
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = searchQuery === '' ||
        (p.optimized_title || p.original_title).toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [products, searchQuery, statusFilter, categoryFilter])

  const activeFilters = (statusFilter !== 'all' ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-12 bg-gray-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="aspect-[3/4] bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const totalProducts = products.length
  const optimizedProducts = products.filter(p => p.status === 'optimized' || p.status === 'published').length
  const publishedProducts = products.filter(p => p.status === 'published').length

  const statusOptions = [
    { value: 'all', label: 'Toate', count: totalProducts },
    { value: 'draft', label: 'Draft', count: products.filter(p => p.status === 'draft').length },
    { value: 'optimized', label: 'Optimizate', count: optimizedProducts },
    { value: 'published', label: 'Publicate', count: publishedProducts },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Produse</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {totalProducts} produse • {optimizedProducts} optimizate • {publishedProducts} publicate
            </p>
          </div>
          <Link href="/products/new">
            <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
              <Plus className="h-4 w-4 mr-2" />
              Produs nou
            </Button>
          </Link>
        </div>
      </motion.div>

      {!hasStore ? (
        <motion.div {...fadeInUp} transition={{ duration: 0.4, delay: 0.1 }}>
          <Card className="border-dashed border-2 border-gray-200 rounded-2xl shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
                <Store className="h-8 w-8 text-blue-500" />
              </div>
              <CardTitle className="mb-2 text-lg">Conectează-ți magazinul</CardTitle>
              <CardDescription className="text-center max-w-sm mb-6">
                Pentru a începe să optimizezi produse cu AI, conectează mai întâi magazinul tău WooCommerce.
              </CardDescription>
              <Link href="/settings">
                <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">
                  Conectează magazin
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ) : products.length === 0 ? (
        <motion.div {...fadeInUp} transition={{ duration: 0.4, delay: 0.1 }}>
          <Card className="border-dashed border-2 border-gray-200 rounded-2xl shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="h-16 w-16 rounded-2xl bg-yellow-50 flex items-center justify-center mb-5">
                <Package className="h-8 w-8 text-yellow-500" />
              </div>
              <CardTitle className="mb-2 text-lg">Niciun produs sincronizat</CardTitle>
              <CardDescription className="text-center max-w-sm mb-6">
                Magazinul este conectat. Mergi la Setări și sincronizează produsele.
              </CardDescription>
              <Link href="/settings">
                <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">
                  Mergi la Setări
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Search & Filters bar */}
          <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.05 }}>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Caută produse după nume sau categorie..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-xl border-gray-200 bg-white focus:border-blue-300 focus:ring-blue-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`h-10 rounded-xl border-gray-200 gap-2 ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtre
                  {activeFilters > 0 && (
                    <Badge className="bg-blue-600 text-white text-[10px] h-5 w-5 p-0 flex items-center justify-center rounded-full">
                      {activeFilters}
                    </Badge>
                  )}
                </Button>

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
              </div>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-3 pt-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 font-medium">Status:</span>
                      <div className="flex gap-1">
                        {statusOptions.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setStatusFilter(opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              statusFilter === opt.value
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {opt.label} ({opt.count})
                          </button>
                        ))}
                      </div>
                    </div>

                    {categories.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 font-medium">Categorie:</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setCategoryFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              categoryFilter === 'all'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            Toate
                          </button>
                          {categories.map(cat => (
                            <button
                              key={cat}
                              onClick={() => setCategoryFilter(cat)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                categoryFilter === cat
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeFilters > 0 && (
                      <button
                        onClick={() => { setStatusFilter('all'); setCategoryFilter('all') }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-all"
                      >
                        Resetează filtrele
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {(searchQuery || activeFilters > 0) && (
            <p className="text-sm text-gray-400">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'produs' : 'produse'} găsite
            </p>
          )}

          {filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <SearchIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Niciun produs găsit</p>
              <p className="text-sm text-gray-400 mt-1">Încearcă să modifici filtrele sau termenul de căutare</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                  className="h-full"
                >
                  <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden card-hover shadow-sm flex flex-col h-full">
                    {/* Image — fixed aspect ratio */}
                    <div className="relative aspect-square bg-gray-50 overflow-hidden shrink-0">
                     {(product.thumbnail_url || (product.original_images && product.original_images.length > 0)) ? (
                      <img
                       src={product.thumbnail_url || product.original_images![0]}
                       alt={product.original_title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-gray-200" />
                        </div>
                      )}

                      <div className="absolute top-2 left-2">
                        <Badge className={`text-[10px] border-0 shadow-sm ${
                          product.status === 'published' ? 'bg-green-500 text-white' :
                          product.status === 'optimized' ? 'bg-blue-500 text-white' :
                          'bg-white/90 backdrop-blur text-gray-600'
                        }`}>
                          {product.status === 'published' ? 'Publicat' :
                           product.status === 'optimized' ? 'Optimizat' : 'Draft'}
                        </Badge>
                      </div>

                      {product.seo_score > 0 && (
                        <div className="absolute top-2 right-2">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${
                            product.seo_score >= 80 ? 'bg-green-500 text-white' :
                            product.seo_score >= 50 ? 'bg-yellow-500 text-white' :
                            'bg-red-500 text-white'
                          }`}>
                            {product.seo_score}
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                        <Link href={`/products/${product.id}`}>
                          <Button
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 bg-white text-gray-900 hover:bg-white/90 rounded-xl shadow-lg h-9 px-4 text-xs font-medium"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            Detalii produs
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Info — fixed height for equal cards */}
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug min-h-[2.5rem]">
                        {product.optimized_title || product.original_title}
                      </h3>

                      <div className="flex items-center justify-between mt-auto pt-1.5">
                        {product.category ? (
                          <span className="text-[11px] text-gray-400 truncate mr-2">{product.category}</span>
                        ) : (
                          <span />
                        )}
                        {product.price ? (
                          <span className="text-sm font-semibold text-gray-900 shrink-0">
                            {product.price} <span className="text-xs text-gray-400">RON</span>
                          </span>
                        ) : (
                          <span />
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.2) }}
                >
                  <Link href={`/products/${product.id}`}>
                    <div className="group flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-3 hover:shadow-md hover:border-blue-100 transition-all cursor-pointer">
                      <div className="h-14 w-14 rounded-xl bg-gray-50 overflow-hidden shrink-0">
                        {(product.thumbnail_url || (product.original_images && product.original_images.length > 0)) ? (
  <img src={product.thumbnail_url || product.original_images![0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-gray-200" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {product.optimized_title || product.original_title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${
                            product.status === 'published' ? 'bg-green-50 text-green-700' :
                            product.status === 'optimized' ? 'bg-blue-50 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {product.status === 'published' ? 'Publicat' :
                             product.status === 'optimized' ? 'Optimizat' : 'Draft'}
                          </Badge>
                          {product.category && (
                            <span className="text-[11px] text-gray-400">{product.category}</span>
                          )}
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-4">
                        {product.seo_score > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  product.seo_score >= 80 ? 'bg-green-500' :
                                  product.seo_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${product.seo_score}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium min-w-[2rem] ${
                              product.seo_score >= 80 ? 'text-green-600' :
                              product.seo_score >= 50 ? 'text-yellow-600' : 'text-red-500'
                            }`}>
                              {product.seo_score}
                            </span>
                          </div>
                        )}
                        {product.price && (
                          <span className="text-sm font-semibold text-gray-900 min-w-[4rem] text-right">
                            {product.price} RON
                          </span>
                        )}
                      </div>

                      <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}