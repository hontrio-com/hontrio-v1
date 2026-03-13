import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// Județele României cu centroides aproximative
const ROMANIA_COUNTIES: Record<string, { lat: number; lng: number; name: string }> = {
  'AB': { lat: 46.07, lng: 23.58, name: 'Alba' },
  'AR': { lat: 46.18, lng: 21.32, name: 'Arad' },
  'AG': { lat: 44.85, lng: 24.87, name: 'Argeș' },
  'BC': { lat: 46.57, lng: 26.91, name: 'Bacău' },
  'BH': { lat: 47.05, lng: 22.00, name: 'Bihor' },
  'BN': { lat: 47.13, lng: 24.50, name: 'Bistrița-Năsăud' },
  'BT': { lat: 47.75, lng: 26.67, name: 'Botoșani' },
  'BV': { lat: 45.65, lng: 25.62, name: 'Brașov' },
  'BR': { lat: 45.27, lng: 27.96, name: 'Brăila' },
  'B':  { lat: 44.43, lng: 26.10, name: 'București' },
  'BZ': { lat: 45.15, lng: 26.82, name: 'Buzău' },
  'CS': { lat: 45.30, lng: 22.07, name: 'Caraș-Severin' },
  'CL': { lat: 44.20, lng: 27.33, name: 'Călărași' },
  'CJ': { lat: 46.77, lng: 23.60, name: 'Cluj' },
  'CT': { lat: 44.18, lng: 28.65, name: 'Constanța' },
  'CV': { lat: 45.87, lng: 25.80, name: 'Covasna' },
  'DB': { lat: 44.93, lng: 25.45, name: 'Dâmbovița' },
  'DJ': { lat: 44.30, lng: 23.79, name: 'Dolj' },
  'GL': { lat: 45.44, lng: 28.04, name: 'Galați' },
  'GR': { lat: 43.90, lng: 25.97, name: 'Giurgiu' },
  'GJ': { lat: 45.04, lng: 23.27, name: 'Gorj' },
  'HR': { lat: 46.35, lng: 25.80, name: 'Harghita' },
  'HD': { lat: 45.88, lng: 22.91, name: 'Hunedoara' },
  'IL': { lat: 44.56, lng: 27.60, name: 'Ialomița' },
  'IS': { lat: 47.16, lng: 27.59, name: 'Iași' },
  'IF': { lat: 44.57, lng: 26.09, name: 'Ilfov' },
  'MM': { lat: 47.66, lng: 23.58, name: 'Maramureș' },
  'MH': { lat: 44.64, lng: 22.66, name: 'Mehedinți' },
  'MS': { lat: 46.55, lng: 24.56, name: 'Mureș' },
  'NT': { lat: 46.97, lng: 26.38, name: 'Neamț' },
  'OT': { lat: 44.12, lng: 24.37, name: 'Olt' },
  'PH': { lat: 45.00, lng: 25.85, name: 'Prahova' },
  'SM': { lat: 47.79, lng: 22.89, name: 'Satu Mare' },
  'SJ': { lat: 47.19, lng: 23.06, name: 'Sălaj' },
  'SB': { lat: 45.79, lng: 24.15, name: 'Sibiu' },
  'SV': { lat: 47.63, lng: 26.25, name: 'Suceava' },
  'TR': { lat: 43.90, lng: 25.00, name: 'Teleorman' },
  'TM': { lat: 45.74, lng: 21.23, name: 'Timiș' },
  'TL': { lat: 44.93, lng: 29.00, name: 'Tulcea' },
  'VS': { lat: 46.64, lng: 27.73, name: 'Vaslui' },
  'VL': { lat: 45.10, lng: 24.37, name: 'Vâlcea' },
  'VN': { lat: 45.70, lng: 27.18, name: 'Vrancea' },
}

