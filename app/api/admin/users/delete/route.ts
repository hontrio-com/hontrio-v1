import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const { user_id } = await request.json()
    const adminId = (session.user as any).id

    if (!user_id) {
      return NextResponse.json({ error: 'ID utilizator lipsă' }, { status: 400 })
    }

    // Prevent self-deletion
    if (user_id === adminId) {
      return NextResponse.json({ error: 'Nu te poți șterge pe tine însuți' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check user exists
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('id', user_id)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'Utilizatorul nu a fost găsit' }, { status: 404 })
    }

    // Prevent deleting other admins
    if (user.role === 'admin') {
      return NextResponse.json({ error: 'Nu poți șterge un alt admin' }, { status: 400 })
    }

    // Delete in order (respect foreign keys):
    // 1. generated_images (references products)
    // 2. generation_jobs (references products)
    // 3. credit_transactions
    // 4. products (references stores)
    // 5. stores
    // 6. notifications
    // 7. user from users table
    // 8. user from Supabase Auth

    await supabase.from('generated_images').delete().eq('user_id', user_id)
    await supabase.from('generation_jobs').delete().eq('user_id', user_id)
    await supabase.from('credit_transactions').delete().eq('user_id', user_id)
    await supabase.from('products').delete().eq('user_id', user_id)
    await supabase.from('stores').delete().eq('user_id', user_id)

    // Delete notifications if table exists
    try {
      await supabase.from('notifications').delete().eq('user_id', user_id)
    } catch {
      // Table might not exist yet, that's ok
    }

    // Delete from users table
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', user_id)

    if (deleteError) {
      console.error('User delete error:', deleteError)
      return NextResponse.json({ error: 'Eroare la ștergerea utilizatorului' }, { status: 500 })
    }

    // Delete from Supabase Auth
    try {
      await supabase.auth.admin.deleteUser(user_id)
    } catch {
      console.error('Auth user delete failed (may already be deleted)')
    }

    return NextResponse.json({
      success: true,
      message: `Utilizatorul ${user.email} a fost șters definitiv`,
    })
  } catch (err) {
    console.error('Delete user error:', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}