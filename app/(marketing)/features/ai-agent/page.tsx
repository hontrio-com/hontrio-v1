'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Bot, ArrowDown, Clock, SearchX, MessageSquareX, ChevronDown,
  CheckCircle, Settings, Download, BrainCircuit, MessageSquare,
  Search, MessageCircle, Sliders, PhoneForwarded, Globe, BarChart2,
  ShoppingBag, HelpCircle, Palette, Inbox,
  Zap, Send, X, ArrowRight,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'

// ─── Content ─────────────────────────────────────────────────────────────────

const en = {
  badge: 'AI Agent',
  h1a: 'Your sales assistant',
  h1b: 'that never sleeps',
  h1Gradient: 'never sleeps',
  subtitle: 'Your buyers have questions at any hour. The Hontrio agent responds instantly, finds the right products and transfers the conversation to you exactly when needed.',
  cta: 'Try for free',
  ctaAlt: 'Test a conversation',
  agentName: 'Assistant',
  agentNameDemo: 'Demo Assistant',
  onlineNow: 'Online now',
  inputPlaceholder: 'Write a message...',
  inputPlaceholderDemo: 'Write a question...',
  widgetMsg1: 'Hello! I am your virtual store assistant. How can I help you today?',
  widgetQr1: 'Looking for a product',
  widgetQr2: 'Delivery question',
  widgetQr3: 'Returns',
  widgetMsg2: 'I am looking for a clothes rack for the hallway.',
  widgetTyping: '',
  widgetMsg3: 'I found 2 suitable options for you:',
  widgetProduct1: 'Metal clothes rack 5 arms',
  widgetProduct1Price: '189 lei',
  widgetProductBtn: 'View product',
  widgetMsg4: 'How long does delivery take?',
  widgetMsg5: 'Standard delivery takes 2-3 business days. For orders placed before 2:00 PM, shipping happens the same day.',
  floatSpeed: 'Response in 2 seconds',
  floatAvail: 'Available 24/7',
  floatZero: 'Zero configuration',
  painH2: 'What happens when your store does not respond',
  painSub: 'Most customer questions come outside business hours. Without a quick response, the buyer goes to the competition and never comes back.',
  pain1Title: 'Questions come at night, answers in the morning',
  pain1: 'Over 60% of shopping sessions happen after 6 PM. By the time you respond the next day, the customer has already found what they were looking for elsewhere.',
  pain2Title: 'Customer cannot find the product and leaves',
  pain2: 'A buyer who cannot quickly find what they are looking for in your catalog does not call and does not wait. They close the tab and open another store.',
  pain3Title: 'Same questions consume time every day',
  pain3: 'Delivery, returns, stock availability, dimensions. Questions repeat daily and consume hours of your time or your team.',
  painCta: 'The Hontrio agent is always active, in your place.',
  howH2: 'Installed in five minutes, active forever',
  howSub: 'No technical knowledge needed. Install the module directly from your dashboard and you\'re ready in minutes.',
  step1Title: 'Configure the agent',
  step1: 'Choose the agent name, welcome message, widget colors and WhatsApp number for escalation. All from the Hontrio dashboard, no code.',
  step2Title: 'Install the module',
  step2: 'Download the Hontrio module directly from your dashboard and install it in your online store in a few clicks.',
  step3Title: 'Agent learns your catalog',
  step3: 'The system automatically syncs all products from your store. The agent knows prices, stock, descriptions and specs of every product.',
  step4Title: 'Customers get instant answers',
  step4: 'From the moment of installation, the agent handles all conversations. You receive notifications only for situations that require your involvement.',
  demoH2: 'Test a real conversation',
  demoSub: 'Write any question as if you were a customer. The agent responds immediately.',
  demoWelcome: 'Hello! I am the Hontrio demo agent. You can ask me any question about an online store and I will show you how I respond to your customers. Start with one of the options below or write directly.',
  demoQr1: 'How long does delivery take?',
  demoQr2: 'Is the product in stock?',
  demoQr3: 'How do I make a return?',
  demoQr4: 'Recommend a product',
  demoNote: 'This is a demonstration with pre-defined responses. The real agent has access to your complete store catalog.',
  whatH2: 'More than an ordinary chatbot',
  whatSub: 'The Hontrio agent knows every product in your store and knows when to respond alone and when to involve you.',
  w1Title: 'Recommends the right products',
  w1: 'The customer describes what they are looking for in their own words. The agent understands the intent, searches the catalog and presents suitable options with image, price and a direct link to the product page.',
  w2Title: 'Customer can add products to cart directly from chat',
  w2: 'The agent presents products with a direct link to the cart or product page. The buyer can complete the purchase without leaving the conversation, reducing friction and increasing conversions.',
  w3Title: 'Guides visitors towards the purchase decision',
  w3: 'The agent does not just answer questions. It actively recommends products, highlights key benefits and helps the customer make a decision faster.',
  w4Title: 'Intelligently escalates to WhatsApp',
  w4: 'When a situation requires human involvement, the conversation is transferred to you on WhatsApp with full context already filled in. The customer repeats nothing and the sale is not lost.',
  w5Title: 'Handles delivery, returns and availability questions',
  w5: 'Delivery times, return policies, stock availability, dimensions. The agent responds correctly at any hour so you do not lose customers to unanswered questions.',
  w6Title: 'Reports what sells and what stops customers',
  w6: 'Every conversation is recorded. Find out which products generate the most interest, which questions go unanswered and where you lose customers in the buying process.',
  flowH2: 'A conversation that leads to a sale',
  flowSub: 'The agent does not just answer questions. It guides visitors step by step towards the purchase decision.',
  flow1: 'Visitor opens chat',
  flow2: 'Agent greets and offers quick options',
  flow3: 'Visitor asks about a product',
  flow4: 'Agent finds and presents suitable products',
  flowLeft: 'Customer is satisfied',
  flowLeftEnd: 'Order placed',
  flowRight: 'Customer has additional questions',
  flowRightMid: 'WhatsApp escalation with full context',
  flowRightEnd: 'Sale completed with your help',
  flowNote: 'Regardless of path, the agent maintains conversation context throughout.',
  persH2: 'Looks and speaks like your store',
  persSub: 'The agent is not a generic widget. Configure it to reflect your brand: colors, name, tone and key messages.',
  persTag: 'Customization',
  persP: 'The agent is not a generic widget. Configure it to reflect your brand: colors, name, tone and key messages. Visitors interact with your assistant, not an anonymous bot.',
  pers1: 'Custom name and avatar: Choose how the agent presents itself to your customers.',
  pers2: 'Colors synced with your brand: The widget adopts your store colors automatically.',
  pers3: 'Personalized welcome message: The first impression is written by you, delivered by the agent.',
  pers4: 'Configurable position and behavior: Choose where the widget appears and when it opens automatically.',
  persCardTitle: 'Configure the agent',
  persLabel1: 'Agent name',
  persInput1: 'Assistant',
  persLabel2: 'Welcome message',
  persTextarea: 'Hello! How can I help you today? I can find products, answer delivery questions or connect you with our team.',
  persLabel3: 'Primary color',
  persLabel4: 'WhatsApp number',
  persInput4: '+40 7XX XXX XXX',
  persSaveBtn: 'Save configuration',
  persPreview: 'Live preview',
  inboxH2: 'You know exactly what your customers want',
  inboxSub: 'Every conversation is saved and analyzed. You do not need to be present in chat to understand what customers ask, what products they look for and where friction appears.',
  inboxTag: 'Inbox & Analytics',
  inbox1: 'Complete conversation history: Access any past conversation with all messages and recommended products.',
  inbox2: 'Unanswered questions: Find out exactly what the agent was asked and could not answer, so you can improve the configuration.',
  inbox3: 'Most searched products: See which products generate the most interest in conversations, even if they do not always lead to an order.',
  inboxCardTitle: 'Recent conversations',
  inboxBadge: '12',
  inboxConv1Name: 'Andrei M.',
  inboxConv1Msg: 'How long does delivery take...',
  inboxConv1Time: '3 min ago',
  inboxConv2Name: 'Maria C.',
  inboxConv2Msg: 'I am looking for a shelf for...',
  inboxConv2Time: '12 min ago',
  inboxConv2Badge: 'Escalation',
  inboxConv3Name: 'Ion P.',
  inboxConv3Msg: 'Do you have this in blue...',
  inboxConv3Time: '34 min ago',
  inboxConv3Badge: 'No answer',
  inboxConv4Name: 'Elena R.',
  inboxConv4Msg: 'Excellent! I placed the order...',
  inboxConv4Time: '1h ago',
  inboxMore: '+8 new conversations today',
  statsH2: 'What changes after you install the agent',
  stat1Value: 68,
  stat1Suffix: '%',
  stat1Label: 'of customer questions answered automatically, without your involvement',
  stat2Prefix: '3x',
  stat2Label: 'more conversations handled compared to manual support',
  stat3Prefix: '24/7',
  stat3Label: 'availability, including weekends and public holidays',
  faqH2: 'Frequently asked questions',
  faqs: [
    { q: 'Does the agent work with my online store platform?', a: 'Yes. The Hontrio agent works with the most popular e-commerce platforms including Shopify, Magento and others. Contact us to confirm compatibility with your specific setup.' },
    { q: 'What happens if the agent does not know how to answer a question?', a: 'The agent recognizes its limits. Instead of making up an answer, it tells the customer it does not have the information and offers the option of transfer to you on WhatsApp, with all conversation context already filled in.' },
    { q: 'Can I see all the conversations the agent has had?', a: 'Yes. All conversations are saved in the inbox of the Hontrio dashboard. You can filter by date, by mentioned products or by conversations that required escalation.' },
    { q: 'Can the agent complete orders or does it only answer questions?', a: 'In the current version, the agent guides the buyer towards the right product and redirects them to the product page or shopping cart. Order completion happens in your online store, as usual.' },
    { q: 'How long does it take until the agent knows my entire catalog?', a: 'The initial sync takes between a few seconds and a few minutes, depending on the number of products. After that, any new product added to your store appears automatically in the agent knowledge.' },
  ],
  ctaH2: 'Install the agent and let it sell for you.',
  ctaSub: 'Configuration in five minutes. No credit card. No commitment.',
  ctaBtn: 'Try for free',
  ctaNote: 'Or test the ',
  ctaNoteLink: 'demo conversation',
  ctaNote2: ' above first.',
}

