import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }
    const supabase = createAdminClient()

    const [{ data: failedImages }, { data: failedJobs }] = await Promise.all([
      supabase
        .from('generated_images')
        .select('id, style, user_id, created_at, status')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('generation_jobs')
        .select('id, type, status, created_at, user_id, error_message')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    // Enrich with user emails
    const userIds = [...new Set([
      ...(failedImages || []).map(i => i.user_id),
      ...(failedJobs || []).map(j => j.user_id),
    ])]
    let userMap: Record<string, string> = {}
    if (userIds.length) {
      const { data: users } = await supabase.from('users').select('id, email').in('id', userIds)
      ;(users || []).forEach(u => { userMap[u.id] = u.email })
    }

    const errors = [
      ...(failedImages || []).map(img => ({
        id: img.id,
        type: 'image_generation',
        detail: `Style: ${img.style}`,
        user: userMap[img.user_id] || img.user_id,
        created_at: img.created_at,
        error: 'Generation failed',
      })),
      ...(failedJobs || []).map(job => ({
        id: job.id,
        type: job.type,
        detail: job.error_message || 'Unknown error',
        user: userMap[job.user_id] || job.user_id,
        created_at: job.created_at,
        error: job.error_message || 'Job failed',
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const totalErrors = errors.length
    const last24h = errors.filter(e => new Date(e.created_at) > new Date(Date.now() - 86400000)).length

    return NextResponse.json({ errors, totalErrors, last24h })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}