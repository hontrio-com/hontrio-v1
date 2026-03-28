'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, ChevronUp, Star, ArrowRight, Bot, ShieldAlert } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { AuroraBackground } from '@/components/ui/aurora-background'

// ─── Bilingual content ────────────────────────────────────────────────────────

const en = {
  // Hero
  heroBadge: 'Designed for eCommerce growth',
  heroPrefix: 'AI that',
  heroSuffix: 'your online store',
  heroWords: ['Optimizes', 'Scales', 'Protects'],
  heroDesc: 'Generate product images, optimize SEO, automate sales with AI and detect fake customers. All in one platform.',
  heroCta: 'Try it free',
  heroCtaAlt: 'See all features',
  heroMeta: ['No credit card required', 'Setup in minutes', '20 free credits included'],

  // Features section
  featBadge: 'Everything in one platform',
  featH2: 'Stop juggling between multiple tools',
  featSubtitle:
    'Four powerful AI modules that work together to grow your online store',

  feat1Title: 'Instant Response for Every Customer, 24/7',
  feat1Desc:
    'Transform the way you communicate with your customers. The agent instantly answers questions, recommends relevant products and helps customers complete orders without human intervention. Works non-stop, reduces wasted time and automatically increases conversions.',
  feat1Bullets: [
    'Automatically responds to messages in real time, without delays',
    'Recommends relevant products based on customer questions',
    'Increases conversion rate through fast and accurate responses',
    'Works 24/7 without breaks or human errors',
  ],

  feat2Title: 'Stop Fake Orders Before You Lose Money',
  feat2Desc:
    'Risk Shield is the system that protects your store from problematic orders and unnecessary losses. It automatically analyzes each customer based on order history, behavior and available data, giving you a clear risk score.',
  feat2Bullets: [
    'Identifies customers who refuse orders',
    'Detects suspicious patterns (refusals, absences, cancellations)',
    'Mark customers as Trusted, Watch, Problematic or Blocked',
    'Get real loss estimates',
  ],

  feat3Title: 'Live SEO Score and Automatic Optimization for Every Product',
  feat3Desc:
    'Optimize every product in your store for maximum visibility on Google. The SEO module analyzes the title, meta description, keywords and page content, giving you a live SEO score and clear improvement recommendations.',
  feat3Bullets: [
    'Optimize products to appear higher in search results',
    'Improve product relevance for important keywords',
    'Generate optimized SEO titles in seconds',
    'Automatically includes the keyword in the right places',
  ],

  feat4Title: 'Images That Grab Attention and Increase Conversions',
  feat4Desc:
    'Quickly create product images that look professional and are ready for promotion. The AI Images module automatically generates attractive visuals, banners and posters based on your products, without needing designers or graphic design skills.',
  feat4Bullets: [
    'Generate product images in seconds',
    'Titles and benefits integrated directly into the design',
    'Structure designed for conversion',
    'No designers or graphic design skills needed',
  ],

  featDetailsCta: 'Learn more',
  featTrialCta: 'Try for free',

  // Comparison
  compH2: 'Stop paying for 5 different tools',
  compSubtitle:
    'As an online store owner, you normally need separate subscriptions for everything. Hontrio changes that.',
  compOldHeader: 'The old way',
  compNewHeader: 'With Hontrio',
  compTools: [
    { name: 'AI Copywriter', price: '$39' },
    { name: 'SEO Tool', price: '$99' },
    { name: 'AI Image Generator', price: '$30' },
    { name: 'Chatbot', price: '$49' },
    { name: 'Fraud Detection', price: '$39' },
  ],
  compFeatures: ['AI Images', 'SEO Optimizer', 'AI Agent', 'Risk Shield', 'WooCommerce Integration', 'Analytics Dashboard'],
  compNewBenefits: [
    '1 subscription, everything included',
    '1 unified dashboard',
    'Setup in minutes',
  ],
  compSave: 'Save $237/month',
  compSaveMsg: 'All your essential tools. One platform.',
  compCta: 'Start Free',

  // Pricing
  pricingH2: 'Simple, transparent pricing',
  pricingSubtitle:
    'Start free, upgrade when you need more. Cancel anytime.',
  plans: [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      credits: '20 credits',
      features: ['WooCommerce connection', 'All AI modules (limited)', 'Email support'],
      cta: 'Start for free',
      popular: false,
      dark: false,
    },
    {
      name: 'Starter',
      price: '$19',
      period: '/mo',
      credits: '150 credits/month',
      features: ['Everything in Free', '150 AI credits/month', 'AI product images', 'SEO optimization', 'Priority support'],
      cta: 'Get Starter',
      popular: false,
      dark: false,
    },
    {
      name: 'Professional',
      price: '$49',
      period: '/mo',
      credits: '400 credits/month',
      features: ['Everything in Starter', '400 AI credits/month', 'AI Sales Agent', 'Risk Shield', 'Competitor analysis', 'Bulk operations'],
      cta: 'Get Professional',
      popular: true,
      dark: false,
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: '/mo',
      credits: '900 credits/month',
      features: ['Everything in Professional', '900 AI credits/month', 'Advanced analytics', 'Dedicated support', 'Custom integrations'],
      cta: 'Get Enterprise',
      popular: false,
      dark: false,
    },
  ],

  // Testimonials
  testimonialsH2: 'Trusted by store owners',
  testimonials: [
    {
      name: 'Andrei M.',
      role: 'Furniture store owner',
      initials: 'AM',
      stars: 5,
      quote:
        'I reduced product optimization time from 2 hours a day to 15 minutes. SEO traffic grew by 40% in 3 months without any agency.',
    },
    {
      name: 'Laura S.',
      role: 'Clothing store founder',
      initials: 'LS',
      stars: 5,
      quote:
        'The AI-generated images look better than our original photos. Return rates dropped because customers know exactly what they\'re buying.',
    },
    {
      name: 'Mihai P.',
      role: 'Electronics store manager',
      initials: 'MP',
      stars: 5,
      quote:
        'Risk Shield identified 12 fraudulent orders in the first month. We saved over 8,000 RON instantly. The investment paid off in the first week.',
    },
    {
      name: 'Elena V.',
      role: 'Home decor store owner',
      initials: 'EV',
      stars: 5,
      quote:
        'The AI agent handles 80% of customer questions automatically. My team now focuses on growing the business instead of answering the same questions 50 times a day.',
    },
  ],

  // FAQ
  faqH2: 'Frequently asked questions',
  faqs: [
    {
      q: 'How does WooCommerce integration work?',
      a: 'Your store connects easily during the OnBoarding process or from Settings at any time. No technical knowledge required. If you run into any issues, our team offers fast assistance.',
    },
    {
      q: 'What are credits and how many do I need?',
      a: 'Credits are the AI usage currency. One SEO optimization costs 3 credits, one AI image costs 6-8 credits. Most stores use between 50-300 credits per month depending on catalog size.',
    },
    {
      q: 'Is there a free trial?',
      a: 'Yes! You get 20 free credits when you create your account, no credit card required. This is enough to optimize around 6 products or generate 3 AI images and see the results for yourself.',
    },
    {
      q: 'Can I cancel my subscription anytime?',
      a: 'Absolutely. There are no long-term contracts or cancellation fees. You can cancel your subscription at any time from your account settings, and you\'ll keep access until the end of your billing period.',
    },
    {
      q: 'What languages does the AI generate content in?',
      a: 'The AI generates content in any language you need. Simply set the desired language in your brand settings and the AI will write in that language. The Hontrio interface itself is available in English and Romanian.',
    },
    {
      q: 'Is my store data secure?',
      a: 'Yes. All data is encrypted in transit and at rest. We are GDPR compliant and never share your data with third parties. Your product data is used only to generate content for your store.',
    },
  ],

  // CTA Banner
  ctaH2: 'Ready to grow your store?',
  ctaSubtitle:
    'Join hundreds of store owners already using Hontrio to automate and grow.',
  ctaPrimary: 'Start for free, no card required',
  ctaSecondary: 'Sign in',
}

