import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json()

    // Validari
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

    // Creaza userul in Supabase Auth
    console.log('Creating auth user...')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('Auth error:', authError)
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'Acest email este deja înregistrat' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Eroare la crearea contului: ' + authError.message },
        { status: 500 }
      )
    }

    console.log('Auth user created:', authData.user.id)

    // Creaza profilul in tabela users
    console.log('Creating profile...')
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
      console.error('Profile error:', profileError)
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Eroare la crearea profilului: ' + profileError.message },
        { status: 500 }
      )
    }

    console.log('Profile created successfully')

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