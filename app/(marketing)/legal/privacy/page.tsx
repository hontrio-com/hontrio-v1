'use client'

import { useState, useEffect } from 'react'
import { motion, useReducedMotion, type MotionProps } from 'framer-motion'
import { Shield, ArrowUp, Mail, ExternalLink } from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

// ─── Dates ────────────────────────────────────────────────────────────────────

const DATE_RO = '28 martie 2026'
const DATE_EN = 'March 28, 2026'
const VERSION = '1.0'

// ─── Shared sub-components ────────────────────────────────────────────────────

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-neutral-600 leading-relaxed mb-3 last:mb-0">{children}</p>
)
const UL = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5 my-3">
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-600 leading-relaxed">
        <span className="mt-1.5 h-1 w-1 rounded-full bg-neutral-400 shrink-0" />
        {item}
      </li>
    ))}
  </ul>
)
const Sub = ({ num, title, children }: { num: string; title?: string; children: React.ReactNode }) => (
  <div className="mb-5">
    <p className="text-sm font-semibold text-neutral-800 mb-2">{num}{title ? ` ${title}` : ''}</p>
    <div className="text-sm text-neutral-600 leading-relaxed">{children}</div>
  </div>
)
const CompanyCard = ({ isRO }: { isRO: boolean }) => (
  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-700 space-y-1 my-3">
    <p className="font-semibold">SC VOID SFT GAMES SRL</p>
    <p>{isRO ? 'CUI' : 'Tax ID'}: 43474393</p>
    <p>{isRO ? 'Nr. Reg. Com.' : 'Trade Reg. No.'}: J18/1054/2020</p>
    <p>EUID: ROONRC.J18/1054/2020</p>
    <p>{isRO ? 'Sediu social' : 'Registered office'}: Str. Progresului 2, Bl. A29, Sc. 2, Et. 2, Ap. 10, Sat Matasari, Jud. Gorj, {isRO ? 'Cod Postal' : 'Postal Code'} 217295, Romania</p>
    <p>{isRO ? 'Telefon' : 'Phone'}: 0750 456 096</p>
    <p>{isRO ? 'Email general' : 'General email'}: contact@hontrio.com</p>
    <p>{isRO ? 'Email protectia datelor' : 'Data protection email'}: privacy@hontrio.com</p>
  </div>
)
const RetentionTable = ({ isRO }: { isRO: boolean }) => {
  const rows = isRO ? [
    ['Date cont activ (profil, setari, credite)', 'Pe durata contractului + 30 zile dupa reziliere', 'Executarea contractului'],
    ['Date de facturare si documente fiscale', '10 ani de la emitere', 'Obligatie legala (Codul Fiscal roman)'],
    ['Jurnale de securitate (logs)', '12 luni', 'Interes legitim (securitate)'],
    ['Date de utilizare agregata si anonimizata', 'Nelimitat (nu mai sunt date personale)', 'N/A'],
    ['Comunicari suport', '3 ani de la inchiderea tichetului', 'Interes legitim (gestionarea disputelor)'],
    ['Date marketing (daca ai consimtit)', 'Pana la retragerea consimtamantului', 'Consimtamant'],
    ['Date cont inchis', '30 zile pentru recuperare, apoi stergere', 'Executarea contractului'],
  ] : [
    ['Active account data (profile, settings, credits)', 'For the contract duration + 30 days after termination', 'Contract performance'],
    ['Billing data and tax documents', '10 years from issuance', 'Legal obligation (Romanian Tax Code)'],
    ['Security logs', '12 months', 'Legitimate interest (security)'],
    ['Aggregated and anonymized usage data', 'Unlimited (no longer personal data)', 'N/A'],
    ['Support communications', '3 years from ticket closure', 'Legitimate interest (dispute management)'],
    ['Marketing data (if you consented)', 'Until consent withdrawal', 'Consent'],
    ['Closed account data', '30 days for recovery, then deletion', 'Contract performance'],
  ]
  const headers = isRO
    ? ['Categoria de date', 'Perioada de retentie', 'Temeiul']
    : ['Data category', 'Retention period', 'Legal basis']
  return (
    <div className="overflow-x-auto my-4 rounded-xl border border-neutral-200">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="bg-neutral-50 border-b border-neutral-200">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold text-neutral-700 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 text-neutral-600 align-top leading-relaxed border-b border-neutral-100 last:border-b-0">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
const SubprocessorsTable = ({ isRO }: { isRO: boolean }) => {
  const rows = [
    ['Supabase Inc.', isRO ? 'Infrastructura baze de date si autentificare' : 'Database infrastructure and authentication', 'SUA', 'EU-US Data Privacy Framework'],
    ['Vercel Inc.', isRO ? 'Hosting si livrare aplicatie' : 'Hosting and application delivery', 'SUA', 'EU-US Data Privacy Framework'],
    ['OpenAI LLC', isRO ? 'Modele AI pentru generare text si embeddings' : 'AI models for text generation and embeddings', 'SUA', 'EU-US Data Privacy Framework'],
    ['Stripe Inc.', isRO ? 'Procesare plati si facturare' : 'Payment processing and invoicing', 'SUA', 'EU-US Data Privacy Framework'],
    ['Resend Inc.', isRO ? 'Trimitere emailuri tranzactionale' : 'Transactional email delivery', 'SUA', isRO ? 'Clauze Contractuale Standard' : 'Standard Contractual Clauses'],
  ]
  const headers = isRO
    ? ['Furnizor', 'Rol', 'Sediu', 'Mecanism de transfer']
    : ['Provider', 'Role', 'Location', 'Transfer mechanism']
  return (
    <div className="overflow-x-auto my-4 rounded-xl border border-neutral-200">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="bg-neutral-50 border-b border-neutral-200">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold text-neutral-700 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}>
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2.5 text-neutral-600 align-top leading-relaxed border-b border-neutral-100 last:border-b-0 ${j === 0 ? 'font-medium text-neutral-800' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Section definitions ──────────────────────────────────────────────────────

interface Section { id: string; number: string; title: string; content: React.ReactNode }

function buildSections(isRO: boolean): Section[] {
  return [
    {
      id: 's1',
      number: isRO ? 'Sectiunea 1' : 'Section 1',
      title: isRO ? 'Cine suntem (Operatorul de date)' : 'Who we are (Data Controller)',
      content: (
        <>
          <P>{isRO
            ? 'Conform Art. 13 alin. 1 lit. a GDPR, Operatorul de date cu caracter personal este:'
            : 'Pursuant to Art. 13(1)(a) GDPR, the Controller of personal data is:'}
          </P>
          <CompanyCard isRO={isRO} />
          <P>{isRO
            ? 'Hontrio nu a desemnat un Responsabil cu Protectia Datelor (DPO) in sensul Art. 37 GDPR, activitatile de prelucrare neimplicand monitorizarea sistematica la scara larga a persoanelor fizice. Pentru orice intrebare legata de protectia datelor, te rugam sa contactezi adresa privacy@hontrio.com.'
            : 'Hontrio has not designated a Data Protection Officer (DPO) within the meaning of Art. 37 GDPR, as processing activities do not involve systematic large-scale monitoring of natural persons. For any questions related to data protection, please contact privacy@hontrio.com.'}
          </P>
        </>
      ),
    },
    {
      id: 's2',
      number: isRO ? 'Sectiunea 2' : 'Section 2',
      title: isRO ? 'Despre ce date vorbim si de unde provin' : 'What data we process and where it comes from',
      content: (
        <>
          <P>{isRO
            ? 'Hontrio prelucreaza doua categorii distincte de date personale, cu roluri diferite.'
            : 'Hontrio processes two distinct categories of personal data, with different roles.'}
          </P>
          <Sub num="2.1" title={isRO ? 'Date pe care ni le furnizezi direct:' : 'Data you provide directly:'}>
            <p className="text-sm text-neutral-700 font-medium mb-1">{isRO ? 'La inregistrare si utilizarea contului:' : 'At registration and account use:'}</p>
            <UL items={isRO ? [
              'Nume si prenume (ale reprezentantului entitatii)',
              'Adresa de email profesionala',
              'Numarul de telefon (optional)',
              'Denumirea companiei si datele de facturare (CUI, adresa, cont bancar)',
              'Parola (stocata exclusiv in forma hash-uita, ireversibil)',
              'Preferintele de configurare ale contului',
            ] : [
              'Name and surname (of the entity\'s representative)',
              'Professional email address',
              'Phone number (optional)',
              'Company name and billing data (tax ID, address, bank account)',
              'Password (stored exclusively in irreversible hashed form)',
              'Account configuration preferences',
            ]} />
            <p className="text-sm text-neutral-700 font-medium mb-1 mt-3">{isRO ? 'Prin utilizarea Platformei:' : 'Through Platform use:'}</p>
            <UL items={isRO ? [
              'Date de utilizare: functionalitati accesate, credite consumate, setari configurate',
              'Date tehnice: adresa IP, tipul browserului, sistemul de operare, rezolutia ecranului',
              'Jurnale de activitate (logs) pentru securitate si depanare tehnica',
              'Comunicarile cu echipa Hontrio prin email sau chat de suport',
            ] : [
              'Usage data: features accessed, credits consumed, settings configured',
              'Technical data: IP address, browser type, operating system, screen resolution',
              'Activity logs for security and technical troubleshooting',
              'Communications with the Hontrio team via email or support chat',
            ]} />
          </Sub>
          <Sub num="2.2" title={isRO ? 'Date provenind din Magazinul conectat:' : 'Data from the connected Store:'}>
            <P>{isRO
              ? 'Prin conectarea platformei tale de comert electronic la Hontrio, ne transmiti date care pot include date personale ale clientilor tai (cumparatori): nume, adrese de livrare, adrese de email, numere de telefon, istoricul comenzilor, valori tranzactii, metode de plata.'
              : 'By connecting your e-commerce platform to Hontrio, you transmit data that may include personal data of your customers (buyers): names, delivery addresses, email addresses, phone numbers, order history, transaction values, payment methods.'}
            </P>
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-600 leading-relaxed">
              <span className="font-semibold text-neutral-800">{isRO ? 'Important: ' : 'Important: '}</span>
              {isRO
                ? 'Pentru aceste date, Hontrio actioneaza exclusiv ca Imputernicit al tau (tu esti Operatorul), conform Art. 28 GDPR. Prelucrarea lor de catre Hontrio este guvernata de Acordul de Prelucrare a Datelor (DPA), nu de prezenta Politica de Confidentialitate. Prezenta Politica se aplica exclusiv datelor tale personale ca utilizator al Platformei.'
                : 'For this data, Hontrio acts exclusively as your Processor (you are the Controller), pursuant to Art. 28 GDPR. Its processing by Hontrio is governed by the Data Processing Agreement (DPA), not by this Privacy Policy. This Privacy Policy applies exclusively to your personal data as a Platform user.'}
            </div>
          </Sub>
          <Sub num="2.3" title={isRO ? 'Date pe care le colectam automat:' : 'Data we collect automatically:'}>
            <UL items={isRO ? [
              'Cookie-uri tehnice necesare functionarii Platformei',
              'Date de sesiune pentru mentinerea starii autentificarii',
              'Date de performanta tehnica pentru monitorizarea stabilitatii',
            ] : [
              'Technical cookies necessary for Platform operation',
              'Session data to maintain authentication state',
              'Technical performance data for stability monitoring',
            ]} />
          </Sub>
        </>
      ),
    },
    {
      id: 's3',
      number: isRO ? 'Sectiunea 3' : 'Section 3',
      title: isRO ? 'De ce prelucram datele tale si pe ce baza legala' : 'Why we process your data and on what legal basis',
      content: (
        <>
          <P>{isRO
            ? 'Conform Art. 13 alin. 1 lit. c si d GDPR, fiecare activitate de prelucrare trebuie sa aiba un scop clar si o baza legala.'
            : 'Pursuant to Art. 13(1)(c) and (d) GDPR, each processing activity must have a clear purpose and a legal basis.'}
          </P>
          <Sub num="3.1" title={isRO ? 'Executarea contractului (Art. 6 alin. 1 lit. b GDPR)' : 'Contract performance (Art. 6(1)(b) GDPR)'}>
            <UL items={isRO ? [
              'Crearea si gestionarea contului tau pe Platforma',
              'Furnizarea Serviciilor contractate: generare imagini AI, optimizare SEO, agent de conversatie, analiza risc comenzi',
              'Procesarea platilor si emiterea facturilor',
              'Comunicarea cu tine privind functionarea contului, actualizari ale Serviciilor, intreruperi planificate',
            ] : [
              'Creating and managing your account on the Platform',
              'Providing the contracted Services: AI image generation, SEO optimization, conversation agent, order risk analysis',
              'Processing payments and issuing invoices',
              'Communicating with you about account operation, Service updates, planned outages',
            ]} />
            <P>{isRO
              ? 'Fara aceste prelucrari, nu putem furniza Serviciile. Refuzul furnizarii datelor necesare executarii contractului duce la imposibilitatea crearii sau mentinerii contului.'
              : 'Without these processing activities, we cannot provide the Services. Refusal to provide data necessary for contract performance leads to the inability to create or maintain an account.'}
            </P>
          </Sub>
          <Sub num="3.2" title={isRO ? 'Interesul legitim al Hontrio (Art. 6 alin. 1 lit. f GDPR)' : 'Legitimate interest of Hontrio (Art. 6(1)(f) GDPR)'}>
            <UL items={isRO ? [
              'Securitatea Platformei si prevenirea accesului neautorizat — interes legitim: protejarea integritatii sistemelor si a datelor tuturor utilizatorilor',
              'Detectarea si prevenirea fraudelor si abuzurilor — interes legitim: protejarea Platformei si a utilizatorilor sai',
              'Analiza agregata si anonimizata a utilizarii Platformei pentru imbunatatirea Serviciilor — interes legitim: dezvoltarea si optimizarea produsului',
              'Trimiterea de comunicari operationale privind modificari ale Termenilor sau ale functionalitatilor — interes legitim: informarea corecta a utilizatorilor',
            ] : [
              'Platform security and prevention of unauthorized access — legitimate interest: protecting the integrity of systems and all users\' data',
              'Detection and prevention of fraud and abuse — legitimate interest: protecting the Platform and its users',
              'Aggregated and anonymized analysis of Platform usage to improve Services — legitimate interest: product development and optimization',
              'Sending operational communications about Terms or feature changes — legitimate interest: properly informing users',
            ]} />
            <P>{isRO
              ? 'Pentru aceste prelucrari, ai dreptul de a obiecta in orice moment. Vom evalua obiectia ta si vom inceta prelucrarea daca interesele sau drepturile tale fundamentale prevaleaza.'
              : 'For these processing activities, you have the right to object at any time. We will evaluate your objection and cease processing if your interests or fundamental rights prevail.'}
            </P>
          </Sub>
          <Sub num="3.3" title={isRO ? 'Obligatie legala (Art. 6 alin. 1 lit. c GDPR)' : 'Legal obligation (Art. 6(1)(c) GDPR)'}>
            <UL items={isRO ? [
              'Pastrarea documentelor contabile si fiscale conform legislatiei romane (Legea contabilitatii nr. 82/1991, Codul Fiscal)',
              'Raspunsul la solicitarile autoritatilor publice competente (instante, ANSPDCP, autoritati fiscale) in conditiile legii',
            ] : [
              'Keeping accounting and tax records pursuant to Romanian legislation (Accounting Law no. 82/1991, Tax Code)',
              'Responding to requests from competent public authorities (courts, ANSPDCP, tax authorities) under the law',
            ]} />
          </Sub>
          <Sub num="3.4" title={isRO ? 'Consimtamantul tau (Art. 6 alin. 1 lit. a GDPR)' : 'Your consent (Art. 6(1)(a) GDPR)'}>
            <UL items={isRO ? [
              'Trimiterea de newslettere si comunicari de marketing privind noi functionalitati, oferte sau continut educational',
              'Utilizarea cookie-urilor de analiza si marketing (detalii in Politica de Cookie-uri)',
            ] : [
              'Sending newsletters and marketing communications about new features, offers or educational content',
              'Using analytics and marketing cookies (details in the Cookie Policy)',
            ]} />
            <P>{isRO
              ? 'Consimtamantul poate fi retras oricand, fara nicio consecinta asupra accesului tau la Servicii, prin accesarea sectiunii de preferinte din contul tau sau prin trimiterea unui email la privacy@hontrio.com.'
              : 'Consent may be withdrawn at any time without any consequence on your access to the Services, by accessing the preferences section in your account or by sending an email to privacy@hontrio.com.'}
            </P>
          </Sub>
        </>
      ),
    },
    {
      id: 's4',
      number: isRO ? 'Sectiunea 4' : 'Section 4',
      title: isRO ? 'Cat timp pastram datele tale' : 'How long we retain your data',
      content: (
        <>
          <P>{isRO
            ? 'Conform principiului limitarii stocarii (Art. 5 alin. 1 lit. e GDPR), pastram datele tale numai atat timp cat este necesar scopului pentru care au fost colectate.'
            : 'Pursuant to the storage limitation principle (Art. 5(1)(e) GDPR), we retain your data only for as long as necessary for the purpose for which it was collected.'}
          </P>
          <RetentionTable isRO={isRO} />
          <P>{isRO
            ? 'La expirarea perioadei de retentie aplicabile, datele sunt sterse definitiv sau anonimizate ireversibil, cu exceptia cazurilor in care o obligatie legala impune pastrarea lor pe o perioada mai lunga.'
            : 'Upon expiry of the applicable retention period, data is permanently deleted or irreversibly anonymized, except in cases where a legal obligation requires retention for a longer period.'}
          </P>
        </>
      ),
    },
    {
      id: 's5',
      number: isRO ? 'Sectiunea 5' : 'Section 5',
      title: isRO ? 'Cu cine impartasim datele tale' : 'Who we share your data with',
      content: (
        <>
          <P>{isRO
            ? 'Nu vindem, nu inchiriem si nu comercializam datele tale personale. Le impartasim exclusiv in urmatoarele situatii:'
            : 'We do not sell, rent or commercialize your personal data. We share it exclusively in the following situations:'}
          </P>
          <Sub num="5.1" title={isRO ? 'Subprocesori:' : 'Sub-processors:'}>
            <P>{isRO
              ? 'Hontrio utilizeaza urmatorii subprocesori principali, cu care am incheiat acorduri de prelucrare a datelor conforme cu Art. 28 GDPR:'
              : 'Hontrio uses the following main sub-processors, with whom we have concluded data processing agreements compliant with Art. 28 GDPR:'}
            </P>
            <SubprocessorsTable isRO={isRO} />
            <P>{isRO
              ? 'Te vom notifica prin email cu minimum 10 zile inainte de adaugarea oricarui subprocesor nou care proceseaza date personale ale utilizatorilor.'
              : 'We will notify you by email at least 10 days before adding any new sub-processor that processes users\' personal data.'}
            </P>
          </Sub>
          <Sub num="5.2" title={isRO ? 'Autoritati publice:' : 'Public authorities:'}>
            {isRO
              ? 'Putem dezvalui date personale autoritatilor publice competente exclusiv in conditiile impuse de legislatia aplicabila si numai in masura strict necesara. In limita posibilitatilor legale, te vom notifica despre astfel de solicitari.'
              : 'We may disclose personal data to competent public authorities exclusively under the conditions imposed by applicable legislation and only to the extent strictly necessary. To the extent legally possible, we will notify you of such requests.'}
          </Sub>
          <Sub num="5.3" title={isRO ? 'Succesori in cadrul restructurarilor corporative:' : 'Successors in corporate restructurings:'}>
            {isRO
              ? 'In cazul unei fuziuni, achizitii sau vanzari a activelor Hontrio, datele personale pot fi transferate catre entitatea succesoare, cu conditia ca aceasta sa respecte cel putin acelasi nivel de protectie garantat prin prezenta Politica. Vei fi notificat in prealabil.'
              : 'In the event of a merger, acquisition or sale of Hontrio\'s assets, personal data may be transferred to the successor entity, provided it respects at least the same level of protection guaranteed by this Policy. You will be notified in advance.'}
          </Sub>
          <Sub num="5.4" title={isRO ? 'Cu consimtamantul tau explicit:' : 'With your explicit consent:'}>
            {isRO
              ? 'In orice alte situatii decat cele mentionate mai sus, impartasim datele tale cu terti exclusiv cu consimtamantul tau prealabil, explicit si informat.'
              : 'In any situations other than those mentioned above, we share your data with third parties exclusively with your prior, explicit and informed consent.'}
          </Sub>
        </>
      ),
    },
    {
      id: 's6',
      number: isRO ? 'Sectiunea 6' : 'Section 6',
      title: isRO ? 'Transferuri internationale de date' : 'International data transfers',
      content: (
        <>
          <P>{isRO
            ? 'Unii dintre subprocesorii nostri sunt stabiliti in Statele Unite ale Americii. Aceste transferuri sunt efectuate cu respectarea garantiilor prevazute de GDPR, in principal prin aderarea furnizorilor la EU-US Data Privacy Framework (cadrul de adecvare adoptat de Comisia Europeana) sau, acolo unde acesta nu este aplicabil, prin Clauze Contractuale Standard aprobate de Comisia Europeana conform Art. 46 alin. 2 lit. c GDPR.'
            : 'Some of our sub-processors are established in the United States of America. These transfers are carried out in compliance with the safeguards provided by GDPR, primarily through providers\' adherence to the EU-US Data Privacy Framework (the adequacy framework adopted by the European Commission) or, where this is not applicable, through Standard Contractual Clauses approved by the European Commission pursuant to Art. 46(2)(c) GDPR.'}
          </P>
          <P>{isRO
            ? 'Nu transferam date personale catre tari din afara SEE care nu beneficiaza de o decizie de adecvare si pentru care nu au fost implementate garantii adecvate conform GDPR.'
            : 'We do not transfer personal data to countries outside the EEA that do not benefit from an adequacy decision and for which adequate safeguards in accordance with GDPR have not been implemented.'}
          </P>
        </>
      ),
    },
    {
      id: 's7',
      number: isRO ? 'Sectiunea 7' : 'Section 7',
      title: isRO ? 'Drepturile tale' : 'Your rights',
      content: (
        <>
          <P>{isRO
            ? 'Conform GDPR, beneficiezi de urmatoarele drepturi in legatura cu datele tale personale. Le poti exercita oricand prin email la privacy@hontrio.com sau prin functiile disponibile direct in contul tau.'
            : 'Pursuant to GDPR, you benefit from the following rights regarding your personal data. You can exercise them at any time by email at privacy@hontrio.com or through the features available directly in your account.'}
          </P>
          {(isRO ? [
            { num: '7.1', title: 'Dreptul de acces (Art. 15 GDPR)', text: 'Ai dreptul de a obtine confirmarea ca prelucram date personale despre tine si, daca da, de a primi o copie a acestor date, impreuna cu informatii despre scopurile prelucrarii, categoriile de date, destinatarii si perioada de retentie.' },
            { num: '7.2', title: 'Dreptul la rectificare (Art. 16 GDPR)', text: 'Daca datele tale sunt inexacte sau incomplete, ai dreptul de a solicita corectarea sau completarea lor. Poti actualiza direct majoritatea datelor din sectiunea de profil a contului tau.' },
            { num: '7.3', title: 'Dreptul la stergere (Art. 17 GDPR)', text: 'Poti solicita stergerea datelor tale personale atunci cand: nu mai sunt necesare scopului pentru care au fost colectate, ti-ai retras consimtamantul, sau ai obiectat la prelucrare si nu exista interese legitime prevalente. Stergerea nu este posibila pentru datele pe care suntem obligati sa le pastram prin lege (ex: documente fiscale).' },
            { num: '7.4', title: 'Dreptul la restrictionarea prelucrarii (Art. 18 GDPR)', text: 'Poti solicita restrictionarea prelucrarii datelor tale in situatii specifice: daca contesti exactitatea datelor (pe durata verificarii), daca prelucrarea este ilegala dar preferi restrictionarea in locul stergerii, sau daca ai formulat o obiectie (pe durata evaluarii acesteia).' },
            { num: '7.5', title: 'Dreptul la portabilitate (Art. 20 GDPR)', text: 'Pentru datele prelucrate pe baza contractului sau consimtamantului si prin mijloace automate, ai dreptul de a le primi intr-un format structurat, utilizat in mod curent si prelucrabil automat (ex: JSON, CSV) si de a le transmite unui alt operator. Poti exporta datele contului tau direct din sectiunea dedicata sau prin solicitarea la privacy@hontrio.com.' },
            { num: '7.6', title: 'Dreptul de a obiecta (Art. 21 GDPR)', text: 'Poti obiecta oricand la prelucrarea datelor tale efectuata pe baza interesului legitim al Hontrio, inclusiv la prelucrarea in scopuri de marketing direct. In cazul obiectiei la marketing direct, incetam imediat prelucrarea fara a evalua interesele concurente.' },
            { num: '7.7', title: 'Dreptul de a nu face obiectul unei decizii automate (Art. 22 GDPR)', text: 'Hontrio nu ia decizii exclusiv automatizate cu efecte juridice semnificative asupra ta. Scorurile de risc calculate de modulul Risk Shield pentru clientii Magazinului tau sunt analize oferite tie ca utilizator al Platformei, iar decizia finala ti apartine intotdeauna.' },
            { num: '7.8', title: 'Dreptul de a retrage consimtamantul', text: 'Daca prelucrarea se bazeaza pe consimtamantul tau, il poti retrage oricand fara nicio consecinta asupra accesului la Servicii (cu exceptia functionalitatilor care depind exclusiv de consimtamant, ex: primirea newsletterului).' },
          ] : [
            { num: '7.1', title: 'Right of access (Art. 15 GDPR)', text: 'You have the right to obtain confirmation that we process personal data about you and, if so, to receive a copy of that data, together with information about the purposes of processing, data categories, recipients and retention period.' },
            { num: '7.2', title: 'Right to rectification (Art. 16 GDPR)', text: 'If your data is inaccurate or incomplete, you have the right to request its correction or completion. You can directly update most data from the profile section of your account.' },
            { num: '7.3', title: 'Right to erasure (Art. 17 GDPR)', text: 'You may request deletion of your personal data when: it is no longer necessary for the purpose for which it was collected, you have withdrawn your consent, or you have objected to processing and there are no overriding legitimate interests. Deletion is not possible for data we are legally required to retain (e.g., tax documents).' },
            { num: '7.4', title: 'Right to restriction of processing (Art. 18 GDPR)', text: 'You may request restriction of processing of your data in specific situations: if you contest the accuracy of the data (during verification), if processing is unlawful but you prefer restriction to deletion, or if you have raised an objection (during its evaluation).' },
            { num: '7.5', title: 'Right to data portability (Art. 20 GDPR)', text: 'For data processed on the basis of contract or consent and by automated means, you have the right to receive it in a structured, commonly used and machine-readable format (e.g., JSON, CSV) and to transmit it to another controller. You can export your account data directly from the dedicated section or by requesting it at privacy@hontrio.com.' },
            { num: '7.6', title: 'Right to object (Art. 21 GDPR)', text: 'You may object at any time to the processing of your data carried out on the basis of Hontrio\'s legitimate interest, including processing for direct marketing purposes. In the case of objection to direct marketing, we immediately cease processing without evaluating competing interests.' },
            { num: '7.7', title: 'Right not to be subject to automated decision-making (Art. 22 GDPR)', text: 'Hontrio does not make exclusively automated decisions with significant legal effects on you. Risk scores calculated by the Risk Shield module for your Store\'s customers are analytical tools offered to you as a Platform user, and the final decision always belongs to you.' },
            { num: '7.8', title: 'Right to withdraw consent', text: 'If processing is based on your consent, you may withdraw it at any time without any consequence on your access to the Services (except for features that depend exclusively on consent, e.g., receiving the newsletter).' },
          ]).map(({ num, title, text }) => (
            <Sub key={num} num={num} title={title}>{text}</Sub>
          ))}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-600 mt-2">
            <p className="font-semibold text-neutral-800 mb-1">{isRO ? 'Termen de raspuns' : 'Response time'}</p>
            {isRO
              ? 'Vom raspunde solicitarilor tale in termen de maximum 30 de zile calendaristice de la primire. In cazuri complexe, termenul poate fi extins cu inca 60 de zile, cu notificarea ta prealabila si justificarea intarzierii. Pentru protectia ta, putem solicita verificarea identitatii inainte de a procesa anumite solicitari.'
              : 'We will respond to your requests within a maximum of 30 calendar days from receipt. In complex cases, the deadline may be extended by another 60 days, with prior notice and justification for the delay. For your protection, we may request identity verification before processing certain requests.'}
          </div>
        </>
      ),
    },
    {
      id: 's8',
      number: isRO ? 'Sectiunea 8' : 'Section 8',
      title: isRO ? 'Dreptul de a depune o plangere' : 'Right to lodge a complaint',
      content: (
        <>
          <P>{isRO
            ? 'Daca consideri ca prelucrarea datelor tale personale incalca GDPR sau legislatia romana aplicabila, ai dreptul de a depune o plangere la autoritatea de supraveghere competenta:'
            : 'If you believe that the processing of your personal data violates GDPR or applicable Romanian legislation, you have the right to lodge a complaint with the competent supervisory authority:'}
          </P>
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-700 space-y-1 my-3">
            <p className="font-semibold">{isRO ? 'In Romania:' : 'In Romania:'}</p>
            <p>Autoritatea Nationala de Supraveghere a Prelucrarii Datelor cu Caracter Personal (ANSPDCP)</p>
            <p>B-dul G-ral. Gheorghe Magheru 28-30, Sector 1, Bucuresti 010336</p>
            <p>{isRO ? 'Telefon' : 'Phone'}: +40.318.059.211</p>
            <p>Email: anspdcp@dataprotection.ro</p>
            <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-neutral-900 hover:underline font-medium">
              www.dataprotection.ro <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <P>{isRO
            ? 'In orice alt stat membru UE: poti depune plangerea la autoritatea de supraveghere din statul tau de rezidenta sau de la locul de munca.'
            : 'In any other EU member state: you may lodge the complaint with the supervisory authority in your country of residence or place of work.'}
          </P>
          <P>{isRO
            ? 'Inainte de a apela la autoritatea de supraveghere, te incurajam sa ne contactezi la privacy@hontrio.com, astfel incat sa putem rezolva situatia direct si rapid.'
            : 'Before approaching the supervisory authority, we encourage you to contact us at privacy@hontrio.com, so that we can resolve the situation directly and quickly.'}
          </P>
        </>
      ),
    },
    {
      id: 's9',
      number: isRO ? 'Sectiunea 9' : 'Section 9',
      title: isRO ? 'Cookie-uri si tehnologii similare' : 'Cookies and similar technologies',
      content: (
        <>
          <Sub num="9.1" title={isRO ? 'Ce sunt cookie-urile:' : 'What cookies are:'}>
            {isRO
              ? 'Cookie-urile sunt fisiere text de mici dimensiuni stocate in browserul tau atunci cand accesezi Platforma. Le folosim pentru a asigura functionarea corecta a Platformei si, cu consimtamantul tau, pentru a analiza utilizarea acesteia.'
              : 'Cookies are small text files stored in your browser when you access the Platform. We use them to ensure the correct operation of the Platform and, with your consent, to analyze its use.'}
          </Sub>
          <Sub num="9.2" title={isRO ? 'Categorii de cookie-uri utilizate:' : 'Categories of cookies used:'}>
            <p className="text-sm font-semibold text-neutral-800 mb-1">{isRO ? 'Cookie-uri strict necesare (nu necesita consimtamant):' : 'Strictly necessary cookies (no consent required):'}</p>
            <UL items={isRO ? [
              'Cookie de sesiune pentru mentinerea starii de autentificare',
              'Cookie CSRF pentru protectia impotriva atacurilor de tip cross-site request forgery',
              'Cookie pentru preferintele de limba si afisare',
            ] : [
              'Session cookie to maintain authentication state',
              'CSRF cookie for protection against cross-site request forgery attacks',
              'Cookie for language and display preferences',
            ]} />
            <p className="text-sm font-semibold text-neutral-800 mb-1 mt-3">{isRO ? 'Cookie-uri de analiza (necesita consimtamantul tau):' : 'Analytics cookies (require your consent):'}</p>
            <UL items={isRO ? [
              'Analiza comportamentului de utilizare a Platformei in scop de imbunatatire a Serviciilor',
              'Masurarea performantei paginilor si identificarea erorilor',
            ] : [
              'Analysis of Platform usage behavior to improve Services',
              'Measuring page performance and identifying errors',
            ]} />
          </Sub>
          <Sub num="9.3" title={isRO ? 'Gestionarea cookie-urilor:' : 'Managing cookies:'}>
            {isRO
              ? 'La prima accesare a Platformei, ti se prezinta un banner de consimtamant pentru cookie-urile care nu sunt strict necesare. Poti modifica preferintele oricand din sectiunea Preferinte Cookie disponibila in footer-ul Platformei. Poti de asemenea configura browserul tau sa blocheze sau sa stearga cookie-urile, insa unele functionalitati ale Platformei pot fi afectate.'
              : 'When you first access the Platform, a consent banner is presented for cookies that are not strictly necessary. You can change your preferences at any time from the Cookie Preferences section available in the Platform footer. You can also configure your browser to block or delete cookies, however some Platform features may be affected.'}
          </Sub>
        </>
      ),
    },
    {
      id: 's10',
      number: isRO ? 'Sectiunea 10' : 'Section 10',
      title: isRO ? 'Securitatea datelor tale' : 'Security of your data',
      content: (
        <>
          <P>{isRO
            ? 'Implementam masuri tehnice si organizatorice adecvate pentru a proteja datele tale personale impotriva accesului neautorizat, modificarii, divulgarii sau distrugerii accidentale sau ilegale, conform Art. 32 GDPR:'
            : 'We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, modification, disclosure or accidental or unlawful destruction, pursuant to Art. 32 GDPR:'}
          </P>
          <p className="text-sm font-semibold text-neutral-800 mb-1">{isRO ? 'Masuri tehnice:' : 'Technical measures:'}</p>
          <UL items={isRO ? [
            'Criptarea datelor in tranzit prin protocol TLS 1.2 sau superior',
            'Criptarea datelor sensibile in repaus (parole hash-uite ireversibil, date de identificare din blacklist hash SHA-256)',
            'Autentificare cu doi factori disponibila pentru contul tau',
            'Controlul accesului bazat pe roluri pentru personalul Hontrio',
            'Monitorizarea continua a sistemelor pentru detectarea anomaliilor',
            'Backup regulat al datelor cu testare periodica a restaurarii',
          ] : [
            'Encryption of data in transit via TLS 1.2 or higher protocol',
            'Encryption of sensitive data at rest (irreversibly hashed passwords, blacklist identification data hashed SHA-256)',
            'Two-factor authentication available for your account',
            'Role-based access control for Hontrio staff',
            'Continuous system monitoring for anomaly detection',
            'Regular data backup with periodic restoration testing',
          ]} />
          <p className="text-sm font-semibold text-neutral-800 mb-1 mt-3">{isRO ? 'Masuri organizatorice:' : 'Organizational measures:'}</p>
          <UL items={isRO ? [
            'Acces la date personale limitat strict la personalul cu nevoie legitima',
            'Formare periodica a personalului privind protectia datelor',
            'Procedura documentata de raspuns la incidente de securitate',
          ] : [
            'Access to personal data strictly limited to staff with a legitimate need',
            'Periodic staff training on data protection',
            'Documented security incident response procedure',
          ]} />
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-600 mt-3">
            <p className="font-semibold text-neutral-800 mb-1">{isRO ? 'Notificarea incidentelor' : 'Incident notification'}</p>
            {isRO
              ? 'In cazul unui incident de securitate care afecteaza datele tale personale si care prezinta un risc ridicat pentru drepturile si libertatile tale, te vom notifica in maximum 72 de ore de la descoperire, conform Art. 34 GDPR. Notificarea va include natura incidentului, datele afectate, consecintele probabile si masurile luate sau planificate.'
              : 'In the event of a security incident affecting your personal data that presents a high risk to your rights and freedoms, we will notify you within 72 hours of discovery, pursuant to Art. 34 GDPR. The notification will include the nature of the incident, the affected data, likely consequences and measures taken or planned.'}
          </div>
        </>
      ),
    },
    {
      id: 's11',
      number: isRO ? 'Sectiunea 11' : 'Section 11',
      title: isRO ? 'Prelucrarea datelor minorilor' : 'Processing of minors\' data',
      content: (
        <P>{isRO
          ? 'Platforma Hontrio este destinata exclusiv utilizarii profesionale si comerciale de catre persoane cu capacitate juridica deplina. Nu colectam in mod intentionat date personale de la persoane cu varsta sub 18 ani. Daca devenim constienti ca am colectat date personale de la un minor, le vom sterge imediat. Daca ai informatii despre o astfel de situatie, te rugam sa ne contactezi la privacy@hontrio.com.'
          : 'The Hontrio Platform is intended exclusively for professional and commercial use by persons with full legal capacity. We do not intentionally collect personal data from persons under 18 years of age. If we become aware that we have collected personal data from a minor, we will delete it immediately. If you have information about such a situation, please contact us at privacy@hontrio.com.'}
        </P>
      ),
    },
    {
      id: 's12',
      number: isRO ? 'Sectiunea 12' : 'Section 12',
      title: isRO ? 'Decizii automate si profilare' : 'Automated decisions and profiling',
      content: (
        <>
          <P>{isRO
            ? 'Hontrio utilizeaza algoritmi automatizati in cadrul modulului Risk Shield pentru calcularea scorurilor de risc asociate comenzilor si clientilor platformei tale de comert electronic. Aceasta activitate constituie profilare in sensul Art. 4 pct. 4 GDPR, insa:'
            : 'Hontrio uses automated algorithms within the Risk Shield module to calculate risk scores associated with orders and customers of your e-commerce platform. This activity constitutes profiling within the meaning of Art. 4(4) GDPR, however:'}
          </P>
          <UL items={isRO ? [
            'Scorurile calculate sunt instrumente de asistenta pentru deciziile tale comerciale, nu decizii automate cu efecte juridice directe asupra persoanelor vizate',
            'Decizia finala privind o comanda (expediere, retinere, anulare) iti apartine intotdeauna tie, in calitate de operator al Magazinului',
            'Esti responsabil, in calitate de Operator al datelor clientilor tai, pentru asigurarea bazei legale corespunzatoare pentru utilizarea acestor analize si pentru informarea clientilor tai cu privire la existenta acestei prelucrari, conform Art. 13-14 GDPR',
          ] : [
            'Calculated scores are decision support tools for your commercial decisions, not automated decisions with direct legal effects on the data subjects',
            'The final decision regarding an order (shipping, holding, cancellation) always belongs to you, as the Store operator',
            'You are responsible, as Controller of your customers\' data, for ensuring the appropriate legal basis for using these analyses and for informing your customers about the existence of this processing, pursuant to Art. 13-14 GDPR',
          ]} />
        </>
      ),
    },
    {
      id: 's13',
      number: isRO ? 'Sectiunea 13' : 'Section 13',
      title: isRO ? 'Modificarea politicii de confidentialitate' : 'Amendment of privacy policy',
      content: (
        <>
          <P>{isRO
            ? 'Putem actualiza prezenta Politica periodic pentru a reflecta modificarile aduse Serviciilor, practicilor de prelucrare sau legislatiei aplicabile.'
            : 'We may update this Policy periodically to reflect changes to the Services, processing practices or applicable legislation.'}
          </P>
          <P>{isRO
            ? 'In cazul modificarilor semnificative (schimbarea scopurilor de prelucrare, adaugarea de noi categorii de date, modificarea perioadelor de retentie), te vom notifica prin email la adresa asociata contului tau cu cel putin 30 de zile inainte de intrarea in vigoare a modificarilor.'
            : 'In the case of significant changes (change of processing purposes, addition of new data categories, modification of retention periods), we will notify you by email to the address associated with your account at least 30 days before the changes take effect.'}
          </P>
          <P>{isRO
            ? 'Modificarile minore (corectii editoriale, clarificari fara impact asupra drepturilor tale) pot fi efectuate fara notificare prealabila, cu actualizarea datei de la inceputul documentului. Versiunile anterioare ale Politicii sunt arhivate si disponibile la cerere, trimitand un email la privacy@hontrio.com.'
            : 'Minor changes (editorial corrections, clarifications without impact on your rights) may be made without prior notice, with the date at the beginning of the document being updated. Previous versions of the Policy are archived and available upon request, by sending an email to privacy@hontrio.com.'}
          </P>
        </>
      ),
    },
    {
      id: 's14',
      number: isRO ? 'Sectiunea 14' : 'Section 14',
      title: isRO ? 'Contact si exercitarea drepturilor' : 'Contact and exercise of rights',
      content: (
        <>
          <P>{isRO
            ? 'Pentru orice intrebare, solicitare sau preocupare legata de prelucrarea datelor tale personale:'
            : 'For any question, request or concern related to the processing of your personal data:'}
          </P>
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-700 space-y-2 my-3">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-neutral-500" />
              <span className="font-semibold">{isRO ? 'Email protectia datelor' : 'Data protection email'}:</span>
              <a href="mailto:privacy@hontrio.com" className="text-neutral-900 hover:underline">privacy@hontrio.com</a>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-neutral-500" />
              <span className="font-semibold">{isRO ? 'Email general' : 'General email'}:</span>
              <a href="mailto:contact@hontrio.com" className="text-neutral-900 hover:underline">contact@hontrio.com</a>
            </div>
            <p><span className="font-semibold">{isRO ? 'Telefon' : 'Phone'}:</span> 0750 456 096</p>
            <div>
              <p className="font-semibold mb-0.5">{isRO ? 'Adresa postala' : 'Postal address'}:</p>
              <p className="text-neutral-600">SC VOID SFT GAMES SRL<br />Str. Progresului 2, Bl. A29, Sc. 2, Et. 2, Ap. 10<br />Sat Matasari, Jud. Gorj, {isRO ? 'Cod Postal' : 'Postal Code'} 217295, Romania</p>
            </div>
          </div>
          <P>{isRO
            ? 'Solicitarile transmise prin email primesc confirmare de primire in maximum 48 de ore lucratoare. Raspunsul complet este furnizat in maximum 30 de zile calendaristice.'
            : 'Requests sent by email receive a receipt confirmation within a maximum of 48 working hours. The complete response is provided within a maximum of 30 calendar days.'}
          </P>
        </>
      ),
    },
  ]
}

// ─── TOC labels ───────────────────────────────────────────────────────────────

const TOC_RO = [
  'Cine suntem (Operatorul de date)',
  'Despre ce date vorbim si de unde provin',
  'De ce prelucram datele tale si pe ce baza legala',
  'Cat timp pastram datele tale',
  'Cu cine impartasim datele tale',
  'Transferuri internationale de date',
  'Drepturile tale',
  'Dreptul de a depune o plangere',
  'Cookie-uri si tehnologii similare',
  'Securitatea datelor tale',
  'Prelucrarea datelor minorilor',
  'Decizii automate si profilare',
  'Modificarea politicii de confidentialitate',
  'Contact si exercitarea drepturilor',
]
const TOC_EN = [
  'Who we are (Data Controller)',
  'What data we process and where it comes from',
  'Why we process your data and on what legal basis',
  'How long we retain your data',
  'Who we share your data with',
  'International data transfers',
  'Your rights',
  'Right to lodge a complaint',
  'Cookies and similar technologies',
  'Security of your data',
  'Processing of minors\' data',
  'Automated decisions and profiling',
  'Amendment of privacy policy',
  'Contact and exercise of rights',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
  const { locale } = useLocale()
  const isRO = locale === 'ro'
  const shouldReduce = useReducedMotion() ?? false
  const [showTop, setShowTop] = useState(false)

  const sections = buildSections(isRO)
  const toc = isRO ? TOC_RO : TOC_EN
  const effectiveDate = isRO ? DATE_RO : DATE_EN

  const E = [0.4, 0, 0.2, 1] as [number, number, number, number]
  const fadeUp = (delay = 0): MotionProps => shouldReduce ? {} : {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease: E, delay },
  }

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="bg-white">
      {/* ── Hero ── */}
      <section className="pt-20 pb-12 border-b border-neutral-100">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div {...fadeUp(0)}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-xs font-semibold text-neutral-600 mb-6">
              <Shield className="h-3.5 w-3.5" />
              {isRO ? 'Document legal' : 'Legal document'}
            </div>
          </motion.div>
          <motion.h1 {...fadeUp(0.06)} className="text-4xl md:text-5xl font-black text-neutral-900 tracking-tight mb-6">
            {isRO ? 'Politica de Confidentialitate' : 'Privacy Policy'}
          </motion.h1>
          <motion.p {...fadeUp(0.1)} className="text-neutral-500 text-base leading-relaxed mb-8 max-w-2xl">
            {isRO
              ? 'SC VOID SFT GAMES SRL, operatorul platformei Hontrio, respecta dreptul tau la confidentialitate si se angajeaza sa prelucreze datele tale personale cu transparenta, responsabilitate si in deplina conformitate cu Regulamentul UE 2016/679 (GDPR) si legislatia romana aplicabila.'
              : 'SC VOID SFT GAMES SRL, the operator of the Hontrio platform, respects your right to privacy and is committed to processing your personal data transparently, responsibly and in full compliance with EU Regulation 2016/679 (GDPR) and applicable Romanian legislation.'}
          </motion.p>
          <motion.div {...fadeUp(0.14)} className="flex flex-wrap gap-3">
            {[
              { label: isRO ? 'Versiunea' : 'Version', value: VERSION },
              { label: isRO ? 'In vigoare din' : 'Effective from', value: effectiveDate },
              { label: isRO ? 'Ultima actualizare' : 'Last updated', value: effectiveDate },
              { label: isRO ? 'Autoritate competenta' : 'Supervisory authority', value: 'ANSPDCP Romania' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-sm">
                <span className="text-neutral-400">{item.label}:</span>
                <span className="font-semibold text-neutral-800">{item.value}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Main content ── */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-[260px_1fr] gap-12">

          {/* Sidebar TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
                {isRO ? 'Cuprins' : 'Table of contents'}
              </p>
              <nav className="space-y-1">
                {toc.map((title, i) => (
                  <button
                    key={i}
                    onClick={() => scrollTo(`s${i + 1}`)}
                    className="group flex items-start gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    <span className="shrink-0 text-[11px] font-mono text-neutral-400 mt-0.5 w-6">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[12.5px] text-neutral-500 group-hover:text-neutral-800 leading-snug transition-colors">
                      {title}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Sections */}
          <div className="min-w-0">
            {/* Mobile TOC */}
            <details className="lg:hidden mb-8 rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-semibold text-neutral-700 select-none">
                {isRO ? 'Cuprins' : 'Table of contents'}
              </summary>
              <div className="px-4 pb-4 space-y-1">
                {toc.map((title, i) => (
                  <button key={i} onClick={() => scrollTo(`s${i + 1}`)} className="flex items-start gap-2 w-full text-left py-1.5">
                    <span className="shrink-0 text-[11px] font-mono text-neutral-400 mt-0.5 w-5">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-[12px] text-neutral-600 leading-snug">{title}</span>
                  </button>
                ))}
              </div>
            </details>

            <div className="space-y-12">
              {sections.map((section, i) => (
                <motion.section
                  key={section.id}
                  id={section.id}
                  initial={shouldReduce ? undefined : { opacity: 0, y: 20 }}
                  whileInView={shouldReduce ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.05 }}
                  transition={{ duration: 0.45, ease: E }}
                  className="scroll-mt-24"
                >
                  <div className="flex items-center gap-3 mb-5 pb-3 border-b border-neutral-100">
                    <span className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                      {section.number}
                    </span>
                    <h2 className="text-base font-bold text-neutral-900">{section.title}</h2>
                  </div>
                  <div className="text-sm leading-relaxed">{section.content}</div>
                </motion.section>
              ))}
            </div>

            {/* Footer note */}
            <div className="mt-14 pt-8 border-t border-neutral-100">
              <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-6 space-y-3">
                <p className="text-xs text-neutral-500">
                  {isRO
                    ? `Data ultimei actualizari: ${effectiveDate} — Versiunea ${VERSION}`
                    : `Last updated: ${effectiveDate} — Version ${VERSION}`}
                </p>
                <p className="text-xs text-neutral-500">
                  {isRO
                    ? 'Autoritate nationala de supraveghere competenta: ANSPDCP Romania'
                    : 'Competent national supervisory authority: ANSPDCP Romania'}{' '}
                  <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="underline">
                    www.dataprotection.ro
                  </a>
                </p>
                <a
                  href="mailto:privacy@hontrio.com"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  privacy@hontrio.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Back to top */}
      {showTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-10 h-10 rounded-full bg-neutral-900 text-white shadow-lg hover:bg-neutral-700 transition-colors"
        >
          <ArrowUp className="h-4 w-4" />
        </motion.button>
      )}
    </main>
  )
}