const ro = {
  // Hero
  heroBadge: 'Conceput pentru creșterea magazinelor online',
  heroPrefix: 'AI care',
  heroSuffix: 'magazinul tău online',
  heroWords: ['Optimizează', 'Scalează', 'Protejează'],
  heroDesc: 'Generează imagini pentru produse, optimizează SEO, automatizează vânzările cu AI și detectează clienții falși. Totul într-o singură platformă.',
  heroCta: 'Încearcă gratuit',
  heroCtaAlt: 'Vezi toate funcțiile',
  heroMeta: ['Fără card bancar', 'Configurare în câteva minute', '20 de credite gratuite incluse'],

  // Features section
  featBadge: 'Totul într-o singură platformă',
  featH2: 'Oprește-te din gestionarea mai multor unelte',
  featSubtitle:
    'Patru module AI puternice care lucrează împreună pentru a-ți crește magazinul online',

  feat1Title: 'Răspuns instant pentru fiecare client, 24/7',
  feat1Desc:
    'Transformă modul în care comunici cu clienții tăi. Agentul răspunde instant la întrebări, recomandă produse relevante și ajută clienții să finalizeze comenzile fără intervenție umană. Funcționează non-stop, reduce timpul pierdut și crește conversiile automat.',
  feat1Bullets: [
    'Răspunde automat la mesaje în timp real, fără întârzieri',
    'Recomandă produse relevante pe baza întrebărilor clientului',
    'Crește rata de conversie prin răspunsuri rapide și precise',
    'Funcționează 24/7 fără pauze sau erori umane',
  ],

  feat2Title: 'Oprește comenzile false înainte să pierzi bani',
  feat2Desc:
    'Risk Shield este sistemul care îți protejează magazinul de comenzile problematice și pierderile inutile. Analizează automat fiecare client pe baza istoricului comenzilor, comportamentului și datelor disponibile, oferindu-ți un scor clar de risc.',
  feat2Bullets: [
    'Identifică clienții care refuză comenzile',
    'Detectează tipare suspecte (refuzuri, absențe, anulări)',
    'Marchezi clienții ca Trusted, Watch, Problematic sau Blocat',
    'Primești estimări reale de pierderi',
  ],

  feat3Title: 'Scor SEO live și optimizare automată pentru fiecare produs',
  feat3Desc:
    'Optimizează fiecare produs din magazinul tău pentru vizibilitate maximă în Google. Modulul SEO analizează titlul, meta descrierea, keyword-urile și conținutul paginii, oferindu-ți un scor SEO live și recomandări clare de îmbunătățire.',
  feat3Bullets: [
    'Optimizezi produsele pentru a apărea mai sus în rezultatele de căutare',
    'Îmbunătățești relevanța produselor pentru keyword-urile importante',
    'Generezi titluri SEO optimizate în câteva secunde',
    'Include keyword-ul în locurile potrivite automat',
  ],

  feat4Title: 'Imagini care atrag atenția și cresc conversiile',
  feat4Desc:
    'Creează rapid imagini de produs care arată profesional și sunt gata de promovare. Modulul Imagini AI generează automat vizualuri atractive, bannere și postere bazate pe produsele tale, fără să ai nevoie de designeri sau cunoștințe de grafică.',
  feat4Bullets: [
    'Generezi imagini de produs în câteva secunde',
    'Titluri și beneficii integrate direct în design',
    'Structură gândită pentru conversie',
    'Fără designeri sau cunoștințe de grafică',
  ],

  featDetailsCta: 'Mai multe detalii',
  featTrialCta: 'Încearcă gratuit',

  // Comparison
  compH2: 'Oprește-te să plătești pentru 5 unelte diferite',
  compSubtitle:
    'Ca proprietar de magazin online, în mod normal ai nevoie de abonamente separate pentru fiecare lucru. Hontrio schimbă asta.',
  compOldHeader: 'Cum era înainte',
  compNewHeader: 'Cu Hontrio',
  compTools: [
    { name: 'AI Copywriter', price: '$39' },
    { name: 'Unealtă SEO', price: '$99' },
    { name: 'Generator imagini AI', price: '$30' },
    { name: 'Chatbot', price: '$49' },
    { name: 'Detecție fraudă', price: '$39' },
  ],
  compFeatures: ['Imagini AI', 'Optimizator SEO', 'Agent AI', 'Risk Shield', 'Integrare WooCommerce', 'Dashboard Analytics'],
  compNewBenefits: [
    '1 abonament, totul inclus',
    '1 dashboard unificat',
    'Configurare în câteva minute',
  ],
  compSave: 'Economisești $237/lună',
  compSaveMsg: 'Toate uneltele tale. O singură platformă.',
  compCta: 'Începe gratuit',

  // Pricing
  pricingH2: 'Prețuri simple și transparente',
  pricingSubtitle: 'Începe gratuit, upgradează când ai nevoie de mai mult. Anulează oricând.',
  plans: [
    {
      name: 'Free',
      price: '$0',
      period: 'permanent',
      credits: '20 credite',
      features: ['Conectare WooCommerce', 'Toate modulele AI (limitat)', 'Suport email'],
      cta: 'Începe gratuit',
      popular: false,
      dark: false,
    },
    {
      name: 'Starter',
      price: '$19',
      period: '/lună',
      credits: '150 credite/lună',
      features: ['Tot din Free', '150 credite AI/lună', 'Imagini AI produse', 'Optimizare SEO', 'Suport prioritar'],
      cta: 'Alege Starter',
      popular: false,
      dark: false,
    },
    {
      name: 'Professional',
      price: '$49',
      period: '/lună',
      credits: '400 credite/lună',
      features: ['Tot din Starter', '400 credite AI/lună', 'Agent AI de vânzări', 'Risk Shield', 'Analiză competitori', 'Operații în masă'],
      cta: 'Alege Professional',
      popular: true,
      dark: false,
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: '/lună',
      credits: '900 credite/lună',
      features: ['Tot din Professional', '900 credite AI/lună', 'Analize avansate', 'Suport dedicat', 'Integrări personalizate'],
      cta: 'Alege Enterprise',
      popular: false,
      dark: false,
    },
  ],

  // Testimonials
  testimonialsH2: 'Folosit de proprietari de magazine',
  testimonials: [
    {
      name: 'Andrei M.',
      role: 'Proprietar magazin mobilă',
      initials: 'AM',
      stars: 5,
      quote:
        'Am redus timpul de optimizare a produselor de la 2 ore pe zi la 15 minute. Traficul SEO a crescut cu 40% în 3 luni fără nicio agenție.',
    },
    {
      name: 'Laura S.',
      role: 'Fondatoare magazin haine',
      initials: 'LS',
      stars: 5,
      quote:
        'Imaginile generate cu AI arată mai bine decât fotografiile noastre originale. Retururile au scăzut pentru că clienții știu exact ce cumpără.',
    },
    {
      name: 'Mihai P.',
      role: 'Manager magazin electronice',
      initials: 'MP',
      stars: 5,
      quote:
        'Risk Shield a identificat 12 comenzi frauduloase în prima lună. Am economisit peste 8.000 RON instant. Investiția s-a recuperat în prima săptămână.',
    },
    {
      name: 'Elena V.',
      role: 'Proprietară magazin decorațiuni casă',
      initials: 'EV',
      stars: 5,
      quote:
        'Agentul AI gestionează 80% din întrebările clienților automat. Echipa mea se concentrează acum pe creșterea afacerii în loc să răspundă la aceleași întrebări de 50 de ori pe zi.',
    },
  ],

  // FAQ
  faqH2: 'Întrebări frecvente',
  faqs: [
    {
      q: 'Cum funcționează integrarea cu WooCommerce?',
      a: 'Magazinul tău se conectează foarte simplu în procesul de OnBoarding sau din Setări oricând. Nu sunt necesare cunoștințe tehnice. Dacă întâmpini dificultăți, echipa noastră îți oferă asistență rapidă.',
    },
    {
      q: 'Ce sunt creditele și de câte am nevoie?',
      a: 'Creditele sunt moneda de utilizare AI. O optimizare SEO costă 3 credite, o imagine AI costă 6-8 credite. Majoritatea magazinelor folosesc între 50-300 credite pe lună în funcție de dimensiunea catalogului.',
    },
    {
      q: 'Există o perioadă de probă gratuită?',
      a: 'Da! Primești 20 credite gratuite când îți creezi contul, fără card bancar. Este suficient pentru a optimiza aproximativ 6 produse sau a genera 3 imagini AI și a vedea rezultatele.',
    },
    {
      q: 'Pot anula abonamentul oricând?',
      a: 'Absolut. Nu există contracte pe termen lung sau taxe de anulare. Poți anula abonamentul oricând din setările contului, și vei păstra accesul până la sfârșitul perioadei de facturare.',
    },
    {
      q: 'În ce limbi generează AI-ul conținut?',
      a: 'AI-ul generează conținut în orice limbă ai nevoie. Setează pur și simplu limba dorită în setările brandului și AI-ul va scrie în acea limbă. Interfața Hontrio este disponibilă în Engleză și Română.',
    },
    {
      q: 'Datele magazinului meu sunt în siguranță?',
      a: 'Da. Toate datele sunt criptate în tranzit și în repaus. Suntem conformi GDPR și nu partajăm niciodată datele tale cu terți. Datele produselor sunt folosite doar pentru a genera conținut pentru magazinul tău.',
    },
  ],

  // CTA Banner
  ctaH2: 'Gata să îți crești magazinul?',
  ctaSubtitle:
    'Alătură-te sutelor de proprietari de magazine care folosesc deja Hontrio pentru a automatiza și crește.',
  ctaPrimary: 'Începe gratuit, fără card',
  ctaSecondary: 'Conectează-te',
}

