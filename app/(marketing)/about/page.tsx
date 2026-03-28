'use client'

import Link from 'next/link'
import { motion, useReducedMotion, type MotionProps } from 'framer-motion'
import {
  Building2, Lightbulb, Code2, Plug, TrendingUp,
  Target, Puzzle, ShieldCheck, RefreshCw,
  CheckCircle, X, ArrowRight,
} from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

// ─── Content ──────────────────────────────────────────────────────────────────

const en = {
  heroBadge: 'About Hontrio',
  heroH1: 'We build the tools that turn online stores into businesses that',
  heroWord: 'grow.',
  heroSub: 'Hontrio emerged from a real frustration: online store owners were losing time and money because of poor images, generic texts and undelivered orders. We built the platform we wished existed ourselves.',

  storyTag: 'Our story',
  storyH2: 'Why Hontrio exists',
  storyP1: 'The eCommerce market is growing rapidly worldwide. Thousands of entrepreneurs open online stores every year, but most face the same universal problems: unprofessional photos, descriptions copied from suppliers, orders refused at delivery and customers nobody can answer outside business hours.',
  storyP2: 'Existing solutions on the market are either too expensive and aimed at large players, or too fragmented and difficult to integrate. An online store owner needs one tool for image generation, another for SEO, another for customer support and another for risk management. Four subscriptions, four interfaces, zero coherence.',
  storyP3: 'Hontrio brings all these needs together into a single platform connected directly to your store. No CSV exports, no copy-paste, no tabs open in parallel. One place from which your store looks professional, appears on Google, answers customers and protects its profit.',

  timelineItems: [
    { title: 'Problem identified', text: 'Store owners lose an average of 6-8 hours per week on tasks that can be automated.' },
    { title: 'Platform built', text: 'Hontrio integrates AI Image Generation, SEO Optimizer, AI Agent and Risk Shield into one coherent product.' },
    { title: 'Direct connection', text: 'Real-time synchronization with your e-commerce platform. Any new product appears in Hontrio automatically.' },
    { title: 'Measurable results', text: 'From professional images to protected orders, every feature produces a direct and measurable impact.' },
  ],

  missionLabel: 'OUR MISSION',
  missionH3: 'What we aim for today',
  missionText: 'To offer any online store owner, regardless of business size or technical experience, access to artificial intelligence tools that were until now reserved only for companies with large budgets. Hontrio democratizes access to professional product optimization, automated customer support and protection against operational losses.',

  visionLabel: 'OUR VISION',
  visionH3: 'What we are building long-term',
  visionText: 'An end-to-end growth platform for independent e-commerce. A system where every action in your store (adding a product, placing an order, a customer interaction) automatically triggers the right optimization processes. Without your manual intervention. Without technical knowledge required.',

  valuesH2: 'The principles we build by',
  valuesSub: 'Every product decision and every new feature passes through these four filters.',
  values: [
    { icon: <Target className="h-5 w-5" />, title: 'Measurable impact', text: 'We do not build features to tick a list. Every tool in Hontrio must produce a direct and quantifiable effect: more traffic, fewer uncollected parcels, more time saved. If we cannot measure the impact, we do not include it.' },
    { icon: <Puzzle className="h-5 w-5" />, title: 'Simplicity without compromise', text: 'Complex technology does not have to be complicated for the user. Hontrio hides all the technical complexity (AI models, semantic vectors, scoring algorithms) and exposes only what matters: the result. One click, one professional image. One webhook, one analysed order.' },
    { icon: <ShieldCheck className="h-5 w-5" />, title: 'Full transparency', text: 'You always know what Hontrio does with your data and why. Risk scores are explained signal by signal. Credit costs are shown before any action. There are no hidden processes or opaque decisions.' },
    { icon: <RefreshCw className="h-5 w-5" />, title: 'Continuous improvement', text: 'The platform learns from every interaction. Risk algorithms are calibrated from real order behaviour. The chat agent becomes more precise as the catalogue grows. Hontrio is not a static product but a system that improves alongside your business.' },
  ],

  compH2: 'Hontrio vs. existing alternatives',
  compSub: 'We are not a collection of separate tools. We are an integrated platform built around a single purpose: growing your online business.',
  col1Title: 'Separate tools',
  col2Title: 'Hontrio',
  col3Title: 'Agencies & freelancers',
  col2Badge: 'Recommended',
  col1Items: ['Multiple subscriptions, unclear costs', 'Disparate data, no connection between them', 'Manual integrations with your platform', 'Fragmented support across multiple vendors', 'Knows nothing about your store'],
  col2Items: ['One subscription, all features included', 'Unified data, full context per product', 'Direct and automatic synchronization', 'One point of contact for support', 'Learns your catalogue and adapts'],
  col3Items: ['High costs, long delivery time', 'Dependency on an external person', 'Impossible to scale quickly', 'No automation or continuous learning', 'Inconsistent results over time'],

  statsH2: 'Hontrio in numbers',
  statsSub: 'A platform built with attention to every technical detail.',
  stats: [
    { value: '4', label: 'AI modules integrated into a single platform' },
    { value: '20+', label: 'signals analysed per order by Risk Shield' },
    { value: '6', label: 'professional image styles generated from a single photo' },
    { value: '1', label: 'line of code to install the chat agent in your store' },
  ],

  ctaH2: 'Ready to grow your online business?',
  ctaSub: 'Connect your store and discover how much time you can save starting today.',
  ctaBtn: 'Try for free',
  ctaBtn2: 'Contact us',
  ctaNote: 'No credit card. No commitment.',
}

