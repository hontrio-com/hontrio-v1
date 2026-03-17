'use client'

import { useT } from '@/lib/i18n/context'

import { useState, useEffect } from 'react'
import {
  Zap, Plus, Trash2, Save, ToggleLeft, ToggleRight,
  Clock, MousePointer, TrendingDown, ShoppingCart,
  FileText, Moon, ChevronDown, ChevronUp, Info,
  AlertCircle, CheckCircle, X,
} from 'lucide-react'

type TriggerType = 'exit_intent'|'time_on_page'|'scroll_depth'|'cart_abandonment'|'page_specific'|'inactivity'

interface Trigger {
  id: string; name: string; type: TriggerType; is_active: boolean
  message: string; conditions: Record<string, any>; cooldown_hours: number; priority: number
}

const getTriggerMeta = (t: (k: string, p?: Record<string, string | number>) => string): Record<TriggerType, { label: string; icon: any; iconColor: string; badgeBg: string; badgeText: string; desc: string }> => ({
  exit_intent:      { label:t('agent.trigger_exit_intent'), icon:MousePointer,  iconColor:'text-red-500',    badgeBg:'bg-red-50',    badgeText:'text-red-600',    desc:t('agent.trigger_exit_desc') },
  time_on_page:     { label:t('agent.trigger_time_label'),      icon:Clock,         iconColor:'text-blue-500',   badgeBg:'bg-blue-50',   badgeText:'text-blue-600',   desc:t('agent.trigger_time_desc') },
  scroll_depth:     { label:t('agent.trigger_scroll_label'),     icon:TrendingDown,  iconColor:'text-violet-500', badgeBg:'bg-violet-50', badgeText:'text-violet-600', desc:t('agent.trigger_scroll_desc') },
  cart_abandonment: { label:t('agent.trigger_cart_label'),       icon:ShoppingCart,  iconColor:'text-orange-500', badgeBg:'bg-orange-50', badgeText:'text-orange-600', desc:t('agent.trigger_cart_desc') },
  page_specific:    { label:t('agent.trigger_page_label'),    icon:FileText,      iconColor:'text-emerald-500',badgeBg:'bg-emerald-50',badgeText:'text-emerald-600',desc:t('agent.trigger_page_desc') },
  inactivity:       { label:t('agent.trigger_inactivity_label'),        icon:Moon,          iconColor:'text-neutral-500',badgeBg:'bg-neutral-100',badgeText:'text-neutral-600',desc:t('agent.trigger_inactivity_desc') },
})

