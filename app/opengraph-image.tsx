import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { getT } from '@/lib/i18n/server'
import marketingRo from '@/lib/i18n/messages/ro/marketing.json'

// =============================================
// Imaginea de previzualizare a site-ului (Open Graph și Twitter, vezi
// app/layout.tsx): alb-negru, ca logoul. Sloganul de pe prima pagină și fraza
// din metadate, în limba cererii, ca titlul și descrierea.
// Fontul e Geist, ca pe site, luat de la Google Fonts doar pentru literele de
// aici (fontul implicit n-are ă, ș, ț); fără rețea, iese cu fontul implicit.
// =============================================

// Textul alternativ e fix (nu depinde de cerere), deci în limba-sursă
export const alt = marketingRo.meta_og_alt
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }

/** Geist 400 și 700, doar cu literele din `text` (exemplul din documentația Next.js). */
async function geist(text: string): Promise<Font[]> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Geist:wght@400;700&text=${encodeURIComponent(text)}`
    const css = await (await fetch(url, { signal: AbortSignal.timeout(3000) })).text()
    const faces = [...css.matchAll(/font-weight:\s*(\d+);[\s\S]*?src:\s*url\((.+?)\)\s*format\('(?:opentype|truetype)'\)/g)]
    return await Promise.all(faces.map(async ([, weight, src]) => {
      const res = await fetch(src, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) throw new Error(`font ${res.status}`)
      return { name: 'Geist', data: await res.arrayBuffer(), weight: (weight === '700' ? 700 : 400) as 400 | 700, style: 'normal' as const }
    }))
  } catch {
    return []
  }
}

export default async function Image() {
  const t = await getT()
  const titleA = t('site.hero_title_a')
  const titleB = t('site.hero_title_b')
  const description = t('marketing.meta_og_description')
  const footer = 'Edinio · WooCommerce · Shopify'
  const [logo, fonts] = await Promise.all([
    readFile(join(process.cwd(), 'public/logo-black.png')),
    geist(`${titleA}${titleB}${description}${footer}hontrio.com`),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#ffffff',
          color: '#0a0a0a',
          padding: '72px 80px 64px',
          fontFamily: fonts.length ? 'Geist' : 'sans-serif',
        }}
      >
        {/* Logoul (772 × 106), la 40 px înălțime */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${logo.toString('base64')}`} width={291} height={40} alt="" />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2.5 }}>
            <span>{titleA}</span>
            <span style={{ color: '#525252' }}>{titleB}</span>
          </div>
          <div style={{ marginTop: 28, maxWidth: 920, fontSize: 28, lineHeight: 1.4, color: '#525252' }}>{description}</div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #e7e7e7',
            paddingTop: 26,
            fontSize: 22,
            color: '#737373',
          }}
        >
          <span style={{ color: '#0a0a0a', fontWeight: 700 }}>hontrio.com</span>
          <span>{footer}</span>
        </div>
      </div>
    ),
    // Fără fonturi proprii (o listă goală nu e voie), rămâne fontul implicit al next/og
    { ...size, ...(fonts.length ? { fonts } : {}) },
  )
}
