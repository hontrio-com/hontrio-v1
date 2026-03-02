import { NextResponse } from 'next/server'

// Versiunea curentă a pluginului — actualizează când dai update
const CURRENT_VERSION = '1.0.3'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientVersion = searchParams.get('v') || '1.0.0'
  const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://hontrio.com'

  // Dacă versiunea clientului e mai veche, oferă update
  const hasUpdate = isNewer(CURRENT_VERSION, clientVersion)

  return NextResponse.json({
    current_version: clientVersion,
    new_version: CURRENT_VERSION,
    has_update: hasUpdate,
    download_url: hasUpdate ? `${apiBase}/api/agent/download-plugin` : null,
    changelog: 'Îmbunătățiri algoritm de căutare, design widget actualizat, suport offset buton.',
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600', // cache 1h
    }
  })
}

function isNewer(latest: string, current: string): boolean {
  const [ma, mi, pa] = latest.split('.').map(Number)
  const [mb, mib, pb] = current.split('.').map(Number)
  if (ma !== mb) return ma > mb
  if (mi !== mib) return mi > mib
  return pa > pb
}