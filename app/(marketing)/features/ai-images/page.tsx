'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Sparkles, ChevronDown, ChevronRight, CheckCircle, Shield, Zap,
  PackageOpen, Banknote, XCircle, Upload, Wand2, Rocket,
  ImagePlus, ImageIcon, Download, Loader2, ArrowRight,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'

// ─── Content ─────────────────────────────────────────────────────────────────

const en = {
  badge: 'AI Image Generation',
  h1a: 'Professional images',
  h1b: 'for every product in your store',
  subtitle: "Expensive photo shoots and wasted time with photography are a thing of the past. Upload an ordinary photo and get a professional-quality image in seconds, ready to publish directly in your store.",
  cta: 'Try it free',
  ctaAlt: 'How it works',
  socialProof: 'Over 500 stores use Hontrio',
  rating: '4.9 / 5',
  beforeLabel: 'Before',
  afterLabel: 'After',
  floatColor: 'Color preserved',
  floatArtifacts: 'No artifacts',
  floatTime: 'Generated in 8s',
  painH2: 'Sound familiar?',
  painSub: "Most online stores lose sales because of poor images. Not because they don't want to improve them, but because until now there were no accessible alternatives.",
  pain1Title: 'Your photos are hurting your store',
  pain1: 'Shoppers evaluate a product in the first three seconds by looking at the image. A rushed photo can mean dozens of lost sales every day.',
  pain2Title: 'Professional photographers are expensive',
  pain2: 'A photo shoot starts at a few hundred euros and takes days. And when the assortment changes, the whole process starts over from scratch.',
  pain3Title: 'Marketplaces reject your products',
  pain3: 'The major platforms have strict image standards. Without a white background and adequate resolution, your products cannot be listed.',
  painCta: 'Hontrio fixes all of this automatically.',
  howH2: 'Three steps. A few seconds.',
  howSub: 'From raw photo to professional image, without any technical knowledge.',
  step1Title: 'Upload your original photo',
  step1: "Any photo, any angle, any background. The initial quality doesn't matter. All you need is a clear image of the product.",
  step2Title: 'Choose the right style',
  step2: 'Six predefined styles for every sales channel. From marketplace to social media ads, you always have the right option.',
  step2Pills: ['White Background', 'Lifestyle', 'Premium Dark'],
  step3Title: 'Publish directly to your online store',
  step3: 'One click and the optimized image replaces the old photo in your store. No download, no manual upload, no extra steps.',
  demoH2: 'Interactive Demo',
  demoSub: 'See how Hontrio transforms a product photo. No account needed.',
  uploadLabel: 'Click to load the demo photo',
  uploadSub: 'This is a demo. No real upload required.',
  uploadedBadge: 'Photo uploaded',
  styleLabel: 'Choose style',
  styles: ['White Background', 'Lifestyle', 'Premium Dark', 'Industrial', 'Seasonal', 'Auto'],
  generateBtn: 'Generate image',
  processingBtn: 'Processing...',
  resultEmpty: 'Result appears here',
  downloadBtn: 'Download image',
  signupBtn: 'Create account to publish',
  tooltipText: 'Create a free account to download and publish your images.',
  tooltipCta: 'Create account',
  processingSteps: ['Analyzing photo...', 'Applying White Background style...', 'Running automatic verification...', 'Finalizing...'],
  originalLabel: 'Original',
  resultLabel: 'Result',
  generatedBadge: 'Generated successfully',
  colorBadge: 'Color preserved',
  artifactBadge: 'No artifacts',
  qualH2: 'You only receive flawless images',
  qualSub: 'Before an image reaches you, it goes through an internal four-point validation process. If something is not right, the image is automatically regenerated.',
  q1Title: 'Product shape',
  q1: 'The contour and proportions of the product are kept identical to the original photo.',
  q2Title: 'Logo & text',
  q2: 'Any branding element visible in the original photo remains untouched.',
  q3Title: 'Color',
  q3: 'The exact shade of the product is reproduced faithfully, without color deviation.',
  q4Title: 'Visual quality',
  q4: 'The image is automatically inspected for artifacts, blurry areas, or generation errors.',
  qualMockupRows: ['Shape verified', 'Logo intact', 'Color correct', 'No artifacts'],
  qualFooter: 'You only receive perfect results. The verification process is fully automatic.',
  statsH2: 'Concrete results for your store',
  stat1Value: 34,
  stat1Prefix: '+',
  stat1Suffix: '%',
  stat1Label: 'higher click rate on optimized products',
  stat2Value: 80,
  stat2Prefix: '',
  stat2Suffix: '%',
  stat2Label: 'time saved vs a traditional photo shoot',
  stat3Value: 6,
  stat3Prefix: '',
  stat3Suffix: '',
  stat3Label: 'professional styles from a single photo',
  faqH2: 'Frequently asked questions',
  faqs: [
    { q: 'Do you get good results even from low-quality photos?', a: 'The system works best with clear photos of the product. A lower-quality source image will still produce a result superior to the original, but the quality of the initial photo directly influences the final result.' },
    { q: 'Can you generate all six styles from the same photo?', a: 'Yes. From a single uploaded photo you can generate variants in any of the six available styles. Each generation consumes credits separately.' },
    { q: 'Do the generated images meet marketplace technical requirements?', a: 'The White Background style is specially optimized for the requirements of e-commerce platforms in Romania and Europe. The resolution, format and composition meet the technical specifications of major platforms.' },
    { q: 'How many credits does generating an image cost?', a: 'An image costs between 6 and 8 credits depending on the chosen style (White Background = 6 credits, other styles = 7–8 credits). Automatic quality verification is included at no extra cost.' },
  ],
  ctaH2: 'Your first professional image is one click away',
  ctaSub: 'No credit card. No complicated setup. First result in less than 30 seconds.',
  ctaBtn: 'Create your free account',
  ctaDemoText: 'Or test the ',
  ctaDemoLink: 'interactive demo',
  ctaDemoText2: ' above first.',
}

