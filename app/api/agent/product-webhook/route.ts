import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import crypto from 'crypto'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verifyHmac(body: string, sig: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64')
    const a = Buffer.from(sig), b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch { return false }
}

function computeHash(data: any): string {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
}

function cleanHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
}

const INTEL_PROMPT = `You are analyzing a product for an eCommerce store. Based on the provided product data, generate a complete knowledge profile. Generate the output in the store's language (default: Romanian if not specified).

STRICT RULES:
- Use ONLY information present in the product data. Do not invent specifications.
- If a piece of information is unavailable, write "Information not available" — do NOT assume.
- Write naturally, concisely but usefully, in the store owner's language.

Respond STRICTLY in this JSON format (no markdown, no backticks):
{
  "technical_summary": "Technical summary in 2-3 sentences",
  "sales_summary": "Why someone would buy this — 2-3 sentences",
  "best_for": "Who this is ideal for — 1-2 sentences",
  "not_ideal_for": "Who this is NOT recommended for — 1 sentence",
  "top_benefits": ["benefit 1", "benefit 2", "benefit 3"],
  "key_specs": {"spec1": "value1"},
  "faq_candidates": [{"q": "question", "a": "answer"}],
  "common_objections": [{"objection": "objection", "response": "response"}],
  "comparison_points": ["point 1"],
  "compatibility_notes": "What it is compatible with",
  "care_instructions": "How to use/maintain",
  "confidence_notes": "What we know for certain vs what is uncertain"
}`

// ─── Generate intelligence for a single product ──────────────────────────────

async function generateIntelForProduct(
  supabase: ReturnType<typeof createAdminClient>,
  product: any,
  userId: string,
  storeId: string,
  variants: any[] = []
) {
  const src = {
    title: product.optimized_title || product.original_title || '',
    desc: cleanHtml(product.original_description),
    short: cleanHtml(product.optimized_short_description),
    long: cleanHtml(product.optimized_long_description),
    category: product.category || '',
    price: product.price,
    benefits: product.benefits,
    specs: product.specifications,
    keyword: product.focus_keyword,
    variants: variants.map(v => ({ name: v.variant_name, title: v.optimized_title || v.original_title, price: v.price })),
  }
  const hash = computeHash(src)

  // Check if already up-to-date
  const { data: existing } = await supabase
    .from('product_intelligence')
    .select('content_hash')
    .eq('product_id', product.id)
    .maybeSingle()

  if (existing?.content_hash === hash) return { status: 'skipped' }

  // Mark as processing
  await supabase.from('product_intelligence').upsert({
    product_id: product.id, user_id: userId, store_id: storeId,
    content_hash: hash, status: 'processing', updated_at: new Date().toISOString(),
  }, { onConflict: 'product_id' })

  // Build context
  const ctx = `PRODUS: ${src.title}\nCATEGORIE: ${src.category}\nPREȚ: ${src.price ? src.price + ' RON' : 'Nedisponibil'}\nDESCRIERE: ${src.desc || 'Lipsă'}\nDESCRIERE SCURTĂ: ${src.short || 'Lipsă'}\n${src.benefits ? `BENEFICII: ${JSON.stringify(src.benefits)}` : ''}${src.specs ? `\nSPECIFICAȚII: ${JSON.stringify(src.specs)}` : ''}${variants.length ? `\nVARIAȚII: ${variants.map(v => `${v.variant_name || v.optimized_title || v.original_title} (${v.price} RON)`).join(', ')}` : ''}`

  // AI generation
  const gpt = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: INTEL_PROMPT }, { role: 'user', content: ctx }],
    temperature: 0.3, max_tokens: 1500, response_format: { type: 'json_object' },
  })
  const intel = JSON.parse(gpt.choices[0].message.content || '{}')

  // Build full text for embedding
  const fullText = [
    src.title, src.category, intel.technical_summary, intel.sales_summary, intel.best_for,
    intel.not_ideal_for, (intel.top_benefits || []).join('. '),
    Object.entries(intel.key_specs || {}).map(([k, v]) => `${k}: ${v}`).join('. '),
    (intel.faq_candidates || []).map((f: any) => `${f.q} ${f.a}`).join('. '),
    (intel.common_objections || []).map((o: any) => `${o.objection} ${o.response}`).join('. '),
    (intel.comparison_points || []).join('. '), intel.compatibility_notes, intel.care_instructions,
  ].filter(Boolean).join('\n')

  // Generate embedding
  const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: fullText.slice(0, 8000) })

  // Save
  await supabase.from('product_intelligence').upsert({
    product_id: product.id, user_id: userId, store_id: storeId, content_hash: hash,
    technical_summary: intel.technical_summary, sales_summary: intel.sales_summary,
    best_for: intel.best_for, not_ideal_for: intel.not_ideal_for,
    top_benefits: intel.top_benefits, key_specs: intel.key_specs,
    faq_candidates: intel.faq_candidates, common_objections: intel.common_objections,
    comparison_points: intel.comparison_points, compatibility_notes: intel.compatibility_notes,
    care_instructions: intel.care_instructions, confidence_notes: intel.confidence_notes,
    full_text: fullText, embedding: JSON.stringify(emb.data[0].embedding),
    status: 'ready', error_message: null,
    generated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: 'product_id' })

  return { status: 'generated' }
}

