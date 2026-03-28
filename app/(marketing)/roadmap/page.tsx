'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  motion, AnimatePresence, useReducedMotion, useInView, useAnimation,
  type MotionProps,
} from 'framer-motion'
import {
  Map, Info, ImageIcon, TrendingUp, Bot, ShieldCheck,
  CheckCircle, RefreshCw, Cpu, Gauge, Languages, MessageSquarePlus,
  Video, Music, Type, Smartphone, Lightbulb, ArrowRight, ChevronDown,
  Check, Send, Loader2,
} from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

// ─── Bilingual content ────────────────────────────────────────────────────────

const ro = {
  heroBadge: 'Roadmap public',
  heroH1a: 'Unde mergem si',
  heroH1b: 'cum ajungem',
  heroH1c: 'acolo',
  heroSub: 'Transparenta totala despre ce construim, ce urmeaza si de ce luam deciziile pe care le luam. Roadmap-ul nostru este public pentru ca voi, utilizatorii, sunteti prioritatea.',
  heroInfo: 'Acest roadmap reflecta planurile curente si poate fi actualizat pe masura ce prioritatile se schimba. Feedback-ul vostru influenteaza direct ordinea de implementare.',

  legendTitle: 'Legenda statusuri',
  statuses: {
    available: 'Disponibil',
    availableDesc: 'Functie activa in platforma',
    inDev: 'In dezvoltare',
    inDevDesc: 'Lucram activ la aceasta functie',
    next: 'Urmatoarele',
    nextDesc: 'Planificat pentru urmatoarea etapa',
    future: 'Viitor',
    futureDesc: 'Pe agenda, fara data confirmata',
  },

  s1Title: 'Platforma de baza Hontrio',
  s1Desc: 'Infrastructura principala a platformei este activa si functionala. Toate modulele de baza sunt disponibile pentru utilizatorii nostri.',
  s1Launched: 'Lansat',
  s1Features: [
    { title: 'AI Image Generation', desc: 'Generare imagini profesionale pentru produse in secunde' },
    { title: 'SEO Optimizer', desc: 'Optimizare live a titlurilor, meta-descrierilor si cuvintelor cheie' },
    { title: 'AI Agent', desc: 'Agent de vanzari automat, activ 24/7 pentru clientii tai' },
    { title: 'Risk Shield', desc: 'Detectie clienti cu risc ridicat si protectie contra pierderilor' },
  ],

  s2Title: 'Extindere platforme eCommerce',
  s2Desc: 'Extindem compatibilitatea platformei la principalele solutii eCommerce din Romania si Europa. WooCommerce este deja disponibil, restul urmaza.',
  s2Note: 'Ordinea integrarii urmatoarelor platforme poate fi influentata de voturile voastre din sectiunea de mai jos.',
  s2Platforms: [
    { name: 'WooCommerce', status: 'available' },
    { name: 'Shopify', status: 'inDev' },
    { name: 'MerchantPRO', status: 'next' },
    { name: 'Magento', status: 'next' },
    { name: 'Gomag', status: 'future' },
    { name: 'PrestaShop', status: 'future' },
    { name: 'eMag Marketplace', status: 'future' },
  ],

  s3Title: 'Creare reclame cu AI',
  s3Desc: 'Genereaza reclame complete pentru Meta, Google si TikTok direct din platforma. Texte, imagini si targeting, totul optimizat de AI pentru produsele tale.',
  s3Channels: [
    {
      name: 'Meta Ads',
      items: ['Copy optimizat pentru Facebook si Instagram', 'Imagini generate automat', 'Variante A/B pentru testare'],
    },
    {
      name: 'Google Ads',
      items: ['Headlines si descriptions pentru Search', 'Bannere pentru Display Network', 'Extensii automate de anunt'],
    },
    {
      name: 'TikTok Ads',
      items: ['Scripturi pentru video ads', 'Overlay-uri si call-to-action', 'Adaptare pentru format vertical'],
    },
  ],
  s3Info: 'Aceasta functie va fi lansata in faza beta pentru utilizatorii Pro si Business. Inscrie-te pe lista de asteptare din sectiunea de feedback.',

  s4Title: 'Creare videoclipuri de produs cu AI',
  s4Desc: 'Transforma imaginile produselor tale in videoclipuri profesionale, gata de publicat pe social media sau folosite in reclame video.',
  s4Features: [
    { title: 'Video automat', desc: 'Genereaza videoclipuri din imagini si descrieri de produs' },
    { title: 'Muzica de fundal', desc: 'Biblioteca de sunete licentiata si selectie automata pe ton' },
    { title: 'Text animat', desc: 'Titluri, beneficii si CTA-uri animate direct in video' },
    { title: 'Format mobil', desc: 'Export 9:16 pentru Stories, Reels si TikTok' },
  ],

  s5Title: 'Google Merchant Optimizer',
  s5Desc: 'Optimizare automata a feed-ului Google Merchant Center pentru a maximiza vizibilitatea produselor tale in Google Shopping.',
  s5Items: [
    'Sincronizare automata produs -- feed',
    'Optimizare titluri si atribute pentru Shopping',
    'Detectie si corectare erori de feed',
    'Rapoarte de performanta Google Shopping',
  ],

  s6Title: 'Imbunatatiri continue',
  s6Desc: 'Platforma evolueaza permanent. Imbunatatim viteza, calitatea AI, suportul pentru limbi noi si comunicarea cu utilizatorii nostri.',
  s6Features: [
    { title: 'Performanta AI', desc: 'Modele mai rapide, rezultate mai precise' },
    { title: 'Viteza platformei', desc: 'Optimizari continue de infrastructura' },
    { title: 'Limbi noi', desc: 'Extindere suport multilingv pentru produse' },
    { title: 'Feedback in-app', desc: 'Sistem integrat de raportare si sugestii' },
  ],

  overviewTitle: 'Privire de ansamblu',
  overviewSub: 'Cele 6 etape ale evolutiei Hontrio, de la lansare la platforma completa.',

  feedbackTitle: 'Ajuta-ne sa prioritizam',
  feedbackSub: 'Voturile si sugestiile voastre influenteaza direct ce construim in continuare.',
  voteTitle: 'Ce vrei sa vedem implementat primul?',
  voteNote: 'Votul este anonim si stocat local. Poti vota o singura optiune o data.',
  voteOptions: [
    { key: 'shopify', label: 'Shopify Integration', pct: 68 },
    { key: 'ads', label: 'Reclame cu AI', pct: 54 },
    { key: 'merchant', label: 'Google Merchant Optimizer', pct: 41 },
    { key: 'video', label: 'Videoclipuri de produs', pct: 38 },
    { key: 'merchantpro', label: 'MerchantPRO Integration', pct: 29 },
  ],
  voteBtnLabel: 'Voteaza',
  votedLabel: 'Votat',

  suggestTitle: 'Trimite o sugestie',
  suggestDesc: 'Ai o idee de functie sau o imbunatatire? Spune-ne si o vom lua in considerare pentru roadmap.',
  emailLabel: 'Adresa ta de email',
  emailPlaceholder: 'email@domeniu.com',
  messageLabel: 'Sugestia ta',
  messagePlaceholder: 'Descrie functia sau imbunatatirea pe care o doresti...',
  submitBtn: 'Trimite sugestia',
  successMsg: 'Multumim! Sugestia ta a fost trimisa cu succes.',
  errorMsg: 'A aparut o eroare. Te rugam sa incerci din nou.',

  faqTitle: 'Intrebari frecvente',
  faqSub: 'Tot ce trebuie sa stii despre roadmap-ul Hontrio.',
  faqs: [
    {
      q: 'Cat de des este actualizat roadmap-ul?',
      a: 'Roadmap-ul este revizuit lunar. Dupa fiecare sprint major de dezvoltare, actualizam statusurile si adaugam noi etape daca este necesar.',
    },
    {
      q: 'Pot sa influentez ce se construieste?',
      a: 'Da. Sectiunea de vot si formul de sugestii de mai sus au impact direct. Functiile cu cele mai multe voturi sunt prioritizate in planning-ul urmatorului sprint.',
    },
    {
      q: 'Cand va fi disponibil Shopify?',
      a: 'Integrarea Shopify este in curs de dezvoltare (35% finalizata). Estimam lansarea in beta in urmatoarele 6-8 saptamani. Utilizatorii Pro si Business primesc acces anticipat.',
    },
    {
      q: 'Voi fi notificat cand o functie devine disponibila?',
      a: 'Da. Utilizatorii inregistrati primesc notificari in-app si email cand o functie votata sau sugerata de ei este lansata.',
    },
    {
      q: 'Pretul se va schimba odata cu noile functii?',
      a: 'Functiile marcate ca "Urmatoarele" si "Viitor" vor fi incluse in planurile existente sau disponibile ca add-on. Nu vom creste pretul fara notificare prealabila de 30 de zile.',
    },
  ],

  ctaTitle: 'Incepe astazi, creste cu noi',
  ctaSub: 'Platforma de baza este disponibila acum. Toate functiile viitoare vor fi adaugate automat in contul tau.',
  ctaBtn1: 'Incearca Hontrio gratuit',
  ctaBtn2: 'Trimite o sugestie',
  ctaNote: 'Fara card de credit. Setup in 5 minute. 20 credite gratuite incluse.',
}

