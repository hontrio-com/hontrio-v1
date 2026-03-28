'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ShieldCheck, ArrowDown, AlertTriangle, Zap, Globe, BrainCircuit,
  Truck, PackageX, TrendingDown, TrendingUp,
  ShoppingCart, ScanLine, BellRing, History, ShoppingBag, User,
  Eye, Ban, ChevronDown, CheckCircle, Target, RefreshCw,
  Fingerprint, BarChart2, Map, Settings, UserPlus, ArrowRight,
  Store, UserX,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'

// ─── Content ─────────────────────────────────────────────────────────────────

const en = {
  badge: 'Risk Shield',
  h1a: 'Know',
  h1b: 'in advance',
  h1c: 'which orders won\'t be picked up',
  subtitle: 'Every cash-on-delivery order comes with a risk. Risk Shield automatically analyzes each customer\'s behavior and tells you exactly what to do before you ship.',
  cta: 'Protect your store',
  ctaAlt: 'See how it works',
  heroCustomerName: 'Mihai Ionescu',
  heroCustomerEmail: 'm.ionescu94@mailinator.com',
  heroCustomerBadge: 'PROBLEMATIC',
  heroRiskScore: 'Risk Score',
  heroScoreLeft: 'Safe',
  heroScoreCenter: 'Watch',
  heroScoreRight: 'Blocked',
  heroSignalsTitle: 'Detected signals',
  heroSignal1: 'Temporary email detected',
  heroSignal2: '3 parcels refused previously',
  heroSignal3: 'Pickup rate: 28%',
  heroSignal4: 'COD order 890 RON',
  heroRec: 'Put order on hold. Call the customer before shipping.',
  heroBadge1: 'Real-time analysis',
  heroBadge2: 'Shared blacklist',
  heroBadge3: 'Auto-calibrated ML',
  painH2: 'What an undelivered parcel really costs you',
  painSub: 'Every returned COD parcel costs far more than just the product value. It accumulates into a real monthly loss.',
  pain1Title: 'Logistics costs on return',
  pain1: 'Each refused parcel generates round-trip shipping costs, handling fees at the warehouse and time lost by your team. A single refused parcel can cost 35-80 RON just in transport.',
  pain2Title: 'Tied-up capital in stock',
  pain2: 'Products in transit for refused orders are unavailable for other customers. In busy periods, this means lost sales and unhappy customers who cannot place orders.',
  pain3Title: 'Delivery rate impacts discounts',
  pain3: 'A low pickup rate with courier companies can mean you lose preferential rates or get placed in higher-risk categories. Every refused parcel hurts your commercial relationship.',
  calcTitle: 'Minimum cost per undelivered parcel',
  calcSub: 'Money that comes directly out of your pocket:',
  calcRow1: 'Outbound shipping',
  calcRow1Val: '15 RON',
  calcRow2: 'Return shipping',
  calcRow2Val: '12 RON',
  calcRow3: 'Handling + repackaging',
  calcRow3Val: '5 RON',
  calcRow4: 'Blocked capital cost',
  calcRow4Val: '3+ RON',
  calcTotal: 'Minimum 35 RON per parcel',
  calcNote: 'This does not include the time your team spends managing refused orders.',
  howH2: 'From new order to decision in seconds',
  howSub: 'The process runs fully automatically. You only intervene when the system flags a risk.',
  step1Title: 'New order arrives',
  step1: 'A customer places a COD order in your store. Risk Shield is triggered automatically — no manual action needed.',
  step2Title: 'Automatic analysis',
  step2: 'The system analyzes 20+ signals: order history, email type, pickup rate, phone number, blacklist presence and order value.',
  step3Title: 'Risk score calculated',
  step3: 'Each order receives a score between 0 and 100 and a label: Trusted, New, Watch, Problematic or Blocked.',
  step4Title: 'Smart notification',
  step4: 'For high-risk orders you receive an instant alert in the dashboard and by email. You decide: hold, call customer, or proceed.',
  scoreH2: '20+ signals. One score. One clear decision.',
  scoreSub: 'Risk Shield synthesizes dozens of behavioral and contextual signals into a single actionable score.',
  scoreTag: 'Scoring System',
  sigCat1Title: 'Order history',
  sigCat1Items: ['Pickup rate', 'Number of refused parcels', 'Days since last refusal', 'Number of orders in last 30 days'],
  sigCat2Title: 'Current order',
  sigCat2Items: ['Order value', 'Number of products', 'COD vs prepayment ratio', 'Category risk'],
  sigCat3Title: 'Customer identity',
  sigCat3Items: ['Email type (temporary/real)', 'Phone number validation', 'Account age', 'Profile completeness'],
  sigCat4Title: 'Global network',
  sigCat4Items: ['Presence in shared blacklist', 'Reports from other stores', 'Region risk index', 'Delivery zone history'],
  label0Title: 'Trusted',
  label0Sub: 'Score 0-40',
  label0Desc: 'Loyal customer. Process normally.',
  label1Title: 'New',
  label1Sub: 'First order',
  label1Desc: 'No history. Monitor first delivery.',
  label2Title: 'Watch',
  label2Sub: 'Score 41-60',
  label2Desc: 'Some signals. Verify before shipping.',
  label3Title: 'Problematic',
  label3Sub: 'Score 61-80',
  label3Desc: 'Call customer before shipping.',
  label4Title: 'Blocked',
  label4Sub: 'Score 81-100',
  label4Desc: 'Request prepayment or cancel.',
  demoH2: 'Test the risk analysis',
  demoSub: 'Select a customer profile and see how Risk Shield analyzes it in real time.',
  demoProfile1: 'New customer',
  demoProfile2: 'Regular customer',
  demoProfile3: 'Problematic customer',
  demoProfile4: 'Blocked customer',
  demoScoreLabel: 'Risk Score',
  demoFlagsTitle: 'Detected signals',
  demoNoFlags: 'No risk signals',
  demoRecLabel: 'Recommendation',
  demoNote: 'This is an interactive demo with example data. The real system analyzes your actual customers.',
  blacklistH2: 'A shared intelligence network',
  blacklistSub: 'Risk Shield does not work alone. Every store contributes anonymized data to a shared blacklist that protects all members.',
  blacklistTag: 'Global Blacklist',
  blacklist1: 'Customer blocked in one store is flagged across the entire network',
  blacklist2: 'Fully anonymous data sharing — no personal info exposed',
  blacklist3: 'Real-time updates as new refusals are reported',
  blacklist4: 'Opt-in participation — you control your contribution level',
  identH2: 'Same person, different account',
  identSub: 'Customers who change email or phone to bypass blocks are automatically detected through behavioral and identity fingerprinting.',
  identTag: 'Identity Resolution',
  ident1: 'Cross-reference email, phone and delivery address combinations',
  ident2: 'Device fingerprinting detects repeat visitors',
  ident3: 'Behavioral patterns matched across sessions',
  identCardTitle: 'Detected candidates',
  identCard1Name: 'Mihai I.',
  identCard1Email: 'm.ionescu94@mailinator.com',
  identCard1Sim: '87% similarity',
  identCard2Name: 'M. Ionescu',
  identCard2Email: 'mionescu_new@tempmail.io',
  identCard2Sim: '79% similarity',
  identVerify: 'Review',
  finH2: 'See your losses and savings in one place',
  finSub: 'The financial dashboard shows exactly how much Risk Shield is saving you every month.',
  finTag: 'Financial Impact',
  fin1: 'Monthly savings automatically calculated from blocked orders',
  fin2: 'Comparison with previous month trend',
  fin3: 'Export reports for accounting',
  finMetric1: '1,240 RON',
  finMetric1Label: 'Prevented losses',
  finMetric2: '890 RON',
  finMetric2Label: 'Confirmed savings',
  finMetric3: '34',
  finMetric3Label: 'High-risk orders',
  finMetric4: '87%',
  finMetric4Label: 'Pickup rate',
  finBar1: 'This month',
  finBar2: 'Last month',
  heatH2: 'Know where most refusals come from',
  heatSub: 'The geographic heatmap identifies high-risk regions so you can apply different policies per area.',
  heatTag: 'Geographic Heatmap',
  heat1: 'Visual map of pickup rates by county',
  heat2: 'Automatic rules per region (Watch / Block by zone)',
  cfgH2: 'You set the rules. Risk Shield enforces them.',
  cfgSub: 'Every threshold is configurable. You decide when a customer becomes Watch, Problematic or Blocked.',
  cfgTag: 'Configurable',
  cfg1: 'Custom score thresholds per risk label',
  cfg2: 'Configure alerts by email, WhatsApp or dashboard',
  cfg3: 'Choose auto-hold vs notification-only mode',
  cfg4: 'Opt into or out of the global blacklist network',
  cfgSlider1: 'Watch threshold',
  cfgSlider2: 'Problematic threshold',
  cfgSlider3: 'Blocked threshold',
  cfgToggle1: 'Participate in global blacklist',
  cfgToggle2: 'Alerts for Problematic orders',
  cfgToggle3: 'Night orders (00-06)',
  cfgSave: 'Save configuration',
  mlH2: 'It learns from your mistakes and successes',
  mlSub: 'The model automatically calibrates to your store\'s specific customer base. The more orders it analyzes, the more accurate it becomes.',
  mlTag: 'Machine Learning',
  mlCard1Title: 'Accuracy improves',
  mlCard1: 'Each confirmed refusal and each successful delivery trains the model for your specific context.',
  mlCard2Title: 'Auto-recalibration',
  mlCard2: 'Seasonal patterns, new customer segments and behavioral shifts are automatically detected and integrated.',
  mlCard3Title: 'Continuous trend tracking',
  mlCard3: 'The system adapts as your store grows, ensuring the scoring remains relevant at any scale.',
  mlBold: 'The more you use it, the smarter it gets.',
  statsH2: 'What changes after you activate Risk Shield',
  stat1Value: 67,
  stat1Suffix: '%',
  stat1Label: 'reduction in undelivered parcel rate',
  stat2Value: 35,
  stat2Suffix: ' RON',
  stat2Label: 'saved per blocked order',
  stat3Value: 20,
  stat3Suffix: '+',
  stat3Label: 'signals analyzed automatically',
  faqH2: 'Frequently asked questions',
  faqs: [
    { q: 'Does Risk Shield work with all couriers?', a: 'Yes. Risk Shield analyzes order data independently of which courier you use. It integrates with WooCommerce and reads order and customer data directly, regardless of the shipping provider.' },
    { q: 'Does a blocked customer know they were blocked?', a: 'No. Risk Shield operates silently in the background. A blocked customer simply sees that the order cannot be processed with cash on delivery and may be offered a prepayment option instead.' },
    { q: 'What happens if Risk Shield blocks a good customer by mistake?', a: 'You always have full control. You can review any flagged order and override the decision manually. The system also learns from your corrections to improve future accuracy.' },
    { q: 'Is customer data shared with other stores?', a: 'Only anonymized behavioral signals contribute to the shared blacklist. No personal data (name, email, address) is ever shared. Each store only sees its own customer details.' },
    { q: 'How long until Risk Shield starts making accurate predictions?', a: 'The model starts working from the first order. Accuracy improves significantly after 50-100 analyzed orders, as the system calibrates to your specific customer patterns.' },
  ],
  ctaH2: 'Stop losses before they start.',
  ctaSub: 'Every order is analyzed automatically. You step in only when it matters.',
  ctaBtn: 'Activate Risk Shield free',
  ctaNote: 'No credit card required. Setup takes under 5 minutes.',
}

