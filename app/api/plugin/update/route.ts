import { NextResponse } from 'next/server'

export const PLUGIN_VERSION = '2.0.0'
export const PLUGIN_SLUG    = 'hontrio'

function isNewer(latest: string, current: string): boolean {
  const p = (v: string) => v.split('.').map(Number)
  const [ma,mi,pa] = p(latest), [mb,mb2,pb] = p(current)
  if (ma !== mb) return ma > mb
  if (mi !== mb2) return mi > mb2
  return pa > pb
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const clientVersion = searchParams.get('v') || '1.0.0'
  const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://hontrio.com'
  const hasUpdate = isNewer(PLUGIN_VERSION, clientVersion)

  return NextResponse.json({
    slug: PLUGIN_SLUG, plugin: 'hontrio/hontrio.php',
    current_version: clientVersion,
    new_version: PLUGIN_VERSION,
    has_update: hasUpdate,
    download_url: hasUpdate ? `${apiBase}/api/plugin/download` : null,
    tested: '6.6', requires: '5.8', requires_php: '7.4',
    changelog: 'Plugin unificat Hontrio — AI Agent + Risk Shield într-un singur modul cu auto-update.',
    sections: {
      description: 'Conectează WooCommerce la platforma Hontrio: AI Agent conversațional + Risk Shield anti-fraudă, totul dintr-un singur plugin.',
      changelog: `<h4>v${PLUGIN_VERSION}</h4><ul><li>Plugin unificat Hontrio</li><li>AI Agent + Risk Shield</li><li>Auto-update direct din WordPress</li></ul>`,
    },
  }, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' }
  })
}