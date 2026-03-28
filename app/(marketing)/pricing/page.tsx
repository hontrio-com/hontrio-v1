'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, X, ChevronDown,
} from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

// ─── Bilingual content ────────────────────────────────────────────────────────

const en = {
  badge: 'Transparent pricing',
  h1: 'Simple, transparent pricing',
  subtitle: 'Start free, upgrade when you need more. Cancel anytime.',
  mostPopular: 'Most popular',
  perMonth: '/mo',
  plans: [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      credits: '20 credits included',
      highlight: false,
      cta: 'Start for free',
      features: [
        { text: 'WooCommerce connection', included: true },
        { text: 'All AI modules (limited)', included: true },
        { text: 'Email support', included: true },
        { text: 'AI Sales Agent', included: false },
        { text: 'Risk Shield', included: false },
        { text: 'Competitor analysis', included: false },
        { text: 'Bulk operations', included: false },
        { text: 'Advanced analytics', included: false },
      ],
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '$19',
      period: '/mo',
      credits: '150 credits / month',
      highlight: false,
      cta: 'Get Starter',
      features: [
        { text: 'Everything in Free', included: true },
        { text: '150 AI credits / month', included: true },
        { text: 'AI product images', included: true },
        { text: 'SEO optimization', included: true },
        { text: 'Priority support', included: true },
        { text: 'AI Sales Agent', included: false },
        { text: 'Risk Shield', included: false },
        { text: 'Bulk operations', included: false },
      ],
    },
    {
      id: 'professional',
      name: 'Professional',
      price: '$49',
      period: '/mo',
      credits: '400 credits / month',
      highlight: true,
      cta: 'Get Professional',
      features: [
        { text: 'Everything in Starter', included: true },
        { text: '400 AI credits / month', included: true },
        { text: 'AI Sales Agent', included: true },
        { text: 'Risk Shield', included: true },
        { text: 'Competitor analysis', included: true },
        { text: 'Bulk operations', included: true },
        { text: 'Advanced analytics', included: false },
        { text: 'Dedicated support', included: false },
      ],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '$99',
      period: '/mo',
      credits: '900 credits / month',
      highlight: false,
      cta: 'Get Enterprise',
      features: [
        { text: 'Everything in Professional', included: true },
        { text: '900 AI credits / month', included: true },
        { text: 'Advanced analytics', included: true },
        { text: 'Dedicated support', included: true },
        { text: 'Custom integrations', included: true },
        { text: 'AI Sales Agent', included: true },
        { text: 'Risk Shield', included: true },
        { text: 'Bulk operations', included: true },
      ],
    },
  ],
  faqTitle: 'Frequently asked questions',
  faqs: [
    { q: 'What are credits and how many do I need?', a: 'Credits are the AI usage currency. One SEO optimization costs 3 credits, one AI image costs 6 to 8 credits. Most stores use between 50 and 300 credits per month depending on catalog size.' },
    { q: 'Is there a free trial?', a: 'Yes. You get 20 free credits when you create your account, no credit card required. This is enough to optimize around 6 products or generate 3 AI images and see the results for yourself.' },
    { q: 'Can I change my plan at any time?', a: 'Absolutely. You can upgrade, downgrade or cancel your plan at any time from your account dashboard. Changes take effect immediately.' },
    { q: 'How does WooCommerce integration work?', a: 'Your store connects easily during the onboarding process or from Settings at any time. No technical knowledge required. If you run into any issues, our team offers fast assistance.' },
    { q: 'Is my store data secure?', a: 'Yes. All data is encrypted in transit and at rest. We are GDPR compliant and never share your data with third parties. Your product data is used only to generate content for your store.' },
    { q: 'What languages does the AI generate content in?', a: 'The AI generates content in any language you need. Simply set the desired language in your brand settings and the AI will write in that language. The Hontrio interface is available in English and Romanian.' },
  ],
  ctaH2: 'Ready to grow your store?',
  ctaSub: 'Join hundreds of store owners already using Hontrio to automate and grow.',
  ctaPrimary: 'Start for free, no card required',
  ctaSecondary: 'Sign in',
}

