'use client'

import { useState, useEffect, useCallback } from 'react'

type CreditsData = {
  credits: number
  plan: string
  loading: boolean
  refresh: () => Promise<void>
}

export function useCredits(): CreditsData {
  const [credits, setCredits] = useState(0)
  const [plan, setPlan] = useState('free')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/user/me')
      const data = await res.json()
      if (data.credits !== undefined) setCredits(data.credits)
      if (data.plan) setPlan(data.plan)
    } catch {
      console.error('Error fetching credits')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    // Auto-refresh every 30 seconds
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  // Listen for custom event to refresh immediately
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('credits-updated', handler)
    return () => window.removeEventListener('credits-updated', handler)
  }, [refresh])

  return { credits, plan, loading, refresh }
}

// Call this from anywhere to trigger a refresh
export function triggerCreditsRefresh() {
  window.dispatchEvent(new Event('credits-updated'))
}