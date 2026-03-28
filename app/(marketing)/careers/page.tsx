'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion, type MotionProps } from 'framer-motion'
import {
  Briefcase, Rocket, Brain, Globe, Users, TrendingUp, Laptop,
  SearchX, RefreshCw, CheckCircle2, MessageSquare, CheckSquare, Zap, BookOpen,
  Send, Loader2, AlertCircle, ArrowRight,
} from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

// ─── Content ──────────────────────────────────────────────────────────────────

const en = {
  heroBadge: 'Careers',
  heroH1Part1: 'Build the future of',
  heroH1Word: 'eCommerce',
  heroH1Part2: 'alongside us.',
  heroSub: 'Hontrio is a rapidly growing platform and we are always interested in meeting talented people. Even if we have no open positions at the moment, you can leave your contact details for future opportunities.',

  whyH2: 'Why work with us',
  whySub: 'We build a real product with measurable impact, in a team where every contribution matters.',
  whyCards: [
    { icon: 'rocket', title: 'Growing product', text: 'You work on an active platform with real users and direct feedback. Every feature you build reaches production quickly and has measurable impact.' },
    { icon: 'brain', title: 'Modern technology', text: 'Our stack includes Next.js, TypeScript, Supabase, OpenAI and Framer Motion. You work with the tools you would choose yourself, not legacy systems from another decade.' },
    { icon: 'globe', title: 'International impact', text: 'Our platform serves online stores from multiple countries. Your contribution has a global reach, not a local one.' },
    { icon: 'users', title: 'Small team, great autonomy', text: 'In a compact team, your opinion counts and decisions are made quickly. There is no bureaucracy between a good idea and its implementation.' },
    { icon: 'trending', title: 'Fast professional growth', text: 'Exposure to the entire product (from infrastructure to design, from AI to security) gives you professional growth that a narrow role cannot offer.' },
    { icon: 'laptop', title: 'Flexibility', text: 'We believe in results, not physical presence. We work in the way that allows each person to make their maximum contribution.' },
  ],

  openH2: 'Open positions',
  openCardTitle: 'No open positions at the moment',
  openCardText: 'Our team is complete at this time, but the situation can change. If you believe you can bring value to the Hontrio platform, you can send a spontaneous CV through the form below.',
  openBadge1: 'We check periodically',
  openBadge2: 'We respond to everyone',

  formH2: 'Send a spontaneous application',
  formSub: 'No suitable position found? Leave us your details and we will contact you when a relevant opportunity arises for your profile.',
  formCardTitle: 'Spontaneous application',
  formCardSub: 'You fill in once, we keep you in mind.',
  labelName: 'Your name',
  placeholderName: 'John Doe',
  labelEmail: 'Email address',
  placeholderEmail: 'john@email.com',
  labelDomain: 'Your domain',
  domainOptions: [
    { value: '', label: 'Select domain' },
    { value: 'frontend', label: 'Software development (Frontend)' },
    { value: 'backend', label: 'Software development (Backend)' },
    { value: 'fullstack', label: 'Software development (Full-stack)' },
    { value: 'design', label: 'UI/UX Design' },
    { value: 'marketing', label: 'Marketing & Growth' },
    { value: 'content', label: 'Content & Copywriting' },
    { value: 'cs', label: 'Customer Success' },
    { value: 'other', label: 'Other' },
  ],
  labelPortfolio: 'LinkedIn or portfolio',
  badgeOptional: 'Optional',
  placeholderPortfolio: 'https://linkedin.com/in/your-profile',
  portfolioHint: 'Helps us better understand your experience.',
  labelMessage: 'Tell us a few things about yourself',
  placeholderMessage: 'What you do now, what you are looking for, why Hontrio...',
  charOf: '/',
  labelGdpr: 'I have read and accept the',
  gdprLink: 'Privacy Policy',
  labelGdprSuffix: 'and I agree to the processing of my personal data for the purpose of evaluating my application. Data may be retained for a maximum of 12 months.',
  gdprNote: 'The data provided will be used exclusively for the purpose of evaluating your application and will not be shared with third parties. We retain it for a maximum of 12 months, after which we delete it or request your reconfirmation of consent.',
  btnSend: 'Submit application',
  btnSending: 'Sending...',
  successTitle: 'Your application has been registered',
  successText: 'We will contact you at',
  successTextSuffix: 'if a suitable opportunity arises for your profile. Thank you for your interest.',
  successBtn: 'Back to homepage',
  errorText: 'Something went wrong. Please try again or contact us directly at',

  errNameRequired: 'Name is required.',
  errNameMin: 'Name must be at least 2 characters.',
  errEmailRequired: 'Email is required.',
  errEmailInvalid: 'Please enter a valid email address.',
  errDomainRequired: 'Please select a domain.',
  errMessageRequired: 'Message is required.',
  errMessageMin: 'Message must be at least 30 characters.',
  errGdpr: 'You must agree to the Privacy Policy.',

  valuesH2: 'How we work',
  valuesSub: 'We do not have a ten-page culture manual. We have a few simple principles that guide us every day.',
  values: [
    { icon: 'message', title: 'Direct communication', text: 'We say what we think, we listen to what we are told. There is no withheld information or hierarchies that filter feedback.' },
    { icon: 'check', title: 'Individual accountability', text: 'Everyone fully owns their area. There are no tasks that fall between two chairs or unclear responsibilities.' },
    { icon: 'zap', title: 'Execution speed', text: 'We prioritize fast delivery and iteration over perfect planning. An imperfect product in production is more valuable than a perfect product in planning.' },
    { icon: 'book', title: 'Continuous learning', text: 'Technology evolves quickly. We encourage and allocate time for documentation, experimentation and learning new things.' },
  ],

  ctaH2: "Didn't find what you were looking for?",
  ctaSub: 'Send us a spontaneous application or write to us directly. We take the time to read every message.',
  ctaBtn: 'Submit spontaneous application',
  ctaBtn2: 'Contact us',
  ctaNote: 'We respond to all applications within a maximum of 5 business days.',
}

