import { randomBytes } from 'node:crypto'
import type { NextAuthOptions, Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIp, rateLimitAll } from '@/lib/security/rate-limit'
import { logError, logWarn } from '@/lib/logger'
import { bumpSessionVersion } from './account'
import { verifyPassword } from './password'
import { checkName } from './validation'
import { defaultName, profileToken, PROFILE_COLUMNS, type Profile } from './session-token'

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is not set');
}

// =============================================
// Autentificarea (NextAuth, sesiune JWT de 24 de ore).
//
// - Cu parolă: doar conturile cu adresa confirmată (users.email_verified_at).
//   Limitele de încercări sunt în Redis, pe IP și pe adresă.
// - Cu Google: doar o adresă confirmată de Google. Un cont cu parolă
//   neconfirmat, preluat așa, își pierde parola (a putut-o alege oricine) și
//   sesiunile vechi.
// - Sesiunea poartă users.session_version: o versiune diferită (parolă
//   resetată sau schimbată, rol schimbat) sau un cont dispărut înseamnă ieșire
//   din cont, la cel mult un minut după schimbare.
// - Sesiunea poartă și `termsAccepted`: un cont fără acord înregistrat (făcut
//   cu Google sau de dinainte de acord) este trimis de proxy la /accept-terms.
// - Administratorul poate intra în contul unui client (lib/auth/impersonation.ts):
//   sesiunea e a clientului, cu `impersonator` în ea, cel mult o oră. Apoi, sau
//   dacă sesiunea clientului nu mai e valabilă, redevine a administratorului.
// - users.last_seen_at: la intrare și apoi cel mult o dată pe oră (pentru
//   panoul de administrare; nu și cât administratorul e în contul clientului).
// Erorile aruncate din `authorize` ajung la pagina de intrare ca `error`.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

/** Cât de des se recitește contul în sesiune (rolul, versiunea, numele). */
const REFRESH_MS = 60 * 1000
/** Cât de des se scrie ultima folosire a platformei. */
const SEEN_MS = 60 * 60 * 1000

/** O sesiune fără identitate: pentru NextAuth, nimeni intrat în cont. */
const signedOut = () => ({}) as JWT

/**
 * Administratorul iese din contul clientului (a ales să iasă, a trecut ora sau sesiunea clientului nu mai e
 * valabilă): ieșirea se scrie în jurnal, iar sesiunea redevine a lui, dacă e tot administrator. Altfel, nimeni.
 */
export async function adminTokenBack(supabase: Supabase, token: JWT, endedBy: 'admin' | 'expired' | 'session'): Promise<JWT> {
  const now = Date.now()
  if (token.impersonation?.id) {
    await supabase.from('admin_impersonations').update({ ended_at: new Date(now).toISOString(), ended_by: endedBy })
      .eq('id', token.impersonation.id).is('ended_at', null)
  }
  const admin = token.impersonator
  if (!admin?.id) return signedOut()
  const { data, error } = await supabase.from('users').select(PROFILE_COLUMNS).eq('id', admin.id).maybeSingle()
  const profile = data as Profile | null
  if (error || !profile || profile.role !== 'admin' || !profile.email_verified_at) return signedOut()
  return { ...profileToken(profile, admin.provider || 'credentials', now), seenAt: now }
}