// ─── Mockup Components ────────────────────────────────────────────────────────

function DashboardMockup() {
  return (
    <div className="bg-neutral-950 rounded-2xl p-6 shadow-2xl border border-neutral-800 w-full max-w-lg mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
        </div>
        <span className="text-xs text-neutral-500 font-medium">Dashboard | Hontrio</span>
        <div className="w-16" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'SEO Score', value: '87', color: 'text-emerald-400' },
          { label: 'AI Images', value: '142', color: 'text-blue-400' },
          { label: 'Fraud Blocked', value: '12', color: 'text-orange-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-neutral-900 rounded-xl p-3">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-neutral-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Chart bars */}
      <div className="bg-neutral-900 rounded-xl p-4 mb-4">
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">Monthly Performance</p>
        <div className="flex items-end gap-1.5 h-16">
          {[40, 65, 50, 80, 70, 90, 75].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-gradient-to-t from-neutral-700 to-neutral-600"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <span key={i} className="text-[9px] text-neutral-600 flex-1 text-center">{d}</span>
          ))}
        </div>
      </div>

      {/* Products list */}
      <div className="space-y-2">
        {[
          { name: 'Scaun ergonomic Pro', score: 94 },
          { name: 'Birou ajustabil 160cm', score: 81 },
          { name: 'Lampă LED birou', score: 76 },
        ].map((p) => (
          <div key={p.name} className="flex items-center gap-3 bg-neutral-900 rounded-lg px-3 py-2">
            <div className="h-7 w-7 rounded-md bg-neutral-800 shrink-0" />
            <span className="text-xs text-neutral-300 flex-1 truncate">{p.name}</span>
            <span className={`text-xs font-semibold ${p.score >= 90 ? 'text-emerald-400' : p.score >= 80 ? 'text-yellow-400' : 'text-orange-400'}`}>
              {p.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    // Belt-and-suspenders: ensure muted HTML attribute is present, then force
    // load + play whenever src changes (catches locale flip after geo detection).
    if (!v.hasAttribute('muted')) v.setAttribute('muted', '')
    v.defaultMuted = true
    v.muted = true
    v.load()
    v.play().catch(() => {})
  }, [src])

  // src is in JSX so the server-rendered HTML contains all four attributes
  // iOS requires for declarative autoplay: src + muted + autoplay + playsinline.
  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      className="w-full aspect-square object-cover block"
    />
  )
}

