'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send, Users, CheckCircle2, AlertCircle } from 'lucide-react'

const TYPES = [
  { value: 'info', label: 'Info', desc: 'Informație generală' },
  { value: 'success', label: 'Success', desc: 'Veste bună, feature nou' },
  { value: 'warning', label: 'Warning', desc: 'Mentenanță, schimbare' },
  { value: 'promo', label: 'Promo', desc: 'Ofertă specială, discount' },
]

const TARGETS = [
  { value: 'all', label: 'Toți userii' },
  { value: 'paid', label: 'Useri plătitori' },
  { value: 'free', label: 'Useri free' },
  { value: 'plan', label: 'Plan specific' },
]

const PLANS = ['starter', 'professional', 'enterprise']

export default function BroadcastPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState('info')
  const [target, setTarget] = useState('all')
  const [plan, setPlan] = useState('starter')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const send = async () => {
    if (!title.trim() || !message.trim()) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, type, target, plan: target === 'plan' ? plan : undefined }),
      })
      const data = await res.json()
      if (data.sent) {
        setResult({ ok: true, msg: `Trimis cu succes către ${data.sent} useri` })
        setTitle('')
        setMessage('')
      } else {
        setResult({ ok: false, msg: data.error || 'Eroare la trimitere' })
      }
    } catch {
      setResult({ ok: false, msg: 'Eroare de rețea' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 font-mono max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Broadcast Message</h1>
        <p className="text-xs text-gray-400 mt-0.5 font-sans">Trimite notificări in-app utilizatorilor</p>
      </motion.div>

      {result && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 p-4 rounded-xl ${result.ok ? 'bg-gray-50 border border-gray-200' : 'bg-gray-900 text-white'}`}
        >
          {result.ok ? <CheckCircle2 className="h-4 w-4 text-gray-700 shrink-0" /> : <AlertCircle className="h-4 w-4 text-white shrink-0" />}
          <span className="text-sm font-sans">{result.msg}</span>
        </motion.div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        {/* Type */}
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Tip mesaj</p>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${type === t.value ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}
              >
                <p className="text-xs font-semibold text-gray-900">{t.label}</p>
                <p className="text-[10px] text-gray-400 font-sans mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Target */}
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Destinatari</p>
          <div className="flex flex-wrap gap-2">
            {TARGETS.map(t => (
              <button
                key={t.value}
                onClick={() => setTarget(t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-colors ${target === t.value ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <Users className="h-3 w-3" />{t.label}
              </button>
            ))}
          </div>
          {target === 'plan' && (
            <div className="flex gap-2 mt-2">
              {PLANS.map(p => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs capitalize transition-colors ${plan === p ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >{p}</button>
              ))}
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Titlu</p>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="ex: Funcție nouă disponibilă!"
            maxLength={80}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-gray-400 font-sans"
          />
        </div>

        {/* Message */}
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Mesaj</p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Scrie mesajul complet..."
            rows={4}
            maxLength={500}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-gray-400 resize-none font-sans"
          />
          <p className="text-[10px] text-gray-300 mt-1 text-right">{message.length}/500</p>
        </div>

        {/* Preview */}
        {(title || message) && (
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Preview</p>
            <p className="text-sm font-semibold text-gray-900 font-sans">{title || '—'}</p>
            <p className="text-xs text-gray-500 font-sans mt-1">{message || '—'}</p>
          </div>
        )}

        <button
          onClick={send}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? (
            <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Se trimite...</>
          ) : (
            <><Send className="h-4 w-4" />Trimite notificare</>
          )}
        </button>
      </div>
    </div>
  )
}