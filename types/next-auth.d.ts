import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'user' | 'admin'
    } & DefaultSession['user']
    /** Administratorul intrat în contul acestui client și până când poate rămâne (ms). */
    impersonator?: { name: string; email: string; until: number }
  }

  interface User {
    role: 'user' | 'admin'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'user' | 'admin'
    /** Versiunea Termenilor acceptată de cont (lib/auth/validation.ts, TERMS_VERSION). */
    termsVersion?: string | null
    /** Administratorul din spatele sesiunii, când e în contul unui client. */
    impersonator?: { id: string; name: string; email: string; provider: string }
    /** Rândul din jurnalul conectărilor și până când ține (ms). */
    impersonation?: { id: string; until: number }
    /** Când s-a scris ultima oară users.last_seen_at (ms). */
    seenAt?: number
  }
}
