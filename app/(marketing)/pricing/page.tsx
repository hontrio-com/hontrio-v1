'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, X, Zap, Building2, Rocket, ChevronDown,
  Wand2, Bot, TrendingUp, ShieldCheck, Headphones, Globe, BarChart3, Users,
} from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

// ─── Bilingual content ────────────────────────────────────────────────────────

const en = {
  badge: 'Transparent pricing',
  h1a: 'One plan for every',
  h1b: 'stage of your store',
  subtitle: 'Start free, upgrade when you grow. No hidden fees, no contracts. Cancel anytime.',
  monthly: 'Monthly',
  annually: 'Annually',
  save: 'Save 35%',
  mostPopular: 'Most popular',
  perMonth: '/mo',
  billedAnnually: 'billed annually',
  billedMonthly: 'billed monthly',
  getStarted: 'Get started free',
  startTrial: 'Start free trial',
  contactSales: 'Contact sales',
  currentPlan: 'Current plan',
  plans: [
    {
      id: 'starter',
      icon: Rocket,
      name: 'Starter',
      tagline: 'For stores just getting started',
      priceMonthly: 0,
      priceAnnually: 0,
      priceSuffix: '',
      isFree: true,
      cta: 'Get started free',
      highlight: false,
      features: [
        { text: '30 AI images / month', included: true },
        { text: 'SEO optimizer — 20 products / month', included: true },
        { text: 'AI Agent (chat widget)', included: false },
        { text: 'Risk Shield fraud detection', included: false },
        { text: '1 WooCommerce store', included: true },
        { text: 'Email support', included: true },
        { text: 'Analytics dashboard', included: false },
        { text: 'Priority support', included: false },
      ],
    },
    {
      id: 'pro',
      icon: Zap,
      name: 'Pro',
      tagline: 'For growing stores that want results',
      priceMonthly: 39,
      priceAnnually: 25,
      priceSuffix: '€',
      isFree: false,
      cta: 'Start free trial',
      highlight: true,
      features: [
        { text: 'Unlimited AI images', included: true },
        { text: 'SEO optimizer — unlimited', included: true },
        { text: 'AI Agent (chat widget)', included: true },
        { text: 'Risk Shield fraud detection', included: false },
        { text: '1 WooCommerce store', included: true },
        { text: 'Email & chat support', included: true },
        { text: 'Analytics dashboard', included: true },
        { text: 'Priority support', included: false },
      ],
    },
    {
      id: 'business',
      icon: Building2,
      name: 'Business',
      tagline: 'For established stores with high volume',
      priceMonthly: 79,
      priceAnnually: 51,
      priceSuffix: '€',
      isFree: false,
      cta: 'Start free trial',
      highlight: false,
      features: [
        { text: 'Unlimited AI images', included: true },
        { text: 'SEO optimizer — unlimited', included: true },
        { text: 'AI Agent (chat widget)', included: true },
        { text: 'Risk Shield fraud detection', included: true },
        { text: 'Up to 5 WooCommerce stores', included: true },
        { text: 'Email, chat & phone support', included: true },
        { text: 'Analytics dashboard', included: true },
        { text: 'Priority support', included: true },
      ],
    },
  ],
  comparisonTitle: 'Full feature comparison',
  comparisonSub: 'Every detail, side by side.',
  categories: [
    {
      label: 'AI Images',
      icon: Wand2,
      rows: [
        { feature: 'AI-generated product photos', starter: '30 / mo', pro: 'Unlimited', business: 'Unlimited' },
        { feature: 'Background removal', starter: true, pro: true, business: true },
        { feature: 'Batch processing', starter: false, pro: true, business: true },
        { feature: 'Custom style presets', starter: false, pro: true, business: true },
      ],
    },
    {
      label: 'SEO Optimizer',
      icon: TrendingUp,
      rows: [
        { feature: 'Products optimized / month', starter: '20', pro: 'Unlimited', business: 'Unlimited' },
        { feature: 'Title & description generation', starter: true, pro: true, business: true },
        { feature: 'Meta description & keywords', starter: false, pro: true, business: true },
        { feature: 'Bulk optimization', starter: false, pro: true, business: true },
        { feature: 'SEO score analytics', starter: false, pro: true, business: true },
      ],
    },
    {
      label: 'AI Agent',
      icon: Bot,
      rows: [
        { feature: 'Chat widget for your store', starter: false, pro: true, business: true },
        { feature: 'Trained on your catalog', starter: false, pro: true, business: true },
        { feature: 'Custom branding', starter: false, pro: false, business: true },
        { feature: 'Conversation analytics', starter: false, pro: true, business: true },
      ],
    },
    {
      label: 'Risk Shield',
      icon: ShieldCheck,
      rows: [
        { feature: 'Fraud order detection', starter: false, pro: false, business: true },
        { feature: 'Real-time risk scoring', starter: false, pro: false, business: true },
        { feature: 'Automatic order blocking', starter: false, pro: false, business: true },
        { feature: 'Fraud reports', starter: false, pro: false, business: true },
      ],
    },
    {
      label: 'Platform & Support',
      icon: Headphones,
      rows: [
        { feature: 'WooCommerce stores', starter: '1', pro: '1', business: 'Up to 5' },
        { feature: 'Analytics dashboard', starter: false, pro: true, business: true },
        { feature: 'Email support', starter: true, pro: true, business: true },
        { feature: 'Live chat support', starter: false, pro: true, business: true },
        { feature: 'Priority support', starter: false, pro: false, business: true },
        { feature: 'Onboarding session', starter: false, pro: false, business: true },
      ],
    },
  ],
  faqTitle: 'Frequently asked questions',
  faqSub: 'Still have questions? We\'re happy to help.',
  faqs: [
    {
      q: 'Is there a free trial?',
      a: 'Yes. The Pro and Business plans come with a 14-day free trial — no credit card required. You can explore all features and upgrade only if you love it.',
    },
    {
      q: 'Can I change my plan at any time?',
      a: 'Absolutely. You can upgrade, downgrade or cancel your plan at any time from your account dashboard. Changes take effect immediately.',
    },
    {
      q: 'What happens when I reach the Starter limits?',
      a: "When you hit the monthly limits on the Starter plan, features pause until the next month. You'll receive a notification so you can decide if you'd like to upgrade.",
    },
    {
      q: 'Do you support multiple WooCommerce stores?',
      a: 'The Business plan supports up to 5 WooCommerce stores under a single account. Need more? Contact our sales team for a custom plan.',
    },
    {
      q: 'Is my data safe?',
      a: 'All data is encrypted in transit and at rest. We are GDPR compliant and never share your store data with third parties. You own your data.',
    },
    {
      q: 'What payment methods do you accept?',
      a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex) as well as bank transfers for annual plans. Invoices are issued automatically.',
    },
  ],
  ctaTitle: 'Ready to grow your store?',
  ctaSub: 'Join 500+ stores already using Hontrio. Start free — no credit card needed.',
  ctaBtn: 'Get started free →',
  ctaAlt: 'Or talk to sales',
}

