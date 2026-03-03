'use client'

import { useState, useEffect } from 'react'
import {
  Zap, Plus, Trash2, Save, ToggleLeft, ToggleRight,
  Clock, MousePointer, TrendingDown, ShoppingCart,
  FileText, Moon, ChevronDown, ChevronUp, Info,
  AlertCircle, CheckCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type TriggerType = 'exit_intent' | 'time_on_page' | 'scroll_depth' | 'cart_abandonment' | 'page_specific' | 'inactivity'

interface Trigger {
  id: string
  name: string
  type: TriggerType
  is_active: boolean
  message: string
  conditions: Record<string, any>
  cooldown_hours: number
  priority: number
}

const TRIGGER_META: Record<TriggerType, { label: string; icon: any; color: string; desc: string }> = {
  exit_intent:      { label: 'Intenție de ieșire',  icon: MousePointer,  color: 'text-red-500 bg-red-50 border-red-100',       desc: 'Se activează când cursorul iese din fereastra browserului' },
  time_on_page:     { label: 'Timp pe pagină',       icon: Clock,         color: 'text-blue-500 bg-blue-50 border-blue-100',     desc: 'Se activează după X secunde petrecute pe pagină' },
  scroll_depth:     { label: 'Adâncime scroll',      icon: TrendingDown,  color: 'text-purple-500 bg-purple-50 border-purple-100', desc: 'Se activează când vizitatorul scrollează X% din pagină' },
  cart_abandonment: { label: 'Coș abandonat',        icon: ShoppingCart,  color: 'text-orange-500 bg-orange-50 border-orange-100', desc: 'Se activează când are produse în coș dar nu finalizează' },
  page_specific:    { label: 'Pagină specifică',     icon: FileText,      color: 'text-green-500 bg-green-50 border-green-100',  desc: 'Se activează pe anumite tipuri de pagini după X secunde' },
  inactivity:       { label: 'Inactivitate',         icon: Moon,          color: 'text-gray-500 bg-gray-50 border-gray-200',     desc: 'Se activează când vizitatorul nu face nimic X secunde' },
}

const PAGE_OPTIONS = [
  { value: 'all',      label: 'Toate paginile' },
  { value: 'product',  label: 'Pagini produs' },
  { value: 'cart',     label: 'Pagina coș' },
  { value: 'checkout', label: 'Checkout' },
  { value: 'home',     label: 'Homepage' },
  { value: 'contact',  label: 'Contact' },
  { value: 'category', label: 'Categorie' },
]

export default function TriggersPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newType, setNewType] = useState<TriggerType>('time_on_page')

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    fetch('/api/agent/triggers')
      .then(r => r.json())
      .then(d => { setTriggers(d.triggers || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const updateLocal = (id: string, patch: Partial<Trigger>) =>
    setTriggers(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t))

  const updateCondition = (id: string, key: string, value: any) =>
    setTriggers(ts => ts.map(t => t.id === id ? { ...t, conditions: { ...t.conditions, [key]: value } } : t))

  const saveTrigger = async (trigger: Trigger) => {
    setSaving(trigger.id)
    try {
      const r = await fetch('/api/agent/triggers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trigger),
      })
      if (!r.ok) throw new Error()
      showToast('Trigger salvat!')
    } catch {
      showToast('Eroare la salvare', false)
    } finally {
      setSaving(null)
    }
  }

  const toggleActive = async (trigger: Trigger) => {
    const updated = { ...trigger, is_active: !trigger.is_active }
    updateLocal(trigger.id, { is_active: updated.is_active })
    await fetch('/api/agent/triggers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }

  const deleteTrigger = async (id: string) => {
    if (!confirm('Ștergi acest trigger?')) return
    await fetch('/api/agent/triggers?id=' + id, { method: 'DELETE' })
    setTriggers(ts => ts.filter(t => t.id !== id))
    showToast('Trigger șters')
  }

  const addTrigger = async () => {
    const defaults: Record<TriggerType, any> = {
      exit_intent:      { conditions: { pages: ['all'] },             message: 'Hei, pleci deja? Te pot ajuta să găsești ce cauți! 😊', cooldown_hours: 24, priority: 10 },
      time_on_page:     { conditions: { pages: ['all'], seconds: 45 }, message: 'Văd că ești pe site de ceva timp. Te pot ajuta cu ceva?', cooldown_hours: 24, priority: 5 },
      scroll_depth:     { conditions: { pages: ['product'], percent: 70 }, message: 'Ai văzut destul de mult. Îți recomand ceva potrivit?', cooldown_hours: 24, priority: 5 },
      cart_abandonment: { conditions: { pages: ['cart'], minutes: 3 }, message: 'Ai produse în coș! Te ajut să finalizezi comanda? 🛒', cooldown_hours: 12, priority: 20 },
      page_specific:    { conditions: { pages: ['product'], seconds: 20 }, message: 'Ai întrebări despre acest produs? Sunt aici!', cooldown_hours: 4, priority: 8 },
      inactivity:       { conditions: { pages: ['all'], seconds: 120 }, message: 'Ești încă acolo? Te pot ajuta! 👋', cooldown_hours: 24, priority: 3 },
    }
    const d = defaults[newType]
    const r = await fetch('/api/agent/triggers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: TRIGGER_META[newType].label, type: newType, ...d }),
    })
    const data = await r.json()
    if (data.trigger) {
      setTriggers(ts => [...ts, data.trigger])
      setShowAdd(false)
      setExpanded(data.trigger.id)
      showToast('Trigger adăugat!')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium
          ${toast.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.ok ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" /> Triggeri Proactivi
          </h1>
          <p className="text-gray-500 text-sm mt-1">Agentul vorbește primul la momentul potrivit</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-2">
          <Plus className="h-4 w-4" /> Trigger nou
        </Button>
      </div>

      <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
        <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Triggerii se activează în ordinea priorității. Fiecare vizitator vede maxim <strong>1 trigger per sesiune</strong>. Cooldown-ul previne repetiția între vizite.
        </p>
      </div>

      {/* Modal adaugare */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Alege tipul de trigger</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(Object.keys(TRIGGER_META) as TriggerType[]).map(type => {
                const m = TRIGGER_META[type]
                const Icon = m.icon
                return (
                  <button key={type} onClick={() => setNewType(type)}
                    className={`flex flex-col gap-2 p-3 rounded-xl border-2 text-left transition-all
                      ${newType === type ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Icon className={`h-5 w-5 ${newType === type ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className="text-xs font-semibold text-gray-800 leading-tight">{m.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-500 mb-5 bg-gray-50 rounded-lg p-3">{TRIGGER_META[newType].desc}</p>
            <div className="flex gap-2">
              <Button onClick={() => setShowAdd(false)} variant="outline" className="flex-1 rounded-xl">Anulează</Button>
              <Button onClick={addTrigger} className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl">Adaugă</Button>
            </div>
          </div>
        </div>
      )}

      {triggers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Zap className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nu ai triggeri configurați</p>
          <p className="text-xs mt-1">Adaugă primul trigger ca agentul să vorbească primul</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...triggers].sort((a, b) => b.priority - a.priority).map(trigger => {
            const meta = TRIGGER_META[trigger.type]
            const Icon = meta.icon
            const isExp = expanded === trigger.id

            return (
              <div key={trigger.id} className={`bg-white border rounded-2xl overflow-hidden transition-all
                ${trigger.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>

                <div className="flex items-center gap-3 p-4">
                  <div className={`p-2 rounded-xl border ${meta.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{trigger.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${meta.color}`}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{trigger.message}</p>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="text-xs text-gray-400">Prioritate</div>
                    <div className="text-sm font-bold text-gray-700">{trigger.priority}</div>
                  </div>
                  <button onClick={() => toggleActive(trigger)}>
                    {trigger.is_active
                      ? <ToggleRight className="h-6 w-6 text-blue-600" />
                      : <ToggleLeft className="h-6 w-6 text-gray-300" />}
                  </button>
                  <button onClick={() => setExpanded(isExp ? null : trigger.id)} className="text-gray-400 hover:text-gray-600">
                    {isExp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {isExp && (
                  <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">

                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Nume trigger</label>
                      <Input value={trigger.name} onChange={e => updateLocal(trigger.id, { name: e.target.value })}
                        className="h-9 rounded-xl text-sm bg-white" />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Mesaj afișat vizitatorului</label>
                      <textarea value={trigger.message}
                        onChange={e => updateLocal(trigger.id, { message: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none bg-white focus:outline-none focus:border-blue-400"
                        rows={2} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {(trigger.type === 'time_on_page' || trigger.type === 'page_specific') && (
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Secunde pe pagină</label>
                          <Input type="number" min={5} max={300}
                            value={trigger.conditions.seconds || 30}
                            onChange={e => updateCondition(trigger.id, 'seconds', Number(e.target.value))}
                            className="h-9 rounded-xl text-sm bg-white" />
                        </div>
                      )}
                      {trigger.type === 'scroll_depth' && (
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Scroll % declanșare</label>
                          <Input type="number" min={10} max={100}
                            value={trigger.conditions.percent || 70}
                            onChange={e => updateCondition(trigger.id, 'percent', Number(e.target.value))}
                            className="h-9 rounded-xl text-sm bg-white" />
                        </div>
                      )}
                      {trigger.type === 'cart_abandonment' && (
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Minute de așteptare</label>
                          <Input type="number" min={1} max={30}
                            value={trigger.conditions.minutes || 3}
                            onChange={e => updateCondition(trigger.id, 'minutes', Number(e.target.value))}
                            className="h-9 rounded-xl text-sm bg-white" />
                        </div>
                      )}
                      {trigger.type === 'inactivity' && (
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Secunde inactivitate</label>
                          <Input type="number" min={30} max={600}
                            value={trigger.conditions.seconds || 120}
                            onChange={e => updateCondition(trigger.id, 'seconds', Number(e.target.value))}
                            className="h-9 rounded-xl text-sm bg-white" />
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Cooldown (ore între activări)</label>
                        <Input type="number" min={1} max={168}
                          value={trigger.cooldown_hours}
                          onChange={e => updateLocal(trigger.id, { cooldown_hours: Number(e.target.value) })}
                          className="h-9 rounded-xl text-sm bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Prioritate (mai mare = primul)</label>
                        <Input type="number" min={0} max={100}
                          value={trigger.priority}
                          onChange={e => updateLocal(trigger.id, { priority: Number(e.target.value) })}
                          className="h-9 rounded-xl text-sm bg-white" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-2">Pagini active</label>
                      <div className="flex flex-wrap gap-2">
                        {PAGE_OPTIONS.map(opt => {
                          const pages: string[] = trigger.conditions.pages || ['all']
                          const isOn = pages.includes(opt.value)
                          return (
                            <button key={opt.value}
                              onClick={() => {
                                let newPages = [...pages]
                                if (opt.value === 'all') {
                                  newPages = ['all']
                                } else {
                                  newPages = newPages.filter(p => p !== 'all')
                                  if (isOn) newPages = newPages.filter(p => p !== opt.value)
                                  else newPages.push(opt.value)
                                  if (newPages.length === 0) newPages = ['all']
                                }
                                updateCondition(trigger.id, 'pages', newPages)
                              }}
                              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all
                                ${isOn ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <button onClick={() => deleteTrigger(trigger.id)}
                        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium">
                        <Trash2 className="h-3.5 w-3.5" /> Șterge
                      </button>
                      <Button onClick={() => saveTrigger(trigger)} disabled={saving === trigger.id}
                        className="bg-blue-600 hover:bg-blue-700 rounded-xl h-9 px-5 text-sm gap-2">
                        <Save className="h-3.5 w-3.5" />
                        {saving === trigger.id ? 'Se salvează...' : 'Salvează'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}