import type { Metadata } from 'next'
import { getLocale } from '@/lib/i18n/server'
import { Company, L, LegalPage, P, Table, UL, type LegalDoc } from '../legal-page'

// =============================================
// Acordul de prelucrare a datelor (art. 28 alin. (3) GDPR), în română și în
// engleză: Hontrio e persoana împuternicită a magazinului pentru datele
// cumpărătorilor din comenzi. Anexele spun ce se păstrează (lib/*/mapping.ts),
// măsurile de securitate și subîmputerniciții care ating aceste date.
// =============================================

const RO: LegalDoc = {
  title: 'Acordul de prelucrare a datelor',
  summary: <>Acordul încheiat conform art. 28 alin. (3) GDPR între firma care folosește Hontrio (operatorul) și VOID SFT GAMES SRL (persoana împuternicită), pentru datele cumpărătorilor pe care Hontrio le prelucrează în numele magazinului. Face parte din <L href="/legal/terms">Termeni</L> și se acceptă odată cu ei.</>,
  sections: [
    {
      id: 'parti', title: 'Părțile și rolurile',
      body: <>
        <P><strong>Operatorul</strong> este Clientul: firma care folosește Hontrio și își conectează magazinul. <strong>Persoana împuternicită</strong> este:</P>
        <Company locale="ro" />
        <P>Termenii folosiți aici au înțelesul din Regulamentul (UE) 2016/679 (GDPR).</P>
      </>,
    },
    {
      id: 'obiect', title: 'Obiectul și durata',
      body: <P>Persoana împuternicită prelucrează datele descrise în Anexa 1, în numele Operatorului, cât timp magazinul este conectat la Hontrio și până la ștergerea datelor după termenele din Anexa 1.</P>,
    },
    {
      id: 'instructiuni', title: 'Instrucțiunile Operatorului',
      body: <P>Prelucrăm datele doar după instrucțiunile documentate ale Operatorului: Termenii, acest Acord și alegerile făcute în Hontrio (conectarea magazinului, campaniile, setările pilotului automat). Nu folosim datele în alt scop. Dacă o instrucțiune ni se pare contrară legii, te anunțăm imediat. Dacă legea ne obligă să prelucrăm datele altfel, te anunțăm înainte, în afara cazului în care legea interzice asta.</P>,
    },
    {
      id: 'confidentialitate', title: 'Confidențialitatea',
      body: <P>Persoanele care au acces la date în numele nostru s-au angajat să păstreze confidențialitatea sau au o obligație legală de confidențialitate, iar accesul lor este limitat la ce au nevoie.</P>,
    },
    {
      id: 'securitate', title: 'Securitatea',
      body: <P>Aplicăm măsurile tehnice și organizatorice din Anexa 2 (art. 32 GDPR) și le actualizăm când este nevoie, fără să scădem nivelul de protecție.</P>,
    },
    {
      id: 'subimputerniciti', title: 'Subîmputerniciții',
      body: <P>Operatorul ne dă o autorizare generală să folosim subîmputerniciții din Anexa 3. Te anunțăm pe e-mail cu cel puțin 15 zile înainte de a adăuga sau de a înlocui unul; în acest timp te poți opune, motivat. Dacă nu găsim o soluție, poți înceta contractul fără costuri, înainte de schimbare. Fiecărui subîmputernicit îi impunem prin contract obligații de protecție a datelor echivalente cu cele din acest Acord și răspundem față de tine pentru el.</P>,
    },
    {
      id: 'drepturi', title: 'Cererile persoanelor vizate',
      body: <P>Ținând cont de natura prelucrării, te ajutăm să răspunzi cererilor cumpărătorilor (acces, rectificare, ștergere și celelalte): la cererea ta, îți trimitem sau ștergem datele unei comenzi, fără întârziere nejustificată, de regulă în cel mult 10 zile lucrătoare. Dacă un cumpărător ne contactează direct, îi transmitem cererea Operatorului.</P>,
    },
    {
      id: 'asistenta', title: 'Asistență pentru evaluări',
      body: <P>Îți dăm informațiile de care ai nevoie pentru evaluarea impactului asupra protecției datelor și pentru consultarea autorității de supraveghere, în legătură cu prelucrarea făcută de noi (art. 32-36 GDPR).</P>,
    },
    {
      id: 'incidente', title: 'Încălcarea securității datelor',
      body: <P>Te anunțăm fără întârziere nejustificată, în cel mult 48 de ore de când aflăm de o încălcare a securității care afectează datele magazinului tău, cu informațiile de la art. 33 alin. (3) GDPR pe care le avem atunci, și te ajutăm cu notificările către autoritate și către persoanele vizate.</P>,
    },
    {
      id: 'transferuri', title: 'Transferuri internaționale',
      body: <P>Datele Operatorului le păstrăm în Uniunea Europeană, în Irlanda. Le transferăm în afara Spațiului Economic European doar cu garanțiile din capitolul V GDPR: o decizie de adecvare sau clauzele contractuale standard ale Comisiei Europene.</P>,
    },
    {
      id: 'stergere', title: 'Ștergerea și returnarea datelor',
      body: <P>La încetarea contractului sau când scoți magazinul din Hontrio, ștergem datele magazinului; înainte le poți exporta din Setări. Termenele de ștergere sunt în Anexa 1; din copiile de siguranță ale furnizorilor, datele dispar în cel mult 30 de zile. Păstrăm date doar dacă legea ne obligă.</P>,
    },
    {
      id: 'audit', title: 'Informații și audit',
      body: <P>Îți punem la dispoziție informațiile necesare ca să demonstrezi respectarea art. 28 GDPR și răspundem la întrebările tale scrise despre prelucrare. Poți face sau mandata un audit, inclusiv o inspecție, cu un preaviz de cel puțin 30 de zile, cel mult o dată pe an (în afara cazurilor în care o cere o autoritate sau după o încălcare a securității datelor), pe cheltuiala ta și fără să afecteze securitatea și confidențialitatea altor clienți. Auditorul trebuie să fie obligat la confidențialitate.</P>,
    },
    {
      id: 'operator', title: 'Obligațiile Operatorului',
      body: <UL items={[
        'să aibă un temei legal pentru prelucrarea datelor cumpărătorilor și pentru transmiterea lor către Hontrio;',
        'să-și informeze cumpărătorii, în politica de confidențialitate a magazinului, că folosește un furnizor pentru măsurarea și administrarea reclamelor;',
        'să obțină, acolo unde legea o cere, acordul vizitatorilor pentru cookie-urile și identificatorii de măsurare a reclamelor (de exemplu gclid);',
        'să nu ne dea instrucțiuni contrare legii.',
      ]} />,
    },
    {
      id: 'final', title: 'Răspunderea, durata și legea',
      body: <P>Răspunderea părților se stabilește după art. 82 GDPR și după articolul 16 din Termeni. Acordul se aplică cât timp prelucrăm date în numele Operatorului. Pentru protecția datelor, acest Acord prevalează asupra Termenilor. Legea aplicabilă și instanța competentă sunt cele din Termeni.</P>,
    },
    {
      id: 'anexa-1', title: 'Anexa 1. Detaliile prelucrării',
      body: <Table head={['', 'Detalii']} rows={[
        ['Persoanele vizate', 'Cumpărătorii din magazinul Operatorului, inclusiv cei care au ajuns în magazin dintr-o reclamă'],
        ['Categoriile de date', 'ID-ul și numărul comenzii; data plasării și a ultimei modificări; starea comenzii, starea plății și metoda de plată; moneda și sumele (subtotal, transport, reduceri, taxe, TVA, total); codul de reducere; țara cumpărătorului; sursa vizitei: identificatorul clicului pe reclamă (gclid, gbraid, wbraid), parametrii UTM, tipul sursei, domeniul site-ului de proveniență, pagina de intrare fără parametri și, unde există, tipul dispozitivului; produsele comenzii (produs, variantă, cantitate, preț)'],
        ['Date care nu se păstrează', 'Numele, e-mailul, telefonul, adresele, adresa IP, datele browserului și notele cumpărătorului. Dacă platforma magazinului le trimite totuși în răspuns, ele trec doar prin memoria serverului, în timpul sincronizării, și nu se salvează'],
        ['Categorii speciale de date', 'Niciuna'],
        ['Natura prelucrării', 'Citirea automată prin conexiunea cu platforma magazinului, stocarea, structurarea, agregarea în rapoarte, folosirea pentru atribuirea vânzărilor și pentru deciziile pilotului automat, ștergerea'],
        ['Scopul', 'Măsurarea vânzărilor aduse de reclame, alegerea produselor puse în campanii, rapoartele din Hontrio și, după perioada de lansare, calculul taxei Hontrio din vânzările aduse de campaniile Hontrio (articolul 9 din Termeni)'],
        ['Frecvența', 'Continuă: sincronizare la fiecare 15 minute, plus o trecere completă pe zi'],
        ['Durata și ștergerea', 'Comenzile mai vechi de 400 de zile se șterg zilnic; toate datele magazinului se șterg când magazinul este scos din Hontrio sau la 30 de zile după ce accesul la magazin a fost revocat ori aplicația dezinstalată; la ștergerea contului, imediat; din copiile de siguranță, în cel mult 30 de zile'],
      ]} />,
    },
    {
      id: 'anexa-2', title: 'Anexa 2. Măsurile tehnice și organizatorice',
      body: <UL items={[
        'Criptarea conexiunilor (HTTPS/TLS).',
        'Criptarea în baza de date a tokenurilor și a cheilor de acces la magazine și la Google (AES-256-GCM).',
        'Baza de date în Uniunea Europeană (Irlanda), accesibilă doar serverului Hontrio; accesul public la tabele este închis.',
        'Separarea datelor pe cont și pe magazin: fiecare cerere verifică dreptul contului asupra magazinului.',
        'Minimizarea: cerem de la magazin doar câmpurile necesare și nu păstrăm datele de contact ale cumpărătorilor.',
        'Ștergerea automată, zilnică, după termenele din Anexa 1.',
        'Parole păstrate doar ca hash, confirmarea adresei de e-mail și limitarea încercărilor repetate.',
        'Acces intern limitat la persoanele care au nevoie, pentru suport și securitate.',
        'Copii de siguranță făcute de furnizorul bazei de date, rotite în cel mult 30 de zile.',
        'Jurnalizarea erorilor și o procedură de răspuns la incidente.',
      ]} />,
    },
    {
      id: 'anexa-3', title: 'Anexa 3. Subîmputerniciții',
      body: <>
        <Table head={['Subîmputernicit', 'Ce face', 'Unde']} rows={[
          ['Supabase', 'Baza de date, autentificarea și stocarea fișierelor', 'UE, Irlanda (AWS eu-west-1)'],
          ['Vercel', 'Găzduirea și rularea aplicației', 'UE, Irlanda (Dublin)'],
        ]} />
        <P>Ceilalți furnizori din <L href="/legal/privacy">Politica de confidențialitate</L> (de exemplu cel de e-mail) nu primesc datele cumpărătorilor.</P>
      </>,
    },
  ],
}

