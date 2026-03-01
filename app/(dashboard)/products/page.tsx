'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Package, Store, ArrowRight, ImageIcon, Loader2, SearchIcon,
  Grid3X3, LayoutList, X, ChevronLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [hasStore, setHasStore] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [totalProducts, setTotalProducts] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const storeRes = await fetch('/api/stores')
      const storeData = await storeRes.json()
      setHasStore(!!storeData.store)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: perPage.toString(),
        parent_only: 'true',
      })
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch('/api/products?' + params)
      const data = await res.json()
      setProducts(data.products || [])
      setTotalProducts(data.total || 0)
      setTotalPages(data.total_pages || 0)
    } catch {
      console.error('Error loading products')
    } finally {
      setLoading(false)
    }
  }, [currentPage, perPage, searchQuery])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(searchInput); setCurrentPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

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

  if (loading && products.length === 0) return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="aspect-[3/4] bg-white rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Produse</h1>
            <p className="text-sm text-gray-400 mt-0.5">{totalProducts} produse sincronizate</p>
          </div>
          <div className="flex items-center gap-2">
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
      </motion.div>

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
          {/* Search */}
          <div className="relative max-w-md">
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

          {/* Per page + count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {totalProducts} produse{searchQuery ? ` pentru "${searchQuery}"` : ''}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 hidden sm:inline">Pe pagină:</span>
              {[50, 100, 500].map(n => (
                <button
                  key={n}
                  onClick={() => { setPerPage(n); setCurrentPage(1) }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${perPage === n ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-gray-500">Se încarcă...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {searchQuery ? 'Niciun produs găsit' : 'Niciun produs sincronizat'}
              </p>
              {!searchQuery && (
                <Link href="/settings">
                  <Button variant="link" className="text-blue-600 mt-2">Sincronizează din Setări</Button>
                </Link>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* ── GRID VIEW ── */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {products.map((product, i) => {
                const imgUrl = getImageUrl(product)
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.25) }}
                  >
                    <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200 flex flex-col">
                      {/* Image */}
                      <div className="relative aspect-square bg-gray-50 overflow-hidden">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={product.original_title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-gray-200" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3 flex flex-col flex-1">
                        <h3 className="text-sm font-medium text-gray-900 leading-snug">
                          {product.optimized_title || product.original_title}
                        </h3>
                        <div className="flex items-center justify-between mt-auto pt-2">
                          {product.category && (
                            <span className="text-[11px] text-gray-400 truncate mr-2">{product.category}</span>
                          )}
                          {product.price && (
                            <span className="text-sm font-semibold text-gray-800 shrink-0">
                              {product.price} <span className="text-xs text-gray-400 font-normal">RON</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            /* ── LIST VIEW ── */
            <div className="space-y-1.5">
              {products.map((product, i) => {
                const imgUrl = getImageUrl(product)
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
                  >
                    <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-3 hover:border-blue-100 hover:shadow-sm transition-all">
                      <div className="h-12 w-12 rounded-xl bg-gray-50 overflow-hidden shrink-0">
                        {imgUrl ? (
                          <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-gray-200" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {product.optimized_title || product.original_title}
                        </p>
                        {product.category && (
                          <p className="text-xs text-gray-400 mt-0.5">{product.category}</p>
                        )}
                      </div>
                      {product.price && (
                        <span className="text-sm font-semibold text-gray-800 shrink-0">
                          {product.price} RON
                        </span>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Pagina {currentPage} din {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
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
                      className={`h-8 w-8 rounded-lg text-sm font-medium transition-all ${currentPage === pn ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                      {pn}
                    </button>
                  )
                )}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
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