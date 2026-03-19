// ─── lib/i18n/ai-languages.ts ────────────────────────────────────────────────
// Centralized AI language configuration for all AI functions.
// This controls ONLY the AI output language (prompts, responses).
// UI translation (i18n) is separate (Pas 3).
// ─────────────────────────────────────────────────────────────────────────────

export type AILanguage = 'ro' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'nl' | 'pl' | 'hu' | 'bg' | 'cs' | 'el' | 'tr'

export const AI_LANGUAGES: Record<AILanguage, {
  name: string
  nativeName: string
  flag: string
  // Agent chat
  agentGreeting: string
  agentReturning: string
  agentPersonality: string
  agentRulesPrefix: string
  agentNoProduct: string
  agentEscalate: string
  agentBuyGuide: string
  agentOffTopic: string
  // Fallback messages (server-generated, outside GPT)
  orderNotFound: string
  productNotFound: string
  tryAgain: string
  talkToTeam: string
  // Quick replies defaults
  defaultQuickReplies: string[]
  // SEO
  seoExpertRole: string
  seoLanguageInstruction: string
  // Intelligence
  intelLanguageInstruction: string
  // Stopwords (top 30)
  stopWords: string[]
}> = {
  ro: {
    name: 'Romanian',
    nativeName: 'Română',
    flag: '🇷🇴',
    agentGreeting: 'Bună! Cu ce te pot ajuta?',
    agentReturning: 'Bună revenire! Cu ce te mai pot ajuta?',
    agentPersonality: 'Vorbești ca un prieten helpful, nu ca un robot. Limbaj cald, natural, scurt.',
    agentRulesPrefix: 'REGULI ABSOLUTE',
    agentNoProduct: 'Nu avem asta în stoc, dar pot să-ți sugerez ceva similar.',
    agentEscalate: 'Sigur! Te conectez cu echipa noastră acum.',
    agentBuyGuide: 'Apasă pe butonul "Adaugă în coș" de la produs și finalizezi comanda!',
    agentOffTopic: 'Nu pot ajuta cu asta, dar te pot ajuta cu produsele noastre!',
    orderNotFound: 'Nu am găsit comanda după "%s". Încearcă cu numărul exact al comenzii sau emailul folosit la comandă.',
    productNotFound: 'Nu am găsit "%s" în catalog. Cum altfel ai descrie ce cauți?',
    tryAgain: 'Încearcă din nou',
    talkToTeam: 'Vorbesc cu echipa',
    defaultQuickReplies: ['Caut un produs', 'Am o întrebare', 'Livrare & retur'],
    seoExpertRole: 'Ești un expert SEO senior specializat în eCommerce, cu cunoștințe avansate despre Google Search Quality Guidelines, E-E-A-T, și optimizarea pentru magazine online.',
    seoLanguageInstruction: 'Scrie TOT conținutul în limba ROMÂNĂ.',
    intelLanguageInstruction: 'Scrie în română, natural, concis dar util.',
    stopWords: ['pentru','care','este','sunt','caut','vreau','unui','ceva','unul','mai','din','sau','bun','buna','cel','cea','cele','unde','cum','cat','cand','daca','dar','ori','fie','nici','tot','doar','chiar','foarte','prea','un','una','la','cu','si','pe','de','in','prin','spre'],
  },
  en: {
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    agentGreeting: 'Hi! How can I help you?',
    agentReturning: 'Welcome back! How can I help you today?',
    agentPersonality: 'You speak like a helpful friend, not a robot. Warm, natural, concise language.',
    agentRulesPrefix: 'ABSOLUTE RULES',
    agentNoProduct: "We don't have that in stock, but I can suggest something similar.",
    agentEscalate: "Sure! I'm connecting you with our team right now.",
    agentBuyGuide: 'Click the "Add to Cart" button on the product and complete your order!',
    agentOffTopic: "I can't help with that, but I can help you with our products!",
    orderNotFound: 'Order not found for "%s". Try the exact order number or the email used at checkout.',
    productNotFound: '"%s" not found in our catalog. How else would you describe what you\'re looking for?',
    tryAgain: 'Try again',
    talkToTeam: 'Talk to the team',
    defaultQuickReplies: ['Looking for a product', 'I have a question', 'Shipping & returns'],
    seoExpertRole: 'You are a senior SEO expert specialized in eCommerce, with advanced knowledge of Google Search Quality Guidelines, E-E-A-T, and online store optimization.',
    seoLanguageInstruction: 'Write ALL content in ENGLISH.',
    intelLanguageInstruction: 'Write in English, natural, concise but useful.',
    stopWords: ['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','must','for','and','but','or','nor','not','so','yet','at','by','in','of','on','to','from','with','as','into','about','this','that','these','those','it','its'],
  },
  es: {
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    agentGreeting: '¡Hola! ¿En qué puedo ayudarte?',
    agentReturning: '¡Bienvenido de nuevo! ¿En qué puedo ayudarte hoy?',
    agentPersonality: 'Hablas como un amigo servicial, no como un robot. Lenguaje cálido, natural, conciso.',
    agentRulesPrefix: 'REGLAS ABSOLUTAS',
    agentNoProduct: 'No tenemos eso en stock, pero puedo sugerirte algo similar.',
    agentEscalate: '¡Claro! Te conecto con nuestro equipo ahora mismo.',
    agentBuyGuide: '¡Haz clic en el botón "Añadir al carrito" del producto y completa tu pedido!',
    agentOffTopic: 'No puedo ayudar con eso, ¡pero puedo ayudarte con nuestros productos!',
    orderNotFound: 'No encontré el pedido con "%s". Intenta con el número exacto del pedido o el email utilizado.',
    productNotFound: '"%s" no está en nuestro catálogo. ¿De qué otra forma describirías lo que buscas?',
    tryAgain: 'Intentar de nuevo',
    talkToTeam: 'Hablar con el equipo',
    defaultQuickReplies: ['Busco un producto', 'Tengo una pregunta', 'Envío y devoluciones'],
    seoExpertRole: 'Eres un experto SEO senior especializado en eCommerce, con conocimientos avanzados de Google Search Quality Guidelines, E-E-A-T, y optimización para tiendas online.',
    seoLanguageInstruction: 'Escribe TODO el contenido en ESPAÑOL.',
    intelLanguageInstruction: 'Escribe en español, natural, conciso pero útil.',
    stopWords: ['el','la','los','las','un','una','unos','unas','de','del','al','en','y','o','que','es','son','fue','ser','con','por','para','como','pero','si','no','más','este','esta','estos','estas','ese','esa','su','sus','se','le','lo','me','te','nos'],
  },
  fr: {
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    agentGreeting: 'Bonjour ! Comment puis-je vous aider ?',
    agentReturning: 'Content de vous revoir ! Comment puis-je vous aider ?',
    agentPersonality: "Vous parlez comme un ami serviable, pas comme un robot. Langage chaleureux, naturel, concis.",
    agentRulesPrefix: 'RÈGLES ABSOLUES',
    agentNoProduct: "Nous n'avons pas cela en stock, mais je peux vous suggérer quelque chose de similaire.",
    agentEscalate: 'Bien sûr ! Je vous connecte avec notre équipe maintenant.',
    agentBuyGuide: 'Cliquez sur le bouton "Ajouter au panier" du produit et finalisez votre commande !',
    agentOffTopic: "Je ne peux pas vous aider avec cela, mais je peux vous aider avec nos produits !",
    orderNotFound: 'Commande introuvable pour "%s". Essayez avec le numéro exact ou l\'email utilisé.',
    productNotFound: '"%s" n\'est pas dans notre catalogue. Comment décririez-vous autrement ce que vous cherchez ?',
    tryAgain: 'Réessayer',
    talkToTeam: 'Parler à l\'équipe',
    defaultQuickReplies: ['Je cherche un produit', "J'ai une question", 'Livraison & retours'],
    seoExpertRole: "Vous êtes un expert SEO senior spécialisé dans l'eCommerce, avec des connaissances avancées des directives Google, E-E-A-T, et l'optimisation pour les boutiques en ligne.",
    seoLanguageInstruction: 'Écrivez TOUT le contenu en FRANÇAIS.',
    intelLanguageInstruction: 'Écrivez en français, naturel, concis mais utile.',
    stopWords: ['le','la','les','un','une','des','de','du','au','aux','en','et','ou','que','est','sont','a','ont','pour','avec','sur','dans','par','ce','cette','ces','se','ne','pas','plus','son','sa','ses','leur','qui','mais','comme','tout'],
  },
  de: {
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    agentGreeting: 'Hallo! Wie kann ich Ihnen helfen?',
    agentReturning: 'Willkommen zurück! Wie kann ich Ihnen heute helfen?',
    agentPersonality: 'Sie sprechen wie ein hilfreicher Freund, nicht wie ein Roboter. Warme, natürliche, knappe Sprache.',
    agentRulesPrefix: 'ABSOLUTE REGELN',
    agentNoProduct: 'Das haben wir leider nicht auf Lager, aber ich kann etwas Ähnliches vorschlagen.',
    agentEscalate: 'Natürlich! Ich verbinde Sie jetzt mit unserem Team.',
    agentBuyGuide: 'Klicken Sie auf den "In den Warenkorb" Button beim Produkt und schließen Sie Ihre Bestellung ab!',
    agentOffTopic: 'Dabei kann ich leider nicht helfen, aber ich kann Ihnen bei unseren Produkten helfen!',
    orderNotFound: 'Bestellung "%s" nicht gefunden. Bitte die genaue Bestellnummer oder die verwendete E-Mail angeben.',
    productNotFound: '"%s" ist nicht in unserem Katalog. Wie würden Sie beschreiben, was Sie suchen?',
    tryAgain: 'Erneut versuchen',
    talkToTeam: 'Mit dem Team sprechen',
    defaultQuickReplies: ['Ich suche ein Produkt', 'Ich habe eine Frage', 'Versand & Rücksendung'],
    seoExpertRole: 'Sie sind ein erfahrener SEO-Experte für eCommerce mit fortgeschrittenen Kenntnissen der Google Search Quality Guidelines, E-E-A-T und der Optimierung für Online-Shops.',
    seoLanguageInstruction: 'Schreiben Sie ALLE Inhalte auf DEUTSCH.',
    intelLanguageInstruction: 'Schreibe auf Deutsch, natürlich, knapp aber nützlich.',
    stopWords: ['der','die','das','ein','eine','und','oder','ist','sind','war','hat','haben','für','mit','auf','von','zu','in','an','bei','den','dem','des','als','wie','aber','wenn','nicht','auch','noch','nur','so','sich','es','ich','sie','er','wir'],
  },
  it: {
    name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹',
    agentGreeting: 'Ciao! Come posso aiutarti?', agentReturning: 'Bentornato! Come posso aiutarti oggi?',
    agentPersonality: 'Parli come un amico disponibile, non come un robot. Linguaggio caldo, naturale, conciso.',
    agentRulesPrefix: 'REGOLE ASSOLUTE', agentNoProduct: 'Non abbiamo questo in stock, ma posso suggerirti qualcosa di simile.',
    agentEscalate: 'Certo! Ti collego con il nostro team adesso.',
    agentBuyGuide: 'Clicca sul pulsante "Aggiungi al carrello" del prodotto e completa il tuo ordine!',
    agentOffTopic: 'Non posso aiutarti con questo, ma posso aiutarti con i nostri prodotti!',
    orderNotFound: 'Ordine non trovato per "%s". Prova con il numero esatto o l\'email usata.',
    productNotFound: '"%s" non è nel nostro catalogo. Come descriveresti altrimenti quello che cerchi?',
    tryAgain: 'Riprova',
    talkToTeam: 'Parla con il team',
    defaultQuickReplies: ['Cerco un prodotto', 'Ho una domanda', 'Spedizione e resi'],
    seoExpertRole: "Sei un esperto SEO senior specializzato in eCommerce, con conoscenze avanzate delle Google Search Quality Guidelines, E-E-A-T.",
    seoLanguageInstruction: 'Scrivi TUTTO il contenuto in ITALIANO.',
    intelLanguageInstruction: 'Scrivi in italiano, naturale, conciso ma utile.',
    stopWords: ['il','lo','la','i','gli','le','un','una','di','del','della','in','e','o','che','è','sono','ha','per','con','su','da','non','come','ma','se','più','questo','questa','suo','sua'],
  },
  pt: {
    name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹',
    agentGreeting: 'Olá! Como posso ajudá-lo?', agentReturning: 'Bem-vindo de volta! Como posso ajudá-lo hoje?',
    agentPersonality: 'Você fala como um amigo prestativo, não como um robô. Linguagem calorosa, natural, concisa.',
    agentRulesPrefix: 'REGRAS ABSOLUTAS', agentNoProduct: 'Não temos isso em estoque, mas posso sugerir algo semelhante.',
    agentEscalate: 'Claro! Estou conectando você com nossa equipe agora.',
    agentBuyGuide: 'Clique no botão "Adicionar ao carrinho" do produto e finalize seu pedido!',
    agentOffTopic: 'Não posso ajudar com isso, mas posso ajudá-lo com nossos produtos!',
    orderNotFound: 'Pedido não encontrado para "%s". Tente o número exato ou o email utilizado.',
    productNotFound: '"%s" não está no nosso catálogo. Como descreveria o que procura?',
    tryAgain: 'Tentar novamente',
    talkToTeam: 'Falar com a equipa',
    defaultQuickReplies: ['Procuro um produto', 'Tenho uma pergunta', 'Envio e devoluções'],
    seoExpertRole: 'Você é um especialista SEO sênior especializado em eCommerce.',
    seoLanguageInstruction: 'Escreva TODO o conteúdo em PORTUGUÊS.',
    intelLanguageInstruction: 'Escreva em português, natural, conciso mas útil.',
    stopWords: ['o','a','os','as','um','uma','de','do','da','em','e','ou','que','é','são','para','com','por','como','mas','se','não','mais','este','esta','seu','sua','nos','ao'],
  },
  nl: {
    name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱',
    agentGreeting: 'Hallo! Hoe kan ik je helpen?', agentReturning: 'Welkom terug! Hoe kan ik je vandaag helpen?',
    agentPersonality: 'Je spreekt als een behulpzame vriend, niet als een robot. Warme, natuurlijke, beknopte taal.',
    agentRulesPrefix: 'ABSOLUTE REGELS', agentNoProduct: 'Dat hebben we helaas niet op voorraad, maar ik kan iets soortgelijks voorstellen.',
    agentEscalate: 'Natuurlijk! Ik verbind je nu met ons team.',
    agentBuyGuide: 'Klik op de knop "In winkelwagen" bij het product en rond je bestelling af!',
    agentOffTopic: 'Daar kan ik helaas niet mee helpen, maar ik kan je wel helpen met onze producten!',
    orderNotFound: 'Bestelling niet gevonden voor "%s". Probeer het exacte bestelnummer of het gebruikte e-mailadres.',
    productNotFound: '"%s" staat niet in onze catalogus. Hoe zou je anders omschrijven wat je zoekt?',
    tryAgain: 'Opnieuw proberen',
    talkToTeam: 'Met team praten',
    defaultQuickReplies: ['Ik zoek een product', 'Ik heb een vraag', 'Verzending & retour'],
    seoExpertRole: 'Je bent een senior SEO-expert gespecialiseerd in eCommerce.',
    seoLanguageInstruction: 'Schrijf ALLE inhoud in het NEDERLANDS.',
    intelLanguageInstruction: 'Schrijf in het Nederlands, natuurlijk, beknopt maar nuttig.',
    stopWords: ['de','het','een','van','in','en','of','is','zijn','was','heeft','voor','met','op','aan','bij','door','als','maar','niet','ook','nog','dan','dit','die','dat','ze','er','we','je'],
  },
  pl: {
    name: 'Polish', nativeName: 'Polski', flag: '🇵🇱',
    agentGreeting: 'Cześć! W czym mogę pomóc?', agentReturning: 'Witaj ponownie! W czym mogę dziś pomóc?',
    agentPersonality: 'Mówisz jak pomocny przyjaciel, nie jak robot. Ciepły, naturalny, zwięzły język.',
    agentRulesPrefix: 'ZASADY BEZWZGLĘDNE', agentNoProduct: 'Niestety nie mamy tego na stanie, ale mogę zaproponować coś podobnego.',
    agentEscalate: 'Oczywiście! Łączę Cię z naszym zespołem.',
    agentBuyGuide: 'Kliknij przycisk "Dodaj do koszyka" przy produkcie i dokończ zamówienie!',
    agentOffTopic: 'Nie mogę w tym pomóc, ale mogę pomóc z naszymi produktami!',
    orderNotFound: 'Zamówienie nie znalezione dla "%s". Spróbuj z dokładnym numerem lub użytym e-mailem.',
    productNotFound: '"%s" nie ma w naszym katalogu. Jak inaczej opisałbyś to, czego szukasz?',
    tryAgain: 'Spróbuj ponownie',
    talkToTeam: 'Porozmawiaj z zespołem',
    defaultQuickReplies: ['Szukam produktu', 'Mam pytanie', 'Dostawa i zwroty'],
    seoExpertRole: 'Jesteś starszym ekspertem SEO specjalizującym się w eCommerce.',
    seoLanguageInstruction: 'Napisz CAŁĄ treść po POLSKU.',
    intelLanguageInstruction: 'Pisz po polsku, naturalnie, zwięźle ale przydatnie.',
    stopWords: ['i','w','na','z','do','nie','się','to','jest','że','co','jak','ale','od','za','po','o','ten','ta','te','już','tak','lub','być','dla','ich','ze','są','ma','też'],
  },
  hu: {
    name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺',
    agentGreeting: 'Szia! Miben segíthetek?', agentReturning: 'Üdv újra! Miben segíthetek ma?',
    agentPersonality: 'Úgy beszélsz, mint egy segítőkész barát, nem mint egy robot.',
    agentRulesPrefix: 'FELTÉTLEN SZABÁLYOK', agentNoProduct: 'Ez sajnos nincs raktáron, de tudok hasonlót ajánlani.',
    agentEscalate: 'Persze! Most kapcsollak a csapatunkkal.',
    agentBuyGuide: 'Kattints a "Kosárba" gombra a terméknél és fejezd be a rendelésed!',
    agentOffTopic: 'Ebben sajnos nem tudok segíteni, de a termékeinkkel igen!',
    orderNotFound: 'Rendelés nem találva: "%s". Próbáld az pontos rendelési számmal vagy a megadott e-maillel.',
    productNotFound: '"%s" nem szerepel a katalógusban. Hogyan írnád le másképp, amit keresel?',
    tryAgain: 'Próbáld újra',
    talkToTeam: 'Csapathoz fordulás',
    defaultQuickReplies: ['Terméket keresek', 'Van egy kérdésem', 'Szállítás és visszaküldés'],
    seoExpertRole: 'Ön tapasztalt SEO szakértő, aki az eCommerce-re specializálódott.',
    seoLanguageInstruction: 'Írjon MINDEN tartalmat MAGYARUL.',
    intelLanguageInstruction: 'Írj magyarul, természetesen, tömören de hasznosam.',
    stopWords: ['a','az','és','vagy','de','nem','is','hogy','ez','egy','van','volt','lesz','meg','már','még','csak','mint','ha','fel','ki','be','el','le','után','alatt','között','sem','pedig','itt'],
  },
  bg: {
    name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬',
    agentGreeting: 'Здравейте! С какво мога да ви помогна?', agentReturning: 'Добре дошли отново! С какво мога да ви помогна днес?',
    agentPersonality: 'Говориш като полезен приятел, не като робот. Топъл, естествен, кратък език.',
    agentRulesPrefix: 'АБСОЛЮТНИ ПРАВИЛА', agentNoProduct: 'За съжаление нямаме това, но мога да предложа нещо подобно.',
    agentEscalate: 'Разбира се! Свързвам ви с екипа ни сега.',
    agentBuyGuide: 'Натиснете бутона "Добави в кошницата" на продукта и завършете поръчката!',
    agentOffTopic: 'Не мога да помогна с това, но мога да ви помогна с нашите продукти!',
    orderNotFound: 'Поръчка не намерена за "%s". Опитайте с точния номер или имейла, използван при поръчката.',
    productNotFound: '"%s" не е в нашия каталог. Как иначе бихте описали това, което търсите?',
    tryAgain: 'Опитай отново',
    talkToTeam: 'Разговор с екипа',
    defaultQuickReplies: ['Търся продукт', 'Имам въпрос', 'Доставка и връщане'],
    seoExpertRole: 'Вие сте старши SEO експерт, специализиран в eCommerce.',
    seoLanguageInstruction: 'Напишете ЦЯЛОТО съдържание на БЪЛГАРСКИ.',
    intelLanguageInstruction: 'Пишете на български, естествено, кратко но полезно.',
    stopWords: ['и','в','на','за','от','с','е','са','да','не','се','ще','по','до','като','но','или','при','след','без','този','тази','това','те','ги','му','й','ни','ви'],
  },
  cs: {
    name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿',
    agentGreeting: 'Ahoj! Jak vám mohu pomoci?', agentReturning: 'Vítejte zpět! Jak vám dnes mohu pomoci?',
    agentPersonality: 'Mluvíte jako přátelský pomocník, ne jako robot.',
    agentRulesPrefix: 'ABSOLUTNÍ PRAVIDLA', agentNoProduct: 'To bohužel nemáme, ale mohu navrhnout něco podobného.',
    agentEscalate: 'Samozřejmě! Spojím vás s naším týmem.',
    agentBuyGuide: 'Klikněte na tlačítko "Přidat do košíku" u produktu a dokončete objednávku!',
    agentOffTopic: 'S tím bohužel nemohu pomoci, ale mohu vám pomoci s našimi produkty!',
    orderNotFound: 'Objednávka nebyla nalezena pro "%s". Zkuste přesné číslo objednávky nebo použitý e-mail.',
    productNotFound: '"%s" není v našem katalogu. Jak byste jinak popsali, co hledáte?',
    tryAgain: 'Zkusit znovu',
    talkToTeam: 'Mluvit s týmem',
    defaultQuickReplies: ['Hledám produkt', 'Mám dotaz', 'Doprava a vrácení'],
    seoExpertRole: 'Jste senior SEO expert specializovaný na eCommerce.',
    seoLanguageInstruction: 'Napište VEŠKERÝ obsah v ČEŠTINĚ.',
    intelLanguageInstruction: 'Pište česky, přirozeně, stručně ale užitečně.',
    stopWords: ['a','v','na','je','se','z','do','to','s','o','i','k','jako','ale','pro','že','ne','po','od','co','být','ten','ta','jeho','její','které','nebo','jsou','by','už'],
  },
  el: {
    name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷',
    agentGreeting: 'Γεια! Πώς μπορώ να σε βοηθήσω;', agentReturning: 'Καλώς ήρθες ξανά! Πώς μπορώ να σε βοηθήσω σήμερα;',
    agentPersonality: 'Μιλάς σαν ένας εξυπηρετικός φίλος, όχι σαν ρομπότ.',
    agentRulesPrefix: 'ΑΠΟΛΥΤΟΙ ΚΑΝΟΝΕΣ', agentNoProduct: 'Δυστυχώς δεν το έχουμε, αλλά μπορώ να σου προτείνω κάτι παρόμοιο.',
    agentEscalate: 'Φυσικά! Σε συνδέω τώρα με την ομάδα μας.',
    agentBuyGuide: 'Κάνε κλικ στο "Προσθήκη στο καλάθι" και ολοκλήρωσε την παραγγελία!',
    agentOffTopic: 'Δεν μπορώ να βοηθήσω με αυτό, αλλά μπορώ να σε βοηθήσω με τα προϊόντα μας!',
    orderNotFound: 'Η παραγγελία δεν βρέθηκε για "%s". Δοκίμασε με τον ακριβή αριθμό ή το email που χρησιμοποίησες.',
    productNotFound: 'Το "%s" δεν υπάρχει στον κατάλογό μας. Πώς αλλιώς θα περιέγραφες αυτό που ψάχνεις;',
    tryAgain: 'Δοκίμασε ξανά',
    talkToTeam: 'Μίλα με την ομάδα',
    defaultQuickReplies: ['Ψάχνω προϊόν', 'Έχω μια ερώτηση', 'Αποστολή & επιστροφές'],
    seoExpertRole: 'Είστε ανώτερος ειδικός SEO εξειδικευμένος στο eCommerce.',
    seoLanguageInstruction: 'Γράψτε ΟΛΟ το περιεχόμενο στα ΕΛΛΗΝΙΚΑ.',
    intelLanguageInstruction: 'Γράψτε στα ελληνικά, φυσικά, συνοπτικά αλλά χρήσιμα.',
    stopWords: ['και','σε','με','από','για','το','τα','τη','την','του','της','των','ένα','μια','που','είναι','δεν','θα','να','αλλά','αν','ή','στο','στη','στα','αυτό','αυτή','αυτά','πολύ'],
  },
  tr: {
    name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷',
    agentGreeting: 'Merhaba! Size nasıl yardımcı olabilirim?', agentReturning: 'Tekrar hoş geldiniz! Bugün size nasıl yardımcı olabilirim?',
    agentPersonality: 'Yardımsever bir arkadaş gibi konuşursun, robot gibi değil.',
    agentRulesPrefix: 'MUTLAK KURALLAR', agentNoProduct: 'Maalesef bunu stoğumuzda yok, ama benzer bir şey önerebilirim.',
    agentEscalate: 'Tabii! Sizi şimdi ekibimize bağlıyorum.',
    agentBuyGuide: 'Üründeki "Sepete Ekle" butonuna tıklayın ve siparişinizi tamamlayın!',
    agentOffTopic: 'Bunda yardımcı olamam, ama ürünlerimizle yardımcı olabilirim!',
    orderNotFound: '"%s" için sipariş bulunamadı. Tam sipariş numarasını veya kullanılan e-postayı deneyin.',
    productNotFound: '"%s" kataloğumuzda yok. Aradığınızı başka nasıl tanımlarsınız?',
    tryAgain: 'Tekrar dene',
    talkToTeam: 'Ekiple konuş',
    defaultQuickReplies: ['Ürün arıyorum', 'Bir sorum var', 'Kargo ve iade'],
    seoExpertRole: 'eCommerce konusunda uzmanlaşmış kıdemli bir SEO uzmanısınız.',
    seoLanguageInstruction: 'TÜM içeriği TÜRKÇE yazın.',
    intelLanguageInstruction: 'Türkçe yazın, doğal, özlü ama faydalı.',
    stopWords: ['ve','bir','bu','da','de','ile','için','var','olan','den','dan','gibi','daha','en','ama','çok','ne','her','mi','mı','ya','hem','o','ben','sen','biz','siz','onlar','ise','ki'],
  },
}