// Cuvinte-cheie pentru fiecare județ în adrese
const CITY_TO_COUNTY: Record<string, string> = {
  'alba iulia': 'AB', 'arad': 'AR', 'pitești': 'AG', 'pitesti': 'AG',
  'bacău': 'BC', 'bacau': 'BC', 'oradea': 'BH', 'bistrița': 'BN', 'bistrita': 'BN',
  'botoșani': 'BT', 'botosani': 'BT', 'brașov': 'BV', 'brasov': 'BV',
  'brăila': 'BR', 'braila': 'BR', 'bucurești': 'B', 'bucuresti': 'B', 'bucharest': 'B',
  'buzău': 'BZ', 'buzau': 'BZ', 'reșița': 'CS', 'resita': 'CS',
  'călărași': 'CL', 'calarasi': 'CL', 'cluj-napoca': 'CJ', 'cluj napoca': 'CJ', 'cluj': 'CJ',
  'constanța': 'CT', 'constanta': 'CT', 'sfântu gheorghe': 'CV', 'sfantu gheorghe': 'CV',
  'târgoviște': 'DB', 'targoviste': 'DB', 'craiova': 'DJ',
  'galați': 'GL', 'galati': 'GL', 'giurgiu': 'GR',
  'târgu jiu': 'GJ', 'targu jiu': 'GJ', 'miercurea ciuc': 'HR',
  'deva': 'HD', 'slobozia': 'IL', 'iași': 'IS', 'iasi': 'IS',
  'ilfov': 'IF', 'baia mare': 'MM', 'drobeta-turnu severin': 'MH', 'drobeta': 'MH',
  'târgu mureș': 'MS', 'targu mures': 'MS', 'piatra neamț': 'NT', 'piatra neamt': 'NT',
  'slatina': 'OT', 'ploiești': 'PH', 'ploiesti': 'PH',
  'satu mare': 'SM', 'zalău': 'SJ', 'zalau': 'SJ',
  'sibiu': 'SB', 'suceava': 'SV', 'alexandria': 'TR',
  'timișoara': 'TM', 'timisoara': 'TM', 'tulcea': 'TL',
  'vaslui': 'VS', 'râmnicu vâlcea': 'VL', 'ramnicu valcea': 'VL', 'rm valcea': 'VL',
  'focșani': 'VN', 'focsani': 'VN',
}

function extractCounty(address: string | null): string | null {
  if (!address) return null
  const lower = address.toLowerCase()
    .replace(/[ăâ]/g, 'a').replace(/î/g, 'i').replace(/[șş]/g, 's').replace(/[țţ]/g, 't')
  for (const [city, county] of Object.entries(CITY_TO_COUNTY)) {
    if (lower.includes(city)) return county
  }
  return null
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const store_id = searchParams.get('store_id')
    const period = parseInt(searchParams.get('period') || '90')

    const supabase = createAdminClient()
    const fromDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString()

    let q = supabase.from('risk_orders')
      .select('order_status, total_value, shipping_address')
      .eq('user_id', (session.user as any).id)
      .gte('ordered_at', fromDate)
      .in('order_status', ['collected', 'refused', 'returned', 'not_home', 'cancelled'])
    if (store_id) q = q.eq('store_id', store_id)

    const { data: orders } = await q

    // Agregare pe județe
    const countyMap: Record<string, {
      total: number; refused: number; collected: number
      totalValue: number; refusedValue: number
    }> = {}

    for (const o of (orders || [])) {
      const county = extractCounty(o.shipping_address)
      if (!county) continue
      if (!countyMap[county]) countyMap[county] = { total: 0, refused: 0, collected: 0, totalValue: 0, refusedValue: 0 }
      countyMap[county].total++
      countyMap[county].totalValue += o.total_value || 0
      if (['refused', 'returned', 'not_home'].includes(o.order_status)) {
        countyMap[county].refused++
        countyMap[county].refusedValue += o.total_value || 0
      }
      if (o.order_status === 'collected') countyMap[county].collected++
    }

    // Construiește rezultat cu coordonate
    const heatmapData = Object.entries(countyMap).map(([code, data]) => {
      const countyInfo = ROMANIA_COUNTIES[code]
      const refusalRate = data.total > 0 ? Math.round((data.refused / data.total) * 100) : 0
      return {
        county: code,
        name: countyInfo?.name || code,
        lat: countyInfo?.lat || 45.9,
        lng: countyInfo?.lng || 24.9,
        total: data.total,
        refused: data.refused,
        collected: data.collected,
        refusalRate,
        totalValue: Math.round(data.totalValue),
        refusedValue: Math.round(data.refusedValue),
        riskLevel: refusalRate >= 30 ? 'high' : refusalRate >= 15 ? 'medium' : 'low',
      }
    }).sort((a, b) => b.refusalRate - a.refusalRate)

    // Media națională
    const totalAll = heatmapData.reduce((s, c) => s + c.total, 0)
    const refusedAll = heatmapData.reduce((s, c) => s + c.refused, 0)
    const nationalRefusalRate = totalAll > 0 ? Math.round((refusedAll / totalAll) * 100) : 0

    return NextResponse.json({ heatmap: heatmapData, nationalRefusalRate, totalOrders: totalAll, period })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}