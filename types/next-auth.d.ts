import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'user' | 'admin'
      plan: 'free' | 'starter' | 'professional' | 'enterprise'
      credits: number
    } & DefaultSession['user']
  }

  interface User {
    role: 'user' | 'admin'
    plan: 'free' | 'starter' | 'professional' | 'enterprise'
    credits: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'user' | 'admin'
    plan: 'free' | 'starter' | 'professional' | 'enterprise'
    credits: number
  }
}