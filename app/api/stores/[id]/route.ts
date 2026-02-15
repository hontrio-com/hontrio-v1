import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: 'Eroare la ștergere' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Magazin deconectat' })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}