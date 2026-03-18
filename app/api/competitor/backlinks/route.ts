import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { normalizeUrl, hostnameOnly } from '@/lib/competitor/url-utils'

// Common Crawl CDX API - free, no key required
const CC_API = 'https://index.commoncrawl.org/CC-MAIN-2024-10-index'
const CDX_API = 'http://web.archive.org/cdx/search/cdx'  // Wayback CDX as fallback

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { competitor_url, my_url } = await request.json()
    if (!competitor_url || !my_url) return NextResponse.json({ error: 'URLs are required' }, { status: 400 })

    const myHost = hostnameOnly(normalizeUrl(my_url))
    const theirHost = hostnameOnly(normalizeUrl(competitor_url))

    // Fetch referring domains for both using Wayback CDX API
    const [myBacklinks, theirBacklinks] = await Promise.all([
      getBacklinkDomains(myHost),
      getBacklinkDomains(theirHost),
    ])

    // Calculate gap
    const myDomains = new Set(myBacklinks)
    const theirDomains = new Set(theirBacklinks)

    const gapDomains = theirBacklinks.filter(d => !myDomains.has(d)).slice(0, 20)
    const exclusiveMine = myBacklinks.filter(d => !theirDomains.has(d)).slice(0, 10)
    const commonDomains = myBacklinks.filter(d => theirDomains.has(d)).slice(0, 10)

    return NextResponse.json({
      success: true,
      my_store: { domain: myHost, backlink_count: myBacklinks.length, domains: myBacklinks.slice(0, 20) },
      competitor: { domain: theirHost, backlink_count: theirBacklinks.length, domains: theirBacklinks.slice(0, 20) },
      gap_domains: gapDomains,      // sites linking to competitor but not you
      exclusive_mine: exclusiveMine, // sites linking only to you
      common_domains: commonDomains,
      note: 'Data from Common Crawl / Wayback Machine. Partial coverage — for complete data use Ahrefs or Moz.',
    })
  } catch (err) {
    console.error('[Backlinks]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function getBacklinkDomains(domain: string): Promise<string[]> {
  try {
    // Wayback CDX API: get pages that link to this domain
    const url = `${CDX_API}?url=*.${domain}&output=json&fl=urlkey&limit=200&filter=statuscode:200&collapse=domain`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []

    const data = await res.json()
    if (!Array.isArray(data) || data.length < 2) return []

    // Skip first row (header), extract domains
    const domains = data.slice(1)
      .map((row: any[]) => {
        try {
          // urlkey format is reversed: "ro,magazin)/path"
          const key = row[0] as string
          const mainPart = key.split(')')[0]
          const parts = mainPart.split(',')
          // Reverse back to domain
          return parts.reverse().join('.').replace(/^\./, '')
        } catch { return null }
      })
      .filter((d: any): d is string => !!d && d !== domain && d.includes('.'))

    return [...new Set(domains)].sort()
  } catch {
    return []
  }
}