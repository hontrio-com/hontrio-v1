'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion, type MotionProps } from 'framer-motion'
import {
  MessageSquare, Mail, Clock, ChevronDown,
  ArrowRight, CheckCircle2, AlertCircle, Loader2,
  HelpCircle,
} from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

// ─── Content ──────────────────────────────────────────────────────────────────

const en = {
  heroBadge: 'Get in touch',
  heroH1: 'We are here to',
  heroWord: 'help you.',
  heroSub: 'Have a question about Hontrio, need technical support or want to talk about a partnership? Send us a message and we will get back to you as quickly as possible.',

  formTitle: 'Send us a message',
  formSub: 'We respond within 24 hours on business days.',
  labelName: 'Full name',
  placeholderName: 'Your name',
  labelEmail: 'Email address',
  placeholderEmail: 'your@email.com',
  labelSubject: 'Subject',
  subjectOptions: [
    { value: '', label: 'Choose a subject...' },
    { value: 'support', label: 'Technical support' },
    { value: 'billing', label: 'Billing and subscriptions' },
    { value: 'partnership', label: 'Partnership and integrations' },
    { value: 'feedback', label: 'Feedback and suggestions' },
    { value: 'other', label: 'Other' },
  ],
  labelMessage: 'Message',
  placeholderMessage: 'Describe your question or issue in detail...',
  charLimit: 'characters remaining',
  labelGdpr: 'I agree that Hontrio stores the data submitted in this form for the purpose of responding to my request. Read the',
  gdprLink: 'Privacy Policy',
  btnSend: 'Send message',
  btnSending: 'Sending...',
  successTitle: 'Message sent successfully!',
  successText: 'We have received your message and will respond to the address',
  successTextSuffix: 'within 24 business hours.',
  successBtn: 'Send another message',
  errorTitle: 'Error sending message',
  errorText: 'Something went wrong. Please try again or contact us directly at',

  errNameRequired: 'Name is required.',
  errNameMin: 'Name must be at least 2 characters.',
  errEmailRequired: 'Email is required.',
  errEmailInvalid: 'Please enter a valid email address.',
  errSubjectRequired: 'Please choose a subject.',
  errMessageRequired: 'Message is required.',
  errMessageMin: 'Message must be at least 20 characters.',
  errGdpr: 'You must agree to the Privacy Policy.',

  infoTitle: 'Contact information',
  infoEmail: 'support@hontrio.com',
  infoEmailLabel: 'Email',
  infoHoursLabel: 'Response time',
  infoHours: 'Within 24h on business days',

  quickCards: [
    {
      icon: 'faq',
      title: 'FAQ',
      text: 'Answers to the most common questions.',
      href: '#faq',
      cta: 'View FAQ',
    },
  ],

  faqH2: 'Frequently asked questions',
  faqSub: 'Quick answers to questions we receive most often. If you do not find what you are looking for, use the form above.',
  faqs: [
    {
      q: 'How do I connect my WooCommerce store to Hontrio?',
      a: 'You install the free Hontrio plugin from the WordPress marketplace, enter your API key from the Hontrio dashboard and synchronization starts automatically. The entire process takes under 5 minutes.',
    },
    {
      q: 'How many products can I process per month?',
      a: 'It depends on the chosen plan. The Starter plan includes 100 monthly credits, the Pro plan includes 500 credits and the Business plan is unlimited. Each major action (image generation, SEO text, order analysis) costs 1 credit.',
    },
    {
      q: 'Does the AI Chat Agent work in Romanian?',
      a: 'Yes. The Hontrio AI Chat Agent automatically detects the language of each visitor and responds in Romanian, English or any other configured language. You set the preferred language in the plugin settings.',
    },
    {
      q: 'Is my store data safe?',
      a: 'Hontrio processes only the data needed to provide the requested service (product images, descriptions, order details). We do not sell or share your data with third parties. The platform uses Supabase (EU region) for storage and Vercel for hosting.',
    },
    {
      q: 'Can I cancel my subscription at any time?',
      a: 'Yes, without any penalty. You can cancel directly from the billing dashboard. The subscription remains active until the end of the current billing period.',
    },
    {
      q: 'Do you offer a free trial period?',
      a: 'Yes. You can use Hontrio free for 14 days with access to all features. No credit card required to start.',
    },
  ],

  ctaH2: 'Not found what you were looking for?',
  ctaSub: 'Our team is ready to help you with any specific question about Hontrio.',
  ctaBtn: 'Write to us',
  ctaBtn2: 'Try for free',
}