function ImagesMockup({ locale }: { locale: string }) {
  const src = locale === 'ro' ? '/videos/image.mp4' : '/videos/image-en.mp4'
  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-200">
      <VideoPlayer src={src} />
    </div>
  )
}

function SEOMockup({ locale }: { locale: string }) {
  const src = locale === 'ro' ? '/videos/seo.mp4' : '/videos/seo-en.mp4'
  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-200">
      <VideoPlayer src={src} />
    </div>
  )
}

function AgentMockup({ locale }: { locale: string }) {
  const src = locale === 'ro' ? '/videos/ai-video.mp4' : '/videos/ai-video-en.mp4'
  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-200">
      <VideoPlayer src={src} />
    </div>
  )
}

function RiskMockup({ locale }: { locale: string }) {
  const src = locale === 'ro' ? '/videos/risk-shield.mp4' : '/videos/risk-shield-en.mp4'
  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-200">
      <VideoPlayer src={src} />
    </div>
  )
}

// ─── Feature Block ────────────────────────────────────────────────────────────

// ─── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    setValue(0)
    let cur = 0
    const steps = Math.ceil(duration / 16)
    const inc = target / steps
    const timer = setInterval(() => {
      cur += inc
      if (cur >= target) { setValue(target); clearInterval(timer) }
      else setValue(Math.floor(cur))
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration, active])
  return value
}

