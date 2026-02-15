'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ImageIcon,
  Loader2,
  Download,
  ExternalLink,
  SearchIcon,
  SlidersHorizontal,
  X,
  Check,
  Grid3X3,
  Sparkles,
  Eye,
} from 'lucide-react'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type GeneratedImage = {
  id: string
  style: string
  generated_image_url: string
  original_image_url: string | null
  quality_score: number
  status: string
  credits_used: number
  processing_time_ms: number | null
  created_at: string
  product_title: string
}

const styleLabels: Record<string, { label: string; icon: string }> = {
  white_bg: { label: 'Fundal alb', icon: '🤍' },
  lifestyle: { label: 'Lifestyle', icon: '🏡' },
  premium_dark: { label: 'Premium Dark', icon: '🖤' },
  industrial: { label: 'Industrial', icon: '🏭' },
  seasonal: { label: 'Seasonal', icon: '🎄' },
  auto: { label: 'Auto AI', icon: '🤖' },
}

export default function ImagesPage() {
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [styleFilter, setStyleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)

  useEffect(() => {
    fetchImages()
  }, [])

  const fetchImages = async () => {
    try {
      const res = await fetch('/api/images')
      const data = await res.json()
      setImages(data.images || [])
    } catch {
      console.error('Error loading images')
    } finally {
      setLoading(false)
    }
  }

  const styles = useMemo(() => {
    const s = images.map(i => i.style).filter(Boolean)
    return [...new Set(s)]
  }, [images])

  const filteredImages = useMemo(() => {
    return images.filter(img => {
      const matchesSearch = searchQuery === '' ||
        img.product_title.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStyle = styleFilter === 'all' || img.style === styleFilter
      const matchesStatus = statusFilter === 'all' || img.status === statusFilter
      return matchesSearch && matchesStyle && matchesStatus
    })
  }, [images, searchQuery, styleFilter, statusFilter])

  const activeFilters = (styleFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)
  const totalCredits = images.reduce((sum, img) => sum + img.credits_used, 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="aspect-square bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Imagini generate</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {images.length} imagini • {totalCredits} credite utilizate
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      {images.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total imagini', value: images.length, color: 'blue' },
              { label: 'Publicate', value: images.filter(i => i.status === 'published').length, color: 'green' },
              { label: 'Stiluri folosite', value: styles.length, color: 'purple' },
              { label: 'Credite cheltuite', value: totalCredits, color: 'orange' },
            ].map((stat, i) => (
              <div key={stat.label} className={`bg-${stat.color}-50 rounded-xl p-3`}>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {images.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Card className="border-dashed border-2 border-gray-200 rounded-2xl shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
                <ImageIcon className="h-8 w-8 text-blue-500" />
              </div>
              <CardTitle className="mb-2 text-lg">Nicio imagine generată</CardTitle>
              <CardDescription className="text-center max-w-sm">
                Mergi la un produs și apasă "Generează imagine" pentru a crea prima imagine AI.
              </CardDescription>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Search & filters */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Caută după nume produs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-xl border-gray-200 bg-white"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
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
                      <span className="text-xs text-gray-400 font-medium">Stil:</span>
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => setStyleFilter('all')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            styleFilter === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          Toate
                        </button>
                        {styles.map(s => (
                          <button
                            key={s}
                            onClick={() => setStyleFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              styleFilter === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {styleLabels[s]?.icon} {styleLabels[s]?.label || s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 font-medium">Status:</span>
                      <div className="flex gap-1">
                        {['all', 'completed', 'published'].map(s => (
                          <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              statusFilter === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {s === 'all' ? 'Toate' : s === 'completed' ? 'Gata' : 'Publicate'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {activeFilters > 0 && (
                      <button
                        onClick={() => { setStyleFilter('all'); setStatusFilter('all') }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50"
                      >
                        Resetează
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {filteredImages.length === 0 ? (
            <div className="text-center py-16">
              <SearchIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nicio imagine găsită</p>
              <p className="text-sm text-gray-400 mt-1">Modifică filtrele sau termenul de căutare</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredImages.map((image, i) => (
                <motion.div
                  key={image.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                >
                  <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden card-hover shadow-sm">
                    <div className="relative aspect-square bg-gray-50 overflow-hidden">
                      <img
                        src={image.generated_image_url}
                        alt={image.product_title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* Top badges */}
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-black/50 backdrop-blur text-white border-0 text-[10px]">
                          {styleLabels[image.style]?.icon} {styleLabels[image.style]?.label || image.style}
                        </Badge>
                      </div>
                      <div className="absolute top-2 right-2">
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center ${
                          image.status === 'published' ? 'bg-green-500' : 'bg-blue-500'
                        }`}>
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      </div>

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center gap-2">
                        <button
                          onClick={() => window.open(image.generated_image_url, '_blank')}
                          className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 h-9 w-9 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center text-gray-700 hover:bg-white shadow-lg"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => window.open(image.generated_image_url)}
                          className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 delay-75 h-9 w-9 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center text-gray-700 hover:bg-white shadow-lg"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-gray-900 line-clamp-1">{image.product_title}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-400">
                          {new Date(image.created_at).toLocaleDateString('ro-RO')}
                        </span>
                        <span className="text-[10px] text-gray-400">{image.credits_used} cr</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}