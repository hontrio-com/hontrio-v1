import type { Metadata } from 'next'
import { getLocale } from '@/lib/i18n/server'
import { A, Clause, Code, Company, L, LegalPage, Mail, OL, P, UL, type LegalDoc } from '../legal-page'

// =============================================
// Termenii și condițiile, în română și în engleză. Descriu serviciul de acum:
// mandatul în Google Ads și Merchant Center, cele două moduri ale pilotului
// (ce face singur în fiecare), costul reclamelor plătit direct la Google,
// tarifele viitoare, răspunderea și clauzele acceptate expres (art. 1203 Cod civil).
// Regulile pilotului de aici trebuie să rămână la fel cu lib/ads/optimizer.ts.
// =============================================

const THIRD_PARTY = 'https://support.google.com/adspolicy/answer/9457109'

const RO: LegalDoc = {
  title: 'Termeni și condiții',
  summary: <>Contractul dintre VOID SFT GAMES SRL și firma care folosește Hontrio. Hontrio e un serviciu doar pentru firme. Clauzele de la articolul 17 se acceptă separat și expres, la crearea contului.</>,
  sections: [
    {
      id: 'parti', title: 'Părțile și încheierea contractului',
      body: <>
        <Clause n="1.1"><P><strong>Furnizorul</strong> este următoarea firmă, numită în continuare „Hontrio” sau „noi”:</P><Company locale="ro" /></Clause>
        <Clause n="1.2"><P><strong>Clientul</strong>, numit în continuare „tu”, este firma care își creează un cont Hontrio: o persoană juridică sau un profesionist (PFA, întreprindere individuală sau familială) care folosește Hontrio în activitatea sa comercială. Persoana care creează contul declară că are dreptul să reprezinte firma.</P></Clause>
        <Clause n="1.3"><P>Hontrio nu se adresează consumatorilor. Dacă nu acționezi în scop profesional, nu folosi serviciul.</P></Clause>
        <Clause n="1.4"><P>Contractul se încheie când îți creezi contul și accepți acești Termeni și <L href="/legal/dpa">Acordul de prelucrare a datelor</L>, după ce ai citit <L href="/legal/privacy">Politica de confidențialitate</L>. Versiunea acceptată și data acceptării se păstrează în contul tău.</P></Clause>
      </>,
    },
    {
      id: 'serviciul', title: 'Ce face Hontrio',
      body: <>
        <Clause n="2.1"><P>Hontrio conectează magazinul tău online (Edinio, WooCommerce sau Shopify) și conturile tale Google Ads și Google Merchant Center, face din produsele magazinului campanii Google Shopping sau Performance Max, le îngrijește zilnic prin pilotul automat și îți arată rapoarte și recomandări pentru catalog.</P></Clause>
        <Clause n="2.2"><P>Ca să folosești Hontrio ai nevoie de un cont Google Ads cu o metodă de plată activă, de un cont Merchant Center cu produsele magazinului și de măsurarea conversiei de cumpărare în Google Ads. Hontrio le verifică înainte de lansare, dar configurarea lor corectă e responsabilitatea ta.</P></Clause>
        <Clause n="2.3"><P>Magazinul doar îl citim: Hontrio nu modifică produsele, comenzile sau alte date din magazin.</P></Clause>
        <Clause n="2.4"><P>Putem schimba, adăuga sau scoate funcții. Dacă o schimbare îți reduce semnificativ serviciul, te anunțăm cu cel puțin 30 de zile înainte.</P></Clause>
      </>,
    },
    {
      id: 'contul', title: 'Contul',
      body: <>
        <Clause n="3.1"><P>Datele din cont trebuie să fie corecte, iar adresa de e-mail confirmată.</P></Clause>
        <Clause n="3.2"><P>Răspunzi de păstrarea în siguranță a datelor de acces și de ce fac în cont persoanele cărora le dai acces. Dacă bănuiești un acces neautorizat, scrie-ne imediat la <Mail to="support@hontrio.com" />.</P></Clause>
      </>,
    },
    {
      id: 'mandat', title: 'Mandatul pentru Google Ads și Merchant Center',
      body: <>
        <Clause n="4.1">
          <P>Conectând Google, ne autorizezi să accesăm, prin Google OAuth și în limitele permisiunilor aprobate de tine, contul Google Ads ales pentru magazin și contul tău Merchant Center, și să acționăm în numele tău pentru:</P>
          <OL items={[
            'citirea datelor de care are nevoie serviciul, descrise în Politica de confidențialitate;',
            'crearea, modificarea, punerea pe pauză, repornirea și încheierea campaniilor Hontrio, cu bugetul, țara, limba, lista de produse și cuvintele negative ale acestora;',
            'mutarea unei campanii Shopping pe Performance Max, după regulile de la articolul 6;',
            'crearea în Merchant Center a sursei de date suplimentare „Hontrio”, legarea ei de sursele tale de produse și scrierea unei etichete (custom label) pe produsele scoase din campanii;',
            'numai dacă alegi asta la lansare: punerea pe pauză a campaniilor tale existente care vând aceleași produse și completarea, pe campaniile tale existente, a declarației privind publicitatea politică în UE, cerute de Google.',
          ]} />
        </Clause>
        <Clause n="4.2"><P>Campaniile Hontrio le declarăm la Google ca nefiind publicitate politică în UE. Confirmi că produsele și reclamele tale nu sunt publicitate politică; dacă ar putea fi, nu folosi Hontrio pentru ele. Tot tu răspunzi de corectitudinea declarației pe care o confirmi pentru campaniile tale existente.</P></Clause>
        <Clause n="4.3"><P>La adresele reclamelor din campaniile Hontrio adăugăm parametrii <Code>utm_source=google</Code>, <Code>utm_medium=cpc</Code> și <Code>utm_campaign=hontrio-ID</Code>, unde ID e numărul campaniei, ca să se vadă ce vânzări aduc.</P></Clause>
        <Clause n="4.4"><P>Contul Google Ads rămâne al tău și îl controlezi oricând: poți opri sau modifica direct din Google Ads orice campanie. Schimbările făcute direct în Google Ads la o campanie Hontrio pot fi înlocuite de pilot cu planul din Hontrio (de exemplu lista de produse), așa că e bine să schimbi campaniile Hontrio din Hontrio.</P></Clause>
        <Clause n="4.5"><P>Hontrio e un furnizor independent: nu este Google și nu e afiliat cu Google. Google Ads și Google Merchant Center sunt mărci ale Google LLC.</P></Clause>
        <Clause n="4.6"><P>Ce să aștepți de la cineva care îți administrează reclamele Google explică Google în ghidul <A href={THIRD_PARTY}>„Working with a third party”</A>. La cerere, îți comunicăm ID-urile conturilor Google Ads în care lucrăm pentru tine.</P></Clause>
      </>,
    },
    {
      id: 'costuri', title: 'Costul reclamelor',
      body: <>
        <Clause n="5.1"><P>Reclamele le plătești direct la Google, după contractul tău cu Google. Hontrio nu încasează și nu administrează banii pentru reclame.</P></Clause>
        <Clause n="5.2"><P>Bugetul pe zi al fiecărei campanii și bugetul maxim până la care poate ajunge pilotul le alegi tu. După regulile Google, o campanie poate cheltui într-o zi până la dublul bugetului zilnic, dar Google nu facturează pe o lună mai mult de 30,4 ori bugetul zilnic.</P></Clause>
        <Clause n="5.3"><P>Rapoartele din Hontrio arată costurile raportate de Google, fără niciun adaos. Cifrele Google Ads le citim o dată pe zi; ele acoperă perioada până ieri, inclusiv.</P></Clause>
        <Clause n="5.4"><P>Plata facturilor Google, metoda de plată și setările de facturare din contul Google Ads sunt responsabilitatea ta.</P></Clause>
      </>,
    },
    {
      id: 'pilot', title: 'Pilotul automat',
      body: <>
        <Clause n="6.1">
          <P>Pilotul verifică zilnic campaniile Hontrio și face propuneri, fiecare cu motivul ei. Alegi unul din două moduri:</P>
          <OL items={[
            'cu aprobare: pilotul propune, iar tu aprobi sau respingi; propunerile la care nu răspunzi expiră după 7 zile;',
            'automat: pilotul aplică singur propunerile care nu cer aprobare și te anunță.',
          ]} />
        </Clause>
        <Clause n="6.2">
          <P>În ambele moduri, pilotul face singur, fără să te întrebe:</P>
          <OL items={[
            'oprirea de siguranță: pune pe pauză o campanie Hontrio care a cheltuit peste limita de pierdere fără vânzări sau cu vânzări sub costul reclamei și te anunță;',
            'actualizarea listei de produse a campaniilor Hontrio după catalog și după plan: produsele noi intră, iar cele epuizate, nepublicate sau scoase de tine ies;',
            'încheierea campaniilor de grup la data de final pe care ai ales-o.',
          ]} />
        </Clause>
        <Clause n="6.3"><P>În modul automat, pilotul mai aplică singur: cuvinte negative pentru căutările care costă fără să aducă vânzări; scoaterea din campanii a produselor care cheltuie fără vânzări sau aduc vânzări sub costul reclamei; mutarea pe Performance Max a unei campanii Shopping cu destule conversii.</P></Clause>
        <Clause n="6.4"><P>Bugetul crește numai cu aprobarea ta, în ambele moduri. Pilotul propune o creștere de cel mult 20%, cel mult o dată pe săptămână, niciodată peste bugetul maxim ales de tine, iar unei campanii Performance Max noi nu-i schimbă bugetul în primele 6 săptămâni.</P></Clause>
        <Clause n="6.5"><P>Fiecare schimbare făcută de pilot sau de tine prin Hontrio rămâne în jurnalul din aplicație.</P></Clause>
        <Clause n="6.6"><P>Poți schimba oricând modul, limitele și bugetele și poți pune pe pauză sau încheia campaniile, din Hontrio sau direct din Google Ads.</P></Clause>
        <Clause n="6.7"><P>Pilotul lucrează cu datele disponibile din Google și din magazin, care pot avea întârzieri sau erori. Deciziile lui sunt automate, iar o decizie corectă după datele de atunci se poate dovedi, în timp, neoptimă.</P></Clause>
      </>,
    },
    {
      id: 'obligatii', title: 'Obligațiile tale',
      body: <UL items={[
        'să vinzi legal și să respecți politicile Google Ads și Merchant Center, precum și legile privind protecția consumatorilor, prețurile și publicitatea;',
        'să ai dreptul să conectezi magazinul și conturile Google pe care le conectezi;',
        'să ții corecte datele din magazin și din feed: prețuri, stoc, descrieri;',
        'să măsori corect conversiile și să-ți informezi vizitatorii și cumpărătorii despre cookie-uri și despre prelucrarea datelor, cu acordul lor acolo unde legea îl cere, inclusiv după politica Google privind consimțământul utilizatorilor din UE;',
        'să nu folosești Hontrio pentru produse sau reclame interzise ori pentru publicitate politică;',
        'să nu încerci să accesezi conturile altora, să nu copiezi, să nu decompilezi și să nu supraîncarci platforma și să nu o folosești ca să ocolești regulile Google.',
      ]} />,
    },
    {
      id: 'garantii', title: 'Fără garanții de rezultat',
      body: <>
        <Clause n="8.1"><P>Nu garantăm vânzări, un anumit ROAS, poziția reclamelor, numărul de afișări sau de clicuri și nici aprobarea produselor ori a reclamelor de către Google. Google decide licitațiile, pozițiile, aprobările și eventualele suspendări, după regulile lui.</P></Clause>
        <Clause n="8.2"><P>Conversiile raportate de Google pot diferi de comenzile din magazin.</P></Clause>
        <Clause n="8.3"><P>Exemplele și cifrele de pe site sunt ilustrative.</P></Clause>
      </>,
    },
    {
      id: 'tarife', title: 'Tarife',
      body: <>
        <Clause n="9.1"><P>Acum, Hontrio e gratuit. Plătești doar reclamele, direct la Google.</P></Clause>
        <Clause n="9.2"><P>Putem introduce o taxă calculată ca procent din vânzările aduse de campaniile Hontrio, adică din comenzile din magazin a căror sursă are parametrul <Code>utm_campaign</Code> care începe cu „hontrio-”. Te anunțăm în scris, pe e-mail și în aplicație, cu cel puțin 30 de zile înainte, cu procentul, modul de calcul, facturarea și TVA-ul.</P></Clause>
        <Clause n="9.3"><P>Taxa se aplică doar dacă o accepți expres. Dacă nu o accepți, poți înceta contractul fără costuri. Taxa va apărea pe fiecare factură, separat de costul reclamelor, pe care îl plătești în continuare direct la Google.</P></Clause>
      </>,
    },
    {
      id: 'date', title: 'Datele',
      body: <>
        <Clause n="10.1"><P>Datele contului tău le prelucrăm ca operator, după <L href="/legal/privacy">Politica de confidențialitate</L>.</P></Clause>
        <Clause n="10.2"><P>Datele cumpărătorilor din magazinul tău le prelucrăm ca persoană împuternicită, după <L href="/legal/dpa">Acordul de prelucrare a datelor</L>, care face parte din acest contract.</P></Clause>
        <Clause n="10.3"><P>Datele magazinului și ale conturilor tale rămân ale tale. Ne dai dreptul să le folosim doar cât e nevoie ca să-ți furnizăm Hontrio.</P></Clause>
        <Clause n="10.4"><P>Datele primite de la Google le folosim după Politica Google privind datele utilizatorilor din API-uri (Google API Services User Data Policy), inclusiv cerințele Limited Use.</P></Clause>
      </>,
    },
    {
      id: 'proprietate', title: 'Proprietatea intelectuală',
      body: <>
        <Clause n="11.1"><P>Platforma Hontrio (codul, interfața, textele, marca) ne aparține. Îți dăm, pe durata contractului, dreptul neexclusiv și netransmisibil de a o folosi pentru firma ta.</P></Clause>
        <Clause n="11.2"><P>Sugestiile pe care ni le trimiți le putem folosi ca să îmbunătățim Hontrio, fără vreo obligație față de tine.</P></Clause>
      </>,
    },
    {
      id: 'disponibilitate', title: 'Disponibilitatea serviciului',
      body: <>
        <Clause n="12.1"><P>Facem tot ce ține rezonabil de noi ca Hontrio să funcționeze continuu, dar nu garantăm lipsa întreruperilor. Hontrio depinde de Google, de platforma magazinului și de furnizorii noștri.</P></Clause>
        <Clause n="12.2"><P>Dacă pilotul nu poate rula (de exemplu pentru că accesul la Google a expirat), campaniile Hontrio rămân în Google Ads cu setările de atunci și te anunțăm.</P></Clause>
      </>,
    },
    {
      id: 'suspendare', title: 'Suspendarea',
      body: <>
        <Clause n="13.1"><P>Putem suspenda, total sau parțial, accesul la Hontrio ori pilotul automat dacă: încalci acești Termeni sau legea; există un risc de securitate sau de abuz; Google ori platforma magazinului ne cere sau ne restrânge accesul; ne obligă o autoritate; după ce ai acceptat o taxă, nu o plătești la termen.</P></Clause>
        <Clause n="13.2"><P>Te anunțăm înainte, cu motivul, în afara urgențelor; în urgențe, imediat după.</P></Clause>
        <Clause n="13.3"><P>Cât durează suspendarea, campaniile Hontrio rămân în contul tău Google Ads și rulează cu setările de atunci, fără pilot, deci și fără oprirea de siguranță. Le poți opri oricând direct din Google Ads.</P></Clause>
        <Clause n="13.4"><P>Reluăm accesul imediat ce motivul suspendării dispare.</P></Clause>
      </>,
    },
    {
      id: 'incetare', title: 'Durata și încetarea',
      body: <>
        <Clause n="14.1"><P>Contractul e pe durată nedeterminată.</P></Clause>
        <Clause n="14.2"><P>Îl poți înceta oricând, fără preaviz și fără costuri, ștergându-ți contul din Setări sau scriindu-ne la <Mail to="support@hontrio.com" />.</P></Clause>
        <Clause n="14.3"><P>Îl putem înceta cu un preaviz de 30 de zile, trimis pe e-mail, sau imediat, la o încălcare gravă: fraudă, folosire ilegală, atacuri asupra platformei.</P></Clause>
        <Clause n="14.4"><P>La încetare, accesul la Hontrio se închide, accesul la Google se revocă, iar datele se șterg după termenele din Politica de confidențialitate.</P></Clause>
        <Clause n="14.5"><P><strong>Campaniile create de Hontrio sunt în contul tău Google Ads și continuă să ruleze și să cheltuie</strong> după ce deconectezi Google, după ce ștergi magazinul sau contul și după încetarea contractului, până le oprești sau le ștergi tu. Din acel moment Hontrio nu le mai urmărește și nu le mai oprește. Îți recomandăm să le pui pe pauză înainte.</P></Clause>
        <Clause n="14.6"><P>Poți deconecta oricând contul Google Ads din Setări, iar accesul Hontrio se revocă pe loc. Dacă ne ceri în scris, în cel mult 3 zile lucrătoare îți confirmăm că Hontrio nu mai are acces la cont și că ai controlul lui exclusiv.</P></Clause>
      </>,
    },
    {
      id: 'portabilitate', title: 'Exportul datelor și schimbarea furnizorului',
      body: <>
        <Clause n="15.1"><P>Poți descărca oricând, gratuit, din Setări, datele pe care le ai în Hontrio, într-un format structurat (JSON): contul și setările, magazinele conectate, produsele și comenzile sincronizate, campaniile și grupurile, setările și jurnalul pilotului și datele aduse din Google. Nu fac parte din export cheile și tokenurile de acces și nici codul platformei.</P></Clause>
        <Clause n="15.2"><P>Poți trece oricând la alt furnizor, conform Regulamentului (UE) 2023/2854 privind datele: nu cerem preaviz, nu percepem costuri de schimbare și nu aplicăm penalități. Campaniile sunt deja în contul tău Google Ads, deci rămân la tine.</P></Clause>
        <Clause n="15.3"><P>Dacă ne spui că vrei să schimbi furnizorul, contul rămâne disponibil cel puțin 30 de zile ca să-ți exporți datele, iar la cerere te ajutăm cu exportul; apoi ștergem definitiv datele, mai puțin cele pe care legea ne obligă să le păstrăm. Ștergerea contului din Setări e definitivă și imediată, așa că exportă datele înainte.</P></Clause>
      </>,
    },
    {
      id: 'raspundere', title: 'Răspunderea',
      body: <>
        <Clause n="16.1"><P>Răspundem pentru prejudiciile directe pe care ți le cauzăm din vina noastră. Nu răspundem pentru prejudiciile indirecte și nici pentru beneficiul nerealizat, în afara cazurilor de la 16.5.</P></Clause>
        <Clause n="16.2"><P>Nu răspundem pentru: cheltuiala cu reclamele făcută în bugetele alese de tine și după regulile Google; deciziile Google (licitații, aprobări, respingeri, suspendări de cont); erorile din datele magazinului, din feed sau din măsurarea conversiilor; schimbările pe care le faci direct în Google Ads; campaniile lăsate să ruleze după deconectare, ștergere, suspendare sau încetare; întreruperile Google, ale platformei magazinului sau ale furnizorilor noștri.</P></Clause>
        <Clause n="16.3"><P>Dacă, din cauza unei erori a Hontrio, pilotul face o schimbare în afara limitelor alese de tine (de exemplu crește bugetul fără aprobarea ta), răspundem pentru cheltuiala suplimentară cu reclamele rezultată, în limita de la 16.4.</P></Clause>
        <Clause n="16.4"><P>Răspunderea noastră totală față de tine, pentru toate pretențiile legate de acest contract, e limitată la cea mai mare dintre următoarele sume: totalul plătit de tine către Hontrio în ultimele 12 luni înainte de faptul care a cauzat prejudiciul; echivalentul în lei al sumei de 500 de euro, la cursul BNR din ziua plății.</P></Clause>
        <Clause n="16.5"><P>Limitările de la 16.1 și 16.4 nu se aplică prejudiciilor cauzate cu intenție sau din culpă gravă, vătămării integrității corporale sau a sănătății și niciunui alt caz în care legea nu permite limitarea răspunderii.</P></Clause>
      </>,
    },
    {
      id: 'clauze-neuzuale', title: 'Clauzele acceptate expres (art. 1203 Cod civil)',
      body: <>
        <P>Următoarele clauze le accepți separat și expres, prin căsuța dedicată de la crearea contului, și produc efecte doar cu această acceptare:</P>
        <UL items={[
          'limitarea răspunderii (articolul 16);',
          'suspendarea accesului și a pilotului automat (articolul 13);',
          'încetarea contractului de către Hontrio (articolul 14.3);',
          'legea aplicabilă și instanța competentă (articolul 19).',
        ]} />
      </>,
    },
    {
      id: 'modificari', title: 'Modificarea Termenilor',
      body: <>
        <Clause n="18.1"><P>Te anunțăm pe e-mail și în aplicație cu cel puțin 30 de zile înainte de orice modificare, spunându-ți ce se schimbă.</P></Clause>
        <Clause n="18.2"><P>Modificările privind tarifele, clauzele de la articolul 17 sau folosirea în alt scop a datelor primite de la Google se aplică doar dacă le accepți expres. Pentru celelalte, folosirea în continuare după data intrării în vigoare înseamnă acceptarea lor; dacă nu ești de acord, poți înceta contractul înainte, fără costuri.</P></Clause>
        <Clause n="18.3"><P>Modificările impuse de lege sau de Google pot intra în vigoare mai repede, cu anunțarea ta.</P></Clause>
      </>,
    },
    {
      id: 'lege', title: 'Legea și litigiile',
      body: <>
        <Clause n="19.1"><P>Contractul e guvernat de legea română.</P></Clause>
        <Clause n="19.2"><P>Încercăm întâi să rezolvăm amiabil orice neînțelegere, în 30 de zile de la notificarea scrisă.</P></Clause>
        <Clause n="19.3"><P>Dacă nu reușim, litigiul se judecă de instanțele competente de la sediul social al VOID SFT GAMES SRL, în județul Gorj.</P></Clause>
      </>,
    },
    {
      id: 'finale', title: 'Dispoziții finale',
      body: <UL items={[
        'Contractul e format din acești Termeni, Acordul de prelucrare a datelor și clauzele acceptate expres; Politica de confidențialitate și Politica de cookies te informează despre date.',
        'Dacă o clauză e declarată nevalabilă, celelalte rămân în vigoare.',
        'Putem transfera contractul unui succesor, la o reorganizare, fuziune sau vânzare a afacerii, cu anunțarea ta; tu îl poți transfera doar cu acordul nostru scris.',
        'Niciuna dintre părți nu răspunde pentru neexecutarea cauzată de forța majoră (art. 1351 Cod civil).',
        'Comunicările ți le trimitem la adresa de e-mail a contului; nouă ne scrii la contact@hontrio.com sau la support@hontrio.com.',
        'Termenii sunt disponibili în română și în engleză; dacă versiunile diferă, prevalează cea în română.',
        'Versiunea în vigoare: 2026-11-12. Versiunile anterioare le poți cere la contact@hontrio.com.',
      ]} />,
    },
  ],
}

