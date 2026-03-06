'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2, XCircle, CheckCircle, Globe, Search, BarChart3,
  AlertTriangle, ExternalLink, RefreshCw, ArrowUp, ArrowDown,
  Minus, Bell, BellOff, Clock, TrendingUp, Hash, Zap, Shield,
  FileText, DollarSign, Link2, Sparkles, Copy, ChevronDown,
  ChevronRight, Eye, Plus, Trash2, ToggleLeft, ToggleRight,
  Monitor, Smartphone, CheckSquare, Square, Download, Send,
} from 'lucide-react'
import { normalizeUrl, hostnameOnly, calcCompetitorScore } from '@/lib/competitor/url-utils'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────
type StoreAnalysis = {
  url: string; title: string; meta_description: string; h1: string
  headings: string[]; focus_keywords: string[]; content_length_estimate: number
  strengths: string[]; weaknesses: string[]; opportunities: string[]
}
type ComparisonResult = {
  my_store: StoreAnalysis; competitor: StoreAnalysis
  verdict: {
    winner_title: Winner; winner_meta: Winner; winner_keywords: Winner
    overall_score_you: number; overall_score_competitor: number
    summary: string; top_actions: string[]
  }
}
type Winner = 'tu' | 'competitor' | 'egal'
type Monitor = {
  id: string; competitor_url: string; competitor_label: string
  is_active: boolean; last_checked_at: string | null
  check_frequency_hours: number; latest_score: number | null
  last_snapshot_at: string | null
}
type Alert = {
  id: string; alert_type: string; field_changed: string
  old_value: string; new_value: string; is_read: boolean
  created_at: string; competitor_monitors: { competitor_url: string; competitor_label: string }
}
type Snapshot = { id: string; seo_score: number; captured_at: string; title?: string }
type KeywordGap = {
  gap_keywords: string[]; my_advantages: string[]; common_keywords: string[]
  opportunities: string[]; analysis_summary: string; top_priority: string
}
type TechData = {
  my_store: { url: string; pagespeed: { mobile: any; desktop: any }; technical: any }
  competitor: { url: string; pagespeed: { mobile: any; desktop: any }; technical: any }
}
type PricingData = {
  my_usps: string[]; competitor_usps: string[]; missing_usps: string[]
  my_ctas: string[]; competitor_ctas: string[]; cta_recommendations: string[]
  price_positioning: string; price_insight: string
  my_detected_prices: number[]; their_detected_prices: number[]
  pricing_recommendations: string[]
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function hn(url: string) { try { return new URL(url).hostname.replace('www.','') } catch { return url } }

function charStatus(len: number, min: number, max: number) {
  if (!len) return { text:'Necompletat', cls:'text-gray-300' }
  if (len >= min && len <= max) return { text:`${len} car. — ideal`, cls:'text-emerald-600' }
  if (len < min) return { text:`${len} car. — sub ${min}`, cls:'text-amber-600' }
  return { text:`${len} car. — peste ${max}`, cls:'text-red-500' }
}

function alertLabel(type: string): { text: string; color: string } {
  const map: Record<string,{text:string;color:string}> = {
    title_changed: { text:'Titlu schimbat', color:'text-blue-600' },
    meta_changed: { text:'Meta schimbat', color:'text-indigo-600' },
    keywords_changed: { text:'Keywords schimbate', color:'text-purple-600' },
    score_drop: { text:'Scor scazut', color:'text-red-500' },
    score_rise: { text:'Scor crescut', color:'text-emerald-600' },
  }
  return map[type] || { text: type, color: 'text-gray-500' }
}

// ─── Shared Components ────────────────────────────────────────────────────────
function ScoreCircle({ score, you, size=72 }: { score:number; you:boolean; size?:number }) {
  const r=size/2-6, circ=2*Math.PI*r
  const isGood=score>=70, isMid=score>=45&&score<70
  const stroke = you
    ? (isGood?'#111827':isMid?'#b45309':'#b91c1c')
    : (isGood?'#6b7280':isMid?'#d97706':'#ef4444')
  return (
    <div className="relative" style={{width:size,height:size}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth="5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={stroke} strokeWidth="5"
          strokeLinecap="round" strokeDasharray={`${(score/100)*circ} ${circ}`}
          style={{transition:'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)'}}/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold text-gray-900" style={{fontSize:size>60?16:12}}>{score}</span>
      </div>
    </div>
  )
}

function MetricBar({ label, you, them }: { label:string; you:number; them:number }) {
  const max=Math.max(you,them,1), youWin=you>them, draw=you===them
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center py-3.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2 justify-end">
        <span className={`text-xs font-bold tabular-nums ${youWin||draw?'text-gray-900':'text-gray-300'}`}>{you}</span>
        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden flex justify-end">
          <motion.div className={`h-full rounded-full ${youWin||draw?'bg-gray-900':'bg-gray-200'}`}
            initial={{width:0}} animate={{width:`${(you/max)*100}%`}} transition={{duration:0.7,ease:[0.4,0,0.2,1]}}/>
        </div>
      </div>
      <div className="text-center w-20">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className={`text-[9px] font-bold mt-0.5 ${youWin?'text-emerald-600':draw?'text-gray-400':'text-red-500'}`}>
          {youWin?'Tu':draw?'Egal':'Competitor'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div className={`h-full rounded-full ${!youWin&&!draw?'bg-red-400':'bg-gray-200'}`}
            initial={{width:0}} animate={{width:`${(them/max)*100}%`}} transition={{duration:0.7,ease:[0.4,0,0.2,1],delay:0.06}}/>
        </div>
        <span className={`text-xs font-bold tabular-nums ${!youWin&&!draw?'text-gray-900':'text-gray-300'}`}>{them}</span>
      </div>
    </div>
  )
}

function FieldRow({ label, mine, theirs, minLen, maxLen, winner, onSteal }: {
  label:string; mine:string; theirs:string; minLen?:number; maxLen?:number
  winner:Winner; onSteal?:(field:string,val:string)=>void
}) {
  const ms = minLen&&maxLen ? charStatus(mine.length,minLen,maxLen) : null
  const ts = minLen&&maxLen ? charStatus(theirs.length,minLen,maxLen) : null
  const fieldKey = label.includes('Titlu')?'title':label.includes('Meta')?'meta_description':'focus_keyword'
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.1em]">{label}</span>
        <div className="flex items-center gap-2">
          {onSteal && theirs && winner==='competitor' && (
            <button onClick={()=>onSteal(fieldKey,theirs)}
              className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors">
              <Sparkles className="h-2.5 w-2.5"/>Steal this
            </button>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
            ${winner==='tu'?'text-emerald-700 bg-emerald-50':winner==='competitor'?'text-red-600 bg-red-50':'text-gray-400 bg-gray-100'}`}>
            {winner==='tu'?'Tu':winner==='competitor'?'Competitor':'Egal'}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        {[
          {val:mine,status:ms,isWinner:winner==='tu',tag:'Tu',dot:'bg-gray-900'},
          {val:theirs,status:ts,isWinner:winner==='competitor',tag:'Competitor',dot:'bg-red-400'},
        ].map((side,i)=>(
          <div key={i} className={`p-4 ${side.isWinner?'bg-emerald-50/20':''}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className={`w-1.5 h-1.5 rounded-full ${side.dot}`}/>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.12em]">{side.tag}</span>
            </div>
            <p className={`text-sm leading-relaxed ${side.val?'text-gray-800':'text-gray-300 italic text-xs'}`}>{side.val||'Necompletat'}</p>
            {side.status&&side.val&&<p className={`text-[10px] mt-1.5 font-semibold ${side.status.cls}`}>{side.status.text}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

// Steal This Modal
function StealModal({ open, field, myCurrent, competitorValue, competitorUrl, productId, onClose, onApplied }:{
  open:boolean; field:string; myCurrent:string; competitorValue:string; competitorUrl:string
  productId:string|null; onClose:()=>void; onApplied:(val:string)=>void
}) {
  const [loading,setLoading]=useState(false)
  const [result,setResult]=useState<{improved_value:string;explanation:string;char_count:number}|null>(null)
  const [applying,setApplying]=useState(false)
  const [applied,setApplied]=useState(false)

  useEffect(()=>{ if(open&&!result) generate() },[open])

  async function generate() {
    setLoading(true); setResult(null)
    const res = await fetch('/api/competitor/steal',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({product_id:productId,field,my_current:myCurrent,competitor_value:competitorValue,competitor_url:competitorUrl,apply:false})
    })
    const data = await res.json()
    if(res.ok) setResult(data)
    setLoading(false)
  }

  async function apply() {
    if(!result) return
    if(productId) {
      setApplying(true)
      await fetch('/api/competitor/steal',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({product_id:productId,field,my_current:myCurrent,competitor_value:competitorValue,competitor_url:competitorUrl,apply:true})
      })
      setApplying(false)
    }
    setApplied(true)
    onApplied(result.improved_value)
    setTimeout(onClose, 1000)
  }

  if(!open) return null
  const fieldLabels: Record<string,string> = {title:'Titlu SEO',meta_description:'Meta Description',focus_keyword:'Focus Keyword'}

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500"/>Steal This — {fieldLabels[field]||field}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">AI genereaza o varianta superioara ambelor</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">x</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[{label:'Varianta ta',val:myCurrent,dot:'bg-gray-900'},{label:'Competitor',val:competitorValue,dot:'bg-red-400'}].map((s,i)=>(
              <div key={i} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{s.label}</span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">{s.val||'—'}</p>
              </div>
            ))}
          </div>
          <div className="border-2 border-blue-100 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="h-3 w-3"/>Varianta AI generata
              </span>
            </div>
            <div className="p-4 min-h-[60px] flex items-center">
              {loading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin"/>Se genereaza...
                </div>
              ) : result ? (
                <div className="space-y-2 w-full">
                  <p className="text-sm text-gray-900 font-medium leading-relaxed">{result.improved_value}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-blue-600 italic">{result.explanation}</p>
                    <span className="text-[10px] font-bold text-gray-400">{result.char_count} car.</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={generate} disabled={loading} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5"/>Regenereaza
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs text-gray-500 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50">Anuleaza</button>
            {result && !applied && (
              <button onClick={apply} disabled={applying}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-700 px-4 py-2 rounded-xl">
                {applying?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<CheckCircle className="h-3.5 w-3.5"/>}
                {productId?'Aplica in produs':'Copiaza'}
              </button>
            )}
            {applied && <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5"/>Aplicat!</span>}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── TAB: OVERVIEW ────────────────────────────────────────────────────────────
function TabOverview({ result, myUrl, competitorUrl, onSteal }: {
  result: ComparisonResult | null; myUrl: string; competitorUrl: string
  onSteal: (field:string, val:string, current:string) => void
}) {
  if (!result) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
      <BarChart3 className="h-10 w-10 text-gray-200 mx-auto mb-4"/>
      <p className="text-sm font-bold text-gray-700 mb-1">Nicio analiza efectuata</p>
      <p className="text-xs text-gray-400 max-w-xs mx-auto">Introdu URL-ul competitorului si apasa Analizeaza pentru a vedea comparatia completa.</p>
    </div>
  )
  const r = result
  const youWin = r.verdict.overall_score_you > r.verdict.overall_score_competitor
  const draw   = r.verdict.overall_score_you === r.verdict.overall_score_competitor
  const diff   = r.verdict.overall_score_you - r.verdict.overall_score_competitor

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center space-y-2">
            <ScoreCircle score={r.verdict.overall_score_you} you={true}/>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.12em]">Tu</p>
          </div>
          <div className="flex flex-col items-center gap-1 pb-6">
            {draw?<Minus className="h-4 w-4 text-gray-300"/>:youWin?<ArrowUp className="h-5 w-5 text-emerald-500"/>:<ArrowDown className="h-5 w-5 text-red-400"/>}
            <span className={`text-xs font-bold tabular-nums ${youWin?'text-emerald-600':draw?'text-gray-400':'text-red-500'}`}>
              {draw?'0':diff>0?`+${diff}`:String(diff)}
            </span>
          </div>
          <div className="text-center space-y-2">
            <ScoreCircle score={r.verdict.overall_score_competitor} you={false}/>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.12em]">Competitor</p>
          </div>
        </div>
        <div className="flex-1 min-w-0 sm:border-l sm:border-gray-100 sm:pl-6">
          <p className="text-base font-bold text-gray-900 mb-1.5 leading-snug">
            {youWin?'Magazinul tau este mai bine optimizat SEO':draw?'Egalitate — detaliile fac diferenta':'Competitorul te depaseste la SEO'}
          </p>
          <p className="text-sm text-gray-500 leading-relaxed">{r.verdict.summary}</p>
        </div>
      </div>

      {/* Metric bars */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Comparatie metrici</h2>
          <div className="flex items-center gap-3">
            {[{dot:'bg-gray-900',lbl:'Tu'},{dot:'bg-red-400',lbl:'Competitor'}].map(x=>(
              <span key={x.lbl} className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-[0.12em]">
                <span className={`w-2 h-2 rounded-full ${x.dot}`}/>{x.lbl}
              </span>
            ))}
          </div>
        </div>
        <div className="px-5 py-1">
          <MetricBar label="Titlu" you={r.my_store.title?.length||0} them={r.competitor.title?.length||0}/>
          <MetricBar label="Meta" you={r.my_store.meta_description?.length||0} them={r.competitor.meta_description?.length||0}/>
          <MetricBar label="Keywords" you={r.my_store.focus_keywords?.length||0} them={r.competitor.focus_keywords?.length||0}/>
          <MetricBar label="Headings" you={r.my_store.headings?.length||0} them={r.competitor.headings?.length||0}/>
        </div>
      </div>

      {/* Field compare with steal */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Comparatie campuri SEO</h2>
          <p className="text-xs text-gray-400 mt-0.5">Apasa "Steal this" pentru a genera o varianta imbunatatita cu AI</p>
        </div>
        <div className="p-4 space-y-3">
          <FieldRow label="Titlu SEO" mine={r.my_store.title||''} theirs={r.competitor.title||''} minLen={50} maxLen={70} winner={r.verdict.winner_title}
            onSteal={(f,v)=>onSteal(f,v,r.my_store.title||'')}/>
          <FieldRow label="Meta Description" mine={r.my_store.meta_description||''} theirs={r.competitor.meta_description||''} minLen={120} maxLen={155} winner={r.verdict.winner_meta}
            onSteal={(f,v)=>onSteal(f,v,r.my_store.meta_description||'')}/>
          {(r.my_store.h1||r.competitor.h1)&&<FieldRow label="H1 principal" mine={r.my_store.h1||''} theirs={r.competitor.h1||''} winner="egal"/>}
        </div>
      </div>

      {/* Keywords */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {label:'Keywords tale',kws:r.my_store.focus_keywords,bg:'bg-gray-100',text:'text-gray-700'},
          {label:'Keywords competitor',kws:r.competitor.focus_keywords,bg:'bg-red-50',text:'text-red-700'},
        ].map(({label,kws,bg,text})=>(
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-700">{label}</p>
              <span className="text-[10px] font-semibold text-gray-400">{kws?.length||0} detectate</span>
            </div>
            {kws?.length>0
              ?<div className="flex flex-wrap gap-1.5">{kws.map((kw,i)=><span key={i} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${bg} ${text}`}>{kw}</span>)}</div>
              :<p className="text-xs text-gray-300">Niciun keyword detectat</p>}
          </div>
        ))}
      </div>

      {/* Actions */}
      {r.verdict.top_actions?.length>0&&(
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Plan de actiune</h2>
          </div>
          <div className="p-4 space-y-2">
            {r.verdict.top_actions.map((action,i)=>(
              <div key={i} className="flex items-start gap-4 p-3.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <span className="text-xs font-black text-gray-300 tabular-nums mt-0.5 shrink-0">0{i+1}</span>
                <p className="text-sm text-gray-700 leading-relaxed">{action}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB: MONITOR ─────────────────────────────────────────────────────────────
function TabMonitor({ competitorUrl }: { competitorUrl: string }) {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot[]>>({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [mRes, aRes] = await Promise.all([
      fetch('/api/competitor/monitors'),
      fetch('/api/competitor/alerts?unread=false'),
    ])
    const [mData, aData] = await Promise.all([mRes.json(), aRes.json()])
    setMonitors(mData.monitors || [])
    setAlerts(aData.alerts || [])
    setLoading(false)
  }

  async function addMonitor() {
    if (!competitorUrl) return
    setAdding(true)
    const res = await fetch('/api/competitor/monitors', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ competitor_url: competitorUrl, competitor_label: newLabel || hn(competitorUrl) }),
    })
    if (res.ok) { await loadAll(); setNewLabel('') }
    setAdding(false)
  }

  async function removeMonitor(id: string) {
    await fetch('/api/competitor/monitors', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    setMonitors(prev => prev.filter(m => m.id !== id))
  }

  async function toggleMonitor(id: string, is_active: boolean) {
    const res = await fetch('/api/competitor/monitors', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, is_active }) })
    if (res.ok) setMonitors(prev => prev.map(m => m.id===id ? {...m,is_active} : m))
  }

  async function markAllRead() {
    await fetch('/api/competitor/alerts', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ all: true }) })
    setAlerts(prev => prev.map(a => ({...a, is_read: true})))
  }

  async function markOneRead(id: string) {
    await fetch('/api/competitor/alerts', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ids: [id] }) })
    setAlerts(prev => prev.map(a => a.id===id ? {...a, is_read: true} : a))
  }

  async function loadSnapshots(monitorId: string) {
    if (snapshots[monitorId]) return
    const res = await fetch(`/api/competitor/snapshots?monitor_id=${monitorId}&limit=30`)
    const data = await res.json()
    setSnapshots(prev => ({...prev, [monitorId]: data.snapshots||[]}))
  }

  const unread = alerts.filter(a => !a.is_read).length

  if (loading) return <div className="bg-white rounded-2xl border border-gray-100 p-8 flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-gray-400"/><span className="text-sm text-gray-500">Se incarca...</span></div>

  return (
    <div className="space-y-4">
      {/* Add monitor */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Adauga competitor la monitorizare</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-gray-200 rounded-xl px-3.5 py-2.5">
            <Globe className="h-3.5 w-3.5 text-gray-300 shrink-0"/>
            <span className="text-sm text-gray-600 truncate">{competitorUrl || 'Introdu URL competitor in partea de sus'}</span>
          </div>
          <input value={newLabel} onChange={e=>setNewLabel(e.target.value)}
            placeholder="Eticheta (ex: Principalul competitor)"
            className="flex-1 min-w-[180px] border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-gray-400"/>
          <button onClick={addMonitor} disabled={adding||!competitorUrl}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
            {adding?<Loader2 className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>}
            Adauga
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Verificam automat in fiecare zi la 06:00. Primesti alerta cand detectam schimbari.</p>
      </div>

      {/* Monitors list */}
      {monitors.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Competitori monitorizati ({monitors.length}/10)</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {monitors.map(m => (
              <div key={m.id}>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-800">{m.competitor_label}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.is_active?'bg-emerald-50 text-emerald-600':'bg-gray-100 text-gray-400'}`}>
                        {m.is_active?'Activ':'Oprit'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1"><Globe className="h-3 w-3"/>{hn(m.competitor_url)}</span>
                      {m.last_checked_at&&<span className="flex items-center gap-1"><Clock className="h-3 w-3"/>Ultima verificare: {new Date(m.last_checked_at).toLocaleDateString('ro-RO')}</span>}
                      {m.latest_score!==null&&<span className="font-semibold text-gray-600">SEO Score: {m.latest_score}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={()=>loadSnapshots(m.id)} className="text-[10px] text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50">
                      Istoric
                    </button>
                    <button onClick={()=>toggleMonitor(m.id,!m.is_active)} className="text-gray-400 hover:text-gray-600 transition-colors">
                      {m.is_active?<ToggleRight className="h-5 w-5 text-emerald-500"/>:<ToggleLeft className="h-5 w-5"/>}
                    </button>
                    <button onClick={()=>removeMonitor(m.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4"/>
                    </button>
                  </div>
                </div>
                {/* Snapshot timeline */}
                {snapshots[m.id] && (
                  <div className="px-5 pb-4">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Evolutie scor SEO</p>
                      {snapshots[m.id].length === 0
                        ? <p className="text-xs text-gray-400">Niciun snapshot inca. Prima verificare va fi maine la 06:00.</p>
                        : (
                          <div className="flex items-end gap-1 h-16">
                            {snapshots[m.id].map((s,i)=>{
                              const pct = (s.seo_score/100)*100
                              const color = s.seo_score>=70?'bg-emerald-400':s.seo_score>=45?'bg-amber-400':'bg-red-400'
                              return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                                  <div className="w-full rounded-sm transition-all" style={{height:`${pct}%`,minHeight:4}} title={`${s.seo_score} — ${new Date(s.captured_at).toLocaleDateString('ro-RO')}`}>
                                    <div className={`w-full h-full rounded-sm ${color}`}/>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      }
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-900">Alerte schimbari</h2>
            {unread>0&&<span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">{unread}</span>}
          </div>
          {unread>0&&(
            <button onClick={markAllRead} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <CheckSquare className="h-3.5 w-3.5"/>Marcheaza toate citite
            </button>
          )}
        </div>
        {alerts.length===0
          ?<div className="p-8 text-center"><Bell className="h-8 w-8 text-gray-200 mx-auto mb-2"/><p className="text-sm text-gray-400">Nicio alerta inca. Monitorizarile active vor trimite alerte cand detecteaza schimbari.</p></div>
          :(
            <div className="divide-y divide-gray-50">
              {alerts.slice(0,20).map(a=>{
                const lbl = alertLabel(a.alert_type)
                return (
                  <div key={a.id} className={`flex items-start gap-4 px-5 py-3.5 ${!a.is_read?'bg-blue-50/30':''}`}>
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${!a.is_read?'bg-blue-500':'bg-gray-200'}`}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold ${lbl.color}`}>{lbl.text}</span>
                        <span className="text-[10px] text-gray-400">{a.competitor_monitors?.competitor_label||hn(a.competitor_monitors?.competitor_url||'')}</span>
                      </div>
                      {a.old_value&&a.new_value&&(
                        <div className="text-xs text-gray-600">
                          <span className="text-red-400 line-through">{a.old_value.substring(0,60)}</span>
                          {' → '}
                          <span className="text-emerald-600">{a.new_value.substring(0,60)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-gray-400">{new Date(a.created_at).toLocaleDateString('ro-RO')}</span>
                    {!a.is_read && (
                      <button onClick={()=>markOneRead(a.id)}
                        className="text-[9px] font-semibold text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-colors whitespace-nowrap">
                        Citit
                      </button>
                    )}
                  </div>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>
    </div>
  )
}

// ─── TAB: KEYWORDS ────────────────────────────────────────────────────────────
function TabKeywords({ myUrl, competitorUrl }: { myUrl:string; competitorUrl:string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<KeywordGap|null>(null)
  const [error, setError] = useState('')

  async function analyze() {
    if(!myUrl||!competitorUrl){setError('URL-urile lipsesc');return}
    setLoading(true);setError('');setResult(null)
    const res = await fetch('/api/competitor/keywords',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({my_url:myUrl,competitor_url:competitorUrl})})
    const data = await res.json()
    if(!res.ok){setError(data.error||'Eroare');setLoading(false);return}
    setResult(data.result)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Keyword Gap Analysis</h2>
            <p className="text-xs text-gray-400 mt-0.5">Keywords pe care le are competitorul si tu nu. Direct actionabile.</p>
          </div>
          <button onClick={analyze} disabled={loading||!myUrl||!competitorUrl}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 px-4 py-2.5 rounded-xl transition-colors shrink-0 whitespace-nowrap">
            {loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Hash className="h-4 w-4"/>}
            {loading?'Analizez...':'Analizeaza keywords'}
          </button>
        </div>
        {error&&<p className="text-xs text-red-500 flex items-center gap-1.5 mt-3"><XCircle className="h-3.5 w-3.5"/>{error}</p>}
        <p className="text-[10px] text-gray-400 mt-2">2 credite</p>
      </div>

      {loading&&<div className="bg-white rounded-2xl border border-gray-100 p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2"/><p className="text-sm text-gray-500">Analizez ambele pagini si catalogul tau...</p></div>}

      {result&&(
        <div className="space-y-4">
          {result.top_priority&&(
            <div className="bg-white rounded-2xl border-2 border-gray-900 shadow-sm p-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Prioritate maxima</p>
              <p className="text-lg font-bold text-gray-900">{result.top_priority}</p>
              <p className="text-xs text-gray-500 mt-1">Adauga acest keyword in titlul si meta description-ul celor mai importante produse.</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {title:'Keywords lipsa (gap)', items:result.gap_keywords, bg:'bg-red-50', text:'text-red-700', desc:'Le are competitorul, tu nu'},
              {title:'Avantajele tale', items:result.my_advantages, bg:'bg-emerald-50', text:'text-emerald-700', desc:'Le ai tu, competitorul nu'},
              {title:'Oportunitate noua', items:result.opportunities, bg:'bg-blue-50', text:'text-blue-700', desc:'Nici tu, nici competitorul'},
              {title:'Keywords comune', items:result.common_keywords, bg:'bg-gray-100', text:'text-gray-600', desc:'Amandoi le folositi'},
            ].map(({title,items,bg,text,desc})=>(
              <div key={title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-bold text-gray-700 mb-0.5">{title}</p>
                <p className="text-[10px] text-gray-400 mb-3">{desc}</p>
                {items?.length>0
                  ?<div className="flex flex-wrap gap-1.5">{items.map((kw,i)=><span key={i} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${bg} ${text}`}>{kw}</span>)}</div>
                  :<p className="text-xs text-gray-300">—</p>}
              </div>
            ))}
          </div>
          {result.analysis_summary&&(
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-600 leading-relaxed">{result.analysis_summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TAB: TECHNICAL ──────────────────────────────────────────────────────────
function TabTechnical({ myUrl, competitorUrl }: { myUrl:string; competitorUrl:string }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TechData|null>(null)
  const [error, setError] = useState('')
  const [device, setDevice] = useState<'mobile'|'desktop'>('mobile')

  async function analyze() {
    if(!myUrl||!competitorUrl){setError('URL-urile lipsesc');return}
    setLoading(true);setError('');setData(null)
    const res = await fetch('/api/competitor/technical',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({my_url:myUrl,competitor_url:competitorUrl})})
    const d = await res.json()
    if(!res.ok){setError(d.error||'Eroare');setLoading(false);return}
    setData(d);setLoading(false)
  }

  function TechCheck({label,mine,theirs,good,invert=false}:{label:string;mine:any;theirs:any;good?:boolean;invert?:boolean}) {
    const mineOk = good !== undefined ? (invert ? !mine : !!mine) : mine
    const theirsOk = good !== undefined ? (invert ? !theirs : !!theirs) : theirs
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
        <div className="flex items-center justify-end gap-2">
          {mineOk
            ?<CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0"/>
            :<XCircle className="h-3.5 w-3.5 text-red-400 shrink-0"/>}
          <span className={`text-xs ${mineOk?'text-gray-700':'text-gray-400'} text-right`}>{String(mine||'—').substring(0,40)}</span>
        </div>
        <span className="text-[10px] font-bold text-gray-400 text-center uppercase tracking-wider w-24">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${theirsOk?'text-gray-700':'text-gray-400'}`}>{String(theirs||'—').substring(0,40)}</span>
          {theirsOk
            ?<CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0"/>
            :<XCircle className="h-3.5 w-3.5 text-red-400 shrink-0"/>}
        </div>
      </div>
    )
  }

  function PSScore({score}:{score:number|null}) {
    if(score===null) return <span className="text-sm text-gray-300">—</span>
    const c=score>=90?'text-emerald-600':score>=50?'text-amber-600':'text-red-500'
    return <span className={`text-2xl font-bold ${c}`}>{score}</span>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Analiza tehnica SEO</h2>
            <p className="text-xs text-gray-400 mt-0.5">PageSpeed, Core Web Vitals, Schema markup, Open Graph</p>
          </div>
          <button onClick={analyze} disabled={loading||!myUrl||!competitorUrl}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 px-4 py-2.5 rounded-xl transition-colors shrink-0">
            {loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Shield className="h-4 w-4"/>}
            {loading?'Analizez...':'Analizeaza tehnic'}
          </button>
        </div>
        {error&&<p className="text-xs text-red-500 flex items-center gap-1.5 mt-3"><XCircle className="h-3.5 w-3.5"/>{error}</p>}
        <p className="text-[10px] text-gray-400 mt-2">Gratuit — foloseste Google PageSpeed API</p>
      </div>

      {loading&&<div className="bg-white rounded-2xl border border-gray-100 p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2"/><p className="text-sm text-gray-500">Se ruleaza PageSpeed + analiza tehnica...</p><p className="text-xs text-gray-400 mt-1">Poate dura 15-20 secunde</p></div>}

      {data&&(
        <div className="space-y-4">
          {/* PageSpeed */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">PageSpeed Performance</h3>
              <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
                {(['mobile','desktop'] as const).map(d=>(
                  <button key={d} onClick={()=>setDevice(d)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${device===d?'bg-white shadow-sm text-gray-800':'text-gray-400 hover:text-gray-600'}`}>
                    {d==='mobile'?<Smartphone className="h-3 w-3"/>:<Monitor className="h-3 w-3"/>}
                    {d==='mobile'?'Mobil':'Desktop'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              {[{label:'Tu',ps:data.my_store.pagespeed[device],you:true},{label:'Competitor',ps:data.competitor.pagespeed[device],you:false}].map(({label,ps,you})=>(
                <div key={label} className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-1.5 h-1.5 rounded-full ${you?'bg-gray-900':'bg-red-400'}`}/>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
                  </div>
                  {ps ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 mb-3">
                        <PSScore score={ps.performance_score}/>
                        <span className="text-xs text-gray-400">/ 100</span>
                      </div>
                      {[['FCP',ps.fcp],['LCP',ps.lcp],['CLS',ps.cls],['TBT',ps.tbt]].map(([k,v])=>(
                        <div key={k} className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 font-mono">{k}</span>
                          <span className="font-medium text-gray-700">{v||'—'}</span>
                        </div>
                      ))}
                    </div>
                  ):<p className="text-xs text-gray-400">Date indisponibile</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Technical checks */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Verificari SEO tehnic</h3>
              <div className="flex items-center gap-3">
                {[{dot:'bg-gray-900',lbl:'Tu'},{dot:'bg-red-400',lbl:'Competitor'}].map(x=>(
                  <span key={x.lbl} className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-[0.12em]">
                    <span className={`w-2 h-2 rounded-full ${x.dot}`}/>{x.lbl}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-5 py-1">
              <TechCheck label="Canonical" mine={data.my_store.technical.has_canonical} theirs={data.competitor.technical.has_canonical} good/>
              <TechCheck label="Viewport" mine={data.my_store.technical.has_viewport} theirs={data.competitor.technical.has_viewport} good/>
              <TechCheck label="OG Tags" mine={data.my_store.technical.has_og_tags} theirs={data.competitor.technical.has_og_tags} good/>
              <TechCheck label="OG Image" mine={data.my_store.technical.has_og_image} theirs={data.competitor.technical.has_og_image} good/>
              <TechCheck label="Hreflang" mine={data.my_store.technical.has_hreflang} theirs={data.competitor.technical.has_hreflang} good/>
              <TechCheck label="Img fara ALT" mine={data.my_store.technical.images_without_alt} theirs={data.competitor.technical.images_without_alt} invert good/>
              <TechCheck label="Limba" mine={data.my_store.technical.lang||'—'} theirs={data.competitor.technical.lang||'—'}/>
            </div>
          </div>

          {/* Schema types */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[{label:'Schema.org — Tu',types:data.my_store.technical.schema_types,dot:'bg-gray-900'},{label:'Schema.org — Competitor',types:data.competitor.technical.schema_types,dot:'bg-red-400'}].map(({label,types,dot})=>(
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${dot}`}/>
                  <p className="text-xs font-bold text-gray-700">{label}</p>
                </div>
                {types?.length>0
                  ?<div className="flex flex-wrap gap-1.5">{types.map((t:string,i:number)=><span key={i} className="text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg font-medium">{t}</span>)}</div>
                  :<p className="text-xs text-gray-300">Niciun Schema.org detectat</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB: PRICING ────────────────────────────────────────────────────────────
function TabPricing({ myUrl, competitorUrl }: { myUrl:string; competitorUrl:string }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PricingData|null>(null)
  const [error, setError] = useState('')

  async function analyze() {
    if(!myUrl||!competitorUrl){setError('URL-urile lipsesc');return}
    setLoading(true);setError('');setData(null)
    const res = await fetch('/api/competitor/pricing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({my_url:myUrl,competitor_url:competitorUrl})})
    const d = await res.json()
    if(!res.ok){setError(d.error||'Eroare');setLoading(false);return}
    setData(d.result);setLoading(false)
  }

  const positionColors: Record<string,string> = {
    mai_ieftin:'text-emerald-600 bg-emerald-50',
    similar:'text-blue-600 bg-blue-50',
    mai_scump:'text-amber-600 bg-amber-50',
    necunoscut:'text-gray-500 bg-gray-100',
  }
  const positionLabels: Record<string,string> = {
    mai_ieftin:'Mai ieftin decat competitorul',
    similar:'Preturi similare',
    mai_scump:'Mai scump decat competitorul',
    necunoscut:'Pozitionare necunoscuta',
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Pricing, USP & CTA Benchmark</h2>
            <p className="text-xs text-gray-400 mt-0.5">Comparatie preturi, promisiuni unice, call-to-action-uri</p>
          </div>
          <button onClick={analyze} disabled={loading||!myUrl||!competitorUrl}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 px-4 py-2.5 rounded-xl transition-colors shrink-0">
            {loading?<Loader2 className="h-4 w-4 animate-spin"/>:<DollarSign className="h-4 w-4"/>}
            {loading?'Analizez...':'Analizeaza pricing'}
          </button>
        </div>
        {error&&<p className="text-xs text-red-500 flex items-center gap-1.5 mt-3"><XCircle className="h-3.5 w-3.5"/>{error}</p>}
        <p className="text-[10px] text-gray-400 mt-2">2 credite</p>
      </div>

      {loading&&<div className="bg-white rounded-2xl border border-gray-100 p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2"/><p className="text-sm text-gray-500">Extrag preturi, USP-uri si CTA-uri...</p></div>}

      {data&&(
        <div className="space-y-4">
          {/* Price positioning */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Pozitionare pret</p>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${positionColors[data.price_positioning]||positionColors.necunoscut}`}>
                {positionLabels[data.price_positioning]||data.price_positioning}
              </span>
            </div>
            {data.price_insight&&<p className="text-sm text-gray-600 mt-3 leading-relaxed">{data.price_insight}</p>}
          </div>

          {/* Prices detected */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {label:'Preturi detectate — Tu',prices:data.my_detected_prices,dot:'bg-gray-900'},
              {label:'Preturi detectate — Competitor',prices:data.their_detected_prices,dot:'bg-red-400'},
            ].map(({label,prices,dot})=>(
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3"><div className={`w-1.5 h-1.5 rounded-full ${dot}`}/><p className="text-xs font-bold text-gray-700">{label}</p></div>
                {prices?.length>0
                  ?<div className="flex flex-wrap gap-1.5">{prices.map((p,i)=><span key={i} className="text-sm font-bold text-gray-800 bg-gray-50 border border-gray-100 px-3 py-1 rounded-xl">{p.toFixed(2)} RON</span>)}</div>
                  :<p className="text-xs text-gray-300">Niciun pret detectat</p>}
              </div>
            ))}
          </div>

          {/* USP compare */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {label:'USP-urile tale',items:data.my_usps,dot:'bg-gray-900',icon:<CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5"/>},
              {label:'USP-urile competitorului',items:data.competitor_usps,dot:'bg-red-400',icon:<AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5"/>},
            ].map(({label,items,dot,icon})=>(
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3"><div className={`w-1.5 h-1.5 rounded-full ${dot}`}/><p className="text-xs font-bold text-gray-700">{label}</p></div>
                {items?.length>0
                  ?<div className="space-y-2">{items.map((s,i)=><div key={i} className="flex items-start gap-2 text-xs text-gray-600">{icon}{s}</div>)}</div>
                  :<p className="text-xs text-gray-300">Niciun USP detectat</p>}
              </div>
            ))}
          </div>

          {/* Missing USPs */}
          {data.missing_usps?.length>0&&(
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-bold text-gray-700 mb-3">Promisiuni pe care competitorul le face si TU nu le mentionezi</p>
              <div className="space-y-2">
                {data.missing_usps.map((u,i)=>(
                  <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5"/>
                    <p className="text-xs text-amber-800">{u}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[{label:'CTA-urile tale',items:data.my_ctas},{label:'CTA-uri competitor',items:data.competitor_ctas}].map(({label,items})=>(
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-bold text-gray-700 mb-3">{label}</p>
                {items?.length>0
                  ?<div className="flex flex-wrap gap-1.5">{items.map((c,i)=><span key={i} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg font-medium">{c}</span>)}</div>
                  :<p className="text-xs text-gray-300">—</p>}
              </div>
            ))}
          </div>

          {/* CTA recommendations */}
          {data.cta_recommendations?.length>0&&(
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-bold text-gray-700 mb-3">Recomandari CTA</p>
              <div className="space-y-2">
                {data.cta_recommendations.map((r,i)=>(
                  <div key={i} className="flex items-start gap-4 p-3.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <span className="text-xs font-black text-gray-300 shrink-0">0{i+1}</span>
                    <p className="text-sm text-gray-700">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TAB: REPORTS ────────────────────────────────────────────────────────────
function TabReports({ myUrl, competitorUrl, result }: { myUrl:string; competitorUrl:string; result:ComparisonResult|null }) {
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [pastReports, setPastReports] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(()=>{ loadPast() },[])

  async function loadPast() {
    const res = await fetch('/api/competitor/reports')
    const data = await res.json()
    setPastReports(data.reports||[])
  }

  async function openReport(id: string) {
    const res = await fetch(`/api/competitor/reports?id=${id}`)
    const data = await res.json()
    if(res.ok && data.report) {
      setReport(data.report)
      window.scrollTo({top:0,behavior:'smooth'})
    }
  }

  async function generate() {
    if(!result){setError('Ruleaza mai intai analiza Overview');return}
    setGenerating(true);setError('')
    const res = await fetch('/api/competitor/reports',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({competitor_url:competitorUrl,my_analysis:result.my_store,competitor_analysis:result.competitor})
    })
    const data = await res.json()
    if(!res.ok){setError(data.error||'Eroare');setGenerating(false);return}
    setReport(data.report)
    await loadPast()
    setGenerating(false)
  }

  function downloadReport(r: any) {
    const blob = new Blob([JSON.stringify(r, null, 2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url
    a.download=`seo-battle-${hn(r.competitor_url||'')}-${new Date().toISOString().split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  const impactColor: Record<string,string> = {mare:'text-red-500',mediu:'text-amber-500',mic:'text-blue-400'}
  const effortColor: Record<string,string> = {mic:'text-emerald-600',mediu:'text-amber-600',mare:'text-red-500'}

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Raport SEO Battle</h2>
            <p className="text-xs text-gray-400 mt-0.5">Raport complet cu scor detaliat, actiuni prioritizate si strategie.</p>
          </div>
          <button onClick={generate} disabled={generating||!result}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 px-4 py-2.5 rounded-xl transition-colors shrink-0">
            {generating?<Loader2 className="h-4 w-4 animate-spin"/>:<FileText className="h-4 w-4"/>}
            {generating?'Generez...':'Genereaza raport'}
          </button>
        </div>
        {!result&&<p className="text-[10px] text-amber-600 mt-2">Ruleaza analiza din tab-ul Overview mai intai.</p>}
        {error&&<p className="text-xs text-red-500 flex items-center gap-1.5 mt-2"><XCircle className="h-3.5 w-3.5"/>{error}</p>}
        <p className="text-[10px] text-gray-400 mt-2">3 credite</p>
      </div>

      {generating&&<div className="bg-white rounded-2xl border border-gray-100 p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2"/><p className="text-sm text-gray-500">Se genereaza raportul complet...</p></div>}

      {report&&(
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Sumar executiv</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Generat: {new Date(report.generated_at).toLocaleString('ro-RO')}</p>
              </div>
              <button onClick={()=>downloadReport(report)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                <Download className="h-3.5 w-3.5"/>JSON
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <ScoreCircle score={report.my_score||0} you={true} size={56}/>
                  <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tu</p></div>
                </div>
                <span className="text-gray-300 font-bold">vs</span>
                <div className="flex items-center gap-3">
                  <ScoreCircle score={report.competitor_score||0} you={false} size={56}/>
                  <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Competitor</p></div>
                </div>
                <span className={`ml-2 text-sm font-bold px-3 py-1.5 rounded-full ${report.overall_winner==='tu'?'text-emerald-700 bg-emerald-50':report.overall_winner==='competitor'?'text-red-600 bg-red-50':'text-gray-600 bg-gray-100'}`}>
                  {report.overall_winner==='tu'?'Tu castigi':report.overall_winner==='competitor'?'Competitor castiga':'Egalitate'}
                </span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{report.executive_summary}</p>
            </div>
          </div>

          {/* Score breakdown */}
          {report.score_breakdown&&(
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Breakdown scor detaliat</h3>
              </div>
              <div className="p-4 space-y-2">
                {Object.entries(report.score_breakdown).map(([key,val]: [string,any])=>(
                  <div key={key} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500 w-32 shrink-0 capitalize">{key.replace('_',' ')}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <span className={`text-xs font-bold w-6 text-right ${val.winner==='tu'?'text-gray-900':'text-gray-300'}`}>{val.you}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${val.winner==='tu'?'bg-gray-900':'bg-gray-200'}`} style={{width:`${(val.you/val.max)*100}%`}}/>
                      </div>
                      <span className="text-[10px] text-gray-300">/{val.max}</span>
                    </div>
                    <span className="text-gray-300 text-xs">vs</span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${val.winner==='competitor'?'bg-red-400':'bg-gray-200'}`} style={{width:`${(val.them/val.max)*100}%`}}/>
                      </div>
                      <span className={`text-xs font-bold w-6 ${val.winner==='competitor'?'text-gray-900':'text-gray-300'}`}>{val.them}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${val.winner==='tu'?'text-emerald-600 bg-emerald-50':val.winner==='competitor'?'text-red-500 bg-red-50':'text-gray-400 bg-gray-100'}`}>
                      {val.winner==='tu'?'Tu':val.winner==='competitor'?'Ei':'='}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Immediate actions with priority matrix */}
          {report.immediate_actions?.length>0&&(
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Actiuni imediate — matrice prioritati</h3>
                <p className="text-xs text-gray-400 mt-0.5">Sortate dupa impact / efort</p>
              </div>
              <div className="p-4 space-y-2">
                {report.immediate_actions.map((a: any)=>(
                  <div key={a.priority} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <span className="text-sm font-black text-gray-200 shrink-0">0{a.priority}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium leading-snug">{a.action}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-[10px] font-bold ${impactColor[a.impact]}`}>Impact: {a.impact}</span>
                        <span className="text-gray-200">·</span>
                        <span className={`text-[10px] font-bold ${effortColor[a.effort]}`}>Efort: {a.effort}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.long_term_strategy&&(
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Strategie termen lung</p>
              <p className="text-sm text-gray-700 leading-relaxed">{report.long_term_strategy}</p>
            </div>
          )}
        </div>
      )}

      {/* Past reports */}
      {pastReports.length>0&&(
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Rapoarte anterioare</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {pastReports.map((r:any)=>(
              <div key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{hn(r.competitor_url)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-gray-400">{new Date(r.generated_at).toLocaleDateString('ro-RO')}</p>
                    {(r.my_score||r.competitor_score) ? (
                      <p className="text-[10px] text-gray-400">· {r.my_score} vs {r.competitor_score}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.overall_winner==='tu'?'text-emerald-600 bg-emerald-50':r.overall_winner==='competitor'?'text-red-500 bg-red-50':'text-gray-400 bg-gray-100'}`}>
                    {r.overall_winner==='tu'?'Tu':r.overall_winner==='competitor'?'Competitor':'Egal'}
                  </span>
                  <button onClick={()=>openReport(r.id)}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors">
                    Deschide
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CompetitorPage() {
  const [myUrl, setMyUrl] = useState('')
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [inputVal, setInputVal] = useState('')  // raw input
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComparisonResult|null>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview'|'monitor'|'keywords'|'technical'|'pricing'|'reports'>('overview')
  const [savedUrls, setSavedUrls] = useState<string[]>([])
  const [stealModal, setStealModal] = useState<{field:string;val:string;current:string}|null>(null)

  // Load store URL on mount
  useEffect(()=>{
    async function loadStoreUrl() {
      try {
        // Try /api/stores first
        const res = await fetch('/api/stores')
        const data = await res.json()
        if(data.store?.store_url) { setMyUrl(data.store.store_url); return }
        // Fallback to /api/user/me
        const res2 = await fetch('/api/user/me')
        const data2 = await res2.json()
        if(data2.user?.store_url) setMyUrl(data2.user.store_url)
      } catch {}
    }
    loadStoreUrl()
    try { setSavedUrls(JSON.parse(localStorage.getItem('seo_competitor_urls')||'[]')) } catch {}
  },[])

  // Auto-normalize URL as user types
  function handleUrlInput(raw: string) {
    setInputVal(raw)
    if(!raw.trim()) { setCompetitorUrl(''); return }
    const normalized = normalizeUrl(raw)
    setCompetitorUrl(normalized)
  }

  function saveUrl(url: string) {
    const u = [url,...savedUrls.filter(x=>x!==url)].slice(0,6)
    setSavedUrls(u)
    try { localStorage.setItem('seo_competitor_urls',JSON.stringify(u)) } catch {}
  }

  function removeUrl(url: string) {
    const u = savedUrls.filter(x=>x!==url)
    setSavedUrls(u)
    try { localStorage.setItem('seo_competitor_urls',JSON.stringify(u)) } catch {}
  }

  async function analyze() {
    if(!competitorUrl.trim()) return
    setLoading(true);setError('');setResult(null)
    try {
      // Magazinul propriu: din DB — gratuit, 0 credite
      // Competitorul: AI pe pagina live — 3 credite
      const [myRes, theirRes] = await Promise.all([
        fetch('/api/competitor/analyze-my-store'),
        fetch('/api/seo/competitor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({competitor_url:competitorUrl,product_id:null})}),
      ])
      const myData=await myRes.json(), theirData=await theirRes.json()

      if(!myRes.ok){setError(myData.error||'Eroare la incarcarea magazinului tau');setLoading(false);return}
      if(!theirRes.ok){setError(theirData.error||'Nu pot accesa URL-ul competitorului');setLoading(false);return}

      // Actualizeaza myUrl cu URL-ul real al magazinului din DB
      if(myData.store_url && !myUrl) setMyUrl(myData.store_url)

      const my: StoreAnalysis = {url:myUrl||myData.store_url||'',...myData.analysis}
      const them: StoreAnalysis = {url:competitorUrl,...theirData.analysis}
      const ms=calcCompetitorScore(my), ts=calcCompetitorScore(them)

      const titleOk=(s:StoreAnalysis)=>s.title?.length>=50&&s.title?.length<=70
      const metaOk=(s:StoreAnalysis)=>s.meta_description?.length>=120&&s.meta_description?.length<=155
      const wt=(!my.title?'competitor':!them.title?'tu':titleOk(my)&&!titleOk(them)?'tu':!titleOk(my)&&titleOk(them)?'competitor':'egal') as Winner
      const wm=(!my.meta_description?'competitor':!them.meta_description?'tu':metaOk(my)&&!metaOk(them)?'tu':!metaOk(my)&&metaOk(them)?'competitor':'egal') as Winner
      const wk=((my.focus_keywords?.length||0)>(them.focus_keywords?.length||0)?'tu':(my.focus_keywords?.length||0)<(them.focus_keywords?.length||0)?'competitor':'egal') as Winner

      setResult({
        my_store:my, competitor:them,
        verdict:{
          winner_title:wt,winner_meta:wm,winner_keywords:wk,
          overall_score_you:ms,overall_score_competitor:ts,
          summary:ms>ts?`Scor SEO ${ms} vs ${ts}. Magazinul tau e mai bine optimizat.`:ms===ts?`Scor egal ${ms}. Detaliile fac diferenta.`:`Scor SEO ${ms} vs ${ts}. Competitorul e mai bine optimizat — aplica planul de actiune.`,
          top_actions:them.opportunities?.slice(0,4)||my.weaknesses?.slice(0,4)||[],
        },
      })
      saveUrl(competitorUrl)
      setActiveTab('overview')
    } catch(e:any){
      setError('Eroare: '+e.message)
    } finally { setLoading(false) }
  }

  const tabs = [
    {id:'overview',label:'Overview',icon:<BarChart3 className="h-3.5 w-3.5"/>},
    {id:'monitor',label:'Monitor',icon:<Bell className="h-3.5 w-3.5"/>},
    {id:'keywords',label:'Keywords',icon:<Hash className="h-3.5 w-3.5"/>},
    {id:'technical',label:'Tehnic',icon:<Shield className="h-3.5 w-3.5"/>},
    {id:'pricing',label:'Pricing & USP',icon:<DollarSign className="h-3.5 w-3.5"/>},
    {id:'reports',label:'Rapoarte',icon:<FileText className="h-3.5 w-3.5"/>},
  ]

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Analiza Competitori</h1>
        <p className="text-sm text-gray-400 mt-1">Monitorizeaza, compara si depaseste orice competitor SEO</p>
      </div>

      {/* Input — only competitor URL */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.12em] mb-2">URL Competitor</label>
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex-1 flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 focus-within:border-gray-400 transition-colors min-w-[200px]">
              <Globe className="h-3.5 w-3.5 text-gray-300 shrink-0"/>
              <input
                value={inputVal}
                onChange={e=>handleUrlInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&analyze()}
                placeholder="competitor.ro sau https://competitor.ro"
                className="flex-1 text-sm text-gray-800 placeholder-gray-300 focus:outline-none bg-transparent min-w-0"
              />
              {inputVal&&competitorUrl&&inputVal!==competitorUrl&&(
                <span className="text-[10px] text-gray-400 shrink-0 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{hn(competitorUrl)}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {error&&<p className="text-xs text-red-500 flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 shrink-0"/>{error}</p>}
              <button onClick={analyze} disabled={loading||!competitorUrl.trim()}
                className="flex items-center gap-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap">
                {loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Search className="h-4 w-4"/>}
                {loading?'Analizez...':'Analizeaza'}
              </button>
            </div>
          </div>

          {/* Store URL indicator */}
          {myUrl&&(
            <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1.5">
              <CheckCircle className="h-3 w-3 text-emerald-500"/>
              Magazinul tau: <span className="font-mono text-gray-600">{hn(myUrl)}</span>
            </p>
          )}

          {/* Saved URLs */}
          {savedUrls.length>0&&(
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.12em]">Recenti</span>
              {savedUrls.map((u,i)=>(
                <button key={i} onClick={()=>{setInputVal(u);setCompetitorUrl(u)}}
                  className={`group flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${competitorUrl===u?'border-gray-900 bg-gray-900 text-white':'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                  {hn(u)}
                  <span onClick={e=>{e.stopPropagation();removeUrl(u)}} className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-sm leading-none">x</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info strip */}
        <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/40 flex gap-4 flex-wrap">
          {[
            'Magazin tău: gratuit (din DB)',
            'Competitor: 3 credite',
            'Keywords gap: 2 credite',
            'Pricing & USP: 2 credite',
            'Raport Battle: 3 credite',
          ].map(t=>(
            <span key={t} className="text-[10px] text-gray-400 font-medium">{t}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0
              ${activeTab===tab.id?'bg-gray-900 text-white shadow-sm':'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.2}}>
          {activeTab==='overview'&&<TabOverview result={result} myUrl={myUrl} competitorUrl={competitorUrl} onSteal={(field,val,current)=>setStealModal({field,val,current})}/>}
          {activeTab==='monitor'&&<TabMonitor competitorUrl={competitorUrl}/>}
          {activeTab==='keywords'&&<TabKeywords myUrl={myUrl} competitorUrl={competitorUrl}/>}
          {activeTab==='technical'&&<TabTechnical myUrl={myUrl} competitorUrl={competitorUrl}/>}
          {activeTab==='pricing'&&<TabPricing myUrl={myUrl} competitorUrl={competitorUrl}/>}
          {activeTab==='reports'&&<TabReports myUrl={myUrl} competitorUrl={competitorUrl} result={result}/>}
        </motion.div>
      </AnimatePresence>

      {/* Steal This Modal */}
      <AnimatePresence>
        {stealModal&&(
          <StealModal
            open={true}
            field={stealModal.field}
            myCurrent={stealModal.current}
            competitorValue={stealModal.val}
            competitorUrl={competitorUrl}
            productId={null}
            onClose={()=>setStealModal(null)}
            onApplied={(val)=>{
              // Update result locally
              if(result&&stealModal.field==='title') setResult(r=>r?{...r,my_store:{...r.my_store,title:val}}:r)
              if(result&&stealModal.field==='meta_description') setResult(r=>r?{...r,my_store:{...r.my_store,meta_description:val}}:r)
              setStealModal(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}