const ro: typeof en = {
  heroBadge: 'Ia legatura cu noi',
  heroH1: 'Suntem aici sa te',
  heroWord: 'ajutam.',
  heroSub: 'Ai o intrebare despre Hontrio, ai nevoie de suport tehnic sau vrei sa discutam un parteneriat? Trimite-ne un mesaj si iti vom raspunde cat mai rapid.',

  formTitle: 'Trimite-ne un mesaj',
  formSub: 'Raspundem in maxim 24 de ore in zilele lucratoare.',
  labelName: 'Nume complet',
  placeholderName: 'Numele tau',
  labelEmail: 'Adresa de email',
  placeholderEmail: 'tu@email.com',
  labelSubject: 'Subiect',
  subjectOptions: [
    { value: '', label: 'Alege un subiect...' },
    { value: 'support', label: 'Suport tehnic' },
    { value: 'billing', label: 'Facturare si abonamente' },
    { value: 'partnership', label: 'Parteneriat si integrari' },
    { value: 'feedback', label: 'Feedback si sugestii' },
    { value: 'other', label: 'Altele' },
  ],
  labelMessage: 'Mesaj',
  placeholderMessage: 'Descrie intrebarea sau problema ta in detaliu...',
  charLimit: 'caractere ramase',
  labelGdpr: 'Sunt de acord ca Hontrio sa stocheze datele trimise in acest formular in scopul raspunderii la solicitarea mea. Citeste',
  gdprLink: 'Politica de Confidentialitate',
  btnSend: 'Trimite mesajul',
  btnSending: 'Se trimite...',
  successTitle: 'Mesaj trimis cu succes!',
  successText: 'Am primit mesajul tau si vom raspunde la adresa',
  successTextSuffix: 'in maxim 24 de ore lucratoare.',
  successBtn: 'Trimite alt mesaj',
  errorTitle: 'Eroare la trimiterea mesajului',
  errorText: 'Ceva nu a mers bine. Te rugam sa incerci din nou sau sa ne contactezi direct la',

  errNameRequired: 'Numele este obligatoriu.',
  errNameMin: 'Numele trebuie sa aiba cel putin 2 caractere.',
  errEmailRequired: 'Email-ul este obligatoriu.',
  errEmailInvalid: 'Te rugam sa introduci o adresa de email valida.',
  errSubjectRequired: 'Te rugam sa alegi un subiect.',
  errMessageRequired: 'Mesajul este obligatoriu.',
  errMessageMin: 'Mesajul trebuie sa aiba cel putin 20 de caractere.',
  errGdpr: 'Trebuie sa fii de acord cu Politica de Confidentialitate.',

  infoTitle: 'Informatii de contact',
  infoEmail: 'support@hontrio.com',
  infoEmailLabel: 'Email',
  infoHoursLabel: 'Timp de raspuns',
  infoHours: 'In maxim 24h in zilele lucratoare',

  quickCards: [
    {
      icon: 'faq',
      title: 'Intrebari frecvente',
      text: 'Raspunsuri la cele mai comune intrebari.',
      href: '#faq',
      cta: 'Vezi FAQ',
    },
  ],

  faqH2: 'Intrebari frecvente',
  faqSub: 'Raspunsuri rapide la intrebarile pe care le primim cel mai des. Daca nu gasesti ce cauti, foloseste formularul de mai sus.',
  faqs: [
    {
      q: 'Cum conectez magazinul meu WooCommerce la Hontrio?',
      a: 'Instalezi pluginul gratuit Hontrio din marketplace-ul WordPress, introduci cheia API din dashboard-ul Hontrio si sincronizarea porneste automat. Intregul proces dureaza sub 5 minute.',
    },
    {
      q: 'Cate produse pot procesa pe luna?',
      a: 'Depinde de planul ales. Planul Starter include 100 de credite lunare, planul Pro include 500 de credite, iar planul Business este nelimitat. Fiecare actiune majora (generare imagine, text SEO, analiza comanda) consuma 1 credit.',
    },
    {
      q: 'Agentul AI Chat functioneaza in romana?',
      a: 'Da. Agentul AI Chat Hontrio detecteaza automat limba fiecarui vizitator si raspunde in romana, engleza sau orice alta limba configurata. Setezi limba preferata din setarile pluginului.',
    },
    {
      q: 'Sunt datele magazinului meu in siguranta?',
      a: 'Hontrio proceseaza doar datele necesare pentru a furniza serviciul solicitat (imagini produse, descrieri, detalii comenzi). Nu vindem si nu impartasim datele tale cu terte parti. Platforma foloseste Supabase (regiune EU) pentru stocare si Vercel pentru hosting.',
    },
    {
      q: 'Pot anula abonamentul oricand?',
      a: 'Da, fara nicio penalizare. Poti anula direct din dashboard-ul de facturare. Abonamentul ramane activ pana la sfarsitul perioadei de facturare curente.',
    },
    {
      q: 'Oferiti o perioada de proba gratuita?',
      a: 'Da. Poti folosi Hontrio gratuit timp de 14 zile cu acces la toate functiile. Nu este necesara cardul de credit pentru a incepe.',
    },
  ],

  ctaH2: 'Nu ai gasit ce cautai?',
  ctaSub: 'Echipa noastra este gata sa te ajute cu orice intrebare specifica despre Hontrio.',
  ctaBtn: 'Scrie-ne',
  ctaBtn2: 'Incearca gratuit',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormFields {
  name: string
  email: string
  subject: string
  message: string
  gdpr: boolean
}

interface FormErrors {
  name?: string
  email?: string
  subject?: string
  message?: string
  gdpr?: string
}

// ─── Animation helpers ────────────────────────────────────────────────────────

function fadeUp(reduced: boolean, delay = 0): MotionProps {
  if (reduced) return {}
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] as [number, number, number, number], delay },
  }
}

