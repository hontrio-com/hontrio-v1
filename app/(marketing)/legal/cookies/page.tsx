'use client'

import { useState, useEffect } from 'react'
import { motion, useReducedMotion, type MotionProps } from 'framer-motion'
import { Cookie, ArrowUp, Mail, ExternalLink } from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

const DATE_RO = '28 martie 2026'
const DATE_EN = 'March 28, 2026'
const VERSION = '1.0'

// ─── Shared helpers ───────────────────────────────────────────────────────────

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
const LegalBasis = ({ isRO, type }: { isRO: boolean; type: 'necessary' | 'consent' }) => (
  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
    type === 'necessary'
      ? 'bg-neutral-900 text-white'
      : 'bg-neutral-100 border border-neutral-200 text-neutral-600'
  }`}>
    {type === 'necessary'
      ? (isRO ? 'Nu necesita consimtamant' : 'No consent required')
      : (isRO ? 'Necesita consimtamantul tau' : 'Requires your consent')}
  </div>
)

interface CookieRow { name: string; provider: string; purpose: string; duration: string }
const CookieTable = ({ rows, isRO }: { rows: CookieRow[]; isRO: boolean }) => {
  const headers = isRO
    ? ['Numele cookie-ului', 'Furnizor', 'Scop', 'Durata']
    : ['Cookie name', 'Provider', 'Purpose', 'Duration']
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
              <td className="px-3 py-2.5 font-mono text-[11px] font-medium text-neutral-800 align-top border-b border-neutral-100 whitespace-nowrap">{row.name}</td>
              <td className="px-3 py-2.5 text-neutral-600 align-top border-b border-neutral-100 whitespace-nowrap">{row.provider}</td>
              <td className="px-3 py-2.5 text-neutral-600 align-top leading-relaxed border-b border-neutral-100">{row.purpose}</td>
              <td className="px-3 py-2.5 text-neutral-600 align-top border-b border-neutral-100 whitespace-nowrap">{row.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Section builder ──────────────────────────────────────────────────────────

interface Section { id: string; number: string; title: string; content: React.ReactNode }

function buildSections(isRO: boolean): Section[] {
  return [
    {
      id: 's1',
      number: isRO ? 'Sectiunea 1' : 'Section 1',
      title: isRO ? 'Cadrul legal aplicabil' : 'Applicable legal framework',
      content: (
        <>
          <P>{isRO
            ? 'Utilizarea cookie-urilor pe hontrio.com si in platforma Hontrio este reglementata de:'
            : 'The use of cookies on hontrio.com and in the Hontrio platform is regulated by:'}
          </P>
          <UL items={isRO ? [
            'Directiva ePrivacy 2002/58/CE modificata prin Directiva 2009/136/CE, transpusa in legislatia romana prin Legea nr. 506/2004 privind prelucrarea datelor cu caracter personal si protectia vietii private in sectorul comunicatiilor electronice, modificata prin OUG 13/2012',
            'Regulamentul UE 2016/679 (GDPR) privind protectia datelor cu caracter personal',
            'Ghidurile si deciziile ANSPDCP (Autoritatea Nationala de Supraveghere a Prelucrarii Datelor cu Caracter Personal)',
          ] : [
            'ePrivacy Directive 2002/58/EC as amended by Directive 2009/136/EC, transposed into Romanian law by Law no. 506/2004 on the processing of personal data and the protection of privacy in the electronic communications sector, amended by GEO 13/2012',
            'EU Regulation 2016/679 (GDPR) on the protection of personal data',
            'Guidelines and decisions of ANSPDCP (National Supervisory Authority for Personal Data Processing)',
          ]} />
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-600 leading-relaxed mt-2">
            {isRO
              ? 'Conform acestui cadru legal, inainte de plasarea oricaror cookie-uri nestrict necesare pe dispozitivul tau, avem obligatia de a obtine consimtamantul tau prealabil, explicit, liber exprimat, specific si informat. Cookie-urile strict necesare functionarii Platformei constituie singura exceptie de la aceasta obligatie.'
              : 'Under this legal framework, before placing any non-strictly necessary cookies on your device, we are obliged to obtain your prior, explicit, freely given, specific and informed consent. Cookies strictly necessary for the Platform\'s operation are the only exception to this obligation.'}
          </div>
        </>
      ),
    },
    {
      id: 's2',
      number: isRO ? 'Sectiunea 2' : 'Section 2',
      title: isRO ? 'Ce sunt cookie-urile' : 'What cookies are',
      content: (
        <>
          <P>{isRO
            ? 'Un cookie este un fisier text de mici dimensiuni, format din litere si cifre, pe care un server web il trimite browserului tau si care este stocat pe dispozitivul tau (calculator, telefon, tableta) atunci cand accesezi un site sau o aplicatie web.'
            : 'A cookie is a small text file consisting of letters and numbers that a web server sends to your browser and which is stored on your device (computer, phone, tablet) when you access a website or web application.'}
          </P>
          <P>{isRO
            ? 'Cookie-urile nu sunt virusi, nu sunt programe executabile si nu pot accesa alte informatii de pe dispozitivul tau in afara celor pe care le-au stocat anterior. Ele permit site-ului sau aplicatiei sa iti recunoasca dispozitivul la urmatoarea vizita si sa retina anumite preferinte sau informatii de sesiune.'
            : 'Cookies are not viruses, are not executable programs and cannot access other information on your device beyond what they have previously stored. They allow the website or application to recognize your device on the next visit and to remember certain preferences or session information.'}
          </P>
          <p className="text-sm font-semibold text-neutral-800 mt-4 mb-2">{isRO ? 'Dupa durata de viata:' : 'By lifespan:'}</p>
          <div className="space-y-3">
            {[
              {
                term: isRO ? 'Cookie-uri de sesiune (session cookies)' : 'Session cookies',
                def: isRO
                  ? 'Sunt stocate temporar in memoria browserului si se sterg automat la inchiderea tab-ului sau a browserului. Nu raman pe dispozitivul tau dupa sesiune.'
                  : 'Stored temporarily in browser memory and deleted automatically when the tab or browser is closed. They do not remain on your device after the session.',
              },
              {
                term: isRO ? 'Cookie-uri persistente (persistent cookies)' : 'Persistent cookies',
                def: isRO
                  ? 'Raman pe dispozitivul tau pentru o perioada determinata, configurata in codul cookie-ului, sau pana cand le stergi manual. Conform Directivei ePrivacy, durata recomandata este de maximum 12 luni, cu exceptia cazurilor justificate tehnic.'
                  : 'Remain on your device for a set period, configured in the cookie\'s code, or until you delete them manually. According to the ePrivacy Directive, the recommended duration is a maximum of 12 months, except for technically justified cases.',
              },
            ].map(({ term, def }) => (
              <div key={term} className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-neutral-400 shrink-0" />
                <p className="text-sm text-neutral-600 leading-relaxed"><span className="font-semibold text-neutral-800">{term}:</span> {def}</p>
              </div>
            ))}
          </div>
          <p className="text-sm font-semibold text-neutral-800 mt-4 mb-2">{isRO ? 'Dupa provenienta:' : 'By origin:'}</p>
          <div className="space-y-3">
            {[
              {
                term: isRO ? 'Cookie-uri proprii (first-party)' : 'First-party cookies',
                def: isRO ? 'Plasate direct de hontrio.com sau de platforma Hontrio.' : 'Placed directly by hontrio.com or the Hontrio platform.',
              },
              {
                term: isRO ? 'Cookie-uri ale tertilor (third-party)' : 'Third-party cookies',
                def: isRO
                  ? 'Plasate de domenii externe integrate in Platforma sau pe site-ul nostru (ex: furnizori de analiza, servicii de autentificare).'
                  : 'Placed by external domains integrated into the Platform or our website (e.g. analytics providers, authentication services).',
              },
            ].map(({ term, def }) => (
              <div key={term} className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-neutral-400 shrink-0" />
                <p className="text-sm text-neutral-600 leading-relaxed"><span className="font-semibold text-neutral-800">{term}:</span> {def}</p>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      id: 's3',
      number: isRO ? 'Sectiunea 3' : 'Section 3',
      title: isRO ? 'Categoriile de cookie-uri pe care le utilizam' : 'Categories of cookies we use',
      content: (
        <>
          {/* 3.1 */}
          <Sub num="3.1" title={isRO ? 'Cookie-uri strict necesare' : 'Strictly necessary cookies'}>
            <LegalBasis isRO={isRO} type="necessary" />
            <P>{isRO
              ? 'Sunt necesare pentru furnizarea serviciului solicitat explicit de utilizator, conform Art. 4 alin. 5 din Legea 506/2004 si Considerentului 25 al Directivei 2009/136/CE. Nu poti dezactiva aceste cookie-uri fara a afecta functionarea Platformei.'
              : 'These are necessary to provide the service explicitly requested by the user, pursuant to Art. 4(5) of Law 506/2004 and Recital 25 of Directive 2009/136/EC. You cannot disable these cookies without affecting the Platform\'s operation.'}
            </P>
            <CookieTable isRO={isRO} rows={[
              {
                name: 'next-auth.session-token',
                provider: isRO ? 'Hontrio (NextAuth)' : 'Hontrio (NextAuth)',
                purpose: isRO
                  ? 'Mentinerea sesiunii de autentificare. Fara acest cookie, trebuie sa te autentifici la fiecare accesare.'
                  : 'Maintains authentication session. Without this cookie, you must log in at every access.',
                duration: isRO ? 'Sesiune / 30 zile' : 'Session / 30 days',
              },
              {
                name: 'next-auth.csrf-token',
                provider: 'Hontrio (NextAuth)',
                purpose: isRO
                  ? 'Protectie impotriva atacurilor CSRF (Cross-Site Request Forgery). Cookie de securitate obligatoriu.'
                  : 'Protection against CSRF (Cross-Site Request Forgery) attacks. Mandatory security cookie.',
                duration: isRO ? 'Sesiune' : 'Session',
              },
              {
                name: 'next-auth.callback-url',
                provider: 'Hontrio (NextAuth)',
                purpose: isRO
                  ? 'Retine URL-ul de redirectionare dupa autentificare.'
                  : 'Remembers the redirect URL after authentication.',
                duration: isRO ? 'Sesiune' : 'Session',
              },
              {
                name: '__Host-next-auth.csrf-token',
                provider: 'Hontrio (NextAuth)',
                purpose: isRO
                  ? 'Varianta securizata a cookie-ului CSRF pentru conexiuni HTTPS.'
                  : 'Secure variant of the CSRF cookie for HTTPS connections.',
                duration: isRO ? 'Sesiune' : 'Session',
              },
              {
                name: 'hontrio-cookie-consent',
                provider: 'Hontrio',
                purpose: isRO
                  ? 'Retine preferintele tale privind cookie-urile pentru a nu afisa bannerul la fiecare vizita.'
                  : 'Remembers your cookie preferences to avoid showing the banner on every visit.',
                duration: isRO ? '12 luni' : '12 months',
              },
              {
                name: 'hontrio-locale',
                provider: 'Hontrio',
                purpose: isRO
                  ? 'Retine preferinta de limba selectata pentru interfata Platformei.'
                  : 'Remembers the selected language preference for the Platform interface.',
                duration: isRO ? '12 luni' : '12 months',
              },
            ]} />
          </Sub>

          {/* 3.2 */}
          <Sub num="3.2" title={isRO ? 'Cookie-uri functionale' : 'Functional cookies'}>
            <LegalBasis isRO={isRO} type="consent" />
            <P>{isRO
              ? 'Aceste cookie-uri imbunatatesc experienta ta de utilizare, dar Platforma poate functiona si fara ele, cu o experienta mai limitata.'
              : 'These cookies improve your user experience, but the Platform can also function without them, with a more limited experience.'}
            </P>
            <CookieTable isRO={isRO} rows={[
              {
                name: 'hontrio-ui-preferences',
                provider: 'Hontrio',
                purpose: isRO
                  ? 'Retine preferintele de afisare ale interfetei (tema, dimensiunea coloanelor, filtre salvate in dashboard).'
                  : 'Remembers interface display preferences (theme, column sizes, saved dashboard filters).',
                duration: isRO ? '6 luni' : '6 months',
              },
              {
                name: 'hontrio-tour-completed',
                provider: 'Hontrio',
                purpose: isRO
                  ? 'Retine daca ai finalizat tur-ul de onboarding pentru a nu-l afisa repetat.'
                  : 'Remembers whether you completed the onboarding tour to avoid repeating it.',
                duration: isRO ? '12 luni' : '12 months',
              },
              {
                name: 'hontrio-dismissed-banners',
                provider: 'Hontrio',
                purpose: isRO
                  ? 'Retine ce notificari sau bannere informative ai inchis.'
                  : 'Remembers which notifications or informational banners you have dismissed.',
                duration: isRO ? '30 zile' : '30 days',
              },
            ]} />
          </Sub>

          {/* 3.3 */}
          <Sub num="3.3" title={isRO ? 'Cookie-uri de analiza si performanta' : 'Analytics and performance cookies'}>
            <LegalBasis isRO={isRO} type="consent" />
            <P>{isRO
              ? 'Aceste cookie-uri ne ajuta sa intelegem cum este utilizata Platforma, ce pagini sunt cele mai accesate si unde apar erori tehnice, astfel incat sa putem imbunatati continuu Serviciile. Datele colectate sunt agregate si, in masura posibilului, pseudonimizate.'
              : 'These cookies help us understand how the Platform is used, which pages are most accessed and where technical errors occur, so we can continuously improve the Services. Collected data is aggregated and, where possible, pseudonymized.'}
            </P>
            <CookieTable isRO={isRO} rows={[
              {
                name: '_vercel-analytics',
                provider: 'Vercel Inc. (SUA)',
                purpose: isRO
                  ? 'Analiza performantei paginilor, timpi de incarcare, erori tehnice. Date agregate, fara profil individual.'
                  : 'Page performance analysis, loading times, technical errors. Aggregated data, no individual profile.',
                duration: isRO ? 'Sesiune' : 'Session',
              },
              {
                name: 'va-*',
                provider: 'Vercel Inc. (SUA)',
                purpose: isRO
                  ? 'Identificator de sesiune anonim pentru analiza Vercel Analytics.'
                  : 'Anonymous session identifier for Vercel Analytics.',
                duration: isRO ? '24 ore' : '24 hours',
              },
            ]} />
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-600 leading-relaxed">
              <span className="font-semibold text-neutral-800">{isRO ? 'Nota privind Vercel Analytics: ' : 'Note on Vercel Analytics: '}</span>
              {isRO
                ? 'Utilizam Vercel Analytics intr-o configuratie care nu stocheaza adrese IP complete si nu creeaza profiluri individuale de utilizator. Datele sunt agregate la nivel de sesiune anonima.'
                : 'We use Vercel Analytics in a configuration that does not store full IP addresses and does not create individual user profiles. Data is aggregated at the level of anonymous sessions.'}
            </div>
          </Sub>

          {/* 3.4 */}
          <Sub num="3.4" title={isRO ? 'Cookie-uri de marketing si remarketing' : 'Marketing and remarketing cookies'}>
            <LegalBasis isRO={isRO} type="consent" />
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-600 leading-relaxed">
              {isRO
                ? 'In prezent, Hontrio nu utilizeaza cookie-uri de marketing sau remarketing pe hontrio.com sau in Platforma. Daca in viitor vom introduce astfel de cookie-uri, vom actualiza prezenta Politica si vom solicita consimtamantul tau prealabil inainte de activarea lor.'
                : 'Currently, Hontrio does not use marketing or remarketing cookies on hontrio.com or in the Platform. If we introduce such cookies in the future, we will update this Policy and request your prior consent before activating them.'}
            </div>
          </Sub>

          {/* 3.5 */}
          <Sub num="3.5" title={isRO ? 'Cookie-uri ale tertilor pentru autentificare sociala' : 'Third-party cookies for social authentication'}>
            <LegalBasis isRO={isRO} type="consent" />
            <P>{isRO
              ? 'Sunt plasate doar daca alegi sa te autentifici prin aceste servicii.'
              : 'These are placed only if you choose to authenticate through these services.'}
            </P>
            <div className="overflow-x-auto my-4 rounded-xl border border-neutral-200">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    {(isRO ? ['Furnizor', 'Scop', 'Politica proprie'] : ['Provider', 'Purpose', 'Own policy']).map((h) => (
                      <th key={h} className="px-3 py-2.5 font-semibold text-neutral-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      provider: 'Google LLC (SUA)',
                      purpose: isRO
                        ? 'Autentificare prin cont Google (Google OAuth). Plasate doar la alegerea metodei de autentificare Google.'
                        : 'Authentication via Google account (Google OAuth). Placed only when choosing Google authentication.',
                      link: 'policies.google.com/privacy',
                    },
                    {
                      provider: 'GitHub Inc. (SUA)',
                      purpose: isRO
                        ? 'Autentificare prin cont GitHub (GitHub OAuth). Plasate doar la alegerea metodei de autentificare GitHub.'
                        : 'Authentication via GitHub account (GitHub OAuth). Placed only when choosing GitHub authentication.',
                      link: 'docs.github.com/site-policy/privacy-policies',
                    },
                  ].map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}>
                      <td className="px-3 py-2.5 font-medium text-neutral-800 align-top border-b border-neutral-100 whitespace-nowrap">{row.provider}</td>
                      <td className="px-3 py-2.5 text-neutral-600 align-top leading-relaxed border-b border-neutral-100">{row.purpose}</td>
                      <td className="px-3 py-2.5 align-top border-b border-neutral-100">
                        <a href={`https://${row.link}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-neutral-700 hover:text-neutral-900 hover:underline text-[11px]">
                          {row.link} <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P>{isRO
              ? 'Acesti furnizori pot plasa propriile cookie-uri conform politicilor lor de confidentialitate. Hontrio nu controleaza cookie-urile plasate direct de acesti furnizori si nu are acces la ele.'
              : 'These providers may place their own cookies in accordance with their privacy policies. Hontrio does not control the cookies placed directly by these providers and has no access to them.'}
            </P>
          </Sub>
        </>
      ),
    },
    {
      id: 's4',
      number: isRO ? 'Sectiunea 4' : 'Section 4',
      title: isRO ? 'Ce date colecteaza cookie-urile si cum le utilizam' : 'What data cookies collect and how we use it',
      content: (
        <>
          <UL items={isRO ? [
            'Cookie-urile strict necesare colecteaza exclusiv date tehnice necesare functionarii sesiunii: un identificator de sesiune generat aleatoriu, token-uri de securitate si preferinte de baza ale interfetei. Nu colecteaza date personale identificabile direct.',
            'Cookie-urile de analiza colecteaza: tipul browserului, sistemul de operare, rezolutia ecranului, paginile vizitate si durata vizitei, in forma agregata sau pseudonimizata. Nu colecteaza: numele tau, adresa de email, continutul formularelor sau alte date personale identificabile direct.',
          ] : [
            'Strictly necessary cookies collect exclusively technical data required for session operation: a randomly generated session identifier, security tokens and basic interface preferences. They do not collect directly identifiable personal data.',
            'Analytics cookies collect: browser type, operating system, screen resolution, pages visited and visit duration, in aggregated or pseudonymized form. They do not collect: your name, email address, form contents or other directly identifiable personal data.',
          ]} />
          <P>{isRO
            ? 'Nicio data colectata prin cookie-urile proprii Hontrio nu este vanduta sau transferata tertilor in scopuri comerciale. Datele de analiza sunt utilizate exclusiv pentru imbunatatirea Platformei.'
            : 'No data collected through Hontrio\'s own cookies is sold or transferred to third parties for commercial purposes. Analytics data is used exclusively to improve the Platform.'}
          </P>
        </>
      ),
    },
    {
      id: 's5',
      number: isRO ? 'Sectiunea 5' : 'Section 5',
      title: isRO ? 'Cum poti controla cookie-urile' : 'How you can control cookies',
      content: (
        <>
          <P>{isRO
            ? 'Ai mai multe modalitati de a gestiona preferintele privind cookie-urile:'
            : 'You have several ways to manage your cookie preferences:'}
          </P>
          <Sub num="5.1" title={isRO ? 'Prin bannerul de consimtamant Hontrio:' : 'Through the Hontrio consent banner:'}>
            {isRO
              ? 'La prima accesare a hontrio.com sau a Platformei, ti se prezinta un banner de consimtamant care iti permite sa accepti toate categoriile de cookie-uri, sa refuzi toate cookie-urile nestrict necesare sau sa personalizezi preferintele pe categorii (functional, analiza, marketing).'
              : 'When you first access hontrio.com or the Platform, a consent banner is presented that allows you to accept all categories of cookies, refuse all non-strictly necessary cookies, or customize preferences by category (functional, analytics, marketing).'}
            <P>{isRO
              ? 'Aceasta alegere este retinuta in cookie-ul hontrio-cookie-consent pentru 12 luni. Dupa expirare, bannerul va reaparea.'
              : 'This choice is stored in the hontrio-cookie-consent cookie for 12 months. After expiry, the banner will reappear.'}
            </P>
          </Sub>
          <Sub num="5.2" title={isRO ? 'Prin Centrul de Preferinte Cookie:' : 'Through the Cookie Preferences Centre:'}>
            {isRO
              ? 'Poti modifica preferintele oricand, fara a reporni sesiunea, accesand linkul Preferinte Cookie disponibil in footer-ul site-ului hontrio.com, sectiunea Setari a contului tau in Platforma sau prin accesarea directa a hontrio.com/cookie-preferences.'
              : 'You can change your preferences at any time, without restarting the session, by accessing the Cookie Preferences link available in the footer of hontrio.com, the Settings section of your account in the Platform, or by directly accessing hontrio.com/cookie-preferences.'}
          </Sub>
          <Sub num="5.3" title={isRO ? 'Prin setarile browserului:' : 'Through browser settings:'}>
            <P>{isRO
              ? 'Poti configura browserul sa blocheze sau sa stearga cookie-urile. Instructiuni pentru browserele principale:'
              : 'You can configure your browser to block or delete cookies. Instructions for major browsers:'}
            </P>
            <UL items={[
              isRO ? 'Google Chrome: Setari > Confidentialitate si securitate > Cookie-uri si alte date ale site-urilor' : 'Google Chrome: Settings > Privacy and security > Cookies and other site data',
              isRO ? 'Mozilla Firefox: Optiuni > Confidentialitate si securitate > Cookie-uri si date ale site-urilor' : 'Mozilla Firefox: Options > Privacy & Security > Cookies and Site Data',
              isRO ? 'Safari: Preferinte > Confidentialitate > Gestionare date site-uri web' : 'Safari: Preferences > Privacy > Manage Website Data',
              isRO ? 'Microsoft Edge: Setari > Cookie-uri si permisiuni site' : 'Microsoft Edge: Settings > Cookies and site permissions',
              isRO ? 'Opera: Setari > Avansat > Confidentialitate si securitate > Cookie-uri' : 'Opera: Settings > Advanced > Privacy and security > Cookies',
            ]} />
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-600 leading-relaxed mt-2">
              <span className="font-semibold text-neutral-800">{isRO ? 'Atentie: ' : 'Warning: '}</span>
              {isRO
                ? 'Blocarea cookie-urilor strict necesare prin setarile browserului va afecta functionarea autentificarii si a altor functionalitati esentiale ale Platformei. Recomandam dezactivarea selectiva, exclusiv a categoriilor nestrict necesare, prin Centrul de Preferinte Cookie Hontrio.'
                : 'Blocking strictly necessary cookies through browser settings will affect the operation of authentication and other essential Platform features. We recommend selective deactivation, exclusively of non-strictly necessary categories, through the Hontrio Cookie Preferences Centre.'}
            </div>
          </Sub>
          <Sub num="5.4" title={isRO ? 'Prin optiunile furnizorilor de cookie-uri terti:' : 'Through third-party cookie provider options:'}>
            <UL items={[
              isRO ? 'Pentru cookie-urile plasate de Google in contextul autentificarii: myaccount.google.com/data-and-privacy' : 'For cookies placed by Google in the authentication context: myaccount.google.com/data-and-privacy',
              isRO ? 'Pentru cookie-urile plasate de Vercel Analytics: vercel.com/legal/privacy-policy' : 'For cookies placed by Vercel Analytics: vercel.com/legal/privacy-policy',
            ]} />
          </Sub>
        </>
      ),
    },
    {
      id: 's6',
      number: isRO ? 'Sectiunea 6' : 'Section 6',
      title: isRO ? 'Consimtamantul: cum il obtinem si cum il retiem' : 'Consent: how we obtain and record it',
      content: (
        <>
          <P>{isRO
            ? 'Conform GDPR Art. 4(11) si Directivei ePrivacy, consimtamantul tau pentru cookie-urile nestrict necesare trebuie sa fie:'
            : 'Pursuant to GDPR Art. 4(11) and the ePrivacy Directive, your consent for non-strictly necessary cookies must be:'}
          </P>
          <UL items={isRO ? [
            'Liber exprimat: optiunea de refuz este la fel de accesibila si vizibila ca optiunea de acceptare. Nu utilizam butoane asimetrice sau design manipulativ (dark patterns).',
            'Specific: poti accepta sau refuza fiecare categorie de cookie-uri independent.',
            'Informat: primesti informatii clare despre fiecare categorie inainte de a alege.',
            'Neambiguu: consimtamantul se obtine printr-o actiune afirmativa clara (click pe buton), nu prin simpla continuare a navigarii.',
          ] : [
            'Freely given: the refusal option is equally accessible and visible as the acceptance option. We do not use asymmetric buttons or manipulative design (dark patterns).',
            'Specific: you can accept or refuse each category of cookies independently.',
            'Informed: you receive clear information about each category before choosing.',
            'Unambiguous: consent is obtained through a clear affirmative action (button click), not by simply continuing to navigate.',
          ]} />
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-600 leading-relaxed my-3">
            <span className="font-semibold text-neutral-800">{isRO ? 'Important: ' : 'Important: '}</span>
            {isRO
              ? 'Nu setam niciun cookie nestrict necesar inainte ca tu sa iti fi exprimat consimtamantul. Toate scripturile si cookie-urile de analiza sunt blocate pana la acceptul explicit.'
              : 'We do not set any non-strictly necessary cookie before you have expressed your consent. All analytics scripts and cookies are blocked until explicit acceptance.'}
          </div>
          <P>{isRO
            ? 'Retragerea consimtamantului: Poti retrage consimtamantul oricand, la fel de usor cum l-ai acordat, prin Centrul de Preferinte Cookie. Retragerea consimtamantului nu afecteaza legalitatea prelucrarii efectuate inainte de retragere.'
            : 'Withdrawal of consent: You can withdraw consent at any time, just as easily as you granted it, through the Cookie Preferences Centre. Withdrawal of consent does not affect the lawfulness of processing carried out before withdrawal.'}
          </P>
          <P>{isRO
            ? 'Documentarea consimtamantului: Retinem urmatoarele informatii despre consimtamantul acordat: data si ora, versiunea bannerului afisata, categoriile acceptate si refuzate. Aceste informatii sunt pastrate pentru a putea demonstra conformitatea in fata autoritatilor de supraveghere.'
            : 'Consent documentation: We retain the following information about consent granted: date and time, version of the banner displayed, categories accepted and refused. This information is kept to demonstrate compliance to supervisory authorities.'}
          </P>
        </>
      ),
    },
    {
      id: 's7',
      number: isRO ? 'Sectiunea 7' : 'Section 7',
      title: isRO ? 'Transferuri internationale' : 'International transfers',
      content: (
        <P>{isRO
          ? 'Unii furnizori de cookie-uri terti (Vercel Analytics, Google, GitHub) sunt stabiliti in Statele Unite ale Americii. Transferurile de date catre acestia se realizeaza cu respectarea garantiilor prevazute de GDPR, in principal prin aderarea la EU-US Data Privacy Framework sau prin Clauze Contractuale Standard aprobate de Comisia Europeana.'
          : 'Some third-party cookie providers (Vercel Analytics, Google, GitHub) are established in the United States of America. Data transfers to them are carried out in compliance with the safeguards provided by GDPR, primarily through adherence to the EU-US Data Privacy Framework or through Standard Contractual Clauses approved by the European Commission.'}
        </P>
      ),
    },
    {
      id: 's8',
      number: isRO ? 'Sectiunea 8' : 'Section 8',
      title: isRO ? 'Cookie-urile si copiii' : 'Cookies and children',
      content: (
        <P>{isRO
          ? 'Platforma Hontrio este destinata exclusiv utilizarii profesionale de catre persoane cu capacitate juridica deplina. Nu colectam in mod intentionat date prin cookie-uri de la persoane cu varsta sub 18 ani. Daca esti minor, te rugam sa nu accesezi Platforma fara acordul unui parinte sau tutore legal.'
          : 'The Hontrio Platform is intended exclusively for professional use by persons with full legal capacity. We do not intentionally collect data through cookies from persons under 18 years of age. If you are a minor, please do not access the Platform without the consent of a parent or legal guardian.'}
        </P>
      ),
    },
    {
      id: 's9',
      number: isRO ? 'Sectiunea 9' : 'Section 9',
      title: isRO ? 'Actualizarea politicii de cookies' : 'Updating the cookie policy',
      content: (
        <>
          <P>{isRO
            ? 'Aceasta Politica poate fi actualizata periodic pentru a reflecta modificarile aduse categoriilor de cookie-uri utilizate, furnizorilor terti sau legislatiei aplicabile.'
            : 'This Policy may be updated periodically to reflect changes to the categories of cookies used, third-party providers or applicable legislation.'}
          </P>
          <P>{isRO
            ? 'In cazul modificarilor semnificative (adaugarea de noi categorii de cookie-uri sau furnizori noi care proceseaza date personale), vei fi notificat prin reafisarea bannerului de consimtamant cu solicitarea unui nou acord si prin notificare prin email daca ai un cont activ.'
            : 'In the case of significant changes (addition of new cookie categories or new providers processing personal data), you will be notified through re-display of the consent banner requesting new agreement and through email notification if you have an active account.'}
          </P>
          <P>{isRO
            ? 'Modificarile minore (actualizarea duratelor de viata ale cookie-urilor existente, corectii editoriale) pot fi efectuate fara notificare prealabila, cu actualizarea datei documentului.'
            : 'Minor changes (updating lifespans of existing cookies, editorial corrections) may be made without prior notice, with the document date being updated.'}
          </P>
        </>
      ),
    },
    {
      id: 's10',
      number: isRO ? 'Sectiunea 10' : 'Section 10',
      title: isRO ? 'Contact' : 'Contact',
      content: (
        <>
          <P>{isRO
            ? 'Pentru orice intrebare despre utilizarea cookie-urilor pe Platforma sau site-ul Hontrio:'
            : 'For any questions about the use of cookies on the Platform or the Hontrio website:'}
          </P>
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-700 space-y-2 my-3">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
              <span className="font-semibold">Email:</span>
              <a href="mailto:privacy@hontrio.com" className="text-neutral-900 hover:underline">privacy@hontrio.com</a>
            </div>
            <p><span className="font-semibold">{isRO ? 'Telefon' : 'Phone'}:</span> 0750 456 096</p>
            <div>
              <p className="font-semibold mb-0.5">{isRO ? 'Adresa' : 'Address'}:</p>
              <p className="text-neutral-600">SC VOID SFT GAMES SRL<br />Str. Progresului 2, Bl. A29, Sc. 2, Et. 2, Ap. 10<br />Sat Matasari, Jud. Gorj, {isRO ? 'Cod Postal' : 'Postal Code'} 217295, Romania</p>
            </div>
          </div>
          <P>{isRO
            ? 'Daca consideri ca nu respectam legislatia aplicabila privind cookie-urile, ai dreptul de a depune o plangere la ANSPDCP.'
            : 'If you believe we are not complying with applicable cookie legislation, you have the right to lodge a complaint with the ANSPDCP.'}
          </P>
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-neutral-900 hover:underline font-medium">
              www.dataprotection.ro <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <span className="text-neutral-400">|</span>
            <a href="mailto:anspdcp@dataprotection.ro" className="text-neutral-700 hover:underline">anspdcp@dataprotection.ro</a>
          </div>
        </>
      ),
    },
  ]
}