// ─── Brain Comparison Section ─────────────────────────────────────────────────
const BRAIN_W = 700
const BRAIN_H = 520
const CX = 350
const CY = 260
const NODE_R = 185
const toRad = (deg: number) => (deg * Math.PI) / 180

function getBrainNodes(locale: string) {
  const ro = locale === 'ro'
  return [
    { angle: 270, name: 'Jasper AI',                             sublabel: ro ? 'Copywriting & Conținut' : 'Copywriting & Content',  logo: '/JasperAILogo.png', price: '$39', icon: null },
    { angle: 342, name: 'Semrush',                               sublabel: ro ? 'Optimizare SEO'          : 'SEO Optimization',        logo: '/SemrushLogo.png',   price: '$99', icon: null },
    { angle: 54,  name: 'Gemini',                                sublabel: ro ? 'Generare Imagini AI'     : 'AI Image Generation',     logo: '/GeminiLogo.png',    price: '$30', icon: null },
    { angle: 126, name: 'Chatbot',                               sublabel: ro ? 'Suport Clienți'          : 'Customer Support',        logo: null,                  price: '$49', icon: 'bot' as const },
    { angle: 198, name: ro ? 'Anti-Fraudă' : 'Fraud Guard',      sublabel: ro ? 'Protecție Comenzi'       : 'Order Protection',        logo: null,                  price: '$39', icon: 'shield' as const },
  ].map(n => ({
    ...n,
    x: CX + NODE_R * Math.cos(toRad(n.angle)),
    y: CY + NODE_R * Math.sin(toRad(n.angle)),
  }))
}

