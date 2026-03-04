import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// POST - generate before/after composite
// Returns composite image URL saved to Supabase Storage
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { image_id, brand_name } = await request.json()

    const { data: img } = await supabase
      .from('generated_images')
      .select('*, products(original_title, optimized_title)')
      .eq('id', image_id)
      .eq('user_id', userId)
      .single()

    if (!img || !img.generated_image_url || !img.original_image_url) {
      return NextResponse.json({ error: 'Imaginea sau referința lipsesc' }, { status: 404 })
    }

    // Fetch both images
    const [beforeBuf, afterBuf] = await Promise.all([
      fetchImageBuffer(img.original_image_url),
      fetchImageBuffer(img.generated_image_url),
    ])

    if (!beforeBuf || !afterBuf) {
      return NextResponse.json({ error: 'Nu pot descărca imaginile' }, { status: 500 })
    }

    // Build composite using pure JS (no canvas dependency needed)
    // We return the two URLs + metadata, let frontend render the slider
    // Server generates a static 2:1 side-by-side PNG using sharp if available
    const composite = await buildComposite(beforeBuf, afterBuf, brand_name)

    if (composite) {
      // Upload composite to storage
      const fileName = `before-after/${userId}/${image_id}-${Date.now()}.jpg`
      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(fileName, composite, { contentType: 'image/jpeg', upsert: true })

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName)
        return NextResponse.json({
          success: true,
          composite_url: urlData.publicUrl,
          before_url: img.original_image_url,
          after_url: img.generated_image_url,
        })
      }
    }

    // Fallback: return both URLs for client-side rendering
    return NextResponse.json({
      success: true,
      composite_url: null,
      before_url: img.original_image_url,
      after_url: img.generated_image_url,
    })
  } catch (err: any) {
    console.error('[BeforeAfter]', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
}

async function buildComposite(before: Buffer, after: Buffer, brandName?: string): Promise<Buffer | null> {
  try {
    // Try to use sharp if available (it's a common Next.js dep)
    const sharp = require('sharp')

    const SIZE = 800
    const GAP = 8
    const LABEL_H = 40
    const TOTAL_W = SIZE * 2 + GAP
    const TOTAL_H = SIZE + LABEL_H

    // Resize both images
    const [beforeImg, afterImg] = await Promise.all([
      sharp(before).resize(SIZE, SIZE, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer(),
      sharp(after).resize(SIZE, SIZE, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer(),
    ])

    // Create SVG overlay with labels
    const labelSvg = `
      <svg width="${TOTAL_W}" height="${TOTAL_H}">
        <!-- Background for labels -->
        <rect x="0" y="${SIZE}" width="${SIZE}" height="${LABEL_H}" fill="#1f2937"/>
        <rect x="${SIZE + GAP}" y="${SIZE}" width="${SIZE}" height="${LABEL_H}" fill="#111827"/>
        <!-- Labels -->
        <text x="${SIZE / 2}" y="${SIZE + 26}" 
          font-family="system-ui,sans-serif" font-size="14" font-weight="600"
          fill="#9ca3af" text-anchor="middle">ÎNAINTE</text>
        <text x="${SIZE + GAP + SIZE / 2}" y="${SIZE + 26}" 
          font-family="system-ui,sans-serif" font-size="14" font-weight="600"
          fill="#60a5fa" text-anchor="middle">DUPĂ — AI ${brandName ? `· ${brandName}` : ''}</text>
        <!-- Divider line -->
        <rect x="${SIZE}" y="0" width="${GAP}" height="${SIZE}" fill="#374151"/>
      </svg>`

    const composite = await sharp({
      create: { width: TOTAL_W, height: TOTAL_H, channels: 3, background: '#111827' }
    })
      .composite([
        { input: beforeImg, left: 0, top: 0 },
        { input: afterImg, left: SIZE + GAP, top: 0 },
        { input: Buffer.from(labelSvg), left: 0, top: 0 },
      ])
      .jpeg({ quality: 92 })
      .toBuffer()

    return composite
  } catch {
    // Sharp not available or failed — client will handle it
    return null
  }
}