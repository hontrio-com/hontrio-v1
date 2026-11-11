'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { CalendarDays, History, Inbox, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { storedMessage } from '@/lib/i18n/stored'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { EmptyState } from '@/components/app/feedback'
import { useFormats } from '@/components/app/formats'
import { timeAgoAt } from '@/components/app/time'
import { JOURNAL_ROW, JournalEntry, PROPOSAL_ROW, ProposalItem } from '@/components/campaigns/journal'
import type { ActionItem } from '@/components/campaigns/types'
import { AppWindow } from './app-window'
import { SectionHeader } from './section'

// =============================================
// De ce Hontrio: o săptămână din jurnalul pilotului, pe un magazin
// demonstrativ cu pilotul în modul automat. Jurnalul și propunerile sunt
// piesele din aplicație (components/campaigns/journal), cu textele ei; zilele
// trec singure cât secțiunea e pe ecran (o dată, de luni până duminică), iar
// deasupra ferestrei o propoziție spune pe înțeles ce s-a întâmplat în ziua
// aceea. Vineri, propunerea de buget se aprobă sau se respinge chiar aici.
//
// Fiecare zi urmează regulile reale ale pilotului (lib/ads/optimizer.ts),
// cu o comandă medie de 180 RON:
//   luni      — două căutări au costat fiecare peste o comandă medie, fără vânzări → negative
//   marți     — campania unei grupe a cheltuit o comandă medie fără vânzări → oprirea de siguranță
//   miercuri  — nimic de schimbat
//   joi       — după 21 de zile: un produs a cheltuit peste prețul lui fără vânzări,
//               altul are ROAS sub 1 → scoase din campanii
//   vineri    — campania își termină bugetul și are ROAS 4,2 → +20%, doar propus
//   sâmbătă   — răspunsul omului ajunge în jurnal
//   duminică  — 15 conversii în 30 de zile → Performance Max, cu bugetul de atunci
// =============================================

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const LAST = DAYS.length - 1
type Decision = 'approve' | 'reject'

/** Cât stă fiecare zi pe ecran când zilele trec singure; vinerea mai mult, e de ales. */
const DWELL_MS = [6500, 6000, 5000, 7000, 9000, 5500, 0]

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** Pilotul trece pe la magazin o dată pe zi, dimineața. Asta e trecerea de luni (06:15, ora României). */
const FIRST_RUN = Date.parse('2026-11-02T04:15:00Z')
const runOf = (d: number) => new Date(FIRST_RUN + d * DAY).toISOString()
/** Omul se uită în aplicație în ziua `d`, la trei ore după trecerea pilotului. */
const nowOf = (d: number) => FIRST_RUN + d * DAY + 3 * HOUR

/** Comanda medie a magazinului: măsura căutărilor fără vânzări și a opririi de siguranță. */
const AOV = 180
const BUDGET = { from: 40, to: 48, roas: 4.2 }
const SPEND = { terms: 401, outdoor: 186, sconce: 152, products: 248 }
const CONVERSIONS = 15

type Campaign = 'main' | 'outdoor' | null
type Entry = ActionItem & { day: number; campaign: Campaign }

function entry(id: string, day: number, kind: string, campaign: Campaign, params: Record<string, unknown>, reason: string, status: ActionItem['status'] = 'applied'): Entry {
  return { id, day, kind, campaign, ad_campaign_id: campaign, params, reason, status, source: 'autopilot', error: null, created_at: runOf(day) }
}

/** Ce vezi în aplicație în ziua `d`: jurnalul (cel mai nou sus) și propunerile care te așteaptă. */
function weekAt(d: number, decision: Decision) {
  const budget = entry('budget', 4, 'set_budget', 'main', { from: BUDGET.from, to: BUDGET.to },
    storedMessage('campaigns.reason_budget_limited', { actual: BUDGET.roas, from: BUDGET.from, to: BUDGET.to }), 'proposed')
  const all: Entry[] = [
    entry('negatives', 0, 'add_negatives', 'main', {}, storedMessage('campaigns.reason_negatives', { count: 2, spend: SPEND.terms })),
    entry('pause', 1, 'pause_loss_limit', 'outdoor', { spend: SPEND.outdoor, conversions: 0, roas: null },
      storedMessage('campaigns.reason_loss_no_conversions', { spend: SPEND.outdoor, limit: AOV })),
    entry('products', 3, 'exclude_products', null, {}, storedMessage('campaigns.reason_exclude_products', { count: 2, spend: SPEND.products })),
    // Propunerea intră în jurnal după răspuns, cu ora la care a făcut-o pilotul
    ...(d > budget.day ? [{ ...budget, status: decision === 'approve' ? 'applied' as const : 'rejected' as const }] : []),
    entry('graduate', 6, 'graduate', 'main', { daily_budget: decision === 'approve' ? BUDGET.to : BUDGET.from },
      storedMessage('campaigns.reason_graduate', { conversions: CONVERSIONS })),
  ]
  return {
    journal: all.filter(a => a.day <= d).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    proposals: d === budget.day ? [budget] : [],
  }
}

