import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitAsync } from '@/lib/security/rate-limit'
import { contentMatchesType, IMAGE_TYPES } from '@/lib/security/upload'
import { logApiError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/user/avatar — poza de profil (JPG, PNG, WebP, GIF; cel mult 2 MB).
// Stă în bucketul public `uploads`, la avatars/<cont>/; pozele vechi se șterg.
// Tipul se verifică după conținut, iar extensia vine din tip.
// =============================================

const ROUTE = '/api/user/avatar'
const BUCKET = 'uploads'
const MAX_SIZE = 2 * 1024 * 1024

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    const userId = session.user.id

    const rl = await rateLimitAsync(`avatar:${userId}`, 10, 60 * 60 * 1000)
    if (!rl.success) return NextResponse.json({ error: t('api.rate_limited') }, { status: 429 })

    const formData = await request.formData().catch(() => null)
    const file = (formData?.get('file') || formData?.get('avatar')) as File | null
    if (!file || typeof file === 'string') return NextResponse.json({ error: t('api.no_file') }, { status: 400 })

    const ext = IMAGE_TYPES[file.type]
    if (!ext) return NextResponse.json({ error: t('api.file_type_images') }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: t('api.file_too_large', { size: 2 }) }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!contentMatchesType(buffer, file.type)) return NextResponse.json({ error: t('api.file_type_images') }, { status: 400 })

    const supabase = createAdminClient()
    const folder = `avatars/${userId}`
    const fileName = `${folder}/avatar-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, buffer, { contentType: file.type, upsert: false })
    if (uploadError) {
      logApiError(ROUTE, 500, 'Poza n-a putut fi încărcată', { userId, error: uploadError.message })
      return NextResponse.json({ error: t('api.upload_failed') }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (updateError) {
      logApiError(ROUTE, 500, 'Poza n-a putut fi salvată în profil', { userId, error: updateError.message })
      await supabase.storage.from(BUCKET).remove([fileName])
      return NextResponse.json({ error: t('api.profile_update_failed') }, { status: 500 })
    }

    // Pozele de dinainte nu mai trebuie
    const { data: old } = await supabase.storage.from(BUCKET).list(folder, { limit: 100 })
    const stale = (old ?? []).map(f => `${folder}/${f.name}`).filter(p => p !== fileName)
    if (stale.length) await supabase.storage.from(BUCKET).remove(stale)

    return NextResponse.json({ url: publicUrl, avatar_url: publicUrl })
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare neașteptată', { error: (err as Error).message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
