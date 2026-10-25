'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ImageIcon, FileText, RefreshCw, ArrowUpRight, ArrowDownRight, BarChart2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

type MonthData = { images: number; texts: number; costUsd: number; costEur: number; imageCostUsd: number; textCostUsd: number }
type DailyBreakdown = { date: string; images: number; texts: number; costUsd: number; costEur: number }
type Transaction = { amount: number; reference_type: string; description: string; created_at: string; estimatedCostUsd: number }
type CostData = {
  totalImageGenerations: number; totalTextGenerations: number; totalCostUsd: number; totalCostEur: number
  totalImageCostUsd: number; totalTextCostUsd: number; totalCreditsUsed: number; month: MonthData
  lastMonth: { images: number; texts: number; costUsd: number }; costTrend: number; costPerCredit: number
  pricePerImage: number; pricePerText: number; usdToEur: number; dailyBreakdown: DailyBreakdown[]; transactions: Transaction[]
}

function MiniBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-20 shrink-0 font-sans">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className="h-full bg-gray-900 rounded-full" />
      </div>
      <span className="text-xs font-mono text-gray-700 w-8 text-right">{pct}%</span>
    </div>
  )
}

function DailyChart({ data }: { data: DailyBreakdown[] }) {
  const maxCost = Math.max(...data.map(d => d.costUsd), 0.01)
  return (
    <div className="flex items-end gap-0.5 h-16 w-full">
      {data.slice(-20).map((d, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end group relative">
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
            ${d.costUsd.toFixed(3)}
          </div>
          <div className="w-full rounded-t bg-gray-200 hover:bg-gray-900 transition-colors" style={{ height: `${Math.max((d.costUsd / maxCost) * 100, 2)}%` }} />
        </div>
      ))}
    </div>
  )
}

