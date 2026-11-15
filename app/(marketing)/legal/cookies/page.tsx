import type { Metadata } from 'next'
import { getLocale } from '@/lib/i18n/server'
import { A, Code, L, LegalPage, Mail, P, Table, type LegalDoc } from '../legal-page'
import { CookieSettingsButton } from '../cookie-settings-button'

// =============================================
// Politica de cookie-uri, în română și în engleză: lista reală a cookie-urilor
// (NextAuth, conectările OAuth, limba, alegerea despre cookie-uri) și Google
// Analytics, care se încarcă doar după „Accept” (components/cookie-consent.tsx).
// =============================================

const RO: LegalDoc = {
  title: 'Politica de cookie-uri',
  summary: <>Ce cookie-uri și ce date din browser folosesc hontrio.com și app.hontrio.com, de ce, cât timp și cum îți dai sau îți retragi acordul.</>,
  sections: [
    {
      id: 'ce-sunt', title: 'Ce sunt cookie-urile',
      body: <P>Cookie-urile sunt fișiere mici pe care un site le salvează în browserul tău. Tot aici intră și stocarea locală a browserului (local storage), pe care o folosim pentru o preferință. Le folosim după Legea nr. 506/2004 și GDPR: fără acordul tău punem doar ce este strict necesar pentru serviciul pe care l-ai cerut.</P>,
    },
    {
      id: 'necesare', title: 'Cookie-uri strict necesare',
      body: <>
        <P>Fără ele site-ul sau contul nu funcționează, așa că nu cer acord (art. 4 alin. (6) din Legea nr. 506/2004). Toate sunt ale Hontrio și nu servesc la urmărire sau la reclame.</P>
        <Table head={['Nume', 'Unde', 'La ce folosește', 'Cât durează']} rows={[
          [<Code key="c">__Secure-next-auth.session-token</Code>, 'app.hontrio.com', 'Te ține autentificat', '24 de ore'],
          [<Code key="c">__Secure-next-auth.callback-url</Code>, 'app.hontrio.com', 'Pagina la care revii după autentificare', 'Până închizi browserul'],
          [<Code key="c">__Host-next-auth.csrf-token</Code>, 'app.hontrio.com', 'Protecție împotriva cererilor false (CSRF)', 'Până închizi browserul'],
          [<><Code>__Secure-next-auth.pkce.code_verifier</Code>, <Code>__Secure-next-auth.state</Code></>, 'app.hontrio.com', 'Securitatea intrării cu Google', '15 minute'],
          [<Code key="c">google_oauth_state</Code>, 'app.hontrio.com', 'Securitatea conectării Google Ads', '10 minute'],
          [<Code key="c">edinio_oauth</Code>, 'app.hontrio.com', 'Securitatea conectării unui magazin Edinio', '10 minute'],
          [<><Code>shopify_oauth_state</Code>, <Code>shopify_redirect_onboarding</Code></>, 'app.hontrio.com', 'Securitatea conectării unui magazin Shopify', '5 minute'],
          [<Code key="c">hontrio_return_to</Code>, 'app.hontrio.com', 'Unde revii după o conectare pornită din configurarea inițială', '15 minute'],
          [<Code key="c">hontrio_verify</Code>, 'app.hontrio.com', 'La confirmarea adresei de e-mail, ține codul din link în afara adresei paginii', 'Cel mult o oră'],
          [<Code key="c">hontrio_reset</Code>, 'app.hontrio.com', 'La resetarea parolei, ține codul din link în afara adresei paginii', 'Cel mult 30 de minute'],
          [<Code key="c">hontrio_locale</Code>, 'hontrio.com, app.hontrio.com', 'Limba aleasă în Setări sau printr-un link de limbă', '1 an'],
          [<Code key="c">hontrio_consent</Code>, 'hontrio.com și subdomeniile lui', 'Alegerea ta despre cookie-uri', '12 luni'],
          [<><Code>hontrio_announce_launch_free</Code> (stocare locală)</>, 'hontrio.com', 'Ține minte că ai închis anunțul din antet', 'Până ștergi datele site-ului din browser'],
        ]} />
      </>,
    },
    {
      id: 'analiza', title: 'Cookie-uri de analiză, doar cu acordul tău',
      body: <>
        <P>Folosim Google Analytics 4 ca să vedem câți oameni vizitează site-ul și aplicația, ce pagini citesc și de unde vin. Până nu apeși „Accept”, scriptul Google Analytics nu se încarcă deloc și nu trimitem nimic la Google.</P>
        <Table head={['Nume', 'Unde', 'La ce folosește', 'Cât durează']} rows={[
          [<Code key="c">_ga</Code>, 'hontrio.com și subdomeniile lui', 'Google Analytics: deosebește vizitatorii între ei', '2 ani'],
          [<Code key="c">_ga_5T68NF431T</Code>, 'hontrio.com și subdomeniile lui', 'Google Analytics: păstrează starea vizitei', '2 ani'],
        ]} />
        <P>Cu acordul tău, Google primește pagina vizitată, sursa vizitei, informații despre dispozitiv și browser și adresa IP, din care deduce localizarea aproximativă; Google Analytics nu păstrează adresa IP. Semnalele Google și personalizarea reclamelor sunt oprite, iar datele nu le folosim pentru reclame. Google prelucrează datele după <A href="https://policies.google.com/privacy">politica de confidențialitate Google</A>.</P>
      </>,
    },
    {
      id: 'nu-folosim', title: 'Ce nu folosim',
      body: <>
        <P>Nu folosim cookie-uri de publicitate sau de remarketing, pixeli ai rețelelor sociale și nici instrumente care înregistrează sesiunea.</P>
        <P>Unele servicii își pun propriile cookie-uri pe domeniile lor: când alegi „Continuă cu Google”, ajungi pe paginile Google, care folosesc cookie-urile Google; la înregistrare, verificarea anti-roboți Cloudflare Turnstile, când este activă, citește informații tehnice despre browser ca să deosebească oamenii de roboți.</P>
      </>,
    },
    {
      id: 'acord', title: 'Cum îți dai și cum îți retragi acordul',
      body: <>
        <P>La prima vizită îți arătăm un banner cu două butoane la fel de vizibile, „Accept” și „Refuz”. Alegerea o ținem 12 luni în cookie-ul <Code>hontrio_consent</Code>, comun pentru hontrio.com și app.hontrio.com, apoi te întrebăm din nou.</P>
        <P>Îți poți schimba oricând alegerea din „Setări cookie-uri”, în subsolul site-ului, sau de aici:</P>
        <div><CookieSettingsButton label="Setări cookie-uri" /></div>
        <P>Când îți retragi acordul, oprim Google Analytics și ștergem cookie-urile <Code>_ga</Code> de pe domeniul nostru. Retragerea nu afectează ce s-a măsurat înainte.</P>
      </>,
    },
    {
      id: 'browser', title: 'Din browser',
      body: <P>Poți șterge sau bloca cookie-urile din setările browserului. Dacă le blochezi pe cele strict necesare, nu vei mai putea intra în cont.</P>,
    },
    {
      id: 'contact', title: 'Contact',
      body: <P>Întrebările despre cookie-uri și date le trimiți la <Mail to="privacy@hontrio.com" />. Cum prelucrăm datele afli din <L href="/legal/privacy">Politica de confidențialitate</L>.</P>,
    },
  ],
}

