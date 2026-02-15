import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HONTRIO - AI Growth Engine for eCommerce',
  description: 'Platformă AI pentru optimizarea produselor din magazinul tău online',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ro">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}