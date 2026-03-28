'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion, type MotionProps } from 'framer-motion'
import { FileText, ChevronRight, ArrowUp, Mail } from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

// ─── Dates ────────────────────────────────────────────────────────────────────

const EFFECTIVE_DATE_RO = '28 martie 2026'
const EFFECTIVE_DATE_EN = 'March 28, 2026'
const VERSION = '1.0'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  id: string
  number: string
  title: string
  content: React.ReactNode
}

// ─── Content helpers ──────────────────────────────────────────────────────────

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-neutral-600 leading-relaxed mb-4 last:mb-0">{children}</p>
)
const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-sm font-semibold text-neutral-800 mt-5 mb-2">{children}</h3>
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
const SubSection = ({ num, title, children }: { num: string; title?: string; children: React.ReactNode }) => (
  <div className="mb-5">
    <p className="text-sm font-semibold text-neutral-800 mb-2">
      {num}{title ? ` ${title}` : ''}
    </p>
    <div className="text-sm text-neutral-600 leading-relaxed">{children}</div>
  </div>
)

// ─── RO Articles ─────────────────────────────────────────────────────────────

const articlesRO: Article[] = [
  {
    id: 'art1',
    number: 'Articolul 1',
    title: 'Partile contractante si definitii',
    content: (
      <>
        <SubSection num="1.1" title="Furnizorul:">
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-700 space-y-1">
            <p className="font-semibold">SC VOID SFT GAMES SRL</p>
            <p>CUI: 43474393</p>
            <p>Nr. Reg. Com.: J18/1054/2020</p>
            <p>EUID: ROONRC.J18/1054/2020</p>
            <p>Sediu social: Str. Progresului 2, Bl. A29, Sc. 2, Et. 2, Ap. 10, Sat Matasari, Jud. Gorj, Cod Postal 217295, Romania</p>
            <p>Telefon: 0750 456 096</p>
            <p>Email: contact@hontrio.com</p>
            <p className="text-neutral-500 text-xs mt-2">Denumita in continuare "Hontrio", "noi" sau "Furnizorul"</p>
          </div>
        </SubSection>
        <SubSection num="1.2" title="Clientul:">
          Orice persoana juridica (societate comerciala, PFA, II, IF) sau persoana fizica autorizata care creeaza un cont pe Platforma si utilizeaza Serviciile in scop profesional sau comercial. Hontrio este o platforma destinata exclusiv utilizarii profesionale si comerciale, nu consumatorilor persoane fizice.
        </SubSection>
        <SubSection num="1.3" title="Definitii:">
          <UL items={[
            'Platforma — aplicatia web accesibila la hontrio.com si toate subdomeniile sale',
            'Serviciile — ansamblul functionalitatilor disponibile prin Platforma, inclusiv generarea de imagini cu AI, optimizarea SEO, agentul de conversatie AI si modulul de protectie comenzi, precum si orice functionalitati viitoare',
            'Contul — spatiul personal al Clientului creat prin inregistrare, protejat prin credentiale de acces',
            'Credite — unitati virtuale achizitionate de Client si consumate pentru utilizarea functionalitatilor AI ale Platformei',
            'Magazinul — platforma de comert electronic a Clientului conectata la Hontrio',
            'Datele Magazinului — produsele, comenzile, clientii si orice alte informatii transferate din Magazin catre Platforma',
            'Continut Generat — orice text, imagine sau alt material produs de Platforma ca urmare a utilizarii Serviciilor de catre Client',
            'Subprocesori — tertii furnizori de servicii utilizati de Hontrio pentru a furniza Serviciile, inclusiv furnizori de modele AI, infrastructura cloud si procesatori de plati',
          ]} />
        </SubSection>
      </>
    ),
  },
  {
    id: 'art2',
    number: 'Articolul 2',
    title: 'Obiectul contractului si descrierea serviciilor',
    content: (
      <>
        <SubSection num="2.1">
          Hontrio pune la dispozitia Clientului, contra cost, accesul la o platforma SaaS de optimizare a comertului electronic, care include urmatoarele categorii de servicii:
          <UL items={[
            'Generare automata de imagini profesionale pentru produse, utilizand modele de inteligenta artificiala',
            'Generare si optimizare de continut text SEO pentru produse, inclusiv titluri, descrieri si meta-descrieri',
            'Agent de conversatie AI configurabil, integrabil in Magazinul Clientului',
            'Sistem de analiza si scoring al riscului asociat comenzilor si clientilor Magazinului',
            'Sincronizare bidiretionala cu platforma de comert electronic a Clientului',
            'Orice alte functionalitati anuntate si puse la dispozitie pe Platforma',
          ]} />
        </SubSection>
        <SubSection num="2.2">
          Serviciile sunt furnizate pe baza unui abonament lunar sau anual, conform planului ales de Client la momentul inregistrarii sau al upgradarii.
        </SubSection>
        <SubSection num="2.3">
          Hontrio isi rezerva dreptul de a adauga, modifica sau retrage functionalitati ale Platformei, cu notificarea prealabila a Clientilor activi conform Articolului 12.
        </SubSection>
        <SubSection num="2.4">
          Accesul la Platforma se face exclusiv prin intermediul interfetei web sau al API-ului pus la dispozitie de Hontrio. Clientul nu are dreptul de a accesa infrastructura tehnica subiacenta.
        </SubSection>
      </>
    ),
  },
  {
    id: 'art3',
    number: 'Articolul 3',
    title: 'Inregistrarea contului si eligibilitatea',
    content: (
      <>
        {[
          { num: '3.1', text: 'Pentru a utiliza Platforma, Clientul trebuie sa creeze un cont furnizand informatii complete, corecte si actualizate, inclusiv: denumirea entitatii, datele de contact, adresa de email valida si informatiile de facturare.' },
          { num: '3.2', text: 'Clientul garanteaza ca are capacitatea juridica si autorizatia necesara pentru a incheia prezentul acord in numele entitatii pe care o reprezinta.' },
          { num: '3.3', text: 'Fiecare entitate poate detine un singur cont. Crearea de conturi multiple pentru a eluda limitele planului sau a obtine avantaje necuvenite este interzisa si poate duce la suspendarea tuturor conturilor asociate.' },
          { num: '3.4', text: 'Clientul este responsabil pentru confidentialitatea credentialelor de acces si pentru toate activitatile desfasurate prin contul sau. Hontrio nu va fi tinut raspunzator pentru pierderile rezultate din utilizarea neautorizata a contului ca urmare a nerespectarii obligatiei de confidentialitate de catre Client.' },
          { num: '3.5', text: 'Clientul trebuie sa notifice Hontrio de indata ce ia cunostinta de orice acces neautorizat la contul sau, la adresa contact@hontrio.com.' },
        ].map(({ num, text }) => <SubSection key={num} num={num}>{text}</SubSection>)}
      </>
    ),
  },
  {
    id: 'art4',
    number: 'Articolul 4',
    title: 'Conditiile financiare',
    content: (
      <>
        <SubSection num="4.1" title="Pretul serviciilor:">
          Tarifele aplicabile sunt cele afisate pe Platforma la momentul subscrierii. Hontrio isi rezerva dreptul de a modifica tarifele cu o notificare prealabila de minimum 30 de zile. Modificarile de tarif nu afecteaza perioadele de abonament deja platite.
        </SubSection>
        <SubSection num="4.2" title="Facturare si plata:">
          Abonamentele se factureaza anticipat, la inceputul fiecarei perioade de facturare (lunara sau anuala). Plata se efectueaza prin metodele acceptate de Platforma la momentul tranzactiei. Facturile sunt emise electronic si puse la dispozitia Clientului in sectiunea dedicata din contul sau.
        </SubSection>
        <SubSection num="4.3" title="Intarzierea platii:">
          In cazul neachitarii facturii in termenul scadent, Hontrio poate suspenda accesul la Servicii dupa o perioada de gratie de 7 zile calendaristice de la data scadentei, cu notificarea prealabila a Clientului. Accesul se reia in maximum 24 de ore de la confirmarea platii.
        </SubSection>
        <SubSection num="4.4" title="Credite:">
          Creditele achizitionate sunt valabile pe durata abonamentului activ si nu se reporteaza automat in perioada urmatoare, cu exceptia cazului in care planul ales prevede altfel. Creditele neutilizate la incetarea contractului nu se ramburseaza.
        </SubSection>
        <SubSection num="4.5" title="Politica de rambursare:">
          Tinand cont de natura digitala a Serviciilor si de consumul de resurse tehnice la furnizare, platile pentru abonamente si credite nu sunt rambursabile, cu exceptia urmatoarelor situatii:
          <UL items={[
            'Imposibilitate tehnica totala de accesare a Platformei pe o perioada continua de peste 72 de ore din culpa Hontrio',
            'Eroare de facturare demonstrabila (taxare multipla sau in cuantum incorect)',
          ]} />
          Solicitarile de rambursare se trimit la contact@hontrio.com in maximum 14 zile de la data tranzactiei, cu descrierea circumstantelor.
        </SubSection>
        <SubSection num="4.6" title="Taxe:">
          Preturile afisate pot fi fara TVA. TVA-ul aplicabil conform legislatiei romane in vigoare va fi adaugat la facturare. Clientii din afara Romaniei sunt responsabili pentru orice taxe locale aplicabile in jurisdictia lor.
        </SubSection>
      </>
    ),
  },
  {
    id: 'art5',
    number: 'Articolul 5',
    title: 'Drepturile si obligatiile Clientului',
    content: (
      <>
        <SubSection num="5.1" title="Drepturi:">
          <UL items={[
            'Accesul la Serviciile incluse in planul ales, pe durata abonamentului activ',
            'Exportul Datelor Magazinului si al Continutului Generat in orice moment, in formate standard',
            'Suport tehnic conform nivelului inclus in planul ales',
            'Notificarea prealabila privind orice modificare substantiala a Serviciilor sau Termenilor',
          ]} />
        </SubSection>
        <SubSection num="5.2" title="Obligatii:">
          <UL items={[
            'Sa furnizeze informatii corecte si actualizate la inregistrare si pe durata utilizarii',
            'Sa utilizeze Platforma exclusiv in scopuri legale si in conformitate cu prezentii Termeni',
            'Sa nu incerce accesul neautorizat la conturile altor utilizatori sau la infrastructura Platformei',
            'Sa nu utilizeze Serviciile pentru a genera continut ilegal, fraudulos, defaimator, discriminatoriu sau care incalca drepturile tertilor',
            'Sa nu reverse-engineereze, decompileze sau incerce sa extraga codul sursa al Platformei',
            'Sa respecte limitele de utilizare ale planului ales fara a utiliza mijloace tehnice pentru a le eluda',
            'Sa notifice Hontrio de indata privind orice vulnerabilitate de securitate descoperita',
          ]} />
        </SubSection>
        <SubSection num="5.3" title="Utilizare acceptabila:">
          Clientul se angajeaza sa nu utilizeze Platforma pentru:
          <UL items={[
            'Generarea de continut care incalca drepturi de proprietate intelectuala ale tertilor',
            'Procesarea de date personale fara baza legala corespunzatoare',
            'Activitati care ar putea deteriora reputatia sau functionarea tehnica a Platformei',
            'Activitati ce contravin legislatiei aplicabile in Romania, UE sau in jurisdictia Clientului',
          ]} />
        </SubSection>
      </>
    ),
  },
  {
    id: 'art6',
    number: 'Articolul 6',
    title: 'Drepturile si obligatiile Hontrio',
    content: (
      <>
        <SubSection num="6.1" title="Drepturi:">
          <UL items={[
            'Sa modifice, suspende sau inceteze furnizarea oricarui Serviciu cu notificarea prealabila a Clientilor',
            'Sa suspende accesul unui Client care incalca prezentii Termeni, dupa o notificare prealabila sau imediat in cazul incalcarilor grave',
            'Sa utilizeze date agregate si anonimizate privind utilizarea Platformei pentru imbunatatirea Serviciilor',
          ]} />
        </SubSection>
        <SubSection num="6.2" title="Obligatii:">
          <UL items={[
            'Sa furnizeze Serviciile cu diligenta rezonabila si conform descrierii publicate pe Platforma',
            'Sa mentina confidentialitatea Datelor Magazinului si sa nu le utilizeze in alte scopuri decat furnizarea Serviciilor',
            'Sa notifice Clientul cu cel putin 30 de zile inainte de orice modificare substantiala a Serviciilor sau Termenilor',
            'Sa notifice Clientul in maximum 72 de ore de la descoperirea oricarui incident de securitate care afecteaza datele sale',
            'Sa mentina masuri tehnice si organizatorice adecvate pentru protectia datelor procesate',
          ]} />
        </SubSection>
      </>
    ),
  },
  {
    id: 'art7',
    number: 'Articolul 7',
    title: 'Proprietate intelectuala',
    content: (
      <>
        {[
          { num: '7.1', title: 'Proprietatea Hontrio:', text: 'Platforma, inclusiv codul sursa, interfata, algoritmii, brandingul, documentatia si orice element al Serviciilor, constituie proprietatea exclusiva a SC VOID SFT GAMES SRL sau a furnizorilor sai de licente. Prezentul acord nu transfera Clientului niciun drept de proprietate asupra Platformei.' },
          { num: '7.2', title: 'Proprietatea Clientului:', text: 'Datele Magazinului raman proprietatea exclusiva a Clientului. Hontrio nu revendica niciun drept de proprietate asupra acestora.' },
          { num: '7.3', title: 'Continutul Generat:', text: 'Continutul generat de Platforma pe baza datelor furnizate de Client (imagini, texte, analize) apartine Clientului, care dobandeste dreptul de utilizare comerciala deplina a acestuia. Hontrio nu revendica drepturi asupra Continutului Generat si nu il utilizeaza in alte scopuri decat furnizarea Serviciului.' },
          { num: '7.4', title: 'Licenta limitata:', text: 'Prin conectarea Magazinului la Platforma, Clientul acorda Hontrio o licenta limitata, neexclusiva, revocabila, strict necesara pentru furnizarea Serviciilor contractate: accesarea, procesarea si stocarea temporara a Datelor Magazinului exclusiv in scopul generarii Continutului solicitat.' },
          { num: '7.5', title: 'Feedback:', text: 'Orice sugestie sau feedback furnizat de Client privind Platforma poate fi utilizat de Hontrio pentru imbunatatirea Serviciilor, fara obligatii de compensatie.' },
        ].map(({ num, title, text }) => (
          <SubSection key={num} num={num} title={title}>{text}</SubSection>
        ))}
      </>
    ),
  },
  {
    id: 'art8',
    number: 'Articolul 8',
    title: 'Protectia datelor cu caracter personal',
    content: (
      <>
        <SubSection num="8.1" title="Calitatea partilor:">
          In contextul utilizarii Platformei, Clientul actioneaza ca Operator de date cu caracter personal in privinta datelor clientilor sai, iar Hontrio actioneaza ca Imputernicit al Clientului pentru prelucrarea acestor date, conform Regulamentului UE 2016/679 (GDPR).
        </SubSection>
        <SubSection num="8.2" title="Acordul de prelucrare a datelor (DPA):">
          Prelucrarea datelor cu caracter personal de catre Hontrio in calitate de Imputernicit este guvernata de Acordul de Prelucrare a Datelor, care face parte integranta din prezentul acord si se considera acceptat odata cu acceptarea prezentilor Termeni.
        </SubSection>
        <SubSection num="8.3" title="Date personale ale Clientului:">
          Datele personale ale reprezentantilor Clientului (nume, email, date de facturare) sunt prelucrate de Hontrio in calitate de Operator, conform Politicii de Confidentialitate.
        </SubSection>
        <SubSection num="8.4" title="Subprocesori:">
          Hontrio utilizeaza urmatorii subprocesori principali pentru furnizarea Serviciilor:
          <UL items={[
            'Supabase Inc. — infrastructura baze de date (SUA, acoperit de EU-US Data Privacy Framework)',
            'Vercel Inc. — infrastructura hosting (SUA, acoperit de EU-US Data Privacy Framework)',
            'OpenAI LLC — modele de generare text si embeddings (SUA, acoperit de EU-US Data Privacy Framework)',
            'Stripe Inc. — procesare plati (SUA, acoperit de EU-US Data Privacy Framework)',
          ]} />
          Hontrio va notifica Clientul cu minimum 10 zile inainte de adaugarea oricarui subprocesor nou care proceseaza date personale ale Clientului sau ale clientilor sai.
        </SubSection>
        <SubSection num="8.5" title="Transferuri internationale:">
          Pentru transferurile de date catre subprocesori stabiliti in tari din afara SEE, Hontrio utilizeaza mecanismele de transfer aprobate de Comisia Europeana (Clauze Contractuale Standard sau decizii de adecvare), asigurand un nivel echivalent de protectie cu cel garantat de GDPR.
        </SubSection>
      </>
    ),
  },
  {
    id: 'art9',
    number: 'Articolul 9',
    title: 'Confidentialitate',
    content: (
      <>
        {[
          { num: '9.1', text: 'Fiecare parte se angajeaza sa pastreze confidentialitatea informatiilor confidentiale primite de la cealalta parte si sa nu le dezvaluie tertilor fara consimtamantul prealabil scris al partii divulgatoare.' },
          { num: '9.2', text: 'Obligatia de confidentialitate nu se aplica informatiilor care: sunt sau devin publice fara culpa partii receptoare, erau cunoscute anterior primirii lor, sunt primite legal de la un tert fara restrictii, sau trebuie dezvaluite prin lege sau ordin judecatoresc.' },
          { num: '9.3', text: 'Hontrio nu va vinde, inchiria sau transfera Datele Magazinului catre terti in scop comercial. Datele sunt utilizate exclusiv pentru furnizarea Serviciilor contractate.' },
          { num: '9.4', text: 'Obligatia de confidentialitate supravietuieste incetarii prezentului acord pentru o perioada de 3 ani.' },
        ].map(({ num, text }) => <SubSection key={num} num={num}>{text}</SubSection>)}
      </>
    ),
  },
  {
    id: 'art10',
    number: 'Articolul 10',
    title: 'Disponibilitatea serviciului si SLA',
    content: (
      <>
        {[
          { num: '10.1', text: 'Hontrio depune eforturi rezonabile pentru a asigura disponibilitatea Platformei de minimum 99% din timp, calculata lunar, cu exceptia perioadelor de mentenanta planificata.' },
          { num: '10.2', text: 'Mentenanta planificata se desfasoara, pe cat posibil, in afara orelor de varf (preferabil intre 02:00 si 06:00 ora Romaniei) si este anuntata cu cel putin 24 de ore inainte prin email sau notificare in Platforma.' },
          { num: '10.3', text: 'Hontrio nu garanteaza disponibilitatea neintrerupta a serviciilor AI ale tertilor (modele de generare imagini, modele de text) si nu poate fi tinut raspunzator pentru intreruperile cauzate de acesti furnizori, dar va depune eforturi rezonabile pentru a identifica si implementa alternative.' },
          { num: '10.4', text: 'In cazul indisponibilitatii totale a Platformei pe o perioada continua de peste 72 de ore din culpa exclusiva a Hontrio, Clientii afectati pot solicita o compensatie sub forma de credite suplimentare sau prelungirea perioadei de abonament cu durata indisponibilitatii, la alegerea Hontrio.' },
        ].map(({ num, text }) => <SubSection key={num} num={num}>{text}</SubSection>)}
      </>
    ),
  },
  {
    id: 'art11',
    number: 'Articolul 11',
    title: 'Limitarea raspunderii',
    content: (
      <>
        <SubSection num="11.1">
          Platforma este furnizata ca atare (as is), fara garantii exprese sau implicite privind adecvarea pentru un scop specific sau absenta erorilor.
        </SubSection>
        <SubSection num="11.2">
          Hontrio nu va fi raspunzator pentru:
          <UL items={[
            'Pierderile indirecte, incidentale, speciale sau consecventiale ale Clientului, inclusiv pierderi de profit, venituri sau oportunitati de afaceri',
            'Continutul generat de AI care nu corespunde asteptarilor Clientului, avand in vedere natura probabilistica a modelelor de inteligenta artificiala',
            'Pierderile rezultate din utilizarea necorespunzatoare a Platformei sau din nerespectarea prezentilor Termeni de catre Client',
            'Intreruperile serviciilor cauzate de factori in afara controlului rezonabil al Hontrio (forta majora, atacuri cibernetice, disfunctionalitati ale furnizorilor terti)',
            'Deciziile comerciale ale Clientului luate pe baza analizelor si recomandarilor generate de Platforma',
          ]} />
        </SubSection>
        <SubSection num="11.3">
          Raspunderea totala cumulata a Hontrio fata de Client pentru orice pretentii derivand din sau in legatura cu prezentul acord, indiferent de temeiul juridic, este limitata la valoarea sumelor platite efectiv de Client catre Hontrio in cele 3 luni calendaristice anterioare evenimentului generator al raspunderii.
        </SubSection>
        <SubSection num="11.4">
          Limitarile de raspundere prevazute in prezentul articol nu se aplica in cazurile de dol sau culpa grava a Hontrio, sau in cazurile in care legislatia aplicabila interzice limitarea raspunderii.
        </SubSection>
      </>
    ),
  },
  {
    id: 'art12',
    number: 'Articolul 12',
    title: 'Modificarea termenilor',
    content: (
      <>
        {[
          { num: '12.1', text: 'Hontrio poate modifica prezentii Termeni in orice moment, cu notificarea Clientilor activi prin email cu cel putin 30 de zile inainte de intrarea in vigoare a modificarilor.' },
          { num: '12.2', text: 'Notificarea va descrie clar natura modificarilor si data intrarii lor in vigoare. Versiunile anterioare ale Termenilor vor fi arhivate si accesibile la cerere.' },
          { num: '12.3', text: 'Continuarea utilizarii Platformei dupa data intrarii in vigoare a modificarilor constituie acceptul Clientului fata de noii Termeni. In cazul in care Clientul nu accepta modificarile, acesta poate rezilia contractul fara penalitati pana la data intrarii in vigoare, conform Articolului 13.' },
          { num: '12.4', text: 'Modificarile care introduc obligatii suplimentare substantiale pentru Client sau reduc semnificativ Serviciile incluse in planul platit nu pot fi impuse retroactiv pentru perioada de abonament deja platita.' },
        ].map(({ num, text }) => <SubSection key={num} num={num}>{text}</SubSection>)}
      </>
    ),
  },
  {
    id: 'art13',
    number: 'Articolul 13',
    title: 'Durata contractului, reziliere si portabilitatea datelor',
    content: (
      <>
        <SubSection num="13.1" title="Durata:">
          Contractul se incheie pe durata abonamentului ales (lunar sau anual) si se reinnoieste automat la finalul fiecarei perioade, cu exceptia cazului in care una dintre parti notifica intentia de neinnoire cu cel putin 7 zile inainte de data reinnoirii.
        </SubSection>
        <SubSection num="13.2" title="Reziliere de catre Client:">
          Conform Regulamentului UE 2023/2854 (EU Data Act), Clientul poate rezilia prezentul contract in orice moment, cu un termen de preaviz de maximum 2 luni. Clientul nu poate fi penalizat cu suma totala ramasa din contractul pe termen fix. Orice penalitate de reziliere anticipata, daca este prevazuta in planul ales, trebuie sa fie proportionala cu prejudiciul efectiv al Hontrio si nu poate constitui o bariera la schimbarea furnizorului.
        </SubSection>
        <SubSection num="13.3" title="Reziliere de catre Hontrio:">
          Hontrio poate rezilia contractul cu un preaviz de 30 de zile acordat Clientului, fara a fi necesara justificarea deciziei. In cazul incalcarii grave a prezentilor Termeni de catre Client (frauda, activitate ilegala, tentativa de acces neautorizat), Hontrio poate suspenda sau rezilia contractul imediat, fara preaviz.
        </SubSection>
        <SubSection num="13.4" title="Portabilitatea datelor si exportul:">
          Conform EU Data Act, Clientul are dreptul la portabilitatea completa a datelor sale. La rezilierea contractului, indiferent de motiv:
          <UL items={[
            'Hontrio pune la dispozitia Clientului, in maximum 30 de zile calendaristice de la data rezilierii, toate Datele Magazinului si Continutul Generat in formate structurate, uzuale si prelucrabile automat',
            'Exportul datelor este gratuit si nu poate fi conditionat de plata unor taxe suplimentare',
            'Datele raman accesibile pentru o perioada de minimum 30 de zile dupa incetarea accesului la Platforma',
            'Dupa expirarea acestei perioade de retentie, Hontrio sterge irevocabil datele Clientului din sistemele sale, cu exceptia celor pe care este obligat sa le pastreze prin lege',
          ]} />
        </SubSection>
        <SubSection num="13.5" title="Efectele incetarii:">
          La incetarea contractului, indiferent de motiv: accesul Clientului la Platforma se inchide, creditele neutilizate se anuleaza fara compensatie, obligatiile de confidentialitate raman in vigoare conform Articolului 9.
        </SubSection>
      </>
    ),
  },
  {
    id: 'art14',
    number: 'Articolul 14',
    title: 'Forta majora',
    content: (
      <>
        {[
          { num: '14.1', text: 'Niciuna dintre parti nu va fi raspunzatoare pentru neexecutarea sau executarea cu intarziere a obligatiilor contractuale cauzata de evenimente de forta majora, definite ca evenimente imprevizibile, inevitabile si independente de vointa partii afectate, inclusiv: calamitati naturale, acte de razboi sau terorism, pandemii declarate oficial, acte ale autoritatilor publice, disfunctionalitati majore ale infrastructurii internet la nivel global sau regional.' },
          { num: '14.2', text: 'Partea afectata de forta majora va notifica cealalta parte in maximum 5 zile lucratoare de la producerea evenimentului si va depune eforturi rezonabile pentru limitarea efectelor.' },
          { num: '14.3', text: 'Daca evenimentul de forta majora persista mai mult de 30 de zile calendaristice, oricare dintre parti poate rezilia contractul fara penalitati, cu notificarea celeilalte parti.' },
        ].map(({ num, text }) => <SubSection key={num} num={num}>{text}</SubSection>)}
      </>
    ),
  },
  {
    id: 'art15',
    number: 'Articolul 15',
    title: 'Dispozitii privind utilizarea AI',
    content: (
      <>
        <SubSection num="15.1">
          Serviciile Hontrio utilizeaza modele de inteligenta artificiala pentru generarea de continut. Clientul intelege si accepta ca:
          <UL items={[
            'Continutul generat de AI are un caracter probabilistic si poate contine inexactitati, erori sau rezultate neasteptate',
            'Clientul are responsabilitatea de a verifica si valida Continutul Generat inainte de publicarea sau utilizarea sa comerciala',
            'Hontrio nu garanteaza ca Continutul Generat este unic, liber de drepturi de autor ale tertilor sau adecvat oricarui scop specific',
          ]} />
        </SubSection>
        <SubSection num="15.2">
          Clientul nu va utiliza Serviciile pentru a genera continut care:
          <UL items={[
            'Incalca drepturi de proprietate intelectuala ale tertilor',
            'Este ilegal, fraudulos, defaimator, discriminatoriu sau ofensator',
            'Reprezinta informatii false sau inselatoare destinate publicului',
            'Contine date cu caracter personal ale tertilor fara consimtamantul acestora',
          ]} />
        </SubSection>
        <SubSection num="15.3">
          Datele furnizate de Client nu sunt utilizate pentru antrenarea modelelor AI ale tertilor furnizori, in masura in care acordurile cu acestia permit excluderea acestui tip de utilizare.
        </SubSection>
      </>
    ),
  },
  {
    id: 'art16',
    number: 'Articolul 16',
    title: 'Blacklist-ul global Risk Shield',
    content: (
      <>
        {[
          { num: '16.1', text: 'Modulul Risk Shield include o functionalitate optionala de blacklist global partajat intre utilizatorii platformei. Participarea este voluntara si poate fi configurata din setarile contului.' },
          { num: '16.2', text: 'Inainte de participarea la blacklist-ul global, Clientul se angajeaza sa se asigure ca dispune de baza legala adecvata pentru prelucrarea si partajarea, in forma anonimizata, a datelor de identificare ale clientilor sai cu risc ridicat.' },
          { num: '16.3', text: 'Datele partajate in blacklist-ul global sunt hash-uite ireversibil (SHA-256) inainte de transmitere. Nicio informatie personala identificabila direct nu este stocata sau partajata in forma clara.' },
          { num: '16.4', text: 'Clientul ramane singurul responsabil pentru deciziile comerciale luate pe baza informatiilor din blacklist-ul global (refuzul unei comenzi, solicitarea platii in avans etc.) si pentru conformitatea acestor decizii cu legislatia aplicabila, inclusiv cu legislatia privind protectia datelor personale.' },
        ].map(({ num, text }) => <SubSection key={num} num={num}>{text}</SubSection>)}
      </>
    ),
  },
  {
    id: 'art17',
    number: 'Articolul 17',
    title: 'Legea aplicabila si solutionarea disputelor',
    content: (
      <>
        <SubSection num="17.1" title="Legea aplicabila:">
          Prezentul acord este guvernat de legislatia romana, completata de regulamentele si directivele europene aplicabile, in special GDPR si EU Data Act.
        </SubSection>
        <SubSection num="17.2" title="Solutionare amiabila:">
          Orice disputa derivand din sau in legatura cu prezentul acord va fi solutionata in primul rand pe cale amiabila. Oricare parte poate notifica cealalta parte in scris, la adresele mentionate in Articolul 1, si partile vor depune eforturi buna-credinta pentru a ajunge la o solutie in termen de 30 de zile de la primirea notificarii.
        </SubSection>
        <SubSection num="17.3" title="Instanta competenta:">
          In cazul in care disputele nu pot fi solutionate pe cale amiabila, acestea vor fi supuse spre solutionare instantelor judecatoresti competente de la sediul social al SC VOID SFT GAMES SRL, respectiv instantele din judetul Gorj, Romania.
        </SubSection>
        <SubSection num="17.4" title="Clienti internationali:">
          Fara a aduce atingere drepturilor imperative conferite de legislatia locala aplicabila Clientilor stabiliti in alte state membre ale UE, partile convin ca legea romana guverneaza interpretarea si executarea prezentului acord in masura permisa de legislatia aplicabila.
        </SubSection>
      </>
    ),
  },
  {
    id: 'art18',
    number: 'Articolul 18',
    title: 'Dispozitii finale',
    content: (
      <>
        <SubSection num="18.1" title="Integralitatea acordului:">
          Prezentii Termeni, impreuna cu Politica de Confidentialitate si Acordul de Prelucrare a Datelor, constituie intregul acord dintre parti cu privire la obiectul sau si inlocuiesc orice intelegeri anterioare, scrise sau verbale, referitoare la acelasi obiect.
        </SubSection>
        <SubSection num="18.2" title="Divizibilitate:">
          In cazul in care orice prevedere a prezentilor Termeni este declarata invalida sau inaplicabila de o instanta competenta, aceasta prevedere va fi modificata in masura minima necesara pentru a deveni valida, iar restul Termenilor ramane in vigoare si produce efecte depline.
        </SubSection>
        <SubSection num="18.3" title="Renuntare:">
          Nerevendicarea de catre oricare parte a oricarui drept prevazut in prezentii Termeni nu constituie o renuntare la acel drept si nu afecteaza posibilitatea de a-l invoca ulterior.
        </SubSection>
        <SubSection num="18.4" title="Cesiunea:">
          Clientul nu poate ceda drepturile sau obligatiile din prezentul acord unui tert fara acordul prealabil scris al Hontrio. Hontrio poate ceda prezentul acord unui succesor in cadrul unei restructurari corporative, fuziuni sau achizitii, cu notificarea Clientilor.
        </SubSection>
        <SubSection num="18.5" title="Comunicari:">
          Toate notificarile oficiale se transmit prin email la adresele furnizate la inregistrare. Notificarile catre Hontrio se transmit la contact@hontrio.com. Notificarile sunt considerate primite la 24 de ore de la transmitere, daca nu este returnata o notificare de nelivrare.
        </SubSection>
        <SubSection num="18.6" title="Versiunea in vigoare:">
          Versiunea actuala a Termenilor este intotdeauna accesibila la hontrio.com/legal/terms. Versiunile anterioare sunt arhivate si disponibile la cerere.
        </SubSection>
      </>
    ),
  },
]