const ro = {
  badge: 'Prețuri transparente',
  h1a: 'Un plan pentru fiecare',
  h1b: 'etapă a magazinului tău',
  subtitle: 'Începe gratuit, upgradează pe măsură ce crești. Fără costuri ascunse, fără contracte. Anulează oricând.',
  monthly: 'Lunar',
  annually: 'Anual',
  save: 'Economisești 35%',
  mostPopular: 'Cel mai popular',
  perMonth: '/lună',
  billedAnnually: 'facturat anual',
  billedMonthly: 'facturat lunar',
  getStarted: 'Începe gratuit',
  startTrial: 'Încearcă gratuit 14 zile',
  contactSales: 'Contactează vânzări',
  currentPlan: 'Planul curent',
  plans: [
    {
      id: 'starter',
      icon: Rocket,
      name: 'Starter',
      tagline: 'Pentru magazinele la început de drum',
      priceMonthly: 0,
      priceAnnually: 0,
      priceSuffix: '',
      isFree: true,
      cta: 'Începe gratuit',
      highlight: false,
      features: [
        { text: '30 imagini AI / lună', included: true },
        { text: 'SEO optimizer — 20 produse / lună', included: true },
        { text: 'Agent AI (widget chat)', included: false },
        { text: 'Risk Shield detecție fraude', included: false },
        { text: '1 magazin WooCommerce', included: true },
        { text: 'Suport email', included: true },
        { text: 'Dashboard analitics', included: false },
        { text: 'Suport prioritar', included: false },
      ],
    },
    {
      id: 'pro',
      icon: Zap,
      name: 'Pro',
      tagline: 'Pentru magazinele în creștere care vor rezultate',
      priceMonthly: 39,
      priceAnnually: 25,
      priceSuffix: '€',
      isFree: false,
      cta: 'Încearcă gratuit 14 zile',
      highlight: true,
      features: [
        { text: 'Imagini AI nelimitate', included: true },
        { text: 'SEO optimizer — nelimitat', included: true },
        { text: 'Agent AI (widget chat)', included: true },
        { text: 'Risk Shield detecție fraude', included: false },
        { text: '1 magazin WooCommerce', included: true },
        { text: 'Suport email & chat', included: true },
        { text: 'Dashboard analitics', included: true },
        { text: 'Suport prioritar', included: false },
      ],
    },
    {
      id: 'business',
      icon: Building2,
      name: 'Business',
      tagline: 'Pentru magazinele consacrate cu volum mare',
      priceMonthly: 79,
      priceAnnually: 51,
      priceSuffix: '€',
      isFree: false,
      cta: 'Încearcă gratuit 14 zile',
      highlight: false,
      features: [
        { text: 'Imagini AI nelimitate', included: true },
        { text: 'SEO optimizer — nelimitat', included: true },
        { text: 'Agent AI (widget chat)', included: true },
        { text: 'Risk Shield detecție fraude', included: true },
        { text: 'Până la 5 magazine WooCommerce', included: true },
        { text: 'Suport email, chat & telefon', included: true },
        { text: 'Dashboard analitics', included: true },
        { text: 'Suport prioritar', included: true },
      ],
    },
  ],
  comparisonTitle: 'Comparație completă a funcțiilor',
  comparisonSub: 'Fiecare detaliu, față în față.',
  categories: [
    {
      label: 'Imagini AI',
      icon: Wand2,
      rows: [
        { feature: 'Fotografii generate cu AI', starter: '30 / lună', pro: 'Nelimitat', business: 'Nelimitat' },
        { feature: 'Eliminare fundal', starter: true, pro: true, business: true },
        { feature: 'Procesare în lot', starter: false, pro: true, business: true },
        { feature: 'Stiluri personalizate', starter: false, pro: true, business: true },
      ],
    },
    {
      label: 'SEO Optimizer',
      icon: TrendingUp,
      rows: [
        { feature: 'Produse optimizate / lună', starter: '20', pro: 'Nelimitat', business: 'Nelimitat' },
        { feature: 'Generare titlu & descriere', starter: true, pro: true, business: true },
        { feature: 'Meta descriere & cuvinte cheie', starter: false, pro: true, business: true },
        { feature: 'Optimizare în lot', starter: false, pro: true, business: true },
        { feature: 'Analitics scor SEO', starter: false, pro: true, business: true },
      ],
    },
    {
      label: 'Agent AI',
      icon: Bot,
      rows: [
        { feature: 'Widget chat pentru magazin', starter: false, pro: true, business: true },
        { feature: 'Antrenat pe catalogul tău', starter: false, pro: true, business: true },
        { feature: 'Branding personalizat', starter: false, pro: false, business: true },
        { feature: 'Analitics conversații', starter: false, pro: true, business: true },
      ],
    },
    {
      label: 'Risk Shield',
      icon: ShieldCheck,
      rows: [
        { feature: 'Detectare comenzi frauduloase', starter: false, pro: false, business: true },
        { feature: 'Scor de risc în timp real', starter: false, pro: false, business: true },
        { feature: 'Blocare automată comenzi', starter: false, pro: false, business: true },
        { feature: 'Rapoarte fraude', starter: false, pro: false, business: true },
      ],
    },
    {
      label: 'Platformă & Suport',
      icon: Headphones,
      rows: [
        { feature: 'Magazine WooCommerce', starter: '1', pro: '1', business: 'Până la 5' },
        { feature: 'Dashboard analitics', starter: false, pro: true, business: true },
        { feature: 'Suport email', starter: true, pro: true, business: true },
        { feature: 'Suport live chat', starter: false, pro: true, business: true },
        { feature: 'Suport prioritar', starter: false, pro: false, business: true },
        { feature: 'Sesiune de onboarding', starter: false, pro: false, business: true },
      ],
    },
  ],
  faqTitle: 'Întrebări frecvente',
  faqSub: 'Mai ai întrebări? Suntem bucuroși să ajutăm.',
  faqs: [
    {
      q: 'Există o perioadă de probă gratuită?',
      a: 'Da. Planurile Pro și Business includ 14 zile de probă gratuită — fără card de credit. Explorezi toate funcțiile și upgradezi doar dacă ești mulțumit.',
    },
    {
      q: 'Pot schimba planul oricând?',
      a: 'Absolut. Poți face upgrade, downgrade sau anula planul oricând din panoul de cont. Modificările intră în vigoare imediat.',
    },
    {
      q: 'Ce se întâmplă când ating limitele planului Starter?',
      a: 'Când atingi limitele lunare ale planului Starter, funcțiile se opresc până luna viitoare. Vei primi o notificare pentru a decide dacă dorești să faci upgrade.',
    },
    {
      q: 'Susțineți mai multe magazine WooCommerce?',
      a: 'Planul Business suportă până la 5 magazine WooCommerce sub un singur cont. Ai nevoie de mai multe? Contactează echipa noastră pentru un plan personalizat.',
    },
    {
      q: 'Datele mele sunt în siguranță?',
      a: 'Toate datele sunt criptate în tranzit și în repaus. Suntem conformi GDPR și nu partajăm niciodată datele magazinului tău cu terțe părți. Tu ești proprietarul datelor.',
    },
    {
      q: 'Ce metode de plată acceptați?',
      a: 'Acceptăm toate cardurile principale de credit și debit (Visa, Mastercard, Amex) precum și transfer bancar pentru planurile anuale. Facturile sunt emise automat.',
    },
  ],
  ctaTitle: 'Gata să îți crești magazinul?',
  ctaSub: 'Alătură-te celor 500+ magazine care folosesc deja Hontrio. Începe gratuit — fără card de credit.',
  ctaBtn: 'Începe gratuit →',
  ctaAlt: 'Sau vorbește cu echipa de vânzări',
}

