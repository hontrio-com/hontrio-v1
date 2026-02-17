import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// GET - fetch full profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, avatar_url, credits, plan, role, business_name, website, brand_tone, brand_language, niche, preferences, created_at')
      .eq('id', userId)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

// PUT - update profile
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const supabase = createAdminClient()

    // Only allow updating these fields
    const allowedFields: Record<string, any> = {}
    const allowed = ['name', 'avatar_url', 'business_name', 'website', 'brand_tone', 'brand_language', 'niche', 'preferences']

    for (const key of allowed) {
      if (body[key] !== undefined) {
        allowedFields[key] = body[key]
      }
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'Nicio modificare de salvat' }, { status: 400 })
    }

    allowedFields.updated_at = new Date().toISOString()

    const { data: user, error } = await supabase
      .from('users')
      .update(allowedFields)
      .eq('id', userId)
      .select('id, name, email, avatar_url, credits, plan, role, business_name, website, brand_tone, brand_language, niche, preferences')
      .single()

    if (error) {
      console.error('Profile update error:', error)
      return NextResponse.json({ error: 'Eroare la salvare' }, { status: 500 })
    }

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}