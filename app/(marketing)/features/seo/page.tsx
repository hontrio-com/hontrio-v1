'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  TrendingUp, ArrowDown, SearchX, FileX, MousePointerClick, ChevronDown,
  CheckCircle, XCircle, AlertCircle, Package, Wand2, BarChart2, Upload,
  Heading1, AlignLeft, FileText, Search, BarChart, RefreshCw, Globe,
  Star, Zap, ArrowRight, Loader2,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'

// ─── Content ─────────────────────────────────────────────────────────────────

const en = {
  badge: 'SEO & Content Optimizer',
  h1a: 'Texts that sell',
  h1b: 'and pages Google finds',
  subtitle: "Boring descriptions and generic titles have no place in your store. Hontrio generates texts optimized for search engines and written to convince real people to buy.",
  cta: 'Try for free',
  ctaAlt: 'See a real example',
  socialProof: 'Over 500 stores use Hontrio',
  rating: '4.9 / 5',
  mockupLabel: 'Product',
  mockupProduct: '3-seater extendable sofa, grey fabric',
  mockupScoreLabel: 'SEO Score',
  mockupTitle: '3-Seater Extendable Sofa in Premium Fabric | Fast Delivery',
  mockupDesc: 'Discover the extendable sofa in premium fabric, perfect for modern living rooms.',
  floatClicks: '+47% more clicks',
  floatScore: 'Score 94/100',
  floatTime: 'Generated in 12s',
  painH2: 'Why texts written in a hurry cost real sales',
  painSub: "A good product with a weak description stays invisible. Google doesn't find it, and the buyer who lands on the page doesn't understand why to buy it.",
  painCta: 'Hontrio generates texts that work on both fronts.',
  pain1Title: "Google doesn't find your products",
  pain1: "Without the right keywords in the title and description, your products don't appear in the first results. Buyers searching for exactly what you sell never reach your page.",
  pain2Title: 'Copied descriptions from suppliers penalize you',
  pain2: "Duplicate content is one of the most common mistakes in eCommerce. Google penalizes pages that don't have original and unique texts for each product.",
  pain3Title: "Visitors land on the page but don't buy",
  pain3: "A vague title and an unstructured description don't explain the product's benefits. The buyer doesn't quickly find what they're looking for and leaves for the competition.",
  howH2: 'From product to optimized page in seconds',
  howSub: 'The process is fully automatic. You supervise, Hontrio generates.',
  step1Title: 'Select the product',
  step1: 'Choose the product from the list synced with your store. Hontrio automatically takes existing information: current title, description, category and specs.',
  step2Title: 'System analyzes and generates',
  step2: 'AI analyzes the product, identifies relevant keywords for your market and generates the title, short description, long description and meta description.',
  step3Title: 'Check the score and adjust',
  step3: 'Each generated text comes with a visual SEO score and concrete improvement suggestions. You can accept the text as-is or ask for alternative versions.',
  step4Title: 'Publish directly to your store',
  step4: 'One click and the new texts are live in WooCommerce. No copy-paste, no manual steps, no risk of errors.',
  demoH2: 'See the difference in real time',
  demoSub: 'Same product, two completely different presentations. One ignored, one that sells.',
  demoIdleLabel: 'Product to optimize',
  demoGenerateBtn: 'Optimize with AI',
  demoResetBtn: 'Try again',
  processingSteps: ['Analyzing product...', 'Identifying keywords...', 'Generating optimized title...', 'Finalizing meta description...'],
  processingBtn: 'Generating...',
  tabBefore: 'Before Hontrio',
  tabAfter: 'After Hontrio',
  beforeTitle: 'Grey sofa 3 seats',
  beforeMeta: '',
  beforeDesc: 'Extendable sofa made of fabric. Dimensions 220x90. Available in grey.',
  beforeBadge: 'Optimization needed',
  beforeIssue1: 'Title too short',
  beforeIssue2: 'No keywords',
  beforeIssue3: 'Incomplete description',
  afterTitle: '3-Seater Extendable Sofa in Premium Fabric | Anthracite Grey | Delivery in 24h',
  afterMeta: 'Discover the extendable sofa in premium fabric available in anthracite grey. Ideal for modern living rooms, fast delivery throughout the country.',
  afterDesc: '3-seater extendable sofa, upholstered in high-quality wear-resistant fabric. The extension mechanism works smoothly and silently. Perfect for modern homes with optimized space.',
  afterBadge: 'Optimized',
  afterCheck1: 'Title optimized',
  afterCheck2: 'Complete meta description',
  afterCheck3: 'Keywords integrated',
  demoBtn: 'Optimize your products',
  demoNote: 'No account needed. No setup required.',
  whatH2: 'Everything a product needs to sell',
  whatSub: 'Not just a description. A complete set of optimized texts for every product in your store.',
  w1Title: 'SEO-optimized title',
  w1: 'The product title contains the main keywords, respects the optimal length for search engines and is formulated to attract clicks in search results.',
  w2Title: 'Short description',
  w2: 'A concise paragraph presenting the main benefits of the product. Written to quickly convince the buyer that they found what they were looking for.',
  w3Title: 'Structured long description',
  w3: 'Detailed content organized in clear sections: benefits, technical specs, usage instructions and information relevant to the purchase decision.',
  w4Title: 'Meta description',
  w4: 'The text that appears under the title in Google results. Formulated to increase the click-through rate from search and set the right expectations for the visitor.',
  w5Title: 'Visual SEO score',
  w5: 'A numeric indicator between 0 and 100 showing optimization quality. Accompanied by concrete suggestions about what can be improved further.',
  w6Title: 'Alternative versions',
  w6: "Not happy with the first result? You can request alternative versions of the title or description without consuming additional credits.",
  scoreH2: 'You know exactly how well optimized each product is',
  scoreSub: 'Each generated text automatically receives a score between 0 and 100 based on the most important optimization factors. You don\'t need to know SEO rules. Hontrio applies them and shows you the result.',
  scoreTag: 'SEO Score',
  scoreP: 'Each generated text automatically receives a score between 0 and 100 based on the most important optimization factors. You don\'t need to know SEO rules. Hontrio applies them and shows you the result.',
  sf1Title: 'Keyword density',
  sf1: 'Main keywords appear in the right places and with the right frequency.',
  sf2Title: 'Optimal text length',
  sf2: 'Title, description and meta description respect the lengths recommended by Google.',
  sf3Title: 'Content structure',
  sf3: 'Information is logically organized and easy to browse for visitors and search engines.',
  sf4Title: 'Guaranteed uniqueness',
  sf4: 'No generated text is repeated between products. Each page has original content.',
  scoreProduct1: '3-seater extendable sofa',
  scoreProduct2: 'Oak coffee table',
  scoreProduct3: 'Round mirror 80cm',
  scoreOptBtn: 'Optimize all products',
  multiH2: 'Optimized for any market, in any language',
  multiSub: "If you also sell outside Romania, Hontrio generates native SEO texts in the target market's language. Not literal translations, but texts written naturally for that market.",
  multiTag: 'Multilingual',
  multiP: "If you also sell outside Romania, Hontrio generates native SEO texts in the target market's language. Not literal translations, but texts written naturally for that market.",
  ml1: 'Native texts: Content written in the natural style of the language, not mechanically translated.',
  ml2: 'Local keywords: The search terms actually used by buyers in that market.',
  ml3: '14 languages available: Romanian, English, Spanish, French, German and others.',
  statsH2: 'Numbers that show SEO optimization works',
  stat1Value: 52,
  stat1Suffix: '%',
  stat1Label: 'organic traffic in the first 60 days after optimization',
  stat2Prefix: '3x',
  stat2Value: 0,
  stat2Label: 'more products on the first page of Google compared to original texts',
  stat3Value: 28,
  stat3Suffix: '%',
  stat3Label: 'conversion rate on pages with texts optimized by Hontrio',
  faqH2: 'Frequently asked questions',
  faqs: [
    { q: 'Are generated texts truly unique for each product?', a: 'Yes. The system generates original content for each product individually, based on the specific information of that product. There are no fixed templates and no text is repeated between different products.' },
    { q: 'Can I edit the texts after they have been generated?', a: 'Yes. All generated texts can be manually edited before publishing. Hontrio provides a solid base, and you have the final say before the texts appear in your store.' },
    { q: 'Does it work for products in a very specific niche?', a: 'Yes. The system analyzes the information you provide about the product and adapts to any category or niche. The more details you provide, the more precise the results.' },
    { q: 'How long until results appear in Google after optimization?', a: 'Results in search engines depend on several factors external to Hontrio, including Google\'s crawl frequency for your site. Generally, the first positioning improvements become visible within four to eight weeks of publishing the optimized texts.' },
    { q: 'Is an optimization permanent or does it need to be repeated?', a: 'Published texts remain in your store without any additional action. Re-optimization is useful when you update a product, when the season changes or when you want to test new titles and descriptions.' },
  ],
  ctaH2: 'Your products deserve texts that actually sell.',
  ctaSub: 'Try it free. No credit card, no commitment.',
  ctaBtn: 'Try for free',
  ctaNote: 'Or go back to test the ',
  ctaNoteLink: 'interactive demo',
}

