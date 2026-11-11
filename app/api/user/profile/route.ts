import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'

// GET - fetch full profile
export async function GET() {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, avatar_url, role, preferences, created_at')
      .eq('id', userId)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: t('api.user_not_found') }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}

// PUT - update profile
export async function PUT(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const supabase = createAdminClient()

    // Only allow updating these fields
    const allowedFields: Record<string, any> = {}
    const allowed = ['name', 'avatar_url', 'preferences']

    for (const key of allowed) {
      if (body[key] !== undefined) {
        allowedFields[key] = body[key]
      }
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: t('api.nothing_to_save') }, { status: 400 })
    }

    allowedFields.updated_at = new Date().toISOString()

    const { data: user, error } = await supabase
      .from('users')
      .update(allowedFields)
      .eq('id', userId)
      .select('id, name, email, avatar_url, role, preferences')
      .single()

    if (error) {
      console.error('Profile update error:', error)
      return NextResponse.json({ error: t('api.save_failed') }, { status: 500 })
    }

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}