const ro = {
  badge: 'Generare Imagini AI',
  h1a: 'Imagini profesionale',
  h1b: 'pentru fiecare produs din magazinul tau',
  subtitle: 'Sedintele foto scumpe si timpul pierdut cu fotografii sunt lucruri din trecut. Incarca o poza obisnuita si obtii in cateva secunde o imagine de calitate profesionala, gata de publicat direct in magazinul tau.',
  cta: 'Incearca gratuit',
  ctaAlt: 'Cum functioneaza',
  socialProof: 'Peste 500 de magazine folosesc Hontrio',
  rating: '4,9 / 5',
  beforeLabel: 'Inainte',
  afterLabel: 'Dupa',
  floatColor: 'Culoare pastrata',
  floatArtifacts: 'Fara artefacte',
  floatTime: 'Generat in 8s',
  painH2: 'Recunosti situatia?',
  painSub: 'Majoritatea magazinelor online pierd vanzari din cauza imaginilor slabe. Nu pentru ca nu vor sa le imbunatateasca, ci pentru ca pana acum nu au existat alternative accesibile.',
  pain1Title: 'Pozele iti tradeaza magazinul',
  pain1: 'Cumparatorii evalueaza un produs in primele trei secunde uitandu-se la imagine. O fotografie facuta in graba poate insemna zeci de vanzari pierdute zilnic.',
  pain2Title: 'Fotograful profesionist este costisitor',
  pain2: 'O sedinta foto porneste de la cateva sute de euro si dureaza zile intregi. Iar cand sortimentul se schimba, tot procesul se reia de la zero.',
  pain3Title: 'Marketplace-urile iti resping produsele',
  pain3: 'Platformele mari precum eMAG au standarde stricte pentru imagini. Fara fundal alb si rezolutie corespunzatoare, produsele tale nu pot fi listate.',
  painCta: 'Hontrio rezolva toate acestea automat.',
  howH2: 'Trei pasi. Cateva secunde.',
  howSub: 'De la fotografia bruta la imaginea profesionala, fara nicio cunostinta tehnica.',
  step1Title: 'Incarci fotografia originala',
  step1: 'Orice fotografie, orice unghi, orice fundal. Nu conteaza calitatea initiala. Tot ce ai nevoie este o imagine clara a produsului.',
  step2Title: 'Alegi stilul potrivit',
  step2: 'Sase stiluri predefinite pentru fiecare canal de vanzare. De la marketplace la reclame pe social media, ai mereu varianta potrivita.',
  step2Pills: ['Fundal Alb', 'Lifestyle', 'Premium Dark'],
  step3Title: 'Publici direct in magazinul tau online',
  step3: 'Un singur click si imaginea optimizata inlocuieste fotografia veche in magazinul tau. Fara download, fara upload manual, fara pasi in plus.',
  demoH2: 'Demo Interactiv',
  demoSub: 'Vezi cum Hontrio transforma o fotografie de produs. Nu ai nevoie de cont.',
  uploadLabel: 'Apasa pentru a incarca fotografia demo',
  uploadSub: 'Acesta este un demo. Nu incarci nimic real.',
  uploadedBadge: 'Fotografie incarcata',
  styleLabel: 'Alege stilul',
  styles: ['Fundal Alb', 'Lifestyle', 'Premium Dark', 'Industrial', 'Seasonal', 'Auto'],
  generateBtn: 'Genereaza imaginea',
  processingBtn: 'Se proceseaza...',
  resultEmpty: 'Rezultatul apare aici',
  downloadBtn: 'Descarca imaginea',
  signupBtn: 'Creeaza cont pentru a publica',
  tooltipText: 'Creeaza un cont gratuit pentru a descarca si publica imaginile tale.',
  tooltipCta: 'Creeaza cont',
  processingSteps: ['Analizam fotografia...', 'Aplicam stilul Fundal Alb...', 'Verificare automata in curs...', 'Finalizare...'],
  originalLabel: 'Original',
  resultLabel: 'Rezultat',
  generatedBadge: 'Generat cu succes',
  colorBadge: 'Culoare pastrata',
  artifactBadge: 'Fara artefacte',
  qualH2: 'Primesti doar imagini fara defecte',
  qualSub: 'Inainte ca o imagine sa ajunga la tine, trece printr-un proces intern de validare in patru puncte. Daca ceva nu este corect, imaginea este regenerata automat.',
  q1Title: 'Forma produsului',
  q1: 'Conturul si proportiile produsului sunt pastrate identic cu fotografia originala.',
  q2Title: 'Logo si text',
  q2: 'Orice element de branding vizibil in poza originala ramane neatins.',
  q3Title: 'Culoarea',
  q3: 'Nuanta exacta a produsului este reprodusa fidel, fara deviatie de culoare.',
  q4Title: 'Calitate vizuala',
  q4: 'Imaginea este inspectata automat pentru artefacte, zone neclare sau erori de generare.',
  qualMockupRows: ['Forma verificata', 'Logo intact', 'Culoare corecta', 'Fara artefacte'],
  qualFooter: 'Tu primesti doar rezultate perfecte. Procesul de verificare este complet automat.',
  statsH2: 'Rezultate concrete pentru magazinul tau',
  stat1Value: 34,
  stat1Prefix: '+',
  stat1Suffix: '%',
  stat1Label: 'rata de click mai mare pe produse optimizate',
  stat2Value: 80,
  stat2Prefix: '',
  stat2Suffix: '%',
  stat2Label: 'timp economisit fata de o sedinta foto traditionala',
  stat3Value: 6,
  stat3Prefix: '',
  stat3Suffix: '',
  stat3Label: 'stiluri profesionale dintr-o singura fotografie',
  faqH2: 'Intrebari frecvente',
  faqs: [
    { q: 'Obtii rezultate bune si de pe fotografii de calitate slaba?', a: 'Sistemul functioneaza cel mai bine cu fotografii clare ale produsului. O imagine sursa de calitate mai scazuta va produce totusi un rezultat superior originalului, insa calitatea fotografiei initiale influenteaza direct calitatea rezultatului final.' },
    { q: 'Poti genera toate cele sase stiluri din aceeasi fotografie?', a: 'Da. Din o singura fotografie incarcata poti genera variante in oricare dintre cele sase stiluri disponibile. Fiecare generare consuma credite separat.' },
    { q: 'Imaginile generate respecta cerintele tehnice ale marketplace-urilor?', a: 'Stilul Fundal Alb este optimizat special pentru cerintele platformelor de comert electronic din Romania si Europa. Rezolutia, formatul si compozitia respecta specificatiile tehnice ale platformelor principale.' },
    { q: 'Cate credite costa generarea unei imagini?', a: 'O imagine costa intre 6 si 8 credite, in functie de stilul ales (Fundal Alb = 6 credite, celelalte stiluri = 7-8 credite). Verificarea automata a calitatii este inclusa fara costuri suplimentare.' },
  ],
  ctaH2: 'Prima ta imagine profesionala este la un click distanta',
  ctaSub: 'Fara card de credit. Fara configurare complicata. Primul rezultat in mai putin de 30 de secunde.',
  ctaBtn: 'Creeaza-ti contul gratuit',
  ctaDemoText: 'Sau testeaza mai intai ',
  ctaDemoLink: 'demo-ul interactiv',
  ctaDemoText2: ' de mai sus.',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useCountUp(target: number, active: boolean) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    setVal(0)
    let cur = 0
    const steps = 60
    const inc = target / steps
    const t = setInterval(() => {
      cur += inc
      if (cur >= target) { setVal(target); clearInterval(t) }
      else setVal(Math.floor(cur))
    }, 25)
    return () => clearInterval(t)
  }, [target, active])
  return val
}

