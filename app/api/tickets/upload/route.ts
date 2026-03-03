import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'image/webp':      'webp',
  'image/gif':       'gif',
  'application/pdf': 'pdf',
  'text/plain':      'txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Niciun fișier trimis' }, { status: 400 })
    }

    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json({
        error: 'Tip de fișier nepermis. Sunt acceptate: JPG, PNG, WebP, GIF, PDF, TXT, DOC, DOCX'
      }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Fișierul trebuie să fie sub 10MB' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const ext = ALLOWED_TYPES[file.type]
    const fileName = `ticket-attachments/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      return NextResponse.json({ error: 'Eroare la upload: ' + error.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(data.path)

    return NextResponse.json({
      url: urlData.publicUrl,
      name: file.name,
      size: file.size,
      type: file.type,
      path: data.path,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Eroare la upload' }, { status: 500 })
  }
}