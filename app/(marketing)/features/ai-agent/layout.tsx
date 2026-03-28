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

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
