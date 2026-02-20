import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/security/rate-limit'

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
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Rate limit by email (5 attempts per 10 min)
        const emailLimit = rateLimit(`login:email:${credentials.email.toLowerCase()}`, 5, 10 * 60 * 1000)
        if (!emailLimit.success) {
          throw new Error('Prea multe încercări. Încearcă din nou mai târziu.')
        }

        const supabase = createAdminClient()

        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        })

        if (error || !data.user) {
          return null
        }

        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single()

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
      // Handle Google sign-in: create user profile if it doesn't exist
      if (account?.provider === 'google' && user.email) {
        const supabase = createAdminClient()
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle()

        if (!existing) {
          // Create Supabase auth user + profile for Google users
          const { data: authData } = await supabase.auth.admin.createUser({
            email: user.email,
            email_confirm: true,
            user_metadata: { name: user.name, avatar_url: user.image },
          })

          if (authData?.user) {
            await supabase.from('users').insert({
              id: authData.user.id,
              email: user.email,
              name: user.name || 'Utilizator',
              avatar_url: user.image || null,
              role: 'user',
              credits: 20,
              plan: 'free',
              onboarding_completed: false,
            })
            // Set the user id to match Supabase
            user.id = authData.user.id
          }
        } else {
          user.id = existing.id
        }
      }
      return true
    },

    async jwt({ token, user, account }) {
      if (user) {
        // For Google sign-in, fetch profile from DB
        if (account?.provider === 'google') {
          const supabase = createAdminClient()
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('email', user.email!)
            .single()

          if (profile) {
            token.id = profile.id
            token.role = profile.role || 'user'
            token.plan = profile.plan || 'free'
            token.credits = profile.credits || 20
            token.onboardingCompleted = profile.onboarding_completed || false
          }
        } else {
          // Credentials sign-in
          token.id = user.id
          token.role = (user as any).role
          token.plan = (user as any).plan
          token.credits = (user as any).credits
          token.onboardingCompleted = (user as any).onboarding_completed || false
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
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
    maxAge: 24 * 60 * 60, // 24 hours
  },

  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
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