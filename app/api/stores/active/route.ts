import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { setActiveStore } from '@/lib/stores/active'

// =============================================
// POST /api/stores/active — alege magazinul pe care lucrează paginile
// { store_id }; doar dintre magazinele contului.
// =============================================

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  let body: { store_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cerere invalidă' }, { status: 400 })
  }
  if (typeof body.store_id !== 'string' || !body.store_id) return NextResponse.json({ error: 'Magazin invalid' }, { status: 400 })

  const ok = await setActiveStore(createAdminClient(), session.user.id, body.store_id)
  if (!ok) return NextResponse.json({ error: 'Magazinul nu e al tău' }, { status: 404 })
  return NextResponse.json({ active_store_id: body.store_id })
}
