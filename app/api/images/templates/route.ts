import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// GET - list saved style templates
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: templates } = await supabase
      .from('image_style_templates')
      .select('*')
      .eq('user_id', userId)
      .order('usage_count', { ascending: false })

    return NextResponse.json({ templates: templates || [] })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST - save new template
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { name, style, manual_description, thumbnail_url } = await request.json()
    if (!name || !style) return NextResponse.json({ error: 'name and style are required' }, { status: 400 })

    const { data, error } = await supabase
      .from('image_style_templates')
      .insert({ user_id: userId, name, style, manual_description, thumbnail_url })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Save error' }, { status: 500 })
    return NextResponse.json({ template: data })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH - increment usage count
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const { id } = await request.json()
    const supabase = createAdminClient()

    await supabase.rpc('increment_template_usage', { template_id: id, p_user_id: userId })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE - remove template
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const { id } = await request.json()
    const supabase = createAdminClient()

    await supabase.from('image_style_templates').delete().eq('id', id).eq('user_id', userId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}