const ro = {
  badge: 'AI Agent',
  h1a: 'Asistentul tau de vanzari',
  h1b: 'care nu doarme niciodata',
  h1Gradient: 'niciodata',
  subtitle: 'Cumparatorii tai au intrebari la orice ora. Agentul Hontrio raspunde instant, gaseste produsele potrivite si transfera conversatia catre tine exact cand e nevoie.',
  cta: 'Incearca gratuit',
  ctaAlt: 'Testeaza o conversatie',
  agentName: 'Asistent',
  agentNameDemo: 'Asistent Demo',
  onlineNow: 'Online acum',
  inputPlaceholder: 'Scrie un mesaj...',
  inputPlaceholderDemo: 'Scrie o intrebare...',
  widgetMsg1: 'Buna! Sunt asistentul tau virtual. Cu ce te pot ajuta astazi?',
  widgetQr1: 'Caut un produs',
  widgetQr2: 'Intrebare despre livrare',
  widgetQr3: 'Retururi',
  widgetMsg2: 'Caut un suport de haine pentru hol.',
  widgetTyping: '',
  widgetMsg3: 'Am gasit 2 optiuni potrivite pentru tine:',
  widgetProduct1: 'Suport haine metalic 5 brate',
  widgetProduct1Price: '189 lei',
  widgetProductBtn: 'Vezi produsul',
  widgetMsg4: 'Cat dureaza livrarea?',
  widgetMsg5: 'Livrarea standard dureaza 2-3 zile lucratoare. Pentru comenzi plasate pana la ora 14:00, expedierea se face in aceeasi zi.',
  floatSpeed: 'Raspuns in 2 secunde',
  floatAvail: 'Disponibil 24/7',
  floatZero: 'Zero configurare',
  painH2: 'Ce se intampla cand magazinul tau nu raspunde',
  painSub: 'Majoritatea intrebarilor clientilor apar in afara programului de lucru. Fara un raspuns rapid, cumparatorul pleaca la concurenta si nu mai revine.',
  pain1Title: 'Intrebarile vin noaptea, raspunsurile dimineata',
  pain1: 'Peste 60% din sesiunile de cumparaturi au loc dupa ora 18:00. Pana raspunzi a doua zi, clientul a gasit deja ce cautase in alta parte.',
  pain2Title: 'Clientul nu gaseste produsul si abandoneaza',
  pain2: 'Un cumparator care nu gaseste rapid ce cauta in catalogul tau nu suna si nu asteapta. Inchide tab-ul si deschide un alt magazin.',
  pain3Title: 'Aceleasi intrebari consuma timp in fiecare zi',
  pain3: 'Livrare, retur, disponibilitate stoc, dimensiuni. Intrebarile se repeta zilnic si ocupa ore din timpul tau sau al echipei tale.',
  painCta: 'Agentul Hontrio este activ in permanenta, in locul tau.',
  howH2: 'Instalat in cinci minute, activ pentru totdeauna',
  howSub: 'Nu ai nevoie de cunostinte tehnice. Instalezi modulul direct din dashboard-ul tau si esti gata in cateva minute.',
  step1Title: 'Configurezi agentul',
  step1: 'Alegi numele agentului, mesajul de bun venit, culorile widgetului si numarul de WhatsApp pentru escaladare. Totul din dashboard-ul Hontrio, fara cod.',
  step2Title: 'Instalezi modulul',
  step2: 'Descarci modulul Hontrio direct din dashboard-ul tau si il instalezi in magazinul tau online in cateva click-uri.',
  step3Title: 'Agentul invata catalogul tau',
  step3: 'Sistemul sincronizeaza automat toate produsele din magazin. Agentul cunoaste preturile, stocul, descrierile si specificatiile fiecarui produs.',
  step4Title: 'Clientii tai primesc raspunsuri instant',
  step4: 'Din momentul instalarii, agentul preia toate conversatiile. Tu primesti notificari doar pentru situatiile care necesita interventia ta.',
  demoH2: 'Testeaza o conversatie reala',
  demoSub: 'Scrie orice intrebare ca si cum ai fi un client. Agentul raspunde pe loc.',
  demoWelcome: 'Buna! Sunt agentul demo Hontrio. Poti sa imi adresezi orice intrebare despre un magazin online si iti voi arata cum raspund clientilor tai. Incepe cu una dintre optiunile de mai jos sau scrie direct.',
  demoQr1: 'Cat dureaza livrarea?',
  demoQr2: 'Aveti produsul in stoc?',
  demoQr3: 'Cum fac un retur?',
  demoQr4: 'Recomanda-mi un produs',
  demoNote: 'Aceasta este o demonstratie cu raspunsuri pre-definite. Agentul real are acces la catalogul complet al magazinului tau.',
  whatH2: 'Mai mult decat un chatbot obisnuit',
  whatSub: 'Agentul Hontrio cunoaste fiecare produs din magazinul tau si stie cand sa raspunda singur si cand sa te implice pe tine.',
  w1Title: 'Recomanda produsele potrivite',
  w1: 'Clientul descrie ce cauta in cuvintele lui. Agentul intelege intentia, cauta in catalog si prezinta optiunile potrivite cu imagine, pret si link direct catre pagina produsului.',
  w2Title: 'Clientul poate adauga produsul in cos direct din chat',
  w2: 'Agentul prezinta produsele cu link direct catre cos sau pagina de produs. Cumparatorul poate finaliza achizitia fara sa paraseasca conversatia, reducand frecarea si crescand conversiile.',
  w3Title: 'Ghideaza vizitatorii catre decizia de cumparare',
  w3: 'Agentul nu raspunde doar la intrebari. Recomanda activ produse, evidentiaza beneficiile cheie si ajuta clientul sa ia o decizie mai rapid.',
  w4Title: 'Escaladeaza inteligent catre WhatsApp',
  w4: 'Cand o situatie necesita interventia umana, conversatia este transferata catre tine pe WhatsApp cu tot contextul deja completat. Clientul nu repeta nimic si vanzarea nu se pierde.',
  w5Title: 'Gestioneaza intrebarile despre livrare, retur si stoc',
  w5: 'Termene de livrare, politici de retur, disponibilitate stoc, dimensiuni. Agentul raspunde corect la orice ora ca sa nu pierzi clienti din cauza intrebarilor fara raspuns.',
  w6Title: 'Raporteaza ce vinde si ce opreste clientii',
  w6: 'Fiecare conversatie este inregistrata. Afli ce produse sunt cele mai cautate, ce intrebari raman fara raspuns si unde pierzi clienti in procesul de cumparare.',
  flowH2: 'O conversatie care duce la vanzare',
  flowSub: 'Agentul nu raspunde doar la intrebari. Ghideaza vizitatorii pas cu pas catre decizia de cumparare.',
  flow1: 'Vizitator deschide chat',
  flow2: 'Agent saluta si ofera optiuni rapide',
  flow3: 'Vizitator intreaba despre un produs',
  flow4: 'Agent gaseste si prezinta produsele potrivite',
  flowLeft: 'Clientul este multumit',
  flowLeftEnd: 'Comanda plasata',
  flowRight: 'Clientul are intrebari suplimentare',
  flowRightMid: 'Escaladare WhatsApp cu context complet',
  flowRightEnd: 'Vanzare finalizata cu ajutorul tau',
  flowNote: 'Indiferent de drum, agentul mentine contextul conversatiei pe tot parcursul.',
  persH2: 'Arata si vorbeste ca magazinul tau',
  persSub: 'Agentul nu este un widget generic. Il configurezi sa reflecte brandul tau: culori, nume, ton si mesaje cheie.',
  persTag: 'Personalizare',
  persP: 'Agentul nu este un widget generic. Il configurezi sa reflecte brandul tau: culori, nume, ton si mesaje cheie. Vizitatorii interactioneaza cu asistentul tau, nu cu un bot anonim.',
  pers1: 'Nume si avatar personalizat: Alegi cum se prezinta agentul catre clientii tai.',
  pers2: 'Culori sincronizate cu brandul: Widgetul preia culorile magazinului tau automat.',
  pers3: 'Mesaj de bun venit personalizat: Prima impresie este scrisa de tine, livrata de agent.',
  pers4: 'Pozitie si comportament configurabile: Alegi unde apare widgetul si cand se deschide automat.',
  persCardTitle: 'Configureaza agentul',
  persLabel1: 'Nume agent',
  persInput1: 'Asistent',
  persLabel2: 'Mesaj de bun venit',
  persTextarea: 'Buna! Cu ce te pot ajuta astazi? Pot gasi produse, raspunde la intrebari despre livrare sau te conectez cu echipa noastra.',
  persLabel3: 'Culoare principala',
  persLabel4: 'Numar WhatsApp',
  persInput4: '+40 7XX XXX XXX',
  persSaveBtn: 'Salveaza configuratia',
  persPreview: 'Previzualizare live',
  inboxH2: 'Stii exact ce vor clientii tai',
  inboxSub: 'Fiecare conversatie este salvata si analizata. Nu trebuie sa fii prezent in chat ca sa intelegi ce intreaba clientii, ce produse cauta si unde apar frecari in procesul de cumparare.',
  inboxTag: 'Inbox & Analytics',
  inbox1: 'Istoricul complet al conversatiilor: Accesezi orice conversatie trecuta, cu toate mesajele si produsele recomandate.',
  inbox2: 'Intrebari fara raspuns: Afli exact ce a intrebat agentul si nu a stiut sa raspunda, ca sa poti imbunatati configuratia.',
  inbox3: 'Produse cele mai cautate: Vezi ce produse genereaza cel mai mult interes in conversatii, chiar daca nu duc intotdeauna la comanda.',
  inboxCardTitle: 'Conversatii recente',
  inboxBadge: '12',
  inboxConv1Name: 'Andrei M.',
  inboxConv1Msg: 'Cat dureaza livrarea la...',
  inboxConv1Time: 'acum 3 min',
  inboxConv2Name: 'Maria C.',
  inboxConv2Msg: 'Caut un raft pentru...',
  inboxConv2Time: 'acum 12 min',
  inboxConv2Badge: 'Escaladare',
  inboxConv3Name: 'Ion P.',
  inboxConv3Msg: 'Aveti si in albastru...',
  inboxConv3Time: 'acum 34 min',
  inboxConv3Badge: 'Fara raspuns',
  inboxConv4Name: 'Elena R.',
  inboxConv4Msg: 'Super! Am plasat comanda...',
  inboxConv4Time: 'acum 1h',
  inboxMore: '+8 conversatii noi astazi',
  statsH2: 'Ce se schimba dupa ce instalezi agentul',
  stat1Value: 68,
  stat1Suffix: '%',
  stat1Label: 'din intrebarile clientilor primesc raspuns automat, fara interventia ta',
  stat2Prefix: '3x',
  stat2Label: 'mai multe conversatii gestionate fata de suportul manual',
  stat3Prefix: '24/7',
  stat3Label: 'disponibilitate, inclusiv weekenduri si sarbatori legale',
  faqH2: 'Intrebari frecvente',
  faqs: [
    { q: 'Agentul functioneaza si daca nu am WooCommerce?', a: 'In prezent agentul Hontrio este optimizat pentru magazinele WooCommerce. Integrarea cu alte platforme precum Shopify sau Gomag este in dezvoltare si va fi disponibila in versiunile urmatoare.' },
    { q: 'Ce se intampla daca agentul nu stie sa raspunda la o intrebare?', a: 'Agentul recunoaste limitele sale. In loc sa inventeze un raspuns, ii spune clientului ca nu are informatia si ofera optiunea de transfer catre tine pe WhatsApp, cu tot contextul conversatiei deja completat.' },
    { q: 'Pot vedea toate conversatiile pe care le-a purtat agentul?', a: 'Da. Toate conversatiile sunt salvate in inbox-ul din dashboard-ul Hontrio. Poti filtra dupa data, dupa produsele mentionate sau dupa conversatiile care au necesitat escaladare.' },
    { q: 'Agentul poate finaliza comenzi sau doar raspunde la intrebari?', a: 'In versiunea actuala, agentul ghideaza cumparatorul catre produsul potrivit si il redirectioneaza catre pagina de produs sau cosul de cumparaturi. Finalizarea comenzii se face in WooCommerce, ca de obicei.' },
    { q: 'Cat timp dureaza pana agentul cunoaste tot catalogul meu?', a: 'Sincronizarea initiala dureaza intre cateva secunde si cateva minute, in functie de numarul de produse. Dupa aceea, orice produs nou adaugat in WooCommerce apare automat in cunostintele agentului.' },
  ],
  ctaH2: 'Instaleaza agentul si lasa-l sa vanda in locul tau.',
  ctaSub: 'Configurare in cinci minute. Fara card de credit. Fara angajament.',
  ctaBtn: 'Incearca gratuit',
  ctaNote: 'Sau testeaza mai intai ',
  ctaNoteLink: 'conversatia demo',
  ctaNote2: ' de mai sus.',
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

// ─── TypingIndicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-sm bg-neutral-100 w-fit">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-neutral-400"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  )
}

