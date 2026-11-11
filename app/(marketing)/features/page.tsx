'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion, type MotionProps } from 'framer-motion'
import {
  Sparkles, Check, ArrowDown,
  ImageIcon, TrendingUp, Bot, ShieldCheck,
  CheckCircle,
} from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

// ─── Content ──────────────────────────────────────────────────────────────────

const en = {
  heroBadge: 'Everything you need in one platform',
  heroH1a: 'The tools that turn an ordinary store into one that',
  heroH1b: 'grows',
  heroSub: 'Professional images, optimized texts, an agent that answers your customers and protection against problematic orders. All in one place, connected directly to your WooCommerce store.',
  heroPills: ['AI Images', 'SEO Optimizer', 'AI Agent', 'Risk Shield'],
  heroCta: 'Try for free',
  heroCtaAlt: 'Discover features',
  heroProof: 'Over 500 stores use Hontrio',
  heroRating: '4.9 / 5',

  ai1Pill: 'AI Image Generation',
  ai1H2: 'Studio images for every product, generated in seconds',
  ai1P: 'Upload any product photo and instantly get a professional version ready to publish. Six styles available for any sales channel, with automatic quality verification before delivery.',
  ai1Benefits: [
    'Multiple styles: white background, lifestyle, premium dark, industrial and more',
    'Automatic verification: shape, color, logo, no artifacts',
    'Direct publishing to your online store with a single click',
    'Compatible with marketplace technical requirements',
  ],
  ai1Cta: 'Try for free',
  ai1Styles: ['White BG', 'Lifestyle', 'Premium Dark', 'Industrial', 'Seasonal', 'Auto'],
  ai1BadgeV: 'Auto verified', ai1BadgeT: 'Generated in 8s',
  ai1Before: 'Before', ai1After: 'After',

  compH2: 'All features. One subscription.',
  compSub: 'You do not pay separately for each tool. Hontrio includes everything.',
  compHeaders: ['', 'Hontrio', 'Separate agencies', 'Freelancers'],
  compRows: [
    ['Professional AI images', true, 'At extra cost', 'Days of waiting'],
    ['Automatic SEO optimization', true, 'At extra cost', 'At extra cost'],
    ['24/7 chat agent', true, 'Separate tool', 'Impossible'],
    ['COD order protection', true, 'Does not exist', 'Does not exist'],
    ['WooCommerce sync', true, 'Manual', 'Manual'],
    ['Direct publish to store', true, 'Manual', 'Manual'],
    ['Centralized dashboard', true, 'Multiple tools', 'Does not exist'],
    ['Monthly price', 'Fixed plan', '500-2000+ RON', 'Variable'],
  ] as [string, boolean | string, string, string][],

  ctaH2: 'All the tools you need are already here.',
  ctaSub: 'Connect your store and let Hontrio work. You focus on the business, we handle the optimization.',
  ctaBtn: 'Create your free account',
  ctaNote: 'No credit card. First results appear from day one.',
  ctaLabels: ['AI Images', 'SEO', 'Agent', 'Risk Shield'],
}