const ro = {
  badge: 'SEO & Content Optimizer',
  h1a: 'Texte care vand',
  h1b: 'si pagini pe care Google le gaseste',
  subtitle: "Descrierile plictisitoare si titlurile generice nu mai au loc in magazinul tau. Hontrio genereaza texte optimizate pentru motoarele de cautare si scrise sa convinga oameni reali sa cumpere.",
  cta: 'Incearca gratuit',
  ctaAlt: 'Vezi un exemplu real',
  socialProof: 'Peste 500 de magazine folosesc Hontrio',
  rating: '4,9 / 5',
  mockupLabel: 'Produs',
  mockupProduct: 'Canapea extensibila 3 locuri, stofa gri',
  mockupScoreLabel: 'Scor SEO',
  mockupTitle: 'Canapea Extensibila 3 Locuri din Stofa Premium | Livrare Rapida',
  mockupDesc: 'Descopera canapeaua din stofa de inalta calitate, perfecta pentru living-uri moderne.',
  floatClicks: '+47% mai multe clickuri',
  floatScore: 'Scor 94/100',
  floatTime: 'Generat in 12s',
  painH2: 'De ce textele scrise in graba costa vanzari reale',
  painSub: "Un produs bun cu o descriere slaba ramane nevazut. Google nu il gaseste, iar cumparatorul care ajunge pe pagina nu intelege de ce sa il cumpere.",
  painCta: 'Hontrio genereaza texte care functioneaza pe ambele fronturi.',
  pain1Title: 'Google nu gaseste produsele tale',
  pain1: 'Fara cuvintele cheie potrivite in titlu si descriere, produsele tale nu apar in primele rezultate. Cumparatorii care cauta exact ce vinzi nu ajung niciodata pe pagina ta.',
  pain2Title: 'Descrierile copiate din furnizor te penalizeaza',
  pain2: 'Continutul duplicat este una dintre cele mai frecvente greseli in eCommerce. Google penalizeaza paginile care nu au texte originale si unice pentru fiecare produs.',
  pain3Title: 'Vizitatorii ajung pe pagina dar nu cumpara',
  pain3: 'Un titlu vag si o descriere fara structura nu explica beneficiile produsului. Cumparatorul nu gaseste rapid ce cauta si pleaca la concurenta.',
  howH2: 'De la produs la pagina optimizata in cateva secunde',
  howSub: 'Procesul este complet automat. Tu supervizezi, Hontrio genereaza.',
  step1Title: 'Selectezi produsul',
  step1: 'Alegi produsul din lista sincronizata cu magazinul tau. Hontrio preia automat informatiile existente: titlul curent, descrierea, categoria si specificatiile.',
  step2Title: 'Sistemul analizeaza si genereaza',
  step2: 'Inteligenta artificiala analizeaza produsul, identifica cuvintele cheie relevante pentru piata ta si genereaza titlul, descrierea scurta, descrierea lunga si meta description.',
  step3Title: 'Verifici scorul si ajustezi',
  step3: 'Fiecare text generat vine cu un scor SEO vizual si sugestii concrete de imbunatatire. Poti accepta textul ca atare sau poti cere variante alternative.',
  step4Title: 'Publici direct in magazin',
  step4: 'Un singur click si textele noi sunt live in WooCommerce. Fara copy-paste, fara pasi manuali, fara risc de erori.',
  demoH2: 'Vezi diferenta in timp real',
  demoSub: 'Acelasi produs, doua prezentari total diferite. Una ignorata, una care vinde.',
  demoIdleLabel: 'Produs de optimizat',
  demoGenerateBtn: 'Optimizeaza cu AI',
  demoResetBtn: 'Incearca din nou',
  processingSteps: ['Analizez produsul...', 'Identific cuvintele cheie...', 'Generez titlul optimizat...', 'Finalizez meta description...'],
  processingBtn: 'Se genereaza...',
  tabBefore: 'Inainte de Hontrio',
  tabAfter: 'Dupa Hontrio',
  beforeTitle: 'Canapea gri 3 locuri',
  beforeMeta: '',
  beforeDesc: 'Canapea extensibila din stofa. Dimensiuni 220x90. Disponibila in gri.',
  beforeBadge: 'Optimizare necesara',
  beforeIssue1: 'Titlu prea scurt',
  beforeIssue2: 'Fara cuvinte cheie',
  beforeIssue3: 'Descriere incompleta',
  afterTitle: 'Canapea Extensibila 3 Locuri din Stofa Premium | Gri Antracit | Livrare in 24h',
  afterMeta: 'Descopera canapeaua extensibila din stofa premium disponibila in gri antracit. Ideala pentru living-uri moderne, livrare rapida in toata tara.',
  afterDesc: 'Canapea extensibila cu 3 locuri, tapitata in stofa de inalta calitate rezistenta la uzura. Mecanismul de extensie functioneaza fluid si silentios. Perfecta pentru locuinte moderne cu spatiu optimizat.',
  afterBadge: 'Optimizat',
  afterCheck1: 'Titlu optimizat',
  afterCheck2: 'Meta description completa',
  afterCheck3: 'Cuvinte cheie integrate',
  demoBtn: 'Optimizeaza produsele tale',
  demoNote: 'Nu ai nevoie de cont. Nicio configurare necesara.',
  whatH2: 'Tot ce are nevoie un produs pentru a vinde',
  whatSub: 'Nu doar o descriere. Un set complet de texte optimizate pentru fiecare produs din magazinul tau.',
  w1Title: 'Titlu optimizat SEO',
  w1: 'Titlul produsului contine cuvintele cheie principale, respecta lungimea optima pentru motoarele de cautare si este formulat sa atraga clickuri in rezultatele de cautare.',
  w2Title: 'Descriere scurta',
  w2: 'Un paragraf concis care prezinta principalele beneficii ale produsului. Scris sa convinga rapid cumparatorul ca a gasit ce cauta.',
  w3Title: 'Descriere lunga structurata',
  w3: 'Continut detaliat organizat in sectiuni clare: beneficii, specificatii tehnice, instructiuni de utilizare si informatii relevante pentru decizia de cumparare.',
  w4Title: 'Meta description',
  w4: 'Textul care apare sub titlu in rezultatele Google. Formulat sa creasca rata de click din cautare si sa seteze asteptarile corecte pentru vizitator.',
  w5Title: 'Scor SEO vizual',
  w5: 'Un indicator numeric intre 0 si 100 care arata calitatea optimizarii. Insotit de sugestii concrete despre ce poate fi imbunatatit in continuare.',
  w6Title: 'Variante alternative',
  w6: 'Nu esti multumit de primul rezultat? Poti cere variante alternative de titlu sau descriere fara sa consumi credite suplimentare.',
  scoreH2: 'Stii exact cat de bine optimizat este fiecare produs',
  scoreSub: 'Fiecare text generat primeste automat un scor intre 0 si 100 bazat pe cei mai importanti factori de optimizare. Nu trebuie sa cunosti regulile SEO. Hontrio le aplica si iti arata rezultatul.',
  scoreTag: 'SEO Score',
  scoreP: 'Fiecare text generat primeste automat un scor intre 0 si 100 bazat pe cei mai importanti factori de optimizare. Nu trebuie sa cunosti regulile SEO. Hontrio le aplica si iti arata rezultatul.',
  sf1Title: 'Densitatea cuvintelor cheie',
  sf1: 'Cuvintele cheie principale apar in locurile corecte si cu frecventa potrivita.',
  sf2Title: 'Lungimea optima a textelor',
  sf2: 'Titlul, descrierea si meta description respecta lungimile recomandate de Google.',
  sf3Title: 'Structura continutului',
  sf3: 'Informatiile sunt organizate logic si usor de parcurs de vizitatori si motoare de cautare.',
  sf4Title: 'Unicitate garantata',
  sf4: 'Niciun text generat nu se repeta intre produse. Fiecare pagina are continut original.',
  scoreProduct1: 'Canapea extensibila 3 locuri',
  scoreProduct2: 'Masuta de cafea stejar',
  scoreProduct3: 'Oglinda rotunda 80cm',
  scoreOptBtn: 'Optimizeaza toate produsele',
  multiH2: 'Optimizat pentru orice piata, in orice limba',
  multiSub: 'Daca vinzi si in afara Romaniei, Hontrio genereaza texte SEO native in limba pietei tinta. Nu traduceri literale, ci texte scrise natural pentru acea piata.',
  multiTag: 'Multilingv',
  multiP: 'Daca vinzi si in afara Romaniei, Hontrio genereaza texte SEO native in limba pietei tinta. Nu traduceri literale, ci texte scrise natural pentru acea piata.',
  ml1: 'Texte native: Continut scris in stilul natural al limbii, nu tradus mecanic.',
  ml2: 'Cuvinte cheie locale: Termenii de cautare folositi efectiv de cumparatorii din piata respectiva.',
  ml3: '14 limbi disponibile: Romana, engleza, spaniola, franceza, germana si altele.',
  statsH2: 'Cifre care arata ca optimizarea SEO functioneaza',
  stat1Value: 52,
  stat1Suffix: '%',
  stat1Label: 'trafic organic in primele 60 de zile de la optimizare',
  stat2Prefix: '3x',
  stat2Value: 0,
  stat2Label: 'mai multe produse in prima pagina Google fata de textele initiale',
  stat3Value: 28,
  stat3Suffix: '%',
  stat3Label: 'rata de conversie pe paginile cu texte optimizate de Hontrio',
  faqH2: 'Intrebari frecvente',
  faqs: [
    { q: 'Textele generate sunt cu adevarat unice pentru fiecare produs?', a: 'Da. Sistemul genereaza continut original pentru fiecare produs in parte, bazat pe informatiile specifice ale acelui produs. Nu exista sabloane fixe si niciun text nu se repeta intre produse diferite.' },
    { q: 'Pot edita textele dupa ce au fost generate?', a: 'Da. Toate textele generate pot fi editate manual inainte de publicare. Hontrio ofera o baza solida, iar tu ai ultimul cuvant inainte ca textele sa apara in magazin.' },
    { q: 'Functioneaza si pentru produse dintr-o nisa foarte specifica?', a: 'Da. Sistemul analizeaza informatiile pe care le introduci despre produs si se adapteaza la orice categorie sau nisa. Cu cat oferi mai multe detalii, cu atat rezultatele sunt mai precise.' },
    { q: 'Cat dureaza pana apar rezultatele in Google dupa optimizare?', a: 'Rezultatele in motoarele de cautare depind de mai multi factori externi Hontrio, inclusiv frecventa de crawl a Google pentru site-ul tau. In general, primele imbunatatiri de pozitionare devin vizibile in patru pana la opt saptamani de la publicarea textelor optimizate.' },
    { q: 'O optimizare este permanenta sau trebuie repetata?', a: 'Textele publicate raman in magazinul tau fara nicio actiune suplimentara. Reoptimizarea este utila cand actualizezi un produs, cand sezonul se schimba sau cand vrei sa testezi variante noi de titluri si descrieri.' },
  ],
  ctaH2: 'Produsele tale merita texte care chiar vand.',
  ctaSub: 'Incearca gratuit. Fara card de credit, fara angajament.',
  ctaBtn: 'Incearca gratuit',
  ctaNote: 'Sau intoarce-te sa testezi ',
  ctaNoteLink: 'demo-ul interactiv',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useCountUp(target: number, active: boolean, duration = 1500) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active || target === 0) return
    setVal(0)
    let cur = 0
    const steps = 60
    const inc = target / steps
    const interval = duration / steps
    const t = setInterval(() => {
      cur += inc
      if (cur >= target) { setVal(target); clearInterval(t) }
      else setVal(Math.floor(cur))
    }, interval)
    return () => clearInterval(t)
  }, [target, active, duration])
  return val
}

