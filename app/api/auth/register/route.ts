import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitRegister, getClientIp } from '@/lib/security/rate-limit'

export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const ip = getClientIp(request)
    const limit = rateLimitRegister(ip)
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Prea multe încercări. Încearcă din nou mai târziu.' },
        { status: 429 }
      )
    }

    const { name, email, password } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Toate câmpurile sunt obligatorii' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Parola trebuie să aibă minim 6 caractere' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      // Anti user enumeration: generic message for duplicate email
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'Nu s-a putut crea contul. Verifică datele introduse.' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Eroare la crearea contului. Încearcă din nou.' },
        { status: 500 }
      )
    }



    const { error: profileError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: authData.user.email!,
      name,
      role: 'user',
      credits: 20,
      plan: 'free',
      onboarding_completed: false,
    })

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Eroare la crearea profilului. Încearcă din nou.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Cont creat cu succes' },
      { status: 201 }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json(
      { error: 'Eroare internă de server' },
      { status: 500 }
    )
  }
}