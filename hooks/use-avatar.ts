'use client'

import { useEffect, useState } from 'react'

// =============================================
// Poza de profil din meniu. Se citește o dată, iar Setări anunță cu
// evenimentul `avatar-updated` când o schimbi, ca meniul s-o arate imediat.
// =============================================

export const AVATAR_UPDATED = 'avatar-updated'

export function useAvatar(): string | null {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    const load = () => {
      fetch('/api/user/me')
        .then(r => r.json())
        .then(d => setAvatarUrl(d.avatar_url ?? null))
        .catch(() => {})
    }
    load()
    window.addEventListener(AVATAR_UPDATED, load)
    return () => window.removeEventListener(AVATAR_UPDATED, load)
  }, [])

  return avatarUrl
}
