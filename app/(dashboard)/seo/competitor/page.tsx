'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2, XCircle, CheckCircle, Globe, Search,
  BarChart3, AlertTriangle, ExternalLink, RefreshCw,
  ArrowUp, ArrowDown, Minus,
} from 'lucide-react'

type StoreAnalysis = {
  url: string; title: string; meta_description: string; h1: string
  headings: string[]; focus_keywords: string[]; content_length_estimate: number
  strengths: string[]; weaknesses: string[]; opportunities: string[]
}
type ComparisonResult = {
  my_store: StoreAnalysis; competitor: StoreAnalysis
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
type Saved = { url: string; label: string }

function hn(url: string) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

function scoreStore(s: StoreAnalysis) {
  let n = 0
  if (s.title) { const l = s.title.length; n += l >= 50 && l <= 70 ? 25 : l > 0 ? 12 : 0 }
  if (s.meta_description) { const l = s.meta_description.length; n += l >= 120 && l <= 155 ? 25 : l > 0 ? 12 : 0 }
  if (s.focus_keywords?.length) n += Math.min(s.focus_keywords.length * 5, 20)
  if (s.headings?.length) n += Math.min(s.headings.length * 3, 15)
  if (s.content_length_estimate > 300) n += 15
  return Math.min(n, 100)
}

function charStatus(len: number, min: number, max: number): { text: string; ok: boolean; warn: boolean } {
  if (!len) return { text: 'Necompletat', ok: false, warn: false }
  if (len >= min && len <= max) return { text: `${len} caractere - ideal`, ok: true, warn: false }
  if (len < min) return { text: `${len} caractere - sub ${min}`, ok: false, warn: true }
  return { text: `${len} caractere - peste ${max}`, ok: false, warn: true }
}

function ScoreCircle({ score, you }: { score: number; you: boolean }) {
  const r = 28, circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const isGood = score >= 70
  const isMid  = score >= 45 && score < 70
  const strokeColor = you
    ? (isGood ? '#111827' : isMid ? '#92400e' : '#991b1b')
    : (isGood ? '#6b7280' : isMid ? '#d97706' : '#ef4444')
  return (
    <div className="relative" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={strokeColor} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-bold text-gray-900">{score}</span>
      </div>
    </div>
  )
}

function MetricBar({ label, you, them }: { label: string; you: number; them: number }) {
  const max = Math.max(you, them, 1)
  const youWin = you > them
  const draw = you === them
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center py-3.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2 justify-end">
        <span className={`text-xs font-bold tabular-nums ${youWin || draw ? 'text-gray-900' : 'text-gray-300'}`}>{you}</span>
        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden flex justify-end">
          <motion.div
            className={`h-full rounded-full ${youWin || draw ? 'bg-gray-900' : 'bg-gray-200'}`}
            initial={{ width: 0 }}
            animate={{ width: `${(you / max) * 100}%` }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      </div>
      <div className="text-center w-24">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">{label}</p>
        <p className={`text-[9px] font-bold mt-1 ${youWin ? 'text-emerald-600' : draw ? 'text-gray-400' : 'text-red-500'}`}>
          {youWin ? 'Tu' : draw ? 'Egal' : 'Competitor'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${!youWin && !draw ? 'bg-red-400' : 'bg-gray-200'}`}
            initial={{ width: 0 }}
            animate={{ width: `${(them / max) * 100}%` }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: 0.06 }}
          />
        </div>
        <span className={`text-xs font-bold tabular-nums ${!youWin && !draw ? 'text-gray-900' : 'text-gray-300'}`}>{them}</span>
      </div>
    </div>
  )
}

function FieldRow({ label, mine, theirs, minLen, maxLen, winner }: {
  label: string; mine: string; theirs: string
  minLen?: number; maxLen?: number
  winner: 'tu' | 'competitor' | 'egal'
}) {
  const ms = minLen && maxLen ? charStatus(mine.length, minLen, maxLen) : null
  const ts = minLen && maxLen ? charStatus(theirs.length, minLen, maxLen) : null
  const sides = [
    { val: mine, status: ms, isWinner: winner === 'tu', tag: 'Tu', dot: 'bg-gray-900' },
    { val: theirs, status: ts, isWinner: winner === 'competitor', tag: 'Competitor', dot: 'bg-red-400' },
  ]
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.1em]">{label}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          winner === 'tu' ? 'text-emerald-700 bg-emerald-50' :
          winner === 'competitor' ? 'text-red-600 bg-red-50' :
          'text-gray-400 bg-gray-100'}`}>
          {winner === 'tu' ? 'Tu' : winner === 'competitor' ? 'Competitor' : 'Egal'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        {sides.map((side, i) => (
          <div key={i} className={`p-4 ${side.isWinner ? 'bg-emerald-50/20' : 'bg-white'}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className={`w-1.5 h-1.5 rounded-full ${side.dot}`} />
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.12em]">{side.tag}</span>
            </div>
            <p className={`text-sm leading-relaxed ${side.val ? 'text-gray-800' : 'text-gray-300 italic text-xs'}`}>
              {side.val || 'Necompletat'}
            </p>
            {side.status && side.val && (
              <p className={`text-[10px] mt-1.5 font-semibold ${
                side.status.ok ? 'text-emerald-600' : side.status.warn ? 'text-amber-600' : 'text-gray-400'}`}>
                {side.status.text}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CompetitorPage() {
  const [myUrl, setMyUrl] = useState('')
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Saved[]>([])

  useEffect(() => {
    fetch('/api/stores').then(r => r.json())
      .then(d => { if (d.store?.store_url) setMyUrl(d.store.store_url) })
      .catch(() => {})
    try { setSaved(JSON.parse(localStorage.getItem('seo_competitors') || '[]')) } catch {}
  }, [])

  function persist(url: string) {
    const entry = { url, label: hn(url) }
    const u = [entry, ...saved.filter(c => c.url !== url)].slice(0, 6)
    setSaved(u)
    try { localStorage.setItem('seo_competitors', JSON.stringify(u)) } catch {}
  }

  function removeSaved(url: string) {
    const u = saved.filter(c => c.url !== url)
    setSaved(u)
    try { localStorage.setItem('seo_competitors', JSON.stringify(u)) } catch {}
  }

  async function analyze() {
    if (!myUrl.trim() || !competitorUrl.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const [a, b] = await Promise.all([
        fetch('/api/seo/competitor', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitor_url: myUrl.trim(), product_id: null }),
        }),
        fetch('/api/seo/competitor', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitor_url: competitorUrl.trim(), product_id: null }),
        }),
      ])
      const ad = await a.json(); const bd = await b.json()
      if (!a.ok) { setError(ad.error || 'Nu pot accesa magazinul tau'); return }
      if (!b.ok) { setError(bd.error || 'Nu pot accesa magazinul competitorului'); return }

      const my: StoreAnalysis = { url: myUrl.trim(), ...ad.analysis }
      const them: StoreAnalysis = { url: competitorUrl.trim(), ...bd.analysis }
      const ms = scoreStore(my), ts = scoreStore(them)

      const titleOk = (s: StoreAnalysis) => s.title?.length >= 50 && s.title?.length <= 70
      const metaOk  = (s: StoreAnalysis) => s.meta_description?.length >= 120 && s.meta_description?.length <= 155
      const wt = (!my.title ? 'competitor' : !them.title ? 'tu' : titleOk(my) && !titleOk(them) ? 'tu' : !titleOk(my) && titleOk(them) ? 'competitor' : 'egal') as 'tu' | 'competitor' | 'egal'
      const wm = (!my.meta_description ? 'competitor' : !them.meta_description ? 'tu' : metaOk(my) && !metaOk(them) ? 'tu' : !metaOk(my) && metaOk(them) ? 'competitor' : 'egal') as 'tu' | 'competitor' | 'egal'
      const wk = ((my.focus_keywords?.length || 0) > (them.focus_keywords?.length || 0) ? 'tu' : (my.focus_keywords?.length || 0) < (them.focus_keywords?.length || 0) ? 'competitor' : 'egal') as 'tu' | 'competitor' | 'egal'

      setResult({
        my_store: my, competitor: them,
        verdict: {
          winner_title: wt, winner_meta: wm, winner_keywords: wk,
          overall_score_you: ms, overall_score_competitor: ts,
          summary: ms > ts
            ? `Scor SEO ${ms} vs ${ts}. Magazinul tau este mai bine optimizat.`
            : ms === ts
            ? `Scor egal ${ms}. Imbunatatiri la titlu sau meta pot face diferenta.`
            : `Scor SEO ${ms} vs ${ts}. Exista oportunitate clara de recuperare.`,
          top_actions: them.opportunities?.slice(0, 4) || my.weaknesses?.slice(0, 4) || [],
        },
      })
      persist(competitorUrl.trim())
    } catch (e: any) {
      setError('Eroare: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const r = result
  const youWin = r && r.verdict.overall_score_you > r.verdict.overall_score_competitor
  const draw   = r && r.verdict.overall_score_you === r.verdict.overall_score_competitor
  const diff   = r ? r.verdict.overall_score_you - r.verdict.overall_score_competitor : 0

  return (
    <div className="max-w-4xl space-y-5">
      <div className="pb-1">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Analiza Competitori</h1>
        <p className="text-sm text-gray-400 mt-1">Compara optimizarea SEO a magazinului tau cu orice competitor</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Magazinul tau', val: myUrl, set: setMyUrl, ph: 'https://magazinul-tau.ro' },
                { label: 'Competitor', val: competitorUrl, set: setCompetitorUrl, ph: 'https://competitor.ro' },
              ].map((f, i) => (
                <div key={i}>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.12em] mb-2">{f.label}</label>
                  <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 focus-within:border-gray-400 transition-colors">
                    <Globe className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                    <input value={f.val} onChange={e => f.set(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && analyze()}
                      placeholder={f.ph}
                      className="flex-1 text-sm text-gray-800 placeholder-gray-300 focus:outline-none bg-transparent min-w-0" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap pt-1">
              {saved.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.12em]">Salvati</span>
                  {saved.map((c, i) => (
                    <button key={i} onClick={() => setCompetitorUrl(c.url)}
                      className={`group flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                        competitorUrl === c.url
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                      {c.label}
                      <span onClick={e => { e.stopPropagation(); removeSaved(c.url) }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-current/40 hover:text-current text-sm leading-none">x</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 ml-auto">
                {error && <p className="text-xs text-red-500 flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 shrink-0" />{error}</p>}
                <button onClick={analyze} disabled={loading || !myUrl.trim() || !competitorUrl.trim()}
                  className="flex items-center gap-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {loading ? 'Analizez...' : 'Analizeaza'}
                </button>
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex gap-5 flex-wrap">
            {['Titlu & Meta Description', 'Keywords & Headings', 'Scor comparativ', 'Plan de actiune'].map(t => (
              <span key={t} className="text-[10px] text-gray-400 font-medium">{t}</span>
            ))}
            <span className="ml-auto text-[10px] font-semibold text-gray-400">3 credite / analiza</span>
          </div>
        </div>
      </motion.div>

      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <div className="w-8 h-8 border-2 border-gray-100 border-t-gray-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-gray-700">Se analizeaza ambele magazine</p>
          <p className="text-xs text-gray-400 mt-1">Extrag titlu, meta, keywords, headings</p>
        </div>
      )}

      {r && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-4">

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-center space-y-2">
                <ScoreCircle score={r.verdict.overall_score_you} you={true} />
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.12em]">Tu</p>
              </div>
              <div className="flex flex-col items-center gap-1 pb-6">
                {draw ? <Minus className="h-4 w-4 text-gray-300" /> : youWin ? <ArrowUp className="h-5 w-5 text-emerald-500" /> : <ArrowDown className="h-5 w-5 text-red-400" />}
                <span className={`text-xs font-bold tabular-nums ${youWin ? 'text-emerald-600' : draw ? 'text-gray-400' : 'text-red-500'}`}>
                  {draw ? '0' : diff > 0 ? `+${diff}` : String(diff)}
                </span>
              </div>
              <div className="text-center space-y-2">
                <ScoreCircle score={r.verdict.overall_score_competitor} you={false} />
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.12em]">Competitor</p>
              </div>
            </div>
            <div className="flex-1 min-w-0 sm:border-l sm:border-gray-100 sm:pl-6">
              <p className="text-base font-bold text-gray-900 mb-1.5 leading-snug">
                {youWin ? 'Magazinul tau este mai bine optimizat SEO' : draw ? 'Egalitate — detaliile fac diferenta' : 'Competitorul te depaseste la SEO'}
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">{r.verdict.summary}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Comparatie metrici</h2>
              <div className="flex items-center gap-4">
                {[{ dot: 'bg-gray-900', lbl: 'Tu' }, { dot: 'bg-red-400', lbl: 'Competitor' }].map(x => (
                  <span key={x.lbl} className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-[0.12em]">
                    <span className={`w-2 h-2 rounded-full ${x.dot}`} />{x.lbl}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-5 py-1">
              <MetricBar label="Titlu" you={r.my_store.title?.length || 0} them={r.competitor.title?.length || 0} />
              <MetricBar label="Meta" you={r.my_store.meta_description?.length || 0} them={r.competitor.meta_description?.length || 0} />
              <MetricBar label="Keywords" you={r.my_store.focus_keywords?.length || 0} them={r.competitor.focus_keywords?.length || 0} />
              <MetricBar label="Headings" you={r.my_store.headings?.length || 0} them={r.competitor.headings?.length || 0} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Comparatie campuri SEO</h2>
            </div>
            <div className="p-4 space-y-3">
              <FieldRow label="Titlu SEO" mine={r.my_store.title || ''} theirs={r.competitor.title || ''} minLen={50} maxLen={70} winner={r.verdict.winner_title} />
              <FieldRow label="Meta Description" mine={r.my_store.meta_description || ''} theirs={r.competitor.meta_description || ''} minLen={120} maxLen={155} winner={r.verdict.winner_meta} />
              {(r.my_store.h1 || r.competitor.h1) && (
                <FieldRow label="H1 principal" mine={r.my_store.h1 || ''} theirs={r.competitor.h1 || ''} winner="egal" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Keywords tale', kws: r.my_store.focus_keywords, bg: 'bg-gray-100', text: 'text-gray-700' },
              { label: 'Keywords competitor', kws: r.competitor.focus_keywords, bg: 'bg-red-50', text: 'text-red-700' },
            ].map(({ label, kws, bg, text }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-700">{label}</p>
                  <span className="text-[10px] font-semibold text-gray-400">{kws?.length || 0} detectate</span>
                </div>
                {kws?.length > 0
                  ? <div className="flex flex-wrap gap-1.5">{kws.map((kw, i) => <span key={i} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${bg} ${text}`}>{kw}</span>)}</div>
                  : <p className="text-xs text-gray-300">Niciun keyword detectat</p>}
              </div>
            ))}
          </div>

          {(r.my_store.strengths?.length > 0 || r.competitor.strengths?.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {r.my_store.strengths?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs font-bold text-gray-700 mb-3">Avantajele tale</p>
                  {r.my_store.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-gray-600 mb-2">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />{s}
                    </div>
                  ))}
                </div>
              )}
              {r.competitor.strengths?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs font-bold text-gray-700 mb-3">Avantajele competitorului</p>
                  {r.competitor.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-gray-600 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />{s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {r.verdict.top_actions?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-900">Plan de actiune</h2>
                <p className="text-xs text-gray-400 mt-0.5">Pasi concreti pentru a depasi competitorul</p>
              </div>
              <div className="p-4 space-y-2">
                {r.verdict.top_actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <span className="text-xs font-black text-gray-300 tabular-nums mt-0.5 shrink-0 w-5">0{i + 1}</span>
                    <p className="text-sm text-gray-700 leading-relaxed">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 flex-wrap pt-1 pb-2">
            {[r.my_store.url, r.competitor.url].map(u => (
              <a key={u} href={u} target="_blank" rel="noopener"
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
                <ExternalLink className="h-3 w-3" />{hn(u)}
              </a>
            ))}
            <button onClick={analyze} className="ml-auto inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />Reanalize aza
            </button>
          </div>
        </motion.div>
      )}

      {!r && !loading && !error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-5 w-5 text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-700 mb-1.5">Nicio analiza efectuata</p>
            <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
              Introdu URL-ul magazinului tau si al unui competitor pentru a vedea exact unde esti mai bun si ce trebuie imbunatatit.
            </p>
            <div className="grid grid-cols-3 gap-3 mt-8 max-w-xs mx-auto">
              {[{ icon: Search, label: 'Keywords' }, { icon: BarChart3, label: 'Scor SEO' }, { icon: CheckCircle, label: 'Plan actiune' }].map(x => (
                <div key={x.label} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <x.icon className="h-4 w-4 text-gray-300 mx-auto mb-1.5" />
                  <p className="text-[10px] font-semibold text-gray-400">{x.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}