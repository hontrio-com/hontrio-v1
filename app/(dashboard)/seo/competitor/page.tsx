'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, Loader2, XCircle, CheckCircle, ArrowRight,
  Globe, Zap, Search, Shield, BarChart3, AlertTriangle,
  ChevronDown, ExternalLink, RefreshCw, Plus, Trash2, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

// ─── Types ────────────────────────────────────────────────────────────────────
type StoreAnalysis = {
  url: string
  title: string
  meta_description: string
  h1: string
  headings: string[]
  focus_keywords: string[]
  keyword_density: Record<string, number>
  content_length_estimate: number
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  page_speed_hint?: string
  structured_data_present?: boolean
}

type ComparisonResult = {
  my_store: StoreAnalysis
  competitor: StoreAnalysis
  verdict: {
    winner_title: 'tu' | 'competitor' | 'egal'
    winner_meta: 'tu' | 'competitor' | 'egal'
    winner_keywords: 'tu' | 'competitor' | 'egal'
    overall_score_you: number
    overall_score_competitor: number
    summary: string
    top_actions: string[]
  }
}

type SavedCompetitor = {
  url: string
  label: string
  last_analyzed?: string
  score_diff?: number
}

// ─── Score Bar ────────────────────────────────────────────────────────────────
function ScoreBar({ label, you, them }: { label: string; you: number; them: number }) {
  const max = Math.max(you, them, 1)
  const youWins = you > them
  const draw = you === them
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`font-bold ${youWins || draw ? 'text-blue-600' : 'text-gray-400'}`}>{you}</span>
          <span className="text-gray-300">vs</span>
          <span className={`font-bold ${!youWins && !draw ? 'text-red-500' : 'text-gray-400'}`}>{them}</span>
        </div>
      </div>
      <div className="flex gap-1 h-2">
        <div className="flex-1 bg-gray-100 rounded-full overflow-hidden flex justify-end">
          <div className={`h-full rounded-full transition-all ${youWins || draw ? 'bg-blue-500' : 'bg-blue-200'}`}
            style={{ width: `${(you / max) * 100}%` }} />
        </div>
        <div className="flex-1 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${!youWins && !draw ? 'bg-red-400' : 'bg-red-200'}`}
            style={{ width: `${(them / max) * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

// ─── Winner Badge ─────────────────────────────────────────────────────────────
function WinnerBadge({ winner, field }: { winner: 'tu' | 'competitor' | 'egal'; field: string }) {
  if (winner === 'tu') return <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Star className="h-2.5 w-2.5" />Tu câștig</span>
  if (winner === 'competitor') return <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" />Competitor câștig</span>
  return <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Egal</span>
}

// ─── Field Compare Row ────────────────────────────────────────────────────────
function FieldCompare({ label, mine, theirs, winner }: { label: string; mine: string; theirs: string; winner: 'tu' | 'competitor' | 'egal' }) {
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50/60 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <WinnerBadge winner={winner} field={label} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        <div className={`p-3.5 ${winner === 'tu' ? 'bg-blue-50/30' : ''}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Magazinul tău</span>
          </div>
          <p className={`text-xs leading-relaxed ${mine ? 'text-gray-800' : 'text-gray-300 italic'}`}>{mine || 'Necompletat'}</p>
          {mine && label.includes('Titlu') && (
            <p className={`text-[10px] mt-1 font-medium ${mine.length >= 50 && mine.length <= 70 ? 'text-emerald-600' : 'text-amber-500'}`}>
              {mine.length} car. {mine.length >= 50 && mine.length <= 70 ? '✓ ideal' : '(ideal 50-70)'}
            </p>
          )}
          {mine && label.includes('Meta') && (
            <p className={`text-[10px] mt-1 font-medium ${mine.length >= 120 && mine.length <= 155 ? 'text-emerald-600' : 'text-amber-500'}`}>
              {mine.length} car. {mine.length >= 120 && mine.length <= 155 ? '✓ ideal' : '(ideal 120-155)'}
            </p>
          )}
        </div>
        <div className={`p-3.5 ${winner === 'competitor' ? 'bg-red-50/30' : ''}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Competitor</span>
          </div>
          <p className={`text-xs leading-relaxed ${theirs ? 'text-gray-800' : 'text-gray-300 italic'}`}>{theirs || 'Nedetectat'}</p>
          {theirs && label.includes('Titlu') && (
            <p className={`text-[10px] mt-1 font-medium ${theirs.length >= 50 && theirs.length <= 70 ? 'text-emerald-600' : 'text-amber-500'}`}>
              {theirs.length} car. {theirs.length >= 50 && theirs.length <= 70 ? '✓ ideal' : '(ideal 50-70)'}
            </p>
          )}
          {theirs && label.includes('Meta') && (
            <p className={`text-[10px] mt-1 font-medium ${theirs.length >= 120 && theirs.length <= 155 ? 'text-emerald-600' : 'text-amber-500'}`}>
              {theirs.length} car. {theirs.length >= 120 && theirs.length <= 155 ? '✓ ideal' : '(ideal 120-155)'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CompetitorPage() {
  const [myUrl, setMyUrl] = useState('')
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [error, setError] = useState('')
  const [savedCompetitors, setSavedCompetitors] = useState<SavedCompetitor[]>([])
  const [newLabel, setNewLabel] = useState('')

  // Load store URL from settings
  useEffect(() => {
    fetch('/api/stores').then(r => r.json()).then(d => {
      if (d.store?.store_url) setMyUrl(d.store.store_url)
    }).catch(() => {})

    // Load saved competitors from localStorage (client-side only)
    try {
      const saved = JSON.parse(localStorage.getItem('seo_competitors') || '[]')
      setSavedCompetitors(saved)
    } catch {}
  }, [])

  function saveCompetitor() {
    if (!competitorUrl.trim()) return
    const entry: SavedCompetitor = {
      url: competitorUrl.trim(),
      label: newLabel.trim() || new URL(competitorUrl.trim()).hostname,
      last_analyzed: new Date().toLocaleDateString('ro-RO'),
    }
    const updated = [entry, ...savedCompetitors.filter(c => c.url !== entry.url)].slice(0, 8)
    setSavedCompetitors(updated)
    try { localStorage.setItem('seo_competitors', JSON.stringify(updated)) } catch {}
    setNewLabel('')
  }

  function removeCompetitor(url: string) {
    const updated = savedCompetitors.filter(c => c.url !== url)
    setSavedCompetitors(updated)
    try { localStorage.setItem('seo_competitors', JSON.stringify(updated)) } catch {}
  }

  async function analyze() {
    if (!myUrl.trim() || !competitorUrl.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      // Fetch both pages in parallel via competitor API (reuse existing)
      const [myRes, theirRes] = await Promise.all([
        fetch('/api/seo/competitor', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitor_url: myUrl.trim(), product_id: null }),
        }),
        fetch('/api/seo/competitor', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitor_url: competitorUrl.trim(), product_id: null }),
        }),
      ])

      const myData   = await myRes.json()
      const theirData = await theirRes.json()

      if (!myRes.ok)   { setError(myData.error || 'Nu pot accesa magazinul tău'); return }
      if (!theirRes.ok) { setError(theirData.error || 'Nu pot accesa magazinul competitorului'); return }

      const my: StoreAnalysis = { url: myUrl, ...myData.analysis }
      const them: StoreAnalysis = { url: competitorUrl, ...theirData.analysis }

      // Simple scoring
      function scoreStore(s: StoreAnalysis) {
        let score = 0
        if (s.title) { const l = s.title.length; score += l >= 50 && l <= 70 ? 25 : l > 0 ? 12 : 0 }
        if (s.meta_description) { const l = s.meta_description.length; score += l >= 120 && l <= 155 ? 25 : l > 0 ? 12 : 0 }
        if (s.focus_keywords?.length > 0) score += Math.min(s.focus_keywords.length * 5, 20)
        if (s.headings?.length > 0) score += Math.min(s.headings.length * 3, 15)
        if (s.content_length_estimate > 300) score += 15
        return Math.min(score, 100)
      }

      const myScore   = scoreStore(my)
      const themScore = scoreStore(them)

      const winnerOverall = myScore > themScore ? 'tu' : myScore < themScore ? 'competitor' : 'egal'

      const verdict = {
        winner_title: (!my.title ? 'competitor' : !them.title ? 'tu' : my.title.length >= 50 && my.title.length <= 70 && !(them.title.length >= 50 && them.title.length <= 70) ? 'tu' : them.title.length >= 50 && them.title.length <= 70 && !(my.title.length >= 50 && my.title.length <= 70) ? 'competitor' : 'egal') as 'tu' | 'competitor' | 'egal',
        winner_meta: (!my.meta_description ? 'competitor' : !them.meta_description ? 'tu' : my.meta_description.length >= 120 && my.meta_description.length <= 155 && !(them.meta_description.length >= 120 && them.meta_description.length <= 155) ? 'tu' : them.meta_description.length >= 120 && them.meta_description.length <= 155 && !(my.meta_description.length >= 120 && my.meta_description.length <= 155) ? 'competitor' : 'egal') as 'tu' | 'competitor' | 'egal',
        winner_keywords: (my.focus_keywords?.length || 0) > (them.focus_keywords?.length || 0) ? 'tu' : (my.focus_keywords?.length || 0) < (them.focus_keywords?.length || 0) ? 'competitor' : 'egal' as 'tu' | 'competitor' | 'egal',
        overall_score_you: myScore,
        overall_score_competitor: themScore,
        summary: winnerOverall === 'tu' ? `Magazinul tău e mai bine optimizat SEO (${myScore} vs ${themScore}).` : winnerOverall === 'competitor' ? `Competitorul e mai bine optimizat SEO (${themScore} vs ${myScore}). Ai oportunități clare de îmbunătățire.` : `Sunteți la egalitate SEO (${myScore} vs ${themScore}). Detaliile fac diferența.`,
        top_actions: them.opportunities?.slice(0, 4) || my.weaknesses?.slice(0, 4) || [],
      }

      setResult({ my_store: my, competitor: them, verdict })
      saveCompetitor()
    } catch (e: any) {
      setError('Eroare la analiză: ' + e.message)
    } finally { setLoading(false) }
  }

  const youWin = result && result.verdict.overall_score_you > result.verdict.overall_score_competitor
  const draw   = result && result.verdict.overall_score_you === result.verdict.overall_score_competitor

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analiză Competitori</h1>
            <p className="text-gray-500 text-sm mt-0.5">Compară magazinul tău cu orice competitor — SEO, titlu, meta, keywords, structură</p>
          </div>
          <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600 bg-indigo-50 gap-1 py-1 shrink-0">
            <TrendingUp className="h-3 w-3" />3 credite / analiză
          </Badge>
        </div>
      </motion.div>

      {/* Input card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-indigo-300" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">Comparație magazin vs competitor</h2>
                <p className="text-indigo-300 text-xs">Analizăm homepage-ul sau orice pagină din cele două magazine</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-indigo-300 text-[11px] font-semibold uppercase tracking-wide block mb-1.5">
                  🏪 Magazinul tău
                </label>
                <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5">
                  <Globe className="h-4 w-4 text-indigo-300 shrink-0" />
                  <input value={myUrl} onChange={e => setMyUrl(e.target.value)}
                    placeholder="https://magazinul-tau.ro"
                    className="flex-1 bg-transparent text-white placeholder-indigo-400 text-sm focus:outline-none min-w-0" />
                </div>
              </div>
              <div>
                <label className="text-indigo-300 text-[11px] font-semibold uppercase tracking-wide block mb-1.5">
                  🔍 Magazin competitor
                </label>
                <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5">
                  <Globe className="h-4 w-4 text-red-300 shrink-0" />
                  <input value={competitorUrl} onChange={e => setCompetitorUrl(e.target.value)}
                    placeholder="https://competitor.ro"
                    className="flex-1 bg-transparent text-white placeholder-indigo-400 text-sm focus:outline-none min-w-0" />
                </div>
              </div>
            </div>

            {/* Saved competitors quick-select */}
            {savedCompetitors.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                <span className="text-indigo-400 text-[10px] self-center font-medium">Salvați:</span>
                {savedCompetitors.map((c, i) => (
                  <button key={i} onClick={() => setCompetitorUrl(c.url)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${competitorUrl === c.url ? 'bg-indigo-500 text-white' : 'bg-white/10 text-indigo-200 hover:bg-white/20'}`}>
                    {c.label}
                    <span onClick={e => { e.stopPropagation(); removeCompetitor(c.url) }}
                      className="opacity-50 hover:opacity-100 ml-0.5">×</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <Button onClick={analyze} disabled={loading || !myUrl.trim() || !competitorUrl.trim()}
                className="bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl gap-2 px-6 font-semibold shrink-0 h-10">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                {loading ? 'Analizez ambele magazine...' : 'Analizează acum'}
              </Button>
              {error && <p className="text-red-300 text-xs flex items-center gap-1.5 self-center"><XCircle className="h-3.5 w-3.5 shrink-0" />{error}</p>}
            </div>
          </div>

          {/* Info strip */}
          <div className="px-5 py-3 border-t border-gray-100 flex gap-4 flex-wrap text-xs text-gray-400">
            {[
              { icon: Zap, text: 'Titlu & Meta description' },
              { icon: Search, text: 'Keywords & Headings' },
              { icon: BarChart3, text: 'Scor comparativ' },
              { icon: Shield, text: 'Oportunități concrete' },
            ].map((item, i) => (
              <span key={i} className="flex items-center gap-1.5"><item.icon className="h-3 w-3" />{item.text}</span>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Loading */}
      {loading && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Analizez ambele magazine...</p>
            <p className="text-gray-400 text-xs mt-1">Extrag titlu, meta, keywords, structura de headings</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !loading && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Overall verdict */}
          <Card className={`rounded-2xl border-0 shadow-sm overflow-hidden`}>
            <div className={`p-5 ${youWin ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : draw ? 'bg-gray-50' : 'bg-gradient-to-r from-red-50 to-orange-50'}`}>
              <div className="flex items-start gap-4 flex-wrap">
                <div className={`text-4xl shrink-0 ${youWin ? '' : draw ? '' : ''}`}>
                  {youWin ? '🏆' : draw ? '🤝' : '⚠️'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-lg ${youWin ? 'text-blue-700' : draw ? 'text-gray-700' : 'text-red-700'}`}>
                    {youWin ? 'Magazinul tău e mai bine optimizat!' : draw ? 'Egalitate — detaliile fac diferența' : 'Competitorul te depășește SEO'}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">{result.verdict.summary}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{result.verdict.overall_score_you}</p>
                    <p className="text-[10px] text-gray-500 font-medium">Tu</p>
                  </div>
                  <div className="text-gray-300 font-bold">vs</div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${youWin ? 'text-gray-400' : 'text-red-500'}`}>{result.verdict.overall_score_competitor}</p>
                    <p className="text-[10px] text-gray-500 font-medium">Competitor</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Score bars */}
            <div className="p-5 space-y-3 border-t border-gray-100">
              <ScoreBar label="Titlu SEO" you={result.my_store.title?.length || 0} them={result.competitor.title?.length || 0} />
              <ScoreBar label="Meta Description" you={result.my_store.meta_description?.length || 0} them={result.competitor.meta_description?.length || 0} />
              <ScoreBar label="Keywords identificate" you={result.my_store.focus_keywords?.length || 0} them={result.competitor.focus_keywords?.length || 0} />
              <ScoreBar label="Headings structurate" you={result.my_store.headings?.length || 0} them={result.competitor.headings?.length || 0} />
            </div>
          </Card>

          {/* Field comparisons */}
          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
              <h3 className="font-semibold text-gray-900 text-sm">Comparație detaliată</h3>
            </div>
            <div className="p-4 space-y-3">
              <FieldCompare
                label="Titlu SEO"
                mine={result.my_store.title || ''}
                theirs={result.competitor.title || ''}
                winner={result.verdict.winner_title}
              />
              <FieldCompare
                label="Meta Description"
                mine={result.my_store.meta_description || ''}
                theirs={result.competitor.meta_description || ''}
                winner={result.verdict.winner_meta}
              />
            </div>
          </Card>

          {/* Keywords comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Keywords tale</p>
                  <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded font-medium ml-auto">{result.my_store.focus_keywords?.length || 0} detectate</span>
                </div>
                {result.my_store.focus_keywords?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.my_store.focus_keywords.map((kw, i) => (
                      <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-medium">{kw}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Niciun keyword detectat clar pe homepage</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Keywords competitor</p>
                  <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-medium ml-auto">{result.competitor.focus_keywords?.length || 0} detectate</span>
                </div>
                {result.competitor.focus_keywords?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.competitor.focus_keywords.map((kw, i) => (
                      <span key={i} className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-lg font-medium">{kw}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Niciun keyword detectat clar</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {result.my_store.strengths?.length > 0 && (
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span>💪</span>Punctele tale forte
                  </p>
                  <div className="space-y-1.5">
                    {result.my_store.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />{s}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {result.competitor.strengths?.length > 0 && (
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span>🔍</span>Punctele forte competitor
                  </p>
                  <div className="space-y-1.5">
                    {result.competitor.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />{s}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Top actions */}
          {result.verdict.top_actions?.length > 0 && (
            <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-indigo-600">
                <p className="text-white font-semibold text-sm flex items-center gap-2">
                  🚀 Acțiuni prioritare — ce trebuie să faci acum
                </p>
              </div>
              <CardContent className="p-4">
                <div className="space-y-2.5">
                  {result.verdict.top_actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                      <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-white">{i + 1}</span>
                      </div>
                      <p className="text-xs text-indigo-900 leading-relaxed">{action}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Links to both */}
          <div className="flex gap-3 flex-wrap">
            <a href={result.my_store.url} target="_blank" rel="noopener"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors font-medium">
              <ExternalLink className="h-3.5 w-3.5" />Deschide magazinul tău
            </a>
            <a href={result.competitor.url} target="_blank" rel="noopener"
              className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors font-medium">
              <ExternalLink className="h-3.5 w-3.5" />Deschide magazinul competitor
            </a>
            <button onClick={analyze}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl transition-colors font-medium ml-auto">
              <RefreshCw className="h-3.5 w-3.5" />Reanalizează
            </button>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-8 text-center">
              <TrendingUp className="h-12 w-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-600 font-semibold">Cum funcționează</p>
              <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                Introdu URL-ul magazinului tău și al unui competitor. Analizăm ambele pagini și îți arătăm exact unde ești mai bun și ce trebuie îmbunătățit.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-6 max-w-xs mx-auto">
                {[{ icon: Zap, label: 'SEO tehnic' }, { icon: Search, label: 'Keywords' }, { icon: BarChart3, label: 'Scor comparativ' }].map(item => (
                  <div key={item.label} className="text-center">
                    <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-1.5">
                      <item.icon className="h-4 w-4 text-indigo-500" />
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">{item.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}