export function Why() {
  const { t } = useT()
  return (
    <section id="why" className="scroll-mt-24 px-5 py-24 md:py-32">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader badge={t('site.why_badge')} icon={<CalendarDays />} titleA={t('site.why_title_a')} titleB={t('site.why_title_b')} desc={t('site.why_desc')} />
        <Week />
      </div>
    </section>
  )
}

function Week() {
  const { t } = useT()
  const reduce = useReducedMotion()
  const box = useRef<HTMLDivElement>(null)
  const inView = useInView(box, { amount: 0.3 })
  const [day, setDay] = useState(0)
  /** Zilele trec singure până alege omul una. */
  const [auto, setAuto] = useState(true)
  const [decision, setDecision] = useState<Decision>('approve')
  // Cu „reduce motion", zilele nu trec singure: se vede toată săptămâna, până alege omul o zi
  const shown = reduce && auto ? LAST : day
  const playing = auto && !reduce && inView && day < LAST

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setDay(d => Math.min(LAST, d + 1)), DWELL_MS[day])
    return () => clearTimeout(timer)
  }, [playing, day])

  const pick = (d: number) => { setAuto(false); setDay(d) }
  // Răspunsul de vineri se vede sâmbătă în jurnal, apoi săptămâna merge mai departe
  const decide = (d: Decision) => { setDecision(d); setDay(5); setAuto(!reduce) }

  return (
    <div ref={box} className="mt-12 md:mt-14">
      <DayPicker shown={shown} playing={playing} onPick={pick} />
      <Caption shown={shown} decision={decision} />
      <AppWindow path="campaigns?tab=pilot" className="mx-auto mt-6 max-w-[1000px]">
        <div className="grid p-3 sm:p-6">
          {/* Pe calculator, săptămâna întreagă ține locul (nevăzută), ca fereastra să nu-și schimbe înălțimea de la o zi la alta */}
          <div aria-hidden inert className="invisible hidden [grid-area:1/1] lg:block"><Screen d={LAST} decision="approve" /></div>
          <div className="[grid-area:1/1]"><Screen d={shown} decision={decision} live onDecide={decide} /></div>
        </div>
      </AppWindow>
      <p className="mt-4 text-center text-[12.5px] text-neutral-400">{t('site.why_note')}</p>
    </div>
  )
}

