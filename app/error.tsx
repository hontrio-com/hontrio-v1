'use client'

import { useEffect } from 'react'
import { ErrorScreen } from '@/components/app/error-screen'

// O eroare neașteptată într-o pagină: ecranul Hontrio, cu „Încearcă din nou",
// care reface pagina fără reîncărcare. Detaliul rămâne în consola browserului.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return <ErrorScreen kind="error" digest={error.digest} onRetry={reset} />
}