/** Profilul contului; dacă lipsește (cont Supabase fără rând în users), se face unul, neconfirmat. */
async function loadProfile(id: string, email: string): Promise<Profile | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('users').select(PROFILE_COLUMNS).eq('id', id).maybeSingle()
  if (error) {
    logError('auth/profile', 'Profilul n-a putut fi citit', { userId: id, error: error.message })
    return null
  }
  if (data) return data as Profile
  const { data: created, error: eCreate } = await supabase.from('users')
    .insert({ id, email, name: email.split('@')[0], role: 'user', onboarding_completed: false })
    .select(PROFILE_COLUMNS)
    .single()
  if (eCreate) {
    logError('auth/profile', 'Profilul lipsă n-a putut fi creat', { userId: id, error: eCreate.message })
    return null
  }
  return created as Profile
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'credentials',
      // Etichetele apar doar în formularul implicit NextAuth, nefolosit (autentificarea are pagina ei, tradusă)
      credentials: {
        email: { label: 'Email', type: 'email' }, // i18n-ignore
        password: { label: 'Password', type: 'password' }, // i18n-ignore
      },
      async authorize(credentials, req) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''
        if (!email || !password || email.length > 254 || password.length > 200) return null

        // Fiecare încercare se numără: pe IP (multe adrese de la același om) și pe adresă (din multe IP-uri)
        const ip = clientIp(req?.headers as Record<string, string | string[] | undefined> | undefined)
        const allowed = await rateLimitAll([
          [`login-ip:${ip}`, 20, 10 * 60 * 1000],
          [`login-email:${email}`, 5, 10 * 60 * 1000],
        ])
        if (!allowed) throw new Error('rate_limited')

        const check = await verifyPassword(email, password)
        if (!check.ok) return null

        const profile = await loadProfile(check.userId, check.email)
        if (!profile) throw new Error('unavailable')
        // Abia după parola corectă: altfel s-ar afla ce adrese au cont
        if (!profile.email_verified_at) throw new Error('email_not_verified')

        return {
          id: profile.id,
          email: profile.email,
          name: profile.name || defaultName(profile.ui_locale),
          role: profile.role === 'admin' ? 'admin' : 'user',
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true

      // Doar o adresă pe care Google a confirmat-o
      const google = profile as { email?: unknown; email_verified?: unknown } | undefined
      const email = (typeof google?.email === 'string' ? google.email : user.email ?? '').trim().toLowerCase()
      if (!email || google?.email_verified !== true) return '/login?error=google_unverified'

      const supabase = createAdminClient()
      const { data: existing, error } = await supabase.from('users').select('id, email_verified_at').eq('email', email).maybeSingle()
      if (error) {
        logError('auth/google', 'Contul n-a putut fi citit', { error: error.message })
        return '/login?error=unavailable'
      }

      if (existing) {
        user.id = existing.id
        if (!existing.email_verified_at) {
          // Un cont cu parolă neconfirmat: adresa e acum confirmată de Google, dar parola a putut-o
          // alege oricine (înscrierea nu cerea dovada adresei). O schimbăm cu una aleatorie, pe care
          // n-o știe nimeni, și închidem sesiunile vechi. Omul poate cere oricând o parolă nouă.
          const { error: ePw } = await supabase.auth.admin.updateUserById(existing.id, { password: randomBytes(32).toString('base64url') })
          if (ePw) {
            logError('auth/google', 'Parola contului preluat n-a putut fi schimbată', { userId: existing.id, error: ePw.message })
            return '/login?error=unavailable'
          }
          await supabase.from('users').update({
            email_verified_at: new Date().toISOString(), email_verify_token_hash: null, email_verify_expires_at: null,
          }).eq('id', existing.id)
          await bumpSessionVersion(supabase, existing.id)
          logWarn('auth/google', 'Cont neconfirmat preluat cu Google', { userId: existing.id })
        }
        return true
      }

      // Primul cont cu Google: confirmat de Google. Termenii îi acceptă imediat după, pe
      // /accept-terms, cu aceleași căsuțe ca la înscriere; până atunci nu poate folosi platforma
      const { data: created, error: eCreate } = await supabase.auth.admin.createUser({ email, email_confirm: true })
      if (eCreate || !created.user) {
        logError('auth/google', 'Contul Google n-a putut fi creat', { error: eCreate?.message ?? 'fără utilizator' })
        return '/login?error=unavailable'
      }
      const name = checkName(user.name)
      const now = new Date().toISOString()
      const { error: eProfile } = await supabase.from('users').insert({
        id: created.user.id,
        email,
        name: name.ok ? name.name : email.split('@')[0].slice(0, 60),
        avatar_url: typeof user.image === 'string' && user.image.startsWith('https://') ? user.image : null,
        role: 'user',
        onboarding_completed: false,
        email_verified_at: now,
      })
      if (eProfile) {
        logError('auth/google', 'Profilul contului Google n-a putut fi creat', { error: eProfile.message })
        await supabase.auth.admin.deleteUser(created.user.id)
        return '/login?error=unavailable'
      }
      user.id = created.user.id
      return true
    },

    async jwt({ token, user, account, trigger }) {
      const supabase = createAdminClient()

      // Intrarea în cont: identitatea, rolul și versiunea sesiunii, din bază
      if (user) {
        const { data, error } = await supabase.from('users').select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle()
        const profile = data as Profile | null
        if (error || !profile || !profile.email_verified_at) return signedOut()
        const now = Date.now()
        Object.assign(token, profileToken(profile, account?.provider ?? 'credentials', now), { seenAt: now })
        await supabase.from('users').update({ last_seen_at: new Date(now).toISOString() }).eq('id', profile.id)
        return token
      }

      // O sesiune retrasă rămâne retrasă
      if (!token.id) return token

      // Administratorul în contul unui client: ora s-a terminat, sesiunea redevine a lui
      if (token.impersonator && Date.now() > (token.impersonation?.until ?? 0)) return adminTokenBack(supabase, token, 'expired')

      const elapsed = Date.now() - (Number(token.refreshedAt) || 0)
      if (trigger === 'update' || elapsed > REFRESH_MS) {
        const { data, error } = await supabase.from('users')
          .select('name, role, onboarding_completed, ui_locale, session_version, email_verified_at, terms_accepted_at, terms_version')
          .eq('id', token.id)
          .maybeSingle()
        // Baza nu răspunde: sesiunea rămâne cum e (o pană nu scoate pe toată lumea din cont)
        if (error) return token
        const profile = data as Omit<Profile, 'id' | 'email'> | null
        // Cont șters, versiune schimbată sau adresă neconfirmată: sesiunea nu mai e valabilă.
        // Sesiunile de dinainte de versiuni n-au `sv`: contează ca 0
        if (!profile || (profile.session_version ?? 0) !== (Number(token.sv) || 0) || !profile.email_verified_at) {
          return token.impersonator ? adminTokenBack(supabase, token, 'session') : signedOut()
        }
        token.name = profile.name || defaultName(profile.ui_locale)
        token.role = profile.role === 'admin' ? 'admin' : 'user'
        token.onboardingCompleted = !!profile.onboarding_completed
        token.termsAccepted = !!profile.terms_accepted_at
        token.termsVersion = profile.terms_version ?? null
        token.locale = profile.ui_locale ?? null
        token.refreshedAt = Date.now()
        // Ultima folosire, cel mult o dată pe oră; administratorul din contul clientului nu contează
        if (!token.impersonator && Date.now() - (Number(token.seenAt) || 0) > SEEN_MS) {
          await supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', token.id)
          token.seenAt = Date.now()
        }
      }
      return token
    },

    async session({ session, token }) {
      // Fără identitate: nicio sesiune (getServerSession întoarce null)
      if (!token.id) return {} as Session
      if (session.user) {
        session.user.name = (token.name as string) || defaultName(token.locale)
        session.user.id = token.id
        session.user.role = token.role
        ;(session.user as { onboardingCompleted?: unknown }).onboardingCompleted = token.onboardingCompleted
        ;(session.user as { locale?: unknown }).locale = token.locale ?? null
        ;(session.user as { termsVersion?: unknown }).termsVersion = token.termsVersion ?? null
      }
      // Administratorul în contul acestui client (bara de jos îl arată, cu drumul înapoi)
      if (token.impersonator) {
        session.impersonator = { name: token.impersonator.name, email: token.impersonator.email, until: token.impersonation?.until ?? 0 }
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login', // i18n-ignore (o adresă, nu un text)
  },

  session: {
    strategy: 'jwt',
    // Sesiunea expiră după 24 de ore fără folosire; contul se recitește la un minut
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
