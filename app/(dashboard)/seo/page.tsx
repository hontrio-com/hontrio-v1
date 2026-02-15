'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Loader2,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Target,
  Shield,
  Sparkles,
  ExternalLink,
  BarChart3,
  Eye,
  FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

type ProductSEO = {
  id: string
  original_title: string
  optimized_title: string | null
  meta_description: string | null
  seo_score: number
  seo_suggestions: string[] | null
  status: string
  original_images: string[] | null
}

const fadeInUp = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
}

export default function SEOPage() {
  const [products, setProducts] = useState<ProductSEO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data.products || [])
    } catch {
      console.error('Error loading products')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-40 bg-white rounded-2xl animate-pulse" />
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const productsWithScore = products.filter(p => p.seo_score > 0)
  const avgScore = productsWithScore.length > 0
    ? Math.round(productsWithScore.reduce((sum, p) => sum + p.seo_score, 0) / productsWithScore.length)
    : 0
  const excellent = productsWithScore.filter(p => p.seo_score >= 80).length
  const good = productsWithScore.filter(p => p.seo_score >= 50 && p.seo_score < 80).length
  const needsWork = productsWithScore.filter(p => p.seo_score < 50).length
  const notOptimized = products.filter(p => p.seo_score === 0).length

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-500'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excelent'
    if (score >= 50) return 'Bun'
    return 'Necesită atenție'
  }

  const sortedProducts = [...products].sort((a, b) => {
    if (a.seo_score === 0 && b.seo_score === 0) return 0
    if (a.seo_score === 0) return 1
    if (b.seo_score === 0) return -1
    return a.seo_score - b.seo_score
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analiză SEO</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Optimizare bazată pe practicile Google Search Quality Guidelines
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-green-200 text-green-600 bg-green-50 gap-1 py-1">
              <Shield className="h-3 w-3" />
              Conform Google E-E-A-T
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* Trust banner */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />

          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                {/* Score circle */}
                <div className="relative shrink-0">
                  <svg className="w-20 h-20 -rotate-90">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r="34" fill="none"
                      stroke={avgScore >= 80 ? '#4ade80' : avgScore >= 50 ? '#facc15' : '#f87171'}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${avgScore * 2.14} 214`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold">{avgScore > 0 ? avgScore : '—'}</span>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold">
                    {avgScore >= 80 ? 'Scor SEO excelent!' :
                     avgScore >= 50 ? 'Scor SEO bun — cu potențial de creștere' :
                     avgScore > 0 ? 'Scorul SEO necesită îmbunătățiri' :
                     'Niciun produs analizat încă'}
                  </h2>
                  <p className="text-blue-200 text-sm mt-1 max-w-lg">
                    {avgScore > 0
                      ? 'Analiza noastră urmează criteriile Google pentru calitatea conținutului: relevanță, structură, meta tags, și experiența utilizatorului.'
                      : 'Generează conținut AI pentru produsele tale ca să primești analiza SEO completă.'}
                  </p>
                </div>
              </div>

              {/* Quick stats */}
              {avgScore > 0 && (
                <div className="flex gap-3">
                  <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center min-w-[80px]">
                    <p className="text-lg font-bold text-green-300">{excellent}</p>
                    <p className="text-[10px] text-blue-200">Excelent</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center min-w-[80px]">
                    <p className="text-lg font-bold text-yellow-300">{good}</p>
                    <p className="text-[10px] text-blue-200">Bun</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center min-w-[80px]">
                    <p className="text-lg font-bold text-red-300">{needsWork}</p>
                    <p className="text-[10px] text-blue-200">De lucru</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center min-w-[80px]">
                    <p className="text-lg font-bold text-white/60">{notOptimized}</p>
                    <p className="text-[10px] text-blue-200">Neanaliz.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Google practices cards */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.1 }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              icon: Target,
              title: 'Relevanță conținut',
              desc: 'Titluri și descrieri optimizate cu cuvinte cheie relevante pentru intenția de căutare',
              color: 'blue',
            },
            {
              icon: FileText,
              title: 'Structură tehnică',
              desc: 'Meta description, headings structurate H1-H3, lungimi optimale recomandate de Google',
              color: 'green',
            },
            {
              icon: Eye,
              title: 'Experiență utilizator',
              desc: 'Conținut persuasiv, beneficii clare, call-to-action-uri care cresc rata de conversie',
              color: 'purple',
            },
          ].map((item, i) => (
            <Card key={item.title} className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-xl bg-${item.color}-100 flex items-center justify-center shrink-0`}>
                    <item.icon className={`h-4 w-4 text-${item.color}-600`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Products list */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.15 }}>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Toate produsele — Scor SEO</CardTitle>
              <span className="text-xs text-gray-400">{products.length} produse</span>
            </div>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Niciun produs sincronizat</p>
                <p className="text-sm text-gray-400 mt-1">Conectează magazinul și sincronizează produsele</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedProducts.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                  >
                    <Link href={`/products/${product.id}`}>
                      <div className="group flex items-center gap-4 p-3.5 rounded-xl hover:bg-gray-50 transition-all cursor-pointer">
                        {/* Product image */}
                        <div className="h-11 w-11 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                          {product.original_images && product.original_images[0] ? (
                            <img src={product.original_images[0]} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Search className="h-4 w-4 text-gray-300" />
                            </div>
                          )}
                        </div>

                        {/* Product info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {product.optimized_title || product.original_title}
                          </p>
                          {product.meta_description ? (
                            <p className="text-xs text-gray-400 truncate mt-0.5">{product.meta_description}</p>
                          ) : (
                            <p className="text-xs text-gray-300 italic mt-0.5">Fără meta description</p>
                          )}
                        </div>

                        {/* SEO Score */}
                        <div className="flex items-center gap-3 shrink-0">
                          {product.seo_score > 0 ? (
                            <>
                              {/* Score bar */}
                              <div className="hidden sm:flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${product.seo_score}%` }}
                                    transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                                    className={`h-full rounded-full ${getScoreBg(product.seo_score)}`}
                                  />
                                </div>
                              </div>

                              {/* Score badge */}
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                                product.seo_score >= 80 ? 'bg-green-50' :
                                product.seo_score >= 50 ? 'bg-yellow-50' : 'bg-red-50'
                              }`}>
                                {product.seo_score >= 80 ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                ) : product.seo_score >= 50 ? (
                                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                                )}
                                <span className={`text-sm font-bold ${getScoreColor(product.seo_score)}`}>
                                  {product.seo_score}
                                </span>
                              </div>
                            </>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-400 border-0 text-[11px]">
                              Neoptimizat
                            </Badge>
                          )}

                          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </div>
                    </Link>

                    {i < sortedProducts.length - 1 && (
                      <div className="border-b border-gray-50 mx-3" />
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Best practices footer */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.2 }}>
        <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-br from-gray-50 to-blue-50/30">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Metodologia noastră de optimizare SEO</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  HONTRIO analizează fiecare produs conform criteriilor Google E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness).
                  Verificăm lungimea și relevanța titlurilor (50-70 caractere), meta description-urile (sub 155 caractere),
                  structura heading-urilor, densitatea cuvintelor cheie, și calitatea conținutului.
                  Scorul nostru reflectă nivelul de optimizare conform celor mai recente practici Google Search Quality Guidelines.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}