/** Zilele săptămânii; cea de pe ecran poartă o linie care arată cât mai stă. */
function DayPicker({ shown, playing, onPick }: { shown: number; playing: boolean; onPick: (d: number) => void }) {
  const { t } = useT()
  return (
    <div role="group" aria-label={t('site.why_days')} className="mx-auto flex w-fit max-w-full rounded-full bg-neutral-100 p-1">
      {DAYS.map((id, i) => {
        const on = i === shown
        return (
          <button key={id} type="button" aria-pressed={on} onClick={() => onPick(i)}
            className={cn('relative rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-4', on ? 'text-black' : 'text-neutral-500 hover:text-black')}>
            {on && <motion.span layoutId="why-day" className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative sm:hidden">{t(`site.why_day_${id}_short`)}</span>
            <span className="relative hidden sm:inline">{t(`site.why_day_${id}`)}</span>
            {on && playing && (
              <motion.span key={i} aria-hidden className="absolute inset-x-3 bottom-[3px] h-[2px] origin-left rounded-full bg-neutral-900/70"
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: DWELL_MS[i] / 1000, ease: 'linear' }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Ce s-a întâmplat în ziua de pe ecran, pe înțeles. */
function Caption({ shown, decision }: { shown: number; decision: Decision }) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const f = useFormats('RON')
  const money = (n: number) => f.money.format(n)
  const text = (() => {
    switch (DAYS[shown]) {
      case 'mon': return t('site.why_text_mon', { spend: money(SPEND.terms) })
      case 'tue': return t('site.why_text_tue', { spend: money(SPEND.outdoor) })
      case 'wed': return t('site.why_text_wed')
      case 'thu': return t('site.why_text_thu', { spend: money(SPEND.sconce) })
      case 'fri': return t('site.why_text_fri', { roas: f.num.format(BUDGET.roas), from: money(BUDGET.from), to: money(BUDGET.to) })
      case 'sat': return decision === 'approve' ? t('site.why_text_sat_approve') : t('site.why_text_sat_reject', { from: money(BUDGET.from) })
      default: return t('site.why_text_sun', { n: f.int.format(CONVERSIONS) })
    }
  })()
  return (
    <div className="mx-auto mt-6 min-h-[124px] max-w-2xl text-center sm:min-h-[84px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={`${shown}-${decision}`} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }} className="text-pretty text-[15.5px] leading-relaxed text-neutral-600 sm:text-[16.5px]">
          <span className="font-semibold text-neutral-950">{t(`site.why_day_${DAYS[shown]}`)}.</span> {text}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

/**
 * Pagina Pilot din aplicație în ziua `d`: jurnalul și, alături, ce așteaptă răspunsul tău.
 * Pe telefon, propunerile stau deasupra jurnalului și apar doar cât e una.
 */
function Screen({ d, decision, live = false, onDecide }: { d: number; decision: Decision; live?: boolean; onDecide?: (d: Decision) => void }) {
  const { t, intlLocale } = useT()
  const reduce = useReducedMotion()
  const f = useFormats('RON')
  const { journal, proposals } = weekAt(d, decision)
  const relative = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' })
  const ago = (iso: string) => timeAgoAt(relative, iso, nowOf(d))
  // Sunt două campanii (cea principală și a grupei), deci fiecare rând spune la care se referă, ca în aplicație
  const label = (c: Campaign) => (c === 'main' ? t('campaigns.kind_starter') : c === 'outdoor' ? t('site.why_group') : null)
  const animate = live && !reduce
  const ease = [0.22, 1, 0.36, 1] as const

  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="min-w-0">
        <CardHeader icon={<History />} title={t('campaigns.journal_title')} description={t('campaigns.journal_hint')} />
        <div className="px-5 pb-5 pt-5">
          <ol>
            <AnimatePresence initial={false}>
              {journal.map((a, i) => (
                <motion.li key={a.id} layout={animate ? 'position' : false} className={JOURNAL_ROW}
                  initial={animate ? { opacity: 0, y: -10 } : false} animate={{ opacity: 1, y: 0 }}
                  exit={animate ? { opacity: 0, transition: { duration: 0.15 } } : undefined} transition={{ duration: 0.45, ease }}>
                  <JournalEntry a={a} label={label(a.campaign)} time={ago(a.created_at)} f={f} last={i === journal.length - 1} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </div>
      </Card>

      <Card className={cn('order-first lg:order-none', proposals.length === 0 && 'hidden lg:block')}>
        <CardHeader icon={<Sparkles />} title={t('campaigns.proposals_heading')} description={t('campaigns.proposals_hint_auto')}
          action={proposals.length > 0 ? <Badge tone="brand">{proposals.length}</Badge> : undefined} />
        <div className="px-5 pb-5 pt-4">
          <AnimatePresence mode="wait" initial={false}>
            {proposals.length === 0 ? (
              <motion.div key="none" initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }} exit={animate ? { opacity: 0 } : undefined} transition={{ duration: 0.25 }}>
                <EmptyState icon={<Inbox />} title={t('campaigns.proposals_none_title')} description={t('campaigns.proposals_empty')} className="py-10" />
              </motion.div>
            ) : (
              <motion.ul key="list" className="space-y-3" initial={animate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }}
                exit={animate ? { opacity: 0 } : undefined} transition={{ duration: 0.35, ease }}>
                {proposals.map(a => (
                  <li key={a.id} className={PROPOSAL_ROW}>
                    <ProposalItem a={a} label={label(a.campaign)} time={ago(a.created_at)} f={f} onDecide={dec => onDecide?.(dec)} />
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  )
}
