'use client'

import { useT } from '@/lib/i18n/context'

import { useState, useEffect } from 'react'
import {
  AlertCircle, BookOpen, Plus, Trash2, ToggleLeft, ToggleRight,
  Star, TrendingUp, CheckCircle2, Loader2, Save, RefreshCw, MessageCircle,
} from 'lucide-react'

// ─── Primitives ───────────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-neutral-200 rounded-xl ${className}`}>{children}</div>
}
function Btn({ onClick, disabled, children, variant = 'primary', className = '' }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode
  variant?: 'primary' | 'outline' | 'ghost' | 'success' | 'blue'; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium transition-all disabled:opacity-40 cursor-pointer h-9 px-3.5 text-[12px] rounded-xl whitespace-nowrap'
  const vars = {
    primary: 'bg-neutral-900 hover:bg-neutral-800 text-white',
    outline: 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50',
    ghost:   'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    blue:    'bg-blue-600 text-white hover:bg-blue-700',
  }
  return <button onClick={onClick} disabled={disabled} className={`${base} ${vars[variant]} ${className}`}>{children}</button>
}

// ─── Types ────────────────────────────────────────────────────────────────────
type UnansweredQ = { id: string; question: string; intent: string; confidence: number; count: number; resolved: boolean; last_seen_at: string }
type ProductStat = { id: string; name: string; shown: number; clicked: number; compared: number; escalated: number; carted: number; score: number }
type Correction   = { id: string; original_question: string; wrong_answer?: string; correct_answer: string; is_active: boolean; created_at: string }

