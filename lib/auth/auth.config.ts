import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/security/rate-limit'

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is not set');
}

// ─── Helper: ensures the user profile exists in the users table ───────────────
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

  console.error('[auth/ensureUserProfile]', `Missing profile for ${params.email} (${params.id}) — creating automatically`)

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
    console.error('[auth/ensureUserProfile]', `Error creating profile: ${error.message}`, { id: params.id, email: params.email })
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
          throw new Error('Too many attempts. Try again later.')
        }

        const supabase = createAdminClient()

        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        })

        if (error || !data.user) return null

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

        // Look up the user directly in the users table (avoids full listUsers scan on auth.users)
        const { data: existingProfile } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle()
        
        if (existingProfile) {
          // User already exists in our table
          user.id = existingProfile.id
        } else {
          // Check if exists in auth.users via signInWithOtp dry-run or getUserByEmail
          // Supabase admin API: getUserById is not useful here, but we can create directly
          // If the profile is not in the users table, create the user
          const { data: authData } = await supabase.auth.admin.createUser({
            email: user.email,
            email_confirm: true,
            user_metadata: { name: user.name, avatar_url: user.image },
          })
          if (authData?.user) user.id = authData.user.id
        }

        // Ensure the profile exists
        if (user.id) {
          try {
            await ensureUserProfile({
              id: user.id,
              email: user.email,
              name: user.name,
              avatar_url: user.image,
            })
          } catch (err) {
            console.error('[Auth] ensureUserProfile failed:', err)
            return false
          }
        }
      }
      return true
    },

    async jwt({ token, user, account, trigger }) {
      if (user) {
        if (account?.provider === 'google') {
          const supabase = createAdminClient()
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()

          if (profile) {
            token.id = profile.id
            token.name = profile.name || user.name || 'User'
            token.role = profile.role || 'user'
            token.plan = profile.plan || 'free'
            token.credits = profile.credits || 20
            token.onboardingCompleted = profile.onboarding_completed || false
          }
        } else {
          token.id = user.id
          token.name = (user as any).name || 'User'
          token.role = (user as any).role
          token.plan = (user as any).plan
          token.credits = (user as any).credits
          token.onboardingCompleted = (user as any).onboarding_completed || false
        }
        // Record the timestamp of the last DB sync
        token.refreshedAt = Date.now()
      }

      // FIX: Refresh from DB only if token is older than 60 seconds
      // Previously: query on EVERY HTTP request — now only once per minute
      if (token.id && !user) {
        const refreshedAt = (token.refreshedAt as number) || 0
        const elapsed = Date.now() - refreshedAt
        
        if (trigger === 'update' || elapsed > 60 * 1000) { // 60-second TTL or explicit refresh
          try {
            const supabase = createAdminClient()
            const { data: profile } = await supabase
              .from('users')
              .select('name, role, plan, credits, onboarding_completed')
              .eq('id', token.id as string)
              .maybeSingle()

            if (profile) {
              token.name = profile.name || token.name || 'User'
              token.role = profile.role || 'user'
              token.plan = profile.plan || 'free'
              token.credits = profile.credits ?? token.credits
              token.onboardingCompleted = profile.onboarding_completed ?? token.onboardingCompleted
            }
            token.refreshedAt = Date.now()
          } catch {
            // DB down — keep the existing token as-is
          }
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.name = (token.name as string) || 'User'
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
    // Short-lived token; refreshed via session rotation every 60s against the DB
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