const getPageOptions = (t: (k: string, p?: Record<string, string | number>) => string) => [
  { value:'all',      label:t('agent.page_all') },
  { value:'product',  label:t('agent.page_product')  },
  { value:'cart',     label:t('agent.page_cart')     },
  { value:'checkout', label:t('agent.page_checkout')        },
  { value:'home',     label:t('agent.page_home')        },
  { value:'contact',  label:t('agent.page_contact')         },
  { value:'category', label:'Categorie'       },
]

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-neutral-200 rounded-xl ${className}`}>{children}</div>
}

export default function TriggersPage() {
  const { t } = useT()
  const TRIGGER_META = getTriggerMeta(t)
  const PAGE_OPTIONS = getPageOptions(t)
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string|null>(null)
  const [expanded, setExpanded] = useState<string|null>(null)
  const [toast, setToast]       = useState<{ msg:string; ok:boolean }|null>(null)
  const [showAdd, setShowAdd]   = useState(false)
  const [newType, setNewType]   = useState<TriggerType>('time_on_page')

  const showToast = (msg: string, ok=true) => { setToast({ msg, ok }); setTimeout(()=>setToast(null),3500) }

  useEffect(() => {
    fetch('/api/agent/triggers').then(r=>r.json()).then(d=>{ setTriggers(d.triggers||[]); setLoading(false) }).catch(()=>setLoading(false))
  }, [])

  const updateLocal     = (id: string, patch: Partial<Trigger>) => setTriggers(ts => ts.map(t => t.id===id ? {...t,...patch} : t))
  const updateCondition = (id: string, key: string, value: any) => setTriggers(ts => ts.map(t => t.id===id ? {...t,conditions:{...t.conditions,[key]:value}} : t))

  const saveTrigger = async (trigger: Trigger) => {
    setSaving(trigger.id)
    try {
      const r = await fetch('/api/agent/triggers', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(trigger) })
      if (!r.ok) throw new Error()
      showToast('Trigger salvat!')
    } catch { showToast('Eroare la salvare', false) } finally { setSaving(null) }
  }

  const toggleActive = async (trigger: Trigger) => {
    const updated = { ...trigger, is_active:!trigger.is_active }
    updateLocal(trigger.id, { is_active:updated.is_active })
    await fetch('/api/agent/triggers', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(updated) })
  }

  const deleteTrigger = async (id: string) => {
    if (!confirm(t('agent.confirm_delete_trigger'))) return
    await fetch('/api/agent/triggers?id='+id, { method:'DELETE' })
    setTriggers(ts => ts.filter(t => t.id!==id))
    showToast('Trigger șters')
  }

  const addTrigger = async () => {
    const defaults: Record<TriggerType, any> = {
      exit_intent:      { conditions:{ pages:['all'] },              message:t('agent.default_trigger_exit'), cooldown_hours:24, priority:10 },
      time_on_page:     { conditions:{ pages:['all'],seconds:45 },   message:t('agent.default_trigger_time'),  cooldown_hours:24, priority:5  },
      scroll_depth:     { conditions:{ pages:['product'],percent:70},message:t('agent.default_trigger_scroll'),      cooldown_hours:24, priority:5  },
      cart_abandonment: { conditions:{ pages:['cart'],minutes:3 },   message:t('agent.default_trigger_cart'),      cooldown_hours:12, priority:20 },
      page_specific:    { conditions:{ pages:['product'],seconds:20},message:t('agent.default_trigger_page'),               cooldown_hours:4,  priority:8  },
      inactivity:       { conditions:{ pages:['all'],seconds:120 },  message:t('agent.default_trigger_inactivity'),                          cooldown_hours:24, priority:3  },
    }
    const d    = defaults[newType]
    const r    = await fetch('/api/agent/triggers', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:TRIGGER_META[newType].label, type:newType, ...d }) })
    const data = await r.json()
    if (data.trigger) { setTriggers(ts=>[...ts,data.trigger]); setShowAdd(false); setExpanded(data.trigger.id); showToast('Trigger adăugat!') }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-800" /></div>

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-[12px] font-medium
          ${toast.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.ok ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400 fill-amber-300" />Triggeri Proactivi
          </h1>
          <p className="text-[13px] text-neutral-400 mt-0.5">Agentul vorbește primul la momentul potrivit</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-medium bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl transition-colors">
          <Plus className="h-3.5 w-3.5" />Trigger nou
        </button>
      </div>

      {/* Info banner */}
      <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-[12px] text-blue-700" dangerouslySetInnerHTML={{ __html: t('agent.trigger_explanation') }} />
      </div>

      {/* Modal adăugare */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget && setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-neutral-900">Alege tipul de trigger</h2>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(Object.keys(TRIGGER_META) as TriggerType[]).map(type => {
                const m    = TRIGGER_META[type]
                const Icon = m.icon
                const sel  = newType===type
                return (
                  <button key={type} onClick={() => setNewType(type)}
                    className={`flex flex-col gap-2 p-3 rounded-xl border-2 text-left transition-all ${sel ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-100 hover:border-neutral-200'}`}>
                    <Icon className={`h-5 w-5 ${sel ? 'text-neutral-900' : m.iconColor}`} />
                    <span className="text-[11px] font-semibold text-neutral-800 leading-tight">{m.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-neutral-500 mb-5 bg-neutral-50 rounded-xl p-3">{TRIGGER_META[newType].desc}</p>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 h-9 text-[12px] font-medium border border-neutral-200 text-neutral-600 hover:bg-neutral-50 rounded-xl transition-colors">{t('common.cancel_label')}</button>
              <button onClick={addTrigger} className="flex-1 h-9 text-[12px] font-medium bg-neutral-900 text-white hover:bg-neutral-800 rounded-xl transition-colors">Adaugă</button>
            </div>
          </div>
        </div>
      )}

      {/* Lista triggeri */}
      {triggers.length === 0 ? (
        <div className="text-center py-16">
          <Zap className="h-12 w-12 mx-auto mb-3 text-neutral-200" />
          <p className="text-[13px] text-neutral-500">Nu ai triggeri configurați</p>
          <p className="text-[11px] text-neutral-400 mt-1">{t('agent.first_trigger_hint')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...triggers].sort((a,b) => b.priority-a.priority).map(trigger => {
            const meta  = TRIGGER_META[trigger.type]
            const Icon  = meta.icon
            const isExp = expanded===trigger.id

            return (
              <Card key={trigger.id} className={`overflow-hidden transition-all ${!trigger.is_active ? 'opacity-60' : ''}`}>
                {/* Row */}
                <div className="flex items-center gap-3 p-4">
                  <div className={`p-2 rounded-xl ${meta.badgeBg} shrink-0`}>
                    <Icon className={`h-4 w-4 ${meta.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-neutral-900">{trigger.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.badgeBg} ${meta.badgeText}`}>{meta.label}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{trigger.message}</p>
                  </div>
                  <div className="text-center hidden sm:block shrink-0">
                    <p className="text-[10px] text-neutral-400">{t('common.priority')}</p>
                    <p className="text-[14px] font-bold text-neutral-700 tabular-nums">{trigger.priority}</p>
                  </div>
                  <button onClick={() => toggleActive(trigger)} className="shrink-0">
                    {trigger.is_active
                      ? <ToggleRight className="h-6 w-6 text-emerald-500" />
                      : <ToggleLeft  className="h-6 w-6 text-neutral-300" />}
                  </button>
                  <button onClick={() => setExpanded(isExp?null:trigger.id)} className="text-neutral-400 hover:text-neutral-600 transition-colors shrink-0">
                    {isExp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Expanded editor */}
                {isExp && (
                  <div className="border-t border-neutral-100 p-4 space-y-4 bg-neutral-50">
                    <div>
                      <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">{t('agent.trigger_name')}</p>
                      <input value={trigger.name} onChange={e => updateLocal(trigger.id,{name:e.target.value})}
                        className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-neutral-400 transition-colors" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">{t('agent.trigger_msg_label')}</p>
                      <textarea value={trigger.message} onChange={e => updateLocal(trigger.id,{message:e.target.value})}
                        className="w-full border border-neutral-200 rounded-xl p-3 text-[12px] resize-none bg-white focus:outline-none focus:border-neutral-400 transition-colors" rows={2} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {(trigger.type==='time_on_page'||trigger.type==='page_specific') && (
                        <div>
                          <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">Secunde pe pagină</p>
                          <input type="number" min={5} max={300} value={trigger.conditions.seconds||30} onChange={e => updateCondition(trigger.id,'seconds',Number(e.target.value))}
                            className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-neutral-400 transition-colors" />
                        </div>
                      )}
                      {trigger.type==='scroll_depth' && (
                        <div>
                          <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">Scroll % declanșare</p>
                          <input type="number" min={10} max={100} value={trigger.conditions.percent||70} onChange={e => updateCondition(trigger.id,'percent',Number(e.target.value))}
                            className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-neutral-400 transition-colors" />
                        </div>
                      )}
                      {trigger.type==='cart_abandonment' && (
                        <div>
                          <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">Minute de așteptare</p>
                          <input type="number" min={1} max={30} value={trigger.conditions.minutes||3} onChange={e => updateCondition(trigger.id,'minutes',Number(e.target.value))}
                            className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-neutral-400 transition-colors" />
                        </div>
                      )}
                      {trigger.type==='inactivity' && (
                        <div>
                          <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">Secunde inactivitate</p>
                          <input type="number" min={30} max={600} value={trigger.conditions.seconds||120} onChange={e => updateCondition(trigger.id,'seconds',Number(e.target.value))}
                            className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-neutral-400 transition-colors" />
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">{t('agent.cooldown_hours')}</p>
                        <input type="number" min={1} max={168} value={trigger.cooldown_hours} onChange={e => updateLocal(trigger.id,{cooldown_hours:Number(e.target.value)})}
                          className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-neutral-400 transition-colors" />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">{t('common.priority')}</p>
                        <input type="number" min={0} max={100} value={trigger.priority} onChange={e => updateLocal(trigger.id,{priority:Number(e.target.value)})}
                          className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-neutral-400 transition-colors" />
                      </div>
                    </div>

                    {/* Pagini active */}
                    <div>
                      <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-2">Pagini active</p>
                      <div className="flex flex-wrap gap-2">
                        {PAGE_OPTIONS.map(opt => {
                          const pages: string[] = trigger.conditions.pages||['all']
                          const isOn = pages.includes(opt.value)
                          return (
                            <button key={opt.value}
                              onClick={() => {
                                let newPages = [...pages]
                                if (opt.value==='all') { newPages=['all'] }
                                else {
                                  newPages = newPages.filter(p => p!=='all')
                                  if (isOn) newPages = newPages.filter(p => p!==opt.value)
                                  else newPages.push(opt.value)
                                  if (newPages.length===0) newPages=['all']
                                }
                                updateCondition(trigger.id,'pages',newPages)
                              }}
                              className={`text-[11px] px-3 py-1.5 rounded-full border font-medium transition-all
                                ${isOn ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                      <button onClick={() => deleteTrigger(trigger.id)} className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-600 font-medium transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />Șterge
                      </button>
                      <button onClick={() => saveTrigger(trigger)} disabled={saving===trigger.id}
                        className="inline-flex items-center gap-1.5 h-8 px-4 text-[12px] font-medium bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl transition-colors disabled:opacity-40">
                        <Save className="h-3.5 w-3.5" />
                        {saving===trigger.id ? t('common.saving') : t('common.save')}
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}