import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeUrl } from '@/lib/competitor/url-utils'

// Uses Google PageSpeed Insights API (free, no key needed for basic use)
const PSI_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id

    const { competitor_url, my_url } = await request.json()
    if (!competitor_url || !my_url) return NextResponse.json({ error: 'URL-urile lipsesc' }, { status: 400 })

    const myUrl = normalizeUrl(my_url)
    const theirUrl = normalizeUrl(competitor_url)

    // Run PageSpeed for both — mobile + desktop
    const [myMobile, myDesktop, theirMobile, theirDesktop] = await Promise.all([
      runPageSpeed(myUrl, 'mobile'),
      runPageSpeed(myUrl, 'desktop'),
      runPageSpeed(theirUrl, 'mobile'),
      runPageSpeed(theirUrl, 'desktop'),
    ])

    // Fetch both pages for schema & technical checks
    const [myHtml, theirHtml] = await Promise.all([
      fetchHtml(myUrl),
      fetchHtml(theirUrl),
    ])

    const myTech = extractTechnicalSEO(myHtml || '', myUrl)
    const theirTech = extractTechnicalSEO(theirHtml || '', theirUrl)

    return NextResponse.json({
      success: true,
      my_store: {
        url: myUrl,
        pagespeed: { mobile: myMobile, desktop: myDesktop },
        technical: myTech,
      },
      competitor: {
        url: theirUrl,
        pagespeed: { mobile: theirMobile, desktop: theirDesktop },
        technical: theirTech,
      },
    })
  } catch (err) {
    console.error('[Technical]', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

async function runPageSpeed(url: string, strategy: 'mobile' | 'desktop') {
  try {
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || ''
    const params = new URLSearchParams({ url, strategy, category: 'performance' })
    if (apiKey) params.set('key', apiKey)

    const res = await fetch(`${PSI_URL}?${params}`, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const data = await res.json()

    const cats = data.lighthouseResult?.categories
    const audits = data.lighthouseResult?.audits

    return {
      performance_score: Math.round((cats?.performance?.score || 0) * 100),
      fcp: audits?.['first-contentful-paint']?.displayValue || null,
      lcp: audits?.['largest-contentful-paint']?.displayValue || null,
      cls: audits?.['cumulative-layout-shift']?.displayValue || null,
      tbt: audits?.['total-blocking-time']?.displayValue || null,
      speed_index: audits?.['speed-index']?.displayValue || null,
    }
  } catch { return null }
}

function extractTechnicalSEO(html: string, url: string) {
  // Schema.org types
  const schemaMatches = [...html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map(m => m[1])
  const schemaTypes = [...new Set(schemaMatches)]

  // Canonical
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)

  // Open Graph
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1]

  // Robots
  const robotsMeta = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i)?.[1]

  // Lang attribute
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i)?.[1]

  // Viewport
  const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html)

  // Count images without alt
  const imgTotal = (html.match(/<img\s/gi) || []).length
  const imgWithAlt = (html.match(/<img[^>]+alt=["'][^"']{1,}/gi) || []).length
  const imgWithoutAlt = imgTotal - imgWithAlt

  // Internal links count
  let domain = ''
  try { domain = new URL(url).hostname } catch {}
  const internalLinks = (html.match(new RegExp(`href=["'][^"']*${domain}[^"']*["']`, 'gi')) || []).length

  // Check for hreflang (international SEO)
  const hasHreflang = /rel=["']alternate["'][^>]*hreflang/i.test(html)

  // Check for AMP
  const hasAmp = /<html[^>]*amp/i.test(html) || /rel=["']amphtml["']/i.test(html)

  return {
    schema_types: schemaTypes,
    has_canonical: !!canonicalMatch,
    canonical_url: canonicalMatch?.[1] || null,
    has_og_tags: !!ogTitle,
    og_title: ogTitle || null,
    has_og_image: !!ogImage,
    robots_meta: robotsMeta || null,
    lang: langMatch || null,
    has_viewport: hasViewport,
    images_total: imgTotal,
    images_without_alt: imgWithoutAlt,
    internal_links: internalLinks,
    has_hreflang: hasHreflang,
    has_amp: hasAmp,
  }
}

function fetchHtml(url: string): Promise<string | null> {
  return fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    signal: AbortSignal.timeout(8000),
  }).then(r => r.ok ? r.text() : null).catch(() => null)
}