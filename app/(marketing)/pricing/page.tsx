'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check, X, ChevronDown,
  Wand2, Bot, TrendingUp, ShieldCheck, Headphones,
  Zap, Rocket, Building2,
} from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

// ─── Bilingual content ────────────────────────────────────────────────────────

const en = {
  badge: 'Transparent pricing',
  h1: 'Simple, transparent pricing',
  subtitle: 'Start free, upgrade when you grow. No hidden fees, no contracts. Cancel anytime.',
  monthly: 'Monthly',
  annually: 'Annually',
  save: 'Save 35%',
  mostPopular: 'Most popular',
  perMonth: '/mo',
  billedAnnually: 'billed annually',
  billedMonthly: 'billed monthly',
  plans: [
    {
      id: 'starter',
      icon: Rocket,
      name: 'Starter',
      tagline: 'For stores just getting started',
      priceMonthly: 0,
      priceAnnually: 0,
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
  faqs: [
    { q: 'Is there a free trial?', a: 'Yes. The Pro and Business plans come with a 14-day free trial — no credit card required. You can explore all features and upgrade only if you love it.' },
    { q: 'Can I change my plan at any time?', a: 'Absolutely. You can upgrade, downgrade or cancel your plan at any time from your account dashboard. Changes take effect immediately.' },
    { q: 'What happens when I reach the Starter limits?', a: "When you hit the monthly limits on the Starter plan, features pause until the next month. You'll receive a notification so you can decide if you'd like to upgrade." },
    { q: 'Do you support multiple WooCommerce stores?', a: 'The Business plan supports up to 5 WooCommerce stores under a single account. Need more? Contact our sales team for a custom plan.' },
    { q: 'Is my data safe?', a: 'All data is encrypted in transit and at rest. We are GDPR compliant and never share your store data with third parties. You own your data.' },
    { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex) as well as bank transfers for annual plans. Invoices are issued automatically.' },
  ],
  ctaH2: 'Ready to grow your store?',
  ctaSub: 'Join 500+ stores already using Hontrio. Start free — no credit card needed.',
  ctaPrimary: 'Start for free, no card required',
  ctaSecondary: 'Sign in',
}

const ro = {
  badge: 'Prețuri transparente',
  h1: 'Prețuri simple și transparente',
  subtitle: 'Începe gratuit, upgradează pe măsură ce crești. Fără costuri ascunse, fără contracte. Anulează oricând.',
  monthly: 'Lunar',
  annually: 'Anual',
  save: 'Economisești 35%',
  mostPopular: 'Cel mai popular',
  perMonth: '/lună',
  billedAnnually: 'facturat anual',
  billedMonthly: 'facturat lunar',
  plans: [
    {
      id: 'starter',
      icon: Rocket,
      name: 'Starter',
      tagline: 'Pentru magazinele la început de drum',
      priceMonthly: 0,
      priceAnnually: 0,
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
  faqs: [
    { q: 'Există o perioadă de probă gratuită?', a: 'Da. Planurile Pro și Business includ 14 zile de probă gratuită — fără card de credit. Explorezi toate funcțiile și upgradezi doar dacă ești mulțumit.' },
    { q: 'Pot schimba planul oricând?', a: 'Absolut. Poți face upgrade, downgrade sau anula planul oricând din panoul de cont. Modificările intră în vigoare imediat.' },
    { q: 'Ce se întâmplă când ating limitele planului Starter?', a: 'Când atingi limitele lunare ale planului Starter, funcțiile se opresc până luna viitoare. Vei primi o notificare pentru a decide dacă dorești să faci upgrade.' },
    { q: 'Susțineți mai multe magazine WooCommerce?', a: 'Planul Business suportă până la 5 magazine WooCommerce sub un singur cont. Ai nevoie de mai multe? Contactează echipa noastră pentru un plan personalizat.' },
    { q: 'Datele mele sunt în siguranță?', a: 'Toate datele sunt criptate în tranzit și în repaus. Suntem conformi GDPR și nu partajăm niciodată datele magazinului tău cu terțe părți. Tu ești proprietarul datelor.' },
    { q: 'Ce metode de plată acceptați?', a: 'Acceptăm toate cardurile principale de credit și debit (Visa, Mastercard, Amex) precum și transfer bancar pentru planurile anuale. Facturile sunt emise automat.' },
  ],
  ctaH2: 'Gata să îți crești magazinul?',
  ctaSub: 'Alătură-te celor 500+ magazine care folosesc deja Hontrio. Începe gratuit — fără card de credit.',
  ctaPrimary: 'Începe gratuit, fără card',
  ctaSecondary: 'Conectează-te',
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────
function FAQItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-neutral-100 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[15px] font-semibold text-neutral-900">{q}</span>
        <ChevronDown className={`shrink-0 h-4 w-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
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

// ─── Comparison cell ──────────────────────────────────────────────────────────
function Cell({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value
      ? <Check className="h-4 w-4 text-neutral-900 mx-auto" />
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
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium mb-6">
            {t.badge}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">
            {t.h1}
          </h1>
          <p className="text-xl text-neutral-500 max-w-xl mx-auto leading-relaxed">
            {t.subtitle}
          </p>

          {/* Toggle */}
          <div className="mt-8 inline-flex items-center gap-3">
            <span className={`text-[14px] font-medium transition-colors ${!annually ? 'text-neutral-900' : 'text-neutral-400'}`}>
              {t.monthly}
            </span>
            <button
              onClick={() => setAnnually(!annually)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${annually ? 'bg-neutral-900' : 'bg-neutral-200'}`}
              aria-label="Toggle billing"
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${annually ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className={`text-[14px] font-medium flex items-center gap-2 transition-colors ${annually ? 'text-neutral-900' : 'text-neutral-400'}`}>
              {t.annually}
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-neutral-100 text-neutral-600 rounded-full">
                {t.save}
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* ── Pricing Cards ──────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {t.plans.map((plan) => {
            const Icon = plan.icon
            const price = annually ? plan.priceAnnually : plan.priceMonthly

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col transition-all duration-200 hover:shadow-lg ${
                  plan.highlight
                    ? 'border-neutral-900 shadow-md'
                    : 'border-neutral-200 hover:border-neutral-400'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-neutral-900 text-white text-xs font-semibold">
                      {t.mostPopular}
                    </span>
                  </div>
                )}

                {/* Icon + name */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center">
                    <Icon className="h-[18px] w-[18px] text-neutral-700" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-neutral-900">{plan.name}</p>
                    <p className="text-[12px] text-neutral-400">{plan.tagline}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    {plan.isFree ? (
                      <span className="text-4xl font-bold text-neutral-900">Free</span>
                    ) : (
                      <>
                        <span className="text-sm text-neutral-500 mb-1">€</span>
                        <span className="text-4xl font-bold text-neutral-900">{price}</span>
                        <span className="text-neutral-500 text-sm">{t.perMonth}</span>
                      </>
                    )}
                  </div>
                  {!plan.isFree && (
                    <p className="text-xs text-neutral-400 mt-1">
                      {annually ? t.billedAnnually : t.billedMonthly}
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2">
                      {f.included
                        ? <Check className="h-4 w-4 text-neutral-900 shrink-0 mt-0.5" />
                        : <X className="h-4 w-4 text-neutral-300 shrink-0 mt-0.5" />
                      }
                      <span className={`text-sm ${f.included ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={plan.isFree ? '/register' : `/register?plan=${plan.id}${annually ? '&billing=annual' : ''}`}
                  className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                    plan.highlight || !plan.isFree
                      ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                      : 'bg-white text-neutral-900 border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            )
          })}
        </div>

        <p className="text-center text-[13px] text-neutral-400 mt-6">
          14-day free trial · No credit card required · Cancel anytime
        </p>
      </section>

      {/* ── Full comparison table ──────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">
              {t.comparisonTitle}
            </h2>
            <p className="text-xl text-neutral-500">{t.comparisonSub}</p>
          </div>

          <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-white">
            {/* Header */}
            <div className="grid grid-cols-[1fr_90px_90px_90px] sm:grid-cols-[1fr_130px_130px_130px] border-b border-neutral-200 bg-neutral-50">
              <div className="p-4" />
              {['Starter', 'Pro', 'Business'].map((name) => (
                <div key={name} className="p-4 text-center text-[12px] font-bold uppercase tracking-widest text-neutral-500">
                  {name}
                </div>
              ))}
            </div>

            {t.categories.map((cat, ci) => {
              const CatIcon = cat.icon
              return (
                <div key={ci}>
                  <div className="grid grid-cols-[1fr_90px_90px_90px] sm:grid-cols-[1fr_130px_130px_130px] bg-neutral-50/80 border-b border-neutral-100">
                    <div className="px-4 py-3 flex items-center gap-2">
                      <CatIcon className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">{cat.label}</span>
                    </div>
                    <div /><div /><div />
                  </div>

                  {cat.rows.map((row, ri) => (
                    <div
                      key={ri}
                      className="grid grid-cols-[1fr_90px_90px_90px] sm:grid-cols-[1fr_130px_130px_130px] border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/40 transition-colors"
                    >
                      <div className="px-4 py-3.5 text-[13.5px] text-neutral-600">{row.feature}</div>
                      <div className="px-4 py-3.5 flex items-center justify-center"><Cell value={row.starter} /></div>
                      <div className="px-4 py-3.5 flex items-center justify-center"><Cell value={row.pro} /></div>
                      <div className="px-4 py-3.5 flex items-center justify-center"><Cell value={row.business} /></div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight">
              {t.faqTitle}
            </h2>
          </div>

          <div className="divide-y divide-neutral-100 border-t border-neutral-100">
            {t.faqs.map((faq, i) => (
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

      {/* ── Bottom CTA ─────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-950">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-5">
            {t.ctaH2}
          </h2>
          <p className="text-xl text-neutral-400 mb-10 leading-relaxed">
            {t.ctaSub}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white text-neutral-900 text-base font-semibold hover:bg-neutral-100 transition-colors duration-200 w-full sm:w-auto"
            >
              {t.ctaPrimary}
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-transparent text-white text-base font-semibold border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-900 transition-all duration-200 w-full sm:w-auto"
            >
              {t.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
