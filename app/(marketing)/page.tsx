'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, ChevronUp, Star } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

// ─── Bilingual content ────────────────────────────────────────────────────────

const en = {
  // Hero
  heroBadge: 'Powered by AI & Smart Automation',
  heroTitle: 'A complete ecosystem\nfor your online store',
  heroSubtitle:
    'Generate AI content, optimize SEO, protect against fraud, and automate customer support — all from a single platform connected to your WooCommerce store.',
  heroCta: 'Start for free',
  heroCtaSecondary: 'Sign in',
  heroNote: 'No credit card required · 20 free credits included',

  // Features section
  featBadge: 'Everything in one platform',
  featH2: 'Stop juggling between multiple tools',
  featSubtitle:
    'Four powerful AI modules that work together to grow your online store',

  feat1Title: 'AI Product Images',
  feat1Desc:
    'Generate professional product photos on white background, lifestyle shots, and seasonal visuals — without a photographer or photo studio.',
  feat1Bullets: [
    'White background, lifestyle & seasonal styles',
    'Generate from existing product photos',
    'Bulk generation for entire catalog',
  ],

  feat2Title: 'SEO Optimizer',
  feat2Desc:
    'Automatically optimize product titles, descriptions, and meta tags for search engines. Analyze competitors and rank higher on Google.',
  feat2Bullets: [
    'AI-generated SEO titles & descriptions',
    'Competitor analysis & keyword research',
    'Bulk optimization for all products',
  ],

  feat3Title: 'AI Sales Agent',
  feat3Desc:
    'A 24/7 AI agent that answers customer questions, handles objections, tracks orders, and escalates to you only when needed.',
  feat3Bullets: [
    'Trains on your product catalog automatically',
    'Handles order tracking & FAQs',
    'Escalates complex issues to your team',
  ],

  feat4Title: 'Risk Shield',
  feat4Desc:
    'Detect fraudulent orders before shipping. AI analyzes each customer\'s behavior, address patterns, and order history to assign a risk score.',
  feat4Bullets: [
    'Real-time risk score for every order',
    'Automatic blocking of high-risk customers',
    'Weekly fraud reports & analytics',
  ],

  // Comparison
  compH2: 'Stop paying for 5 different tools',
  compSubtitle:
    'As an online store owner, you normally need separate subscriptions for everything. Hontrio changes that.',
  compOldHeader: '❌ The old way',
  compNewHeader: '✅ With Hontrio',
  compOldTotal: '$256+/month',
  compNewPrice: 'From $19/month',
  compOldPains: [
    '5 separate subscriptions',
    '5 different dashboards to manage',
    'Hours of integration & setup',
  ],
  compNewBenefits: [
    '1 subscription, everything included',
    '1 unified dashboard',
    'Connect WooCommerce in 5 minutes',
  ],
  compCta: 'Start for free',

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
      popular: true,
      dark: false,
    },
    {
      name: 'Professional',
      price: '$49',
      period: '/mo',
      credits: '400 credits/month',
      features: ['Everything in Starter', '400 AI credits/month', 'AI Sales Agent', 'Risk Shield', 'Competitor analysis', 'Bulk operations'],
      cta: 'Get Professional',
      popular: false,
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
      a: 'Install our free plugin from the WordPress repository, enter your store URL in Hontrio, and your products sync automatically in minutes. No technical knowledge required.',
    },
    {
      q: 'What are credits and how many do I need?',
      a: 'Credits are the AI usage currency. One SEO optimization costs 3 credits, one AI image costs 6-8 credits. Most stores use between 50-300 credits per month depending on catalog size.',
    },
    {
      q: 'Is there a free trial?',
      a: 'Yes! You get 20 free credits when you create your account — no credit card required. This is enough to optimize around 6 products or generate 3 AI images and see the results for yourself.',
    },
    {
      q: 'Can I cancel my subscription anytime?',
      a: 'Absolutely. There are no long-term contracts or cancellation fees. You can cancel your subscription at any time from your account settings, and you\'ll keep access until the end of your billing period.',
    },
    {
      q: 'What languages does the AI generate content in?',
      a: 'Hontrio generates content in the language you set in your brand settings. Currently fully supported: Romanian and English. More languages are coming soon.',
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
  ctaPrimary: 'Start for free — no card required',
  ctaSecondary: 'Sign in',
}