const EN: LegalDoc = {
  title: 'Cookie Policy',
  summary: <>Which cookies and browser data hontrio.com and app.hontrio.com use, why, for how long, and how you give or withdraw your consent.</>,
  sections: [
    {
      id: 'what', title: 'What cookies are',
      body: <P>Cookies are small files a website saves in your browser. This also covers the browser’s local storage, which we use for one preference. We use them under Romanian Law no. 506/2004 and the GDPR: without your consent we only set what is strictly necessary for the service you asked for.</P>,
    },
    {
      id: 'necessary', title: 'Strictly necessary cookies',
      body: <>
        <P>Without them the site or the account does not work, so they do not require consent (Art. 4(6) of Law no. 506/2004). They all belong to Hontrio and are not used for tracking or advertising.</P>
        <Table head={['Name', 'Where', 'What it is for', 'Duration']} rows={[
          [<Code key="c">__Secure-next-auth.session-token</Code>, 'app.hontrio.com', 'Keeps you signed in', '24 hours'],
          [<Code key="c">__Secure-next-auth.callback-url</Code>, 'app.hontrio.com', 'The page you return to after signing in', 'Until you close the browser'],
          [<Code key="c">__Host-next-auth.csrf-token</Code>, 'app.hontrio.com', 'Protection against forged requests (CSRF)', 'Until you close the browser'],
          [<><Code>__Secure-next-auth.pkce.code_verifier</Code>, <Code>__Secure-next-auth.state</Code></>, 'app.hontrio.com', 'Security of signing in with Google', '15 minutes'],
          [<Code key="c">google_oauth_state</Code>, 'app.hontrio.com', 'Security of connecting Google Ads', '10 minutes'],
          [<Code key="c">edinio_oauth</Code>, 'app.hontrio.com', 'Security of connecting an Edinio store', '10 minutes'],
          [<><Code>shopify_oauth_state</Code>, <Code>shopify_redirect_onboarding</Code></>, 'app.hontrio.com', 'Security of connecting a Shopify store', '5 minutes'],
          [<Code key="c">hontrio_return_to</Code>, 'app.hontrio.com', 'Where you return after a connection started from the initial setup', '15 minutes'],
          [<Code key="c">hontrio_verify</Code>, 'app.hontrio.com', 'When you confirm your email address, keeps the code from the link out of the page address', 'Up to one hour'],
          [<Code key="c">hontrio_reset</Code>, 'app.hontrio.com', 'When you reset your password, keeps the code from the link out of the page address', 'Up to 30 minutes'],
          [<Code key="c">hontrio_locale</Code>, 'hontrio.com, app.hontrio.com', 'The language you chose in Settings or through a language link', '1 year'],
          [<Code key="c">hontrio_consent</Code>, 'hontrio.com and its subdomains', 'Your cookie choice', '12 months'],
          [<><Code>hontrio_announce_launch_free</Code> (local storage)</>, 'hontrio.com', 'Remembers that you closed the announcement in the header', 'Until you clear the site data in your browser'],
        ]} />
      </>,
    },
    {
      id: 'analytics', title: 'Analytics cookies, only with your consent',
      body: <>
        <P>We use Google Analytics 4 to see how many people visit the site and the app, which pages they read and where they come from. Until you press “Accept”, the Google Analytics script does not load at all and nothing is sent to Google.</P>
        <Table head={['Name', 'Where', 'What it is for', 'Duration']} rows={[
          [<Code key="c">_ga</Code>, 'hontrio.com and its subdomains', 'Google Analytics: tells visitors apart', '2 years'],
          [<Code key="c">_ga_5T68NF431T</Code>, 'hontrio.com and its subdomains', 'Google Analytics: keeps the state of the visit', '2 years'],
        ]} />
        <P>With your consent, Google receives the page visited, the source of the visit, device and browser information and the IP address, from which it derives an approximate location; Google Analytics does not store the IP address. Google signals and ad personalization are turned off, and we do not use the data for advertising. Google processes the data under the <A href="https://policies.google.com/privacy">Google Privacy Policy</A>.</P>
      </>,
    },
    {
      id: 'not-used', title: 'What we do not use',
      body: <>
        <P>We do not use advertising or remarketing cookies, social media pixels or session recording tools.</P>
        <P>Some services set their own cookies on their domains: when you choose “Continue with Google”, you go to Google’s pages, which use Google’s cookies; at sign-up, the Cloudflare Turnstile anti-bot check, when enabled, reads technical information about the browser to tell people from bots.</P>
      </>,
    },
    {
      id: 'consent', title: 'How to give and withdraw your consent',
      body: <>
        <P>On your first visit we show a banner with two equally visible buttons, “Accept” and “Decline”. We keep your choice for 12 months in the <Code>hontrio_consent</Code> cookie, shared by hontrio.com and app.hontrio.com, then we ask again.</P>
        <P>You can change your choice at any time from “Cookie settings” in the site footer, or here:</P>
        <div><CookieSettingsButton label="Cookie settings" /></div>
        <P>When you withdraw your consent, we stop Google Analytics and delete the <Code>_ga</Code> cookies from our domain. Withdrawal does not affect what was measured before.</P>
      </>,
    },
    {
      id: 'browser', title: 'From your browser',
      body: <P>You can delete or block cookies in your browser settings. If you block the strictly necessary ones, you will not be able to sign in.</P>,
    },
    {
      id: 'contact', title: 'Contact',
      body: <P>Send questions about cookies and data to <Mail to="privacy@hontrio.com" />. How we process data is explained in the <L href="/legal/privacy">Privacy Policy</L>.</P>,
    },
  ],
}

export async function generateMetadata(): Promise<Metadata> {
  const ro = (await getLocale()) === 'ro'
  return {
    title: ro ? RO.title : EN.title,
    description: ro
      ? 'Cookie-urile folosite de Hontrio, de ce și cât timp, plus Google Analytics, doar cu acordul tău.'
      : 'The cookies Hontrio uses, why and for how long, plus Google Analytics, only with your consent.',
    alternates: { canonical: 'https://hontrio.com/legal/cookies' },
  }
}

export default async function CookiesPage() {
  const locale = await getLocale()
  return <LegalPage kind="cookies" locale={locale} doc={locale === 'ro' ? RO : EN} contact="privacy@hontrio.com" />
}
