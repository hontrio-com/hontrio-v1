import type { Metadata } from 'next'
import { getLocale } from '@/lib/i18n/server'
import { A, Box, Code, Company, H3, L, LegalPage, Mail, P, Table, UL, type LegalDoc } from '../legal-page'

// =============================================
// Politica de confidențialitate, în română și în engleză. Descrie ce face
// codul acum: ce citesc conectorii (Edinio, WooCommerce, Shopify), ce se
// păstrează din comenzi, datele Google (cu declarația Limited Use cerută la
// verificarea aplicației OAuth), furnizorii și termenele de ștergere.
// =============================================

const GOOGLE_POLICY = 'https://developers.google.com/terms/api-services-user-data-policy'
const LIMITED_USE = (
  <blockquote lang="en" className="border-l-2 border-neutral-900 pl-4 font-medium text-neutral-900">
    “Hontrio&apos;s use and transfer to any other app of information received from Google APIs will adhere to{' '}
    <A href={GOOGLE_POLICY}>Google API Services User Data Policy</A>, including the Limited Use requirements.”
  </blockquote>
)

const RO: LegalDoc = {
  title: 'Politica de confidențialitate',
  summary: <>Ce date prelucrează Hontrio, de unde le are, ce face cu ele, cui le dă, cât le păstrează și ce drepturi ai. Hontrio e un serviciu pentru firme: magazinele online își conectează magazinul și conturile Google Ads și Merchant Center, iar Hontrio le face și le îngrijește campaniile Google Shopping.</>,
  sections: [
    {
      id: 'cine-suntem', title: 'Cine suntem',
      body: <>
        <P>Operatorul datelor este:</P>
        <Company locale="ro" />
        <P>Nu suntem obligați să numim un responsabil cu protecția datelor (DPO). Pentru orice întrebare despre datele tale ne scrii la <Mail to="privacy@hontrio.com" />.</P>
      </>,
    },
    {
      id: 'pe-scurt', title: 'Pe scurt',
      body: <UL items={[
        'Folosim datele doar ca să funcționeze Hontrio: conectarea magazinului, campaniile, pilotul automat, rapoartele și recomandările.',
        'Nu vindem și nu închiriem date și nu le folosim pentru reclame, nici ale noastre, nici ale altora.',
        'Din comenzile magazinului nu păstrăm numele, e-mailul, telefonul sau adresele cumpărătorilor.',
        'Datele primite de la Google le folosim după regulile Google, inclusiv cerințele Limited Use (secțiunea 5).',
        'Baza de date și aplicația rulează în Uniunea Europeană, în Irlanda.',
        'Îți poți descărca datele și îți poți șterge contul din Setări, oricând.',
      ]} />,
    },
    {
      id: 'rolul-nostru', title: 'Rolul nostru',
      body: <>
        <P>Pentru datele contului tău, ale conexiunii Google, ale suportului, pentru datele tehnice și pentru analiza site-ului, Hontrio (VOID SFT GAMES SRL) este <strong>operator</strong>.</P>
        <P>Pentru datele cumpărătorilor din magazinul tău (comenzile), operatorul este magazinul, adică firma care folosește Hontrio, iar noi suntem <strong>persoană împuternicită</strong>: le prelucrăm doar după instrucțiunile magazinului, conform <L href="/legal/dpa">Acordului de prelucrare a datelor</L>. Dacă ești cumpărător într-un magazin care folosește Hontrio, adresează-ți cererile magazinului; noi îl ajutăm să-ți răspundă.</P>
        <P>Datele din conturile Google Ads și Merchant Center sunt în mare parte date despre firmă (campanii, costuri, produse), nu date personale. Le folosim doar ca să furnizăm serviciul.</P>
      </>,
    },
    {
      id: 'date', title: 'Ce date prelucrăm, de ce și pe ce temei',
      body: <>
        <Table head={['Date', 'De unde', 'De ce', 'Temeiul legal']} rows={[
          ['Contul: numele, adresa de e-mail, parola (păstrată doar ca hash), fotografia de profil, limba, preferințele de notificare, data creării, confirmarea adresei de e-mail, versiunea și data acceptării Termenilor', 'De la tine', 'Crearea și administrarea contului, furnizarea serviciului', 'Contractul (art. 6 alin. (1) lit. b) GDPR)'],
          ['Intrarea cu Google: numele, adresa de e-mail și fotografia din contul Google', 'De la Google, când alegi „Continuă cu Google”', 'Intrarea în cont fără parolă', 'Contractul'],
          ['Conexiunea Google Ads și Merchant Center: ID-ul contului Google, adresa lui de e-mail, permisiunile acordate și tokenul de acces, criptat', 'De la Google, când conectezi contul', 'Ca Hontrio să lucreze în conturile tale Google Ads și Merchant Center', 'Contractul'],
          ['Datele din Google Ads și Merchant Center (secțiunea 5)', 'Din conturile tale Google', 'Campaniile, pilotul automat, rapoartele și recomandările', 'Contractul'],
          ['Datele magazinului: produsele (titlu, preț, stoc, imagine, link, categorie, brand, coduri SKU, GTIN, MPN) și comenzile (doar câmpurile din secțiunea 6)', 'Din magazinul tău (Edinio, WooCommerce, Shopify)', 'Planul campaniilor, măsurarea vânzărilor aduse de reclame, rapoartele', 'Contractul; pentru datele cumpărătorilor, instrucțiunile magazinului (DPA)'],
          ['Suportul: subiectul, mesajele și fișierele atașate', 'De la tine', 'Ca să-ți răspundem și să rezolvăm problema', 'Contractul'],
          ['Notificările și e-mailurile: ce ți-am trimis și când', 'Generate de Hontrio', 'Ca să te anunțăm despre cont și despre campanii (secțiunea 9)', 'Contractul'],
          ['Date tehnice și de securitate: adresa IP, browserul, ora și rezultatul cererilor, erorile; la înregistrare, verificarea anti-roboți', 'Din browserul tău, automat', 'Siguranța serviciului, limitarea încercărilor repetate, investigarea abuzurilor și a erorilor', 'Interesul nostru legitim de a ține serviciul sigur (art. 6 alin. (1) lit. f) GDPR)'],
          ['Analiza traficului cu Google Analytics 4: paginile vizitate, sursa vizitei, dispozitivul și browserul, localizarea aproximativă, identificatorii din cookie-urile _ga', 'Din browserul tău, doar după ce accepți', 'Ca să înțelegem cum e folosit site-ul', 'Consimțământul tău (art. 6 alin. (1) lit. a) GDPR și art. 4 alin. (5) din Legea nr. 506/2004)'],
          ['Datele cerute de lege, de exemplu la cererea unei autorități', 'Din datele de mai sus', 'Respectarea obligațiilor legale', 'Obligația legală (art. 6 alin. (1) lit. c) GDPR)'],
        ]} />
        <P>Nu e obligatoriu să ne dai datele, dar fără datele contului și fără conectarea magazinului și a contului Google, Hontrio nu poate funcționa.</P>
      </>,
    },
    {
      id: 'google', title: 'Datele Google',
      body: <>
        <P>Când conectezi Google, îi dai lui Hontrio acces prin Google OAuth, cu permisiunile pe care le vezi pe ecranul Google: Google Ads (<Code>https://www.googleapis.com/auth/adwords</Code>), Merchant Center (<Code>https://www.googleapis.com/auth/content</Code>) și identitatea de bază a contului (<Code>openid</Code>, <Code>email</Code>).</P>
        <H3>Ce citim</H3>
        <UL items={[
          'Din Google Ads: conturile la care ai acces (ID, nume, monedă, fus orar, tipul contului), campaniile, bugetele și setările lor, conversiile configurate, cifrele zilnice pe campanie și pe produs (cost, clicuri, afișări, conversii, valoarea conversiilor) și termenii de căutare din ultimele 30 de zile.',
          'Din Merchant Center: starea produselor și problemele semnalate de Google, sursele de date, rapoartele de competitivitate a prețurilor, recomandările de preț și topul celor mai vândute produse.',
        ]} />
        <H3>Ce facem în numele tău</H3>
        <UL items={[
          <>În Google Ads: creăm campaniile Hontrio (Shopping sau Performance Max), cu bugetul, țara și limba lor; le schimbăm lista de produse, adăugăm cuvinte negative, le punem pe pauză, le repornim, le încheiem sau le mutăm pe Performance Max, după regulile din <L href="/legal/terms">Termeni</L>. La adresele reclamelor Hontrio adăugăm parametrii <Code>utm_source=google</Code>, <Code>utm_medium=cpc</Code> și <Code>utm_campaign=hontrio-ID</Code>, unde ID e numărul campaniei.</>,
          'Campaniile tale existente le schimbăm doar dacă alegi asta la lansare: le punem pe pauză pe cele care vând aceleași produse și completăm pe ele declarația privind publicitatea politică în UE, pe care o cere Google.',
          'În Merchant Center: creăm o sursă de date suplimentară numită „Hontrio”, o legăm de sursele tale de produse și scriem în ea o etichetă (custom label) pentru produsele scoase din campaniile Hontrio. Datele produselor din feedul tău nu le modificăm.',
        ]} />
        <H3>Cum folosim datele</H3>
        <P>Doar ca să-ți oferim și să îmbunătățim funcțiile pe care le vezi în Hontrio: campaniile, pilotul automat, rapoartele și recomandările pentru catalog. Nu le folosim ca să afișăm reclame, nu le vindem, nu le dăm brokerilor de date sau altor platforme de publicitate și nu le folosim pentru evaluarea bonității ori pentru credite.</P>
        <H3>Cine le vede</H3>
        <P>Oamenii din echipa Hontrio nu citesc datele tale Google, cu excepția situațiilor în care: ne ceri explicit, de exemplu într-un tichet de suport, și doar pentru datele la care te referi; e nevoie pentru securitate, cum ar fi investigarea unui abuz sau a unei erori; o cere legea; datele sunt agregate și anonimizate și le folosim pentru operațiunile interne, conform legii.</P>
        <H3>Cui le transferăm</H3>
        <P>Doar furnizorilor care găzduiesc și rulează Hontrio (secțiunea 7), cât e nevoie ca serviciul să funcționeze; autorităților, când legea o cere; unui eventual succesor, la o fuziune, o achiziție sau o vânzare de active, numai cu acordul tău prealabil.</P>
        <H3>Cum le păstrăm și cât timp</H3>
        <P>Tokenul Google e criptat (AES-256-GCM), iar datele stau în baza noastră de date din Irlanda, la care are acces doar serverul Hontrio. Cifrele, termenii de căutare, auditurile contului, rapoartele Merchant Center și jurnalul pilotului se păstrează 400 de zile, prin rotație.</P>
        <H3>Cum retragi accesul și cum ștergi datele</H3>
        <P>Deconectezi Google din Setări → Integrări: revocăm imediat accesul la Google și ștergem tokenul, iar datele aduse din Google se șterg după 30 de zile. Poți retrage accesul și din contul tău Google, la <A href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</A>. Dacă ștergi magazinul sau contul, datele lor se șterg imediat. Atenție: campaniile create de Hontrio rămân în contul tău Google Ads și rulează până le oprești.</P>
        <Box>
          <P>Declarația Limited Use, în forma cerută de Google:</P>
          {LIMITED_USE}
          <P>Pe înțeles: datele primite de la Google le folosim doar pentru funcțiile Hontrio pe care le vezi, nu le vindem, nu le folosim pentru reclame și nu le dăm altora, în afara cazurilor de mai sus.</P>
        </Box>
      </>,
    },
    {
      id: 'cumparatori', title: 'Datele cumpărătorilor din magazinul tău',
      body: <>
        <P>Aici suntem persoana împuternicită a magazinului (vezi <L href="/legal/dpa">Acordul de prelucrare a datelor</L>). Citim comenzile prin conexiunea cu magazinul și cerem doar câmpurile de care avem nevoie; dacă platforma trimite și alte date ale comenzii, nu le păstrăm.</P>
        <H3>Ce păstrăm din fiecare comandă</H3>
        <UL items={[
          'ID-ul și numărul comenzii, data plasării și a ultimei modificări, starea, starea plății și metoda de plată;',
          'moneda și sumele: subtotalul, transportul, reducerile, taxele, TVA-ul și totalul, plus codul de reducere folosit;',
          'țara cumpărătorului;',
          'sursa vizitei: identificatorul clicului pe reclamă (gclid, gbraid, wbraid), parametrii UTM, tipul sursei, domeniul site-ului de proveniență, pagina de intrare (fără parametri) și, unde există, tipul dispozitivului;',
          'produsele din comandă: produsul, varianta, cantitatea și prețul.',
        ]} />
        <H3>Ce nu păstrăm</H3>
        <P>Numele, adresa de e-mail, telefonul, adresele de livrare și de facturare, adresa IP, datele browserului și notele cumpărătorului.</P>
        <H3>De ce</H3>
        <P>Ca să știm ce vânzări au adus reclamele, ce produse se vând și ce merită pus în campanii, ca să-ți arătăm rapoartele și, după perioada de lansare, ca să calculăm taxa Hontrio din vânzările aduse de campaniile Hontrio (<L href="/legal/terms">Termeni</L>, articolul 9). Comenzile mai vechi de 400 de zile se șterg zilnic.</P>
        <P>Magazinul răspunde de informarea cumpărătorilor și, unde legea o cere, de obținerea acordului pentru cookie-urile și identificatorii de măsurare a reclamelor.</P>
      </>,
    },
    {
      id: 'furnizori', title: 'Cui dăm datele',
      body: <>
        <P>Nu vindem date. Le dăm doar furnizorilor de mai jos, care lucrează pentru noi pe bază de contract, cu obligații de confidențialitate și de securitate:</P>
        <Table head={['Furnizor', 'Ce face pentru Hontrio', 'Unde', 'Garanții pentru transfer']} rows={[
          ['Supabase', 'Baza de date, autentificarea, stocarea fișierelor', 'UE, Irlanda (AWS eu-west-1)', 'Datele stau în UE; pentru un eventual acces al furnizorului din afara SEE, clauzele contractuale standard'],
          ['Vercel', 'Găzduirea și rularea aplicației', 'UE, Irlanda (Dublin); paginile publice se livrează prin rețeaua globală a furnizorului', 'Clauzele contractuale standard sau cadrul UE–SUA privind protecția datelor (DPF)'],
          ['Resend', 'Trimiterea e-mailurilor', 'SUA', 'Clauzele contractuale standard sau DPF'],
          ['Upstash', 'Limitarea încercărilor repetate, după adresa IP', 'SUA / UE', 'Clauzele contractuale standard'],
          ['Google', 'Google Ads API și Merchant API (pentru conturile tale), intrarea cu Google, Google Analytics 4 (doar cu acordul tău)', 'UE și SUA', 'Clauzele contractuale standard sau DPF'],
          ['Cloudflare', 'Verificarea anti-roboți la înregistrare (Turnstile), când e activă', 'UE și SUA', 'Clauzele contractuale standard sau DPF'],
        ]} />
        <P>Edinio, WooCommerce și Shopify nu primesc date de la noi: sunt platformele din care citim, la cererea ta. Conturile Google Ads și Merchant Center sunt ale tale; în ele trimitem doar ce e descris în secțiunea 5.</P>
        <P>Mai putem dezvălui date autorităților, când legea ne obligă, și unui succesor, la o fuziune sau la vânzarea afacerii, cu anunțarea ta prealabilă (pentru datele Google, cu acordul tău).</P>
      </>,
    },
    {
      id: 'transferuri', title: 'Transferuri în afara Spațiului Economic European',
      body: <P>Unii furnizori sunt companii din SUA sau trimit date acolo (de exemplu Resend, pentru e-mailuri). Transferurile se fac doar cu garanțiile din capitolul V GDPR: decizia de adecvare pentru cadrul UE–SUA privind protecția datelor (Data Privacy Framework), pentru furnizorii certificați, sau clauzele contractuale standard aprobate de Comisia Europeană. Ne poți cere o copie a garanțiilor la <Mail to="privacy@hontrio.com" />.</P>,
    },
    {
      id: 'emailuri', title: 'E-mailurile pe care ți le trimitem',
      body: <>
        <UL items={[
          'Despre cont: confirmarea adresei de e-mail, resetarea parolei și mesajul de bun venit, după confirmare. Sunt necesare pentru cont și nu se pot opri.',
          'Alertele pilotului automat: oprirea de siguranță a unei campanii, o acțiune de protecție care n-a reușit sau pierderea accesului la Google și propunerile care îți așteaptă aprobarea. Le poți opri din Setări.',
        ]} />
        <P>Nu trimitem newslettere sau e-mailuri de marketing. Dacă vom începe, o vom face doar cu acordul tău și cu un link de dezabonare în fiecare mesaj.</P>
      </>,
    },
    {
      id: 'pastrare', title: 'Cât păstrăm datele',
      body: <>
        <Table head={['Date', 'Cât le păstrăm']} rows={[
          ['Contul și setările', 'Până ștergi contul'],
          ['Conturile cu adresa de e-mail neconfirmată', '7 zile, apoi se șterg'],
          ['Produsele și comenzile din magazin', 'Comenzile mai vechi de 400 de zile se șterg zilnic. Toate se șterg când scoți magazinul sau la 30 de zile după ce accesul la magazin a fost revocat ori aplicația a fost dezinstalată'],
          ['Datele aduse din Google (cifre, termeni de căutare, audituri, rapoarte Merchant Center, jurnalul pilotului)', '400 de zile, prin rotație; se șterg la 30 de zile după ce deconectezi Google'],
          ['Tokenul de acces Google', 'Până deconectezi Google sau ștergi contul; atunci se șterge imediat'],
          ['Tichetele de suport și fișierele atașate', '24 de luni după închiderea tichetului'],
          ['Notificările din aplicație', '12 luni'],
          ['Linkurile de confirmare și de resetare a parolei', 'Până expiră; cele expirate se șterg zilnic'],
          ['Jurnalele tehnice ale serverului', 'Cel mult 30 de zile'],
          ['Adresa IP folosită la limitarea încercărilor', 'Cel mult o oră'],
          ['Datele din Google Analytics', 'Conform setării de păstrare din Google Analytics, cel mult 14 luni'],
          ['Copiile de siguranță ale furnizorilor', 'Se rotesc în cel mult 30 de zile'],
        ]} />
        <P>Când îți ștergi contul, ștergem contul și toate datele legate de el: magazinele, cu produsele și comenzile lor, conexiunea Google (revocând și accesul la Google), campaniile și jurnalul din Hontrio, tichetele și notificările. Din copiile de siguranță ale furnizorilor dispar în cel mult 30 de zile. Păstrăm doar ce ne obligă legea să păstrăm.</P>
      </>,
    },
    {
      id: 'securitate', title: 'Securitatea datelor',
      body: <>
        <UL items={[
          'Toate conexiunile sunt criptate (HTTPS/TLS).',
          'Tokenurile Google, Shopify și Edinio și cheile API WooCommerce sunt criptate în baza de date (AES-256-GCM).',
          'Baza de date nu e accesibilă din browser: o citește și o scrie doar serverul Hontrio.',
          'Parolele sunt păstrate doar ca hash, de serviciul de autentificare.',
          'Confirmăm adresele de e-mail și limităm încercările repetate de autentificare și de înregistrare.',
          'Accesul echipei la date e limitat la ce e nevoie pentru suport și securitate.',
          'Furnizorul bazei de date face copii de siguranță.',
        ]} />
        <P>Dacă apare o încălcare a securității datelor, anunțăm ANSPDCP în cel mult 72 de ore, când legea o cere, și te anunțăm pe tine fără întârziere nejustificată dacă există un risc ridicat pentru drepturile tale. Incidentele care privesc datele primite de la Google le raportăm și la Google.</P>
      </>,
    },
    {
      id: 'drepturi', title: 'Drepturile tale',
      body: <>
        <P>Conform GDPR, ai dreptul:</P>
        <UL items={[
          'să afli ce date avem despre tine și să primești o copie (art. 15);',
          'să le corectezi (art. 16); numele și limba le schimbi direct în Setări;',
          'să le ștergi (art. 17); contul îl ștergi din Setări, oricând;',
          'să restricționezi prelucrarea (art. 18);',
          'să primești datele într-un format structurat și să le duci la alt furnizor (art. 20); exportul în format JSON e în Setări;',
          'să te opui prelucrării bazate pe interesul nostru legitim (art. 21);',
          'să-ți retragi oricând consimțământul, de exemplu pentru Google Analytics, din „Setări cookie”, fără să afecteze ce s-a făcut înainte.',
        ]} />
        <P>Pilotul automat ia decizii despre campanii și produse, nu despre oameni: nu facem profilarea cumpărătorilor și nu luăm decizii automate care să producă efecte juridice asupra ta (art. 22).</P>
        <P>Pentru orice cerere ne scrii la <Mail to="privacy@hontrio.com" />. Răspundem în cel mult o lună; la cererile complexe termenul se poate prelungi cu încă două luni, cu anunțarea ta. Putem să-ți cerem să confirmi că ești titularul contului.</P>
        <P>Ai și dreptul să depui o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP), B-dul G-ral. Gheorghe Magheru 28-30, Sector 1, cod poștal 010336, București, <A href="https://www.dataprotection.ro">www.dataprotection.ro</A>, <Mail to="anspdcp@dataprotection.ro" />, sau la autoritatea din țara în care locuiești ori lucrezi.</P>
      </>,
    },
    {
      id: 'minori', title: 'Minori',
      body: <P>Hontrio e pentru firme și pentru persoane de cel puțin 18 ani care acționează în numele lor. Nu colectăm cu bună știință date despre minori.</P>,
    },
    {
      id: 'modificari', title: 'Modificări',
      body: <P>Când schimbăm această politică în mod semnificativ, te anunțăm pe e-mail și în aplicație cu cel puțin 30 de zile înainte. Dacă vrem să folosim datele primite de la Google altfel decât e descris aici, îți cerem întâi acordul. Versiunile anterioare le poți cere la <Mail to="privacy@hontrio.com" />.</P>,
    },
    {
      id: 'contact', title: 'Contact',
      body: <P>Protecția datelor: <Mail to="privacy@hontrio.com" /> · suport: <Mail to="support@hontrio.com" /> · general: <Mail to="contact@hontrio.com" /> · telefon: +40 750 456 096 · adresa: sediul social din secțiunea 1. Despre cookie-uri citești în <L href="/legal/cookies">Politica de cookies</L>.</P>,
    },
  ],
}

