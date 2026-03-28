import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Agent',
  description:
    'Asistent virtual de vanzari care raspunde instantaneu clientilor, recomanda produse si permite adaugarea in cos direct din chat. Activ 24/7, fara interventie manuala.',
  keywords: [
    'agent AI magazin online',
    'chatbot vanzari ecommerce',
    'asistent virtual magazin',
    'AI sales agent',
    'chat widget WooCommerce',
    'recomandare produse AI',
  ],
  openGraph: {
    title: 'AI Agent | Hontrio',
    description:
      'Asistent virtual de vanzari care raspunde instantaneu clientilor, recomanda produse si permite adaugarea in cos direct din chat. Activ 24/7, fara interventie manuala.',
    url: 'https://hontrio.com/features/ai-agent',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Agent | Hontrio',
    description:
      'Asistent virtual de vanzari care raspunde instantaneu clientilor, recomanda produse si permite adaugarea in cos direct din chat. Activ 24/7, fara interventie manuala.',
  },
  alternates: {
    canonical: 'https://hontrio.com/features/ai-agent',
  },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Agentul functioneaza si daca nu am WooCommerce?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'In prezent agentul Hontrio este optimizat pentru magazinele WooCommerce. Integrarea cu alte platforme precum Shopify sau Gomag este in dezvoltare si va fi disponibila in versiunile urmatoare.',
      },
    },
    {
      '@type': 'Question',
      name: 'Ce se intampla daca agentul nu stie sa raspunda la o intrebare?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Agentul recunoaste limitele sale. In loc sa inventeze un raspuns, ii spune clientului ca nu are informatia si ofera optiunea de transfer catre tine pe WhatsApp, cu tot contextul conversatiei deja completat.',
      },
    },
    {
      '@type': 'Question',
      name: 'Pot vedea toate conversatiile pe care le-a purtat agentul?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Da. Toate conversatiile sunt salvate in inbox-ul din dashboard-ul Hontrio. Poti filtra dupa data, dupa produsele mentionate sau dupa conversatiile care au necesitat escaladare.',
      },
    },
    {
      '@type': 'Question',
      name: 'Agentul poate finaliza comenzi sau doar raspunde la intrebari?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'In versiunea actuala, agentul ghideaza cumparatorul catre produsul potrivit si il redirectioneaza catre pagina de produs sau cosul de cumparaturi. Finalizarea comenzii se face in WooCommerce, ca de obicei.',
      },
    },
    {
      '@type': 'Question',
      name: 'Cat timp dureaza pana agentul cunoaste tot catalogul meu?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sincronizarea initiala dureaza intre cateva secunde si cateva minute, in functie de numarul de produse. Dupa aceea, orice produs nou adaugat in WooCommerce apare automat in cunostintele agentului.',
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