const ro = {
  heroBadge: 'Tot ce ai nevoie intr-o singura platforma',
  heroH1a: 'Instrumentele care transforma un magazin obisnuit intr-unul care',
  heroH1b: 'creste',
  heroSub: 'Imagini profesionale, texte optimizate, un agent care raspunde clientilor si protectie impotriva comenzilor problematice. Totul intr-un singur loc, conectat direct la magazinul tau WooCommerce.',
  heroPills: ['AI Images', 'SEO Optimizer', 'AI Agent', 'Risk Shield'],
  heroCta: 'Incearca gratuit',
  heroCtaAlt: 'Descopera functiile',
  heroProof: 'Peste 500 de magazine folosesc Hontrio',
  heroRating: '4.9 / 5',

  ai1Pill: 'AI Image Generation',
  ai1H2: 'Imagini de studio pentru fiecare produs, generate in secunde',
  ai1P: 'Incarca orice fotografie a produsului si obtii instant o varianta profesionala gata de publicat. Sase stiluri disponibile pentru orice canal de vanzare, cu verificare automata a calitatii inainte de livrare.',
  ai1Benefits: [
    'Diferite stiluri: fundal alb, lifestyle, premium dark, industrial si altele',
    'Verificare automata: forma, culoare, logo, fara artefacte',
    'Publicare directa in magazinul tau online cu un singur click',
    'Compatibil cu cerintele tehnice ale marketplace-urilor',
  ],
  ai1Cta: 'Incearca gratuit',
  ai1Styles: ['Fundal Alb', 'Lifestyle', 'Premium Dark', 'Industrial', 'Seasonal', 'Auto'],
  ai1BadgeV: 'Verificat automat', ai1BadgeT: 'Generat in 8s',
  ai1Before: 'Inainte', ai1After: 'Dupa',

  compH2: 'Toate functiile. Un singur abonament.',
  compSub: 'Nu platesti separat pentru fiecare unealta. Hontrio include totul.',
  compHeaders: ['', 'Hontrio', 'Agentii separate', 'Freelanceri'],
  compRows: [
    ['Imagini AI profesionale', true, 'Contra cost', 'Zile de asteptare'],
    ['Optimizare SEO automata', true, 'Contra cost', 'Contra cost'],
    ['Agent de chat 24/7', true, 'Tool separat', 'Imposibil'],
    ['Protectie comenzi COD', true, 'Nu exista', 'Nu exista'],
    ['Sincronizare WooCommerce', true, 'Manual', 'Manual'],
    ['Publicare directa in magazin', true, 'Manual', 'Manual'],
    ['Dashboard centralizat', true, 'Multiple tool-uri', 'Nu exista'],
    ['Pret lunar', 'Abonament fix', '500-2000+ RON', 'Variabil'],
  ] as [string, boolean | string, string, string][],

  ctaH2: 'Toate instrumentele de care ai nevoie sunt deja aici.',
  ctaSub: 'Conecteaza magazinul tau si lasa Hontrio sa lucreze. Tu te ocupi de business, noi ne ocupam de optimizare.',
  ctaBtn: 'Creeaza-ti contul gratuit',
  ctaNote: 'Fara card de credit. Primele rezultate apar din prima zi.',
  ctaLabels: ['AI Images', 'SEO', 'Agent', 'Risk Shield'],
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

// ─── Before / After Slider ────────────────────────────────────────────────────

function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const move = useCallback((clientX: number) => {
    const el = containerRef.current; if (!el) return
    const { left, width } = el.getBoundingClientRect()
    setPos(Math.min(100, Math.max(0, ((clientX - left) / width) * 100)))
  }, [])

  useEffect(() => {
    const up = () => { dragging.current = false }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden cursor-ew-resize select-none"
      onMouseDown={() => { dragging.current = true }}
      onMouseMove={e => { if (dragging.current) move(e.clientX) }}
      onTouchMove={e => move(e.touches[0].clientX)}
      onTouchStart={e => move(e.touches[0].clientX)}
    >
      <img src="/After.jpeg" alt="After" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${pos}%` }}
      >
        <img src="/Before.jpg" alt="Before" className="absolute inset-0 h-full object-cover" style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }} draggable={false} />
      </div>
      <div className="absolute inset-y-0 z-10 flex items-center" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/80" />
        <div className="w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-auto relative z-10">
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-neutral-600" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 3l-3 5 3 5M11 3l3 5-3 5" />
          </svg>
        </div>
      </div>
      <span className="absolute top-3 left-3 px-2 py-1 text-[11px] font-semibold bg-white/90 text-neutral-700 rounded-lg">{before}</span>
      <span className="absolute top-3 right-3 px-2 py-1 text-[11px] font-semibold bg-neutral-900/80 text-white rounded-lg">{after}</span>
    </div>
  )
}

// ─── Feature Text Column ──────────────────────────────────────────────────────

function FeatureText({
  num, pill, PillIcon, h2, p, benefits, cta, slideFrom, skip,
}: {
  num: string; pill: string; PillIcon: React.ElementType; h2: string; p: string
  benefits: string[]; cta: string
  slideFrom: 'left' | 'right'; skip: boolean
}) {
  const x = slideFrom === 'left' ? -40 : 40
  const E = [0.4, 0, 0.2, 1] as [number, number, number, number]
  const anim: MotionProps = skip ? {} : { initial: { opacity: 0, x }, whileInView: { opacity: 1, x: 0 }, viewport: { once: true, amount: 0.15 }, transition: { duration: 0.6, ease: E } }

  return (
    <motion.div {...anim} className="flex flex-col justify-center">
      <div className="mb-6">
        <p className="text-[64px] font-black text-neutral-900/[0.06] leading-none select-none pointer-events-none mb-3">
          {num}
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-[12px] font-semibold text-neutral-600">
          <PillIcon className="h-3.5 w-3.5" />
          {pill}
        </div>
      </div>

      <h2 className="text-[2rem] sm:text-[2.2rem] font-extrabold text-neutral-900 tracking-tight leading-[1.15] mb-4">
        {h2}
      </h2>
      <p className="text-[16px] text-neutral-500 leading-[1.7] mb-6">{p}</p>

      <ul className="space-y-3 mb-8">
        {benefits.map((b, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Check className="h-4 w-4 text-neutral-900 shrink-0 mt-0.5" />
            <span className="text-[14px] text-neutral-600">{b}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/register"
          className="inline-flex items-center px-5 py-2.5 rounded-[10px] bg-neutral-900 text-white text-[13.5px] font-semibold hover:bg-neutral-800 active:scale-[0.97] transition-all"
        >
          {cta}
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeaturesPage() {
  const { locale } = useLocale()
  const t = locale === 'ro' ? ro : en
  const shouldReduce = useReducedMotion() ?? false

  const E = [0.4, 0, 0.2, 1] as [number, number, number, number]
  const fadeUp = (delay = 0): MotionProps => shouldReduce ? {} : {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: E, delay },
  }

  const scrollToFeatures = () => {
    document.getElementById('features-start')?.scrollIntoView({ behavior: 'smooth' })
  }

  const pillIcons = [ImageIcon, TrendingUp, Bot, ShieldCheck]

  return (
    <div className="bg-white">

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        {/* Background texture */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage: 'radial-gradient(ellipse 70% 50% at 75% 0%, rgba(0,0,0,0.04) 0%, transparent 70%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="max-w-[800px] mx-auto text-center">
          {/* Badge */}
          <motion.div {...fadeUp(0)} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-900/[0.06] border border-neutral-900/[0.12] text-[12px] font-semibold text-neutral-600 mb-7">
            <motion.div
              animate={shouldReduce ? {} : { scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </motion.div>
            {t.heroBadge}
          </motion.div>

          {/* H1 */}
          <motion.h1
            {...fadeUp(0.1)}
            className="font-extrabold text-neutral-900 tracking-tight leading-[1.1] mb-6"
            style={{ fontSize: 'clamp(32px, 5.5vw, 56px)' }}
          >
            {t.heroH1a}{' '}{t.heroH1b}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            {...fadeUp(0.2)}
            className="text-[17px] text-neutral-500 leading-[1.7] max-w-[640px] mx-auto mb-9"
          >
            {t.heroSub}
          </motion.p>

          {/* CTAs */}
          <motion.div {...fadeUp(0.3)} className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-neutral-900 text-white text-[15px] font-semibold hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.18)] w-full sm:w-auto"
            >
              {t.heroCta}
            </Link>
            <button
              onClick={scrollToFeatures}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[15px] font-semibold text-neutral-600 border border-neutral-200 bg-white/60 hover:bg-white hover:border-neutral-300 transition-all w-full sm:w-auto"
            >
              {t.heroCtaAlt}
              <motion.div
                animate={shouldReduce ? {} : { y: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ArrowDown className="h-4 w-4" />
              </motion.div>
            </button>
          </motion.div>

        </div>
      </section>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <div id="features-start" />

      {/* Feature 1 - AIImages (text left, visual right) */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <FeatureText
            num="01" pill={t.ai1Pill} PillIcon={ImageIcon}
            h2={t.ai1H2} p={t.ai1P} benefits={t.ai1Benefits}
            cta={t.ai1Cta}
            slideFrom="left" skip={shouldReduce}
          />

          <motion.div
            {...(shouldReduce ? {} : { initial: { opacity: 0, x: 40 }, whileInView: { opacity: 1, x: 0 }, viewport: { once: true, amount: 0.15 }, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as [number, number, number, number], delay: 0.2 } })}
            className="relative"
          >
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-5 space-y-4">
              <BeforeAfterSlider before={t.ai1Before} after={t.ai1After} />

              {/* Style pills */}
              <div className="flex flex-wrap gap-1.5">
                {t.ai1Styles.map((s, i) => (
                  <span
                    key={s}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full ${i === 0 ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-500'}`}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <motion.div
            {...(shouldReduce ? {} : { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.15 }, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } })}
            className="text-center mb-12"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-4">{t.compH2}</h2>
            <p className="text-xl text-neutral-500">{t.compSub}</p>
          </motion.div>

          <div className="rounded-2xl border border-neutral-200 overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
            {/* Header */}
            <div className="grid grid-cols-4 border-b border-neutral-200">
              {t.compHeaders.map((h, i) => (
                <div
                  key={i}
                  className={`px-4 py-3.5 text-[11px] font-bold uppercase tracking-widest ${
                    i === 1
                      ? 'bg-neutral-900/[0.05] text-neutral-900 border-t-2 border-t-neutral-900'
                      : 'text-neutral-400'
                  } ${i === 0 ? '' : 'text-center'}`}
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {t.compRows.map(([label, hontrio, agency, freelancer], ri) => (
              <motion.div
                key={ri}
                {...(shouldReduce ? {} : { initial: { opacity: 0, y: 10 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.1 }, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number], delay: ri * 0.06 } })}
                className={`grid grid-cols-4 border-b border-neutral-100 last:border-0 ${ri % 2 === 1 ? 'bg-neutral-50/60' : 'bg-white'}`}
              >
                <div className="px-4 py-3.5 text-[13.5px] text-neutral-700 font-medium">{label}</div>
                <div className="px-4 py-3.5 flex items-center justify-center bg-neutral-900/[0.03]">
                  {hontrio === true
                    ? <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
                    : <span className="text-[13px] font-semibold text-neutral-700">{hontrio}</span>
                  }
                </div>
                <div className="px-4 py-3.5 text-[13px] text-neutral-400 italic text-center">{agency}</div>
                <div className="px-4 py-3.5 text-[13px] text-neutral-400 italic text-center">{freelancer}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-950">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            {...(shouldReduce ? {} : { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.15 }, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } })}
            className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-5"
          >
            {t.ctaH2}
          </motion.h2>

          <motion.p
            {...(shouldReduce ? {} : { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.15 }, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as [number, number, number, number], delay: 0.1 } })}
            className="text-xl text-neutral-400 mb-10 leading-relaxed"
          >
            {t.ctaSub}
          </motion.p>

          {/* Icons row */}
          <motion.div
            {...(shouldReduce ? {} : { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true, amount: 0.15 }, transition: { duration: 0.5, delay: 0.3 } })}
            className="flex items-center justify-center gap-8 mb-10"
          >
            {[ImageIcon, TrendingUp, Bot, ShieldCheck].map((Icon, i) => (
              <motion.div
                key={i}
                {...(shouldReduce ? {} : { initial: { opacity: 0, scale: 0.8 }, whileInView: { opacity: 1, scale: 1 }, viewport: { once: true, amount: 0.15 }, transition: { duration: 0.4, delay: 0.3 + i * 0.08 } })}
                className="flex flex-col items-center gap-1.5"
              >
                <Icon className="h-6 w-6 text-white/60" />
                <span className="text-[11px] text-white/40">{t.ctaLabels[i]}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            {...(shouldReduce ? {} : { initial: { opacity: 0, scale: 0.92 }, whileInView: { opacity: 1, scale: 1 }, viewport: { once: true, amount: 0.15 }, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number], delay: 0.4 } })}
          >
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white text-neutral-900 text-base font-semibold hover:bg-neutral-100 hover:scale-[1.03] transition-all duration-200 shadow-[0_2px_20px_rgba(255,255,255,0.12)]"
            >
              {t.ctaBtn}
            </Link>
            <p className="mt-4 text-[13px] text-white/40">{t.ctaNote}</p>
          </motion.div>
        </div>
      </section>

    </div>
  )
}