// ─── TypewriterText ───────────────────────────────────────────────────────────

function TypewriterText({ texts, charDelay = 40 }: { texts: string[]; charDelay?: number }) {
  const [textIdx, setTextIdx] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [phase, setPhase] = useState<'typing' | 'waiting' | 'erasing'>('typing')
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) { setDisplayed(texts[0]); return }
    const fullText = texts[textIdx]
    if (phase === 'typing') {
      if (displayed.length < fullText.length) {
        const t = setTimeout(() => setDisplayed(fullText.slice(0, displayed.length + 1)), charDelay)
        return () => clearTimeout(t)
      } else {
        const t = setTimeout(() => setPhase('waiting'), 3000)
        return () => clearTimeout(t)
      }
    } else if (phase === 'waiting') {
      setPhase('erasing')
    } else if (phase === 'erasing') {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), charDelay / 2)
        return () => clearTimeout(t)
      } else {
        setTextIdx((i) => (i + 1) % texts.length)
        setPhase('typing')
      }
    }
  }, [displayed, phase, textIdx, texts, charDelay, reduced])

  return (
    <span>
      {displayed}
      <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>|</motion.span>
    </span>
  )
}

// ─── SEODonutChart ────────────────────────────────────────────────────────────

function SEODonutChart({ score, color, label, triggerAnimate }: {
  score: number
  color: string
  label: string
  triggerAnimate: boolean
}) {
  const reduced = useReducedMotion()
  const circumference = 2 * Math.PI * 36
  const offset = circumference * (1 - score / 100)
  const [animatedOffset, setAnimatedOffset] = useState(circumference)

  useEffect(() => {
    if (!triggerAnimate || reduced) { setAnimatedOffset(offset); return }
    setAnimatedOffset(circumference)
    const t = setTimeout(() => setAnimatedOffset(offset), 100)
    return () => clearTimeout(t)
  }, [triggerAnimate, offset, circumference, reduced])

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="36" fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="36" fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: reduced ? 'none' : 'stroke-dashoffset 1.5s ease-out' }}
        />
        <text x="50" y="46" textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="bold" fill={color}>{score}</text>
        <text x="50" y="62" textAnchor="middle" fontSize="9" fill="#6b7280">{label}</text>
      </svg>
    </div>
  )
}