// ─── ChatBubble ───────────────────────────────────────────────────────────────

function ChatBubble({ text, isUser, color }: { text: string; isUser: boolean; color: string }) {
  return (
    <motion.div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'text-white rounded-[18px] rounded-br-[4px]'
            : 'text-neutral-800 bg-neutral-100 rounded-[18px] rounded-bl-[4px]'
        }`}
        style={isUser ? { background: color } : {}}
      >
        {text}
      </div>
    </motion.div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type HeroMsg = {
  id: number
  isUser: boolean
  text: string
  hasProducts?: boolean
  qrs?: string[]
}

type DemoMsg = {
  id: number
  isUser: boolean
  text: string
  hasProducts?: boolean
  qrs?: string[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIAgentPage() {
  const { locale } = useT()
  const c = locale === 'ro' ? ro : en
  const reduced = useReducedMotion()

  const [openFaq, setOpenFaq] = useState<number | null>(null)

  // Hero widget state
  const [heroMsgs, setHeroMsgs] = useState<HeroMsg[]>([])
  const [heroTyping, setHeroTyping] = useState(false)

  // Demo chat state
  const [demoMsgs, setDemoMsgs] = useState<DemoMsg[]>([])
  const [showTyping, setShowTyping] = useState(false)
  const [demoInput, setDemoInput] = useState('')
  const [demoReady, setDemoReady] = useState(false)
  const demoScrollRef = useRef<HTMLDivElement>(null)

  // Stats
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsActive, setStatsActive] = useState(false)

  const fadeUp = (delay = 0) => reduced ? {} : {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 as number },
    transition: { duration: 0.6, ease: 'easeOut' as const, delay },
  }

  const orangeGradientText = {
    background: 'linear-gradient(135deg, #c2410c 0%, #f97316 50%, #fdba74 100%)',
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
    backgroundClip: 'text' as const,
  }

  // Hero widget animation
  useEffect(() => {
    if (reduced) {
      setHeroMsgs([
        { id: 1, isUser: false, text: c.widgetMsg1, qrs: [c.widgetQr1, c.widgetQr2, c.widgetQr3] },
        { id: 2, isUser: true, text: c.widgetMsg2 },
        { id: 3, isUser: false, text: c.widgetMsg3, hasProducts: true },
        { id: 4, isUser: true, text: c.widgetMsg4 },
        { id: 5, isUser: false, text: c.widgetMsg5 },
      ])
      return
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(setTimeout(() => setHeroMsgs([{ id: 1, isUser: false, text: c.widgetMsg1, qrs: [c.widgetQr1, c.widgetQr2, c.widgetQr3] }]), 500))
    timers.push(setTimeout(() => setHeroMsgs(p => [...p, { id: 2, isUser: true, text: c.widgetMsg2 }]), 1500))
    timers.push(setTimeout(() => setHeroTyping(true), 2500))
    timers.push(setTimeout(() => {
      setHeroTyping(false)
      setHeroMsgs(p => [...p, { id: 3, isUser: false, text: c.widgetMsg3, hasProducts: true }])
    }, 3500))
    timers.push(setTimeout(() => setHeroMsgs(p => [...p, { id: 4, isUser: true, text: c.widgetMsg4 }]), 5000))
    timers.push(setTimeout(() => setHeroTyping(true), 6000))
    timers.push(setTimeout(() => {
      setHeroTyping(false)
      setHeroMsgs(p => [...p, { id: 5, isUser: false, text: c.widgetMsg5 }])
    }, 6800))
    return () => timers.forEach(clearTimeout)
  }, [reduced]) // eslint-disable-line

  // Demo init
  useEffect(() => {
    const t = setTimeout(() => {
      setDemoMsgs([{
        id: 1, isUser: false,
        text: c.demoWelcome,
        qrs: [c.demoQr1, c.demoQr2, c.demoQr3, c.demoQr4],
      }])
      setDemoReady(true)
    }, 500)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line

  // Auto-scroll demo
  useEffect(() => {
    if (demoScrollRef.current) {
      demoScrollRef.current.scrollTop = demoScrollRef.current.scrollHeight
    }
  }, [demoMsgs, showTyping])

  // Stats observer
  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsActive(true); obs.disconnect() } }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const stat1 = useCountUp(c.stat1Value, statsActive)

  const getResponse = useCallback((msg: string): { text: string; hasProducts?: boolean; qrs?: string[] } => {
    const m = msg.toLowerCase().trim()
    const isRo = locale === 'ro'

    if (m.includes('livrare') || m.includes('delivery') || m.includes('cat dureaza') || m.includes('how long')) {
      return {
        text: isRo
          ? 'Livrarea standard dureaza 2-3 zile lucratoare prin curier. Pentru comenzile plasate inainte de ora 14:00, expedierea are loc in aceeasi zi. Livrarea gratuita este disponibila pentru comenzile de peste 200 lei.'
          : 'Standard delivery takes 2-3 business days by courier. For orders placed before 2:00 PM, shipping happens the same day. Free delivery is available for orders over 200 lei.',
        qrs: isRo ? ['Si retururile?', 'Multumesc'] : ['What about returns?', 'Thank you'],
      }
    }
    if (m.includes('stoc') || m.includes('stock') || m.includes('aveti') || m.includes('do you have')) {
      return {
        text: isRo
          ? 'Pentru a verifica stocul unui produs specific, spune-mi numele produsului sau categoria care te intereseaza si iti confirm disponibilitatea in timp real.'
          : 'To check the stock of a specific product, tell me the product name or category you are interested in and I will confirm availability in real time.',
        qrs: isRo ? ['Caut un suport de haine'] : ['Looking for a coat rack'],
      }
    }
    if (m.includes('retur') || m.includes('return')) {
      return {
        text: isRo
          ? 'Retururile sunt acceptate in termen de 30 de zile de la livrare. Produsul trebuie sa fie in starea originala, cu etichete intacte. Completezi formularul de retur din contul tau si curierul vine sa ridice coletul gratuit.'
          : 'Returns are accepted within 30 days of delivery. The product must be in original condition with intact labels. Fill in the return form from your account and the courier comes to pick up the package for free.',
        qrs: isRo ? ['Multumesc'] : ['Thank you'],
      }
    }
    if (m.includes('recomanda') || m.includes('recommend') || m.includes('produs') || m.includes('product') || m.includes('suport') || m.includes('coat rack')) {
      return {
        text: isRo
          ? 'Am gasit doua optiuni disponibile in stoc:'
          : 'I found two available options in stock:',
        hasProducts: true,
        qrs: isRo ? ['Vreau sa comand', 'Alt buget'] : ['I want to order', 'Different budget'],
      }
    }
    if (m.includes('multumesc') || m.includes('thank')) {
      return {
        text: isRo
          ? 'Cu placere! Daca mai ai intrebari, sunt aici oricand. O zi buna!'
          : 'My pleasure! If you have more questions, I am here anytime. Have a great day!',
      }
    }
    if (m.includes('comand') || m.includes('order')) {
      return {
        text: isRo
          ? 'Perfect! Te redirectionez catre pagina produsului unde poti finaliza comanda.'
          : 'Perfect! I am redirecting you to the product page where you can complete the order.',
        qrs: isRo ? ['Incepe de la inceput'] : ['Start over'],
      }
    }
    if (m.includes('incepe') || m.includes('start over') || m.includes('reset')) {
      return { text: '__RESET__' }
    }
    return {
      text: isRo
        ? 'Aceasta este o demonstratie a capabilitatilor agentului Hontrio. In magazinul tau real, agentul are acces la intregul catalog de produse si poate raspunde la intrebari specifice despre orice produs.'
        : 'This is a demonstration of the Hontrio agent capabilities. In your real store, the agent has access to the complete product catalog and can answer specific questions about any product.',
      qrs: isRo ? ['Incepe de la inceput'] : ['Start over'],
    }
  }, [locale])

  const sendDemoMessage = useCallback((text: string) => {
    if (!text.trim() || showTyping) return

    const response = getResponse(text)

    if (response.text === '__RESET__') {
      setDemoMsgs([])
      setShowTyping(false)
      setTimeout(() => {
        setDemoMsgs([{
          id: 1, isUser: false,
          text: c.demoWelcome,
          qrs: [c.demoQr1, c.demoQr2, c.demoQr3, c.demoQr4],
        }])
      }, 400)
      return
    }

    const userMsg: DemoMsg = { id: Date.now(), isUser: true, text }
    setDemoMsgs(prev => [...prev, userMsg])
    setDemoInput('')
    setShowTyping(true)

    setTimeout(() => {
      setShowTyping(false)
      setDemoMsgs(prev => [...prev, {
        id: Date.now() + 1,
        isUser: false,
        text: response.text,
        hasProducts: response.hasProducts,
        qrs: response.qrs,
      }])
    }, 1800)
  }, [showTyping, getResponse, c])

  const productCards = (isLocaleRo: boolean, btnText: string) => (
    <div className="space-y-2 mt-2">
      {[
        { name: isLocaleRo ? 'Suport haine bambus minimal' : 'Bamboo minimal coat rack', price: '149 lei', img: '/images/ProdusSuportHaineBambus.webp' },
        { name: isLocaleRo ? 'Suport haine metalic 5 brate' : 'Metal clothes rack 5 arms', price: '189 lei', img: '/images/ProdusSuportHaineMetalic.jpeg' },
      ].map((p, i) => (
        <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl border border-neutral-100 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.img} alt={p.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-neutral-800 truncate">{p.name}</p>
            <p className="text-xs text-neutral-500">{p.price}</p>
          </div>
          <button
            className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors"
            style={{ color: '#f97316', borderColor: 'rgba(249,115,22,0.3)' }}
          >
            {btnText}
          </button>
        </div>
      ))}
    </div>
  )

  const howStepIcons = [Settings, Download, BrainCircuit, MessageSquare]
  const whatIcons = [Search, MessageCircle, Sliders, PhoneForwarded, Globe, BarChart2]

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
          background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
        }} />

        <div className="relative max-w-[780px] mx-auto text-center">
          {/* Badge */}
          <motion.div {...(reduced ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } })}>
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border mb-6 text-sm font-medium"
              style={{ background: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.2)', color: '#f97316' }}
            >
              <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
                <Bot className="h-3.5 w-3.5" />
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
              {c.h1a}
              <br />
              <span className="text-orange-500">{c.h1b}</span>
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
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl text-[15px] font-semibold text-white hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] transition-all duration-200 shadow-[0_2px_8px_rgba(249,115,22,0.3)]"
                style={{ background: '#f97316' }}
              >
                {c.cta}
              </Link>
              <a
                href="#demo-agent"
                className="inline-flex items-center justify-center gap-1.5 px-6 py-3.5 rounded-xl text-[15px] font-semibold text-neutral-600 border border-neutral-200 bg-white/60 hover:bg-white hover:border-neutral-300 transition-colors"
              >
                {c.ctaAlt}
                <motion.span animate={{ y: [0, 2, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <ArrowDown className="h-4 w-4" />
                </motion.span>
              </a>
            </div>
          </motion.div>

          {/* Hero widget card */}
          <motion.div
            className="relative max-w-[380px] mx-auto mt-12 overflow-visible"
            {...(reduced ? {} : { initial: { opacity: 0, y: 32 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: 0.5 } })}
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between" style={{ background: '#f97316' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">A</div>
                  <div>
                    <p className="text-white font-semibold text-sm">{c.agentName}</p>
                    <div className="flex items-center gap-1.5">
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <p className="text-white/70 text-xs">{c.onlineNow}</p>
                    </div>
                  </div>
                </div>
                <X className="h-4 w-4 text-white/60" />
              </div>

              {/* Messages */}
              <div className="p-4 space-y-3 min-h-[320px] bg-white">
                <AnimatePresence initial={false}>
                  {heroMsgs.map(msg => (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                      <div className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                            msg.isUser
                              ? 'text-white rounded-[18px] rounded-br-[4px]'
                              : 'text-neutral-800 bg-neutral-100 rounded-[18px] rounded-bl-[4px]'
                          }`}
                          style={msg.isUser ? { background: '#f97316' } : {}}
                        >
                          {msg.text}
                        </div>
                      </div>
                      {msg.hasProducts && productCards(locale === 'ro', c.widgetProductBtn)}
                      {msg.qrs && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {msg.qrs.map(qr => (
                            <button
                              key={qr}
                              className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-600 bg-white hover:border-orange-300 transition-colors"
                            >
                              {qr}
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {heroTyping && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    <TypingIndicator />
                  </motion.div>
                )}
              </div>

              {/* Input footer */}
              <div className="flex items-center gap-2 px-4 py-3 border-t border-neutral-100">
                <input
                  className="flex-1 text-sm text-neutral-600 placeholder:text-neutral-300 outline-none"
                  placeholder={c.inputPlaceholder}
                  readOnly
                />
                <Send className="h-4 w-4" style={{ color: '#f97316' }} />
              </div>
            </div>

            {/* Badges row below widget */}
            <div className="flex justify-center gap-3 mt-5 flex-wrap">
              {[
                { icon: <Zap className="h-3.5 w-3.5 text-emerald-500" />, text: c.floatSpeed, delay: 0 },
                { icon: <Clock className="h-3.5 w-3.5" style={{ color: '#f97316' }} />, text: c.floatAvail, delay: 0.3 },
                { icon: <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />, text: c.floatZero, delay: 0.6 },
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Clock, title: c.pain1Title, text: c.pain1 },
              { icon: SearchX, title: c.pain2Title, text: c.pain2 },
              { icon: MessageSquareX, title: c.pain3Title, text: c.pain3 },
            ].map(({ icon: Icon, title, text }, i) => (
              <motion.div
                key={i}
                className="bg-white rounded-2xl p-6 border border-neutral-100 hover:border-orange-200 transition-colors duration-300 shadow-sm"
                {...fadeUp(i * 0.1)}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(249,115,22,0.08)' }}
                >
                  <Icon className="h-5 w-5" style={{ color: '#f97316' }} />
                </div>
                <h3 className="text-base font-semibold text-neutral-900 mb-2">{title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{text}</p>
              </motion.div>
            ))}
          </div>

          <motion.div className="text-center mt-10" {...fadeUp(0.3)}>
            <p className="text-neutral-700 font-medium">
              {c.painCta}
            </p>
            <motion.div
              className="flex justify-center mt-3"
              animate={reduced ? {} : { y: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ChevronDown className="h-5 w-5 text-neutral-400" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 3 — HOW IT WORKS ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-14" {...fadeUp()}>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.howH2}</h2>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">{c.howSub}</p>
          </motion.div>

          {/* Desktop: 4 columns */}
          <div className="hidden md:grid md:grid-cols-4 gap-0 relative">
            {/* Arrow connectors */}
            {[25, 50, 75].map((left, i) => (
              <motion.div
                key={i}
                className="absolute top-8 -translate-x-1/2 z-10"
                style={{ left: `${left}%` }}
                {...fadeUp(0.2 + i * 0.1)}
              >
                <ArrowRight className="h-5 w-5 text-neutral-300" />
              </motion.div>
            ))}
            {[
              { icon: howStepIcons[0], title: c.step1Title, text: c.step1 },
              { icon: howStepIcons[1], title: c.step2Title, text: c.step2 },
              { icon: howStepIcons[2], title: c.step3Title, text: c.step3 },
              { icon: howStepIcons[3], title: c.step4Title, text: c.step4 },
            ].map(({ icon: Icon, title, text }, i) => (
              <motion.div key={i} className="flex flex-col items-center text-center px-4" {...fadeUp(i * 0.1)}>
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shrink-0 shadow-sm"
                  style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.15)' }}
                >
                  <Icon className="h-6 w-6" style={{ color: '#f97316' }} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#f97316' }}>0{i + 1}</p>
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">{title}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">{text}</p>
              </motion.div>
            ))}
          </div>

          {/* Mobile: vertical stack */}
          <div className="md:hidden space-y-6">
            {[
              { icon: howStepIcons[0], title: c.step1Title, text: c.step1 },
              { icon: howStepIcons[1], title: c.step2Title, text: c.step2 },
              { icon: howStepIcons[2], title: c.step3Title, text: c.step3 },
              { icon: howStepIcons[3], title: c.step4Title, text: c.step4 },
            ].map(({ icon: Icon, title, text }, i) => (
              <motion.div key={i} className="flex gap-4" {...fadeUp(i * 0.1)}>
                <div className="flex flex-col items-center">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(249,115,22,0.1)' }}
                  >
                    <Icon className="h-5 w-5" style={{ color: '#f97316' }} />
                  </div>
                  {i < 3 && <div className="w-px flex-1 mt-2 bg-neutral-100" />}
                </div>
                <div className="pb-4">
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#f97316' }}>0{i + 1}</p>
                  <h3 className="text-sm font-semibold text-neutral-900 mb-1">{title}</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">{text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 4 — INTERACTIVE DEMO ═══ */}
      <section id="demo-agent" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-[480px] mx-auto">
          <motion.div className="text-center mb-10" {...fadeUp()}>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.demoH2}</h2>
            <p className="text-lg text-neutral-500">{c.demoSub}</p>
          </motion.div>

          <motion.div
            className="bg-white rounded-3xl shadow-[0_2px_40px_rgba(0,0,0,0.08)] border border-neutral-100 overflow-hidden"
            {...fadeUp(0.1)}
          >
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: '#f97316' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">H</div>
                <div>
                  <p className="text-white font-semibold text-sm">{c.agentNameDemo}</p>
                  <div className="flex items-center gap-1.5">
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <p className="text-white/70 text-xs">{c.onlineNow}</p>
                  </div>
                </div>
              </div>
              <HelpCircle className="h-4 w-4 text-white/60" />
            </div>

            {/* Messages scrollable area */}
            <div ref={demoScrollRef} className="p-4 space-y-3 max-h-[380px] overflow-y-auto bg-white">
              {demoReady && demoMsgs.map(msg => (
                <div key={msg.id}>
                  <ChatBubble text={msg.text} isUser={msg.isUser} color="#f97316" />
                  {msg.hasProducts && productCards(locale === 'ro', c.widgetProductBtn)}
                  {msg.qrs && (
                    <div className="flex flex-wrap gap-1.5 mt-2 justify-start">
                      {msg.qrs.map(qr => (
                        <button
                          key={qr}
                          onClick={() => sendDemoMessage(qr)}
                          className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-600 bg-white hover:border-orange-300 transition-colors"
                        >
                          {qr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {showTyping && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <TypingIndicator />
                </motion.div>
              )}
            </div>

            {/* Input footer */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-neutral-100">
              <input
                className="flex-1 text-sm text-neutral-600 placeholder:text-neutral-300 outline-none"
                placeholder={c.inputPlaceholderDemo}
                value={demoInput}
                onChange={e => setDemoInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendDemoMessage(demoInput) }}
                disabled={showTyping}
              />
              <button
                onClick={() => sendDemoMessage(demoInput)}
                disabled={showTyping || !demoInput.trim()}
                className="disabled:opacity-40 transition-opacity"
              >
                <Send className="h-4 w-4" style={{ color: '#f97316' }} />
              </button>
            </div>
          </motion.div>

          <motion.p className="text-center text-xs text-neutral-400 mt-4 leading-relaxed" {...fadeUp(0.2)}>
            {c.demoNote}
          </motion.p>
        </div>
      </section>

      {/* ═══ SECTION 5 — WHAT THE AGENT DOES ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-14" {...fadeUp()}>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.whatH2}</h2>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">{c.whatSub}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: whatIcons[0], title: c.w1Title, text: c.w1 },
              { icon: whatIcons[1], title: c.w2Title, text: c.w2 },
              { icon: whatIcons[2], title: c.w3Title, text: c.w3 },
              { icon: whatIcons[3], title: c.w4Title, text: c.w4 },
              { icon: whatIcons[4], title: c.w5Title, text: c.w5 },
              { icon: whatIcons[5], title: c.w6Title, text: c.w6 },
            ].map(({ icon: Icon, title, text }, i) => (
              <motion.div
                key={i}
                className="bg-white rounded-2xl p-6 border border-neutral-100 hover:border-orange-200 transition-colors duration-300 shadow-sm"
                {...fadeUp(i * 0.08)}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(249,115,22,0.08)' }}
                >
                  <Icon className="h-5 w-5" style={{ color: '#f97316' }} />
                </div>
                <h3 className="text-base font-semibold text-neutral-900 mb-2">{title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 6 — CONVERSATION FLOW ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-14" {...fadeUp()}>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.flowH2}</h2>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">{c.flowSub}</p>
          </motion.div>

          {/* Desktop flow */}
          <div className="hidden md:block">
            {/* Top row */}
            <div className="flex items-start justify-center gap-0">
              {[c.flow1, c.flow2, c.flow3, c.flow4].map((label, i) => (
                <div key={i} className="flex items-center">
                  <motion.div
                    className="w-36 flex flex-col items-center text-center"
                    {...fadeUp(i * 0.1)}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center mb-3 text-white font-bold text-sm shadow-md"
                      style={{ background: '#f97316' }}
                    >
                      {i + 1}
                    </div>
                    <div className="px-3 py-2.5 rounded-xl border border-neutral-200 bg-white shadow-sm w-full">
                      <p className="text-xs font-medium text-neutral-700 leading-snug">{label}</p>
                    </div>
                  </motion.div>
                  {i < 3 && (
                    <motion.div className="mx-1 mt-6 shrink-0" {...fadeUp(0.1 + i * 0.1)}>
                      <ArrowRight className="h-4 w-4 text-orange-300" />
                    </motion.div>
                  )}
                </div>
              ))}
            </div>

            {/* Fork */}
            <div className="flex justify-center mt-4">
              <div className="w-px h-8 bg-neutral-200" />
            </div>

            {/* Two branches */}
            <div className="flex justify-center gap-16">
              {/* Left branch */}
              <motion.div className="flex flex-col items-center" {...fadeUp(0.4)}>
                <div className="w-px h-6 bg-emerald-200" />
                <div className="px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm">
                  <p className="text-xs font-medium text-emerald-700">{c.flowLeft}</p>
                </div>
                <div className="w-px h-6 bg-emerald-200" />
                <div className="px-4 py-2.5 rounded-xl bg-emerald-500 shadow-sm">
                  <p className="text-xs font-semibold text-white">{c.flowLeftEnd}</p>
                </div>
              </motion.div>

              {/* Right branch */}
              <motion.div className="flex flex-col items-center" {...fadeUp(0.5)}>
                <div className="w-px h-6 bg-orange-200" />
                <div className="px-4 py-2.5 rounded-xl border border-orange-200 bg-orange-50 shadow-sm">
                  <p className="text-xs font-medium text-orange-700">{c.flowRight}</p>
                </div>
                <div className="w-px h-6 bg-orange-200" />
                <div className="px-4 py-2.5 rounded-xl border border-orange-300 bg-white shadow-sm">
                  <p className="text-xs font-medium text-neutral-700">{c.flowRightMid}</p>
                </div>
                <div className="w-px h-6 bg-orange-200" />
                <div className="px-4 py-2.5 rounded-xl" style={{ background: '#f97316' }}>
                  <p className="text-xs font-semibold text-white">{c.flowRightEnd}</p>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Mobile flow */}
          <div className="md:hidden space-y-3">
            {[c.flow1, c.flow2, c.flow3, c.flow4].map((label, i) => (
              <motion.div key={i} className="flex items-center gap-3" {...fadeUp(i * 0.1)}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-sm"
                  style={{ background: '#f97316' }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 bg-white shadow-sm">
                  <p className="text-sm font-medium text-neutral-700">{label}</p>
                </div>
              </motion.div>
            ))}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <motion.div className="space-y-2" {...fadeUp(0.4)}>
                <div className="px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50">
                  <p className="text-xs font-medium text-emerald-700">{c.flowLeft}</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-emerald-500">
                  <p className="text-xs font-semibold text-white">{c.flowLeftEnd}</p>
                </div>
              </motion.div>
              <motion.div className="space-y-2" {...fadeUp(0.5)}>
                <div className="px-3 py-2.5 rounded-xl border border-orange-200 bg-orange-50">
                  <p className="text-xs font-medium text-orange-700">{c.flowRight}</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl border border-orange-300 bg-white">
                  <p className="text-xs font-medium text-neutral-700">{c.flowRightMid}</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl" style={{ background: '#f97316' }}>
                  <p className="text-xs font-semibold text-white">{c.flowRightEnd}</p>
                </div>
              </motion.div>
            </div>
          </div>

          <motion.p className="text-center text-sm text-neutral-400 mt-8" {...fadeUp(0.6)}>
            {c.flowNote}
          </motion.p>
        </div>
      </section>

      {/* ═══ SECTION 7 — PERSONALIZATION ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <motion.div {...fadeUp()}>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-5"
                style={{ background: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.2)', color: '#f97316' }}
              >
                <Palette className="h-3.5 w-3.5" />
                {c.persTag}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.persH2}</h2>
              <p className="text-neutral-500 leading-relaxed mb-6">{c.persP}</p>
              <ul className="space-y-3">
                {[c.pers1, c.pers2, c.pers3, c.pers4].map((item, i) => (
                  <motion.li key={i} className="flex items-start gap-3" {...fadeUp(0.1 + i * 0.08)}>
                    <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#f97316' }} />
                    <span className="text-sm text-neutral-600 leading-relaxed">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Right - form mockup */}
            <motion.div {...fadeUp(0.2)}>
              <div className="bg-white rounded-2xl shadow-md border border-neutral-100 p-5">
                <p className="text-sm font-semibold text-neutral-900 mb-4">{c.persCardTitle}</p>

                <div className="space-y-4">
                  {/* Agent name */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">{c.persLabel1}</label>
                    <div className="px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700">
                      {c.persInput1}
                    </div>
                  </div>

                  {/* Welcome message */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">{c.persLabel2}</label>
                    <div className="px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-600 leading-relaxed min-h-[72px]">
                      {c.persTextarea}
                    </div>
                  </div>

                  {/* Primary color */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">{c.persLabel3}</label>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="w-5 h-5 rounded-md shrink-0" style={{ background: '#f97316' }} />
                      <span className="text-sm text-neutral-700">#f97316</span>
                    </div>
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">{c.persLabel4}</label>
                    <div className="px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-600">
                      {c.persInput4}
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <button
                  className="w-full mt-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#f97316' }}
                >
                  {c.persSaveBtn}
                </button>

                {/* Widget preview */}
                <div className="flex items-center gap-3 mt-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                    style={{ background: '#f97316' }}
                  >
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs text-neutral-500">{c.persPreview}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 8 — INBOX & REPORTS ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <motion.div {...fadeUp()}>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-5"
                style={{ background: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.2)', color: '#f97316' }}
              >
                <Inbox className="h-3.5 w-3.5" />
                {c.inboxTag}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-4">{c.inboxH2}</h2>
              <p className="text-neutral-500 leading-relaxed mb-6">{c.inboxSub}</p>
              <ul className="space-y-3">
                {[c.inbox1, c.inbox2, c.inbox3].map((item, i) => (
                  <motion.li key={i} className="flex items-start gap-3" {...fadeUp(0.1 + i * 0.08)}>
                    <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#f97316' }} />
                    <span className="text-sm text-neutral-600 leading-relaxed">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Right - inbox card */}
            <motion.div {...fadeUp(0.2)}>
              <div className="bg-white rounded-2xl shadow-md border border-neutral-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                  <span className="text-sm font-semibold text-neutral-900">{c.inboxCardTitle}</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: '#f97316' }}
                  >
                    {c.inboxBadge}
                  </span>
                </div>

                {/* Conversation rows */}
                {[
                  { name: c.inboxConv1Name, msg: c.inboxConv1Msg, time: c.inboxConv1Time, unread: true },
                  { name: c.inboxConv2Name, msg: c.inboxConv2Msg, time: c.inboxConv2Time, badge: c.inboxConv2Badge, badgeColor: 'bg-amber-100 text-amber-700' },
                  { name: c.inboxConv3Name, msg: c.inboxConv3Msg, time: c.inboxConv3Time, badge: c.inboxConv3Badge, badgeColor: 'bg-red-100 text-red-600' },
                  { name: c.inboxConv4Name, msg: c.inboxConv4Msg, time: c.inboxConv4Time },
                ].map((conv, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-neutral-50 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500 shrink-0">
                      {conv.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-800">{conv.name}</span>
                        {conv.badge && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${conv.badgeColor}`}>
                            {conv.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 italic truncate">{conv.msg}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-neutral-300">{conv.time}</span>
                      {conv.unread && <div className="w-2 h-2 rounded-full" style={{ background: '#f97316' }} />}
                    </div>
                  </div>
                ))}

                <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-100">
                  <p className="text-xs text-neutral-400 text-center">{c.inboxMore}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 9 — STATS ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-14" {...fadeUp()}>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">{c.statsH2}</h2>
          </motion.div>

          <div ref={statsRef} className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Stat 1 - countup */}
            <motion.div className="text-center" {...fadeUp()}>
              <p className="text-6xl font-extrabold mb-2" style={orangeGradientText}>
                {stat1}{c.stat1Suffix}
              </p>
              <p className="text-neutral-500 text-sm leading-relaxed max-w-[200px] mx-auto">{c.stat1Label}</p>
            </motion.div>

            {/* Stat 2 - static */}
            <motion.div className="text-center" {...fadeUp(0.1)}>
              <p className="text-6xl font-extrabold mb-2" style={orangeGradientText}>
                {c.stat2Prefix}
              </p>
              <p className="text-neutral-500 text-sm leading-relaxed max-w-[200px] mx-auto">{c.stat2Label}</p>
            </motion.div>

            {/* Stat 3 - static */}
            <motion.div className="text-center" {...fadeUp(0.2)}>
              <p className="text-6xl font-extrabold mb-2" style={orangeGradientText}>
                {c.stat3Prefix}
              </p>
              <p className="text-neutral-500 text-sm leading-relaxed max-w-[200px] mx-auto">{c.stat3Label}</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 10 — FAQ ═══ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-[700px] mx-auto">
          <motion.div className="text-center mb-12" {...fadeUp()}>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">{c.faqH2}</h2>
          </motion.div>

          <motion.div
            className="bg-white rounded-2xl shadow-sm border border-neutral-100 px-6"
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

      {/* ═══ SECTION 11 — CTA FINAL ═══ */}
      <section
        className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #c2410c 0%, #f97316 50%, #fdba74 100%)' }}
      >
        {/* Animated hue shift overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={reduced ? {} : {
            background: [
              'linear-gradient(135deg, rgba(194,65,12,0.4) 0%, transparent 60%)',
              'linear-gradient(225deg, rgba(194,65,12,0.4) 0%, transparent 60%)',
              'linear-gradient(135deg, rgba(194,65,12,0.4) 0%, transparent 60%)',
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
              style={{ background: '#fff', color: '#c2410c' }}
            >
              {c.ctaBtn}
            </Link>

            <p className="mt-5 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {c.ctaNote}
              <a href="#demo-agent" className="underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {c.ctaNoteLink}
              </a>
              {c.ctaNote2}
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
