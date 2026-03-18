import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const publicUserId = searchParams.get('userId')
  try {
    const supabase = createAdminClient()
    if (publicUserId) {
      const { data: triggers } = await supabase
        .from('agent_triggers')
        .select('id, type, message, conditions, cooldown_hours, priority')
        .eq('user_id', publicUserId)
        .eq('is_active', true)
        .order('priority', { ascending: false })
      return NextResponse.json({ triggers: triggers || [] }, { headers: CORS })
    }
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const { data: triggers } = await supabase
      .from('agent_triggers').select('*').eq('user_id', userId).order('priority', { ascending: false })
    return NextResponse.json({ triggers: triggers || [] })
  } catch (err) {
    return NextResponse.json({ error: 'Error' }, { status: 500, headers: CORS })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const body = await request.json()
    const supabase = createAdminClient()
    const { data, error } = await supabase.from('agent_triggers').insert({
      user_id: userId, name: body.name, type: body.type, message: body.message,
      conditions: body.conditions || {}, cooldown_hours: body.cooldown_hours ?? 24,
      priority: body.priority ?? 0, is_active: body.is_active ?? true,
    }).select().single()
    if (error) throw error
    return NextResponse.json({ trigger: data })
  } catch (err) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const body = await request.json()
    const { id, ...updates } = body
    const supabase = createAdminClient()
    const { data, error } = await supabase.from('agent_triggers')
      .update(updates).eq('id', id).eq('user_id', userId).select().single()
    if (error) throw error
    return NextResponse.json({ trigger: data })
  } catch (err) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })
    const supabase = createAdminClient()
    await supabase.from('agent_triggers').delete().eq('id', id).eq('user_id', userId)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS })
}