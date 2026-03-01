import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/security/rate-limit'

// ─── Helper: garantează că profilul există în tabela users ───────────────────
async function ensureUserProfile(params: {
  id: string
  email: string
  name?: string | null
  avatar_url?: string | null
}) {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('users')
    .select('id, name, role, plan, credits, onboarding_completed')
    .eq('id', params.id)
    .maybeSingle()

  if (existing) return existing

  // Profilul lipsește — îl creăm automat
  console.error('[auth/ensureUserProfile]', `Profil lipsă pentru ${params.email} (${params.id}) — se creează automat`)

  const { data: newProfile, error } = await supabase
    .from('users')
    .insert({
      id: params.id,
      email: params.email,
      name: params.name || params.email.split('@')[0],
      avatar_url: params.avatar_url || null,
      role: 'user',
      credits: 20,
      plan: 'free',
      onboarding_completed: false,
    })
    .select()
    .single()

  if (error) {
    console.error('[auth/ensureUserProfile]', `Eroare la crearea profilului: ${error.message}`, { id: params.id, email: params.email })
    return null
  }

  return newProfile
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const emailLimit = rateLimit(`login:email:${credentials.email.toLowerCase()}`, 5, 10 * 60 * 1000)
        if (!emailLimit.success) {
          throw new Error('Prea multe incercari. Incearca din nou mai tarziu.')
        }

        const supabase = createAdminClient()

        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        })

        if (error || !data.user) return null

        // Garantăm că profilul există — auto-repair dacă lipsește
        const profile = await ensureUserProfile({
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name || null,
        })

        return {
          id: data.user.id,
          email: data.user.email!,
          name: profile?.name || null,
          role: profile?.role || 'user',
          plan: profile?.plan || 'free',
          credits: profile?.credits || 20,
          onboarding_completed: profile?.onboarding_completed || false,
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        const supabase = createAdminClient()

        // Caută userul în auth.users după email
        const { data: authUsers } = await supabase.auth.admin.listUsers()
        const authUser = authUsers?.users?.find(u => u.email === user.email)

        if (authUser) {
          user.id = authUser.id
        } else {
          // Creează în auth.users
          const { data: authData } = await supabase.auth.admin.createUser({
            email: user.email,
            email_confirm: true,
            user_metadata: { name: user.name, avatar_url: user.image },
          })
          if (authData?.user) user.id = authData.user.id
        }

        // Garantăm că profilul există
        if (user.id) {
          await ensureUserProfile({
            id: user.id,
            email: user.email,
            name: user.name,
            avatar_url: user.image,
          })
        }
      }
      return true
    },

    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'google') {
          const supabase = createAdminClient()
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

          if (profile) {
            token.id = profile.id
            token.name = profile.name || user.name || 'Utilizator'
            token.role = profile.role || 'user'
            token.plan = profile.plan || 'free'
            token.credits = profile.credits || 20
            token.onboardingCompleted = profile.onboarding_completed || false
          }
        } else {
          token.id = user.id
          token.name = (user as any).name || 'Utilizator'
          token.role = (user as any).role
          token.plan = (user as any).plan
          token.credits = (user as any).credits
          token.onboardingCompleted = (user as any).onboarding_completed || false
        }
      }

      // Refresh din DB la fiecare cerere
      if (token.id && !user) {
        try {
          const supabase = createAdminClient()
          const { data: profile } = await supabase
            .from('users')
            .select('name, role, plan, credits, onboarding_completed')
            .eq('id', token.id as string)
            .single()

          if (profile) {
            token.name = profile.name || token.name || 'Utilizator'
            token.role = profile.role || 'user'
            token.plan = profile.plan || 'free'
            token.credits = profile.credits ?? token.credits
            token.onboardingCompleted = profile.onboarding_completed ?? token.onboardingCompleted
          }
        } catch {
          // DB down — pastram token-ul existent
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.name = (token.name as string) || 'Utilizator'
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).plan = token.plan
        ;(session.user as any).credits = token.credits
        ;(session.user as any).onboardingCompleted = token.onboardingCompleted
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },

  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
}