const en: typeof ro = {
  heroBadge: 'Public Roadmap',
  heroH1a: 'Where we\'re going and',
  heroH1b: 'how we get',
  heroH1c: 'there',
  heroSub: 'Full transparency on what we\'re building, what\'s next and why we make the decisions we make. Our roadmap is public because you, our users, are the priority.',
  heroInfo: 'This roadmap reflects current plans and may be updated as priorities evolve. Your feedback directly influences the order of implementation.',

  legendTitle: 'Status legend',
  statuses: {
    available: 'Available',
    availableDesc: 'Feature active on platform',
    inDev: 'In development',
    inDevDesc: 'Actively working on this feature',
    next: 'Next up',
    nextDesc: 'Planned for next stage',
    future: 'Future',
    futureDesc: 'On the agenda, no confirmed date',
  },

  s1Title: 'Hontrio Core Platform',
  s1Desc: 'The main platform infrastructure is live and fully functional. All core modules are available to our users.',
  s1Launched: 'Launched',
  s1Features: [
    { title: 'AI Image Generation', desc: 'Professional product images generated in seconds' },
    { title: 'SEO Optimizer', desc: 'Live optimization of titles, meta descriptions and keywords' },
    { title: 'AI Agent', desc: 'Automated sales agent, active 24/7 for your customers' },
    { title: 'Risk Shield', desc: 'High-risk customer detection and loss protection' },
  ],

  s2Title: 'eCommerce Platform Expansion',
  s2Desc: 'We\'re expanding platform compatibility to the main eCommerce solutions in Romania and Europe. WooCommerce is already available, the rest is coming.',
  s2Note: 'The order of upcoming platform integrations may be influenced by your votes in the section below.',
  s2Platforms: [
    { name: 'WooCommerce', status: 'available' },
    { name: 'Shopify', status: 'inDev' },
    { name: 'MerchantPRO', status: 'next' },
    { name: 'Magento', status: 'next' },
    { name: 'Gomag', status: 'future' },
    { name: 'PrestaShop', status: 'future' },
    { name: 'eMag Marketplace', status: 'future' },
  ],

  s3Title: 'AI Ad Creation',
  s3Desc: 'Generate complete ads for Meta, Google and TikTok directly from the platform. Copy, images and targeting -- all AI-optimized for your products.',
  s3Channels: [
    {
      name: 'Meta Ads',
      items: ['Optimized copy for Facebook and Instagram', 'Auto-generated images', 'A/B variants for testing'],
    },
    {
      name: 'Google Ads',
      items: ['Headlines and descriptions for Search', 'Banners for Display Network', 'Automatic ad extensions'],
    },
    {
      name: 'TikTok Ads',
      items: ['Scripts for video ads', 'Overlays and call-to-action', 'Vertical format adaptation'],
    },
  ],
  s3Info: 'This feature will launch in beta for Pro and Business users. Sign up for the waiting list via the feedback section.',

  s4Title: 'AI Product Videos',
  s4Desc: 'Transform your product images into professional videos, ready to publish on social media or use in video ads.',
  s4Features: [
    { title: 'Auto video', desc: 'Generate videos from product images and descriptions' },
    { title: 'Background music', desc: 'Licensed sound library with automatic tone-matching selection' },
    { title: 'Animated text', desc: 'Titles, benefits and CTAs animated directly in the video' },
    { title: 'Mobile format', desc: '9:16 export for Stories, Reels and TikTok' },
  ],

  s5Title: 'Google Merchant Optimizer',
  s5Desc: 'Automatic optimization of your Google Merchant Center feed to maximize product visibility in Google Shopping.',
  s5Items: [
    'Automatic product -- feed sync',
    'Title and attribute optimization for Shopping',
    'Feed error detection and correction',
    'Google Shopping performance reports',
  ],

  s6Title: 'Continuous Improvements',
  s6Desc: 'The platform evolves constantly. We improve speed, AI quality, support for new languages and communication with our users.',
  s6Features: [
    { title: 'AI Performance', desc: 'Faster models, more precise results' },
    { title: 'Platform Speed', desc: 'Continuous infrastructure optimizations' },
    { title: 'New Languages', desc: 'Expanded multilingual support for products' },
    { title: 'In-app Feedback', desc: 'Integrated reporting and suggestion system' },
  ],

  overviewTitle: 'Overview',
  overviewSub: 'The 6 stages of Hontrio\'s evolution, from launch to full platform.',

  feedbackTitle: 'Help us prioritize',
  feedbackSub: 'Your votes and suggestions directly influence what we build next.',
  voteTitle: 'What do you want to see first?',
  voteNote: 'Vote is anonymous and stored locally. You can vote once per option.',
  voteOptions: [
    { key: 'shopify', label: 'Shopify Integration', pct: 68 },
    { key: 'ads', label: 'AI Ads', pct: 54 },
    { key: 'merchant', label: 'Google Merchant Optimizer', pct: 41 },
    { key: 'video', label: 'Product Videos', pct: 38 },
    { key: 'merchantpro', label: 'MerchantPRO Integration', pct: 29 },
  ],
  voteBtnLabel: 'Vote',
  votedLabel: 'Voted',

  suggestTitle: 'Send a suggestion',
  suggestDesc: 'Have a feature idea or improvement? Tell us and we\'ll consider it for the roadmap.',
  emailLabel: 'Your email address',
  emailPlaceholder: 'email@domain.com',
  messageLabel: 'Your suggestion',
  messagePlaceholder: 'Describe the feature or improvement you want...',
  submitBtn: 'Send suggestion',
  successMsg: 'Thank you! Your suggestion was sent successfully.',
  errorMsg: 'An error occurred. Please try again.',

  faqTitle: 'Frequently asked questions',
  faqSub: 'Everything you need to know about the Hontrio roadmap.',
  faqs: [
    {
      q: 'How often is the roadmap updated?',
      a: 'The roadmap is reviewed monthly. After each major development sprint, we update statuses and add new stages if necessary.',
    },
    {
      q: 'Can I influence what gets built?',
      a: 'Yes. The voting section and suggestion form above have direct impact. Features with the most votes are prioritized in the next sprint planning.',
    },
    {
      q: 'When will Shopify be available?',
      a: 'Shopify integration is in progress (35% complete). We estimate a beta launch in the next 6-8 weeks. Pro and Business users get early access.',
    },
    {
      q: 'Will I be notified when a feature becomes available?',
      a: 'Yes. Registered users receive in-app and email notifications when a feature they voted for or suggested is launched.',
    },
    {
      q: 'Will pricing change with new features?',
      a: 'Features marked as "Next up" and "Future" will be included in existing plans or available as add-ons. We will not raise prices without 30 days prior notice.',
    },
  ],

  ctaTitle: 'Start today, grow with us',
  ctaSub: 'The core platform is available now. All future features will be added automatically to your account.',
  ctaBtn1: 'Try Hontrio free',
  ctaBtn2: 'Send a suggestion',
  ctaNote: 'No credit card required. Setup in 5 minutes. 20 free credits included.',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  available: { dot: 'bg-green-500', border: 'border-green-500/40', bg: 'bg-green-500/8', badge: 'bg-green-500/12 text-green-700 border-green-500/30', text: 'text-green-700' },
  inDev:     { dot: 'bg-blue-500',  border: 'border-blue-500/40',  bg: 'bg-blue-500/8',  badge: 'bg-blue-500/12 text-blue-700 border-blue-500/30',   text: 'text-blue-700'  },
  next:      { dot: 'bg-yellow-500',border: 'border-yellow-500/40',bg: 'bg-yellow-500/8',badge: 'bg-yellow-500/12 text-yellow-700 border-yellow-500/30',text:'text-yellow-700'},
  future:    { dot: 'bg-neutral-400',border:'border-neutral-300/30',bg: 'bg-transparent', badge: 'bg-neutral-100 text-neutral-500 border-neutral-200',  text: 'text-neutral-500'},
}