const ro: typeof en = {
  heroBadge: 'Despre Hontrio',
  heroH1: 'Construim instrumentele care transforma magazinele online in afaceri care',
  heroWord: 'cresc.',
  heroSub: 'Hontrio a aparut dintr-o frustrare reala: proprietarii de magazine online pierdeau timp si bani din cauza imaginilor slabe, textelor generice si comenzilor neridicate. Am construit platforma pe care ne-am fi dorit-o noi insine.',

  storyTag: 'Povestea noastra',
  storyH2: 'De ce exista Hontrio',
  storyP1: 'Piata de eCommerce creste rapid la nivel global. Mii de antreprenori deschid magazine online in fiecare an, insa majoritatea se confrunta cu aceleasi probleme universale: fotografii neprofesionale, descrieri copiate de la furnizori, comenzi refuzate la livrare si clienti carora nu le poate raspunde nimeni in afara orelor de program.',
  storyP2: 'Solutiile existente pe piata sunt fie prea scumpe si destinate marilor jucatori, fie prea fragmentate si greu de integrat. Un proprietar de magazin online are nevoie de un instrument de generare imagini, altul de SEO, altul pentru suport clienti si altul pentru gestionarea riscului. Patru abonamente, patru interfete, zero coerenta.',
  storyP3: 'Hontrio reuneste toate aceste nevoi intr-o singura platforma conectata direct la magazinul tau. Fara export CSV, fara copy-paste, fara tab-uri deschise in paralel. Un singur loc din care magazinul tau arata profesional, apare pe Google, raspunde clientilor si isi protejeaza profitul.',

  timelineItems: [
    { title: 'Problema identificata', text: 'Proprietarii de magazine pierd in medie 6-8 ore saptamanal pe sarcini care pot fi automatizate.' },
    { title: 'Platforma construita', text: 'Hontrio integreaza AI Image Generation, SEO Optimizer, AI Agent si Risk Shield intr-un singur produs coerent.' },
    { title: 'Conectare directa', text: 'Sincronizare in timp real cu platforma ta de comert electronic. Orice produs nou apare automat in Hontrio.' },
    { title: 'Rezultate masurabile', text: 'De la imagini profesionale la comenzi protejate, fiecare functie produce un impact direct si masurabil.' },
  ],

  missionLabel: 'MISIUNEA NOASTRA',
  missionH3: 'Ce ne propunem astazi',
  missionText: 'Sa oferim oricarui proprietar de magazin online, indiferent de dimensiunea afacerii sau de experienta tehnica, accesul la instrumente de inteligenta artificiala care pana acum erau rezervate doar companiilor cu bugete mari. Hontrio democratizeaza accesul la optimizarea profesionala a produselor, la suportul automatizat pentru clienti si la protectia impotriva pierderilor operationale.',

  visionLabel: 'VIZIUNEA NOASTRA',
  visionH3: 'Ce construim pe termen lung',
  visionText: 'O platforma de crestere end-to-end pentru comertul electronic independent. Un sistem in care fiecare actiune din magazinul tau (adaugarea unui produs, plasarea unei comenzi, interactiunea unui client) declanseaza automat procesele de optimizare potrivite. Fara interventia ta manuala. Fara cunostinte tehnice necesare.',

  valuesH2: 'Principiile dupa care construim',
  valuesSub: 'Fiecare decizie de produs si fiecare functionalitate noua trece prin aceste patru filtre.',
  values: [
    { icon: <Target className="h-5 w-5" />, title: 'Impact masurabil', text: 'Nu construim functionalitati pentru a bifa o lista. Fiecare instrument din Hontrio trebuie sa produca un efect direct si cuantificabil: mai mult trafic, mai putine colete neridicate, mai mult timp economisit. Daca nu putem masura impactul, nu il includem.' },
    { icon: <Puzzle className="h-5 w-5" />, title: 'Simplitate fara compromisuri', text: 'Tehnologia complexa nu trebuie sa fie complicata pentru utilizator. Hontrio ascunde toata complexitatea tehnica si expune doar ceea ce conteaza: rezultatul. Un click, o imagine profesionala. Un webhook, o comanda analizata.' },
    { icon: <ShieldCheck className="h-5 w-5" />, title: 'Transparenta totala', text: 'Stii intotdeauna ce face Hontrio cu datele tale si de ce. Scorurile de risc sunt explicate semnal cu semnal. Costurile in credite sunt afisate inainte de orice actiune. Nu exista procese ascunse sau decizii opace.' },
    { icon: <RefreshCw className="h-5 w-5" />, title: 'Imbunatatire continua', text: 'Platforma invata din fiecare interactiune. Algoritmii de risc se calibreaza din comportamentul real al comenzilor. Agentul de chat devine mai precis pe masura ce catalogul creste. Hontrio nu este un produs static, ci un sistem care se imbunatateste odata cu afacerea ta.' },
  ],

  compH2: 'Hontrio fata de alternativele existente',
  compSub: 'Nu suntem o colectie de tool-uri separate. Suntem o platforma integrata construita in jurul unui singur scop: cresterea afacerii tale online.',
  col1Title: 'Tool-uri separate',
  col2Title: 'Hontrio',
  col3Title: 'Agentii si freelanceri',
  col2Badge: 'Recomandat',
  col1Items: ['Abonamente multiple, costuri neclare', 'Date disparate, fara conexiune intre ele', 'Integrari manuale cu platforma ta', 'Suport fragmentat pe mai multi furnizori', 'Nu stie nimic despre magazinul tau'],
  col2Items: ['Un singur abonament, toate functiile incluse', 'Date unificate, context complet per produs', 'Sincronizare directa si automata', 'Un singur punct de contact pentru suport', 'Invata catalogul tau si se adapteaza'],
  col3Items: ['Costuri ridicate, timp lung de livrare', 'Dependenta de o persoana externa', 'Imposibil de scalat rapid', 'Fara automatizare sau invatare continua', 'Rezultate inconsistente in timp'],

  statsH2: 'Hontrio in cifre',
  statsSub: 'Platforma construita cu atentie la fiecare detaliu tehnic.',
  stats: [
    { value: '4', label: 'module AI integrate intr-o singura platforma' },
    { value: '20+', label: 'semnale analizate per comanda de catre Risk Shield' },
    { value: '6', label: 'stiluri de imagine profesionala generate din o singura fotografie' },
    { value: '1', label: 'rand de cod pentru instalarea agentului de chat in magazinul tau' },
  ],

  ctaH2: 'Gata sa cresti afacerea ta online?',
  ctaSub: 'Conecteaza-ti magazinul si descopera cat timp poti economisi incepand de astazi.',
  ctaBtn: 'Incearca gratuit',
  ctaBtn2: 'Contacteaza-ne',
  ctaNote: 'Fara card de credit. Fara angajament.',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const { locale } = useLocale()
  const t = locale === 'ro' ? ro : en
  const shouldReduce = useReducedMotion() ?? false

  const E = [0.4, 0, 0.2, 1] as [number, number, number, number]

  const fadeUp = (delay = 0): MotionProps => shouldReduce ? {} : {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease: E, delay },
  }

  const inView = (delay = 0): MotionProps => shouldReduce ? {} : {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 0.5, ease: E, delay },
  }

  const timelineIcons = [
    <Lightbulb key="l" className="h-4 w-4" />,
    <Code2 key="c" className="h-4 w-4" />,
    <Plug key="p" className="h-4 w-4" />,
    <TrendingUp key="t" className="h-4 w-4" />,
  ]

  return (
    <main>
      {/* ── 1. HERO ── */}
      <section className="relative pt-24 pb-20 bg-white overflow-hidden">
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        {/* Radial glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[400px] bg-neutral-900/[0.04] rounded-full blur-3xl pointer-events-none -translate-y-1/4 translate-x-1/4" />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <motion.div {...fadeUp(0)}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/[0.06] border border-neutral-900/[0.12] text-xs font-semibold text-neutral-700 mb-8">
              <Building2 className="h-3.5 w-3.5" />
              {t.heroBadge}
            </div>
          </motion.div>

          <motion.h1
            {...fadeUp(0.1)}
            className="text-[34px] md:text-[52px] font-extrabold text-neutral-900 tracking-tight leading-[1.1] mb-6"
          >
            {t.heroH1}{' '}
            <span className="relative inline-block">
              <span className="relative z-10 text-neutral-900">{t.heroWord}</span>
              <motion.span
                className="absolute bottom-1 left-0 right-0 h-[3px] bg-neutral-900 rounded-full origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, ease: E, delay: 0.5 }}
              />
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(0.2)}
            className="text-[18px] text-neutral-500 max-w-[600px] mx-auto leading-[1.7]"
          >
            {t.heroSub}
          </motion.p>
        </div>
      </section>

      {/* ── 2. STORY ── */}
      <section className="py-20 bg-neutral-50 border-t border-neutral-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-14 items-start">
            {/* Left — text */}
            <motion.div {...inView(0)}>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">{t.storyTag}</p>
              <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-6">{t.storyH2}</h2>
              <div className="space-y-4 text-neutral-600 leading-relaxed">
                {[t.storyP1, t.storyP2, t.storyP3].map((p, i) => (
                  <p key={i} className="text-[15px]">{p}</p>
                ))}
              </div>
            </motion.div>

            {/* Right — timeline card */}
            <motion.div {...inView(0.1)}>
              <div className="rounded-[20px] border border-neutral-200 shadow-sm bg-white p-8">
                <div className="relative">
                  {/* vertical line */}
                  <div className="absolute left-[19px] top-6 bottom-6 w-px bg-neutral-200" />
                  <div className="space-y-8">
                    {t.timelineItems.map((item, i) => (
                      <motion.div
                        key={i}
                        {...(shouldReduce ? {} : {
                          initial: { opacity: 0, x: -12 },
                          whileInView: { opacity: 1, x: 0 },
                          viewport: { once: true, amount: 0.4 },
                          transition: { duration: 0.45, ease: E, delay: i * 0.1 },
                        })}
                        className="flex gap-5"
                      >
                        <div className={`shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 ${
                          i === 3
                            ? 'bg-green-50 border-green-200 text-green-600'
                            : 'bg-neutral-900 border-neutral-900 text-white'
                        }`}>
                          {timelineIcons[i]}
                        </div>
                        <div className="pt-1.5">
                          <p className="text-sm font-semibold text-neutral-900 mb-1">{item.title}</p>
                          <p className="text-sm text-neutral-500 leading-relaxed">{item.text}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── 3. MISSION & VISION ── */}
      <section className="py-20 bg-white border-t border-neutral-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Mission */}
            <motion.div
              {...inView(0)}
              className="rounded-xl border-l-4 border-neutral-900 bg-neutral-50 border border-l-4 p-7"
              style={{ borderLeftColor: '#0a0a0a' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[2px] text-neutral-400 mb-3">{t.missionLabel}</p>
              <h3 className="text-lg font-bold text-neutral-900 mb-3">{t.missionH3}</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">{t.missionText}</p>
            </motion.div>
            {/* Vision */}
            <motion.div
              {...inView(0.1)}
              className="rounded-xl bg-neutral-50 p-7"
              style={{ borderLeft: '4px solid #525252' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[2px] text-neutral-400 mb-3">{t.visionLabel}</p>
              <h3 className="text-lg font-bold text-neutral-900 mb-3">{t.visionH3}</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">{t.visionText}</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── 4. VALUES ── */}
      <section className="py-20 bg-neutral-50 border-t border-neutral-100">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div {...inView(0)} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{t.valuesH2}</h2>
            <p className="text-neutral-500 max-w-lg mx-auto">{t.valuesSub}</p>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-5">
            {t.values.map((v, i) => (
              <motion.div
                key={i}
                {...(shouldReduce ? {} : {
                  initial: { opacity: 0, y: 20 },
                  whileInView: { opacity: 1, y: 0 },
                  viewport: { once: true, amount: 0.15 },
                  transition: { duration: 0.45, ease: E, delay: i * 0.08 },
                })}
                className="group rounded-2xl border border-neutral-200 bg-white p-7 hover:border-neutral-400 hover:-translate-y-1 hover:shadow-md transition-all duration-250"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-neutral-900 text-white shrink-0">
                    {v.icon}
                  </div>
                  <h3 className="font-semibold text-neutral-900 text-[15px]">{v.title}</h3>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed">{v.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. COMPARISON ── */}
      <section className="py-20 bg-white border-t border-neutral-100">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div {...inView(0)} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{t.compH2}</h2>
            <p className="text-neutral-500 max-w-[580px] mx-auto">{t.compSub}</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Col 1 */}
            <motion.div {...inView(0)} className="rounded-2xl border border-neutral-200 p-6">
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-neutral-100">
                <X className="h-4 w-4 text-red-400" />
                <span className="font-semibold text-neutral-700 text-sm">{t.col1Title}</span>
              </div>
              <ul className="space-y-3">
                {t.col1Items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-500">
                    <X className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Col 2 — highlighted */}
            <motion.div
              {...inView(0.08)}
              className="rounded-2xl border-2 border-neutral-900 bg-neutral-900/[0.02] p-6 relative"
            >
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-neutral-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-bold text-neutral-900 text-sm">{t.col2Title}</span>
                <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
                  {t.col2Badge}
                </span>
              </div>
              <ul className="space-y-3">
                {t.col2Items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-700 font-medium">
                    <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Col 3 */}
            <motion.div {...inView(0.16)} className="rounded-2xl border border-neutral-200 p-6">
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-neutral-100">
                <X className="h-4 w-4 text-red-400" />
                <span className="font-semibold text-neutral-700 text-sm">{t.col3Title}</span>
              </div>
              <ul className="space-y-3">
                {t.col3Items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-500">
                    <X className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── 6. STATS ── */}
      <section className="py-20 bg-neutral-50 border-t border-neutral-100">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div {...inView(0)} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{t.statsH2}</h2>
            <p className="text-neutral-500">{t.statsSub}</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {t.stats.map((s, i) => (
              <motion.div
                key={i}
                {...(shouldReduce ? {} : {
                  initial: { opacity: 0, scale: 0.85 },
                  whileInView: { opacity: 1, scale: 1 },
                  viewport: { once: true, amount: 0.3 },
                  transition: { duration: 0.45, ease: E, delay: i * 0.09 },
                })}
                className="text-center max-w-[160px] mx-auto"
              >
                <p className="text-[48px] font-black text-neutral-900 leading-none mb-2">{s.value}</p>
                <p className="text-xs text-neutral-500 leading-snug">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. CTA ── */}
      <section className="py-20 bg-neutral-950">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div {...inView(0)}>
            <h2 className="text-[44px] font-extrabold text-white tracking-tight leading-tight mb-4">
              {t.ctaH2}
            </h2>
            <p className="text-neutral-400 text-lg mb-10 leading-relaxed">{t.ctaSub}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-neutral-900 text-sm font-semibold px-7 py-3.5 hover:bg-neutral-100 transition-colors duration-150"
              >
                {t.ctaBtn}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="mailto:contact@hontrio.com"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 text-white text-sm font-semibold px-7 py-3.5 hover:bg-white/10 transition-colors duration-150"
              >
                {t.ctaBtn2}
              </Link>
            </div>
            <p className="text-xs text-neutral-500 mt-5">{t.ctaNote}</p>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