// ─── Unanswered Tab ───────────────────────────────────────────────────────────
function UnansweredTab() {
  const { t } = useT()
  const [questions, setQuestions] = useState<UnansweredQ[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<'all'|'unresolved'>('unresolved')

  useEffect(() => {
    fetch('/api/agent/unanswered').then(r=>r.json()).then(d=>{ setQuestions(d.questions||[]); setLoading(false) }).catch(()=>setLoading(false))
  }, [])

  const resolve = async (id: string) => {
    await fetch('/api/agent/unanswered', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, resolved:true }) })
    setQuestions(prev => prev.map(q => q.id===id ? {...q,resolved:true} : q))
  }

  const filtered       = questions.filter(q => filter==='all' || !q.resolved)
  const unresolvedCount = questions.filter(q => !q.resolved).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-neutral-500">{unresolvedCount} întrebări fără răspuns bun</p>
        <div className="flex gap-1 bg-neutral-100 rounded-lg p-1">
          {(['unresolved','all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-[11px] px-3 py-1 rounded-md font-medium transition-all ${filter===f ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>
              {f==='unresolved' ? t('agent.unresolved') : t('common.all')}
            </button>
          ))}
        </div>
      </div>

      {loading
        ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-neutral-300" /></div>
        : filtered.length === 0
          ? <div className="text-center py-12"><CheckCircle2 className="h-10 w-10 text-emerald-300 mx-auto mb-3" /><p className="text-[13px] text-neutral-400">{t('agent.no_unresolved_questions')}</p></div>
          : <div className="space-y-2">
              {filtered.map(q => (
                <div key={q.id} className={`p-4 rounded-xl border transition-colors ${q.resolved ? 'bg-neutral-50 border-neutral-100 opacity-60' : 'bg-white border-neutral-200 hover:border-neutral-300'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold tabular-nums
                      ${q.count>5 ? 'bg-red-100 text-red-600' : q.count>2 ? 'bg-orange-100 text-orange-600' : 'bg-neutral-100 text-neutral-500'}`}>
                      {q.count}×
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-neutral-800 font-medium">"{q.question}"</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-neutral-400">Intent: {q.intent}</span>
                        <span className="text-neutral-200">·</span>
                        <span className="text-[10px] text-neutral-400">Confidence: {Math.round(q.confidence*100)}%</span>
                      </div>
                    </div>
                    {!q.resolved && (
                      <div className="flex gap-2 shrink-0">
                        <a href="/agent" className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />{t('agent.add_to_rag')}
                        </a>
                        <button onClick={() => resolve(q.id)} className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />Rezolvat
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
      }

      <div className="flex gap-2 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <BookOpen className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-700">{t('agent.add_correction')} în <strong>Cunoștințe</strong> și marchează întrebarea ca rezolvată. Agentul va răspunde corect data viitoare.</p>
      </div>
    </div>
  )
}

// ─── Heatmap Tab ──────────────────────────────────────────────────────────────
function HeatmapTab() {
  const { t } = useT()
  const [products, setProducts] = useState<ProductStat[]>([])
  const [loading, setLoading]   = useState(true)
  const [days, setDays]         = useState(30)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/agent/product-events?days=${days}`).then(r=>r.json()).then(d=>{ setProducts(d.products||[]); setLoading(false) }).catch(()=>setLoading(false))
  }, [days])

  const maxScore = Math.max(...products.map(p => p.score), 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-neutral-500">{products.length} produse cu activitate</p>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="text-[12px] border border-neutral-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-neutral-400 bg-white text-neutral-600">
          <option value={7}>7 zile</option><option value={30}>30 zile</option><option value={90}>90 zile</option>
        </select>
      </div>

      {loading
        ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-neutral-300" /></div>
        : products.length === 0
          ? <div className="text-center py-12"><TrendingUp className="h-10 w-10 text-neutral-200 mx-auto mb-3" /><p className="text-[13px] text-neutral-400">{t('agent.no_activity_recorded')}</p></div>
          : <div className="space-y-2">
              {products.slice(0,20).map((p,i) => (
                <div key={p.id} className="p-3 bg-white rounded-xl border border-neutral-100 hover:border-neutral-200 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[11px] font-bold text-neutral-300 w-5 tabular-nums">#{i+1}</span>
                    <p className="text-[13px] font-medium text-neutral-800 flex-1 truncate">{p.name}</p>
                    <span className="text-[11px] font-semibold text-neutral-600 tabular-nums">Scor: {p.score}</span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all" style={{ width:`${Math.round((p.score/maxScore)*100)}%` }} />
                  </div>
                  <div className="flex gap-3 text-[11px] text-neutral-400 flex-wrap">
                    <span>👁️ {p.shown} cereri</span>
                    {p.clicked  > 0 && <span>🖱️ {p.clicked} click-uri</span>}
                    {p.compared > 0 && <span>⚖️ {p.compared} {t('agent.comparisons')}</span>}
                    {p.carted   > 0 && <span className="text-emerald-600 font-medium">🛒 {p.carted} {t('agent.in_cart')}</span>}
                    {p.escalated> 0 && <span className="text-red-500">⚠️ {p.escalated} {t('agent.escalations_count')}</span>}
                  </div>
                </div>
              ))}
            </div>
      }
    </div>
  )
}

// ─── Training Tab ─────────────────────────────────────────────────────────────
function TrainingTab() {
  const { t } = useT()
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [form, setForm]               = useState({ question:'', wrong:'', correct:'' })
  const [error, setError]             = useState('')

  useEffect(() => {
    fetch('/api/agent/training').then(r=>r.json()).then(d=>{ setCorrections(d.corrections||[]); setLoading(false) }).catch(()=>setLoading(false))
  }, [])

  const add = async () => {
    if (!form.question || !form.correct) { setError(t('agent.fill_question_answer')); return }
    setSaving(true); setError('')
    try {
      const r    = await fetch('/api/agent/training', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ original_question:form.question, wrong_answer:form.wrong||undefined, correct_answer:form.correct }) })
      const data = await r.json()
      if (!r.ok) { setError(data.error||t('common.error_generic')); return }
      setCorrections(prev => [data.correction,...prev])
      setForm({ question:'', wrong:'', correct:'' })
    } catch { setError(t('common.error_generic')) } finally { setSaving(false) }
  }

  const toggle = async (c: Correction) => {
    await fetch('/api/agent/training', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:c.id, is_active:!c.is_active }) })
    setCorrections(prev => prev.map(x => x.id===c.id ? {...x,is_active:!x.is_active} : x))
  }

  const remove = async (id: string) => {
    if (!confirm(t('agent.confirm_delete_correction'))) return
    await fetch('/api/agent/training', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    setCorrections(prev => prev.filter(x => x.id!==id))
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-3">
        <p className="text-[13px] font-semibold text-neutral-900">{t('agent.add_new_correction')}</p>
        <p className="text-[11px] text-neutral-500">Când agentul răspunde greșit, adaugă răspunsul corect. Agentul îl va folosi prioritar.</p>
        <div className="space-y-2">
          <input value={form.question} onChange={e => setForm(f=>({...f,question:e.target.value}))} placeholder={t('agent.question_client_placeholder')}
            className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-neutral-400 transition-colors" />
          <input value={form.wrong} onChange={e => setForm(f=>({...f,wrong:e.target.value}))} placeholder={t('agent.wrong_answer_placeholder')}
            className="w-full text-[12px] border border-orange-200 rounded-xl px-3 py-2 bg-orange-50/50 focus:outline-none focus:border-orange-400 transition-colors" />
          <textarea value={form.correct} onChange={e => setForm(f=>({...f,correct:e.target.value}))} rows={3}
            placeholder={t('agent.correct_answer_placeholder')}
            className="w-full text-[12px] border border-emerald-200 rounded-xl px-3 py-2 bg-emerald-50/50 focus:outline-none focus:border-emerald-400 transition-colors resize-none" />
        </div>
        {error && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
        <Btn onClick={add} disabled={saving} variant="primary" className="w-full justify-center">
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('common.processing')}</> : <><Plus className="h-3.5 w-3.5" />{t('agent.add_correction')}</>}
        </Btn>
      </Card>

      {loading
        ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-neutral-300" /></div>
        : corrections.length === 0
          ? <div className="text-center py-10"><Star className="h-10 w-10 text-neutral-200 mx-auto mb-3" /><p className="text-[13px] text-neutral-400">{t('agent.no_corrections')} adăugată</p></div>
          : <div className="space-y-2">
              {corrections.map(c => (
                <div key={c.id} className={`p-4 rounded-xl border transition-colors ${c.is_active ? 'bg-white border-neutral-200' : 'bg-neutral-50 border-neutral-100 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-[11px] text-neutral-500">Întrebare: <span className="font-medium text-neutral-700">"{c.original_question}"</span></p>
                      {c.wrong_answer && <p className="text-[11px] text-orange-600">❌ Greșit: "{c.wrong_answer}"</p>}
                      <p className="text-[11px] text-emerald-700">✅ Corect: "{c.correct_answer}"</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggle(c)}>
                        {c.is_active
                          ? <ToggleRight className="h-5 w-5 text-emerald-500" />
                          : <ToggleLeft  className="h-5 w-5 text-neutral-300" />}
                      </button>
                      <button onClick={() => remove(c.id)} className="p-1 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
      }
    </div>
  )
}

// ─── Reviews Tab ──────────────────────────────────────────────────────────────
function ReviewsTab() {
  const { t } = useT()
  const [config, setConfig]   = useState({ review_enabled:false, review_delay_days:7, review_google_url:'', review_site_enabled:true, review_email_subject:'', review_email_body:'' })
  const [requests, setRequests] = useState<any[]>([])
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    fetch('/api/agent/config').then(r=>r.json()).then(d=>{ if(d.config) setConfig(c=>({...c,...d.config})) })
    fetch('/api/agent/reviews').then(r=>r.json()).then(d=>setRequests(d.requests||[]))
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch('/api/agent/config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(config) })
    setSaved(true); setTimeout(()=>setSaved(false),2500); setSaving(false)
  }

  const statusMeta: Record<string,{bg:string;text:string;label:string}> = {
    pending: { bg:'bg-amber-100', text:'text-amber-700', label:'Programat' },
    sent:    { bg:'bg-emerald-100', text:'text-emerald-700', label:'Trimis' },
    clicked: { bg:'bg-blue-100', text:'text-blue-700', label:'Deschis' },
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-neutral-900">Colectare automată review-uri</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">{t('agent.email_sent_auto')}</p>
          </div>
          <button onClick={() => setConfig(c=>({...c,review_enabled:!c.review_enabled}))}>
            {config.review_enabled
              ? <ToggleRight className="h-7 w-7 text-emerald-500" />
              : <ToggleLeft  className="h-7 w-7 text-neutral-300" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">Zile după livrare</p>
            <input type="number" min={1} max={30} value={config.review_delay_days} onChange={e => setConfig(c=>({...c,review_delay_days:Number(e.target.value)}))}
              className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-neutral-400 transition-colors" />
          </div>
          <div>
            <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">Link Google Reviews</p>
            <input value={config.review_google_url} onChange={e => setConfig(c=>({...c,review_google_url:e.target.value}))} placeholder="https://g.page/..."
              className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-neutral-400 transition-colors" />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">{t('agent.email_subject_opt')}</p>
          <input value={config.review_email_subject} onChange={e => setConfig(c=>({...c,review_email_subject:e.target.value}))} placeholder={t('agent.review_email_subject_placeholder')}
            className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-neutral-400 transition-colors" />
        </div>
        <div>
          <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">{t('agent.custom_message_opt')}</p>
          <textarea value={config.review_email_body} onChange={e => setConfig(c=>({...c,review_email_body:e.target.value}))}
            placeholder={t('agent.review_message_placeholder')} rows={3}
            className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-neutral-400 transition-colors resize-none" />
        </div>

        <Btn onClick={save} disabled={saving} variant={saved?'success':'primary'} className="w-full justify-center">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? t('common.saving') : saved ? t('common.saved') : t('agent.save_config_label')}
        </Btn>

        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-[11px] font-semibold text-amber-800 mb-1">Setup webhook WooCommerce</p>
          <p className="text-[10px] text-amber-700 mb-2">WooCommerce → Setări → Avansat → Webhooks:</p>
          <code className="text-[10px] bg-amber-100 px-2 py-1 rounded block break-all text-amber-800">
            {typeof window !== 'undefined' ? window.location.origin : 'https://app.hontrio.com'}/api/agent/reviews?userId=YOUR_USER_ID
          </code>
          <p className="text-[10px] text-amber-600 mt-1">{t('agent.webhook_topic')}</p>
        </div>
      </Card>

      {requests.length > 0 && (
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-neutral-900 mb-3">Istoric emailuri ({requests.length})</p>
          <div className="space-y-2">
            {requests.slice(0,15).map((r: any) => {
              const s = statusMeta[r.status] || { bg:'bg-neutral-100', text:'text-neutral-500', label:r.status }
              return (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                  <div>
                    <p className="text-[12px] font-medium text-neutral-700">{r.customer_email}</p>
                    <p className="text-[10px] text-neutral-400">{(r.product_names||[]).slice(0,2).join(', ')}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>{s.label}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const { t } = useT()
  const [tab, setTab] = useState<'unanswered'|'heatmap'|'training'|'reviews'>('unanswered')

  const tabs = [
    { id:'unanswered', label:t('agent.unanswered'),    icon:AlertCircle },
    { id:'heatmap',    label:t('agent.heatmap'), icon:TrendingUp  },
    { id:'training',   label:t('agent.training'),     icon:BookOpen    },
    { id:'reviews',    label:t('agent.reviews'),       icon:MessageCircle },
  ] as const

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t('agent.insights_title')}</h1>
        <p className="text-[13px] text-neutral-400 mt-0.5">Îmbunătățește continuu agentul bazat pe date reale</p>
      </div>

      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 min-w-fit whitespace-nowrap py-2 px-3 rounded-lg text-[11px] font-medium transition-all ${tab===t.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==='unanswered' && <UnansweredTab />}
      {tab==='heatmap'    && <HeatmapTab    />}
      {tab==='training'   && <TrainingTab   />}
      {tab==='reviews'    && <ReviewsTab    />}
    </div>
  )
}