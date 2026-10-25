import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const userId = (session.user as any).id
    const formData = await request.formData()
    const file = (formData.get('file') || formData.get('avatar')) as File

    if (!file) {
      return NextResponse.json({ error: t('api.no_file') }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: t('api.file_type_images') }, { status: 400 })
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: t('api.file_too_large', { size: 2 }) }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Create unique filename
    const ext = file.name.split('.').pop()
    const fileName = `avatars/${userId}/avatar-${Date.now()}.${ext}`

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: t('api.upload_failed') }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName)

    // Update user avatar_url
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json({ error: t('api.profile_update_failed') }, { status: 500 })
    }

    return NextResponse.json({ url: publicUrl, avatar_url: publicUrl })
  } catch (err) {
    console.error('Avatar upload error:', err)
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}