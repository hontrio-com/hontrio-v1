import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SEO Optimizer',
  description:
    'Genereaza titluri, descrieri si meta description optimizate SEO pentru fiecare produs in secunde. Scor SEO real, standarde Google E-E-A-T, continut unic garantat.',
  keywords: [
    'SEO automat WooCommerce',
    'optimizare produse SEO',
    'titluri SEO AI',
    'meta description generator',
    'ecommerce SEO automation',
    'Google EEAT ecommerce',
  ],
  openGraph: {
    title: 'SEO Optimizer | Hontrio',
    description:
      'Genereaza titluri, descrieri si meta description optimizate SEO pentru fiecare produs in secunde. Scor SEO real, standarde Google E-E-A-T, continut unic garantat.',
    url: 'https://hontrio.com/features/seo',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SEO Optimizer | Hontrio',
    description:
      'Genereaza titluri, descrieri si meta description optimizate SEO pentru fiecare produs in secunde. Scor SEO real, standarde Google E-E-A-T, continut unic garantat.',
  },
  alternates: {
    canonical: 'https://hontrio.com/features/seo',
  },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Textele generate sunt cu adevarat unice pentru fiecare produs?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Da. Sistemul genereaza continut original pentru fiecare produs in parte, bazat pe informatiile specifice ale acelui produs. Nu exista sabloane fixe si niciun text nu se repeta intre produse diferite.',
      },
    },
    {
      '@type': 'Question',
      name: 'Pot edita textele dupa ce au fost generate?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Da. Toate textele generate pot fi editate manual inainte de publicare. Hontrio ofera o baza solida, iar tu ai ultimul cuvant inainte ca textele sa apara in magazin.',
      },
    },
    {
      '@type': 'Question',
      name: 'Functioneaza si pentru produse dintr-o nisa foarte specifica?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Da. Sistemul analizeaza informatiile pe care le introduci despre produs si se adapteaza la orice categorie sau nisa. Cu cat oferi mai multe detalii, cu atat rezultatele sunt mai precise.',
      },
    },
    {
      '@type': 'Question',
      name: 'Cat dureaza pana apar rezultatele in Google dupa optimizare?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Rezultatele in motoarele de cautare depind de mai multi factori externi Hontrio, inclusiv frecventa de crawl a Google pentru site-ul tau. In general, primele imbunatatiri de pozitionare devin vizibile in patru pana la opt saptamani de la publicarea textelor optimizate.',
      },
    },
    {
      '@type': 'Question',
      name: 'O optimizare este permanenta sau trebuie repetata?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Textele publicate raman in magazinul tau fara nicio actiune suplimentara. Reoptimizarea este utila cand actualizezi un produs, cand sezonul se schimba sau cand vrei sa testezi variante noi de titluri si descrieri.',
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