const EN: LegalDoc = {
  title: 'Data Processing Agreement',
  summary: <>The agreement under Art. 28(3) GDPR between the business using Hontrio (the controller) and VOID SFT GAMES SRL (the processor), for the buyers’ data Hontrio processes on the store’s behalf. It is part of the <L href="/legal/terms">Terms</L> and is accepted together with them.</>,
  sections: [
    {
      id: 'parties', title: 'The parties and their roles',
      body: <>
        <P>The <strong>Controller</strong> is the Customer: the business that uses Hontrio and connects its store. The <strong>Processor</strong> is:</P>
        <Company locale="en" />
        <P>Terms used here have the meaning given in Regulation (EU) 2016/679 (GDPR).</P>
      </>,
    },
    {
      id: 'subject', title: 'Subject matter and duration',
      body: <P>The Processor processes the data described in Annex 1 on the Controller’s behalf, for as long as the store is connected to Hontrio and until the data is deleted within the periods in Annex 1.</P>,
    },
    {
      id: 'instructions', title: 'The Controller’s instructions',
      body: <P>We process the data only on the Controller’s documented instructions: the Terms, this Agreement and the choices made in Hontrio (connecting the store, the campaigns, the autopilot settings). We do not use the data for any other purpose. If an instruction seems unlawful to us, we tell you immediately. If the law obliges us to process the data differently, we tell you first, unless the law forbids it.</P>,
    },
    {
      id: 'confidentiality', title: 'Confidentiality',
      body: <P>The people with access to the data on our behalf have committed to confidentiality or are under a statutory obligation of confidentiality, and their access is limited to what they need.</P>,
    },
    {
      id: 'security', title: 'Security',
      body: <P>We apply the technical and organizational measures in Annex 2 (Art. 32 GDPR) and update them when needed, without lowering the level of protection.</P>,
    },
    {
      id: 'sub-processors', title: 'Sub-processors',
      body: <P>The Controller gives us a general authorization to use the sub-processors in Annex 3. We notify you by email at least 15 days before adding or replacing one; during this time you may object, with reasons. If we cannot find a solution, you can end the contract at no cost before the change. We bind each sub-processor by contract to data protection obligations equivalent to those in this Agreement, and we remain liable to you for it.</P>,
    },
    {
      id: 'data-subjects', title: 'Data subject requests',
      body: <P>Taking into account the nature of the processing, we help you answer buyers’ requests (access, rectification, erasure and the others): at your request, we send you or delete the data of an order, without undue delay and as a rule within at most 10 business days. If a buyer contacts us directly, we forward the request to the Controller.</P>,
    },
    {
      id: 'assistance', title: 'Assistance with assessments',
      body: <P>We give you the information you need for a data protection impact assessment and for consulting the supervisory authority, regarding the processing we carry out (Art. 32-36 GDPR).</P>,
    },
    {
      id: 'breaches', title: 'Personal data breaches',
      body: <P>We notify you without undue delay, within at most 48 hours of becoming aware of a breach affecting your store’s data, with the information in Art. 33(3) GDPR available at that time, and we help you with the notifications to the authority and to the data subjects.</P>,
    },
    {
      id: 'transfers', title: 'International transfers',
      body: <P>We keep the Controller’s data in the European Union, in Ireland. We transfer it outside the European Economic Area only with the safeguards of Chapter V GDPR: an adequacy decision or the European Commission’s standard contractual clauses.</P>,
    },
    {
      id: 'deletion', title: 'Deletion and return of data',
      body: <P>When the contract ends or when you remove the store from Hontrio, we delete the store’s data; before that, you can export it from Settings. The deletion periods are in Annex 1; data disappears from the providers’ backups within at most 30 days. We keep data only if the law obliges us to.</P>,
    },
    {
      id: 'audit', title: 'Information and audits',
      body: <P>We make available the information needed to demonstrate compliance with Art. 28 GDPR and answer your written questions about the processing. You may carry out or mandate an audit, including an inspection, with at least 30 days’ notice, at most once a year (except when an authority requires it or after a personal data breach), at your expense and without affecting the security and confidentiality of other customers. The auditor must be bound by confidentiality.</P>,
    },
    {
      id: 'controller', title: 'The Controller’s obligations',
      body: <UL items={[
        'to have a legal basis for processing the buyers’ data and for passing it to Hontrio;',
        'to inform its buyers, in the store’s privacy policy, that it uses a provider to measure and manage its ads;',
        'to obtain, where the law requires it, visitors’ consent for the cookies and identifiers used to measure ads (for example gclid);',
        'not to give us unlawful instructions.',
      ]} />,
    },
    {
      id: 'final', title: 'Liability, term and governing law',
      body: <P>The parties’ liability is determined under Art. 82 GDPR and article 16 of the Terms. The Agreement applies for as long as we process data on the Controller’s behalf. For data protection matters, this Agreement prevails over the Terms. The governing law and the competent court are those in the Terms.</P>,
    },
    {
      id: 'annex-1', title: 'Annex 1. Details of the processing',
      body: <Table head={['', 'Details']} rows={[
        ['Data subjects', 'The buyers of the Controller’s store, including those who reached the store from an ad'],
        ['Categories of data', 'Order ID and number; date placed and last changed; order status, payment status and payment method; currency and amounts (subtotal, shipping, discounts, fees, VAT, total); discount code; the buyer’s country; source of the visit: the ad click identifier (gclid, gbraid, wbraid), UTM parameters, source type, the domain of the referring site, the landing page without parameters and, where available, the device type; the order’s products (product, variant, quantity, price)'],
        ['Data not kept', 'The buyer’s name, email, phone number, addresses, IP address, browser data and notes. If the store’s platform still sends them in a response, they only pass through the server’s memory during the sync and are not saved'],
        ['Special categories of data', 'None'],
        ['Nature of the processing', 'Automatic reading through the connection with the store’s platform, storage, structuring, aggregation into reports, use for sales attribution and for the autopilot’s decisions, erasure'],
        ['Purpose', 'Measuring the sales brought by ads, choosing the products put in campaigns, the reports in Hontrio and, after the launch period, working out the Hontrio fee from the sales brought by Hontrio campaigns (article 9 of the Terms)'],
        ['Frequency', 'Continuous: a sync every 15 minutes, plus one full pass a day'],
        ['Duration and deletion', 'Orders older than 400 days are deleted daily; all store data is deleted when the store is removed from Hontrio, or 30 days after access to the store was revoked or the app uninstalled; when the account is deleted, immediately; from backups, within at most 30 days'],
      ]} />,
    },
    {
      id: 'annex-2', title: 'Annex 2. Technical and organizational measures',
      body: <UL items={[
        'Encrypted connections (HTTPS/TLS).',
        'Encryption in the database of the tokens and access keys for stores and Google (AES-256-GCM).',
        'Database in the European Union (Ireland), accessible only to the Hontrio server; public access to tables is closed.',
        'Data separated by account and by store: every request checks the account’s right to the store.',
        'Minimization: we request only the necessary fields from the store and do not keep buyers’ contact details.',
        'Automatic daily deletion, within the periods in Annex 1.',
        'Passwords kept only as a hash, email address confirmation and limits on repeated attempts.',
        'Internal access limited to the people who need it, for support and security.',
        'Backups made by the database provider, rotated within at most 30 days.',
        'Error logging and an incident response procedure.',
      ]} />,
    },
    {
      id: 'annex-3', title: 'Annex 3. Sub-processors',
      body: <>
        <Table head={['Sub-processor', 'What it does', 'Where']} rows={[
          ['Supabase', 'Database, authentication and file storage', 'EU, Ireland (AWS eu-west-1)'],
          ['Vercel', 'Hosting and running the application', 'EU, Ireland (Dublin)'],
        ]} />
        <P>The other providers in the <L href="/legal/privacy">Privacy Policy</L> (for example the email provider) do not receive buyers’ data.</P>
      </>,
    },
  ],
}

export async function generateMetadata(): Promise<Metadata> {
  const ro = (await getLocale()) === 'ro'
  return {
    title: ro ? RO.title : EN.title,
    description: ro
      ? 'Acordul de prelucrare a datelor (art. 28 GDPR) dintre magazin și Hontrio, cu datele păstrate, măsurile de securitate și subîmputerniciții.'
      : 'The data processing agreement (Art. 28 GDPR) between the store and Hontrio, with the data kept, the security measures and the sub-processors.',
    alternates: { canonical: 'https://hontrio.com/legal/dpa' },
  }
}

export default async function DpaPage() {
  const locale = await getLocale()
  return <LegalPage kind="dpa" locale={locale} doc={locale === 'ro' ? RO : EN} contact="privacy@hontrio.com" />
}
