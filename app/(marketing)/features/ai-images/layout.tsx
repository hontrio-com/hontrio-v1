import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Image Generation',
  description:
    'Transforma fotografiile obisnuite in imagini profesionale in secunde. Fundal alb, lifestyle, premium dark si alte stiluri AI pentru orice canal de vanzare sau marketplace.',
  keywords: [
    'generare imagini AI',
    'imagini produse AI',
    'fundal alb automat',
    'AI product images',
    'ecommerce product photography AI',
    'imagini eMag fundal alb',
  ],
  openGraph: {
    title: 'AI Image Generation | Hontrio',
    description:
      'Transforma fotografiile obisnuite in imagini profesionale in secunde. Fundal alb, lifestyle, premium dark si alte stiluri AI pentru orice canal de vanzare sau marketplace.',
    url: 'https://hontrio.com/features/ai-images',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Image Generation | Hontrio',
    description:
      'Transforma fotografiile obisnuite in imagini profesionale in secunde. Fundal alb, lifestyle, premium dark si alte stiluri AI pentru orice canal de vanzare sau marketplace.',
  },
  alternates: {
    canonical: 'https://hontrio.com/features/ai-images',
  },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Obtii rezultate bune si de pe fotografii de calitate slaba?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sistemul functioneaza cel mai bine cu fotografii clare ale produsului. O imagine sursa de calitate mai scazuta va produce totusi un rezultat superior originalului, insa calitatea fotografiei initiale influenteaza direct calitatea rezultatului final.',
      },
    },
    {
      '@type': 'Question',
      name: 'Poti genera toate cele sase stiluri din aceeasi fotografie?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Da. Din o singura fotografie incarcata poti genera variante in oricare dintre cele sase stiluri disponibile. Fiecare generare consuma credite separat.',
      },
    },
    {
      '@type': 'Question',
      name: 'Imaginile generate respecta cerintele tehnice ale marketplace-urilor?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Stilul Fundal Alb este optimizat special pentru cerintele platformelor de comert electronic din Romania si Europa. Rezolutia, formatul si compozitia respecta specificatiile tehnice ale platformelor principale.',
      },
    },
    {
      '@type': 'Question',
      name: 'Cate credite costa generarea unei imagini?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'O imagine costa intre 6 si 8 credite, in functie de stilul ales (Fundal Alb = 6 credite, celelalte stiluri = 7-8 credite). Verificarea automata a calitatii este inclusa fara costuri suplimentare.',
      },
    },
  ],
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  )
}