export default function AdminCostsPage() {
  const { t, intlLocale } = useT()
  const [costs, setCosts] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchCosts() }, [])

  const fetchCosts = async () => {
    setLoading(true)
    try { const res = await fetch('/api/admin/costs'); setCosts(await res.json()) }
    catch { } finally { setLoading(false) }
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />)}</div>
    </div>
  )

  if (!costs) return <p className="text-red-500 text-sm">{t('admin.load_error')}</p>

  const trendUp = costs.costTrend > 0
  const monthName = new Date().toLocaleDateString(intlLocale, { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6 font-mono">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('admin.nav_costs')}</h1>
          {/* i18n-ignore */}
          <p className="text-xs text-gray-400 mt-0.5 font-sans">OpenAI GPT-4o-mini + KIE Nano Banana Pro · {monthName}</p>
        </div>
        <button onClick={fetchCosts} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />{t('common.refresh')}
        </button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('admin.costs_month_cost'), value: `$${costs.month.costUsd.toFixed(2)}`, sub: `≈ ${costs.month.costEur.toFixed(2)}€`, icon: DollarSign, showTrend: true },
          { label: t('admin.costs_images_generated'), value: String(costs.month.images), sub: t('admin.costs_cost_value', { value: costs.month.imageCostUsd.toFixed(2) }), icon: ImageIcon, showTrend: false },
          { label: t('admin.stats_texts_generated'), value: String(costs.month.texts), sub: t('admin.costs_cost_value', { value: costs.month.textCostUsd.toFixed(4) }), icon: FileText, showTrend: false },
          { label: t('admin.stats_cost_per_credit'), value: `$${costs.costPerCredit.toFixed(4)}`, sub: t('admin.costs_credits_total', { count: costs.totalCreditsUsed }), icon: BarChart2, showTrend: false },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <card.icon className="h-4 w-4 text-gray-600" />
                </div>
                {card.showTrend && costs.costTrend !== 0 && (
                  <span className={`flex items-center text-[10px] font-medium ${trendUp ? 'text-gray-500' : 'text-gray-900'}`}>
                    {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(costs.costTrend).toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 font-sans">{card.label}</p>
              <p className="text-[10px] text-gray-300 mt-0.5 font-sans">{card.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50"><p className="text-[10px] text-gray-400 uppercase tracking-widest">{t('admin.costs_breakdown', { month: monthName })}</p></div>
            <div className="p-5 space-y-4">
              <MiniBar value={costs.month.imageCostUsd} max={costs.month.costUsd} label={t('admin.costs_kie_images')} />
              <MiniBar value={costs.month.textCostUsd} max={costs.month.costUsd} label={t('admin.costs_gpt_texts')} />
              <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-sans">{t('admin.costs_month_total')}</span>
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-900">${costs.month.costUsd.toFixed(2)}</span>
                  <span className="text-xs text-gray-400 ml-1.5 font-sans">≈ {costs.month.costEur.toFixed(2)}€</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50"><p className="text-[10px] text-gray-400 uppercase tracking-widest">{t('admin.costs_month_comparison')}</p></div>
            <div className="grid grid-cols-2 divide-x divide-gray-50">
              {[
                { title: t('admin.stats_current_month'), images: costs.month.images, texts: costs.month.texts, cost: costs.month.costUsd, active: true },
                { title: t('admin.costs_last_month'), images: costs.lastMonth.images, texts: costs.lastMonth.texts, cost: costs.lastMonth.costUsd, active: false },
              ].map(m => (
                <div key={m.title} className={`px-5 py-4 ${m.active ? '' : 'opacity-60'}`}>
                  <p className="text-[10px] uppercase tracking-widest mb-3 font-sans text-gray-400">{m.title}</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><span className="text-xs text-gray-500 font-sans">{t('admin.financial_images')}</span><span className="text-xs font-semibold text-gray-900">{m.images}</span></div>
                    <div className="flex items-center justify-between"><span className="text-xs text-gray-500 font-sans">{t('admin.financial_texts')}</span><span className="text-xs font-semibold text-gray-900">{m.texts}</span></div>
                    <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-sans">{t('admin.costs_total_cost')}</span>
                      <span className="text-sm font-bold text-gray-900">${m.cost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {costs.costTrend !== 0 && (
              <div className={`mx-5 mb-4 px-4 py-2.5 rounded-xl flex items-center gap-2 ${trendUp ? 'bg-gray-50' : 'bg-gray-900'}`}>
                {trendUp ? <TrendingUp className="h-3.5 w-3.5 text-gray-500" /> : <TrendingDown className="h-3.5 w-3.5 text-white" />}
                <span className={`text-xs font-sans ${trendUp ? 'text-gray-600' : 'text-white'}`}>{t('admin.costs_vs_last_month', { value: `${trendUp ? '+' : ''}${costs.costTrend.toFixed(1)}` })}</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {costs.dailyBreakdown.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">{t('admin.costs_daily')}</p>
              <span className="text-xs text-gray-400 font-sans">{t('admin.costs_active_days', { count: costs.dailyBreakdown.length })}</span>
            </div>
            <div className="px-5 py-4"><DailyChart data={costs.dailyBreakdown} /></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-t border-gray-50">{[t('admin.date'), t('admin.financial_images'), t('admin.financial_texts'), t('admin.costs_cost_usd'), t('admin.costs_cost_eur')].map(h => <th key={h} className="px-5 py-2.5 text-left text-[10px] text-gray-400 uppercase tracking-widest font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {costs.dailyBreakdown.slice(0, 10).map(day => (
                    <tr key={day.date} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-2.5 text-gray-600 font-sans">{new Date(day.date + 'T12:00:00').toLocaleDateString(intlLocale, { day: 'numeric', month: 'short' })}</td>
                      <td className="px-5 py-2.5 text-gray-500">{day.images}</td>
                      <td className="px-5 py-2.5 text-gray-500">{day.texts}</td>
                      <td className="px-5 py-2.5 font-semibold text-gray-900">${day.costUsd.toFixed(3)}</td>
                      <td className="px-5 py-2.5 text-gray-400">{day.costEur.toFixed(3)}€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50"><p className="text-[10px] text-gray-400 uppercase tracking-widest">{t('admin.api_price_reference')}</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-50">
            {[
              { name: 'OpenAI GPT-4o-mini', icon: FileText, rows: [[t('admin.costs_input'), t('admin.costs_per_million_tokens', { price: '0.15' })],[t('admin.costs_output'), t('admin.costs_per_million_tokens', { price: '0.60' })],[t('admin.costs_per_generation'),'~$0.004'],[t('admin.costs_avg_tokens'), t('admin.costs_avg_tokens_value')]] }, // i18n-ignore
              { name: 'KIE Nano Banana Pro', icon: ImageIcon, rows: [['1K / 2K', t('admin.costs_per_image', { price: '0.09' })],['4K', t('admin.costs_per_image', { price: '0.12' })],[t('admin.costs_google_direct'), t('admin.costs_per_image', { price: '0.134' })],[t('admin.costs_savings'), t('admin.costs_savings_value')]] }, // i18n-ignore
            ].map(api => (
              <div key={api.name} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3"><api.icon className="h-4 w-4 text-gray-400" /><span className="text-xs font-semibold text-gray-900">{api.name}</span></div>
                <div className="space-y-1.5">
                  {api.rows.map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400 font-sans">{label}</span>
                      <span className="text-[11px] text-gray-700">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}