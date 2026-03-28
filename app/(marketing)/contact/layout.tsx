import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contacteaza echipa Hontrio pentru suport tehnic, intrebari despre produse sau colaborari. Raspundem in maximum 24 de ore.',
  keywords: [
    'contact hontrio',
    'suport hontrio',
    'ajutor magazin online AI',
  ],
  openGraph: {
    title: 'Contact | Hontrio',
    description:
      'Contacteaza echipa Hontrio pentru suport tehnic, intrebari despre produse sau colaborari. Raspundem in maximum 24 de ore.',
    url: 'https://hontrio.com/contact',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact | Hontrio',
    description:
      'Contacteaza echipa Hontrio pentru suport tehnic, intrebari despre produse sau colaborari. Raspundem in maximum 24 de ore.',
  },
  alternates: {
    canonical: 'https://hontrio.com/contact',
  },
}

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'SC VOID SFT GAMES SRL',
  alternateName: 'Hontrio',
  url: 'https://hontrio.com',
  telephone: '+40750456096',
  email: 'contact@hontrio.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Str. Progresului 2, Bl. A29, Sc. 2, Et. 2, Ap. 10',
    addressLocality: 'Sat Matasari',
    addressRegion: 'Gorj',
    postalCode: '217295',
    addressCountry: 'RO',
  },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Cum conectez magazinul meu online la Hontrio?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Instalezi pluginul gratuit Hontrio din marketplace-ul magazinului tau online, introduci cheia API din dashboard-ul Hontrio si sincronizarea porneste automat. Intregul proces dureaza sub 5 minute.',
      },
    },
    {
      '@type': 'Question',
      name: 'Cate produse pot procesa pe luna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Depinde de planul ales. Planul Starter include 100 de credite lunare, planul Pro include 500 de credite, iar planul Business este nelimitat. Fiecare actiune majora (generare imagine, text SEO, analiza comanda) consuma 1 credit.',
      },
    },
    {
      '@type': 'Question',
      name: 'Agentul AI Chat functioneaza in romana?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Da. Agentul AI Chat Hontrio detecteaza automat limba fiecarui vizitator si raspunde in romana, engleza sau orice alta limba configurata. Setezi limba preferata din setarile pluginului.',
      },
    },
    {
      '@type': 'Question',
      name: 'Sunt datele magazinului meu in siguranta?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Hontrio proceseaza doar datele necesare pentru a furniza serviciul solicitat (imagini produse, descrieri, detalii comenzi). Nu vindem si nu impartasim datele tale cu terte parti. Platforma foloseste Supabase (regiune EU) pentru stocare si Vercel pentru hosting.',
      },
    },
    {
      '@type': 'Question',
      name: 'Pot anula abonamentul oricand?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Da, fara nicio penalizare. Poti anula direct din dashboard-ul de facturare. Abonamentul ramane activ pana la sfarsitul perioadei de facturare curente.',
      },
    },
    {
      '@type': 'Question',
      name: 'Oferiti o perioada de proba gratuita?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Da. Poti folosi Hontrio gratuit timp de 14 zile cu acces la toate functiile. Nu este necesara cardul de credit pentru a incepe.',
      },
    },
  ],
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {children}
    </>
  )
}
