import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import crypto from 'crypto'

/**
 * POST /api/agent/generate-intelligence
 * 
 * Generează Product Intelligence pentru toate produsele (sau un subset).
 * 
 * Body opțional:
 *   { product_ids?: string[] }   — dacă lipsește, procesează TOATE produsele
 *   { force?: boolean }          — dacă true, regenerează chiar dacă hash-ul nu s-a schimbat
 * 
 * Flow per produs:
 *   1. Ia datele brute (titlu, descriere, categorie, preț, atribute, variații)
 *   2. Calculează content_hash — dacă e același ca înainte, skip
 *   3. Trimite la GPT-4o-mini cu prompt structurat
 *   4. Parsează răspunsul JSON
 *   5. Concatenează tot în full_text
 *   6. Face embedding pe full_text
 *   7. Salvează/update în product_intelligence
 */

function computeHash(data: any): string {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
}

function cleanHtml(html: string | null): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')      // strip HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSourceData(product: any, variants: any[]) {
  return {
    title: product.optimized_title || product.original_title || '',
    description: cleanHtml(product.original_description),
    short_description: cleanHtml(product.optimized_short_description),
    long_description: cleanHtml(product.optimized_long_description),
    category: product.category || '',
    price: product.price,
    benefits: product.benefits,
    specifications: product.specifications,
    focus_keyword: product.focus_keyword,
    secondary_keywords: product.secondary_keywords,
    variants: variants.map(v => ({
      name: v.variant_name,
      title: v.optimized_title || v.original_title,
      price: v.price,
    })),
  }
}

