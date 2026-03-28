import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

// ---------------------------------------------------------------------------
// POST /api/blog/upload-image — Admin only
// Accepts multipart/form-data with a 'file' field.
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userRole = (session?.user as any)?.role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate MIME type
    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPG, PNG, WebP and GIF are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds maximum size of 5 MB.' },
        { status: 400 }
      )
    }

    // Build a unique storage path: YYYY/MM/<timestamp>-<random>.<ext>
    const now = new Date()
    const year = now.getFullYear().toString()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const random = Math.random().toString(36).slice(2, 8)
    const storagePath = `${year}/${month}/${Date.now()}-${random}.${ext}`

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const supabase = createAdminClient()

    const { data, error } = await supabase.storage
      .from('blog-images')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('Blog image upload error:', error)
      return NextResponse.json({ error: 'Upload failed: ' + error.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('blog-images')
      .getPublicUrl(data.path)

    return NextResponse.json({
      url: urlData.publicUrl,
      path: data.path,
    })
  } catch (err) {
    console.error('POST /api/blog/upload-image error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