const ro = {
  badge: 'Preturi transparente',
  h1: 'Preturi simple si transparente',
  subtitle: 'Incepe gratuit, upgradeaza cand ai nevoie de mai mult. Anuleaza oricand.',
  mostPopular: 'Cel mai popular',
  perMonth: '/luna',
  plans: [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'permanent',
      credits: '20 credite incluse',
      highlight: false,
      cta: 'Incepe gratuit',
      features: [
        { text: 'Conectare WooCommerce', included: true },
        { text: 'Toate modulele AI (limitat)', included: true },
        { text: 'Suport email', included: true },
        { text: 'Agent AI de vanzari', included: false },
        { text: 'Risk Shield', included: false },
        { text: 'Analiza competitori', included: false },
        { text: 'Operatii in masa', included: false },
        { text: 'Analize avansate', included: false },
      ],
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '$19',
      period: '/luna',
      credits: '150 credite / luna',
      highlight: false,
      cta: 'Alege Starter',
      features: [
        { text: 'Tot din Free', included: true },
        { text: '150 credite AI / luna', included: true },
        { text: 'Imagini AI produse', included: true },
        { text: 'Optimizare SEO', included: true },
        { text: 'Suport prioritar', included: true },
        { text: 'Agent AI de vanzari', included: false },
        { text: 'Risk Shield', included: false },
        { text: 'Operatii in masa', included: false },
      ],
    },
    {
      id: 'professional',
      name: 'Professional',
      price: '$49',
      period: '/luna',
      credits: '400 credite / luna',
      highlight: true,
      cta: 'Alege Professional',
      features: [
        { text: 'Tot din Starter', included: true },
        { text: '400 credite AI / luna', included: true },
        { text: 'Agent AI de vanzari', included: true },
        { text: 'Risk Shield', included: true },
        { text: 'Analiza competitori', included: true },
        { text: 'Operatii in masa', included: true },
        { text: 'Analize avansate', included: false },
        { text: 'Suport dedicat', included: false },
      ],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '$99',
      period: '/luna',
      credits: '900 credite / luna',
      highlight: false,
      cta: 'Alege Enterprise',
      features: [
        { text: 'Tot din Professional', included: true },
        { text: '900 credite AI / luna', included: true },
        { text: 'Analize avansate', included: true },
        { text: 'Suport dedicat', included: true },
        { text: 'Integratii personalizate', included: true },
        { text: 'Agent AI de vanzari', included: true },
        { text: 'Risk Shield', included: true },
        { text: 'Operatii in masa', included: true },
      ],
    },
  ],
  faqTitle: 'Intrebari frecvente',
  faqs: [
    { q: 'Ce sunt creditele si de cate am nevoie?', a: 'Creditele sunt moneda de utilizare AI. O optimizare SEO costa 3 credite, o imagine AI costa 6 pana la 8 credite. Majoritatea magazinelor folosesc intre 50 si 300 de credite pe luna in functie de marimea catalogului.' },
    { q: 'Exista o perioada de proba gratuita?', a: 'Da. Primesti 20 de credite gratuite cand iti creezi contul, fara card de credit. Acestea sunt suficiente pentru a optimiza aproximativ 6 produse sau a genera 3 imagini AI si a vedea rezultatele.' },
    { q: 'Pot schimba planul oricand?', a: 'Absolut. Poti face upgrade, downgrade sau anula planul oricand din panoul de cont. Modificarile intra in vigoare imediat.' },
    { q: 'Cum functioneaza integrarea cu WooCommerce?', a: 'Magazinul tau se conecteaza usor in timpul procesului de onboarding sau din Setari oricand. Nu sunt necesare cunostinte tehnice. Daca intampini probleme, echipa noastra ofera asistenta rapida.' },
    { q: 'Datele magazinului meu sunt in siguranta?', a: 'Da. Toate datele sunt criptate in tranzit si in repaus. Suntem conformi GDPR si nu impartasim niciodata datele tale cu terte parti. Datele tale de produs sunt folosite doar pentru a genera continut pentru magazinul tau.' },
    { q: 'In ce limbi genereaza AI continut?', a: 'AI-ul genereaza continut in orice limba ai nevoie. Seteaza limba dorita in setarile brandului si AI-ul va scrie in acea limba. Interfata Hontrio este disponibila in engleza si romana.' },
  ],
  ctaH2: 'Gata sa iti cresti magazinul?',
  ctaSub: 'Alatura-te sutelor de proprietari de magazine care folosesc deja Hontrio pentru a automatiza si creste.',
  ctaPrimary: 'Incepe gratuit, fara card',
  ctaSecondary: 'Conecteaza-te',
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const { locale } = useLocale()
  const t = locale === 'ro' ? ro : en
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="bg-white">

      {/* Hero */}
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
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {t.plans.map((plan) => (
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

              <div className="mb-5">
                <h3 className="text-base font-semibold text-neutral-900 mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-neutral-900">{plan.price}</span>
                  <span className="text-neutral-500 text-sm">{plan.period}</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">{plan.credits}</p>
              </div>

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

              <Link
                href={plan.id === 'free' ? '/register' : `/register?plan=${plan.id}`}
                className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                  plan.highlight || plan.id !== 'free'
                    ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                    : 'bg-white text-neutral-900 border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-neutral-50 px-4 py-20">
        <div className="max-w-[700px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-neutral-900">{t.faqTitle}</h2>
          </div>
          <div className="flex flex-col gap-2">
            {t.faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200"
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
                      <p className="px-5 pb-4 text-sm text-neutral-500 leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
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
