import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Preturi',
  description:
    'Planuri simple si transparente pentru magazine online de orice dimensiune. Incearca Hontrio gratuit, fara card de credit. Credite lunare pentru imagini AI, SEO si agent.',
  keywords: [
    'preturi hontrio',
    'abonament ecommerce AI',
    'plan gratuit AI magazin',
    'hontrio pricing',
    'cost optimizare magazin online',
  ],
  openGraph: {
    title: 'Preturi | Hontrio',
    description:
      'Planuri simple si transparente pentru magazine online de orice dimensiune. Incearca Hontrio gratuit, fara card de credit. Credite lunare pentru imagini AI, SEO si agent.',
    url: 'https://hontrio.com/pricing',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Preturi | Hontrio',
    description:
      'Planuri simple si transparente pentru magazine online de orice dimensiune. Incearca Hontrio gratuit, fara card de credit. Credite lunare pentru imagini AI, SEO si agent.',
  },
  alternates: {
    canonical: 'https://hontrio.com/pricing',
  },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Ce sunt creditele si de cate am nevoie?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Creditele sunt moneda de utilizare AI. O optimizare SEO costa 3 credite, o imagine AI costa 6 pana la 8 credite. Majoritatea magazinelor folosesc intre 50 si 300 de credite pe luna in functie de marimea catalogului.',
      },
    },
    {
      '@type': 'Question',
      name: 'Exista o perioada de proba gratuita?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Da. Primesti 20 de credite gratuite cand iti creezi contul, fara card de credit. Acestea sunt suficiente pentru a optimiza aproximativ 6 produse sau a genera 3 imagini AI si a vedea rezultatele.',
      },
    },
    {
      '@type': 'Question',
      name: 'Pot schimba planul oricand?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Absolut. Poti face upgrade, downgrade sau anula planul oricand din panoul de cont. Modificarile intra in vigoare imediat.',
      },
    },
    {
      '@type': 'Question',
      name: 'Cum functioneaza integrarea cu WooCommerce?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Magazinul tau se conecteaza usor in timpul procesului de onboarding sau din Setari oricand. Nu sunt necesare cunostinte tehnice. Daca intampini probleme, echipa noastra ofera asistenta rapida.',
      },
    },
    {
      '@type': 'Question',
      name: 'Datele magazinului meu sunt in siguranta?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Da. Toate datele sunt criptate in tranzit si in repaus. Suntem conformi GDPR si nu impartasim niciodata datele tale cu terte parti. Datele tale de produs sunt folosite doar pentru a genera continut pentru magazinul tau.',
      },
    },
    {
      '@type': 'Question',
      name: 'In ce limbi genereaza AI continut?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AI-ul genereaza continut in orice limba ai nevoie. Seteaza limba dorita in setarile brandului si AI-ul va scrie in acea limba. Interfata Hontrio este disponibila in engleza si romana.',
      },
    },
  ],
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {children}
    </>
  )
}