const ro = {
  badge: 'Risk Shield',
  h1a: 'Stii',
  h1b: 'dinainte',
  h1c: 'care comenzi nu vor fi ridicate',
  subtitle: 'Fiecare comanda cu plata la livrare vine cu un risc. Risk Shield analizeaza automat comportamentul fiecarui client si iti spune exact ce sa faci inainte sa expediezi.',
  cta: 'Protejeaza-ti magazinul',
  ctaAlt: 'Vezi cum functioneaza',
  heroCustomerName: 'Mihai Ionescu',
  heroCustomerEmail: 'm.ionescu94@mailinator.com',
  heroCustomerBadge: 'PROBLEMATIC',
  heroRiskScore: 'Scor de risc',
  heroScoreLeft: 'Sigur',
  heroScoreCenter: 'Atentie',
  heroScoreRight: 'Blocat',
  heroSignalsTitle: 'Semnale detectate',
  heroSignal1: 'Email temporar detectat',
  heroSignal2: '3 colete refuzate anterior',
  heroSignal3: 'Rata ridicare: 28%',
  heroSignal4: 'Comanda COD 890 RON',
  heroRec: 'Pune comanda in hold. Suna clientul inainte de expediere.',
  heroBadge1: 'Analiza in timp real',
  heroBadge2: 'Blacklist partajat',
  heroBadge3: 'ML auto-calibrat',
  painH2: 'Cat te costa cu adevarat un colet neridcat',
  painSub: 'Fiecare colet refuzat COD costa mult mai mult decat valoarea produsului. Se acumuleaza intr-o pierdere reala lunara.',
  pain1Title: 'Costuri logistice la retur',
  pain1: 'Fiecare colet refuzat genereaza costuri de expediere dus-intors, taxe de manipulare la depozit si timp pierdut de echipa ta. Un singur colet refuzat poate costa 35-80 RON doar in transport.',
  pain2Title: 'Capital blocat in stoc',
  pain2: 'Produsele in tranzit pentru comenzi refuzate nu sunt disponibile pentru alti clienti. In perioadele aglomerate, asta inseamna vanzari pierdute si clienti nemultumiti care nu pot plasa comenzi.',
  pain3Title: 'Rata ridicare afecteaza rabaturile',
  pain3: 'O rata scazuta de ridicare cu firmele de curierat poate insemna ca pierzi tarifele preferentiale sau esti plasat in categorii de risc mai ridicate. Fiecare colet refuzat iti afecteaza relatia comerciala.',
  calcTitle: 'Cost minim per colet nelivrat',
  calcSub: 'Bani pe care ii platesti tu din buzunar:',
  calcRow1: 'Transport dus',
  calcRow1Val: '15 RON',
  calcRow2: 'Transport intors',
  calcRow2Val: '12 RON',
  calcRow3: 'Manipulare + reambalare',
  calcRow3Val: '5 RON',
  calcRow4: 'Cost capital blocat',
  calcRow4Val: '3+ RON',
  calcTotal: 'Minim 35 RON per colet',
  calcNote: 'Nu include timpul echipei tale cheltuit cu gestionarea comenzilor refuzate.',
  howH2: 'De la comanda noua la decizie in secunde',
  howSub: 'Procesul ruleaza complet automat. Tu intervii doar cand sistemul semnaleaza un risc.',
  step1Title: 'Comanda noua soseste',
  step1: 'Un client plaseaza o comanda cu plata la livrare in magazinul tau. Risk Shield se activeaza automat - nicio actiune manuala necesara.',
  step2Title: 'Analiza automata',
  step2: 'Sistemul analizeaza 20+ semnale: istoricul comenzilor, tipul emailului, rata de ridicare, numarul de telefon, prezenta in blacklist si valoarea comenzii.',
  step3Title: 'Scor de risc calculat',
  step3: 'Fiecare comanda primeste un scor intre 0 si 100 si o eticheta: Trusted, Nou, Atentie, Problematic sau Blocat.',
  step4Title: 'Notificare inteligenta',
  step4: 'Pentru comenzile cu risc ridicat primesti o alerta instant in dashboard si pe email. Tu decizi: hold, suna clientul sau proceseaza.',
  scoreH2: '20+ semnale. Un scor. O decizie clara.',
  scoreSub: 'Risk Shield sintetizeaza zeci de semnale comportamentale si contextuale intr-un singur scor actionabil.',
  scoreTag: 'Sistem de Scoring',
  sigCat1Title: 'Istoricul comenzilor',
  sigCat1Items: ['Rata de ridicare', 'Numar colete refuzate', 'Zile de la ultimul refuz', 'Comenzi in ultimele 30 de zile'],
  sigCat2Title: 'Comanda curenta',
  sigCat2Items: ['Valoarea comenzii', 'Numar de produse', 'Raport COD vs plata in avans', 'Risc categorie'],
  sigCat3Title: 'Identitatea clientului',
  sigCat3Items: ['Tip email (temporar/real)', 'Validare numar de telefon', 'Varsta contului', 'Completitudine profil'],
  sigCat4Title: 'Retea globala',
  sigCat4Items: ['Prezenta in blacklist partajat', 'Raportari din alte magazine', 'Indice risc regiune', 'Istoricul zonei de livrare'],
  label0Title: 'Trusted',
  label0Sub: 'Scor 0-40',
  label0Desc: 'Client loial. Proceseaza normal.',
  label1Title: 'Nou',
  label1Sub: 'Prima comanda',
  label1Desc: 'Fara istoric. Monitorizeaza prima livrare.',
  label2Title: 'Atentie',
  label2Sub: 'Scor 41-60',
  label2Desc: 'Cateva semnale. Verifica inainte de expediere.',
  label3Title: 'Problematic',
  label3Sub: 'Scor 61-80',
  label3Desc: 'Suna clientul inainte de expediere.',
  label4Title: 'Blocat',
  label4Sub: 'Scor 81-100',
  label4Desc: 'Solicita plata in avans sau anuleaza.',
  demoH2: 'Testeaza analiza de risc',
  demoSub: 'Selecteaza un profil de client si vezi cum il analizeaza Risk Shield in timp real.',
  demoProfile1: 'Client nou',
  demoProfile2: 'Client obisnuit',
  demoProfile3: 'Client problematic',
  demoProfile4: 'Client blocat',
  demoScoreLabel: 'Scor de risc',
  demoFlagsTitle: 'Semnale detectate',
  demoNoFlags: 'Niciun semnal de risc',
  demoRecLabel: 'Recomandare',
  demoNote: 'Aceasta este o demonstratie interactiva cu date de exemplu. Sistemul real analizeaza clientii tai reali.',
  blacklistH2: 'O retea de inteligenta partajata',
  blacklistSub: 'Risk Shield nu lucreaza singur. Fiecare magazin contribuie cu date anonimizate la un blacklist partajat care protejeaza toti membrii.',
  blacklistTag: 'Blacklist Global',
  blacklist1: 'Client blocat intr-un magazin este semnalat in toata reteaua',
  blacklist2: 'Partajare complet anonima - niciun dato personal expus',
  blacklist3: 'Actualizari in timp real pe masura ce sunt raportate refuzuri noi',
  blacklist4: 'Participare optionala - tu controlezi nivelul de contributie',
  identH2: 'Aceeasi persoana, alt cont',
  identSub: 'Clientii care isi schimba emailul sau telefonul pentru a evita blocajele sunt detectati automat prin amprentare comportamentala si de identitate.',
  identTag: 'Identity Resolution',
  ident1: 'Corelare combinatii email, telefon si adresa de livrare',
  ident2: 'Amprenta dispozitivului detecteaza vizitatorii repetiti',
  ident3: 'Tipare comportamentale potrivite intre sesiuni',
  identCardTitle: 'Candidati detectati',
  identCard1Name: 'Mihai I.',
  identCard1Email: 'm.ionescu94@mailinator.com',
  identCard1Sim: '87% similaritate',
  identCard2Name: 'M. Ionescu',
  identCard2Email: 'mionescu_new@tempmail.io',
  identCard2Sim: '79% similaritate',
  identVerify: 'Verifica',
  finH2: 'Vezi pierderile si economiile intr-un singur loc',
  finSub: 'Dashboard-ul financiar arata exact cat economiseste Risk Shield in fiecare luna.',
  finTag: 'Impact Financiar',
  fin1: 'Economii lunare calculate automat din comenzile blocate',
  fin2: 'Comparatie cu trendul lunii trecute',
  fin3: 'Export rapoarte pentru contabilitate',
  finMetric1: '1.240 RON',
  finMetric1Label: 'Pierderi prevenite',
  finMetric2: '890 RON',
  finMetric2Label: 'Economii confirmate',
  finMetric3: '34',
  finMetric3Label: 'Comenzi cu risc',
  finMetric4: '87%',
  finMetric4Label: 'Rata ridicare',
  finBar1: 'Luna aceasta',
  finBar2: 'Luna trecuta',
  heatH2: 'Stii de unde vin cele mai multe refuzuri',
  heatSub: 'Heatmap-ul geografic identifica regiunile cu risc crescut pentru a aplica politici diferite pe zona.',
  heatTag: 'Heatmap Geografic',
  heat1: 'Harta vizuala a ratelor de ridicare pe judet',
  heat2: 'Reguli automate per regiune (Atentie / Blocat pe zona)',
  cfgH2: 'Tu setezi regulile. Risk Shield le aplica.',
  cfgSub: 'Fiecare prag este configurabil. Tu decizi cand un client devine Atentie, Problematic sau Blocat.',
  cfgTag: 'Configurabil',
  cfg1: 'Praguri de scor personalizate per eticheta de risc',
  cfg2: 'Configureaza alerte pe email, WhatsApp sau dashboard',
  cfg3: 'Alege modul auto-hold vs notificare-doar',
  cfg4: 'Opteaza sau nu pentru reteaua globala de blacklist',
  cfgSlider1: 'Prag Atentie',
  cfgSlider2: 'Prag Problematic',
  cfgSlider3: 'Prag Blocat',
  cfgToggle1: 'Participa la blacklist global',
  cfgToggle2: 'Alerte comenzi Problematic',
  cfgToggle3: 'Comenzi noaptea (00-06)',
  cfgSave: 'Salveaza configuratia',
  mlH2: 'Invata singur din greselile si succesele tale',
  mlSub: 'Modelul se calibreaza automat la baza de clienti specifica magazinului tau. Cu cat analizeaza mai multe comenzi, cu atat devine mai precis.',
  mlTag: 'Machine Learning',
  mlCard1Title: 'Acuratetea creste',
  mlCard1: 'Fiecare refuz confirmat si fiecare livrare reusita antreneaza modelul pentru contextul tau specific.',
  mlCard2Title: 'Auto-recalibrare',
  mlCard2: 'Tiparele sezoniere, segmentele noi de clienti si schimbarile comportamentale sunt detectate si integrate automat.',
  mlCard3Title: 'Urmarire continua a trendurilor',
  mlCard3: 'Sistemul se adapteaza pe masura ce magazinul creste, asigurand ca scoring-ul ramane relevant la orice scara.',
  mlBold: 'Cu cat il folosesti mai mult, cu atat devine mai inteligent.',
  statsH2: 'Ce se schimba dupa ce activezi Risk Shield',
  stat1Value: 67,
  stat1Suffix: '%',
  stat1Label: 'reducere rata colete neridicate',
  stat2Value: 35,
  stat2Suffix: ' RON',
  stat2Label: 'economisiti per comanda blocata',
  stat3Value: 20,
  stat3Suffix: '+',
  stat3Label: 'semnale analizate automat',
  faqH2: 'Intrebari frecvente',
  faqs: [
    { q: 'Risk Shield functioneaza cu toti curierii?', a: 'Da. Risk Shield analizeaza datele comenzilor independent de curierul folosit. Se integreaza cu WooCommerce si citeste datele comenzilor si ale clientilor direct, indiferent de furnizorul de curierat.' },
    { q: 'Clientul blocat stie ca a fost blocat?', a: 'Nu. Risk Shield opereaza silentios in fundal. Un client blocat vede pur si simplu ca comanda nu poate fi procesata cu plata la livrare si i se poate oferi optiunea de plata in avans.' },
    { q: 'Ce se intampla daca Risk Shield blocheaza un client bun din greseala?', a: 'Tu ai intotdeauna control deplin. Poti revizui orice comanda semnalata si poti suprascrie decizia manual. Sistemul invata si din corectiile tale pentru a imbunatati acuratetea viitoare.' },
    { q: 'Datele clientilor sunt partajate cu alte magazine?', a: 'Doar semnale comportamentale anonimizate contribuie la blacklist-ul partajat. Niciun dato personal (nume, email, adresa) nu este niciodata partajat. Fiecare magazin vede doar detaliile propriilor clienti.' },
    { q: 'Cat dureaza pana cand Risk Shield incepe sa faca predictii precise?', a: 'Modelul incepe sa functioneze de la prima comanda. Acuratetea creste semnificativ dupa 50-100 de comenzi analizate, pe masura ce sistemul se calibreaza la tiparele specifice ale clientilor tai.' },
  ],
  ctaH2: 'Opreste pierderile inainte sa inceapa.',
  ctaSub: 'Fiecare comanda e analizata automat. Tu intervii doar cand conteaza.',
  ctaBtn: 'Activeaza Risk Shield gratuit',
  ctaNote: 'Nu e nevoie de card de credit. Configurarea dureaza sub 5 minute.',
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

// ─── FAQItem ──────────────────────────────────────────────────────────────────

function FAQItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-neutral-100 last:border-0">
      <button onClick={onToggle} className="w-full flex items-start justify-between gap-4 py-5 text-left">
        <span className="text-base font-medium text-neutral-900 leading-snug">{q}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 mt-0.5 text-neutral-400">
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

// ─── Profile data ─────────────────────────────────────────────────────────────

type ProfileKey = 'new' | 'regular' | 'problematic' | 'blocked'

const profilesEn = {
  new: {
    score: 15,
    label: 'NEW',
    labelColor: '#6b7280',
    labelBg: 'rgba(107,114,128,0.1)',
    flags: [
      { text: 'First order', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
      { text: 'Account created 2 days ago', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
    ],
    rec: 'New customer. Process normally.',
  },
  regular: {
    score: 8,
    label: 'TRUSTED',
    labelColor: '#16a34a',
    labelBg: 'rgba(22,163,74,0.1)',
    flags: [],
    rec: 'Trusted customer. Process normally.',
  },
  problematic: {
    score: 72,
    label: 'PROBLEMATIC',
    labelColor: '#ea580c',
    labelBg: 'rgba(234,88,12,0.1)',
    flags: [
      { text: 'Temporary email detected', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
      { text: '3 parcels refused previously', color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
      { text: 'Pickup rate: 28%', color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
      { text: 'COD order 890 RON', color: '#ca8a04', bg: 'rgba(202,138,4,0.08)' },
      { text: 'Phone unverified', color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
    ],
    rec: 'Put order on hold. Call customer before shipping.',
  },
  blocked: {
    score: 91,
    label: 'BLOCKED',
    labelColor: '#dc2626',
    labelBg: 'rgba(220,38,38,0.1)',
    flags: [
      { text: 'In global blacklist', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
      { text: 'Pickup rate: 4%', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
      { text: '11 refused parcels', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
      { text: 'Temporary email detected', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
      { text: 'Duplicate identity detected', color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
    ],
    rec: 'Block order. Request prepayment.',
  },
}

const profilesRo = {
  new: {
    score: 15,
    label: 'NOU',
    labelColor: '#6b7280',
    labelBg: 'rgba(107,114,128,0.1)',
    flags: [
      { text: 'Prima comanda', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
      { text: 'Cont creat acum 2 zile', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
    ],
    rec: 'Client nou. Proceseaza normal.',
  },
  regular: {
    score: 8,
    label: 'TRUSTED',
    labelColor: '#16a34a',
    labelBg: 'rgba(22,163,74,0.1)',
    flags: [],
    rec: 'Client de incredere. Proceseaza normal.',
  },
  problematic: {
    score: 72,
    label: 'PROBLEMATIC',
    labelColor: '#ea580c',
    labelBg: 'rgba(234,88,12,0.1)',
    flags: [
      { text: 'Email temporar detectat', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
      { text: '3 colete refuzate anterior', color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
      { text: 'Rata ridicare: 28%', color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
      { text: 'Comanda COD 890 RON', color: '#ca8a04', bg: 'rgba(202,138,4,0.08)' },
      { text: 'Telefon neverificat', color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
    ],
    rec: 'Pune comanda in hold. Suna clientul.',
  },
  blocked: {
    score: 91,
    label: 'BLOCAT',
    labelColor: '#dc2626',
    labelBg: 'rgba(220,38,38,0.1)',
    flags: [
      { text: 'In blacklist global', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
      { text: 'Rata ridicare: 4%', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
      { text: '11 colete refuzate', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
      { text: 'Email temporar detectat', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
      { text: 'Identitate duplicata detectata', color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
    ],
    rec: 'Blocheaza comanda. Solicita plata in avans.',
  },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RiskShieldPage() {
  const { locale } = useT()
  const c = locale === 'ro' ? ro : en
  const reduced = useReducedMotion()

  const fadeUp = (delay = 0) => reduced ? {} : {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 as number },
    transition: { duration: 0.6, ease: 'easeOut' as const, delay },
  }

  const redGradientText = {
    background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #f87171 100%)',
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
    backgroundClip: 'text' as const,
  }

  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [heatmapSvg, setHeatmapSvg] = useState<string>('')

  useEffect(() => {
    const file = locale === 'ro' ? '/images/romania-map.svg' : '/images/world-map.svg'
    fetch(file)
      .then(r => r.text())
      .then(raw => {
        // Remove fixed width/height, fix viewbox casing
        let svg = raw
          .replace(/\s+width="[^"]*"/g, '')
          .replace(/\s+height="[^"]*"/g, '')
          .replace(/viewbox=/gi, 'viewBox=')

        if (locale === 'ro') {
          // Default county fill → neutral gray
          svg = svg.replace(/(<svg[^>]*?)fill="[^"]*"/, '$1fill="#d1d5db"')
          // High risk counties (red)
          const highRisk = ['ROB', 'ROIS', 'ROGL', 'ROBR', 'ROIL']
          // Medium-high (orange)
          const medHigh = ['ROPH', 'ROIF', 'ROCL', 'ROTR', 'ROBC', 'ROVL']
          // Medium (yellow)
          const medium = ['ROCJ', 'ROBV', 'ROCT', 'ROAG', 'RODB', 'ROGR']
          // Low risk (green)
          const lowRisk = ['ROTM', 'ROSB', 'ROBH', 'ROAR', 'ROMS', 'ROCV']

          const colorMap: Record<string, string> = {}
          highRisk.forEach(id => { colorMap[id] = '#dc2626' })
          medHigh.forEach(id => { colorMap[id] = '#ea580c' })
          medium.forEach(id => { colorMap[id] = '#eab308' })
          lowRisk.forEach(id => { colorMap[id] = '#22c55e' })

          Object.entries(colorMap).forEach(([id, color]) => {
            svg = svg.replace(
              new RegExp(`(<path[^>]*?id="${id}"[^>]*?)(?:fill="[^"]*")?`, 'g'),
              `$1 fill="${color}"`
            )
          })
        } else {
          // Default country fill → neutral gray
          svg = svg.replace(/(<svg[^>]*?)fill="[^"]*"/, '$1fill="#d1d5db"')
          // High risk countries (red)
          const highRisk = ['RO', 'UA', 'BG', 'MD', 'NG', 'PK', 'BD', 'VN']
          // Medium-high (orange)
          const medHigh = ['PL', 'HU', 'RS', 'TR', 'MA', 'EG', 'IN', 'ID']
          // Medium (yellow)
          const medium = ['DE', 'FR', 'IT', 'ES', 'CZ', 'SK', 'GR', 'BR', 'MX']
          // Low risk (green)
          const lowRisk = ['US', 'GB', 'SE', 'NO', 'DK', 'FI', 'NL', 'CH', 'AT', 'AU', 'CA']

          const colorMap: Record<string, string> = {}
          highRisk.forEach(id => { colorMap[id] = '#dc2626' })
          medHigh.forEach(id => { colorMap[id] = '#ea580c' })
          medium.forEach(id => { colorMap[id] = '#eab308' })
          lowRisk.forEach(id => { colorMap[id] = '#22c55e' })

          Object.entries(colorMap).forEach(([id, color]) => {
            svg = svg.replace(
              new RegExp(`(<path[^>]*?\\bid="${id}"[^>]*?)(?:fill="[^"]*")?`, 'g'),
              `$1 fill="${color}"`
            )
          })
        }

        setHeatmapSvg(svg)
      })
      .catch(() => setHeatmapSvg(''))
  }, [locale])

  // Hero score animation
  const [heroScore, setHeroScore] = useState(0)
  useEffect(() => {
    if (reduced) { setHeroScore(72); return }
    const target = 72
    let cur = 0
    const steps = 40
    const inc = target / steps
    const t = setInterval(() => {
      cur += inc
      if (cur >= target) { setHeroScore(target); clearInterval(t) }
      else setHeroScore(Math.floor(cur))
    }, 1200 / steps)
    return () => clearInterval(t)
  }, [reduced])

  // Interactive demo
  const profiles = locale === 'ro' ? profilesRo : profilesEn
  const [selectedProfile, setSelectedProfile] = useState<ProfileKey>('problematic')
  const [displayScore, setDisplayScore] = useState(0)

  useEffect(() => {
    setDisplayScore(0)
    const target = profiles[selectedProfile].score
    if (reduced) { setDisplayScore(target); return }
    let cur = 0
    const steps = 40
    const inc = target / steps
    const t = setInterval(() => {
      cur += inc
      if (cur >= target) { setDisplayScore(target); clearInterval(t) }
      else setDisplayScore(Math.floor(cur))
    }, 800 / steps)
    return () => clearInterval(t)
  }, [selectedProfile, profiles, reduced])

  // Stats observer
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsActive, setStatsActive] = useState(false)
  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsActive(true); obs.disconnect() } }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const stat1 = useCountUp(c.stat1Value, statsActive)
  const stat2 = useCountUp(c.stat2Value, statsActive)
  const stat3 = useCountUp(c.stat3Value, statsActive)

  const currentProfile = profiles[selectedProfile]

  const howSteps = [
    { icon: ShoppingCart, title: c.step1Title, text: c.step1 },
    { icon: ScanLine, title: c.step2Title, text: c.step2 },
    { icon: AlertTriangle, title: c.step3Title, text: c.step3 },
    { icon: BellRing, title: c.step4Title, text: c.step4 },
  ]

  const sigCategories = [
    { icon: History, title: c.sigCat1Title, items: c.sigCat1Items },
    { icon: ShoppingBag, title: c.sigCat2Title, items: c.sigCat2Items },
    { icon: User, title: c.sigCat3Title, items: c.sigCat3Items },
    { icon: Globe, title: c.sigCat4Title, items: c.sigCat4Items },
  ]

  const riskLabels = [
    { title: c.label0Title, sub: c.label0Sub, desc: c.label0Desc, icon: ShieldCheck, color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: '#16a34a' },
    { title: c.label1Title, sub: c.label1Sub, desc: c.label1Desc, icon: UserPlus, color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: '#6b7280' },
    { title: c.label2Title, sub: c.label2Sub, desc: c.label2Desc, icon: Eye, color: '#ca8a04', bg: 'rgba(202,138,4,0.08)', border: '#ca8a04' },
    { title: c.label3Title, sub: c.label3Sub, desc: c.label3Desc, icon: AlertTriangle, color: '#ea580c', bg: 'rgba(234,88,12,0.08)', border: '#ea580c' },
    { title: c.label4Title, sub: c.label4Sub, desc: c.label4Desc, icon: Ban, color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: '#dc2626' },
  ]

  const demoProfiles: Array<{ key: ProfileKey; label: string }> = [
    { key: 'new', label: c.demoProfile1 },
    { key: 'regular', label: c.demoProfile2 },
    { key: 'problematic', label: c.demoProfile3 },
    { key: 'blocked', label: c.demoProfile4 },
  ]

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
          background: 'radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%)',
        }} />

        <div className="relative max-w-[780px] mx-auto text-center">
          {/* Badge */}
          <motion.div {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } })}>
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border mb-6 text-sm font-medium"
              style={{ background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.2)', color: '#dc2626' }}
            >
              <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
                <ShieldCheck className="h-3.5 w-3.5" />
              </motion.div>
              {c.badge}
            </div>
          </motion.div>

          {/* H1 */}
          <motion.div {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.1 } })}>
            <h1
              className="font-extrabold text-neutral-900 leading-[1.05] tracking-tight mb-6"
              style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}
            >
              {c.h1a}{' '}
              <span style={redGradientText}>{c.h1b}</span>{' '}
              {c.h1c}
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
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl text-[15px] font-semibold text-white hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] transition-all duration-200 shadow-[0_2px_8px_rgba(220,38,38,0.3)]"
                style={{ background: '#dc2626' }}
              >
                {c.cta}
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-1.5 px-6 py-3.5 rounded-xl text-[15px] font-semibold text-neutral-600 border border-neutral-200 bg-white/60 hover:bg-white hover:border-neutral-300 transition-colors"
              >
                {c.ctaAlt}
                <motion.span animate={{ y: [0, 2, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <ArrowDown className="h-4 w-4" />
                </motion.span>
              </a>
            </div>
          </motion.div>

          {/* Hero card mockup */}
          <motion.div
            className="relative max-w-[560px] mx-auto mt-12 overflow-visible"
            {...(reduced ? {} : { initial: { opacity: 0, y: 32 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: 0.5 } })}
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden">
              {/* Customer header */}
              <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: '#dc2626' }}
                  >
                    M
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{c.heroCustomerName}</p>
                    <p className="text-xs text-neutral-400">{c.heroCustomerEmail}</p>
                  </div>
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(234,88,12,0.1)', color: '#ea580c' }}
                >
                  {c.heroCustomerBadge}
                </span>
              </div>

              {/* Risk score bar */}
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-neutral-500">{c.heroRiskScore}</span>
                  <span className="text-lg font-bold" style={{ color: '#dc2626' }}>{heroScore}</span>
                </div>
                <div className="relative h-3 rounded-full" style={{ background: 'linear-gradient(to right, #22c55e 0%, #eab308 50%, #dc2626 100%)' }}>
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-md border-2 border-neutral-300"
                    style={{ left: `${Math.min(heroScore, 96)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' as const }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-neutral-400">{c.heroScoreLeft}</span>
                  <span className="text-[10px] text-neutral-400">{c.heroScoreCenter}</span>
                  <span className="text-[10px] text-neutral-400">{c.heroScoreRight}</span>
                </div>
              </div>

              {/* Detected signals */}
              <div className="px-5 pb-3">
                <p className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">{c.heroSignalsTitle}</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { text: c.heroSignal1, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
                    { text: c.heroSignal2, color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
                    { text: c.heroSignal3, color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
                    { text: c.heroSignal4, color: '#ca8a04', bg: 'rgba(202,138,4,0.08)' },
                  ].map((sig, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: sig.bg, color: sig.color }}
                    >
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {sig.text}
                    </span>
                  ))}
                </div>
              </div>

              {/* Recommendation */}
              <div className="mx-5 mb-5 px-4 py-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.05)', borderLeft: '3px solid #dc2626' }}>
                <p className="text-sm text-neutral-600 italic">{c.heroRec}</p>
              </div>
            </div>

            {/* Floating badges row below card */}
            <div className="flex justify-center gap-3 mt-5 flex-wrap">
              {[
                { icon: <Zap className="h-3.5 w-3.5 text-emerald-500" />, text: c.heroBadge1, delay: 0 },
                { icon: <Globe className="h-3.5 w-3.5" style={{ color: '#dc2626' }} />, text: c.heroBadge2, delay: 0.3 },
                { icon: <BrainCircuit className="h-3.5 w-3.5 text-emerald-500" />, text: c.heroBadge3, delay: 0.6 },
              ].map((badge, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-2 bg-white rounded-xl shadow-md border border-neutral-100 px-3 py-2"
                  animate={reduced ? {} : { y: [0, -4, 0] }}
                  transition={{ duration: 2.8 + i * 0.4, repeat: Infinity, ease: 'easeInOut' as const, delay: badge.delay }}
                >
                  {badge.icon}
                  <span className="text-xs font-semibold text-neutral-700">{badge.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 2 — PAIN POINTS ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-14" {...fadeUp()}>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.painH2}</h2>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">{c.painSub}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { icon: Truck, title: c.pain1Title, text: c.pain1 },
              { icon: PackageX, title: c.pain2Title, text: c.pain2 },
              { icon: TrendingDown, title: c.pain3Title, text: c.pain3 },
            ].map(({ icon: Icon, title, text }, i) => (
              <motion.div
                key={i}
                className="bg-white rounded-2xl p-6 border border-neutral-100 hover:border-red-200 transition-colors duration-300 shadow-sm"
                {...fadeUp(i * 0.1)}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(220,38,38,0.08)' }}>
                  <Icon className="h-5 w-5" style={{ color: '#dc2626' }} />
                </div>
                <h3 className="text-base font-semibold text-neutral-900 mb-2">{title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{text}</p>
              </motion.div>
            ))}
          </div>

          {/* Calculator card */}
          <motion.div className="max-w-[480px] mx-auto bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden" {...fadeUp(0.3)}>
            <div className="px-6 py-4 border-b border-neutral-100" style={{ background: 'rgba(220,38,38,0.04)' }}>
              <p className="text-sm font-semibold text-neutral-700">{c.calcTitle}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{c.calcSub}</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              {[
                { label: c.calcRow1, val: c.calcRow1Val },
                { label: c.calcRow2, val: c.calcRow2Val },
                { label: c.calcRow3, val: c.calcRow3Val },
                { label: c.calcRow4, val: c.calcRow4Val },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">{row.label}</span>
                  <span className="font-semibold text-neutral-700">{row.val}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-sm font-bold text-neutral-900">{c.calcTotal}</span>
                <span className="text-sm font-bold" style={{ color: '#dc2626' }}>= 35+ RON</span>
              </div>
            </div>
            <div className="px-6 pb-4">
              <p className="text-xs text-neutral-400 italic opacity-60">{c.calcNote}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 3 — HOW IT WORKS ═══ */}
      <section id="how-it-works" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-14" {...fadeUp()}>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.howH2}</h2>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">{c.howSub}</p>
          </motion.div>

          {/* Desktop: horizontal 4-col grid */}
          <div className="hidden md:grid grid-cols-4 gap-6 relative">
            {howSteps.map(({ icon: Icon, title, text }, i) => (
              <motion.div key={i} className="relative" {...fadeUp(i * 0.1)}>
                <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-100 h-full">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-white font-bold text-sm"
                    style={{ background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div
                    className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-xs font-bold"
                    style={{ color: '#dc2626' }}
                  >
                    {i + 1}
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2">{title}</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">{text}</p>
                </div>
                {i < 3 && (
                  <div className="absolute top-5 -right-3 z-10 text-neutral-300">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Mobile: vertical stack */}
          <div className="md:hidden space-y-4">
            {howSteps.map(({ icon: Icon, title, text }, i) => (
              <motion.div key={i} className="relative flex gap-4" {...fadeUp(i * 0.1)}>
                {i < 3 && (
                  <div className="absolute left-5 top-14 bottom-0 w-px bg-neutral-100" />
                )}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
                  style={{ background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm font-semibold text-neutral-900 mb-1">{title}</p>
                  <p className="text-sm text-neutral-500 leading-relaxed">{text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 4 — SCORING SYSTEM ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-14" {...fadeUp()}>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
            >
              {c.scoreTag}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.scoreH2}</h2>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">{c.scoreSub}</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left: signal categories */}
            <div className="space-y-4">
              {sigCategories.map(({ icon: Icon, title, items }, i) => (
                <motion.div key={i} className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm" {...fadeUp(i * 0.1)}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.08)' }}>
                      <Icon className="h-4 w-4" style={{ color: '#dc2626' }} />
                    </div>
                    <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
                  </div>
                  <ul className="space-y-1">
                    {items.map((item, j) => (
                      <li key={j} className="flex items-center gap-2 text-xs text-neutral-500">
                        <div className="w-1 h-1 rounded-full shrink-0" style={{ background: '#dc2626' }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>

            {/* Right: risk labels */}
            <div className="space-y-3">
              {riskLabels.map(({ title, sub, desc, icon: Icon, color, bg, border }, i) => (
                <motion.div
                  key={i}
                  className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm flex items-center gap-4"
                  style={{ borderLeftWidth: '3px', borderLeftColor: border }}
                  {...fadeUp(i * 0.08)}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                    <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold" style={{ color }}>{title}</span>
                      <span className="text-xs text-neutral-400">{sub}</span>
                    </div>
                    <p className="text-xs text-neutral-500">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 5 — INTERACTIVE DEMO ═══ */}
      <section id="demo" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <motion.div className="text-center mb-10" {...fadeUp()}>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.demoH2}</h2>
            <p className="text-lg text-neutral-500">{c.demoSub}</p>
          </motion.div>

          <motion.div {...fadeUp(0.1)}>
            {/* Profile selector pills */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center mb-8">
              {demoProfiles.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedProfile(key)}
                  className="px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200"
                  style={selectedProfile === key
                    ? { background: '#dc2626', color: '#fff', borderColor: '#dc2626' }
                    : { background: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Demo card */}
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-lg overflow-hidden">
              {/* Score bar */}
              <div className="px-6 pt-6 pb-4 border-b border-neutral-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-neutral-500">{c.demoScoreLabel}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: currentProfile.labelBg, color: currentProfile.labelColor }}
                    >
                      {currentProfile.label}
                    </span>
                    <span className="text-2xl font-bold" style={{ color: currentProfile.labelColor }}>{displayScore}</span>
                  </div>
                </div>
                <div className="relative h-3 rounded-full" style={{ background: 'linear-gradient(to right, #22c55e 0%, #eab308 50%, #dc2626 100%)' }}>
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-md border-2 border-neutral-300"
                    style={{ left: `${Math.min(displayScore, 96)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' as const }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-neutral-400">{c.heroScoreLeft}</span>
                  <span className="text-[10px] text-neutral-400">{c.heroScoreCenter}</span>
                  <span className="text-[10px] text-neutral-400">{c.heroScoreRight}</span>
                </div>
              </div>

              {/* Flags & recommendation */}
              <div className="px-6 py-5">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">{c.demoFlagsTitle}</p>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedProfile}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {currentProfile.flags.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-emerald-600">
                        <CheckCircle className="h-4 w-4" />
                        {c.demoNoFlags}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {currentProfile.flags.map((flag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                            style={{ background: flag.bg, color: flag.color }}
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {flag.text}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 px-4 py-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.04)', borderLeft: '3px solid #dc2626' }}>
                      <p className="text-xs font-semibold text-neutral-500 mb-1">{c.demoRecLabel}</p>
                      <p className="text-sm text-neutral-700 italic">{currentProfile.rec}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <p className="text-center text-xs text-neutral-400 mt-4 italic">{c.demoNote}</p>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 6 — BLACKLIST GLOBAL ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: text */}
            <motion.div {...fadeUp()}>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
                style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
              >
                <Globe className="h-3.5 w-3.5" />
                {c.blacklistTag}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.blacklistH2}</h2>
              <p className="text-neutral-500 leading-relaxed mb-6">{c.blacklistSub}</p>
              <ul className="space-y-3">
                {[c.blacklist1, c.blacklist2, c.blacklist3, c.blacklist4].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-neutral-600">
                    <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Right: network visualization */}
            <motion.div {...fadeUp(0.1)}>
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8 flex items-center justify-center min-h-[280px]">
                <div className="relative w-full max-w-[300px] h-[260px]">
                  {/* Central shield node */}
                  <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl flex flex-col items-center justify-center shadow-lg z-10"
                    style={{ background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' }}
                  >
                    <ShieldCheck className="h-7 w-7 text-white" />
                    <span className="text-[9px] text-white/80 font-semibold mt-0.5">Shield</span>
                  </div>

                  {/* Store nodes around it */}
                  {[
                    { top: '4%', left: '50%', x: '-50%', label: 'Store A' },
                    { top: '25%', left: '88%', x: '-50%', label: 'Store B' },
                    { top: '70%', left: '88%', x: '-50%', label: 'Store C' },
                    { top: '85%', left: '50%', x: '-50%', label: 'Store D' },
                    { top: '70%', left: '12%', x: '-50%', label: 'Store E' },
                    { top: '25%', left: '12%', x: '-50%', label: 'Store F' },
                  ].map((node, i) => (
                    <div
                      key={i}
                      className="absolute flex flex-col items-center"
                      style={{ top: node.top, left: node.left, transform: `translateX(${node.x})` }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border border-neutral-100"
                        style={{ background: i === 2 ? 'rgba(220,38,38,0.08)' : '#fff' }}
                      >
                        {i === 2 ? (
                          <UserX className="h-4 w-4" style={{ color: '#dc2626' }} />
                        ) : (
                          <Store className="h-4 w-4 text-neutral-400" />
                        )}
                      </div>
                      <span className="text-[9px] text-neutral-400 mt-0.5">{node.label}</span>
                    </div>
                  ))}

                  {/* Connecting lines (SVG) */}
                  <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
                    {[
                      { x1: '50%', y1: '18%', x2: '50%', y2: '45%' },
                      { x1: '80%', y1: '30%', x2: '60%', y2: '46%' },
                      { x1: '80%', y1: '72%', x2: '60%', y2: '55%' },
                      { x1: '50%', y1: '88%', x2: '50%', y2: '57%' },
                      { x1: '20%', y1: '72%', x2: '40%', y2: '55%' },
                      { x1: '20%', y1: '30%', x2: '40%', y2: '46%' },
                    ].map((line, i) => (
                      <line
                        key={i}
                        x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                        stroke={i === 2 ? '#dc2626' : '#e5e7eb'}
                        strokeWidth={i === 2 ? '1.5' : '1'}
                        strokeDasharray={i === 2 ? '4 3' : undefined}
                      />
                    ))}
                  </svg>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 7 — IDENTITY RESOLUTION ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: card visual (order-2 on mobile so text shows first) */}
            <motion.div className="order-2 lg:order-1" {...fadeUp()}>
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-neutral-100" style={{ background: 'rgba(220,38,38,0.03)' }}>
                  <p className="text-sm font-semibold text-neutral-700">{c.identCardTitle}</p>
                </div>
                <div className="divide-y divide-neutral-100">
                  {[
                    { name: c.identCard1Name, email: c.identCard1Email, sim: c.identCard1Sim, pct: 87 },
                    { name: c.identCard2Name, email: c.identCard2Email, sim: c.identCard2Sim, pct: 79 },
                  ].map((cand, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: '#dc2626' }}
                          >
                            {cand.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-neutral-800">{cand.name}</p>
                            <p className="text-xs text-neutral-400">{cand.email}</p>
                          </div>
                        </div>
                        <button
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
                          style={{ color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }}
                        >
                          {c.identVerify}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${cand.pct}%`, background: 'linear-gradient(to right, #dc2626, #f87171)' }}
                          />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>{cand.sim}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Right: text (order-1 on mobile so it shows first) */}
            <motion.div className="order-1 lg:order-2" {...fadeUp(0.1)}>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
                style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
              >
                <Fingerprint className="h-3.5 w-3.5" />
                {c.identTag}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.identH2}</h2>
              <p className="text-neutral-500 leading-relaxed mb-6">{c.identSub}</p>
              <ul className="space-y-3">
                {[c.ident1, c.ident2, c.ident3].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-neutral-600">
                    <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 8 — FINANCIAL DASHBOARD ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: text */}
            <motion.div {...fadeUp()}>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
                style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                {c.finTag}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.finH2}</h2>
              <p className="text-neutral-500 leading-relaxed mb-6">{c.finSub}</p>
              <ul className="space-y-3">
                {[c.fin1, c.fin2, c.fin3].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-neutral-600">
                    <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Right: dashboard card */}
            <motion.div {...fadeUp(0.1)}>
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-lg p-6">
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {[
                    { val: c.finMetric1, label: c.finMetric1Label, color: '#dc2626', bg: 'rgba(220,38,38,0.05)' },
                    { val: c.finMetric2, label: c.finMetric2Label, color: '#16a34a', bg: 'rgba(22,163,74,0.05)' },
                    { val: c.finMetric3, label: c.finMetric3Label, color: '#ea580c', bg: 'rgba(234,88,12,0.05)' },
                    { val: c.finMetric4, label: c.finMetric4Label, color: '#16a34a', bg: 'rgba(22,163,74,0.05)' },
                  ].map((metric, i) => (
                    <div key={i} className="rounded-xl p-4" style={{ background: metric.bg }}>
                      <p className="text-xl font-bold mb-1" style={{ color: metric.color }}>{metric.val}</p>
                      <p className="text-xs text-neutral-500">{metric.label}</p>
                    </div>
                  ))}
                </div>
                {/* Comparison bars */}
                <div className="space-y-3">
                  {[
                    { label: c.finBar1, pct: 72, color: '#dc2626' },
                    { label: c.finBar2, pct: 48, color: '#d1d5db' },
                  ].map((bar, i) => (
                    <div key={i}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-neutral-500">{bar.label}</span>
                        <span className="text-xs font-semibold text-neutral-700">{bar.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${bar.pct}%`, background: bar.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 9 — HEATMAP ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: text */}
            <motion.div {...fadeUp()}>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
                style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
              >
                <Map className="h-3.5 w-3.5" />
                {c.heatTag}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.heatH2}</h2>
              <p className="text-neutral-500 leading-relaxed mb-6">{c.heatSub}</p>
              <ul className="space-y-3">
                {[c.heat1, c.heat2].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-neutral-600">
                    <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Right: heatmap visual */}
            <motion.div {...fadeUp(0.1)}>
              <div className="rounded-2xl overflow-hidden shadow-lg border border-neutral-100 bg-neutral-50 p-4">
                <p className="text-xs font-semibold text-neutral-500 text-center mb-3">{c.heatTag}</p>
                {heatmapSvg ? (
                  <div
                    className="w-full [&>svg]:w-full [&>svg]:h-auto"
                    style={{ maxHeight: 320, overflow: 'hidden' }}
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: heatmapSvg }}
                  />
                ) : (
                  <div className="w-full flex items-center justify-center bg-neutral-100 rounded-xl" style={{ height: 280 }}>
                    <Globe className="h-10 w-10 text-neutral-300 animate-pulse" />
                  </div>
                )}
                {/* Legend */}
                <div className="flex justify-center gap-4 mt-3 flex-wrap">
                  {[
                    { label: locale === 'ro' ? 'Risc ridicat' : 'High risk', color: '#dc2626' },
                    { label: locale === 'ro' ? 'Risc mediu' : 'Medium risk', color: '#ea580c' },
                    { label: locale === 'ro' ? 'Risc scazut' : 'Low risk', color: '#22c55e' },
                    { label: locale === 'ro' ? 'Fara date' : 'No data', color: '#d1d5db' },
                  ].map((leg, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: leg.color }} />
                      <span className="text-[10px] text-neutral-500 font-medium">{leg.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 10 — CONFIGURATION ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: text */}
            <motion.div {...fadeUp()}>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
                style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
              >
                <Settings className="h-3.5 w-3.5" />
                {c.cfgTag}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.cfgH2}</h2>
              <p className="text-neutral-500 leading-relaxed mb-6">{c.cfgSub}</p>
              <ul className="space-y-3">
                {[c.cfg1, c.cfg2, c.cfg3, c.cfg4].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-neutral-600">
                    <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Right: settings card */}
            <motion.div {...fadeUp(0.1)}>
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-lg p-6 space-y-5">
                {/* Sliders */}
                {[
                  { label: c.cfgSlider1, val: 41, color: '#ca8a04' },
                  { label: c.cfgSlider2, val: 61, color: '#ea580c' },
                  { label: c.cfgSlider3, val: 81, color: '#dc2626' },
                ].map((slider, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-medium text-neutral-600">{slider.label}</span>
                      <span className="text-xs font-bold" style={{ color: slider.color }}>{slider.val}</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-neutral-100">
                      <div className="h-full rounded-full" style={{ width: `${slider.val}%`, background: slider.color, opacity: 0.5 }} />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 shadow-sm cursor-pointer"
                        style={{ left: `calc(${slider.val}% - 8px)`, borderColor: slider.color }}
                      />
                    </div>
                  </div>
                ))}

                <div className="border-t border-neutral-100 pt-4 space-y-3">
                  {[
                    { label: c.cfgToggle1, on: true, color: '#16a34a' },
                    { label: c.cfgToggle2, on: true, color: '#16a34a' },
                    { label: c.cfgToggle3, on: true, color: '#ca8a04' },
                  ].map((toggle, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-neutral-600">{toggle.label}</span>
                      <div
                        className="w-10 h-5 rounded-full relative flex items-center px-0.5 cursor-pointer"
                        style={{ background: toggle.color }}
                      >
                        <div className="absolute right-0.5 w-4 h-4 rounded-full bg-white shadow-sm" />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' }}
                >
                  {c.cfgSave}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 11 — ML AUTO-CALIBRARE ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-[700px] mx-auto text-center">
          <motion.div {...fadeUp()}>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              {c.mlTag}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.mlH2}</h2>
            <p className="text-neutral-500 leading-relaxed mb-10">{c.mlSub}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            {[
              { icon: Target, title: c.mlCard1Title, text: c.mlCard1 },
              { icon: RefreshCw, title: c.mlCard2Title, text: c.mlCard2, spin: true },
              { icon: TrendingUp, title: c.mlCard3Title, text: c.mlCard3 },
            ].map(({ icon: Icon, title, text, spin }, i) => (
              <motion.div
                key={i}
                className="bg-neutral-50 rounded-2xl p-5 border border-neutral-100"
                {...fadeUp(i * 0.1)}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 mx-auto" style={{ background: 'rgba(220,38,38,0.08)' }}>
                  {spin ? (
                    <motion.div animate={reduced ? {} : { rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' as const }}>
                      <Icon className="h-5 w-5" style={{ color: '#dc2626' }} />
                    </motion.div>
                  ) : (
                    <Icon className="h-5 w-5" style={{ color: '#dc2626' }} />
                  )}
                </div>
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">{title}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">{text}</p>
              </motion.div>
            ))}
          </div>

          <motion.p
            className="text-base font-bold text-neutral-900"
            {...fadeUp(0.3)}
          >
            {c.mlBold}
          </motion.p>
        </div>
      </section>

      {/* ═══ SECTION 12 — STATS ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50" ref={statsRef}>
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-14" {...fadeUp()}>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">{c.statsH2}</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { prefix: '-', val: stat1, suffix: c.stat1Suffix, label: c.stat1Label },
              { prefix: '', val: stat2, suffix: c.stat2Suffix, label: c.stat2Label },
              { prefix: '', val: stat3, suffix: c.stat3Suffix, label: c.stat3Label },
            ].map(({ prefix, val, suffix, label }, i) => (
              <motion.div key={i} className="text-center" {...fadeUp(i * 0.1)}>
                <div
                  className="text-5xl sm:text-6xl font-extrabold mb-3 tracking-tight"
                  style={redGradientText}
                >
                  {prefix}{val}{suffix}
                </div>
                <p className="text-sm text-neutral-500 max-w-[200px] mx-auto leading-relaxed">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 13 — FAQ ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-[700px] mx-auto">
          <motion.div className="text-center mb-12" {...fadeUp()}>
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight">{c.faqH2}</h2>
          </motion.div>

          <motion.div className="bg-white rounded-2xl border border-neutral-100 shadow-sm" {...fadeUp(0.1)}>
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

      {/* ═══ SECTION 14 — CTA FINAL ═══ */}
      <section
        className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #f87171 100%)' }}
      >
        {/* Animated hue shift overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={reduced ? {} : {
            background: [
              'linear-gradient(135deg, rgba(153,27,27,0.4) 0%, transparent 60%)',
              'linear-gradient(225deg, rgba(153,27,27,0.4) 0%, transparent 60%)',
              'linear-gradient(135deg, rgba(153,27,27,0.4) 0%, transparent 60%)',
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
              style={{ background: '#fff', color: '#991b1b' }}
            >
              {c.ctaBtn}
            </Link>

            <p className="mt-5 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {c.ctaNote}
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
