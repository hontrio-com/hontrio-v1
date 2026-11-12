import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitAsync } from '@/lib/security/rate-limit'
import { ATTACHMENT_TYPES, cleanFileName, contentMatchesType } from '@/lib/security/upload'
import { ATTACHMENTS_BUCKET, MAX_ATTACHMENT_SIZE, showAttachments } from '@/lib/tickets/attachments'
import { logApiError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/tickets/upload — un atașament pentru un tichet (al omului sau
// răspunsul echipei). Fișierul intră în bucketul privat `ticket-attachments`,
// la <cont>/<uuid>.<ext>; răspunsul are calea (de pus în tichet) și un link
// semnat, de previzualizare. Tipul se verifică după conținut.
// =============================================

const ROUTE = '/api/tickets/upload'

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    const userId = session.user.id

    const rl = await rateLimitAsync(`ticket-upload:${userId}`, 20, 60 * 60 * 1000)
    if (!rl.success) return NextResponse.json({ error: t('api.rate_limited') }, { status: 429 })

    const formData = await request.formData().catch(() => null)
    const file = formData?.get('file') as File | null
    if (!file || typeof file === 'string') return NextResponse.json({ error: t('api.no_file') }, { status: 400 })

    const ext = ATTACHMENT_TYPES[file.type]
    if (!ext) return NextResponse.json({ error: t('api.file_type_attachments') }, { status: 400 })
    if (file.size > MAX_ATTACHMENT_SIZE) return NextResponse.json({ error: t('api.file_too_large', { size: 4 }) }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!contentMatchesType(buffer, file.type)) return NextResponse.json({ error: t('api.file_type_attachments') }, { status: 400 })

    const supabase = createAdminClient()
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, buffer, { contentType: file.type, upsert: false })
    if (error) {
      logApiError(ROUTE, 500, 'Atașamentul n-a putut fi încărcat', { userId, error: error.message })
      return NextResponse.json({ error: t('api.upload_failed') }, { status: 500 })
    }

    const attachment = { path, name: cleanFileName(file.name), size: file.size, type: file.type }
    const [[shown]] = await showAttachments(supabase, [[attachment]])
    return NextResponse.json({ ...attachment, url: shown?.url ?? null })
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare neașteptată', { error: (err as Error).message })
    return NextResponse.json({ error: t('api.upload_failed') }, { status: 500 })
  }
}
