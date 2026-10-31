'use client'

import { useCallback, useEffect, useState } from 'react'

// =============================================
// Datele unei pagini de administrare: se citesc o dată la deschidere și din
// nou la „Reîmprospătează". Cât se reîncarcă, rămân pe ecran cele de dinainte.
// Un răspuns cu eroare lasă `data` gol, iar pagina arată că nu s-au putut citi.
// =============================================

export function useAdminData<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    fetch(url)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setData(d) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [url, tick])

  const refresh = useCallback(() => { setLoading(true); setTick(n => n + 1) }, [])

  return { data, loading, refresh }
}