const EN: LegalDoc = {
  title: 'Terms and Conditions',
  summary: <>The contract between VOID SFT GAMES SRL and the business using Hontrio. Hontrio is a service for businesses only. The clauses in article 17 are accepted separately and expressly when you create the account.</>,
  sections: [
    {
      id: 'parties', title: 'The parties and the conclusion of the contract',
      body: <>
        <Clause n="1.1"><P>The <strong>Provider</strong> is the following company, referred to as “Hontrio” or “we”:</P><Company locale="en" /></Clause>
        <Clause n="1.2"><P>The <strong>Customer</strong>, referred to as “you”, is the business that creates a Hontrio account: a legal entity or a professional (sole trader, individual or family business) using Hontrio in its commercial activity. The person creating the account declares that they are entitled to represent the business.</P></Clause>
        <Clause n="1.3"><P>Hontrio is not intended for consumers. If you are not acting for professional purposes, do not use the service.</P></Clause>
        <Clause n="1.4"><P>The contract is concluded when you create your account and accept these Terms and the <L href="/legal/dpa">Data Processing Agreement</L>, after reading the <L href="/legal/privacy">Privacy Policy</L>. The accepted version and the date of acceptance are kept in your account.</P></Clause>
      </>,
    },
    {
      id: 'service', title: 'What Hontrio does',
      body: <>
        <Clause n="2.1"><P>Hontrio connects your online store (Edinio, WooCommerce or Shopify) and your Google Ads and Google Merchant Center accounts, turns the store’s products into Google Shopping or Performance Max campaigns, looks after them daily through the autopilot and shows you reports and catalog recommendations.</P></Clause>
        <Clause n="2.2"><P>To use Hontrio you need a Google Ads account with an active payment method, a Merchant Center account with the store’s products and purchase conversion tracking in Google Ads. Hontrio checks them before launch, but setting them up correctly is your responsibility.</P></Clause>
        <Clause n="2.3"><P>We only read the store: Hontrio does not change products, orders or any other data in the store.</P></Clause>
        <Clause n="2.4"><P>We may change, add or remove features. If a change significantly reduces your service, we notify you at least 30 days in advance.</P></Clause>
      </>,
    },
    {
      id: 'account', title: 'The account',
      body: <>
        <Clause n="3.1"><P>The account data must be accurate and the email address confirmed.</P></Clause>
        <Clause n="3.2"><P>You are responsible for keeping your access details safe and for what the people you give access to do in the account. If you suspect unauthorized access, write to us immediately at <Mail to="support@hontrio.com" />.</P></Clause>
      </>,
    },
    {
      id: 'mandate', title: 'Authority to act in Google Ads and Merchant Center',
      body: <>
        <Clause n="4.1">
          <P>By connecting Google, you authorize us to access, through Google OAuth and within the permissions you approve, the Google Ads account chosen for the store and your Merchant Center account, and to act on your behalf to:</P>
          <OL items={[
            'read the data the service needs, described in the Privacy Policy;',
            'create, change, pause, resume and end Hontrio campaigns, with their budget, country, language, product list and negative keywords;',
            'move a Shopping campaign to Performance Max, under the rules in article 6;',
            'create the “Hontrio” supplemental data source in Merchant Center, link it to your product sources and write a label (custom label) on the products taken out of campaigns;',
            'only if you choose to at launch: pause your existing campaigns that sell the same products and fill in, on your existing campaigns, the EU political advertising declaration required by Google.',
          ]} />
        </Clause>
        <Clause n="4.2"><P>We declare Hontrio campaigns to Google as not being EU political advertising. You confirm that your products and ads are not political advertising; if they could be, do not use Hontrio for them. You are also responsible for the accuracy of the declaration you confirm for your existing campaigns.</P></Clause>
        <Clause n="4.3"><P>To the URLs of the ads in Hontrio campaigns we add the parameters <Code>utm_source=google</Code>, <Code>utm_medium=cpc</Code> and <Code>utm_campaign=hontrio-ID</Code>, where ID is the campaign number, so you can see which sales they bring.</P></Clause>
        <Clause n="4.4"><P>The Google Ads account remains yours and you control it at all times: you can stop or change any campaign directly in Google Ads. Changes made directly in Google Ads to a Hontrio campaign may be replaced by the autopilot with the plan in Hontrio (for example the product list), so it is best to change Hontrio campaigns from Hontrio.</P></Clause>
        <Clause n="4.5"><P>Hontrio is an independent provider: it is not Google and it is not affiliated with Google. Google Ads and Google Merchant Center are trademarks of Google LLC.</P></Clause>
        <Clause n="4.6"><P>What to expect from someone who manages your Google ads is explained by Google in the guide <A href={THIRD_PARTY}>“Working with a third party”</A>. On request, we tell you the IDs of the Google Ads accounts we work in for you.</P></Clause>
      </>,
    },
    {
      id: 'ad-costs', title: 'The cost of the ads',
      body: <>
        <Clause n="5.1"><P>You pay for the ads directly to Google, under your contract with Google. Hontrio does not collect or manage the money for ads.</P></Clause>
        <Clause n="5.2"><P>You choose each campaign’s daily budget and the maximum budget the autopilot can reach. Under Google’s rules, a campaign may spend up to twice its daily budget on a given day, but Google does not bill more than 30.4 times the daily budget in a month.</P></Clause>
        <Clause n="5.3"><P>Hontrio’s reports show the costs reported by Google, with no mark-up. We read Google Ads figures once a day; they cover the period up to and including yesterday.</P></Clause>
        <Clause n="5.4"><P>Paying Google’s invoices, the payment method and the billing settings in the Google Ads account are your responsibility.</P></Clause>
      </>,
    },
    {
      id: 'autopilot', title: 'The autopilot',
      body: <>
        <Clause n="6.1">
          <P>The autopilot checks Hontrio campaigns daily and makes proposals, each with its reason. You choose one of two modes:</P>
          <OL items={[
            'with approval: the autopilot proposes, and you approve or reject; proposals you do not answer expire after 7 days;',
            'automatic: the autopilot applies by itself the proposals that do not require approval, and notifies you.',
          ]} />
        </Clause>
        <Clause n="6.2">
          <P>In both modes, the autopilot does the following on its own, without asking:</P>
          <OL items={[
            'the safety stop: it pauses a Hontrio campaign that spent above the loss limit without sales or with sales below the cost of the ads, and notifies you;',
            'keeping the product list of Hontrio campaigns in line with the catalog and the plan: new products go in, sold-out, unpublished or excluded-by-you products come out;',
            'ending group campaigns on the end date you chose.',
          ]} />
        </Clause>
        <Clause n="6.3"><P>In automatic mode, the autopilot also applies on its own: negative keywords for searches that cost money without bringing sales; removing from campaigns the products that spend without sales or bring sales below the cost of the ads; moving a Shopping campaign with enough conversions to Performance Max.</P></Clause>
        <Clause n="6.4"><P>The budget goes up only with your approval, in both modes. The autopilot proposes an increase of at most 20%, at most once a week, never above the maximum budget you chose, and it does not change the budget of a new Performance Max campaign in its first 6 weeks.</P></Clause>
        <Clause n="6.5"><P>Every change made by the autopilot or by you through Hontrio stays in the journal in the app.</P></Clause>
        <Clause n="6.6"><P>You can change the mode, limits and budgets at any time, and you can pause or end campaigns, from Hontrio or directly in Google Ads.</P></Clause>
        <Clause n="6.7"><P>The autopilot works with the data available from Google and from the store, which may be delayed or contain errors. Its decisions are automated, and a decision that was right on the data at the time may turn out, over time, not to be optimal.</P></Clause>
      </>,
    },
    {
      id: 'obligations', title: 'Your obligations',
      body: <UL items={[
        'to sell lawfully and comply with Google Ads and Merchant Center policies, as well as with consumer protection, pricing and advertising laws;',
        'to be entitled to connect the store and the Google accounts you connect;',
        'to keep the store and feed data accurate: prices, stock, descriptions;',
        'to measure conversions correctly and to inform your visitors and buyers about cookies and data processing, with their consent where the law requires it, including under Google’s EU user consent policy;',
        'not to use Hontrio for prohibited products or ads, or for political advertising;',
        'not to try to access other people’s accounts, not to copy, decompile or overload the platform, and not to use it to get around Google’s rules.',
      ]} />,
    },
    {
      id: 'no-guarantee', title: 'No guarantee of results',
      body: <>
        <Clause n="8.1"><P>We do not guarantee sales, a given ROAS, ad position, the number of impressions or clicks, or the approval of products or ads by Google. Google decides auctions, positions, approvals and any suspensions, under its own rules.</P></Clause>
        <Clause n="8.2"><P>Conversions reported by Google may differ from the store’s orders.</P></Clause>
        <Clause n="8.3"><P>The examples and figures on the website are illustrative.</P></Clause>
      </>,
    },
    {
      id: 'fees', title: 'Fees',
      body: <>
        <Clause n="9.1"><P>For now, Hontrio is free. You pay only for the ads, directly to Google.</P></Clause>
        <Clause n="9.2"><P>We may introduce a fee calculated as a percentage of the sales brought by Hontrio campaigns, meaning the store orders whose source has a <Code>utm_campaign</Code> parameter starting with “hontrio-”. We will notify you in writing, by email and in the app, at least 30 days in advance, with the percentage, the calculation method, invoicing and VAT.</P></Clause>
        <Clause n="9.3"><P>The fee applies only if you accept it expressly. If you do not accept it, you can end the contract at no cost. The fee will appear on every invoice, separately from the cost of the ads, which you keep paying directly to Google.</P></Clause>
      </>,
    },
    {
      id: 'data', title: 'Data',
      body: <>
        <Clause n="10.1"><P>We process your account data as a controller, under the <L href="/legal/privacy">Privacy Policy</L>.</P></Clause>
        <Clause n="10.2"><P>We process your store’s buyers’ data as a processor, under the <L href="/legal/dpa">Data Processing Agreement</L>, which is part of this contract.</P></Clause>
        <Clause n="10.3"><P>The data of your store and your accounts remains yours. You grant us the right to use it only as far as needed to provide Hontrio to you.</P></Clause>
        <Clause n="10.4"><P>We use the data received from Google under the Google API Services User Data Policy, including the Limited Use requirements.</P></Clause>
      </>,
    },
    {
      id: 'ip', title: 'Intellectual property',
      body: <>
        <Clause n="11.1"><P>The Hontrio platform (code, interface, texts, brand) belongs to us. For the duration of the contract, we grant you the non-exclusive, non-transferable right to use it for your business.</P></Clause>
        <Clause n="11.2"><P>We may use the suggestions you send us to improve Hontrio, without any obligation to you.</P></Clause>
      </>,
    },
    {
      id: 'availability', title: 'Availability of the service',
      body: <>
        <Clause n="12.1"><P>We do everything reasonably within our control for Hontrio to work continuously, but we do not guarantee it will be uninterrupted. Hontrio depends on Google, on the store’s platform and on our providers.</P></Clause>
        <Clause n="12.2"><P>If the autopilot cannot run (for example because access to Google expired), Hontrio campaigns stay in Google Ads with their settings at that time, and we notify you.</P></Clause>
      </>,
    },
    {
      id: 'suspension', title: 'Suspension',
      body: <>
        <Clause n="13.1"><P>We may suspend, fully or partly, access to Hontrio or the autopilot if: you breach these Terms or the law; there is a security or abuse risk; Google or the store’s platform asks us to or restricts our access; an authority obliges us to; after accepting a fee, you do not pay it on time.</P></Clause>
        <Clause n="13.2"><P>We notify you in advance, with the reason, except in emergencies; in emergencies, right after.</P></Clause>
        <Clause n="13.3"><P>While the suspension lasts, Hontrio campaigns stay in your Google Ads account and run with their settings at that time, without the autopilot, and therefore without the safety stop. You can stop them at any time directly in Google Ads.</P></Clause>
        <Clause n="13.4"><P>We restore access as soon as the reason for the suspension is gone.</P></Clause>
      </>,
    },
    {
      id: 'termination', title: 'Term and termination',
      body: <>
        <Clause n="14.1"><P>The contract is for an indefinite term.</P></Clause>
        <Clause n="14.2"><P>You can end it at any time, without notice and at no cost, by deleting your account in Settings or by writing to us at <Mail to="support@hontrio.com" />.</P></Clause>
        <Clause n="14.3"><P>We can end it with 30 days’ notice sent by email, or immediately in case of a serious breach: fraud, unlawful use, attacks on the platform.</P></Clause>
        <Clause n="14.4"><P>On termination, access to Hontrio closes, access to Google is revoked, and the data is deleted within the periods in the Privacy Policy.</P></Clause>
        <Clause n="14.5"><P><strong>The campaigns created by Hontrio are in your Google Ads account and keep running and spending</strong> after you disconnect Google, after you delete the store or the account and after the contract ends, until you stop or delete them. From then on Hontrio no longer monitors or stops them. We recommend pausing them first.</P></Clause>
        <Clause n="14.6"><P>You can disconnect the Google Ads account from Settings at any time, and Hontrio’s access is revoked immediately. If you ask us in writing, within at most 3 business days we confirm that Hontrio no longer has access to the account and that you have exclusive control of it.</P></Clause>
      </>,
    },
    {
      id: 'portability', title: 'Data export and switching provider',
      body: <>
        <Clause n="15.1"><P>You can download at any time, free of charge, from Settings, the data you have in Hontrio, in a structured format (JSON): the account and settings, the connected stores, the synced products and orders, the campaigns and groups, the autopilot settings and journal, and the data brought from Google. Access keys and tokens and the platform’s code are not part of the export.</P></Clause>
        <Clause n="15.2"><P>You can switch to another provider at any time, under Regulation (EU) 2023/2854 (the Data Act): we require no notice, charge no switching costs and apply no penalties. The campaigns are already in your Google Ads account, so they stay with you.</P></Clause>
        <Clause n="15.3"><P>If you tell us you want to switch provider, the account remains available for at least 30 days so you can export your data, and on request we help you with the export; then we permanently delete the data, except what the law obliges us to keep. Deleting the account from Settings is final and immediate, so export your data first.</P></Clause>
      </>,
    },
    {
      id: 'liability', title: 'Liability',
      body: <>
        <Clause n="16.1"><P>We are liable for the direct damage we cause you through our fault. We are not liable for indirect damage or for loss of profit, except in the cases in 16.5.</P></Clause>
        <Clause n="16.2"><P>We are not liable for: ad spend made within the budgets you chose and under Google’s rules; Google’s decisions (auctions, approvals, disapprovals, account suspensions); errors in the store data, the feed or conversion tracking; changes you make directly in Google Ads; campaigns left running after disconnection, deletion, suspension or termination; outages of Google, of the store’s platform or of our providers.</P></Clause>
        <Clause n="16.3"><P>If, because of an error by Hontrio, the autopilot makes a change outside the limits you chose (for example it raises the budget without your approval), we are liable for the resulting extra ad spend, within the limit in 16.4.</P></Clause>
        <Clause n="16.4"><P>Our total liability to you, for all claims related to this contract, is limited to the greater of: the total you paid Hontrio in the 12 months before the event that caused the damage; the equivalent in lei of 500 euros, at the National Bank of Romania rate on the day of payment.</P></Clause>
        <Clause n="16.5"><P>The limitations in 16.1 and 16.4 do not apply to damage caused intentionally or through gross negligence, to bodily injury or harm to health, or to any other case in which the law does not allow liability to be limited.</P></Clause>
      </>,
    },
    {
      id: 'unusual-clauses', title: 'Clauses accepted expressly (Art. 1203 of the Romanian Civil Code)',
      body: <>
        <P>You accept the following clauses separately and expressly, through the dedicated checkbox when you create the account, and they take effect only with this acceptance:</P>
        <UL items={[
          'the limitation of liability (article 16);',
          'the suspension of access and of the autopilot (article 13);',
          'termination of the contract by Hontrio (article 14.3);',
          'the governing law and the competent court (article 19).',
        ]} />
      </>,
    },
    {
      id: 'changes', title: 'Changes to the Terms',
      body: <>
        <Clause n="18.1"><P>We notify you by email and in the app at least 30 days before any change, telling you what changes.</P></Clause>
        <Clause n="18.2"><P>Changes to fees, to the clauses in article 17 or to using the data received from Google for another purpose apply only if you accept them expressly. For the others, continuing to use Hontrio after the effective date means you accept them; if you disagree, you can end the contract before that date, at no cost.</P></Clause>
        <Clause n="18.3"><P>Changes required by law or by Google may take effect sooner, with notice to you.</P></Clause>
      </>,
    },
    {
      id: 'law', title: 'Governing law and disputes',
      body: <>
        <Clause n="19.1"><P>The contract is governed by Romanian law.</P></Clause>
        <Clause n="19.2"><P>We first try to settle any disagreement amicably, within 30 days of the written notice.</P></Clause>
        <Clause n="19.3"><P>If we do not succeed, the dispute is settled by the competent courts of the registered office of VOID SFT GAMES SRL, in Gorj County, Romania.</P></Clause>
      </>,
    },
    {
      id: 'final', title: 'Final provisions',
      body: <UL items={[
        'The contract consists of these Terms, the Data Processing Agreement and the clauses accepted expressly; the Privacy Policy and the Cookie Policy inform you about data.',
        'If a clause is declared invalid, the others remain in force.',
        'We may transfer the contract to a successor in a reorganization, merger or sale of the business, with notice to you; you may transfer it only with our written consent.',
        'Neither party is liable for non-performance caused by force majeure (Art. 1351 of the Romanian Civil Code).',
        'We send notices to the account’s email address; you write to us at contact@hontrio.com or support@hontrio.com.',
        'The Terms are available in Romanian and English; if the versions differ, the Romanian version prevails.',
        'Version in force: 2026-11-12. You can ask for previous versions at contact@hontrio.com.',
      ]} />,
    },
  ],
}

export async function generateMetadata(): Promise<Metadata> {
  const ro = (await getLocale()) === 'ro'
  return {
    title: ro ? RO.title : EN.title,
    description: ro
      ? 'Contractul Hontrio pentru firme: mandatul în Google Ads, pilotul automat, costul reclamelor, tarife, răspundere și încetare.'
      : 'The Hontrio contract for businesses: authority in Google Ads, the autopilot, ad costs, fees, liability and termination.',
    alternates: { canonical: 'https://hontrio.com/legal/terms' },
  }
}

export default async function TermsPage() {
  const locale = await getLocale()
  return <LegalPage kind="terms" locale={locale} doc={locale === 'ro' ? RO : EN} contact="contact@hontrio.com" />
}
