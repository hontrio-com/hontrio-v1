import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// =============================================
// Verificarea parolei unui cont, prin Supabase Auth.
//
// Se face pe un client separat, aruncat imediat: după signInWithPassword, un
// client Supabase trimite la baza de date jetonul omului (rolul `authenticated`)
// în locul cheii de serviciu, iar acel rol nu mai are acces la tabele
// (migrarea 021). Cine ar folosi același client mai departe ar primi
// „permission denied”. Sesiunea Supabase deschisă aici se închide pe loc:
// intrarea în Hontrio o ține NextAuth, nu Supabase.
// =============================================

export type PasswordCheck = { ok: true; userId: string; email: string } | { ok: false }

export async function verifyPassword(email: string, password: string): Promise<PasswordCheck> {
  const client = createAdminClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.user) return { ok: false }
  await client.auth.signOut({ scope: 'local' }).catch(() => {})
  return { ok: true, userId: data.user.id, email: data.user.email ?? email }
}
