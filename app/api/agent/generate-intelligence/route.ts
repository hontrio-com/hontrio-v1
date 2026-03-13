import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import crypto from 'crypto'

function computeHash(data: any): string {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
}

function cleanHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
}

const PROMPT = `Analizezi un produs dintr-un magazin online. Pe baza datelor primite, generează un profil complet de cunoștințe.

REGULI STRICTE:
- Folosește DOAR informația din datele produsului. Nu inventa specificații.
- Dacă nu ai o informație, scrie "Informație nedisponibilă" — NU presupune.
- Scrie în română, natural, concis dar util.

Răspunde STRICT în acest format JSON (fără markdown, fără backticks):
{
  "technical_summary": "Rezumat tehnic 2-3 propoziții — ce este, la ce servește, parametri cheie",
  "sales_summary": "De ce ar cumpăra cineva — avantaje, valoare — 2-3 propoziții",
  "best_for": "Pentru cine e ideal — 1-2 propoziții",
  "not_ideal_for": "Pentru cine NU e recomandat — 1 propoziție sau 'Nu există limitări cunoscute.'",
  "top_benefits": ["beneficiu 1", "beneficiu 2", "beneficiu 3"],
  "key_specs": {"spec1": "valoare1", "spec2": "valoare2"},
  "faq_candidates": [{"q": "întrebare frecventă", "a": "răspuns din date"}, {"q": "întrebare 2", "a": "răspuns"}, {"q": "întrebare 3", "a": "răspuns"}],
  "common_objections": [{"objection": "obiecție", "response": "răspuns"}, {"objection": "obiecție 2", "response": "răspuns"}],
  "comparison_points": ["punct comparație 1", "punct 2"],
  "compatibility_notes": "Cu ce e compatibil sau 'Informație nedisponibilă'",
  "care_instructions": "Cum se folosește/întreține sau 'Informație nedisponibilă'",
  "confidence_notes": "Ce știm sigur vs ce nu e confirmat"
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

    const { data: store } = await supabase.from('stores').select('id').eq('user_id', userId).single()
    if (!store) return NextResponse.json({ error: 'Niciun magazin' }, { status: 404 })

    let query = supabase.from('products').select('*').eq('user_id', userId).is('parent_id', null)
    if (productIds) query = query.in('id', productIds.slice(0, 50)) // FIX: max 50 produse per cerere
    else query = query.limit(50) // FIX: cap la 50 fără product_ids explicit
    const { data: products } = await query
    if (!products?.length) return NextResponse.json({ error: 'Niciun produs' }, { status: 404 })

    const { data: existing } = await supabase.from('product_intelligence')
      .select('product_id, content_hash').eq('user_id', userId)
    const hashMap = new Map((existing || []).map((e: any) => [e.product_id, e.content_hash]))

    const pIds = products.map(p => p.id)
    const { data: allVariants } = await supabase.from('products')
      .select('id, parent_id, variant_name, optimized_title, original_title, price')
      .in('parent_id', pIds)
    const varMap: Record<string, any[]> = {}
    for (const v of (allVariants || [])) {
      if (!varMap[v.parent_id]) varMap[v.parent_id] = []
      varMap[v.parent_id].push(v)
    }

    const { data: uc } = await supabase.from('users').select('credits').eq('id', userId).single()
    let credits = uc?.credits || 0
    let generated = 0, skipped = 0, failed = 0
    const errors: string[] = []

    for (const product of products) {
      const variants = varMap[product.id] || []
      const src = {
        title: product.optimized_title || product.original_title || '',
        desc: cleanHtml(product.original_description),
        short: cleanHtml(product.optimized_short_description),
        long: cleanHtml(product.optimized_long_description),
        category: product.category || '', price: product.price,
        benefits: product.benefits, specs: product.specifications,
        keyword: product.focus_keyword, variants: variants.map(v => ({ name: v.variant_name, title: v.optimized_title || v.original_title, price: v.price })),
      }
      const hash = computeHash(src)
      if (!force && hashMap.get(product.id) === hash) { skipped++; continue }
      if (credits - (generated * 2) < 2) { errors.push('Credite insuficiente'); break }

      try {
        await supabase.from('product_intelligence').upsert({
          product_id: product.id, user_id: userId, store_id: store.id,
          content_hash: hash, status: 'processing', updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id' })

        const ctx = `PRODUS: ${src.title}\nCATEGORIE: ${src.category}\nPREȚ: ${src.price ? src.price + ' RON' : 'Nedisponibil'}\nDESCRIERE: ${src.desc || 'Lipsă'}\nDESCRIERE SCURTĂ: ${src.short || 'Lipsă'}\n${src.benefits ? `BENEFICII: ${JSON.stringify(src.benefits)}` : ''}${src.specs ? `\nSPECIFICAȚII: ${JSON.stringify(src.specs)}` : ''}${variants.length ? `\nVARIAȚII: ${variants.map(v => `${v.name || v.title} (${v.price} RON)`).join(', ')}` : ''}`

        const gpt = await openai.chat.completions.create({
          model: 'gpt-4o-mini', messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: ctx }],
          temperature: 0.3, max_tokens: 1500, response_format: { type: 'json_object' },
        })
        const intel = JSON.parse(gpt.choices[0].message.content || '{}')

        const fullText = [src.title, src.category, intel.technical_summary, intel.sales_summary, intel.best_for,
          intel.not_ideal_for, (intel.top_benefits || []).join('. '),
          Object.entries(intel.key_specs || {}).map(([k, v]) => `${k}: ${v}`).join('. '),
          (intel.faq_candidates || []).map((f: any) => `${f.q} ${f.a}`).join('. '),
          (intel.common_objections || []).map((o: any) => `${o.objection} ${o.response}`).join('. '),
          (intel.comparison_points || []).join('. '), intel.compatibility_notes, intel.care_instructions,
        ].filter(Boolean).join('\n')

        const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: fullText.slice(0, 8000) })

        await supabase.from('product_intelligence').upsert({
          product_id: product.id, user_id: userId, store_id: store.id, content_hash: hash,
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
        generated++
      } catch (err: any) {
        failed++; errors.push(`${product.original_title}: ${err.message}`)
        await supabase.from('product_intelligence').upsert({
          product_id: product.id, user_id: userId, store_id: store.id,
          content_hash: hash, status: 'failed', error_message: err.message,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id' })
      }
    }

    if (generated > 0) {
      const cost = generated * 2
      const newBal = Math.max(0, credits - cost)
      await supabase.from('users').update({ credits: newBal }).eq('id', userId)
      await supabase.from('credit_transactions').insert({
        user_id: userId, type: 'usage', amount: -cost, balance_after: newBal,
        description: `Product Intelligence — ${generated} produse`, reference_type: 'product_intelligence',
      })
    }

    return NextResponse.json({ ok: true, total: products.length, generated, skipped, failed, credits_used: generated * 2, errors: errors.length ? errors : undefined })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const supabase = createAdminClient()
    const userId = (session.user as any).id
    const { count: totalProducts } = await supabase.from('products')
      .select('id', { count: 'exact', head: true }).eq('user_id', userId).is('parent_id', null)
    const { data: stats } = await supabase.from('product_intelligence').select('status').eq('user_id', userId)
    const sc: Record<string, number> = { ready: 0, pending: 0, processing: 0, failed: 0 }
    for (const s of (stats || [])) sc[s.status] = (sc[s.status] || 0) + 1
    return NextResponse.json({ total_products: totalProducts || 0, intelligence: sc, coverage: sc.ready > 0 ? Math.round((sc.ready / (totalProducts || 1)) * 100) : 0 })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}