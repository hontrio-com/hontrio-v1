// =============================================
// Cursurile de referință BCE (câte unități dintr-o monedă face 1 euro), pentru
// vânzările în alte monede decât moneda situației (Termeni, art. 9.2 e).
// Cursul este cel din ultima zi a lunii; la sfârșit de săptămână sau de
// sărbătoare, cel din ultima zi lucrătoare de dinainte.
// =============================================

const ECB_URL = 'https://data-api.ecb.europa.eu/service/data/EXR'

/** CSV-ul BCE → cel mai recent curs pe monedă (coloanele CURRENCY, TIME_PERIOD, OBS_VALUE). */
export function parseEcbCsv(csv: string): Record<string, { day: string; rate: number }> {
  const lines = csv.trim().split(/\r?\n/)
  const head = (lines.shift() ?? '').split(',')
  const iCur = head.indexOf('CURRENCY')
  const iDay = head.indexOf('TIME_PERIOD')
  const iVal = head.indexOf('OBS_VALUE')
  const out: Record<string, { day: string; rate: number }> = {}
  if (iCur < 0 || iDay < 0 || iVal < 0) return out
  const upTo = Math.max(iCur, iDay, iVal) + 1
  for (const line of lines) {
    // Câmpurile cerute sunt înaintea celor cu ghilimele (descrierile), deci se pot tăia la virgulă
    const cells = line.split(',', upTo)
    const cur = cells[iCur]?.trim().toUpperCase()
    const day = cells[iDay]?.trim()
    const rate = Number(cells[iVal])
    if (!cur || !day || !Number.isFinite(rate) || rate <= 0) continue
    if (!out[cur] || out[cur].day < day) out[cur] = { day, rate }
  }
  return out
}

/** Cursurile BCE în ultima zi lucrătoare până la `day` inclusiv („AAAA-LL-ZZ”). Lipsește o monedă = curs negăsit. */
export async function eurRatesOn(currencies: string[], day: string): Promise<Record<string, number>> {
  const list = [...new Set(currencies.map(c => c.toUpperCase()).filter(c => /^[A-Z]{3}$/.test(c) && c !== 'EUR'))]
  if (!list.length) return {}
  const end = new Date(`${day}T00:00:00Z`)
  const start = new Date(end.getTime() - 10 * 86_400_000).toISOString().slice(0, 10)
  const url = `${ECB_URL}/D.${list.join('+')}.EUR.SP00.A?startPeriod=${start}&endPeriod=${day}&format=csvdata`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: 'no-store' })
  if (!res.ok) throw new Error(`BCE ${res.status}`)
  const parsed = parseEcbCsv(await res.text())
  return Object.fromEntries(Object.entries(parsed).map(([c, v]) => [c, v.rate]))
}