const EN: LegalDoc = {
  title: 'Privacy Policy',
  summary: <>What data Hontrio processes, where it comes from, what we do with it, who we share it with, how long we keep it and what your rights are. Hontrio is a service for businesses: online stores connect their store and their Google Ads and Merchant Center accounts, and Hontrio builds and looks after their Google Shopping campaigns.</>,
  sections: [
    {
      id: 'who-we-are', title: 'Who we are',
      body: <>
        <P>The data controller is:</P>
        <Company locale="en" />
        <P>We are not required to appoint a data protection officer (DPO). For any question about your data, write to us at <Mail to="privacy@hontrio.com" />.</P>
      </>,
    },
    {
      id: 'summary', title: 'In short',
      body: <UL items={[
        'We use data only to run Hontrio: connecting the store, the campaigns, the autopilot, the reports and the recommendations.',
        'We do not sell or rent data, and we do not use it for advertising, ours or anyone else’s.',
        'From store orders we do not keep buyers’ names, emails, phone numbers or addresses.',
        'We use the data received from Google under Google’s rules, including the Limited Use requirements (section 5).',
        'The database and the application run in the European Union, in Ireland.',
        'You can download your data and delete your account from Settings at any time.',
      ]} />,
    },
    {
      id: 'our-role', title: 'Our role',
      body: <>
        <P>For your account data, your Google connection, support requests, technical data and website analytics, Hontrio (VOID SFT GAMES SRL) is the <strong>controller</strong>.</P>
        <P>For the data of your store’s buyers (the orders), the controller is the store, that is the business using Hontrio, and we are the <strong>processor</strong>: we process it only on the store’s instructions, under the <L href="/legal/dpa">Data Processing Agreement</L>. If you are a buyer in a store that uses Hontrio, send your requests to the store; we help it answer you.</P>
        <P>The data in Google Ads and Merchant Center accounts is mostly business data (campaigns, costs, products), not personal data. We use it only to provide the service.</P>
      </>,
    },
    {
      id: 'data', title: 'What data we process, why, and on what legal basis',
      body: <>
        <Table head={['Data', 'Source', 'Purpose', 'Legal basis']} rows={[
          ['Account: name, email address, password (kept only as a hash), profile picture, language, notification preferences, creation date, email confirmation, version and date of acceptance of the Terms', 'You', 'Creating and managing the account, providing the service', 'Contract (Art. 6(1)(b) GDPR)'],
          ['Sign-in with Google: the name, email address and picture of the Google account', 'Google, when you choose “Continue with Google”', 'Signing in without a password', 'Contract'],
          ['Google Ads and Merchant Center connection: the Google account ID, its email address, the permissions granted and the access token, encrypted', 'Google, when you connect the account', 'Letting Hontrio work in your Google Ads and Merchant Center accounts', 'Contract'],
          ['Data from Google Ads and Merchant Center (section 5)', 'Your Google accounts', 'Campaigns, autopilot, reports and recommendations', 'Contract'],
          ['Store data: products (title, price, stock, image, link, category, brand, SKU, GTIN and MPN codes) and orders (only the fields in section 6)', 'Your store (Edinio, WooCommerce, Shopify)', 'Campaign planning, measuring the sales brought by ads, reports', 'Contract; for buyers’ data, the store’s instructions (DPA)'],
          ['Support: subject, messages and attached files', 'You', 'Answering you and solving the issue', 'Contract'],
          ['Notifications and emails: what we sent you and when', 'Generated by Hontrio', 'Keeping you informed about your account and campaigns (section 9)', 'Contract'],
          ['Technical and security data: IP address, browser, time and result of requests, errors; at sign-up, the anti-bot check', 'Your browser, automatically', 'Keeping the service secure, limiting repeated attempts, investigating abuse and errors', 'Our legitimate interest in keeping the service secure (Art. 6(1)(f) GDPR)'],
          ['Traffic analytics with Google Analytics 4: pages visited, source of the visit, device and browser, approximate location, the identifiers in the _ga cookies', 'Your browser, only after you accept', 'Understanding how the site is used', 'Your consent (Art. 6(1)(a) GDPR and Art. 4(5) of Romanian Law no. 506/2004)'],
          ['Data required by law, for example at an authority’s request', 'The data above', 'Complying with legal obligations', 'Legal obligation (Art. 6(1)(c) GDPR)'],
        ]} />
        <P>You are not obliged to give us your data, but without the account data and without connecting the store and the Google account, Hontrio cannot work.</P>
      </>,
    },
    {
      id: 'google', title: 'Google data',
      body: <>
        <P>When you connect Google, you give Hontrio access through Google OAuth, with the permissions shown on Google’s screen: Google Ads (<Code>https://www.googleapis.com/auth/adwords</Code>), Merchant Center (<Code>https://www.googleapis.com/auth/content</Code>) and the account’s basic identity (<Code>openid</Code>, <Code>email</Code>).</P>
        <H3>What we read</H3>
        <UL items={[
          'From Google Ads: the accounts you can access (ID, name, currency, time zone, account type), campaigns, budgets and their settings, the configured conversions, daily figures per campaign and per product (cost, clicks, impressions, conversions, conversion value) and the search terms of the last 30 days.',
          'From Merchant Center: product statuses and the issues reported by Google, data sources, price competitiveness reports, price suggestions and the best-sellers ranking.',
        ]} />
        <H3>What we do on your behalf</H3>
        <UL items={[
          <>In Google Ads: we create Hontrio campaigns (Shopping or Performance Max) with their budget, country and language; we change their product list, add negative keywords, pause, resume, end or move them to Performance Max, under the rules in the <L href="/legal/terms">Terms</L>. To the URLs of Hontrio ads we add the parameters <Code>utm_source=google</Code>, <Code>utm_medium=cpc</Code> and <Code>utm_campaign=hontrio-ID</Code>, where ID is the campaign number.</>,
          'We change your existing campaigns only if you choose to at launch: we pause the ones selling the same products and fill in on them the EU political advertising declaration required by Google.',
          'In Merchant Center: we create a supplemental data source named “Hontrio”, link it to your product sources and write in it a label (custom label) for the products taken out of Hontrio campaigns. We do not change the product data in your feed.',
        ]} />
        <H3>How we use the data</H3>
        <P>Only to provide and improve the features you see in Hontrio: the campaigns, the autopilot, the reports and the catalog recommendations. We do not use it to serve ads, we do not sell it, we do not give it to data brokers or other advertising platforms, and we do not use it for creditworthiness or lending decisions.</P>
        <H3>Who sees it</H3>
        <P>People on the Hontrio team do not read your Google data, except when: you explicitly ask us to, for example in a support ticket, and only for the data you refer to; it is needed for security, such as investigating abuse or a bug; the law requires it; the data is aggregated and anonymized and used for internal operations, as the law allows.</P>
        <H3>Who we transfer it to</H3>
        <P>Only to the providers that host and run Hontrio (section 7), as far as needed for the service to work; to authorities, when the law requires it; to a possible successor in a merger, acquisition or sale of assets, only with your prior consent.</P>
        <H3>How we store it and for how long</H3>
        <P>The Google token is encrypted (AES-256-GCM), and the data sits in our database in Ireland, which only the Hontrio server can access. Figures, search terms, account audits, Merchant Center reports and the autopilot journal are kept for 400 days, on a rolling basis.</P>
        <H3>How to revoke access and delete the data</H3>
        <P>You disconnect Google in Settings → Integrations: we immediately revoke the access at Google and delete the token, and the data brought from Google is deleted after 30 days. You can also revoke the access from your Google account, at <A href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</A>. If you delete the store or the account, its data is deleted immediately. Note: the campaigns created by Hontrio stay in your Google Ads account and keep running until you stop them.</P>
        <Box>
          <P>The Limited Use disclosure, in the form required by Google:</P>
          {LIMITED_USE}
          <P>In plain words: we use the data received from Google only for the Hontrio features you see, we do not sell it, we do not use it for advertising and we do not give it to anyone else, except in the cases above.</P>
        </Box>
      </>,
    },
    {
      id: 'buyers', title: 'Data about your store’s buyers',
      body: <>
        <P>Here we are the store’s processor (see the <L href="/legal/dpa">Data Processing Agreement</L>). We read orders through the connection with the store and request only the fields we need; if the platform also sends other order data, we do not keep it.</P>
        <H3>What we keep from each order</H3>
        <UL items={[
          'the order ID and number, the date it was placed and last changed, its status, payment status and payment method;',
          'the currency and amounts: subtotal, shipping, discounts, fees, VAT and total, plus the discount code used;',
          'the buyer’s country;',
          'the source of the visit: the ad click identifier (gclid, gbraid, wbraid), UTM parameters, source type, the domain of the referring site, the landing page (without parameters) and, where available, the device type;',
          'the products in the order: product, variant, quantity and price.',
        ]} />
        <H3>What we do not keep</H3>
        <P>The buyer’s name, email address, phone number, shipping and billing addresses, IP address, browser data and notes.</P>
        <H3>Why</H3>
        <P>To know which sales the ads brought, which products sell and what is worth putting in campaigns, to show you the reports and, after the launch period, to work out the Hontrio fee from the sales brought by Hontrio campaigns (<L href="/legal/terms">Terms</L>, article 9). Orders older than 400 days are deleted daily.</P>
        <P>The store is responsible for informing its buyers and, where the law requires it, for obtaining consent for the cookies and identifiers used to measure ads.</P>
      </>,
    },
    {
      id: 'providers', title: 'Who we share data with',
      body: <>
        <P>We do not sell data. We share it only with the providers below, who work for us under contract, with confidentiality and security obligations:</P>
        <Table head={['Provider', 'What it does for Hontrio', 'Where', 'Transfer safeguards']} rows={[
          ['Supabase', 'Database, authentication, file storage', 'EU, Ireland (AWS eu-west-1)', 'Data stays in the EU; for any access by the provider from outside the EEA, the standard contractual clauses'],
          ['Vercel', 'Hosting and running the application', 'EU, Ireland (Dublin); public pages are delivered through the provider’s global network', 'Standard contractual clauses or the EU–US Data Privacy Framework (DPF)'],
          ['Resend', 'Sending emails', 'USA', 'Standard contractual clauses or DPF'],
          ['Upstash', 'Limiting repeated attempts, by IP address', 'USA / EU', 'Standard contractual clauses'],
          ['Google', 'Google Ads API and Merchant API (for your accounts), sign-in with Google, Google Analytics 4 (only with your consent)', 'EU and USA', 'Standard contractual clauses or DPF'],
          ['Cloudflare', 'Anti-bot check at sign-up (Turnstile), when enabled', 'EU and USA', 'Standard contractual clauses or DPF'],
        ]} />
        <P>Edinio, WooCommerce and Shopify do not receive data from us: they are the platforms we read from, at your request. The Google Ads and Merchant Center accounts are yours; we send to them only what is described in section 5.</P>
        <P>We may also disclose data to authorities, when the law obliges us, and to a successor in a merger or sale of the business, with prior notice to you (for Google data, with your consent).</P>
      </>,
    },
    {
      id: 'transfers', title: 'Transfers outside the European Economic Area',
      body: <P>Some providers are US companies or send data there (for example Resend, for emails). Transfers are made only with the safeguards of Chapter V GDPR: the adequacy decision for the EU–US Data Privacy Framework, for certified providers, or the standard contractual clauses approved by the European Commission. You can ask us for a copy of the safeguards at <Mail to="privacy@hontrio.com" />.</P>,
    },
    {
      id: 'emails', title: 'The emails we send you',
      body: <>
        <UL items={[
          'About your account: email address confirmation, password reset and the welcome message, after confirmation. They are needed for the account and cannot be turned off.',
          'Autopilot alerts: a campaign’s safety stop, a protective action that failed or lost access to Google, and proposals awaiting your approval. You can turn them off in Settings.',
        ]} />
        <P>We do not send newsletters or marketing emails. If we start, we will do it only with your consent and with an unsubscribe link in every message.</P>
      </>,
    },
    {
      id: 'retention', title: 'How long we keep data',
      body: <>
        <Table head={['Data', 'How long we keep it']} rows={[
          ['Account and settings', 'Until you delete the account'],
          ['Accounts with an unconfirmed email address', '7 days, then deleted'],
          ['Store products and orders', 'Orders older than 400 days are deleted daily. Everything is deleted when you remove the store, or 30 days after access to the store was revoked or the app was uninstalled'],
          ['Data brought from Google (figures, search terms, audits, Merchant Center reports, autopilot journal)', '400 days, on a rolling basis; deleted 30 days after you disconnect Google'],
          ['Google access token', 'Until you disconnect Google or delete the account; then it is deleted immediately'],
          ['Support tickets and attached files', '24 months after the ticket is closed'],
          ['In-app notifications', '12 months'],
          ['Confirmation and password reset links', 'Until they expire; expired ones are deleted daily'],
          ['Server technical logs', 'At most 30 days'],
          ['IP address used to limit attempts', 'At most one hour'],
          ['Google Analytics data', 'According to the retention setting in Google Analytics, at most 14 months'],
          ['Providers’ backups', 'Rotated within at most 30 days'],
        ]} />
        <P>When you delete your account, we delete the account and all data linked to it: the stores, with their products and orders, the Google connection (also revoking the access at Google), the campaigns and the journal in Hontrio, the tickets and the notifications. It disappears from the providers’ backups within at most 30 days. We keep only what the law obliges us to keep.</P>
      </>,
    },
    {
      id: 'security', title: 'Data security',
      body: <>
        <UL items={[
          'All connections are encrypted (HTTPS/TLS).',
          'Google, Shopify and Edinio tokens and WooCommerce API keys are encrypted in the database (AES-256-GCM).',
          'The database cannot be accessed from the browser: only the Hontrio server reads and writes it.',
          'Passwords are kept only as a hash, by the authentication service.',
          'We confirm email addresses and limit repeated sign-in and sign-up attempts.',
          'Team access to data is limited to what support and security need.',
          'The database provider makes backups.',
        ]} />
        <P>If a personal data breach occurs, we notify ANSPDCP within at most 72 hours when the law requires it, and we notify you without undue delay if there is a high risk to your rights. Incidents involving data received from Google are also reported to Google.</P>
      </>,
    },
    {
      id: 'rights', title: 'Your rights',
      body: <>
        <P>Under the GDPR, you have the right:</P>
        <UL items={[
          'to know what data we hold about you and to get a copy (Art. 15);',
          'to correct it (Art. 16); you change your name and language directly in Settings;',
          'to have it deleted (Art. 17); you delete the account from Settings, at any time;',
          'to restrict processing (Art. 18);',
          'to receive the data in a structured format and take it to another provider (Art. 20); the JSON export is in Settings;',
          'to object to processing based on our legitimate interest (Art. 21);',
          'to withdraw your consent at any time, for example for Google Analytics, from “Cookie settings”, without affecting what was done before.',
        ]} />
        <P>The autopilot makes decisions about campaigns and products, not about people: we do not profile buyers and we do not make automated decisions that produce legal effects on you (Art. 22).</P>
        <P>For any request, write to us at <Mail to="privacy@hontrio.com" />. We answer within one month; for complex requests the deadline may be extended by two more months, with notice to you. We may ask you to confirm that you are the account holder.</P>
        <P>You also have the right to lodge a complaint with the Romanian supervisory authority, ANSPDCP (Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal), B-dul G-ral. Gheorghe Magheru 28-30, Sector 1, postal code 010336, Bucharest, <A href="https://www.dataprotection.ro">www.dataprotection.ro</A>, <Mail to="anspdcp@dataprotection.ro" />, or with the authority of the country where you live or work.</P>
      </>,
    },
    {
      id: 'minors', title: 'Minors',
      body: <P>Hontrio is for businesses and for people aged 18 or over acting on their behalf. We do not knowingly collect data about minors.</P>,
    },
    {
      id: 'changes', title: 'Changes',
      body: <P>When we change this policy significantly, we notify you by email and in the app at least 30 days in advance. If we want to use the data received from Google differently from what is described here, we ask for your consent first. You can ask for previous versions at <Mail to="privacy@hontrio.com" />.</P>,
    },
    {
      id: 'contact', title: 'Contact',
      body: <P>Data protection: <Mail to="privacy@hontrio.com" /> · support: <Mail to="support@hontrio.com" /> · general: <Mail to="contact@hontrio.com" /> · phone: +40 750 456 096 · address: the registered office in section 1. Cookies are covered in the <L href="/legal/cookies">Cookie Policy</L>.</P>,
    },
  ],
}

export async function generateMetadata(): Promise<Metadata> {
  const ro = (await getLocale()) === 'ro'
  return {
    title: ro ? RO.title : EN.title,
    description: ro
      ? 'Ce date prelucrează Hontrio, de ce, cât le păstrează, cum folosește datele Google (Limited Use) și ce drepturi ai.'
      : 'What data Hontrio processes, why, how long it keeps it, how it uses Google data (Limited Use) and what your rights are.',
    alternates: { canonical: 'https://hontrio.com/legal/privacy' },
  }
}

export default async function PrivacyPage() {
  const locale = await getLocale()
  return <LegalPage kind="privacy" locale={locale} doc={locale === 'ro' ? RO : EN} contact="privacy@hontrio.com" />
}