const ro: typeof en = {
  heroBadge: 'Cariere',
  heroH1Part1: 'Construieste viitorul',
  heroH1Word: 'eCommerce-ului',
  heroH1Part2: 'alaturi de noi.',
  heroSub: 'Hontrio este o platforma in plina crestere si avem mereu interes sa cunoastem oameni talentati. Chiar daca nu avem pozitii deschise momentan, ne poti lasa datele de contact pentru oportunitatile viitoare.',

  whyH2: 'De ce sa lucrezi cu noi',
  whySub: 'Construim un produs real, cu impact masurabil, intr-o echipa unde fiecare contributie conteaza.',
  whyCards: [
    { icon: 'rocket', title: 'Produs in crestere', text: 'Lucrezi la o platforma activa, cu utilizatori reali si feedback direct. Fiecare functionalitate pe care o construiesti ajunge rapid in productie si are impact masurabil.' },
    { icon: 'brain', title: 'Tehnologie moderna', text: 'Stack-ul nostru include Next.js, TypeScript, Supabase, OpenAI si Framer Motion. Lucrezi cu uneltele pe care le-ai alege tu insuti, nu cu sisteme legacy din alt deceniu.' },
    { icon: 'globe', title: 'Impact international', text: 'Platforma noastra serveste magazine online din mai multe tari. Contributia ta are un perimetru global, nu local.' },
    { icon: 'users', title: 'Echipa mica, autonomie mare', text: 'Intr-o echipa compacta, opinia ta conteaza si deciziile se iau rapid. Nu exista birocratie intre o idee buna si implementarea ei.' },
    { icon: 'trending', title: 'Crestere profesionala rapida', text: 'Expunerea la intregul produs (de la infrastructura la design, de la AI la securitate) iti ofera o crestere profesionala pe care un rol ingust nu ti-o poate oferi.' },
    { icon: 'laptop', title: 'Flexibilitate', text: 'Credem in rezultate, nu in prezenta fizica. Lucram in modul care permite fiecaruia sa isi aduca contributia maxima.' },
  ],

  openH2: 'Pozitii deschise',
  openCardTitle: 'Nu avem pozitii deschise momentan',
  openCardText: 'Echipa noastra este completa in acest moment, insa situatia se poate schimba. Daca crezi ca poti aduce valoare platformei Hontrio, ne poti trimite un CV spontan prin formularul de mai jos.',
  openBadge1: 'Verificam periodic',
  openBadge2: 'Raspundem tuturor',

  formH2: 'Trimite o candidatura spontana',
  formSub: 'Nu ai gasit o pozitie potrivita? Lasa-ne datele tale si te contactam cand apare o oportunitate relevanta pentru profilul tau.',
  formCardTitle: 'Candidatura spontana',
  formCardSub: 'Completezi o singura data, te tinem in vedere.',
  labelName: 'Numele tau',
  placeholderName: 'Ion Popescu',
  labelEmail: 'Adresa de email',
  placeholderEmail: 'ion@email.com',
  labelDomain: 'Domeniul tau',
  domainOptions: [
    { value: '', label: 'Selecteaza domeniul' },
    { value: 'frontend', label: 'Dezvoltare software (Frontend)' },
    { value: 'backend', label: 'Dezvoltare software (Backend)' },
    { value: 'fullstack', label: 'Dezvoltare software (Full-stack)' },
    { value: 'design', label: 'Design UI/UX' },
    { value: 'marketing', label: 'Marketing si Growth' },
    { value: 'content', label: 'Continut si Copywriting' },
    { value: 'cs', label: 'Customer Success' },
    { value: 'other', label: 'Altul' },
  ],
  labelPortfolio: 'LinkedIn sau portofoliu',
  badgeOptional: 'Optional',
  placeholderPortfolio: 'https://linkedin.com/in/profilul-tau',
  portfolioHint: 'Ne ajuta sa intelegem mai bine experienta ta.',
  labelMessage: 'Spune-ne cateva lucruri despre tine',
  placeholderMessage: 'Ce faci acum, ce cauti, de ce Hontrio...',
  charOf: '/',
  labelGdpr: 'Am citit si accept',
  gdprLink: 'Politica de Confidentialitate',
  labelGdprSuffix: 'si sunt de acord cu prelucrarea datelor mele personale in scopul evaluarii candidaturii mele. Datele pot fi pastrate maximum 12 luni.',
  gdprNote: 'Datele furnizate vor fi utilizate exclusiv in scopul evaluarii candidaturii tale si nu vor fi transmise tertilor. Le pastram maximum 12 luni, dupa care le stergem sau iti solicitam reconfirmarea acordului.',
  btnSend: 'Trimite candidatura',
  btnSending: 'Se trimite...',
  successTitle: 'Candidatura ta a fost inregistrata',
  successText: 'Te vom contacta la',
  successTextSuffix: 'daca apare o oportunitate potrivita pentru profilul tau. Iti multumim pentru interes.',
  successBtn: 'Inapoi la pagina principala',
  errorText: 'Ceva nu a mers. Te rugam sa incerci din nou sau sa ne contactezi direct la',

  errNameRequired: 'Numele este obligatoriu.',
  errNameMin: 'Numele trebuie sa aiba cel putin 2 caractere.',
  errEmailRequired: 'Email-ul este obligatoriu.',
  errEmailInvalid: 'Te rugam sa introduci o adresa de email valida.',
  errDomainRequired: 'Te rugam sa selectezi un domeniu.',
  errMessageRequired: 'Mesajul este obligatoriu.',
  errMessageMin: 'Mesajul trebuie sa aiba cel putin 30 de caractere.',
  errGdpr: 'Trebuie sa fii de acord cu Politica de Confidentialitate.',

  valuesH2: 'Cum lucram',
  valuesSub: 'Nu avem un manual de cultura de zece pagini. Avem cateva principii simple dupa care ne ghidam in fiecare zi.',
  values: [
    { icon: 'message', title: 'Comunicare directa', text: 'Spunem ce gandim, ascultam ce ni se spune. Nu exista informatii retinute sau ierarhii care filtreaza feedback-ul.' },
    { icon: 'check', title: 'Responsabilitate individuala', text: 'Fiecare isi asuma complet aria sa. Nu exista sarcini care sa cada intre doua scaune sau responsabilitati neclare.' },
    { icon: 'zap', title: 'Viteza de executie', text: 'Prioritizam livrarea rapida si iteratia fata de planificarea perfecta. Un produs imperfect in productie este mai valoros decat un produs perfect in planificare.' },
    { icon: 'book', title: 'Invatare continua', text: 'Tehnologia evolueaza rapid. Incurajam si alocam timp pentru documentare, experimentare si invatarea lucrurilor noi.' },
  ],

  ctaH2: 'Nu ai gasit ce cautai?',
  ctaSub: 'Trimite-ne o candidatura spontana sau scrie-ne direct. Ne facem timp sa citim fiecare mesaj.',
  ctaBtn: 'Trimite candidatura spontana',
  ctaBtn2: 'Contacteaza-ne',
  ctaNote: 'Raspundem tuturor candidaturilor in maximum 5 zile lucratoare.',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormFields {
  name: string
  email: string
  domain: string
  portfolio: string
  message: string
  gdpr: boolean
}

interface FormErrors {
  name?: string
  email?: string
  domain?: string
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

const MAX_CHARS = 600

// ─── Icon map ─────────────────────────────────────────────────────────────────

function WhyIcon({ type }: { type: string }) {
  const cls = 'h-5 w-5 text-neutral-700'
  switch (type) {
    case 'rocket': return <Rocket className={cls} />
    case 'brain': return <Brain className={cls} />
    case 'globe': return <Globe className={cls} />
    case 'users': return <Users className={cls} />
    case 'trending': return <TrendingUp className={cls} />
    case 'laptop': return <Laptop className={cls} />
    default: return null
  }
}

function ValueIcon({ type }: { type: string }) {
  const cls = 'h-6 w-6 text-neutral-700'
  switch (type) {
    case 'message': return <MessageSquare className={cls} />
    case 'check': return <CheckSquare className={cls} />
    case 'zap': return <Zap className={cls} />
    case 'book': return <BookOpen className={cls} />
    default: return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CareersPage() {
  const { locale } = useLocale()
  const t = locale === 'ro' ? ro : en
  const reduced = useReducedMotion() ?? false
  const formSectionRef = useRef<HTMLElement>(null)

  // Form state
  const [fields, setFields] = useState<FormFields>({ name: '', email: '', domain: '', portfolio: '', message: '', gdpr: false })
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormFields, boolean>>>({})
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const charsLeft = MAX_CHARS - fields.message.length

  function validate(f: FormFields): FormErrors {
    const errs: FormErrors = {}
    if (!f.name.trim()) errs.name = t.errNameRequired
    else if (f.name.trim().length < 2) errs.name = t.errNameMin
    if (!f.email.trim()) errs.email = t.errEmailRequired
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs.email = t.errEmailInvalid
    if (!f.domain) errs.domain = t.errDomainRequired
    if (!f.message.trim()) errs.message = t.errMessageRequired
    else if (f.message.trim().length < 30) errs.message = t.errMessageMin
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

  const isFormValid = Object.keys(validate(fields)).length === 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const allTouched: Partial<Record<keyof FormFields, boolean>> = { name: true, email: true, domain: true, message: true, gdpr: true }
    setTouched(allTouched)
    const errs = validate(fields)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setStatus('loading')
    await new Promise((r) => setTimeout(r, 1500))
    setStatus('success')
  }

  const inputBase = 'w-full rounded-lg border bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all'
  const inputOk = 'border-neutral-200 focus:border-neutral-400 focus:ring-neutral-200'
  const inputErr = 'border-red-400 focus:border-red-400 focus:ring-red-100'

  return (
    <main className="pt-20 overflow-hidden">
      {/* ── Section 1: Hero ────────────────────────────────────────────────── */}
      <section className="relative py-24 bg-white">
        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
        {/* Radial glow top-right */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full bg-neutral-900 opacity-[0.03] blur-3xl" />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          {/* Badge */}
          <motion.div
            {...(reduced ? {} : { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.45 } })}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-1.5 mb-8 shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-900" />
            </span>
            <Briefcase className="h-3.5 w-3.5 text-neutral-600" />
            <span className="text-xs font-semibold text-neutral-700 tracking-wide uppercase">{t.heroBadge}</span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.1, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } })}
            className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 leading-tight mb-4"
          >
            {t.heroH1Part1}{' '}
            <span className="relative inline-block">
              {t.heroH1Word}
              <motion.span
                {...(reduced ? {} : { initial: { scaleX: 0 }, animate: { scaleX: 1 }, transition: { duration: 0.5, delay: 0.55, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } })}
                className="absolute bottom-0 left-0 h-[3px] w-full bg-neutral-900 origin-left rounded-full"
              />
            </span>
            {' '}{t.heroH1Part2}
          </motion.h1>

          <motion.p
            {...(reduced ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.22, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } })}
            className="text-base sm:text-lg text-neutral-500 leading-relaxed max-w-2xl mx-auto"
          >
            {t.heroSub}
          </motion.p>
        </div>
      </section>

      {/* ── Section 2: Why Hontrio ─────────────────────────────────────────── */}
      <section className="py-20 bg-neutral-50">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div {...fadeUp(reduced)} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 mb-3">{t.whyH2}</h2>
            <p className="text-neutral-500 leading-relaxed max-w-md mx-auto">{t.whySub}</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {t.whyCards.map((card, i) => (
              <motion.div
                key={card.title}
                {...fadeUp(reduced, i * 0.07)}
                whileHover={reduced ? {} : { y: -4 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl border border-neutral-200 bg-white p-7 hover:border-neutral-300 hover:shadow-md transition-all duration-250"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 mb-4">
                  <WhyIcon type={card.icon} />
                </div>
                <h3 className="font-bold text-neutral-900 mb-2">{card.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{card.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: Open positions ──────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div {...fadeUp(reduced)} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">{t.openH2}</h2>
          </motion.div>

          <motion.div {...fadeUp(reduced, 0.1)} className="max-w-2xl mx-auto rounded-2xl border border-neutral-200 bg-white p-12 shadow-sm text-center">
            <SearchX className="h-16 w-16 mx-auto mb-5 text-neutral-200" />
            <h3 className="text-xl font-bold text-neutral-900 mb-3">{t.openCardTitle}</h3>
            <p className="text-sm text-neutral-500 leading-relaxed max-w-sm mx-auto mb-6">{t.openCardText}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-xs font-medium text-neutral-600">
                <RefreshCw className="h-3 w-3" />
                {t.openBadge1}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-xs font-medium text-neutral-600">
                <CheckCircle2 className="h-3 w-3" />
                {t.openBadge2}
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 4: Spontaneous application ────────────────────────────── */}
      <section ref={formSectionRef} id="apply" className="py-20 bg-neutral-50 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div {...fadeUp(reduced)} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 mb-3">{t.formH2}</h2>
            <p className="text-neutral-500 leading-relaxed max-w-md mx-auto">{t.formSub}</p>
          </motion.div>

          <motion.div {...fadeUp(reduced, 0.1)} className="max-w-2xl mx-auto bg-white rounded-2xl border border-neutral-200 p-9 shadow-md">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-neutral-900">{t.formCardTitle}</h3>
              <p className="mt-0.5 text-sm text-neutral-400">{t.formCardSub}</p>
            </div>

            <AnimatePresence mode="wait">
              {status === 'success' ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center text-center py-10 gap-4"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
                    <CheckCircle2 className="h-8 w-8 text-neutral-900" />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900">{t.successTitle}</h3>
                  <p className="text-sm text-neutral-500 max-w-sm">
                    {t.successText} <span className="font-semibold text-neutral-800">{fields.email}</span> {t.successTextSuffix}
                  </p>
                  <Link
                    href="/"
                    className="mt-2 rounded-lg border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    {t.successBtn}
                  </Link>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
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
                      {touched.name && errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">{t.labelEmail}</label>
                      <div className="relative">
                        <input
                          type="email"
                          value={fields.email}
                          onChange={(e) => handleChange('email', e.target.value)}
                          onBlur={() => handleBlur('email')}
                          placeholder={t.placeholderEmail}
                          className={`${inputBase} ${touched.email && errors.email ? inputErr : inputOk} pr-10`}
                        />
                        {fields.email && !errors.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) && (
                          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                        )}
                      </div>
                      {touched.email && errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                    </div>
                  </div>

                  {/* Domain */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">{t.labelDomain}</label>
                    <select
                      value={fields.domain}
                      onChange={(e) => handleChange('domain', e.target.value)}
                      onBlur={() => handleBlur('domain')}
                      className={`${inputBase} ${touched.domain && errors.domain ? inputErr : inputOk} appearance-none cursor-pointer`}
                    >
                      {t.domainOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} disabled={opt.value === ''}>{opt.label}</option>
                      ))}
                    </select>
                    {touched.domain && errors.domain && <p className="mt-1 text-xs text-red-600">{errors.domain}</p>}
                  </div>

                  {/* Portfolio (optional) */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <label className="text-xs font-semibold text-neutral-700">{t.labelPortfolio}</label>
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                        {t.badgeOptional}
                      </span>
                    </div>
                    <input
                      type="url"
                      value={fields.portfolio}
                      onChange={(e) => handleChange('portfolio', e.target.value)}
                      placeholder={t.placeholderPortfolio}
                      className={`${inputBase} ${inputOk}`}
                    />
                    <p className="mt-1 text-xs text-neutral-400">{t.portfolioHint}</p>
                  </div>

                  {/* Message with char counter */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-neutral-700">{t.labelMessage}</label>
                      <span className={`text-xs ${charsLeft < 50 ? 'text-red-500' : 'text-neutral-400'}`}>
                        {fields.message.length} {t.charOf} {MAX_CHARS}
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      maxLength={MAX_CHARS}
                      value={fields.message}
                      onChange={(e) => handleChange('message', e.target.value)}
                      onBlur={() => handleBlur('message')}
                      placeholder={t.placeholderMessage}
                      className={`${inputBase} resize-none ${touched.message && errors.message ? inputErr : inputOk}`}
                    />
                    {touched.message && errors.message && <p className="mt-1 text-xs text-red-600">{errors.message}</p>}
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
                        <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                          fields.gdpr ? 'bg-neutral-900 border-neutral-900' : 'bg-white border-neutral-300 group-hover:border-neutral-400'
                        }`}>
                          {fields.gdpr && (
                            <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <polyline points="1,4 4,7 9,1" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-neutral-500 leading-relaxed">
                        {t.labelGdpr}{' '}
                        <Link href="/legal/privacy" target="_blank" className="text-neutral-800 font-medium underline hover:no-underline">
                          {t.gdprLink}
                        </Link>
                        {' '}{t.labelGdprSuffix}
                      </span>
                    </label>
                    {touched.gdpr && errors.gdpr && (
                      <p className="mt-1 text-xs text-red-600 pl-7">{errors.gdpr}</p>
                    )}
                  </div>

                  {/* Legal note */}
                  <p className="text-xs text-neutral-400 italic leading-relaxed">{t.gdprNote}</p>

                  {/* Error banner */}
                  {status === 'error' && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex gap-3 items-start">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-700">
                        {t.errorText}{' '}
                        <a href="mailto:contact@hontrio.com" className="underline hover:no-underline">contact@hontrio.com</a>
                      </p>
                    </div>
                  )}

                  {/* Submit */}
                  <motion.button
                    type="submit"
                    disabled={status === 'loading'}
                    whileHover={reduced ? {} : { y: -2, boxShadow: '0 6px 20px rgba(0,0,0,0.18)' }}
                    transition={{ duration: 0.2 }}
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
                        <Send className="h-4 w-4" />
                      </>
                    )}
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* ── Section 5: Values ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div {...fadeUp(reduced)} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 mb-3">{t.valuesH2}</h2>
            <p className="text-neutral-500 leading-relaxed max-w-lg mx-auto">{t.valuesSub}</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {t.values.map((item, i) => (
              <motion.div key={item.title} {...fadeUp(reduced, i * 0.08)} className="flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 mb-4">
                  <ValueIcon type={item.icon} />
                </div>
                <h3 className="font-bold text-neutral-900 mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6: Dark CTA ────────────────────────────────────────────── */}
      <section className="py-20 bg-neutral-950">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.h2 {...fadeUp(reduced)} className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
            {t.ctaH2}
          </motion.h2>
          <motion.p {...fadeUp(reduced, 0.1)} className="text-neutral-400 mb-8 leading-relaxed">
            {t.ctaSub}
          </motion.p>
          <motion.div {...fadeUp(reduced, 0.18)} className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => formSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 transition-colors"
            >
              {t.ctaBtn}
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/contact"
              className="flex items-center gap-2 rounded-xl border border-neutral-700 px-6 py-3 text-sm font-semibold text-white hover:border-neutral-500 hover:bg-neutral-900 transition-colors"
            >
              {t.ctaBtn2}
            </Link>
          </motion.div>
          <motion.p {...fadeUp(reduced, 0.25)} className="mt-6 text-xs text-neutral-500">
            {t.ctaNote}
          </motion.p>
        </div>
      </section>
    </main>
  )
}