// ─── EN Articles (translated) ─────────────────────────────────────────────────

const articlesEN: Article[] = [
  {
    id: 'art1',
    number: 'Article 1',
    title: 'Contracting parties and definitions',
    content: (
      <>
        <SubSection num="1.1" title="The Provider:">
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-700 space-y-1">
            <p className="font-semibold">SC VOID SFT GAMES SRL</p>
            <p>Tax ID: 43474393</p>
            <p>Trade Reg. No.: J18/1054/2020</p>
            <p>EUID: ROONRC.J18/1054/2020</p>
            <p>Registered office: Str. Progresului 2, Bl. A29, Sc. 2, Et. 2, Ap. 10, Sat Matasari, Jud. Gorj, Postal Code 217295, Romania</p>
            <p>Phone: 0750 456 096</p>
            <p>Email: contact@hontrio.com</p>
            <p className="text-neutral-500 text-xs mt-2">Hereinafter referred to as "Hontrio", "we" or "the Provider"</p>
          </div>
        </SubSection>
        <SubSection num="1.2" title="The Customer:">
          Any legal entity (company, sole trader, individual enterprise) or authorized individual who creates an account on the Platform and uses the Services for professional or commercial purposes. Hontrio is a platform intended exclusively for professional and commercial use, not for individual consumers.
        </SubSection>
        <SubSection num="1.3" title="Definitions:">
          <UL items={[
            'Platform — the web application accessible at hontrio.com and all its subdomains',
            'Services — all features available through the Platform, including AI image generation, SEO optimization, AI conversation agent and order protection module, as well as any future features',
            'Account — the Customer\'s personal space created through registration, protected by access credentials',
            'Credits — virtual units purchased by the Customer and consumed to use the AI features of the Platform',
            'Store — the Customer\'s e-commerce platform connected to Hontrio',
            'Store Data — products, orders, customers and any other information transferred from the Store to the Platform',
            'Generated Content — any text, image or other material produced by the Platform as a result of the Customer\'s use of the Services',
            'Sub-processors — third-party service providers used by Hontrio to deliver the Services, including AI model providers, cloud infrastructure and payment processors',
          ]} />
        </SubSection>
      </>
    ),
  },
  {
    id: 'art2',
    number: 'Article 2',
    title: 'Subject matter and description of services',
    content: (
      <>
        <SubSection num="2.1">
          Hontrio provides the Customer, for a fee, access to a SaaS platform for e-commerce optimization, including the following service categories:
          <UL items={[
            'Automatic generation of professional product images using artificial intelligence models',
            'Generation and optimization of SEO text content for products, including titles, descriptions and meta descriptions',
            'Configurable AI conversation agent, integrable into the Customer\'s Store',
            'Risk analysis and scoring system for orders and customers of the Customer\'s Store',
            'Bidirectional synchronization with the Customer\'s e-commerce platform',
            'Any other features announced and made available on the Platform',
          ]} />
        </SubSection>
        <SubSection num="2.2">Services are provided on the basis of a monthly or annual subscription, according to the plan chosen by the Customer at registration or upgrade.</SubSection>
        <SubSection num="2.3">Hontrio reserves the right to add, modify or remove Platform features, with prior notice to active Customers pursuant to Article 12.</SubSection>
        <SubSection num="2.4">Access to the Platform is made exclusively through the web interface or the API provided by Hontrio. The Customer has no right to access the underlying technical infrastructure.</SubSection>
      </>
    ),
  },
  {
    id: 'art3',
    number: 'Article 3',
    title: 'Account registration and eligibility',
    content: (
      <>
        {[
          { num: '3.1', text: 'To use the Platform, the Customer must create an account by providing complete, accurate and up-to-date information, including: entity name, contact details, valid email address and billing information.' },
          { num: '3.2', text: 'The Customer warrants that they have the legal capacity and authorization to enter into this agreement on behalf of the entity they represent.' },
          { num: '3.3', text: 'Each entity may hold a single account. Creating multiple accounts to circumvent plan limits or gain undue advantages is prohibited and may result in suspension of all associated accounts.' },
          { num: '3.4', text: 'The Customer is responsible for the confidentiality of their access credentials and for all activities carried out through their account. Hontrio shall not be liable for losses resulting from unauthorized use of the account due to the Customer\'s failure to maintain confidentiality.' },
          { num: '3.5', text: 'The Customer must notify Hontrio immediately upon becoming aware of any unauthorized access to their account at contact@hontrio.com.' },
        ].map(({ num, text }) => <SubSection key={num} num={num}>{text}</SubSection>)}
      </>
    ),
  },
  {
    id: 'art4',
    number: 'Article 4',
    title: 'Financial terms',
    content: (
      <>
        <SubSection num="4.1" title="Service pricing:">The applicable rates are those displayed on the Platform at the time of subscription. Hontrio reserves the right to modify rates with a minimum 30-day prior notice. Rate changes do not affect already-paid subscription periods.</SubSection>
        <SubSection num="4.2" title="Billing and payment:">Subscriptions are billed in advance, at the beginning of each billing period (monthly or annual). Payment is made through the methods accepted by the Platform at the time of the transaction. Invoices are issued electronically and made available to the Customer in the dedicated section of their account.</SubSection>
        <SubSection num="4.3" title="Late payment:">In the event of non-payment by the due date, Hontrio may suspend access to the Services after a grace period of 7 calendar days from the due date, with prior notice to the Customer. Access is restored within a maximum of 24 hours from payment confirmation.</SubSection>
        <SubSection num="4.4" title="Credits:">Purchased credits are valid for the duration of the active subscription and do not automatically roll over to the next period, unless the chosen plan provides otherwise. Unused credits upon contract termination are non-refundable.</SubSection>
        <SubSection num="4.5" title="Refund policy:">
          Given the digital nature of the Services and the technical resource consumption at delivery, payments for subscriptions and credits are non-refundable, except in the following situations:
          <UL items={[
            'Total technical inability to access the Platform for a continuous period of more than 72 hours due to Hontrio\'s fault',
            'Demonstrable billing error (multiple charges or incorrect amount)',
          ]} />
          Refund requests must be sent to contact@hontrio.com within a maximum of 14 days from the transaction date, with a description of the circumstances.
        </SubSection>
        <SubSection num="4.6" title="Taxes:">Displayed prices may exclude VAT. Applicable VAT under current Romanian legislation will be added at billing. Customers outside Romania are responsible for any local taxes applicable in their jurisdiction.</SubSection>
      </>
    ),
  },
  {
    id: 'art5',
    number: 'Article 5',
    title: 'Customer rights and obligations',
    content: (
      <>
        <SubSection num="5.1" title="Rights:">
          <UL items={[
            'Access to the Services included in the chosen plan for the duration of the active subscription',
            'Export of Store Data and Generated Content at any time in standard formats',
            'Technical support according to the level included in the chosen plan',
            'Prior notice of any material change to the Services or Terms',
          ]} />
        </SubSection>
        <SubSection num="5.2" title="Obligations:">
          <UL items={[
            'Provide accurate and up-to-date information at registration and during use',
            'Use the Platform exclusively for lawful purposes and in accordance with these Terms',
            'Not attempt unauthorized access to other users\' accounts or to the Platform infrastructure',
            'Not use the Services to generate illegal, fraudulent, defamatory, discriminatory or rights-infringing content',
            'Not reverse-engineer, decompile or attempt to extract the Platform\'s source code',
            'Respect the usage limits of the chosen plan without using technical means to circumvent them',
            'Notify Hontrio immediately of any security vulnerability discovered',
          ]} />
        </SubSection>
        <SubSection num="5.3" title="Acceptable use:">
          The Customer undertakes not to use the Platform for:
          <UL items={[
            'Generating content that infringes third-party intellectual property rights',
            'Processing personal data without an appropriate legal basis',
            'Activities that could damage the reputation or technical operation of the Platform',
            'Activities contrary to applicable legislation in Romania, the EU or the Customer\'s jurisdiction',
          ]} />
        </SubSection>
      </>
    ),
  },
  {
    id: 'art6',
    number: 'Article 6',
    title: 'Hontrio rights and obligations',
    content: (
      <>
        <SubSection num="6.1" title="Rights:">
          <UL items={[
            'To modify, suspend or cease providing any Service with prior notice to Customers',
            'To suspend access of a Customer who violates these Terms, after prior notice or immediately in the case of serious violations',
            'To use aggregated and anonymized data about Platform usage to improve the Services',
          ]} />
        </SubSection>
        <SubSection num="6.2" title="Obligations:">
          <UL items={[
            'To provide the Services with reasonable diligence and in accordance with the description published on the Platform',
            'To maintain the confidentiality of Store Data and not use it for purposes other than providing the Services',
            'To notify the Customer at least 30 days before any material change to the Services or Terms',
            'To notify the Customer within 72 hours of discovering any security incident affecting their data',
            'To maintain adequate technical and organizational measures for the protection of processed data',
          ]} />
        </SubSection>
      </>
    ),
  },
  {
    id: 'art7',
    number: 'Article 7',
    title: 'Intellectual property',
    content: (
      <>
        {[
          { num: '7.1', title: 'Hontrio ownership:', text: 'The Platform, including source code, interface, algorithms, branding, documentation and any element of the Services, is the exclusive property of SC VOID SFT GAMES SRL or its licensors. This agreement does not transfer any ownership rights in the Platform to the Customer.' },
          { num: '7.2', title: 'Customer ownership:', text: 'Store Data remains the exclusive property of the Customer. Hontrio does not claim any ownership rights over it.' },
          { num: '7.3', title: 'Generated Content:', text: 'Content generated by the Platform based on data provided by the Customer (images, texts, analyses) belongs to the Customer, who acquires full commercial usage rights. Hontrio does not claim rights to the Generated Content and does not use it for purposes other than delivering the Service.' },
          { num: '7.4', title: 'Limited license:', text: 'By connecting the Store to the Platform, the Customer grants Hontrio a limited, non-exclusive, revocable license strictly necessary to provide the contracted Services: accessing, processing and temporarily storing Store Data exclusively for the purpose of generating the requested Content.' },
          { num: '7.5', title: 'Feedback:', text: 'Any suggestions or feedback provided by the Customer regarding the Platform may be used by Hontrio to improve the Services, without any compensation obligations.' },
        ].map(({ num, title, text }) => (
          <SubSection key={num} num={num} title={title}>{text}</SubSection>
        ))}
      </>
    ),
  },
  {
    id: 'art8',
    number: 'Article 8',
    title: 'Personal data protection',
    content: (
      <>
        <SubSection num="8.1" title="Capacity of the parties:">In the context of using the Platform, the Customer acts as a Controller of personal data with respect to their customers' data, and Hontrio acts as a Processor on behalf of the Customer for processing such data, in accordance with EU Regulation 2016/679 (GDPR).</SubSection>
        <SubSection num="8.2" title="Data Processing Agreement (DPA):">The processing of personal data by Hontrio as Processor is governed by the Data Processing Agreement, which forms an integral part of this agreement and is deemed accepted upon acceptance of these Terms.</SubSection>
        <SubSection num="8.3" title="Customer personal data:">Personal data of the Customer's representatives (name, email, billing data) is processed by Hontrio as Controller, in accordance with the Privacy Policy.</SubSection>
        <SubSection num="8.4" title="Sub-processors:">
          Hontrio uses the following main sub-processors to deliver the Services:
          <UL items={[
            'Supabase Inc. — database infrastructure (USA, covered by EU-US Data Privacy Framework)',
            'Vercel Inc. — hosting infrastructure (USA, covered by EU-US Data Privacy Framework)',
            'OpenAI LLC — text generation and embeddings models (USA, covered by EU-US Data Privacy Framework)',
            'Stripe Inc. — payment processing (USA, covered by EU-US Data Privacy Framework)',
          ]} />
          Hontrio will notify the Customer at least 10 days before adding any new sub-processor that processes personal data of the Customer or their customers.
        </SubSection>
        <SubSection num="8.5" title="International transfers:">For data transfers to sub-processors established in countries outside the EEA, Hontrio uses transfer mechanisms approved by the European Commission (Standard Contractual Clauses or adequacy decisions), ensuring an equivalent level of protection to that guaranteed by GDPR.</SubSection>
      </>
    ),
  },
  {
    id: 'art9',
    number: 'Article 9',
    title: 'Confidentiality',
    content: (
      <>
        {[
          { num: '9.1', text: 'Each party undertakes to maintain the confidentiality of confidential information received from the other party and not to disclose it to third parties without the prior written consent of the disclosing party.' },
          { num: '9.2', text: 'The confidentiality obligation does not apply to information that: is or becomes public without fault of the receiving party, was known prior to receipt, is lawfully received from a third party without restrictions, or must be disclosed by law or court order.' },
          { num: '9.3', text: 'Hontrio will not sell, rent or transfer Store Data to third parties for commercial purposes. Data is used exclusively to provide the contracted Services.' },
          { num: '9.4', text: 'The confidentiality obligation survives the termination of this agreement for a period of 3 years.' },
        ].map(({ num, text }) => <SubSection key={num} num={num}>{text}</SubSection>)}
      </>
    ),
  },
  {
    id: 'art10',
    number: 'Article 10',
    title: 'Service availability and SLA',
    content: (
      <>
        {[
          { num: '10.1', text: 'Hontrio makes reasonable efforts to ensure Platform availability of at least 99% of the time, calculated monthly, except for planned maintenance periods.' },
          { num: '10.2', text: 'Planned maintenance is carried out, where possible, outside peak hours (preferably between 02:00 and 06:00 Romanian time) and is announced at least 24 hours in advance by email or Platform notification.' },
          { num: '10.3', text: 'Hontrio does not guarantee uninterrupted availability of third-party AI services (image generation models, text models) and cannot be held liable for interruptions caused by these providers, but will make reasonable efforts to identify and implement alternatives.' },
          { num: '10.4', text: 'In the event of total Platform unavailability for a continuous period of more than 72 hours due to Hontrio\'s exclusive fault, affected Customers may request compensation in the form of additional credits or extension of the subscription period for the duration of the unavailability, at Hontrio\'s discretion.' },
        ].map(({ num, text }) => <SubSection key={num} num={num}>{text}</SubSection>)}
      </>
    ),
  },
  {
    id: 'art11',
    number: 'Article 11',
    title: 'Limitation of liability',
    content: (
      <>
        <SubSection num="11.1">The Platform is provided "as is", without express or implied warranties regarding fitness for a specific purpose or absence of errors.</SubSection>
        <SubSection num="11.2">
          Hontrio shall not be liable for:
          <UL items={[
            'The Customer\'s indirect, incidental, special or consequential losses, including loss of profits, revenue or business opportunities',
            'AI-generated content that does not meet the Customer\'s expectations, given the probabilistic nature of artificial intelligence models',
            'Losses resulting from improper use of the Platform or non-compliance with these Terms by the Customer',
            'Service interruptions caused by factors beyond Hontrio\'s reasonable control (force majeure, cyber attacks, third-party provider failures)',
            'Commercial decisions made by the Customer based on analyses and recommendations generated by the Platform',
          ]} />
        </SubSection>
        <SubSection num="11.3">Hontrio\'s total cumulative liability to the Customer for any claims arising from or in connection with this agreement, regardless of legal basis, is limited to the amounts actually paid by the Customer to Hontrio in the 3 calendar months preceding the event giving rise to liability.</SubSection>
        <SubSection num="11.4">The liability limitations set forth in this article do not apply in cases of fraud or gross negligence by Hontrio, or in cases where applicable law prohibits the limitation of liability.</SubSection>
      </>
    ),
  },
  {
    id: 'art12',
    number: 'Article 12',
    title: 'Amendment of terms',
    content: (
      <>
        {[
          { num: '12.1', text: 'Hontrio may amend these Terms at any time, with notification to active Customers by email at least 30 days before the amendments take effect.' },
          { num: '12.2', text: 'The notification will clearly describe the nature of the changes and their effective date. Previous versions of the Terms will be archived and available upon request.' },
          { num: '12.3', text: 'Continued use of the Platform after the effective date of changes constitutes the Customer\'s acceptance of the new Terms. If the Customer does not accept the changes, they may terminate the contract without penalty before the effective date, in accordance with Article 13.' },
          { num: '12.4', text: 'Changes that introduce substantial additional obligations for the Customer or significantly reduce the Services included in the paid plan cannot be imposed retroactively for the already-paid subscription period.' },
        ].map(({ num, text }) => <SubSection key={num} num={num}>{text}</SubSection>)}
      </>
    ),
  },
  {
    id: 'art13',
    number: 'Article 13',
    title: 'Contract duration, termination and data portability',
    content: (
      <>
        <SubSection num="13.1" title="Duration:">The contract is concluded for the duration of the chosen subscription (monthly or annual) and automatically renews at the end of each period, unless either party notifies their intention not to renew at least 7 days before the renewal date.</SubSection>
        <SubSection num="13.2" title="Termination by the Customer:">Pursuant to EU Regulation 2023/2854 (EU Data Act), the Customer may terminate this contract at any time, with a maximum notice period of 2 months. The Customer cannot be penalized with the total amount remaining on the fixed-term contract. Any early termination penalty, if provided for in the chosen plan, must be proportional to Hontrio\'s actual loss and cannot constitute a barrier to switching providers.</SubSection>
        <SubSection num="13.3" title="Termination by Hontrio:">Hontrio may terminate the contract with 30 days\' notice to the Customer, without needing to justify the decision. In the event of a serious breach of these Terms by the Customer (fraud, illegal activity, attempted unauthorized access), Hontrio may suspend or terminate the contract immediately, without notice.</SubSection>
        <SubSection num="13.4" title="Data portability and export:">
          Pursuant to the EU Data Act, the Customer has the right to full data portability. Upon contract termination, regardless of the reason:
          <UL items={[
            'Hontrio makes available to the Customer, within 30 calendar days from the termination date, all Store Data and Generated Content in structured, commonly used and machine-readable formats',
            'Data export is free of charge and cannot be conditioned on payment of additional fees',
            'Data remains accessible for a minimum of 30 days after access to the Platform ceases',
            'After this retention period expires, Hontrio irreversibly deletes the Customer\'s data from its systems, except for data it is legally required to retain',
          ]} />
        </SubSection>
        <SubSection num="13.5" title="Effects of termination:">Upon termination of the contract, regardless of the reason: Customer access to the Platform is closed, unused credits are cancelled without compensation, confidentiality obligations remain in force pursuant to Article 9.</SubSection>
      </>
    ),
  },
  {
    id: 'art14',
    number: 'Article 14',
    title: 'Force majeure',
    content: (
      <>
        {[
          { num: '14.1', text: 'Neither party shall be liable for failure to perform or delayed performance of contractual obligations caused by force majeure events, defined as unforeseeable, unavoidable events independent of the affected party\'s will, including: natural disasters, acts of war or terrorism, officially declared pandemics, acts of public authorities, major internet infrastructure failures at global or regional level.' },
          { num: '14.2', text: 'The party affected by force majeure will notify the other party within 5 business days of the event occurring and will make reasonable efforts to limit its effects.' },
          { num: '14.3', text: 'If the force majeure event persists for more than 30 calendar days, either party may terminate the contract without penalty, with notice to the other party.' },
        ].map(({ num, text }) => <SubSection key={num} num={num}>{text}</SubSection>)}
      </>
    ),
  },
  {
    id: 'art15',
    number: 'Article 15',
    title: 'Provisions regarding AI use',
    content: (
      <>
        <SubSection num="15.1">
          Hontrio\'s Services use artificial intelligence models to generate content. The Customer understands and accepts that:
          <UL items={[
            'AI-generated content is probabilistic in nature and may contain inaccuracies, errors or unexpected results',
            'The Customer is responsible for reviewing and validating Generated Content before publishing or commercial use',
            'Hontrio does not guarantee that Generated Content is unique, free of third-party copyright or suitable for any specific purpose',
          ]} />
        </SubSection>
        <SubSection num="15.2">
          The Customer will not use the Services to generate content that:
          <UL items={[
            'Infringes third-party intellectual property rights',
            'Is illegal, fraudulent, defamatory, discriminatory or offensive',
            'Constitutes false or misleading information intended for the public',
            'Contains personal data of third parties without their consent',
          ]} />
        </SubSection>
        <SubSection num="15.3">Data provided by the Customer is not used to train third-party AI models, to the extent that agreements with these providers allow for the exclusion of such use.</SubSection>
      </>
    ),
  },
  {
    id: 'art16',
    number: 'Article 16',
    title: 'Risk Shield global blacklist',
    content: (
      <>
        {[
          { num: '16.1', text: 'The Risk Shield module includes an optional global blacklist feature shared among platform users. Participation is voluntary and can be configured from the account settings.' },
          { num: '16.2', text: 'Before participating in the global blacklist, the Customer undertakes to ensure they have an appropriate legal basis for processing and sharing, in anonymized form, the identifying data of their high-risk customers.' },
          { num: '16.3', text: 'Data shared in the global blacklist is irreversibly hashed (SHA-256) before transmission. No directly identifiable personal information is stored or shared in plain form.' },
          { num: '16.4', text: 'The Customer remains solely responsible for commercial decisions made based on information from the global blacklist (order refusal, requiring advance payment, etc.) and for the compliance of these decisions with applicable legislation, including personal data protection law.' },
        ].map(({ num, text }) => <SubSection key={num} num={num}>{text}</SubSection>)}
      </>
    ),
  },
  {
    id: 'art17',
    number: 'Article 17',
    title: 'Applicable law and dispute resolution',
    content: (
      <>
        <SubSection num="17.1" title="Applicable law:">This agreement is governed by Romanian law, supplemented by applicable European regulations and directives, in particular GDPR and the EU Data Act.</SubSection>
        <SubSection num="17.2" title="Amicable settlement:">Any dispute arising from or in connection with this agreement will first be settled amicably. Either party may notify the other party in writing, at the addresses mentioned in Article 1, and the parties will make good-faith efforts to reach a solution within 30 days of receiving the notification.</SubSection>
        <SubSection num="17.3" title="Competent court:">Should disputes not be resolved amicably, they shall be submitted to the competent courts at the registered office of SC VOID SFT GAMES SRL, namely the courts of Gorj County, Romania.</SubSection>
        <SubSection num="17.4" title="International customers:">Without prejudice to mandatory rights conferred by local legislation applicable to Customers established in other EU member states, the parties agree that Romanian law governs the interpretation and performance of this agreement to the extent permitted by applicable law.</SubSection>
      </>
    ),
  },
  {
    id: 'art18',
    number: 'Article 18',
    title: 'Final provisions',
    content: (
      <>
        <SubSection num="18.1" title="Entire agreement:">These Terms, together with the Privacy Policy and the Data Processing Agreement, constitute the entire agreement between the parties regarding their subject matter and supersede any prior understandings, written or oral, relating to the same subject matter.</SubSection>
        <SubSection num="18.2" title="Severability:">If any provision of these Terms is declared invalid or unenforceable by a competent court, that provision will be modified to the minimum extent necessary to become valid, and the remainder of the Terms remains in force and fully effective.</SubSection>
        <SubSection num="18.3" title="Waiver:">Failure by either party to assert any right provided in these Terms does not constitute a waiver of that right and does not affect the ability to invoke it subsequently.</SubSection>
        <SubSection num="18.4" title="Assignment:">The Customer may not assign the rights or obligations under this agreement to a third party without Hontrio\'s prior written consent. Hontrio may assign this agreement to a successor in a corporate restructuring, merger or acquisition, with notice to Customers.</SubSection>
        <SubSection num="18.5" title="Communications:">All official notices are sent by email to the addresses provided at registration. Notices to Hontrio are sent to contact@hontrio.com. Notices are deemed received 24 hours after sending, unless a non-delivery notification is returned.</SubSection>
        <SubSection num="18.6" title="Current version:">The current version of the Terms is always accessible at hontrio.com/legal/terms. Previous versions are archived and available upon request.</SubSection>
      </>
    ),
  },
]