const MAX_CHARS = 2000

// ─── Quick card icon map ──────────────────────────────────────────────────────

function QuickIcon({ type }: { type: string }) {
  if (type === 'faq') return <HelpCircle className="h-5 w-5" />
  return <HelpCircle className="h-5 w-5" />
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FAQItem({ q, a, index, reduced }: { q: string; a: string; index: number; reduced: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      {...fadeUp(reduced, index * 0.07)}
      className="border border-neutral-200 rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left bg-white hover:bg-neutral-50 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-neutral-900">{q}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
          className="shrink-0 text-neutral-500"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 pt-1 text-sm text-neutral-600 leading-relaxed border-t border-neutral-100">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContactPage() {
  const { locale } = useLocale()
  const t = locale === 'ro' ? ro : en
  const reduced = useReducedMotion() ?? false

  // Form state
  const [fields, setFields] = useState<FormFields>({ name: '', email: '', subject: '', message: '', gdpr: false })
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormFields, boolean>>>({})
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const formRef = useRef<HTMLFormElement>(null)

  const charsLeft = MAX_CHARS - fields.message.length

  // Validation
  function validate(f: FormFields): FormErrors {
    const errs: FormErrors = {}
    if (!f.name.trim()) errs.name = t.errNameRequired
    else if (f.name.trim().length < 2) errs.name = t.errNameMin
    if (!f.email.trim()) errs.email = t.errEmailRequired
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs.email = t.errEmailInvalid
    if (!f.subject) errs.subject = t.errSubjectRequired
    if (!f.message.trim()) errs.message = t.errMessageRequired
    else if (f.message.trim().length < 20) errs.message = t.errMessageMin
    if (!f.gdpr) errs.gdpr = t.errGdpr
    return errs
  }

  function handleBlur(field: keyof FormFields) {
    setTouched((prev) => ({ ...prev, [field]: true }))
    setErrors(validate(fields))
  }

  function handleChange(field: keyof FormFields, value: string | boolean) {
    const updated = { ...fields, [field]: value }
    setFields(updated)
    if (touched[field]) setErrors(validate(updated))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const allTouched: Partial<Record<keyof FormFields, boolean>> = { name: true, email: true, subject: true, message: true, gdpr: true }
    setTouched(allTouched)
    const errs = validate(fields)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setStatus('loading')
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1500))
    // In production, replace with: await fetch('/api/contact', { method: 'POST', body: JSON.stringify(fields) })
    setStatus('success')
  }

  function handleReset() {
    setFields({ name: '', email: '', subject: '', message: '', gdpr: false })
    setErrors({})
    setTouched({})
    setStatus('idle')
  }

  const inputBase =
    'w-full rounded-lg border bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all'
  const inputOk = 'border-neutral-200 focus:border-neutral-400 focus:ring-neutral-200'
  const inputErr = 'border-red-400 focus:border-red-400 focus:ring-red-100'

  return (
    <main className="pt-20 overflow-hidden">
      {/* ── Section 1: Hero ────────────────────────────────────────────────── */}
      <section className="relative py-24 bg-white">
        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          {/* Pulsing badge */}
          <motion.div
            {...(reduced ? {} : { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.45 } })}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-1.5 mb-8 shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-900" />
            </span>
            <MessageSquare className="h-3.5 w-3.5 text-neutral-600" />
            <span className="text-xs font-semibold text-neutral-700 tracking-wide uppercase">{t.heroBadge}</span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.1, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } })}
            className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 leading-tight mb-4"
          >
            {t.heroH1}{' '}
            <span>{t.heroWord}</span>
          </motion.h1>

          <motion.p
            {...(reduced ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.22, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } })}
            className="text-base sm:text-lg text-neutral-500 leading-relaxed max-w-2xl mx-auto mb-10"
          >
            {t.heroSub}
          </motion.p>

        </div>
      </section>

      {/* ── Section 2: Form + Info ─────────────────────────────────────────── */}
      <section className="py-20 bg-neutral-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-[1fr_auto] gap-10 items-start" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px' }}>

            {/* Left: Form */}
            <motion.div {...fadeUp(reduced, 0)} className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-neutral-900">{t.formTitle}</h2>
                <p className="mt-1 text-sm text-neutral-500">{t.formSub}</p>
              </div>

              <AnimatePresence mode="wait">
                {status === 'success' ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center text-center py-12 gap-4"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
                      <CheckCircle2 className="h-8 w-8 text-neutral-900" />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900">{t.successTitle}</h3>
                    <p className="text-sm text-neutral-500 max-w-sm">
                      {t.successText} <span className="font-semibold text-neutral-800">{fields.email}</span> {t.successTextSuffix}
                    </p>
                    <button
                      onClick={handleReset}
                      className="mt-2 rounded-lg border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      {t.successBtn}
                    </button>
                  </motion.div>
                ) : status === 'error' ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl bg-red-50 border border-red-200 p-5 flex gap-3 items-start"
                  >
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">{t.errorTitle}</p>
                      <p className="text-sm text-red-700 mt-0.5">
                        {t.errorText}{' '}
                        <a href={`mailto:${t.infoEmail}`} className="underline hover:no-underline">
                          {t.infoEmail}
                        </a>
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    ref={formRef}
                    onSubmit={handleSubmit}
                    noValidate
                    initial={false}
                    className="space-y-5"
                  >
                    {/* Name + Email */}
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">{t.labelName}</label>
                        <input
                          type="text"
                          value={fields.name}
                          onChange={(e) => handleChange('name', e.target.value)}
                          onBlur={() => handleBlur('name')}
                          placeholder={t.placeholderName}
                          className={`${inputBase} ${touched.name && errors.name ? inputErr : inputOk}`}
                        />
                        {touched.name && errors.name && (
                          <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">{t.labelEmail}</label>
                        <input
                          type="email"
                          value={fields.email}
                          onChange={(e) => handleChange('email', e.target.value)}
                          onBlur={() => handleBlur('email')}
                          placeholder={t.placeholderEmail}
                          className={`${inputBase} ${touched.email && errors.email ? inputErr : inputOk}`}
                        />
                        {touched.email && errors.email && (
                          <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                        )}
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">{t.labelSubject}</label>
                      <select
                        value={fields.subject}
                        onChange={(e) => handleChange('subject', e.target.value)}
                        onBlur={() => handleBlur('subject')}
                        className={`${inputBase} ${touched.subject && errors.subject ? inputErr : inputOk} appearance-none cursor-pointer`}
                      >
                        {t.subjectOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {touched.subject && errors.subject && (
                        <p className="mt-1 text-xs text-red-600">{errors.subject}</p>
                      )}
                    </div>

                    {/* Message with char counter */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-neutral-700">{t.labelMessage}</label>
                        <span className={`text-xs ${charsLeft < 100 ? 'text-red-500' : 'text-neutral-400'}`}>
                          {charsLeft} {t.charLimit}
                        </span>
                      </div>
                      <textarea
                        rows={6}
                        maxLength={MAX_CHARS}
                        value={fields.message}
                        onChange={(e) => handleChange('message', e.target.value)}
                        onBlur={() => handleBlur('message')}
                        placeholder={t.placeholderMessage}
                        className={`${inputBase} resize-none ${touched.message && errors.message ? inputErr : inputOk}`}
                      />
                      {touched.message && errors.message && (
                        <p className="mt-1 text-xs text-red-600">{errors.message}</p>
                      )}
                    </div>

                    {/* GDPR */}
                    <div>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative mt-0.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={fields.gdpr}
                            onChange={(e) => handleChange('gdpr', e.target.checked)}
                            onBlur={() => handleBlur('gdpr')}
                            className="sr-only"
                          />
                          <div
                            className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                              fields.gdpr ? 'bg-neutral-900 border-neutral-900' : 'bg-white border-neutral-300 group-hover:border-neutral-400'
                            }`}
                          >
                            {fields.gdpr && (
                              <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <polyline points="1,4 4,7 9,1" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-neutral-500 leading-relaxed">
                          {t.labelGdpr}{' '}
                          <Link href="/legal/privacy" className="text-neutral-800 font-medium underline hover:no-underline">
                            {t.gdprLink}
                          </Link>
                          .
                        </span>
                      </label>
                      {touched.gdpr && errors.gdpr && (
                        <p className="mt-1 text-xs text-red-600 pl-7">{errors.gdpr}</p>
                      )}
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={status === 'loading'}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-6 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {status === 'loading' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.btnSending}
                        </>
                      ) : (
                        <>
                          {t.btnSend}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Right: Info + Quick cards */}
            <div className="flex flex-col gap-5 lg:sticky lg:top-28">
              {/* Contact info card */}
              <motion.div {...fadeUp(reduced, 0.1)} className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-neutral-900 mb-4">{t.infoTitle}</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
                      <Mail className="h-4 w-4 text-neutral-700" />
                    </div>
                    <div>
                      <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide">{t.infoEmailLabel}</p>
                      <a href={`mailto:${t.infoEmail}`} className="text-sm font-semibold text-neutral-900 hover:underline">
                        {t.infoEmail}
                      </a>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
                      <Clock className="h-4 w-4 text-neutral-700" />
                    </div>
                    <div>
                      <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide">{t.infoHoursLabel}</p>
                      <p className="text-sm font-semibold text-neutral-900">{t.infoHours}</p>
                    </div>
                  </li>
                </ul>
              </motion.div>

              {/* Quick cards */}
              {t.quickCards.map((card, i) => (
                <motion.div key={card.title} {...fadeUp(reduced, 0.15 + i * 0.08)}>
                  <Link
                    href={card.href}
                    className="group flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-neutral-300 hover:shadow-md transition-all"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white text-neutral-700 transition-colors">
                      <QuickIcon type={card.icon} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-neutral-900">{card.title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500 leading-snug">{card.text}</p>
                      <p className="mt-2 text-xs font-semibold text-neutral-700 group-hover:text-neutral-900 flex items-center gap-1">
                        {card.cta}
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: FAQ ─────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 bg-white scroll-mt-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div {...fadeUp(reduced)} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 mb-3">
              {t.faqH2}
            </h2>
            <p className="text-neutral-500 leading-relaxed">{t.faqSub}</p>
          </motion.div>
          <div className="space-y-3">
            {t.faqs.map((item, i) => (
              <FAQItem key={i} q={item.q} a={item.a} index={i} reduced={reduced} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Dark CTA ────────────────────────────────────────────── */}
      <section className="py-20 bg-neutral-950">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.h2
            {...fadeUp(reduced)}
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4"
          >
            {t.ctaH2}
          </motion.h2>
          <motion.p {...fadeUp(reduced, 0.1)} className="text-neutral-400 mb-8 leading-relaxed">
            {t.ctaSub}
          </motion.p>
          <motion.div {...fadeUp(reduced, 0.18)} className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#top"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 transition-colors"
            >
              {t.ctaBtn}
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-xl border border-neutral-700 px-6 py-3 text-sm font-semibold text-white hover:border-neutral-500 hover:bg-neutral-900 transition-colors"
            >
              {t.ctaBtn2}
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