// ─── FAQItem ──────────────────────────────────────────────────────────────────

function FAQItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-neutral-100 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-4 py-5 text-left"
      >
        <span className="text-base font-medium text-neutral-900 leading-snug">{q}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 mt-0.5 text-neutral-400"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' as const }}
            className="overflow-hidden"
          >
            <p className="text-neutral-500 leading-relaxed pb-5">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SEOPage() {
  const { locale } = useT()
  const c = locale === 'ro' ? ro : en
  const reduced = useReducedMotion()

  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'before' | 'after'>('before')
  const [heroVisible, setHeroVisible] = useState(false)
  const [demoState, setDemoState] = useState<'idle' | 'processing' | 'done'>('idle')
  const [demoProgress, setDemoProgress] = useState(0)
  const [demoStepIdx, setDemoStepIdx] = useState(0)

  // Refs for intersection observers
  const statsRef = useRef<HTMLDivElement>(null)
  const scoreRef = useRef<HTMLDivElement>(null)
  const multiRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)

  const [statsActive, setStatsActive] = useState(false)
  const [scoreActive, setScoreActive] = useState(false)
  const [multiActive, setMultiActive] = useState(false)

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const observe = (el: Element | null, cb: () => void, threshold = 0.2) => {
      if (!el) return
      const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { cb(); obs.disconnect() } }, { threshold })
      obs.observe(el)
      observers.push(obs)
    }
    observe(statsRef.current, () => setStatsActive(true))
    observe(scoreRef.current, () => setScoreActive(true))
    observe(multiRef.current, () => setMultiActive(true))
    // Hero chart triggers after mount
    const t = setTimeout(() => setHeroVisible(true), 600)
    return () => { observers.forEach(o => o.disconnect()); clearTimeout(t) }
  }, [])

  const stat1 = useCountUp(c.stat1Value, statsActive)
  const stat3 = useCountUp(c.stat3Value, statsActive)

  const fadeUp = (delay = 0) => reduced ? {} : {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 as number },
    transition: { duration: 0.6, ease: 'easeOut' as const, delay },
  }

  const greenGradientText = {
    background: 'linear-gradient(135deg, #0f5c2e 0%, #16a34a 50%, #4ade80 100%)',
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
    backgroundClip: 'text' as const,
  }

  const startDemo = useCallback(() => {
    if (demoState === 'processing') return
    setDemoState('processing')
    setDemoProgress(0)
    setDemoStepIdx(0)
    const startTime = Date.now()
    const duration = 3500
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const p = Math.min((elapsed / duration) * 100, 100)
      setDemoProgress(p)
      if (p >= 100) { clearInterval(interval); setTimeout(() => setDemoState('done'), 200) }
    }, 32)
    const stepTimings = [0, 900, 1800, 2700]
    stepTimings.forEach((delay, i) => { setTimeout(() => setDemoStepIdx(i), delay) })
  }, [demoState])

  const notOptimized = locale === 'ro' ? 'Necesita optimizare' : 'Needs optimization'

  return (
    <div>
      {/* ═══ SECTION 1 — HERO ═══ */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.5,
        }} />
        {/* Radial gradient top-right */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(22,163,74,0.08) 0%, transparent 70%)',
        }} />

        <div className="relative max-w-3xl mx-auto text-center">
          {/* Badge */}
          <motion.div {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } })}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border mb-6 text-sm font-medium"
              style={{ background: 'rgba(22,163,74,0.08)', borderColor: 'rgba(22,163,74,0.2)', color: '#16a34a' }}>
              <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
                <TrendingUp className="h-3.5 w-3.5" />
              </motion.div>
              {c.badge}
            </div>
          </motion.div>

          {/* H1 */}
          <motion.div {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.1 } })}>
            <h1 className="font-extrabold text-neutral-900 leading-[1.05] tracking-tight mb-6"
              style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}>
              <span style={greenGradientText}>{c.h1a}</span>
              <br />
              {c.h1b}
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.div {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.2 } })}>
            <p className="text-[18px] text-neutral-500 leading-[1.7] mb-8 max-w-[600px] mx-auto">{c.subtitle}</p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.3 } })}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl text-[15px] font-semibold text-white hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] transition-all duration-200 shadow-[0_2px_8px_rgba(22,163,74,0.3)]"
                style={{ background: '#16a34a' }}
              >
                {c.cta}
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-1.5 px-6 py-3.5 rounded-xl text-[15px] font-semibold text-neutral-600 border border-neutral-200 bg-white/60 hover:bg-white hover:border-neutral-300 transition-colors"
              >
                {c.ctaAlt}
                <motion.span animate={{ y: [0, 2, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <ArrowDown className="h-4 w-4" />
                </motion.span>
              </a>
            </div>
          </motion.div>

          {/* Hero card */}
          <motion.div
            ref={heroRef}
            className="relative max-w-[700px] mx-auto mt-14 overflow-visible"
            {...(reduced ? {} : { initial: { opacity: 0, y: 32 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: 0.5 } })}
          >
            <div className="bg-white rounded-2xl shadow-xl border border-neutral-100 p-6 relative overflow-visible">
              {/* Input field */}
              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">{c.mockupLabel}</label>
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-600">
                  <Package className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                  <span>{c.mockupProduct}</span>
                </div>
              </div>

              {/* Score + checks row */}
              <div className="flex items-center gap-6 mb-5">
                <SEODonutChart score={94} color="#16a34a" label={c.mockupScoreLabel} triggerAnimate={heroVisible} />
                <div className="flex flex-col gap-2">
                  {[c.afterCheck1, c.afterCheck2, c.afterCheck3].map((item, i) => (
                    <motion.div
                      key={i}
                      className="flex items-center gap-2 text-sm text-neutral-700"
                      {...(reduced ? {} : {
                        initial: { opacity: 0, x: -12 },
                        animate: { opacity: 1, x: 0 },
                        transition: { duration: 0.4, delay: 0.8 + i * 0.15 },
                      })}
                    >
                      <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#16a34a' }} />
                      {item}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Typewriter output */}
              <div className="px-4 py-3 rounded-xl border border-neutral-100 bg-neutral-50 text-sm text-neutral-700 min-h-[48px] text-left">
                <TypewriterText texts={[c.mockupTitle, c.mockupDesc]} />
              </div>

              {/* Floating badges */}
              <motion.div
                className="absolute -bottom-3 -left-4 flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl shadow-lg border border-neutral-100 text-xs font-semibold text-neutral-700 whitespace-nowrap"
                animate={reduced ? {} : { y: [0, -3, 0, 3, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              >
                <TrendingUp className="h-3.5 w-3.5" style={{ color: '#16a34a' }} />
                {c.floatClicks}
              </motion.div>

              <motion.div
                className="absolute -top-3 -right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl shadow-lg border border-neutral-100 text-xs font-semibold text-neutral-700 whitespace-nowrap"
                animate={reduced ? {} : { y: [0, 3, 0, -3, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
              >
                <Star className="h-3.5 w-3.5 text-amber-400" />
                {c.floatScore}
              </motion.div>

              <motion.div
                className="absolute -bottom-3 -right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl shadow-lg border border-neutral-100 text-xs font-semibold text-neutral-700 whitespace-nowrap"
                animate={reduced ? {} : { y: [0, -3, 0, 3, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
              >
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                {c.floatTime}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 2 — PAIN POINTS ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-14" {...fadeUp()}>
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">{c.painH2}</h2>
            <p className="text-xl text-neutral-500 max-w-[600px] mx-auto">{c.painSub}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              { icon: SearchX, title: c.pain1Title, text: c.pain1 },
              { icon: FileX, title: c.pain2Title, text: c.pain2 },
              { icon: MousePointerClick, title: c.pain3Title, text: c.pain3 },
            ].map((card, i) => (
              <motion.div
                key={i}
                className="bg-white rounded-2xl border border-neutral-200 p-7 hover:border-[#16a34a]/40 hover:shadow-md hover:-translate-y-1 transition-all duration-250"
                {...(reduced ? {} : {
                  initial: { opacity: 0, y: 24 },
                  whileInView: { opacity: 1, y: 0 },
                  viewport: { once: true, amount: 0.2 },
                  transition: { duration: 0.5, delay: i * 0.15 },
                })}
              >
                <card.icon className="h-8 w-8 text-neutral-400 mb-4" />
                <h3 className="text-base font-bold text-neutral-900 mb-2">{card.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{card.text}</p>
              </motion.div>
            ))}
          </div>

          <motion.div className="text-center" {...fadeUp(0.2)}>
            <p className="text-sm text-neutral-400 flex items-center justify-center gap-1">
              <motion.span animate={{ y: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <ChevronDown className="h-4 w-4" />
              </motion.span>
              {c.painCta}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 3 — HOW IT WORKS ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeUp()}>
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">{c.howH2}</h2>
            <p className="text-xl text-neutral-500">{c.howSub}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 relative">
            {/* Animated arrows between steps */}
            {[0, 1, 2].map((idx) => (
              <motion.div
                key={`arrow-${idx}`}
                className="hidden md:flex absolute items-center justify-center z-10"
                style={{ top: 50, left: `calc(${(idx + 1) * 25}% - 10px)` }}
                {...(reduced ? {} : {
                  initial: { opacity: 0, x: -8 },
                  whileInView: { opacity: 1, x: 0 },
                  viewport: { once: true, amount: 0.5 },
                  transition: { duration: 0.4, ease: 'easeOut' as const, delay: 0.4 + idx * 0.2 },
                })}
              >
                <ArrowRight className="h-5 w-5 text-neutral-300" />
              </motion.div>
            ))}

            {[
              { num: '01', Icon: Package, title: c.step1Title, text: c.step1 },
              { num: '02', Icon: BarChart2, title: c.step2Title, text: c.step2 },
              { num: '03', Icon: Search, title: c.step3Title, text: c.step3 },
              { num: '04', Icon: Upload, title: c.step4Title, text: c.step4 },
            ].map((step, i) => (
              <motion.div
                key={i}
                className="relative z-10 flex flex-col items-center text-center px-2"
                {...(reduced ? {} : {
                  initial: { opacity: 0, y: 24 },
                  whileInView: { opacity: 1, y: 0 },
                  viewport: { once: true, amount: 0.2 },
                  transition: { duration: 0.5, delay: i * 0.15 },
                })}
              >
                <div className="relative mb-5">
                  <span className="absolute -top-2 -right-2 font-black text-neutral-100 select-none z-0" style={{ fontSize: 48, lineHeight: 1 }}>{step.num}</span>
                  <div className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center shadow-md" style={{ background: '#16a34a' }}>
                    <step.Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-neutral-900 mb-2">{step.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{step.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 4 — DEMO ═══ */}
      <section id="demo" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-2xl mx-auto">
          <motion.div className="text-center mb-12" {...fadeUp()}>
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-4">{c.demoH2}</h2>
            <p className="text-xl text-neutral-500">{c.demoSub}</p>
          </motion.div>

          <motion.div {...fadeUp(0.1)}>
            {/* App window */}
            <div className="bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden">

              {/* Window chrome */}
              <div className="flex items-center gap-2 px-5 py-3.5 bg-neutral-50/80 border-b border-neutral-100">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <span className="flex-1 text-center text-[11px] text-neutral-400 font-medium tracking-wide">SEO Optimizer — Hontrio</span>
                <AnimatePresence mode="wait">
                  {demoState === 'idle' && (
                    <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-500 border border-red-200">
                      {locale === 'ro' ? 'Neoptimizat' : 'Not optimized'}
                    </motion.span>
                  )}
                  {demoState === 'processing' && (
                    <motion.span key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-600 border border-amber-200 flex items-center gap-1">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />{locale === 'ro' ? 'Procesez' : 'Processing'}
                    </motion.span>
                  )}
                  {demoState === 'done' && (
                    <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200">
                      {locale === 'ro' ? 'Optimizat' : 'Optimized'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Product row */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-neutral-50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${demoState === 'done' ? 'bg-emerald-50' : 'bg-neutral-100'}`}>
                    <Package className={`h-5 w-5 transition-colors duration-500 ${demoState === 'done' ? 'text-emerald-500' : 'text-neutral-400'}`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest">{c.demoIdleLabel}</p>
                    <p className="text-sm font-semibold text-neutral-800">{c.beforeTitle}</p>
                  </div>
                </div>
                <SEODonutChart
                  score={demoState === 'done' ? 94 : 31}
                  color={demoState === 'done' ? '#16a34a' : '#ef4444'}
                  label="Score"
                  triggerAnimate={demoState === 'done'}
                />
              </div>

              {/* Fields */}
              <div className="px-6 py-5 space-y-4">
                {[
                  { label: locale === 'ro' ? 'Titlu' : 'Title', idle: c.beforeTitle, done: c.afterTitle, delay: 0 },
                  { label: 'Meta Description', idle: locale === 'ro' ? 'Lipsa' : 'Missing', done: c.afterMeta, delay: 0.15, isPlaceholder: true },
                  { label: locale === 'ro' ? 'Descriere' : 'Description', idle: c.beforeDesc, done: c.afterDesc, delay: 0.3 },
                ].map((field) => (
                  <div key={field.label}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">{field.label}</p>
                    <div className={`relative rounded-xl border px-4 py-3 text-sm overflow-hidden transition-colors duration-500 ${
                      demoState === 'done' ? 'border-green-200 bg-green-50/30' :
                      demoState === 'processing' ? 'border-neutral-100 bg-neutral-50' :
                      'border-red-100 bg-red-50/20'
                    }`}>
                      {demoState === 'processing' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-neutral-100 via-white to-neutral-100 animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: '200% 100%' }} />
                      )}
                      {demoState !== 'processing' && (
                        <AnimatePresence mode="wait">
                          {demoState === 'done' ? (
                            <motion.span key="done" className="block font-medium leading-snug" style={{ color: '#16a34a' }}
                              initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              transition={{ duration: 0.4, delay: field.delay }}>
                              {field.done}
                            </motion.span>
                          ) : (
                            <motion.span key="idle" className={`block leading-snug ${field.isPlaceholder ? 'text-neutral-300 italic' : 'text-neutral-500'}`}
                              initial={false}>
                              {field.idle}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Status badges */}
              <div className="px-6 pb-5 min-h-[48px]">
                <AnimatePresence mode="wait">
                  {demoState === 'processing' ? (
                    <motion.div key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                      <AnimatePresence mode="wait">
                        <motion.p key={demoStepIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.25 }} className="text-sm font-medium text-neutral-500">
                          {c.processingSteps[demoStepIdx]}
                        </motion.p>
                      </AnimatePresence>
                      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-100" style={{ width: `${demoProgress}%`, background: '#16a34a' }} />
                      </div>
                    </motion.div>
                  ) : demoState === 'idle' ? (
                    <motion.div key="idle-badges" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap gap-2">
                      {[c.beforeIssue1, c.beforeIssue2, c.beforeIssue3].map((issue, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
                          <XCircle className="h-3 w-3 shrink-0" />{issue}
                        </span>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div key="done-badges" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap gap-2">
                      {[c.afterCheck1, c.afterCheck2, c.afterCheck3].map((check, i) => (
                        <motion.span key={i} className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100"
                          initial={reduced ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i * 0.1 }}>
                          <CheckCircle className="h-3 w-3 shrink-0" />{check}
                        </motion.span>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* CTA */}
              <div className="px-6 pb-6">
                <button
                  onClick={() => {
                    if (demoState === 'idle') startDemo()
                    else if (demoState === 'done') { setDemoState('idle'); setDemoProgress(0); setDemoStepIdx(0) }
                  }}
                  disabled={demoState === 'processing'}
                  className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 transition-all duration-200"
                  style={{ background: '#16a34a' }}
                >
                  {demoState === 'processing' ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />{c.processingBtn}</>
                  ) : demoState === 'done' ? (
                    <><RefreshCw className="h-4 w-4" />{c.demoResetBtn}</>
                  ) : (
                    <><Wand2 className="h-4 w-4" />{c.demoGenerateBtn}</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 5 — WHAT HONTRIO GENERATES ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-14" {...fadeUp()}>
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">{c.whatH2}</h2>
            <p className="text-xl text-neutral-500 max-w-2xl mx-auto">{c.whatSub}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Heading1, title: c.w1Title, text: c.w1 },
              { icon: AlignLeft, title: c.w2Title, text: c.w2 },
              { icon: FileText, title: c.w3Title, text: c.w3 },
              { icon: Search, title: c.w4Title, text: c.w4 },
              { icon: BarChart, title: c.w5Title, text: c.w5 },
              { icon: RefreshCw, title: c.w6Title, text: c.w6 },
            ].map((card, i) => (
              <motion.div
                key={i}
                className="bg-white rounded-2xl border border-neutral-200 p-6 hover:border-[#16a34a]/40 hover:shadow-md hover:-translate-y-1 transition-all duration-200"
                {...(reduced ? {} : {
                  initial: { opacity: 0, y: 24 },
                  whileInView: { opacity: 1, y: 0 },
                  viewport: { once: true, amount: 0.15 },
                  transition: { duration: 0.5, delay: (i % 3) * 0.12 },
                })}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(22,163,74,0.08)' }}>
                  <card.icon className="h-5 w-5" style={{ color: '#16a34a' }} />
                </div>
                <h3 className="text-base font-bold text-neutral-900 mb-2">{card.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{card.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 6 — SEO SCORE ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-6xl mx-auto">
          <div ref={scoreRef} className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <motion.div {...fadeUp()}>
              <span className="inline-block text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#16a34a' }}>{c.scoreTag}</span>
              <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">{c.scoreH2}</h2>
              <p className="text-lg text-neutral-500 leading-relaxed mb-8">{c.scoreP}</p>
              <ul className="space-y-4">
                {[
                  { title: c.sf1Title, text: c.sf1 },
                  { title: c.sf2Title, text: c.sf2 },
                  { title: c.sf3Title, text: c.sf3 },
                  { title: c.sf4Title, text: c.sf4 },
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    className="flex items-start gap-3"
                    {...(reduced ? {} : {
                      initial: { opacity: 0, x: -16 },
                      whileInView: { opacity: 1, x: 0 },
                      viewport: { once: true, amount: 0.5 },
                      transition: { duration: 0.4, delay: i * 0.12 },
                    })}
                  >
                    <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
                    <div>
                      <span className="text-sm font-bold text-neutral-900">{item.title}: </span>
                      <span className="text-sm text-neutral-500">{item.text}</span>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Right — Dashboard mockup */}
            <motion.div {...fadeUp(0.15)}>
              <div className="bg-white rounded-2xl shadow-md border border-neutral-100 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <BarChart className="h-4 w-4" style={{ color: '#16a34a' }} />
                    <span className="text-sm font-semibold text-neutral-800">{c.scoreTag}</span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: '#16a34a' }}>LIVE</span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-0 border-b border-neutral-100">
                  {[
                    { label: locale === 'ro' ? 'Total' : 'Total', value: 24, color: 'text-neutral-700' },
                    { label: locale === 'ro' ? 'Optimizate' : 'Optimized', value: 18, color: 'text-emerald-600' },
                    { label: locale === 'ro' ? 'Partiale' : 'Partial', value: 4, color: 'text-amber-500' },
                    { label: locale === 'ro' ? 'Neoptimizate' : 'Unoptimized', value: 2, color: 'text-red-500' },
                  ].map((s, i) => (
                    <div key={i} className={`py-3 text-center ${i < 3 ? 'border-r border-neutral-100' : ''}`}>
                      <p className={`text-[20px] font-bold tabular-nums ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-neutral-400 leading-tight px-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Product list */}
                <div className="divide-y divide-neutral-50">
                  {[
                    { name: c.scoreProduct1, score: 94, color: '#10b981', barClass: 'bg-emerald-500', dots: [true, true, true, true, true] },
                    { name: c.scoreProduct2, score: 78, color: '#f59e0b', barClass: 'bg-amber-400', dots: [true, true, true, true, false] },
                    { name: locale === 'ro' ? 'Canapea coltar maro' : 'Brown corner sofa', score: 62, color: '#f59e0b', barClass: 'bg-amber-400', dots: [true, true, false, false, false] },
                    { name: c.scoreProduct3, score: 41, color: '#ef4444', barClass: 'bg-red-400', dots: [true, false, false, false, false] },
                  ].map((p, i) => (
                    <motion.div
                      key={i}
                      className="flex items-center gap-3 px-4 py-3"
                      {...(reduced ? {} : {
                        initial: { opacity: 0, x: -12 },
                        whileInView: { opacity: 1, x: 0 },
                        viewport: { once: true, amount: 0.3 },
                        transition: { duration: 0.35, delay: scoreActive ? i * 0.08 : 0 },
                      })}
                    >
                      <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                        <Package className="h-3.5 w-3.5 text-neutral-300" />
                      </div>
                      <span className="flex-1 text-[12px] font-medium text-neutral-700 truncate">{p.name}</span>
                      <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                        {['T','M','K','S','L'].map((letter, j) => (
                          <div key={j} title={letter} className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold ${p.dots[j] ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-300'}`}>{letter}</div>
                        ))}
                      </div>
                      <div className="flex flex-col items-end gap-1 w-12 shrink-0">
                        <span className="text-[11px] font-bold tabular-nums" style={{ color: p.color }}>{p.score}</span>
                        <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${p.barClass}`}
                            initial={{ width: 0 }}
                            animate={scoreActive ? { width: `${p.score}%` } : { width: 0 }}
                            transition={{ duration: 1, ease: 'easeOut' as const, delay: scoreActive ? i * 0.15 : 0 }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Footer button */}
                <div className="px-4 pb-4 pt-2">
                  <button
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
                    style={{ background: '#16a34a' }}
                  >
                    <Wand2 className="h-4 w-4" />
                    {c.scoreOptBtn}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 7 — MULTILINGUAL ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div ref={multiRef} className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left text (40%) */}
            <motion.div {...fadeUp()}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest mb-5" style={{ background: 'rgba(22,163,74,0.08)', borderColor: 'rgba(22,163,74,0.2)', color: '#16a34a' }}>
                <Globe className="h-3.5 w-3.5" />
                {c.multiTag}
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">{c.multiH2}</h2>
              <p className="text-lg text-neutral-500 leading-relaxed mb-8">{c.multiP}</p>
              <ul className="space-y-3">
                {[c.ml1, c.ml2, c.ml3].map((item, i) => (
                  <motion.li
                    key={i}
                    className="flex items-start gap-3"
                    {...(reduced ? {} : {
                      initial: { opacity: 0, x: -14 },
                      whileInView: { opacity: 1, x: 0 },
                      viewport: { once: true, amount: 0.5 },
                      transition: { duration: 0.4, delay: i * 0.12 },
                    })}
                  >
                    <CheckCircle className="h-4 w-4 flex-shrink-0 mt-1" style={{ color: '#16a34a' }} />
                    <span className="text-sm text-neutral-600">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Right — language grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { flag: '🇷🇴', lang: 'Română',    title: 'Canapea Extensibila 3 Locuri din Stofa Premium | Livrare Rapida' },
                { flag: '🇬🇧', lang: 'English',   title: '3-Seater Extendable Sofa in Premium Fabric | Fast Delivery' },
                { flag: '🇩🇪', lang: 'Deutsch',   title: 'Ausziehbares 3-Sitzer Sofa aus Premium-Stoff | Lieferung in 24h' },
                { flag: '🇫🇷', lang: 'Français',  title: 'Canapé Extensible 3 Places en Tissu Premium | Livraison Express' },
                { flag: '🇪🇸', lang: 'Español',   title: 'Sofá Extensible 3 Plazas de Tela Premium | Entrega Rápida' },
                { flag: '🇮🇹', lang: 'Italiano',  title: 'Divano Estraibile 3 Posti in Tessuto Premium | Consegna in 24h' },
              ].map((card, i) => (
                <motion.div
                  key={card.lang}
                  className="flex items-start gap-3 bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  {...(reduced ? {} : {
                    initial: { opacity: 0, y: 16 },
                    whileInView: { opacity: 1, y: 0 },
                    viewport: { once: true, amount: 0.15 },
                    transition: { duration: 0.4, delay: i * 0.08 },
                  })}
                >
                  <span className="text-xl shrink-0 mt-0.5">{card.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">{card.lang}</p>
                    <p className="text-xs text-neutral-700 leading-relaxed">{card.title}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <CheckCircle className="h-3 w-3 shrink-0" style={{ color: '#16a34a' }} />
                      <span className="text-[10px] font-semibold" style={{ color: '#16a34a' }}>Score 94</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 8 — STATS ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-14" {...fadeUp()}>
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight">{c.statsH2}</h2>
          </motion.div>

          <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Stat 1 */}
            <motion.div
              className="bg-white rounded-2xl border border-neutral-100 p-8 text-center shadow-sm"
              {...(reduced ? {} : {
                initial: { opacity: 0, y: 24 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true, amount: 0.2 },
                transition: { duration: 0.5, delay: 0 },
              })}
            >
              <div className="font-extrabold mb-2" style={{ fontSize: 'clamp(48px, 6vw, 64px)', ...greenGradientText }}>
                +{stat1}{c.stat1Suffix}
              </div>
              <p className="text-sm text-neutral-500">{c.stat1Label}</p>
            </motion.div>

            {/* Stat 2 */}
            <motion.div
              className="bg-white rounded-2xl border border-neutral-100 p-8 text-center shadow-sm"
              {...(reduced ? {} : {
                initial: { opacity: 0, y: 24 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true, amount: 0.2 },
                transition: { duration: 0.5, delay: 0.12 },
              })}
            >
              <div className="font-extrabold mb-2" style={{ fontSize: 'clamp(48px, 6vw, 64px)', ...greenGradientText }}>
                {c.stat2Prefix}
              </div>
              <p className="text-sm text-neutral-500">{c.stat2Label}</p>
            </motion.div>

            {/* Stat 3 */}
            <motion.div
              className="bg-white rounded-2xl border border-neutral-100 p-8 text-center shadow-sm"
              {...(reduced ? {} : {
                initial: { opacity: 0, y: 24 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true, amount: 0.2 },
                transition: { duration: 0.5, delay: 0.24 },
              })}
            >
              <div className="font-extrabold mb-2" style={{ fontSize: 'clamp(48px, 6vw, 64px)', ...greenGradientText }}>
                +{stat3}{c.stat3Suffix}
              </div>
              <p className="text-sm text-neutral-500">{c.stat3Label}</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 9 — FAQ ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-[700px] mx-auto">
          <motion.div className="text-center mb-12" {...fadeUp()}>
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight">{c.faqH2}</h2>
          </motion.div>

          <motion.div
            className="bg-white rounded-2xl border border-neutral-100 shadow-sm divide-y-0"
            {...fadeUp(0.1)}
          >
            {c.faqs.map((faq, i) => (
              <FAQItem
                key={i}
                q={faq.q}
                a={faq.a}
                open={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 10 — CTA FINAL ═══ */}
      <section
        className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f5c2e 0%, #16a34a 50%, #4ade80 100%)' }}
      >
        {/* Animated hue shift overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={reduced ? {} : {
            background: [
              'linear-gradient(135deg, rgba(15,92,46,0.4) 0%, transparent 60%)',
              'linear-gradient(225deg, rgba(15,92,46,0.4) 0%, transparent 60%)',
              'linear-gradient(135deg, rgba(15,92,46,0.4) 0%, transparent 60%)',
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' as const }}
        />

        <div className="relative max-w-3xl mx-auto">
          <motion.h2
            className="font-extrabold text-white tracking-tight mb-5"
            style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}
            {...(reduced ? {} : {
              initial: { opacity: 0, y: 20 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, amount: 0.3 },
              transition: { duration: 0.6 },
            })}
          >
            {c.ctaH2}
          </motion.h2>

          <motion.p
            className="text-lg mb-10"
            style={{ color: 'rgba(255,255,255,0.8)' }}
            {...(reduced ? {} : {
              initial: { opacity: 0, y: 20 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, amount: 0.3 },
              transition: { duration: 0.6, delay: 0.1 },
            })}
          >
            {c.ctaSub}
          </motion.p>

          <motion.div
            {...(reduced ? {} : {
              initial: { opacity: 0, y: 20 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, amount: 0.3 },
              transition: { duration: 0.6, delay: 0.2 },
            })}
          >
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-bold transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
              style={{ background: '#fff', color: '#166534' }}
            >
              {c.ctaBtn}
            </Link>

            <p className="mt-5 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {c.ctaNote}
              <a href="#demo" className="underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {c.ctaNoteLink}
              </a>
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