const INTELLIGENCE_PROMPT = `Analizezi un produs dintr-un magazin online. Pe baza datelor primite, generează un profil complet de cunoștințe.

REGULI STRICTE:
- Folosește DOAR informația din datele produsului. Nu inventa specificații.
- Dacă nu ai o informație, scrie "Informație nedisponibilă" — NU presupune.
- Scrie în română, natural, ca un consultant de vânzări experimentat.
- Fii concis dar util.

Răspunde STRICT în acest format JSON (fără markdown, fără backticks):
{
  "technical_summary": "Rezumat tehnic al produsului în 2-3 propoziții — ce este, la ce servește, parametri cheie",
  "sales_summary": "De ce ar cumpăra cineva acest produs — avantaje, valoare, diferențiere — 2-3 propoziții",
  "best_for": "Pentru cine e ideal — tipuri de clienți, scenarii de utilizare — 1-2 propoziții",
  "not_ideal_for": "Pentru cine NU e recomandat sau ce limitări are — 1 propoziție. Dacă nu știi, scrie 'Nu există limitări cunoscute.'",
  "top_benefits": ["beneficiu 1", "beneficiu 2", "beneficiu 3"],
  "key_specs": {"spec1": "valoare1", "spec2": "valoare2"},
  "faq_candidates": [
    {"q": "întrebare frecventă 1", "a": "răspuns bazat pe datele produsului"},
    {"q": "întrebare frecventă 2", "a": "răspuns"},
    {"q": "întrebare frecventă 3", "a": "răspuns"}
  ],
  "common_objections": [
    {"objection": "obiecție probabilă", "response": "cum răspundem"},
    {"objection": "obiecție 2", "response": "răspuns"}
  ],
  "comparison_points": ["punct de comparație cu produse similare 1", "punct 2"],
  "compatibility_notes": "Cu ce e compatibil, ce accesorii funcționează — sau 'Informație nedisponibilă'",
  "care_instructions": "Cum se folosește/întreține — sau 'Informație nedisponibilă'",
  "confidence_notes": "Ce știm sigur din date vs ce nu e confirmat clar"
}`

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const body = await req.json().catch(() => ({}))
    const productIds: string[] | null = body.product_ids || null
    const force = body.force === true

    const supabase = createAdminClient()

    // Get store
    const { data: store } = await supabase.from('stores')
      .select('id').eq('user_id', userId).single()
    if (!store) return NextResponse.json({ error: 'Niciun magazin' }, { status: 404 })

    // Get products
    let query = supabase.from('products')
      .select('*')
      .eq('user_id', userId)
      .is('parent_id', null) // doar produse principale, nu variații

    if (productIds) {
      query = query.in('id', productIds)
    }

    const { data: products } = await query
    if (!products?.length) return NextResponse.json({ error: 'Niciun produs' }, { status: 404 })

    // Get existing intelligence for hash comparison
    const { data: existing } = await supabase.from('product_intelligence')
      .select('product_id, content_hash')
      .eq('user_id', userId)
    const hashMap = new Map((existing || []).map((e: any) => [e.product_id, e.content_hash]))

    // Get variants for each product
    const productIdList = products.map(p => p.id)
    const { data: allVariants } = await supabase.from('products')
      .select('id, parent_id, variant_name, optimized_title, original_title, price')
      .in('parent_id', productIdList)

    const variantsByParent: Record<string, any[]> = {}
    for (const v of (allVariants || [])) {
      if (!variantsByParent[v.parent_id]) variantsByParent[v.parent_id] = []
      variantsByParent[v.parent_id].push(v)
    }

    let generated = 0, skipped = 0, failed = 0
    const errors: string[] = []

    // Deduce credits
    const { data: userCredits } = await supabase.from('users')
      .select('credits').eq('id', userId).single()
    const availableCredits = userCredits?.credits || 0

    for (const product of products) {
      const variants = variantsByParent[product.id] || []
      const sourceData = buildSourceData(product, variants)
      const hash = computeHash(sourceData)

      // Skip dacă hash-ul e același și nu e force
      if (!force && hashMap.get(product.id) === hash) {
        skipped++
        continue
      }

      // Check credits (2 credits per product)
      if (availableCredits - (generated * 2) < 2) {
        errors.push(`Credite insuficiente. Procesat ${generated} produse.`)
        break
      }

      try {
        // Mark as processing
        await supabase.from('product_intelligence').upsert({
          product_id: product.id,
          user_id: userId,
          store_id: store.id,
          content_hash: hash,
          status: 'processing',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id' })

        // Generate intelligence with GPT
        const productContext = `
PRODUS: ${sourceData.title}
CATEGORIE: ${sourceData.category}
PREȚ: ${sourceData.price ? sourceData.price + ' RON' : 'Nedisponibil'}
DESCRIERE: ${sourceData.description || 'Lipsă'}
DESCRIERE SCURTĂ: ${sourceData.short_description || 'Lipsă'}
DESCRIERE LUNGĂ: ${sourceData.long_description || 'Lipsă'}
${sourceData.benefits ? `BENEFICII: ${JSON.stringify(sourceData.benefits)}` : ''}
${sourceData.specifications ? `SPECIFICAȚII: ${JSON.stringify(sourceData.specifications)}` : ''}
${sourceData.focus_keyword ? `KEYWORD FOCUS: ${sourceData.focus_keyword}` : ''}
${variants.length ? `VARIAȚII: ${variants.map(v => `${v.name || v.title} (${v.price} RON)`).join(', ')}` : ''}`

        const gptRes = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: INTELLIGENCE_PROMPT },
            { role: 'user', content: productContext },
          ],
          temperature: 0.3,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        })

        const raw = gptRes.choices[0].message.content || '{}'
        let intel: any
        try { intel = JSON.parse(raw) } catch {
          throw new Error('Invalid JSON from GPT')
        }

        // Build full_text for embedding
        const fullText = [
          sourceData.title,
          sourceData.category,
          intel.technical_summary,
          intel.sales_summary,
          intel.best_for,
          intel.not_ideal_for,
          (intel.top_benefits || []).join('. '),
          Object.entries(intel.key_specs || {}).map(([k, v]) => `${k}: ${v}`).join('. '),
          (intel.faq_candidates || []).map((f: any) => `${f.q} ${f.a}`).join('. '),
          (intel.common_objections || []).map((o: any) => `${o.objection} ${o.response}`).join('. '),
          (intel.comparison_points || []).join('. '),
          intel.compatibility_notes,
          intel.care_instructions,
        ].filter(Boolean).join('\n')

        // Generate embedding
        const embRes = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: fullText.slice(0, 8000), // max token safety
        })
        const embedding = embRes.data[0].embedding

        // Save
        await supabase.from('product_intelligence').upsert({
          product_id: product.id,
          user_id: userId,
          store_id: store.id,
          content_hash: hash,
          technical_summary: intel.technical_summary || null,
          sales_summary: intel.sales_summary || null,
          best_for: intel.best_for || null,
          not_ideal_for: intel.not_ideal_for || null,
          top_benefits: intel.top_benefits || null,
          key_specs: intel.key_specs || null,
          faq_candidates: intel.faq_candidates || null,
          common_objections: intel.common_objections || null,
          comparison_points: intel.comparison_points || null,
          compatibility_notes: intel.compatibility_notes || null,
          care_instructions: intel.care_instructions || null,
          confidence_notes: intel.confidence_notes || null,
          full_text: fullText,
          embedding: JSON.stringify(embedding),
          status: 'ready',
          error_message: null,
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id' })

        generated++
      } catch (err: any) {
        failed++
        errors.push(`${product.original_title || product.id}: ${err.message}`)

        await supabase.from('product_intelligence').upsert({
          product_id: product.id,
          user_id: userId,
          store_id: store.id,
          content_hash: hash,
          status: 'failed',
          error_message: err.message,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id' })
      }
    }

    // Deduct credits
    if (generated > 0) {
      const cost = generated * 2
      const newBalance = Math.max(0, availableCredits - cost)
      await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
      await supabase.from('credit_transactions').insert({
        user_id: userId, type: 'usage', amount: -cost, balance_after: newBalance,
        description: `Product Intelligence — ${generated} produse`,
        reference_type: 'product_intelligence',
      })
    }

    return NextResponse.json({
      ok: true,
      total: products.length,
      generated,
      skipped,
      failed,
      credits_used: generated * 2,
      errors: errors.length ? errors : undefined,
    })
  } catch (err: any) {
    console.error('[Intelligence]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — check status
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const supabase = createAdminClient()
    const userId = (session.user as any).id

    const { data: totalProducts } = await supabase.from('products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).is('parent_id', null)

    const { data: stats } = await supabase.from('product_intelligence')
      .select('status')
      .eq('user_id', userId)

    const statusCounts: Record<string, number> = { ready: 0, pending: 0, processing: 0, failed: 0 }
    for (const s of (stats || [])) {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1
    }

    return NextResponse.json({
      total_products: totalProducts || 0,
      intelligence: statusCounts,
      coverage: statusCounts.ready > 0 ? Math.round((statusCounts.ready / (totalProducts || 1)) * 100) : 0,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}