// ─── TOC titles ───────────────────────────────────────────────────────────────

const tocRO = [
  'Partile contractante si definitii',
  'Obiectul contractului si descrierea serviciilor',
  'Inregistrarea contului si eligibilitatea',
  'Conditiile financiare',
  'Drepturile si obligatiile Clientului',
  'Drepturile si obligatiile Hontrio',
  'Proprietate intelectuala',
  'Protectia datelor cu caracter personal',
  'Confidentialitate',
  'Disponibilitatea serviciului si SLA',
  'Limitarea raspunderii',
  'Modificarea termenilor',
  'Durata contractului, reziliere si portabilitatea datelor',
  'Forta majora',
  'Dispozitii privind utilizarea AI',
  'Blacklist-ul global Risk Shield',
  'Legea aplicabila si solutionarea disputelor',
  'Dispozitii finale',
]

const tocEN = [
  'Contracting parties and definitions',
  'Subject matter and description of services',
  'Account registration and eligibility',
  'Financial terms',
  'Customer rights and obligations',
  'Hontrio rights and obligations',
  'Intellectual property',
  'Personal data protection',
  'Confidentiality',
  'Service availability and SLA',
  'Limitation of liability',
  'Amendment of terms',
  'Contract duration, termination and data portability',
  'Force majeure',
  'Provisions regarding AI use',
  'Risk Shield global blacklist',
  'Applicable law and dispute resolution',
  'Final provisions',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TermsPage() {
  const { locale } = useLocale()
  const isRO = locale === 'ro'
  const shouldReduce = useReducedMotion() ?? false
  const [showTop, setShowTop] = useState(false)

  const articles = isRO ? articlesRO : articlesEN
  const toc = isRO ? tocRO : tocEN
  const effectiveDate = isRO ? EFFECTIVE_DATE_RO : EFFECTIVE_DATE_EN

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
              <FileText className="h-3.5 w-3.5" />
              {isRO ? 'Document legal' : 'Legal document'}
            </div>
          </motion.div>
          <motion.h1 {...fadeUp(0.06)} className="text-4xl md:text-5xl font-black text-neutral-900 tracking-tight mb-6">
            {isRO ? 'Termeni si Conditii de Utilizare' : 'Terms and Conditions of Use'}
          </motion.h1>
          <motion.p {...fadeUp(0.1)} className="text-neutral-500 text-base leading-relaxed mb-8 max-w-2xl">
            {isRO
              ? 'Prezentul document constituie un acord juridic obligatoriu intre SC VOID SFT GAMES SRL, operatorul platformei Hontrio, si orice persoana care acceseaza sau utilizeaza platforma. Te rugam sa citesti cu atentie inainte de a crea un cont sau de a utiliza orice functionalitate. Utilizarea platformei reprezinta acceptul tau expres fata de toti termenii de mai jos.'
              : 'This document constitutes a legally binding agreement between SC VOID SFT GAMES SRL, the operator of the Hontrio platform, and any person who accesses or uses the platform. Please read carefully before creating an account or using any feature. Use of the platform constitutes your express acceptance of all the terms below.'}
          </motion.p>
          <motion.div {...fadeUp(0.14)} className="flex flex-wrap gap-4">
            {[
              { label: isRO ? 'Versiunea' : 'Version', value: VERSION },
              { label: isRO ? 'In vigoare din' : 'Effective from', value: effectiveDate },
              { label: isRO ? 'Ultima actualizare' : 'Last updated', value: effectiveDate },
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

          {/* ── TOC sidebar ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
                {isRO ? 'Cuprins' : 'Table of contents'}
              </p>
              <nav className="space-y-1">
                {toc.map((title, i) => (
                  <button
                    key={i}
                    onClick={() => scrollTo(`art${i + 1}`)}
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

          {/* ── Articles ── */}
          <div className="min-w-0">
            {/* Mobile TOC */}
            <details className="lg:hidden mb-8 rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-semibold text-neutral-700 select-none">
                {isRO ? 'Cuprins' : 'Table of contents'}
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </summary>
              <div className="px-4 pb-4 space-y-1">
                {toc.map((title, i) => (
                  <button
                    key={i}
                    onClick={() => scrollTo(`art${i + 1}`)}
                    className="flex items-start gap-2 w-full text-left py-1.5"
                  >
                    <span className="shrink-0 text-[11px] font-mono text-neutral-400 mt-0.5 w-5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[12px] text-neutral-600 leading-snug">{title}</span>
                  </button>
                ))}
              </div>
            </details>

            {/* Article sections */}
            <div className="space-y-12">
              {articles.map((article, i) => (
                <motion.section
                  key={article.id}
                  id={article.id}
                  initial={shouldReduce ? undefined : { opacity: 0, y: 20 }}
                  whileInView={shouldReduce ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.05 }}
                  transition={{ duration: 0.45, ease: E }}
                  className="scroll-mt-24"
                >
                  <div className="flex items-center gap-3 mb-5 pb-3 border-b border-neutral-100">
                    <span className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                      {article.number}
                    </span>
                    <h2 className="text-base font-bold text-neutral-900">{article.title}</h2>
                  </div>
                  <div className="text-sm leading-relaxed">
                    {article.content}
                  </div>
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
                <p className="text-sm text-neutral-600 leading-relaxed">
                  {isRO
                    ? 'Daca ai intrebari privind prezentii Termeni, ne poti contacta la adresa de mai jos sau la adresa sediului social mentionat in Articolul 1.'
                    : 'If you have any questions regarding these Terms, you can contact us at the address below or at the registered office mentioned in Article 1.'}
                </p>
                <a
                  href="mailto:contact@hontrio.com"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  contact@hontrio.com
                </a>
                <p className="text-xs text-neutral-400 pt-2 leading-relaxed">
                  {isRO
                    ? 'Nota: Acest document a fost elaborat pe baza unui research juridic detaliat. Inainte de a modifica sau interpreta clauzele cu consecinte juridice semnificative, recomandam consultarea unui avocat specializat in drept IT si protectia datelor.'
                    : 'Note: This document was prepared based on detailed legal research. Before modifying or interpreting clauses with significant legal consequences, we recommend consulting a lawyer specializing in IT law and data protection.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Back to top ── */}
      {showTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-10 h-10 rounded-full bg-neutral-900 text-white shadow-lg hover:bg-neutral-700 transition-colors"
        >
          <ArrowUp className="h-4 w-4" />
        </motion.button>
      )}
    </main>
  )
}