type StatusKey = keyof typeof STATUS_COLORS

function fadeUp(delay = 0, reduced = false): MotionProps {
  if (reduced) return {}
  return {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: delay / 1000 },
  }
}

function StatusBadge({ status, T }: { status: StatusKey; T: typeof ro }) {
  const c = STATUS_COLORS[status]
  const label = T.statuses[status === 'inDev' ? 'inDev' : status === 'available' ? 'available' : status === 'next' ? 'next' : 'future']
  const pulse = status === 'available' ? 'animate-ping' : status === 'inDev' ? '' : ''
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.badge}`}>
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full rounded-full ${c.dot} ${status === 'available' ? 'animate-ping opacity-75' : ''}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
      </span>
      {label}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const { locale } = useLocale()
  const reduced = useReducedMotion() ?? false
  const T = locale === 'ro' ? ro : en

  const feedbackRef = useRef<HTMLDivElement>(null)
  const overviewRef = useRef<HTMLDivElement>(null)
  const overviewInView = useInView(overviewRef, { once: true, margin: '-80px' })

  const [votes, setVotes] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('hontrio_roadmap_votes')
      if (stored) setVotes(JSON.parse(stored))
    } catch {
      // ignore
    }
  }, [])

  function handleVote(key: string) {
    if (votes.includes(key)) return
    const next = [...votes, key]
    setVotes(next)
    try { localStorage.setItem('hontrio_roadmap_votes', JSON.stringify(next)) } catch { /* ignore */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !message) return
    setSubmitting(true)
    setSubmitStatus('idle')
    try {
      const res = await fetch('/api/roadmap/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message }),
      })
      setSubmitStatus(res.ok ? 'success' : 'error')
      if (res.ok) { setEmail(''); setMessage('') }
    } catch {
      setSubmitStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  function scrollToFeedback() {
    feedbackRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="pt-20 overflow-x-hidden">
      {/* CSS keyframes for animated gradient and slow spin */}
      <style>{`
        @keyframes gradientShift {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .gradient-text-anim {
          background: linear-gradient(90deg, var(--color-primary), #60a5fa, var(--color-primary));
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradientShift 4s ease infinite;
        }
        @keyframes slowSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .spin-slow { animation: slowSpin 4s linear infinite; }
        @keyframes slowPulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
        .pulse-slow { animation: slowPulse 2s ease-in-out infinite; }
      `}</style>

      {/* ── SECTION 1: HERO ─────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center text-center px-4 py-24 overflow-hidden">
        {/* background */}
        <div className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 80% 0%, var(--color-primary) / 0.08, transparent 70%)' }} />
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="flex flex-col items-center max-w-[760px] w-full gap-5">
          {/* Badge */}
          <motion.div {...fadeUp(0, reduced)}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.12] px-4 py-1.5 text-sm font-medium text-primary">
              <Map className="h-3.5 w-3.5 pulse-slow" />
              {T.heroBadge}
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            {...fadeUp(100, reduced)}
            className="font-extrabold leading-[1.1] text-[34px] md:text-[52px]"
          >
            {T.heroH1a}{' '}
            <span className="gradient-text-anim">{T.heroH1b}</span>{' '}
            {T.heroH1c}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            {...fadeUp(200, reduced)}
            className="opacity-70 text-[18px] leading-[1.7] max-w-[580px]"
          >
            {T.heroSub}
          </motion.p>

          {/* Info card */}
          <motion.div
            {...fadeUp(300, reduced)}
            className="flex items-start gap-3 rounded-[12px] border border-primary/25 bg-primary/[0.05] px-5 py-3.5 text-left"
          >
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p className="text-sm opacity-70">{T.heroInfo}</p>
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 2: STATUS LEGEND ────────────────────────────────────── */}
      <section className="flex flex-col items-center px-4 pb-16">
        <div className="flex flex-wrap justify-center gap-3 max-w-[900px]">
          {(
            [
              ['available', 'bg-green-500', true],
              ['inDev',     'bg-blue-500',  false],
              ['next',      'bg-yellow-500',false],
              ['future',    'bg-neutral-400',false],
            ] as [StatusKey, string, boolean][]
          ).map(([key, dotClass, pulse]) => {
            const c = STATUS_COLORS[key]
            const label   = T.statuses[key === 'inDev' ? 'inDev' : key === 'available' ? 'available' : key === 'next' ? 'next' : 'future']
            const descKey = (key + 'Desc') as keyof typeof ro.statuses
            const desc    = T.statuses[descKey]
            return (
              <div key={key} className={`flex items-center gap-2.5 rounded-[10px] border bg-white px-5 py-2.5 text-sm shadow-sm`}>
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  {pulse && <span className={`absolute inline-flex h-full w-full rounded-full ${dotClass} animate-ping opacity-70`} />}
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotClass}`} />
                </span>
                <span className="font-semibold">{label}</span>
                <span className="text-xs opacity-50 hidden sm:block">--</span>
                <span className="text-xs opacity-60 hidden sm:block">{desc}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── SECTION 3: MAIN TIMELINE ────────────────────────────────────── */}
      <section className="px-4 pb-24">
        <div className="max-w-[860px] mx-auto">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-border via-border to-transparent" />

            <div className="flex flex-col gap-10">

              {/* ── Stage 1: FUNDATIA ─────────────────────────────────── */}
              <TimelineItem
                status="available"
                reduced={reduced}
                delay={0}
                node={<NodeDot color="bg-green-500" pulse="ping" />}
              >
                <div className={`rounded-[20px] border-2 ${STATUS_COLORS.available.border} ${STATUS_COLORS.available.bg} p-7 shadow-sm`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <StatusBadge status="available" T={T} />
                    <span className="text-[13px] italic opacity-50">{T.s1Launched}</span>
                  </div>
                  <h3 className="font-bold text-xl mb-2">{T.s1Title}</h3>
                  <p className="text-sm opacity-70 mb-5">{T.s1Desc}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon: <ImageIcon className="h-4 w-4" />, ...T.s1Features[0] },
                      { icon: <TrendingUp className="h-4 w-4" />, ...T.s1Features[1] },
                      { icon: <Bot className="h-4 w-4" />, ...T.s1Features[2] },
                      { icon: <ShieldCheck className="h-4 w-4" />, ...T.s1Features[3] },
                    ].map((f) => (
                      <div key={f.title} className="flex items-start gap-3 rounded-[10px] border border-green-500/20 bg-green-500/5 p-3">
                        <span className="mt-0.5 text-green-600 shrink-0">{f.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-green-800">{f.title}</p>
                          <p className="text-xs opacity-60 mt-0.5">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TimelineItem>

              {/* ── Stage 2: EXTINDERE PLATFORME ─────────────────────── */}
              <TimelineItem
                status="inDev"
                reduced={reduced}
                delay={80}
                node={<NodeDot color="bg-blue-500" pulse="slow" />}
              >
                <div className={`rounded-[20px] border-2 ${STATUS_COLORS.inDev.border} ${STATUS_COLORS.inDev.bg} p-7 shadow-sm`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <StatusBadge status="inDev" T={T} />
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-[120px] rounded-full bg-neutral-200 overflow-hidden">
                        <div className="h-full w-[35%] rounded-full bg-blue-500 transition-all" />
                      </div>
                      <span className="text-xs font-medium text-blue-600">35%</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-xl mb-2">{T.s2Title}</h3>
                  <p className="text-sm opacity-70 mb-5">{T.s2Desc}</p>
                  <div className="flex flex-col gap-2">
                    {T.s2Platforms.map((p) => (
                      <div key={p.name} className="flex items-center justify-between rounded-[10px] border px-4 py-2.5">
                        <span className="text-sm font-medium">{p.name}</span>
                        <StatusBadge status={p.status as StatusKey} T={T} />
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs italic opacity-50">{T.s2Note}</p>
                </div>
              </TimelineItem>

              {/* ── Stage 3: RECLAME CU AI ────────────────────────────── */}
              <TimelineItem
                status="next"
                reduced={reduced}
                delay={160}
                node={<NodeDot color="bg-yellow-500" pulse="none" />}
              >
                <div className={`rounded-[20px] border-2 ${STATUS_COLORS.next.border} ${STATUS_COLORS.next.bg} p-7`}>
                  <div className="mb-3">
                    <StatusBadge status="next" T={T} />
                  </div>
                  <h3 className="font-bold text-xl mb-2">{T.s3Title}</h3>
                  <p className="text-sm opacity-70 mb-5">{T.s3Desc}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    {T.s3Channels.map((ch) => (
                      <div key={ch.name} className="rounded-[10px] border border-yellow-500/20 bg-yellow-500/5 p-4">
                        <p className="text-sm font-bold mb-2">{ch.name}</p>
                        <ul className="flex flex-col gap-1">
                          {ch.items.map((item) => (
                            <li key={item} className="flex items-start gap-1.5 text-xs opacity-70">
                              <Check className="h-3 w-3 mt-0.5 shrink-0 text-yellow-600" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-2.5 rounded-[10px] border bg-card p-3.5">
                    <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                    <p className="text-xs opacity-70">{T.s3Info}</p>
                  </div>
                </div>
              </TimelineItem>

              {/* ── Stage 4: VIDEOCLIPURI ─────────────────────────────── */}
              <TimelineItem
                status="next"
                reduced={reduced}
                delay={240}
                node={<NodeDot color="bg-yellow-500" pulse="none" />}
              >
                <div className={`rounded-[20px] border-2 ${STATUS_COLORS.next.border} ${STATUS_COLORS.next.bg} p-7`}>
                  <div className="mb-3">
                    <StatusBadge status="next" T={T} />
                  </div>
                  <h3 className="font-bold text-xl mb-2">{T.s4Title}</h3>
                  <p className="text-sm opacity-70 mb-5">{T.s4Desc}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon: <Video className="h-4 w-4" />, ...T.s4Features[0] },
                      { icon: <Music className="h-4 w-4" />, ...T.s4Features[1] },
                      { icon: <Type className="h-4 w-4" />, ...T.s4Features[2] },
                      { icon: <Smartphone className="h-4 w-4" />, ...T.s4Features[3] },
                    ].map((f) => (
                      <div key={f.title} className="flex items-start gap-3 rounded-[10px] border border-yellow-500/20 bg-yellow-500/5 p-3">
                        <span className="mt-0.5 text-yellow-600 shrink-0">{f.icon}</span>
                        <div>
                          <p className="text-sm font-semibold">{f.title}</p>
                          <p className="text-xs opacity-60 mt-0.5">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TimelineItem>

              {/* ── Stage 5: GOOGLE MERCHANT ──────────────────────────── */}
              <TimelineItem
                status="future"
                reduced={reduced}
                delay={320}
                node={<NodeDot color="bg-neutral-400" pulse="none" />}
              >
                <div className={`rounded-[20px] border-2 ${STATUS_COLORS.future.border} bg-transparent p-7`}>
                  <div className="mb-3">
                    <StatusBadge status="future" T={T} />
                  </div>
                  <h3 className="font-bold text-xl mb-2">{T.s5Title}</h3>
                  <p className="text-sm opacity-70 mb-5">{T.s5Desc}</p>
                  <div className="flex flex-col gap-2">
                    {T.s5Items.map((item) => (
                      <div key={item} className="flex items-center gap-2.5 text-sm opacity-60">
                        <CheckCircle className="h-4 w-4 shrink-0 text-neutral-400" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </TimelineItem>

              {/* ── Stage 6: IMBUNATATIRI CONTINUE ───────────────────── */}
              <TimelineItem
                status="available"
                reduced={reduced}
                delay={400}
                node={<NodeDot color="bg-primary" pulse="glow" />}
              >
                <div className="rounded-[20px] border-2 border-primary/40 bg-primary/[0.04] p-7">
                  <div className="mb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.12] px-2.5 py-0.5 text-xs font-medium text-primary">
                      <RefreshCw className="h-3 w-3 spin-slow" />
                      {locale === 'ro' ? 'Permanent' : 'Permanent'}
                    </span>
                  </div>
                  <h3 className="font-bold text-xl mb-2">{T.s6Title}</h3>
                  <p className="text-sm opacity-70 mb-5">{T.s6Desc}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { icon: <Cpu className="h-4 w-4" />, ...T.s6Features[0] },
                      { icon: <Gauge className="h-4 w-4" />, ...T.s6Features[1] },
                      { icon: <Languages className="h-4 w-4" />, ...T.s6Features[2] },
                      { icon: <MessageSquarePlus className="h-4 w-4" />, ...T.s6Features[3] },
                    ].map((f) => (
                      <div key={f.title} className="flex flex-col gap-1.5 rounded-[10px] border border-primary/20 bg-primary/5 p-3">
                        <span className="text-primary">{f.icon}</span>
                        <p className="text-xs font-semibold leading-tight">{f.title}</p>
                        <p className="text-[11px] opacity-55 leading-tight">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </TimelineItem>

            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: VISUAL TIMELINE SUMMARY ──────────────────────────── */}
      <section className="bg-neutral-50/50 px-4 py-20" ref={overviewRef}>
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">{T.overviewTitle}</h2>
            <p className="opacity-60 text-sm">{T.overviewSub}</p>
          </div>
          <div className="overflow-x-auto pb-4">
            <div className="min-w-[640px] relative flex items-start justify-between px-4">
              {/* connecting line */}
              <div className="absolute top-6 left-8 right-8 h-px bg-border" />
              {(
                [
                  { icon: <ImageIcon className="h-5 w-5" />, status: 'available' as StatusKey, label: locale === 'ro' ? 'Platforma de baza' : 'Core Platform' },
                  { icon: <Bot className="h-5 w-5" />,       status: 'inDev' as StatusKey,     label: locale === 'ro' ? 'Extindere platforme' : 'Platform Expansion' },
                  { icon: <TrendingUp className="h-5 w-5" />,status: 'next' as StatusKey,      label: locale === 'ro' ? 'Reclame cu AI' : 'AI Ads' },
                  { icon: <Video className="h-5 w-5" />,     status: 'next' as StatusKey,      label: locale === 'ro' ? 'Videoclipuri AI' : 'AI Videos' },
                  { icon: <ShieldCheck className="h-5 w-5" />,status:'future' as StatusKey,    label: locale === 'ro' ? 'Google Merchant' : 'Google Merchant' },
                  { icon: <RefreshCw className="h-5 w-5" />, status: 'available' as StatusKey, label: locale === 'ro' ? 'Imbunatatiri continue' : 'Continuous Improvements' },
                ]
              ).map((node, i) => {
                const c = STATUS_COLORS[node.status]
                return (
                  <motion.div
                    key={i}
                    className="relative flex flex-col items-center gap-2 z-10"
                    initial={reduced ? {} : { opacity: 0, y: 20 }}
                    animate={overviewInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                  >
                    <div className={`h-12 w-12 rounded-full border-2 ${c.border} ${c.bg} flex items-center justify-center ${c.text}`}>
                      {node.icon}
                    </div>
                    <p className="text-[12px] font-bold text-center max-w-[90px] leading-tight">{node.label}</p>
                    <StatusBadge status={node.status} T={T} />
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: FEEDBACK & VOTING ────────────────────────────────── */}
      <section className="px-4 py-20" ref={feedbackRef} id="feedback">
        <div className="max-w-[800px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">{T.feedbackTitle}</h2>
            <p className="opacity-60 text-sm">{T.feedbackSub}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Vote card */}
            <div className="rounded-[20px] border bg-card p-6 shadow-sm">
              <h3 className="font-bold text-base mb-4">{T.voteTitle}</h3>
              <div className="flex flex-col gap-3">
                {T.voteOptions.map((opt) => {
                  const voted = votes.includes(opt.key)
                  return (
                    <div key={opt.key} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{opt.label}</span>
                        <button
                          onClick={() => handleVote(opt.key)}
                          disabled={voted}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                            voted
                              ? 'bg-green-500/10 border-green-500/30 text-green-600 cursor-default'
                              : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                          }`}
                        >
                          {voted ? `${T.votedLabel} ✓` : T.voteBtnLabel}
                        </button>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${opt.pct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                        />
                      </div>
                      <span className="text-[11px] opacity-40">{opt.pct}%</span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-4 text-[11px] italic opacity-45">{T.voteNote}</p>
            </div>

            {/* Suggestion form */}
            <div className="rounded-[20px] border bg-card p-6 shadow-sm">
              <h3 className="font-bold text-base mb-1">{T.suggestTitle}</h3>
              <p className="text-xs opacity-60 mb-4">{T.suggestDesc}</p>
              {submitStatus === 'success' ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                  <p className="text-sm font-medium text-green-700">{T.successMsg}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-medium opacity-70 mb-1 block">{T.emailLabel}</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={T.emailPlaceholder}
                      className="w-full rounded-[10px] border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium opacity-70 mb-1 block">{T.messageLabel}</label>
                    <textarea
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 400))}
                      placeholder={T.messagePlaceholder}
                      rows={4}
                      className="w-full rounded-[10px] border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                    <p className="text-[11px] opacity-40 text-right">{message.length}/400</p>
                  </div>
                  {submitStatus === 'error' && (
                    <p className="text-xs text-red-500">{T.errorMsg}</p>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {T.submitBtn}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: FAQ ───────────────────────────────────────────────── */}
      <section className="bg-neutral-50/50 px-4 py-20">
        <div className="max-w-[700px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">{T.faqTitle}</h2>
            <p className="opacity-60 text-sm">{T.faqSub}</p>
          </div>
          <div className="flex flex-col gap-2">
            {T.faqs.map((faq, i) => (
              <div key={i} className="rounded-[14px] border bg-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium hover:bg-neutral-50/80 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 opacity-50 transition-transform duration-200"
                    style={{ transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-sm opacity-65 leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7: CTA FINAL ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-neutral-900 px-4 py-24 text-center">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 0%, var(--color-primary) / 0.18, transparent 70%)' }} />
        <div className="relative z-10 flex flex-col items-center gap-5 max-w-[600px] mx-auto">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">{T.ctaTitle}</h2>
          <p className="text-white/80 text-[16px] leading-relaxed">{T.ctaSub}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-[12px] bg-primary px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              {T.ctaBtn1}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={scrollToFeedback}
              className="inline-flex items-center gap-2 rounded-[12px] border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
            >
              {T.ctaBtn2}
            </button>
          </div>
          <p className="text-white/55 text-xs">{T.ctaNote}</p>
        </div>
      </section>
    </main>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NodeDot({ color, pulse }: { color: string; pulse: 'ping' | 'slow' | 'glow' | 'none' }) {
  return (
    <div className="relative flex items-center justify-center h-8 w-8 shrink-0">
      {pulse === 'ping' && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${color} animate-ping opacity-30`} />
      )}
      {pulse === 'slow' && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${color} pulse-slow opacity-20`} />
      )}
      {pulse === 'glow' && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-20 blur-sm`} />
      )}
      <span className={`relative h-6 w-6 rounded-full ${color} shadow-md`} />
    </div>
  )
}

function TimelineItem({
  children,
  node,
  reduced,
  delay,
}: {
  children: React.ReactNode
  node: React.ReactNode
  status: StatusKey
  reduced: boolean
  delay: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      className="flex gap-5 pl-0"
      initial={reduced ? {} : { opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: delay / 1000 }}
    >
      {/* Node on the left line */}
      <div className="relative flex flex-col items-center">
        <div className="z-10 mt-5">{node}</div>
      </div>
      {/* Card */}
      <div className="flex-1 min-w-0 pb-2">{children}</div>
    </motion.div>
  )
}
