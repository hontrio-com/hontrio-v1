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
    const file = formData.get('file') as File | null
    const productId = formData.get('product_id') as string | null

    if (!file) {
      return NextResponse.json({ error: t('api.no_file') }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: t('api.file_type_product_image') }, { status: 400 })
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: t('api.file_too_large', { size: 10 }) }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const fileName = `${userId}/${productId || 'temp'}/${timestamp}.${ext}`

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('Supabase storage error:', error)
      return NextResponse.json({ error: t('api.upload_failed_detail', { detail: error.message }) }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(data.path)

    return NextResponse.json({
      url: urlData.publicUrl,
      path: data.path,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json(
      { error: t('api.upload_failed_detail', { detail: (err as Error).message }) },
      { status: 500 }
    )
  }
}