const ro = {
  // Hero
  heroBadge: 'Alimentat de AI & Automatizare Inteligentă',
  heroTitle: 'Un ecosistem complet\npentru magazinul tău online',
  heroSubtitle:
    'Generează conținut AI, optimizează SEO, protejează-te de fraudă și automatizează suportul clienților — totul dintr-o singură platformă conectată la magazinul tău WooCommerce.',
  heroCta: 'Începe gratuit',
  heroCtaSecondary: 'Conectează-te',
  heroNote: 'Fără card bancar · 20 credite gratuite incluse',

  // Features section
  featBadge: 'Totul într-o singură platformă',
  featH2: 'Oprește-te din gestionarea mai multor unelte',
  featSubtitle:
    'Patru module AI puternice care lucrează împreună pentru a-ți crește magazinul online',

  feat1Title: 'Imagini AI pentru Produse',
  feat1Desc:
    'Generează fotografii profesionale de produs pe fundal alb, lifestyle și sezoniere — fără fotograf sau studio foto.',
  feat1Bullets: [
    'Fundal alb, lifestyle și stiluri sezoniere',
    'Generare din fotografii existente',
    'Generare în masă pentru întreg catalogul',
  ],

  feat2Title: 'Optimizator SEO',
  feat2Desc:
    'Optimizează automat titlurile produselor, descrierile și meta tag-urile pentru motoarele de căutare. Analizează competitorii și urcă în Google.',
  feat2Bullets: [
    'Titluri & descrieri SEO generate cu AI',
    'Analiză competitori & cercetare cuvinte cheie',
    'Optimizare în masă pentru toate produsele',
  ],

  feat3Title: 'Agent AI de Vânzări',
  feat3Desc:
    'Un agent AI disponibil 24/7 care răspunde la întrebările clienților, gestionează obiecțiile, urmărește comenzile și escaladează la tine doar când e nevoie.',
  feat3Bullets: [
    'Se antrenează automat pe catalogul tău',
    'Gestionează tracking comenzi & FAQ-uri',
    'Escaladează probleme complexe la echipa ta',
  ],

  feat4Title: 'Risk Shield',
  feat4Desc:
    'Detectează comenzile frauduloase înainte de expediere. AI-ul analizează comportamentul fiecărui client, adresele și istoricul comenzilor pentru un scor de risc.',
  feat4Bullets: [
    'Scor de risc în timp real pentru fiecare comandă',
    'Blocare automată a clienților cu risc ridicat',
    'Rapoarte săptămânale de fraudă & analiză',
  ],

  // Comparison
  compH2: 'Oprește-te să plătești pentru 5 unelte diferite',
  compSubtitle:
    'Ca proprietar de magazin online, în mod normal ai nevoie de abonamente separate pentru fiecare lucru. Hontrio schimbă asta.',
  compOldHeader: '❌ Cum era înainte',
  compNewHeader: '✅ Cu Hontrio',
  compOldTotal: '$256+/lună',
  compNewPrice: 'De la $19/lună',
  compOldPains: [
    '5 abonamente separate',
    '5 dashboard-uri diferite de gestionat',
    'Ore de integrare & configurare',
  ],
  compNewBenefits: [
    '1 abonament, totul inclus',
    '1 dashboard unificat',
    'Conectează WooCommerce în 5 minute',
  ],
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
      popular: true,
      dark: false,
    },
    {
      name: 'Professional',
      price: '$49',
      period: '/lună',
      credits: '400 credite/lună',
      features: ['Tot din Starter', '400 credite AI/lună', 'Agent AI de vânzări', 'Risk Shield', 'Analiză competitori', 'Operații în masă'],
      cta: 'Alege Professional',
      popular: false,
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
      a: 'Instalați pluginul nostru gratuit din repository-ul WordPress, introduceți URL-ul magazinului în Hontrio, și produsele se sincronizează automat în câteva minute. Nu sunt necesare cunoștințe tehnice.',
    },
    {
      q: 'Ce sunt creditele și de câte am nevoie?',
      a: 'Creditele sunt moneda de utilizare AI. O optimizare SEO costă 3 credite, o imagine AI costă 6-8 credite. Majoritatea magazinelor folosesc între 50-300 credite pe lună în funcție de dimensiunea catalogului.',
    },
    {
      q: 'Există o perioadă de probă gratuită?',
      a: 'Da! Primești 20 credite gratuite când îți creezi contul — fără card bancar. Este suficient pentru a optimiza aproximativ 6 produse sau a genera 3 imagini AI și a vedea rezultatele.',
    },
    {
      q: 'Pot anula abonamentul oricând?',
      a: 'Absolut. Nu există contracte pe termen lung sau taxe de anulare. Poți anula abonamentul oricând din setările contului, și vei păstra accesul până la sfârșitul perioadei de facturare.',
    },
    {
      q: 'În ce limbi generează AI-ul conținut?',
      a: 'Hontrio generează conținut în limba pe care o setezi în setările brandului. Suportate complet în prezent: română și engleză. Mai multe limbi urmează în curând.',
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
  ctaPrimary: 'Începe gratuit — fără card',
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
        <span className="text-xs text-neutral-500 font-medium">Dashboard — Hontrio</span>
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

function ImagesMockup() {
  return (
    <div className="bg-neutral-950 rounded-2xl p-5 shadow-2xl border border-neutral-800 w-full max-w-sm mx-auto">
      <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-4">AI Image Generator</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          'from-neutral-800 to-neutral-700',
          'from-neutral-700 to-neutral-600',
          'from-neutral-800 to-neutral-600',
          'from-neutral-700 to-neutral-800',
        ].map((grad, i) => (
          <div
            key={i}
            className={`aspect-square rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center`}
          >
            {i === 1 && (
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                <div className="h-4 w-4 rounded bg-white/20" />
              </div>
            )}
            {i === 3 && (
              <div className="text-[8px] text-neutral-500 font-medium">Generating...</div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex-1 h-8 rounded-lg bg-neutral-800 flex items-center px-3">
          <span className="text-[10px] text-neutral-500">White background</span>
        </div>
        <button className="h-8 px-4 rounded-lg bg-white text-neutral-900 text-[10px] font-semibold">
          Generate
        </button>
      </div>
    </div>
  )
}

function SEOMockup() {
  return (
    <div className="bg-neutral-950 rounded-2xl p-5 shadow-2xl border border-neutral-800 w-full max-w-sm mx-auto">
      <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-4">SEO Score</p>
      <div className="flex items-center justify-center mb-5">
        <div className="relative">
          <svg className="h-24 w-24" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#262626"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#34d399"
              strokeWidth="3"
              strokeDasharray="87, 100"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-emerald-400">87</span>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {[
          { label: 'Title', value: 95, color: 'bg-emerald-500' },
          { label: 'Description', value: 82, color: 'bg-emerald-500' },
          { label: 'Keywords', value: 74, color: 'bg-yellow-500' },
        ].map((bar) => (
          <div key={bar.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-neutral-400">{bar.label}</span>
              <span className="text-[10px] text-neutral-400">{bar.value}%</span>
            </div>
            <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${bar.color}`}
                style={{ width: `${bar.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentMockup() {
  return (
    <div className="bg-neutral-950 rounded-2xl p-5 shadow-2xl border border-neutral-800 w-full max-w-sm mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
          <span className="text-[8px] font-bold text-white">AI</span>
        </div>
        <p className="text-[10px] font-semibold text-neutral-300">AI Sales Agent</p>
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </div>
      <div className="space-y-3">
        {/* Customer message */}
        <div className="flex justify-end">
          <div className="bg-neutral-800 rounded-2xl rounded-tr-sm px-3 py-2 max-w-[75%]">
            <p className="text-[10px] text-neutral-200">Bună! Unde este comanda mea #8821?</p>
          </div>
        </div>
        {/* Agent response */}
        <div className="flex justify-start">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]">
            <p className="text-[10px] text-neutral-300">Comanda #8821 este în livrare! Estimat: mâine 10-14h. Număr AWB: 8RO22941.</p>
          </div>
        </div>
        {/* Customer */}
        <div className="flex justify-end">
          <div className="bg-neutral-800 rounded-2xl rounded-tr-sm px-3 py-2 max-w-[75%]">
            <p className="text-[10px] text-neutral-200">Mulțumesc!</p>
          </div>
        </div>
        {/* Typing */}
        <div className="flex justify-start">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl px-3 py-2">
            <div className="flex gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RiskMockup() {
  return (
    <div className="bg-neutral-950 rounded-2xl p-5 shadow-2xl border border-neutral-800 w-full max-w-sm mx-auto">
      <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-4">Risk Analysis</p>
      <div className="flex items-center gap-4 mb-5">
        <div className="relative shrink-0">
          <svg className="h-20 w-20" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#262626"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#ef4444"
              strokeWidth="3"
              strokeDasharray="87, 100"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-red-400">87</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-neutral-200">Ionescu C.</p>
          <p className="text-[10px] text-neutral-500 mb-2">București, RO</p>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 border border-red-800/50">
              Adresă suspectă
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-900/50 text-orange-400 border border-orange-800/50">
              3 ramburs refuzat
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 border border-red-800/50">
              IP diferit
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 h-8 rounded-lg bg-red-900/30 border border-red-800/50 flex items-center justify-center">
          <span className="text-[10px] text-red-400 font-medium">Block order</span>
        </div>
        <div className="flex-1 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
          <span className="text-[10px] text-neutral-400 font-medium">Review</span>
        </div>
      </div>
    </div>
  )
}

// ─── Feature Block ────────────────────────────────────────────────────────────

function FeatureBlock({
  mockup,
  title,
  desc,
  bullets,
  reverse,
}: {
  mockup: React.ReactNode
  title: string
  desc: string
  bullets: string[]
  reverse?: boolean
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
        <ul className="space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-neutral-900 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="h-3 w-3 text-white" />
              </div>
              <span className="text-neutral-600 text-sm leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
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

  return (
    <div className="scroll-smooth">
      {/* ═══ SECTION 1 — HERO ═══ */}
      <section className="min-h-[90vh] flex flex-col items-center justify-center bg-white py-32 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-900 text-white text-xs font-medium mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {c.heroBadge}
          </div>

          {/* H1 */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-neutral-900 tracking-tight leading-[1.08] mb-6 whitespace-pre-line">
            {c.heroTitle}
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-neutral-500 max-w-2xl mx-auto leading-relaxed mb-10">
            {c.heroSubtitle}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-5">
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-neutral-900 text-white text-base font-semibold hover:bg-neutral-800 transition-colors duration-200 w-full sm:w-auto"
            >
              {c.heroCta}
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white text-neutral-900 text-base font-semibold border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-all duration-200 w-full sm:w-auto"
            >
              {c.heroCtaSecondary}
            </Link>
          </div>

          {/* Note */}
          <p className="text-sm text-neutral-400">{c.heroNote}</p>

          {/* Dashboard Mockup */}
          <div className="mt-16">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ═══ SECTION 2 — FEATURES ═══ */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium mb-5">
              {c.featBadge}
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">
              {c.featH2}
            </h2>
            <p className="text-xl text-neutral-500 max-w-2xl mx-auto">{c.featSubtitle}</p>
          </div>

          {/* Feature blocks */}
          <div className="space-y-24">
            <FeatureBlock
              mockup={<ImagesMockup />}
              title={c.feat1Title}
              desc={c.feat1Desc}
              bullets={c.feat1Bullets}
              reverse={false}
            />
            <FeatureBlock
              mockup={<SEOMockup />}
              title={c.feat2Title}
              desc={c.feat2Desc}
              bullets={c.feat2Bullets}
              reverse={true}
            />
            <FeatureBlock
              mockup={<AgentMockup />}
              title={c.feat3Title}
              desc={c.feat3Desc}
              bullets={c.feat3Bullets}
              reverse={false}
            />
            <FeatureBlock
              mockup={<RiskMockup />}
              title={c.feat4Title}
              desc={c.feat4Desc}
              bullets={c.feat4Bullets}
              reverse={true}
            />
          </div>
        </div>
      </section>

      {/* ═══ SECTION 3 — COMPARISON ═══ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">
              {c.compH2}
            </h2>
            <p className="text-xl text-neutral-500 max-w-2xl mx-auto">{c.compSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OLD WAY */}
            <div className="bg-neutral-100 rounded-2xl p-8">
              <h3 className="text-lg font-semibold text-neutral-700 mb-6">{c.compOldHeader}</h3>
              <div className="space-y-3 mb-6">
                {[
                  { name: 'AI Copywriter (Jasper/Copy.ai)', price: '$39/mo' },
                  { name: 'SEO Platform (Semrush)', price: '$99/mo' },
                  { name: 'AI Image Generator (Midjourney)', price: '$30/mo' },
                  { name: 'Customer Chatbot (Tidio)', price: '$49/mo' },
                  { name: 'Fraud Detection Tool', price: '$39/mo' },
                ].map((tool) => (
                  <div key={tool.name} className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">{tool.name}</span>
                    <span className="text-sm font-medium text-neutral-500">{tool.price}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-neutral-200 pt-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-700">Total</span>
                  <span className="text-2xl font-bold text-neutral-900">{c.compOldTotal}</span>
                </div>
              </div>
              <div className="space-y-2">
                {c.compOldPains.map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <span className="text-red-500 text-sm">❌</span>
                    <span className="text-sm text-neutral-600">{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* WITH HONTRIO */}
            <div className="bg-neutral-950 rounded-2xl p-8 text-white">
              <h3 className="text-lg font-semibold text-emerald-400 mb-6">{c.compNewHeader}</h3>
              <div className="space-y-3 mb-6">
                {[
                  'AI Images',
                  'SEO Optimizer',
                  'AI Agent',
                  'Risk Shield',
                  'WooCommerce Integration',
                  'Analytics Dashboard',
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-sm text-neutral-300">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-neutral-800 pt-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-400">Total</span>
                  <span className="text-2xl font-bold text-white">{c.compNewPrice}</span>
                </div>
              </div>
              <div className="space-y-2 mb-8">
                {c.compNewBenefits.map((b) => (
                  <div key={b} className="flex items-center gap-2">
                    <span className="text-emerald-400 text-sm">✅</span>
                    <span className="text-sm text-neutral-300">{b}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/register"
                className="block w-full text-center py-3 rounded-xl bg-white text-neutral-900 text-sm font-semibold hover:bg-neutral-100 transition-colors duration-200"
              >
                {c.compCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 4 — PRICING ═══ */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
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

      {/* ═══ SECTION 5 — TESTIMONIALS ═══ */}
      <section id="testimonials" className="py-24 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight">
              {c.testimonialsH2}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {c.testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-7 flex flex-col gap-4"
              >
                {/* Stars */}
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-neutral-700 leading-relaxed italic flex-1">"{t.quote}"</p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-2 border-t border-neutral-50">
                  <div className="h-10 w-10 rounded-full bg-neutral-900 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-white">{t.initials}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{t.name}</p>
                    <p className="text-xs text-neutral-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 6 — FAQ ═══ */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
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
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-neutral-950">
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