// ─── Webhook endpoint ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let raw = ''
  try { raw = await req.text() } catch {
    return NextResponse.json({ error: 'Cannot read body' }, { status: 400 })
  }

  const topic = req.headers.get('x-wc-webhook-topic') || ''
  const sig = req.headers.get('x-wc-webhook-signature') || ''
  const src = req.headers.get('x-wc-webhook-source') || ''

  // Accept product.created, product.updated, product.deleted
  if (!topic.startsWith('product.')) {
    return NextResponse.json({ ok: true, skipped: topic })
  }

  const supabase = createAdminClient()

  // Find store by source URL
  const srcClean = src.replace(/\/$/, '').toLowerCase()
  const { data: store } = await supabase
    .from('stores')
    .select('id, user_id, webhook_secret')
    .or(`store_url.ilike.%${srcClean}%`)
    .maybeSingle()

  if (!store) {
    console.error('[product-webhook] Store not found for source:', src)
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  // Verify HMAC signature
  if (store.webhook_secret) {
    // If store has a secret configured, sig MUST be present and valid
    if (!sig || !verifyHmac(raw, sig, store.webhook_secret)) {
      console.error('[product-webhook] Invalid or missing HMAC signature')
      return new Response('Invalid signature', { status: 200 }) // always 200 for WooCommerce
    }
  }

  let payload: any
  try { payload = JSON.parse(raw) } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const wcProductId = String(payload.id)
  const userId = store.user_id

  // ── product.deleted ────────────────────────────────────────────────────────
  if (topic === 'product.deleted') {
    // Find our product by external_id and delete intelligence
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('user_id', userId)
      .eq('external_id', wcProductId)
      .maybeSingle()

    if (product) {
      await supabase.from('product_intelligence').delete().eq('product_id', product.id)
      console.log(`[product-webhook] Deleted intelligence for product ${product.id} (WC: ${wcProductId})`)
    }

    return NextResponse.json({ ok: true, action: 'deleted', wc_id: wcProductId })
  }

  // ── product.created / product.updated ──────────────────────────────────────
  // Find matching product in our DB
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)
    .eq('external_id', wcProductId)
    .is('parent_id', null)
    .maybeSingle()

  if (!product) {
    // Product not synced yet — skip intelligence (will be generated at next sync)
    console.log(`[product-webhook] Product WC:${wcProductId} not found in DB — skipping intelligence`)
    return NextResponse.json({ ok: true, action: 'not_synced', wc_id: wcProductId })
  }

  // Get variants
  const { data: variants } = await supabase
    .from('products')
    .select('id, parent_id, variant_name, optimized_title, original_title, price')
    .eq('parent_id', product.id)

  // Check if user has credits (2 per product)
  const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single()
  const credits = user?.credits || 0

  if (credits < 2) {
    console.log(`[product-webhook] User ${userId} has ${credits} credits — skipping intelligence regen`)
    return NextResponse.json({ ok: true, action: 'no_credits', wc_id: wcProductId })
  }

  try {
    const result = await generateIntelForProduct(supabase, product, userId, store.id, variants || [])

    // Deduct credits only if actually generated
    if (result.status === 'generated') {
      const newBal = Math.max(0, credits - 2)
      await supabase.from('users').update({ credits: newBal }).eq('id', userId)
      await supabase.from('credit_transactions').insert({
        user_id: userId, type: 'usage', amount: -2, balance_after: newBal,
        description: `Intelligence auto-refresh: ${product.optimized_title || product.original_title}`,
        reference_type: 'product_intelligence',
      })
    }

    console.log(`[product-webhook] ${result.status} intelligence for ${product.original_title} (WC:${wcProductId})`)
    return NextResponse.json({ ok: true, action: result.status, wc_id: wcProductId, product_id: product.id })
  } catch (err: any) {
    console.error(`[product-webhook] Error generating intelligence:`, err.message)

    await supabase.from('product_intelligence').upsert({
      product_id: product.id, user_id: userId, store_id: store.id,
      status: 'failed', error_message: err.message,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_id' })

    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-WC-Webhook-Topic, X-WC-Webhook-Signature, X-WC-Webhook-Source',
    },
  })
}