// Helper: get language config with fallback to English
export function getAILanguage(lang: string | null | undefined): typeof AI_LANGUAGES.ro {
  const code = (lang || 'ro').toLowerCase().slice(0, 2) as AILanguage
  return AI_LANGUAGES[code] || AI_LANGUAGES.en
}

// Helper: get all supported languages for UI selector
export function getSupportedLanguages(): Array<{ code: AILanguage; name: string; nativeName: string; flag: string }> {
  return Object.entries(AI_LANGUAGES).map(([code, cfg]) => ({
    code: code as AILanguage,
    name: cfg.name,
    nativeName: cfg.nativeName,
    flag: cfg.flag,
  }))
}

// Country → Language mapping (most common)
export const COUNTRY_LANGUAGE_MAP: Record<string, AILanguage> = {
  RO: 'ro', MD: 'ro',
  US: 'en', GB: 'en', CA: 'en', AU: 'en', NZ: 'en', IE: 'en', ZA: 'en', IN: 'en', SG: 'en', PH: 'en',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', EC: 'es', VE: 'es', UY: 'es', PY: 'es', BO: 'es', CR: 'es', PA: 'es', DO: 'es', GT: 'es', HN: 'es', SV: 'es', NI: 'es', CU: 'es',
  FR: 'fr', BE: 'fr', CH: 'fr', LU: 'fr', MC: 'fr', SN: 'fr', CI: 'fr', ML: 'fr', BF: 'fr', NE: 'fr', TG: 'fr', BJ: 'fr', CM: 'fr', MG: 'fr', CD: 'fr', GA: 'fr', CG: 'fr', DJ: 'fr', HT: 'fr',
  DE: 'de', AT: 'de', LI: 'de',
  IT: 'it', SM: 'it', VA: 'it',
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt',
  NL: 'nl',
  PL: 'pl',
  HU: 'hu',
  BG: 'bg',
  CZ: 'cs', SK: 'cs',
  GR: 'el', CY: 'el',
  TR: 'tr',
}

export function getLanguageFromCountry(countryCode: string | null | undefined): AILanguage {
  if (!countryCode) return 'en'
  return COUNTRY_LANGUAGE_MAP[countryCode.toUpperCase()] || 'en'
}