// ─── Before/After Auto Cycle ─────────────────────────────────────────────────

function BeforeAfterSlider({ beforeLabel, afterLabel }: { beforeLabel: string; afterLabel: string }) {
  const [showAfter, setShowAfter] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setShowAfter(prev => !prev)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl select-none">
      {/* Before image */}
      <img src="/Before.jpg" alt="Before" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      {/* After image - fades in/out */}
      <AnimatePresence>
        {showAfter && (
          <motion.img
            key="after"
            src="/After.jpeg"
            alt="After"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>
      {/* Label */}
      <div className="absolute top-3 left-3 z-10">
        <AnimatePresence mode="wait">
          <motion.span
            key={showAfter ? 'after-label' : 'before-label'}
            className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-lg ${showAfter ? 'bg-neutral-900 text-white' : 'bg-black/60 text-white backdrop-blur-sm'}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.3 }}
          >
            {showAfter ? afterLabel : beforeLabel}
          </motion.span>
        </AnimatePresence>
      </div>
      {/* Pulsing dot indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full transition-all duration-500 ${!showAfter ? 'bg-white scale-125' : 'bg-white/40'}`} />
        <span className={`w-2 h-2 rounded-full transition-all duration-500 ${showAfter ? 'bg-white scale-125' : 'bg-white/40'}`} />
      </div>
    </div>
  )
}

// ─── Interactive Demo ─────────────────────────────────────────────────────────

function DemoSection({ c }: { c: typeof en }) {
  const reduced = useReducedMotion()
  const [state, setState] = useState<'idle' | 'uploaded' | 'processing' | 'done'>('idle')
  const [progress, setProgress] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const [showTooltip, setShowTooltip] = useState(false)

  const startProcessing = () => {
    if (state === 'processing') return
    setState('processing')
    setProgress(0)
    setStepIdx(0)

    // Progress bar over 3.5s
    const startTime = Date.now()
    const duration = 3500
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const p = Math.min((elapsed / duration) * 100, 100)
      setProgress(p)
      if (p >= 100) { clearInterval(interval); setTimeout(() => setState('done'), 200) }
    }, 32)

    // Cycle through processing step texts
    const stepTimings = [0, 900, 1800, 2700]
    stepTimings.forEach((delay, i) => {
      setTimeout(() => setStepIdx(i), delay)
    })
  }

  const handleUpload = () => {
    if (state === 'idle') setState('uploaded')
  }

  const ref = useRef<HTMLElement>(null)

  return (
    <section id="demo" ref={ref} className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-4">{c.demoH2}</h2>
          <p className="text-xl text-neutral-500">{c.demoSub}</p>
        </motion.div>

        <motion.div
          className="bg-white rounded-3xl shadow-[0_2px_40px_rgba(0,0,0,0.08)] border border-neutral-100 p-6 sm:p-10"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Upload zone */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">{c.originalLabel}</p>
              <div
                onClick={handleUpload}
                className={`relative w-full aspect-square rounded-2xl border-2 overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                  state === 'idle'
                    ? 'border-dashed border-neutral-200 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100'
                    : 'border-solid border-emerald-300 bg-emerald-50/30'
                }`}
              >
                {state === 'idle' ? (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                      <ImagePlus className="h-10 w-10 text-neutral-300" />
                    </motion.div>
                    <p className="text-sm font-medium text-neutral-600">{c.uploadLabel}</p>
                    <p className="text-xs text-neutral-400">{c.uploadSub}</p>
                  </div>
                ) : (
                  <>
                    <img src="/Before.jpg" alt="Before" className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-lg">
                      <CheckCircle className="h-3 w-3" />
                      {c.uploadedBadge}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Result zone */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">{c.resultLabel}</p>
              <div className="relative w-full aspect-square rounded-2xl border-2 border-dashed border-neutral-200 overflow-hidden flex flex-col items-center justify-center bg-neutral-50">
                {state !== 'processing' && state !== 'done' && (
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="h-10 w-10 text-neutral-200" />
                    <p className="text-sm text-neutral-300">{c.resultEmpty}</p>
                  </div>
                )}
                {state === 'processing' && (
                  <>
                    {/* Skeleton shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-neutral-100 via-neutral-50 to-neutral-100 animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: '200% 100%' }} />
                    {/* Processing text */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={stepIdx}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="text-sm font-medium text-neutral-500 px-4 text-center"
                        >
                          {c.processingSteps[stepIdx]}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                    {/* Progress bar */}
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-neutral-100">
                      <div
                        className="h-full bg-neutral-900 rounded-full transition-all duration-100"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </>
                )}
                {state === 'done' && (
                  <>
                    <motion.img
                      src="/After.jpeg"
                      alt="After"
                      className="w-full h-full object-cover"
                      initial={reduced ? false : { clipPath: 'inset(0 100% 0 0)' }}
                      animate={{ clipPath: 'inset(0 0% 0 0)' }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                    <motion.div
                      className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-lg"
                      initial={reduced ? false : { opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.7 }}
                    >
                      <CheckCircle className="h-3 w-3" />
                      {c.generatedBadge}
                    </motion.div>
                    <motion.div
                      className="absolute bottom-3 left-3 right-3 flex gap-2 justify-center"
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.9 }}
                    >
                      <span className="px-2 py-1 bg-white/90 backdrop-blur-sm text-xs font-medium text-neutral-700 rounded-lg border border-neutral-200">{c.colorBadge}</span>
                      <span className="px-2 py-1 bg-white/90 backdrop-blur-sm text-xs font-medium text-neutral-700 rounded-lg border border-neutral-200">{c.artifactBadge}</span>
                    </motion.div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={() => {
              if (state === 'idle') { setState('uploaded'); setTimeout(startProcessing, 300) }
              else if (state === 'uploaded') startProcessing()
              else if (state === 'done') startProcessing()
            }}
            disabled={state === 'processing'}
            className="w-full py-4 rounded-2xl bg-neutral-900 text-white font-semibold text-base flex items-center justify-center gap-2 hover:bg-neutral-800 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 transition-all duration-200 mb-4"
          >
            {state === 'processing' ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{c.processingBtn}</>
            ) : (
              <><Sparkles className="h-4 w-4" />{c.generateBtn}</>
            )}
          </button>

          {/* Action buttons - visible after done */}
          <AnimatePresence>
            {state === 'done' && (
              <motion.div
                className="flex flex-col sm:flex-row gap-3"
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {/* Download with tooltip */}
                <div className="relative flex-1">
                  <button
                    onClick={() => setShowTooltip(!showTooltip)}
                    className="w-full py-3 rounded-xl border border-neutral-200 text-neutral-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-neutral-50 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    {c.downloadBtn}
                  </button>
                  <AnimatePresence>
                    {showTooltip && (
                      <motion.div
                        className="absolute bottom-full mb-2 left-0 right-0 bg-neutral-900 text-white text-xs rounded-xl p-3 shadow-xl z-20"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                      >
                        <p className="mb-2">{c.tooltipText}</p>
                        <Link href="/register" className="inline-block px-3 py-1.5 bg-white text-neutral-900 rounded-lg text-xs font-semibold">
                          {c.tooltipCta}
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Link
                  href="/register"
                  className="flex-1 py-3 rounded-xl bg-neutral-900 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors"
                >
                  {c.signupBtn}
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Quality Check Mockup ────────────────────────────────────────────────────

function QualityMockup({ rows, active }: { rows: string[]; active: boolean }) {
  const [doneRows, setDoneRows] = useState<number[]>([])

  useEffect(() => {
    if (!active) return
    setDoneRows([])
    rows.forEach((_, i) => {
      setTimeout(() => setDoneRows(prev => [...prev, i]), 600 + i * 400)
    })
  }, [active, rows])

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-md p-6 space-y-3">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center">
          <ImageIcon className="h-4 w-4 text-neutral-500" />
        </div>
        <div className="h-3 bg-neutral-100 rounded-full flex-1" />
      </div>
      {rows.map((row, i) => (
        <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-400 ${
          doneRows.includes(i) ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-100 bg-neutral-50'
        }`}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
            doneRows.includes(i) ? 'bg-emerald-500 scale-110' : 'bg-neutral-200'
          }`}>
            {doneRows.includes(i)
              ? <CheckCircle className="h-3.5 w-3.5 text-white" />
              : <Loader2 className="h-3 w-3 text-neutral-400 animate-spin" />
            }
          </div>
          <span className={`text-sm font-medium transition-colors duration-300 ${
            doneRows.includes(i) ? 'text-emerald-700' : 'text-neutral-400'
          }`}>{row}</span>
        </div>
      ))}
    </div>
  )
}

// ─── FAQ Item — kept for backward compat (unused after inline below) ──────────

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIImagesPage() {
  const { locale } = useT()
  const c = locale === 'ro' ? ro : en
  const reduced = useReducedMotion()

  const [openFaq, setOpenFaq] = useState<number | null>(null)

  // Refs for whileInView sections
  const statsRef = useRef<HTMLDivElement>(null)
  const qualRef = useRef<HTMLDivElement>(null)
  const [statsActive, setStatsActive] = useState(false)
  const [qualActive, setQualActive] = useState(false)

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const observe = (el: Element | null, cb: () => void) => {
      if (!el) return
      const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { cb(); obs.disconnect() } }, { threshold: 0.2 })
      obs.observe(el)
      observers.push(obs)
    }
    observe(statsRef.current, () => setStatsActive(true))
    observe(qualRef.current, () => setQualActive(true))
    return () => observers.forEach(o => o.disconnect())
  }, [])

  const stat1 = useCountUp(c.stat1Value, statsActive)
  const stat2 = useCountUp(c.stat2Value, statsActive)
  const stat3 = useCountUp(c.stat3Value, statsActive)

  const fadeUp = (delay = 0) => reduced ? {} : {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 as number },
    transition: { duration: 0.6, ease: 'easeOut' as const, delay },
  }

  return (
    <div>
      {/* ═══ HERO ═══ */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.5,
        }} />
        {/* Radial gradient accent top-right */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(24,119,242,0.08) 0%, transparent 70%)',
        }} />

        <div className="relative max-w-4xl mx-auto text-center">
              <motion.div {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } })}>
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border mb-6 text-sm font-medium"
                  style={{ background: 'rgba(24,119,242,0.08)', borderColor: 'rgba(24,119,242,0.2)', color: '#1877F2' }}>
                  <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Sparkles className="h-3.5 w-3.5" />
                  </motion.div>
                  {c.badge}
                </div>
              </motion.div>

              <motion.div {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.1 } })}>
                <h1 className="font-extrabold text-neutral-900 leading-[1.05] tracking-tight mb-6"
                  style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}>
                  <span style={{ background: 'linear-gradient(135deg, #0d5fd9 0%, #1877F2 50%, #4299F7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{c.h1a}</span>
                  <br />
                  {c.h1b}
                </h1>
              </motion.div>

              <motion.div {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.2 } })}>
                <p className="text-[18px] text-neutral-500 leading-[1.7] mb-8 max-w-2xl mx-auto">{c.subtitle}</p>
              </motion.div>

              <motion.div {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.3 } })}>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl text-[15px] font-semibold text-white bg-neutral-900 hover:bg-neutral-800 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                  >
                    {c.cta}
                  </Link>
                  <a
                    href="#demo"
                    className="inline-flex items-center justify-center gap-1.5 px-6 py-3.5 rounded-xl text-[15px] font-semibold text-neutral-600 border border-neutral-200 bg-white/60 hover:bg-white hover:border-neutral-300 transition-colors"
                  >
                    {c.ctaAlt}
                    <motion.span animate={{ y: [0, 2, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <ChevronDown className="h-4 w-4" />
                    </motion.span>
                  </a>
                </div>
              </motion.div>
        </div>
      </section>

      {/* ═══ PAIN POINTS ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-14" {...fadeUp()}>
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">{c.painH2}</h2>
            <p className="text-xl text-neutral-500 max-w-2xl mx-auto">{c.painSub}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              { icon: PackageOpen, title: c.pain1Title, text: c.pain1 },
              { icon: Banknote,    title: c.pain2Title, text: c.pain2 },
              { icon: XCircle,     title: c.pain3Title, text: c.pain3 },
            ].map((card, i) => (
              <motion.div
                key={i}
                className="bg-white rounded-2xl border border-neutral-200 p-7 hover:border-[#1877F2]/30 hover:shadow-md hover:-translate-y-1 transition-all duration-250"
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

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeUp()}>
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">{c.howH2}</h2>
            <p className="text-xl text-neutral-500">{c.howSub}</p>
          </motion.div>

          <div className="flex flex-col md:flex-row items-stretch gap-0">
            {[
              { num: '01', Icon: Upload,  title: c.step1Title, text: c.step1, extra: null },
              { num: '02', Icon: Wand2,   title: c.step2Title, text: c.step2, extra: c.step2Pills },
              { num: '03', Icon: Rocket,  title: c.step3Title, text: c.step3, extra: null },
            ].map((step, i) => (
              <div key={i} className="flex flex-col md:flex-row items-center flex-1 min-w-0">
                {/* Step card */}
                <motion.div
                  className="relative z-10 flex flex-col items-center text-center px-6 py-2 flex-1 w-full"
                  {...(reduced ? {} : {
                    initial: { opacity: 0, y: 24 },
                    whileInView: { opacity: 1, y: 0 },
                    viewport: { once: true, amount: 0.2 },
                    transition: { duration: 0.5, delay: i * 0.18 },
                  })}
                >
                  <div className="relative mb-5">
                    <span className="absolute -top-2 -right-2 text-4xl font-black text-neutral-100 select-none z-0" style={{ fontSize: 48, lineHeight: 1 }}>{step.num}</span>
                    <div className="relative z-10 w-14 h-14 rounded-2xl bg-neutral-900 flex items-center justify-center shadow-md">
                      <step.Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900 mb-3">{step.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed mb-4">{step.text}</p>
                  {step.extra && (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {(step.extra as string[]).map((pill) => (
                        <span key={pill} className="px-3 py-1 bg-neutral-100 text-neutral-600 text-xs font-medium rounded-full">{pill}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
                {/* Arrow between steps */}
                {i < 2 && (
                  <div className="flex items-center justify-center shrink-0 text-neutral-400 my-2 md:my-0 md:-mt-20">
                    <ArrowRight className="h-6 w-6 rotate-90 md:rotate-0" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DEMO ═══ */}
      <DemoSection c={c} />

      {/* ═══ QUALITY CHECK ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div ref={qualRef} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left */}
            <motion.div {...fadeUp()}>
              <span className="inline-block text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#1877F2' }}>Quality Control</span>
              <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-5">{c.qualH2}</h2>
              <p className="text-lg text-neutral-500 leading-relaxed mb-8">{c.qualSub}</p>
              <ul className="space-y-5">
                {[
                  { title: c.q1Title, text: c.q1 },
                  { title: c.q2Title, text: c.q2 },
                  { title: c.q3Title, text: c.q3 },
                  { title: c.q4Title, text: c.q4 },
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    className="flex items-start gap-3"
                    {...(reduced ? {} : {
                      initial: { opacity: 0, x: -16 },
                      whileInView: { opacity: 1, x: 0 },
                      viewport: { once: true, amount: 0.5 },
                      transition: { duration: 0.4, delay: i * 0.1 },
                    })}
                  >
                    <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#1877F2' }} />
                    <div>
                      <span className="text-sm font-semibold text-neutral-900">{item.title}</span>
                      <span className="text-sm text-neutral-500"> - {item.text}</span>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Right */}
            <motion.div {...fadeUp(0.2)}>
              <QualityMockup rows={c.qualMockupRows} active={qualActive} />
            </motion.div>
          </div>

          <motion.p
            className="text-center text-xl font-semibold text-neutral-900 mt-16"
            {...fadeUp()}
          >
            {c.qualFooter}
          </motion.p>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight text-center mb-16"
            {...fadeUp()}
          >
            {c.statsH2}
          </motion.h2>

          <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
            {[
              { value: stat1, prefix: c.stat1Prefix, suffix: c.stat1Suffix, label: c.stat1Label },
              { value: stat2, prefix: c.stat2Prefix, suffix: c.stat2Suffix, label: c.stat2Label },
              { value: stat3, prefix: c.stat3Prefix, suffix: c.stat3Suffix, label: c.stat3Label },
            ].map((s, i) => (
              <motion.div
                key={i}
                {...(reduced ? {} : {
                  initial: { opacity: 0, y: 24 },
                  whileInView: { opacity: 1, y: 0 },
                  viewport: { once: true, amount: 0.3 },
                  transition: { duration: 0.5, delay: i * 0.15 },
                })}
              >
                <p className="font-extrabold text-neutral-900 tabular-nums mb-3" style={{ fontSize: 'clamp(48px, 6vw, 64px)', lineHeight: 1 }}>
                  <span style={{ background: 'linear-gradient(135deg, #0d5fd9 0%, #1877F2 50%, #4299F7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{s.prefix}{s.value}{s.suffix}</span>
                </p>
                <p className="text-base text-neutral-500 max-w-[180px] mx-auto leading-relaxed">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="bg-neutral-50 px-4 py-20">
        <div className="max-w-[700px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-neutral-900">{c.faqH2}</h2>
          </div>
          <div className="flex flex-col gap-2">
            {c.faqs.map((faq, i) => (
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

      {/* ═══ CTA FINAL ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #0a4bb5 0%, #1877F2 50%, #4299F7 100%)',
      }}>
        {/* Animated hue shift */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ filter: ['hue-rotate(-10deg)', 'hue-rotate(10deg)', 'hue-rotate(-10deg)'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: 'inherit', mixBlendMode: 'overlay', opacity: 0.4 }}
        />

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.h2
            className="font-extrabold text-white tracking-tight mb-5"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
            {...(reduced ? {} : {
              initial: { opacity: 0, y: 24 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, amount: 0.3 },
              transition: { duration: 0.6 },
            })}
          >
            {c.ctaH2}
          </motion.h2>

          <motion.p
            className="text-xl text-white/80 mb-10 leading-relaxed"
            {...(reduced ? {} : {
              initial: { opacity: 0, y: 20 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, amount: 0.3 },
              transition: { duration: 0.6, delay: 0.15 },
            })}
          >
            {c.ctaSub}
          </motion.p>

          <motion.div
            {...(reduced ? {} : {
              initial: { opacity: 0, scale: 0.9 },
              whileInView: { opacity: 1, scale: 1 },
              viewport: { once: true, amount: 0.3 },
              transition: { duration: 0.5, delay: 0.3 },
            })}
          >
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white font-semibold text-base hover:scale-[1.03] hover:shadow-[0_8px_32px_rgba(255,255,255,0.25)] transition-all duration-200"
              style={{ color: '#0a4bb5' }}
            >
              {c.ctaBtn}
            </Link>
          </motion.div>

          <motion.p
            className="mt-5 text-sm text-white/55"
            {...(reduced ? {} : {
              initial: { opacity: 0 },
              whileInView: { opacity: 1 },
              viewport: { once: true, amount: 0.3 },
              transition: { delay: 0.5 },
            })}
          >
            {c.ctaDemoText}
            <a href="#demo" className="underline underline-offset-2 text-white/80 hover:text-white transition-colors">
              {c.ctaDemoLink}
            </a>
            {c.ctaDemoText2}
          </motion.p>
        </div>
      </section>
    </div>
  )
}
