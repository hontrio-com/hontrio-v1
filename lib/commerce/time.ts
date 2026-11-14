// =============================================
// Ora locală a platformelor ↔ UTC
//
// Gomag și MerchantPro dau datele ca „2026-11-14 15:04:05", fără fus orar: ora
// magazinului (platformele rulează în România). Aici se transformă în UTC,
// ținând cont de ora de vară, și înapoi. Funcții pure.
// =============================================

/** Fusul orar al platformelor românești (Gomag, MerchantPro). */
export const ROMANIA_TZ = 'Europe/Bucharest'

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/
const HAS_ZONE_RE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    formatters.set(timeZone, f)
  }
  return f
}

/** Un fus orar necunoscut (scris greșit în bază) nu oprește sincronizarea: se ia UTC. */
function safeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return 'UTC'
  try {
    formatter(timeZone)
    return timeZone
  } catch {
    return 'UTC'
  }
}

/** Ora din ceasul fusului, la momentul dat, ca milisecunde „UTC" ale acelui ceas. */
function wallClockMs(utcMs: number, timeZone: string): number {
  const parts = formatter(timeZone).formatToParts(new Date(utcMs))
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value)
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
}

/** Cu câte minute e fusul înaintea UTC la momentul dat (+120 iarna în România, +180 vara). */
export function zoneOffsetMinutes(utcMs: number, timeZone: string): number {
  const zone = safeZone(timeZone)
  return Math.round((wallClockMs(utcMs, zone) - Math.floor(utcMs / 1000) * 1000) / 60_000)
}

/**
 * „2026-11-14 15:04:05" (ora locală din fusul dat) → ISO în UTC. O dată care are
 * deja fusul (Z sau +02:00) se ia ca atare. Null pentru o dată lipsă sau
 * invalidă („0000-00-00 00:00:00", 31 februarie).
 */
export function localToUtcIso(value: string | null | undefined, timeZone: string): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v) return null
  if (HAS_ZONE_RE.test(v)) {
    const d = new Date(v.replace(' ', 'T'))
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const m = LOCAL_RE.exec(v)
  if (!m) return null
  const [y, mo, d, h = '0', mi = '0', s = '0'] = m.slice(1)
  const parts = [Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(s)]
  const wall = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5])
  // Date.UTC îndreaptă depășirile (31.02 → 03.03): o dată care nu există e invalidă
  const back = new Date(wall)
  if (parts[0] < 1971 || back.getUTCFullYear() !== parts[0] || back.getUTCMonth() !== parts[1] - 1 || back.getUTCDate() !== parts[2]
    || back.getUTCHours() !== parts[3] || back.getUTCMinutes() !== parts[4] || back.getUTCSeconds() !== parts[5]) return null

  const zone = safeZone(timeZone)
  // Diferența fusului se citește la momentul aproximat, apoi la cel corectat (schimbarea orei)
  const first = wall - zoneOffsetMinutes(wall, zone) * 60_000
  const utc = wall - zoneOffsetMinutes(first, zone) * 60_000
  return new Date(utc).toISOString()
}

/** ISO (orice fus) → „YYYY-MM-DD HH:MM:SS" în fusul dat. */
export function utcToLocal(iso: string, timeZone: string): string {
  const ms = Date.parse(iso)
  const wall = new Date(wallClockMs(Number.isNaN(ms) ? Date.now() : ms, safeZone(timeZone)))
  return wall.toISOString().slice(0, 19).replace('T', ' ')
}

/** ISO → „YYYY-MM-DD HH:MM:SS" în UTC: pentru filtrele de dată ale API-urilor care nu spun fusul. */
export function utcWall(iso: string): string {
  const ms = Date.parse(iso)
  return new Date(Number.isNaN(ms) ? Date.now() : ms).toISOString().slice(0, 19).replace('T', ' ')
}