function BrainComparisonSection({ c, locale }: { c: typeof en; locale: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const diagramRef = useRef<HTMLDivElement>(null)
  const [inView,        setInView]        = useState(false)
  const [nodesVisible,  setNodesVisible]  = useState(false)
  const [finalVisible,  setFinalVisible]  = useState(false)
  const [diagramScale,  setDiagramScale]  = useState(1)

  const nodes = getBrainNodes(locale)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect() } },
      { threshold: 0.15 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const t1 = setTimeout(() => setNodesVisible(true), 500)
    const t2 = setTimeout(() => setFinalVisible(true), 1600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [inView])

  useEffect(() => {
    if (!diagramRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setDiagramScale(Math.min(1, (entry.contentRect.width / BRAIN_W) * 1.2))
    })
    ro.observe(diagramRef.current)
    return () => ro.disconnect()
  }, [])

  const saveCount    = useCountUp(237, 900, finalVisible)
  const hontrioCount = useCountUp(19,  800, finalVisible)

  return (
    <section ref={ref} className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50 overflow-hidden">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">{c.compH2}</h2>
          <p className="text-xl text-neutral-500 max-w-2xl mx-auto">{c.compSubtitle}</p>
        </div>

        {/* ── Brain diagram (all screen sizes) ── */}
        <div ref={diagramRef} className="relative mx-auto select-none" style={{ maxWidth: BRAIN_W, width: '100%', height: BRAIN_H * diagramScale }}>
        <div style={{ width: BRAIN_W, height: BRAIN_H, transform: `scale(${diagramScale})`, transformOrigin: 'top center', position: 'absolute', top: 0, left: '50%', marginLeft: -BRAIN_W / 2 }}>

          {/* SVG lines */}
          <svg viewBox={`0 0 ${BRAIN_W} ${BRAIN_H}`} className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
            <defs>
              <radialGradient id="lineGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#d1d5db" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#d1d5db" stopOpacity="0.2" />
              </radialGradient>
            </defs>
            {nodes.map((node, i) => {
              const len = Math.sqrt((node.x - CX) ** 2 + (node.y - CY) ** 2)
              return (
                <line key={i}
                  x1={CX} y1={CY} x2={node.x} y2={node.y}
                  stroke="#e5e7eb" strokeWidth="1.5"
                  strokeDasharray={len}
                  strokeDashoffset={inView ? 0 : len}
                  style={{ transition: `stroke-dashoffset 0.7s ${0.2 + i * 0.13}s cubic-bezier(0.4,0,0.2,1)` }}
                />
              )
            })}
          </svg>

          {/* Center core */}
          <div className="absolute" style={{ left: `${(CX / BRAIN_W) * 100}%`, top: `${(CY / BRAIN_H) * 100}%`, transform: 'translate(-50%, -50%)', opacity: inView ? 1 : 0, transition: 'opacity 0.5s ease' }}>
            {/* Pulse rings */}
            <div className="absolute rounded-full bg-neutral-100" style={{ width: 110, height: 110, top: '50%', left: '50%', animation: inView ? 'corePulse 3s ease-in-out infinite' : 'none' }} />
            <div className="absolute rounded-full bg-neutral-50" style={{ width: 150, height: 150, top: '50%', left: '50%', animation: inView ? 'coreRing 3s 0.4s ease-in-out infinite' : 'none' }} />
            {/* Core card */}
            <div className="relative z-10 w-[78px] h-[78px] rounded-2xl bg-white border border-neutral-200 shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex flex-col items-center justify-center gap-1">
              <img src="/logo-icon.png" className="h-7 w-auto" alt="Hontrio" />
              <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Hontrio</span>
            </div>
          </div>

          {/* Tool nodes */}
          {nodes.map((node, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${(node.x / BRAIN_W) * 100}%`,
              top:  `${(node.y / BRAIN_H) * 100}%`,
              transform: nodesVisible ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.75)',
              opacity:   nodesVisible ? 1 : 0,
              transition: `opacity 0.4s ${i * 0.11}s ease, transform 0.4s ${i * 0.11}s ease`,
            }}
            >
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-lg flex flex-col items-center justify-center gap-1.5 p-3" style={{ width: 92 }}>
                {node.logo ? (
                  <img src={node.logo} className="h-6 w-auto max-w-[60px] object-contain" alt={node.name} />
                ) : node.icon === 'bot' ? (
                  <div className="w-7 h-7 rounded-xl bg-neutral-100 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-neutral-500" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-xl bg-neutral-100 flex items-center justify-center">
                    <ShieldAlert className="h-4 w-4 text-neutral-500" />
                  </div>
                )}
                <span className="text-[9px] font-semibold text-neutral-800 text-center leading-tight">{node.name}</span>
                <span className="text-[8px] text-neutral-400 text-center leading-tight">{node.sublabel}</span>
                <span className="text-[9px] font-bold text-red-500 tabular-nums">{node.price}<span className="font-normal text-neutral-400">/mo</span></span>
              </div>
            </div>
          ))}
        </div>
        </div>

        {/* ── Bottom: message + CTA ── */}
        <div className="mt-4 md:mt-14 text-center" style={{ opacity: finalVisible ? 1 : 0, transform: finalVisible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>

          <div className="inline-flex items-center gap-3 mb-6 flex-wrap justify-center">
            <span className="text-2xl font-bold text-neutral-300 line-through tabular-nums">$256<span className="text-base">/mo</span></span>
            <span className="text-neutral-300 text-lg">→</span>
            <span className="text-4xl font-bold text-neutral-900 tabular-nums">${hontrioCount}<span className="text-base font-normal text-neutral-500">/mo</span></span>
            <span className="px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold whitespace-nowrap">
              {c.compSave.replace('237', String(saveCount))}
            </span>
          </div>

          <p className="text-3xl font-bold text-neutral-900 mb-3 tracking-tight">{c.compSaveMsg}</p>

          <div className="flex items-center justify-center gap-6 mb-8 flex-wrap">
            {c.compNewBenefits.map((b) => (
              <div key={b} className="flex items-center gap-1.5 text-sm text-neutral-500">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                {b}
              </div>
            ))}
          </div>

          <Link
            href="/register"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-neutral-900 text-white text-[15px] font-semibold hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
          >
            {c.compCta}
          </Link>
        </div>

      </div>
    </section>
  )
}

function FeatureBlock({
  mockup,
  title,
  desc,
  bullets,
  reverse,
  detailsHref,
  detailsCta,
  trialCta,
}: {
  mockup: React.ReactNode
  title: string
  desc: string
  bullets: string[]
  reverse?: boolean
  detailsHref: string
  detailsCta: string
  trialCta: string
}) {
  return (
    <div
      className={`flex flex-col ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-16`}
    >
      {/* Mockup */}
      <div className="w-full lg:w-1/2 flex justify-center">{mockup}</div>

      {/* Text */}
      <div className="w-full lg:w-1/2">
        <h3 className="text-2xl font-bold text-neutral-900 mb-4">{title}</h3>
        <p className="text-neutral-500 leading-relaxed mb-6">{desc}</p>
        <ul className="space-y-3 mb-8">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-neutral-900 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="h-3 w-3 text-white" />
              </div>
              <span className="text-neutral-600 text-sm leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={detailsHref}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-[14px] font-semibold text-neutral-700 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
          >
            {detailsCta}
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white bg-neutral-900 hover:bg-neutral-800 transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
          >
            {trialCta}
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FAQItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-neutral-100 last:border-0">
      <button
        className="w-full flex items-start justify-between gap-4 py-5 text-left"
        onClick={onToggle}
      >
        <span className="text-base font-medium text-neutral-900 leading-snug">{q}</span>
        <span className="shrink-0 mt-0.5 text-neutral-400">
          {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96 pb-5' : 'max-h-0'}`}
      >
        <p className="text-neutral-500 leading-relaxed">{a}</p>
      </div>
    </div>
  )
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { locale } = useT()
  const c = locale === 'ro' ? ro : en

  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [wordIdx, setWordIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setWordIdx(i => (i + 1) % 3), 2500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="scroll-smooth">
      {/* ═══ SECTION 1 — HERO ═══ */}
      {/* -mt-14 trage aurora în spatele header-ului transparent (h-14 = 56px) */}
      <div className="-mt-14">
      <AuroraBackground className="min-h-screen">
        <div className="flex flex-col items-center text-center px-5 w-full max-w-4xl mx-auto" style={{ paddingTop: 'calc(3.5rem + 7rem)', paddingBottom: '7rem' }}>

          {/* Headline */}
          <div style={{ animation: 'heroFadeUp 0.55s 0.08s ease both' }}>
            <h1 className="font-bold text-neutral-900 mb-6" style={{ fontSize: 'clamp(48px, 7.5vw, 84px)', letterSpacing: '-0.035em', lineHeight: 1.0 }}>
              <span className="inline-block overflow-hidden align-bottom" style={{ lineHeight: 1.1 }}>
                <span
                  key={wordIdx}
                  className="inline-block"
                  style={{ animation: 'wordSlideIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards' }}
                >
                  {c.heroWords[wordIdx]}
                </span>
              </span>
              <br />
              {c.heroSuffix}
            </h1>
          </div>

          {/* Description */}
          <div style={{ animation: 'heroFadeUp 0.55s 0.16s ease both' }}>
            <p className="text-neutral-500 mb-9" style={{ fontSize: 17, lineHeight: 1.75, maxWidth: 480 }}>
              {c.heroDesc}
            </p>
          </div>

          {/* CTAs */}
          <div style={{ animation: 'heroFadeUp 0.55s 0.24s ease both' }}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-9">
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl text-[15px] font-semibold text-white bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
              >
                {c.heroCta}
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center gap-1.5 px-6 py-3.5 rounded-xl text-[15px] font-semibold text-neutral-600 border border-neutral-200 bg-white/60 hover:bg-white hover:border-neutral-300 transition-colors"
              >
                {c.heroCtaAlt}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Trust signals */}
          <div style={{ animation: 'heroFadeUp 0.55s 0.32s ease both' }}>
            <div className="flex items-center justify-center flex-wrap gap-x-6 gap-y-2">
              {c.heroMeta.map((item: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[12.5px] text-neutral-400">
                  <span className="w-1 h-1 rounded-full bg-neutral-300 inline-block" />
                  {item}
                </div>
              ))}
            </div>
          </div>

        </div>
      </AuroraBackground>
      </div>

      {/* ═══ SECTION 2 — FEATURES ═══ */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium mb-5">
              {c.featBadge}
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">
              {c.featH2}
            </h2>
            <p className="text-xl text-neutral-500 max-w-2xl mx-auto">{c.featSubtitle}</p>
          </div>

          {/* Feature blocks — order: Agent, Risk Shield, SEO, AI Images */}
          <div className="space-y-16 md:space-y-24">
            <FeatureBlock
              mockup={<AgentMockup locale={locale} />}
              title={c.feat1Title}
              desc={c.feat1Desc}
              bullets={c.feat1Bullets}
              reverse={false}
              detailsHref="/features/ai-agent"
              detailsCta={c.featDetailsCta}
              trialCta={c.featTrialCta}
            />
            <FeatureBlock
              mockup={<RiskMockup locale={locale} />}
              title={c.feat2Title}
              desc={c.feat2Desc}
              bullets={c.feat2Bullets}
              reverse={true}
              detailsHref="/features/risk-shield"
              detailsCta={c.featDetailsCta}
              trialCta={c.featTrialCta}
            />
            <FeatureBlock
              mockup={<SEOMockup locale={locale} />}
              title={c.feat3Title}
              desc={c.feat3Desc}
              bullets={c.feat3Bullets}
              reverse={false}
              detailsHref="/features/seo"
              detailsCta={c.featDetailsCta}
              trialCta={c.featTrialCta}
            />
            <FeatureBlock
              mockup={<ImagesMockup locale={locale} />}
              title={c.feat4Title}
              desc={c.feat4Desc}
              bullets={c.feat4Bullets}
              reverse={true}
              detailsHref="/features/ai-images"
              detailsCta={c.featDetailsCta}
              trialCta={c.featTrialCta}
            />
          </div>
        </div>
      </section>

      {/* ═══ SECTION 3 — COMPARISON ═══ */}
      <BrainComparisonSection c={c} locale={locale} />

      {/* ═══ SECTION 4 — PRICING ═══ */}
      <section id="pricing" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">
              {c.pricingH2}
            </h2>
            <p className="text-xl text-neutral-500 max-w-xl mx-auto">{c.pricingSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {c.plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-6 flex flex-col transition-all duration-200 hover:shadow-lg ${
                  plan.popular
                    ? 'border-neutral-900 shadow-md'
                    : 'border-neutral-200 hover:border-neutral-400'
                }`}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-neutral-900 text-white text-xs font-semibold">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-base font-semibold text-neutral-900 mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-neutral-900">{plan.price}</span>
                    <span className="text-neutral-500 text-sm">{plan.period}</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">{plan.credits}</p>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-neutral-900 shrink-0 mt-0.5" />
                      <span className="text-sm text-neutral-600">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                    plan.popular || plan.name !== 'Free'
                      ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                      : 'bg-white text-neutral-900 border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 6 — FAQ ═══ */}
      <section id="faq" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight">
              {c.faqH2}
            </h2>
          </div>

          <div className="divide-y divide-neutral-100 border-t border-neutral-100">
            {c.faqs.map((faq, i) => (
              <FAQItem
                key={i}
                q={faq.q}
                a={faq.a}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 7 — CTA BANNER ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-950">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-5">
            {c.ctaH2}
          </h2>
          <p className="text-xl text-neutral-400 mb-10 leading-relaxed">
            {c.ctaSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white text-neutral-900 text-base font-semibold hover:bg-neutral-100 transition-colors duration-200 w-full sm:w-auto"
            >
              {c.ctaPrimary}
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-transparent text-white text-base font-semibold border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-900 transition-all duration-200 w-full sm:w-auto"
            >
              {c.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
