import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Risk Shield',
  description:
    'Detecteaza automat comenzile cu risc de refuz COD. Scor de risc bazat pe 20+ semnale pentru fiecare comanda noua. Protejeaza-ti magazinul de colete neridicate.',
  keywords: [
    'protectie comenzi COD',
    'detectie frauda ecommerce',
    'risc comenzi Romania',
    'colete neridicate',
    'risk shield WooCommerce',
    'fraud detection ecommerce',
  ],
  openGraph: {
    title: 'Risk Shield | Hontrio',
    description:
      'Detecteaza automat comenzile cu risc de refuz COD. Scor de risc bazat pe 20+ semnale pentru fiecare comanda noua. Protejeaza-ti magazinul de colete neridicate.',
    url: 'https://hontrio.com/features/risk-shield',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Risk Shield | Hontrio',
    description:
      'Detecteaza automat comenzile cu risc de refuz COD. Scor de risc bazat pe 20+ semnale pentru fiecare comanda noua. Protejeaza-ti magazinul de colete neridicate.',
  },
  alternates: {
    canonical: 'https://hontrio.com/features/risk-shield',
  },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Risk Shield functioneaza cu toti curierii?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Da. Risk Shield analizeaza datele comenzilor independent de curierul folosit. Se integreaza cu magazinul tau online si citeste datele comenzilor si ale clientilor direct, indiferent de furnizorul de curierat.',
      },
    },
    {
      '@type': 'Question',
      name: 'Clientul blocat stie ca a fost blocat?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nu. Risk Shield opereaza silentios in fundal. Un client blocat vede pur si simplu ca comanda nu poate fi procesata cu plata la livrare si i se poate oferi optiunea de plata in avans.',
      },
    },
    {
      '@type': 'Question',
      name: 'Ce se intampla daca Risk Shield blocheaza un client bun din greseala?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Tu ai intotdeauna control deplin. Poti revizui orice comanda semnalata si poti suprascrie decizia manual. Sistemul invata si din corectiile tale pentru a imbunatati acuratetea viitoare.',
      },
    },
    {
      '@type': 'Question',
      name: 'Datele clientilor sunt partajate cu alte magazine?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Doar semnale comportamentale anonimizate contribuie la blacklist-ul partajat. Niciun dato personal (nume, email, adresa) nu este niciodata partajat. Fiecare magazin vede doar detaliile propriilor clienti.',
      },
    },
    {
      '@type': 'Question',
      name: 'Cat dureaza pana cand Risk Shield incepe sa faca predictii precise?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Modelul incepe sa functioneze de la prima comanda. Acuratetea creste semnificativ dupa 50-100 de comenzi analizate, pe masura ce sistemul se calibreaza la tiparele specifice ale clientilor tai.',
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