// ─── TOC labels ───────────────────────────────────────────────────────────────

const TOC_RO = [
  'Cadrul legal aplicabil',
  'Ce sunt cookie-urile',
  'Categoriile de cookie-uri pe care le utilizam',
  'Ce date colecteaza cookie-urile si cum le utilizam',
  'Cum poti controla cookie-urile',
  'Consimtamantul: cum il obtinem si cum il retiem',
  'Transferuri internationale',
  'Cookie-urile si copiii',
  'Actualizarea politicii de cookies',
  'Contact',
]
const TOC_EN = [
  'Applicable legal framework',
  'What cookies are',
  'Categories of cookies we use',
  'What data cookies collect and how we use it',
  'How you can control cookies',
  'Consent: how we obtain and record it',
  'International transfers',
  'Cookies and children',
  'Updating the cookie policy',
  'Contact',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CookiesPage() {
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
      {/* Hero */}
      <section className="pt-20 pb-12 border-b border-neutral-100">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div {...fadeUp(0)}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-xs font-semibold text-neutral-600 mb-6">
              <Cookie className="h-3.5 w-3.5" />
              {isRO ? 'Document legal' : 'Legal document'}
            </div>
          </motion.div>
          <motion.h1 {...fadeUp(0.06)} className="text-4xl md:text-5xl font-black text-neutral-900 tracking-tight mb-6">
            {isRO ? 'Politica de Cookies' : 'Cookie Policy'}
          </motion.h1>
          <motion.p {...fadeUp(0.1)} className="text-neutral-500 text-base leading-relaxed mb-8 max-w-2xl">
            {isRO
              ? 'Aceasta politica explica ce sunt cookie-urile, ce tipuri de cookie-uri utilizeaza platforma Hontrio si site-ul hontrio.com, de ce le folosim si cum poti controla utilizarea lor. Te rugam sa o citesti impreuna cu Politica noastra de Confidentialitate.'
              : 'This policy explains what cookies are, what types of cookies the Hontrio platform and hontrio.com use, why we use them and how you can control their use. Please read it together with our Privacy Policy.'}
          </motion.p>
          <motion.div {...fadeUp(0.14)} className="flex flex-wrap gap-3">
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

      {/* Main */}
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
              {sections.map((section) => (
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

            {/* Footer */}
            <div className="mt-14 pt-8 border-t border-neutral-100">
              <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-6 space-y-3">
                <p className="text-xs text-neutral-500">
                  {isRO
                    ? `Data ultimei actualizari: ${effectiveDate} — Versiunea ${VERSION}`
                    : `Last updated: ${effectiveDate} — Version ${VERSION}`}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                  <span>{isRO ? 'Linkuri conexe:' : 'Related links:'}</span>
                  <a href="/legal/privacy" className="text-neutral-700 hover:underline">{isRO ? 'Politica de Confidentialitate' : 'Privacy Policy'}</a>
                  <span className="text-neutral-300">|</span>
                  <a href="/legal/terms" className="text-neutral-700 hover:underline">{isRO ? 'Termeni si Conditii' : 'Terms and Conditions'}</a>
                </div>
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
