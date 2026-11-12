// =============================================
// Toate rândurile unei citiri din Supabase, pagină cu pagină. API-ul întoarce
// cel mult 1.000 de rânduri pe cerere (max-rows), fără să spună că a tăiat:
// metricile pe produs, termenii de căutare sau vânzările pe ofertă trec ușor
// de atât. Pagina cere o ordine stabilă (.order), altfel rândurile se pot
// repeta sau sări între pagini.
// =============================================

export const PAGE_SIZE = 1000

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** `fetchPage(from, to)` = aceeași cerere, ordonată, cu `.range(from, to)`. O eroare se aruncă. */
export async function readAll<T>(fetchPage: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return out
  }
}

/** Ca `readAll`, dar o eroare întoarce ce s-a citit până la ea, plus mesajul (pentru citirile opționale). */
export async function readAllSoft<T>(fetchPage: (from: number, to: number) => Page<T>): Promise<{ data: T[]; error: string | null }> {
  try {
    return { data: await readAll(fetchPage), error: null }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) }
  }
}