// ─── FAQ Accordion item ───────────────────────────────────────────────────────
function FaqItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-neutral-200 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[15px] font-semibold text-neutral-900">{q}</span>
        <ChevronDown
          className={`shrink-0 h-4 w-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-[14.5px] text-neutral-500 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Cell helper for comparison table ────────────────────────────────────────
function Cell({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value
      ? <Check className="h-4.5 w-4.5 text-neutral-900 mx-auto" />
      : <X className="h-4 w-4 text-neutral-300 mx-auto" />
  }
  return <span className="text-[13px] font-medium text-neutral-700">{value}</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const { locale } = useLocale()
  const t = locale === 'ro' ? ro : en

  const [annually, setAnnually] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="bg-white">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-16 px-4 sm:px-6">
        {/* Background aurora */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -10%, #dbeafe 0%, transparent 70%)',
            }}
          />
        </div>

        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-neutral-200 bg-white text-[12px] font-semibold text-neutral-500 uppercase tracking-widest mb-6 shadow-sm">
              {t.badge}
            </span>
            <h1 className="text-[2.6rem] sm:text-[3.2rem] font-extrabold text-neutral-950 leading-[1.1] tracking-tight">
              {t.h1a}{' '}
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                  {t.h1b}
                </span>
              </span>
            </h1>
            <p className="mt-5 text-[17px] text-neutral-500 leading-relaxed max-w-xl mx-auto">
              {t.subtitle}
            </p>
          </motion.div>

          {/* Monthly / Annually toggle */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="mt-8 inline-flex items-center gap-3"
          >
            <span className={`text-[14px] font-medium transition-colors ${!annually ? 'text-neutral-900' : 'text-neutral-400'}`}>
              {t.monthly}
            </span>
            <button
              onClick={() => setAnnually(!annually)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${annually ? 'bg-neutral-900' : 'bg-neutral-200'}`}
              aria-label="Toggle billing"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${annually ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
            <span className={`text-[14px] font-medium transition-colors flex items-center gap-2 ${annually ? 'text-neutral-900' : 'text-neutral-400'}`}>
              {t.annually}
              <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-700 rounded-full">
                {t.save}
              </span>
            </span>
          </motion.div>
        </div>
      </section>

      {/* ── Pricing Cards ──────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {t.plans.map((plan, i) => {
            const Icon = plan.icon
            const price = annually ? plan.priceAnnually : plan.priceMonthly
            const isHighlight = plan.highlight

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.05 * i }}
                className={`relative rounded-2xl flex flex-col ${
                  isHighlight
                    ? 'bg-neutral-950 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_60px_rgba(0,0,0,0.25)] scale-[1.02]'
                    : 'bg-white border border-neutral-200 shadow-[0_2px_16px_rgba(0,0,0,0.04)]'
                }`}
              >
                {isHighlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-1 text-[11px] font-bold uppercase tracking-widest bg-blue-500 text-white rounded-full shadow-lg">
                      {t.mostPopular}
                    </span>
                  </div>
                )}

                <div className="p-7 flex-1">
                  {/* Icon + name */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isHighlight ? 'bg-white/10' : 'bg-neutral-100'}`}>
                      <Icon className={`h-[18px] w-[18px] ${isHighlight ? 'text-white' : 'text-neutral-700'}`} />
                    </div>
                    <div>
                      <p className={`text-[15px] font-bold ${isHighlight ? 'text-white' : 'text-neutral-900'}`}>{plan.name}</p>
                      <p className={`text-[12px] ${isHighlight ? 'text-white/50' : 'text-neutral-400'}`}>{plan.tagline}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-end gap-1">
                      {plan.isFree ? (
                        <span className={`text-[2.6rem] font-extrabold leading-none ${isHighlight ? 'text-white' : 'text-neutral-950'}`}>
                          Free
                        </span>
                      ) : (
                        <>
                          <span className={`text-[15px] font-semibold mt-2 ${isHighlight ? 'text-white/60' : 'text-neutral-400'}`}>{plan.priceSuffix}</span>
                          <span className={`text-[2.6rem] font-extrabold leading-none ${isHighlight ? 'text-white' : 'text-neutral-950'}`}>
                            {price}
                          </span>
                          <span className={`text-[13px] mb-1.5 ${isHighlight ? 'text-white/50' : 'text-neutral-400'}`}>{t.perMonth}</span>
                        </>
                      )}
                    </div>
                    {!plan.isFree && (
                      <p className={`text-[12px] mt-1 ${isHighlight ? 'text-white/40' : 'text-neutral-400'}`}>
                        {annually ? t.billedAnnually : t.billedMonthly}
                      </p>
                    )}
                  </div>

                  {/* Features list */}
                  <ul className="space-y-3">
                    {plan.features.map((f, fi) => (
                      <li key={fi} className="flex items-start gap-2.5">
                        {f.included
                          ? <Check className={`shrink-0 h-4 w-4 mt-0.5 ${isHighlight ? 'text-blue-400' : 'text-neutral-900'}`} />
                          : <X className={`shrink-0 h-4 w-4 mt-0.5 ${isHighlight ? 'text-white/20' : 'text-neutral-300'}`} />
                        }
                        <span className={`text-[13.5px] ${f.included ? (isHighlight ? 'text-white/90' : 'text-neutral-700') : (isHighlight ? 'text-white/35' : 'text-neutral-400')}`}>
                          {f.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="px-7 pb-7">
                  <Link
                    href={plan.isFree ? '/register' : '/register?plan=' + plan.id + (annually ? '&billing=annual' : '')}
                    className={`flex items-center justify-center w-full px-5 py-3 rounded-[10px] text-[14px] font-semibold transition-all duration-150 ${
                      isHighlight
                        ? 'bg-white text-neutral-950 hover:bg-neutral-100 shadow-[0_2px_8px_rgba(255,255,255,0.15)]'
                        : plan.isFree
                          ? 'bg-neutral-950 text-white hover:bg-neutral-800'
                          : 'bg-neutral-950 text-white hover:bg-neutral-800'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Trust line */}
        <p className="text-center text-[13px] text-neutral-400 mt-8">
          14-day free trial · No credit card required · Cancel anytime
        </p>
      </section>

      {/* ── Full comparison table ──────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-[1.9rem] font-extrabold text-neutral-950 tracking-tight">{t.comparisonTitle}</h2>
          <p className="text-[16px] text-neutral-500 mt-2">{t.comparisonSub}</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_80px] sm:grid-cols-[1fr_120px_120px_120px] bg-neutral-50 border-b border-neutral-200">
            <div className="p-4" />
            {['Starter', 'Pro', 'Business'].map((name) => (
              <div key={name} className={`p-4 text-center text-[12px] font-bold uppercase tracking-widest ${name === 'Pro' ? 'text-blue-600' : 'text-neutral-500'}`}>
                {name}
              </div>
            ))}
          </div>

          {/* Category rows */}
          {t.categories.map((cat, ci) => {
            const CatIcon = cat.icon
            return (
              <div key={ci}>
                {/* Category label */}
                <div className="grid grid-cols-[1fr_80px_80px_80px] sm:grid-cols-[1fr_120px_120px_120px] bg-neutral-50/60 border-b border-neutral-100">
                  <div className="px-4 py-3 flex items-center gap-2">
                    <CatIcon className="h-3.5 w-3.5 text-neutral-400" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">{cat.label}</span>
                  </div>
                  <div /><div /><div />
                </div>

                {/* Feature rows */}
                {cat.rows.map((row, ri) => (
                  <div
                    key={ri}
                    className="grid grid-cols-[1fr_80px_80px_80px] sm:grid-cols-[1fr_120px_120px_120px] border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/40 transition-colors"
                  >
                    <div className="px-4 py-3.5 text-[13.5px] text-neutral-600">{row.feature}</div>
                    <div className="px-4 py-3.5 flex items-center justify-center"><Cell value={row.starter} /></div>
                    <div className="px-4 py-3.5 flex items-center justify-center bg-blue-50/30"><Cell value={row.pro} /></div>
                    <div className="px-4 py-3.5 flex items-center justify-center"><Cell value={row.business} /></div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pb-24">
        <div className="text-center mb-10">
          <h2 className="text-[1.9rem] font-extrabold text-neutral-950 tracking-tight">{t.faqTitle}</h2>
          <p className="text-[16px] text-neutral-500 mt-2">{t.faqSub}</p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 px-6 divide-y divide-neutral-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
          {t.faqs.map((faq, i) => (
            <FaqItem
              key={i}
              q={faq.q}
              a={faq.a}
              isOpen={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            />
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-3xl bg-neutral-950 overflow-hidden px-8 py-14 text-center">
            {/* Subtle glow */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(ellipse 60% 40% at 50% 0%, #3b82f6, transparent)' }} />
            </div>

            <h2 className="relative text-[2rem] sm:text-[2.4rem] font-extrabold text-white tracking-tight leading-tight">
              {t.ctaTitle}
            </h2>
            <p className="relative mt-4 text-[16px] text-neutral-400 max-w-md mx-auto leading-relaxed">
              {t.ctaSub}
            </p>
            <div className="relative mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center px-7 py-3.5 rounded-[12px] bg-white text-neutral-950 text-[15px] font-bold hover:bg-neutral-100 active:scale-[0.97] transition-all shadow-[0_2px_12px_rgba(255,255,255,0.15)]"
              >
                {t.ctaBtn}
              </Link>
              <Link
                href="/contact"
                className="text-[14px] font-medium text-neutral-400 hover:text-white transition-colors"
              >
                {t.ctaAlt}
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
