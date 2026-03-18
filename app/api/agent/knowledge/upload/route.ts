import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'

const MAX_CHUNK_SIZE = 800   // caractere per chunk
const CHUNK_OVERLAP  = 100   // overlap între chunks

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= MAX_CHUNK_SIZE) return [clean]

  const chunks: string[] = []
  let start = 0

  while (start < clean.length) {
    let end = start + MAX_CHUNK_SIZE

    // Taie la spațiu ca să nu rupă cuvinte
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(' ', end)
      if (lastSpace > start + MAX_CHUNK_SIZE * 0.7) end = lastSpace
    }

    const chunk = clean.slice(start, end).trim()
    if (chunk.length > 50) chunks.push(chunk)
    start = end - CHUNK_OVERLAP
  }

  return chunks
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  })
  return res.data.map(d => d.embedding)
}

async function extractTextFromUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Hontrio/1.0)' },
    signal: AbortSignal.timeout(15000),
  })
  const html = await res.text()
  // Strip HTML tags
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50000)
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const contentType = request.headers.get('content-type') || ''
    let docName = ''
    let docType = 'manual'
    let rawText = ''
    let sourceUrl = ''
    let sizeBytes = 0

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const url  = formData.get('url') as string | null
      const text = formData.get('text') as string | null
      const name = formData.get('name') as string | null

      if (file) {
        docName = name || file.name
        sizeBytes = file.size
        if (sizeBytes > 5 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })

        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        if (ext === 'pdf') {
          docType = 'pdf'
          // Read PDF as text via buffer — basic extraction
          const buffer = await file.arrayBuffer()
          const bytes = new Uint8Array(buffer)
          // Extract readable text from PDF bytes (basic - looks for text streams)
          const str = new TextDecoder('latin1').decode(bytes)
          const matches = str.match(/BT[\s\S]*?ET/g) || []
          rawText = matches
            .map(block => block.replace(/BT|ET/g, '').replace(/Tj|TJ|Tf|Td|TD|Tm|T\*|Tc|Tw|Tz|TL|Tr|Ts/g, ' ').replace(/\(([^)]*)\)/g, '$1').replace(/\[([^\]]*)\]/g, '$1').replace(/[<>\\\/]/g, ' '))
            .join(' ')
            .replace(/\s+/g, ' ').trim()
          if (!rawText || rawText.length < 50) {
            rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim()
          }
        } else if (['txt', 'md', 'csv'].includes(ext)) {
          docType = 'txt'
          rawText = await file.text()
        } else {
          return NextResponse.json({ error: 'Unsupported file type. We accept PDF, TXT, MD.' }, { status: 400 })
        }
      } else if (url) {
        docType = 'url'
        sourceUrl = url
        docName = name || new URL(url).hostname
        rawText = await extractTextFromUrl(url)
        sizeBytes = rawText.length
      } else if (text) {
        docType = 'manual'
        docName = name || 'Text manual'
        rawText = text
        sizeBytes = text.length
      } else {
        return NextResponse.json({ error: 'No content provided' }, { status: 400 })
      }
    } else {
      // JSON body for manual text
      const body = await request.json()
      docType = 'manual'
      docName = body.name || 'Text manual'
      rawText = body.text || ''
      sizeBytes = rawText.length
    }

    if (!rawText || rawText.trim().length < 20) {
      return NextResponse.json({ error: 'Content too short or text could not be extracted.' }, { status: 400 })
    }

    // Crează documentul cu status processing
    const { data: doc, error: docErr } = await supabase
      .from('knowledge_documents')
      .insert({ user_id: userId, name: docName, type: docType, source_url: sourceUrl || null, size_bytes: sizeBytes, status: 'processing' })
      .select('id').single()

    if (docErr || !doc) return NextResponse.json({ error: 'Error saving document' }, { status: 500 })

    // Chunking
    const chunks = chunkText(rawText)
    if (chunks.length === 0) {
      await supabase.from('knowledge_documents').update({ status: 'error', error_msg: 'Could not extract text' }).eq('id', doc.id)
      return NextResponse.json({ error: 'Could not extract text from document' }, { status: 400 })
    }

    // Embeddings în batch-uri de 50
    const BATCH = 50
    const allEmbeddings: number[][] = []
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH)
      const embeddings = await getEmbeddings(batch)
      allEmbeddings.push(...embeddings)
    }

    // Salvează chunks cu embeddings
    const chunkRows = chunks.map((content, idx) => ({
      document_id: doc.id,
      user_id: userId,
      content,
      embedding: JSON.stringify(allEmbeddings[idx]),
      chunk_index: idx,
    }))

    const { error: chunkErr } = await supabase.from('knowledge_chunks').insert(chunkRows)
    if (chunkErr) {
      await supabase.from('knowledge_documents').update({ status: 'error', error_msg: chunkErr.message }).eq('id', doc.id)
      return NextResponse.json({ error: 'Error saving chunks' }, { status: 500 })
    }

    // Marchează ca ready
    await supabase.from('knowledge_documents').update({ status: 'ready', chunk_count: chunks.length }).eq('id', doc.id)

    return NextResponse.json({ ok: true, document_id: doc.id, chunks: chunks.length })
  } catch (err: any) {
    console.error('[Knowledge Upload]', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}