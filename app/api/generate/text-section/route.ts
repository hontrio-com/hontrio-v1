import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { product_id, section } = await request.json()

    if (!product_id || !section) {
      return NextResponse.json({ error: 'Date incomplete' }, { status: 400 })
    }

    const validSections = ['title', 'meta_description', 'short_description', 'long_description', 'benefits']
    if (!validSections.includes(section)) {
      return NextResponse.json({ error: 'Secțiune invalidă' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check credits (2 credits per section regeneration)
    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single()

    if (!user || user.credits < 2) {
      return NextResponse.json({ error: 'Credite insuficiente (necesare: 2)' }, { status: 400 })
    }

    // Get product
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('user_id', userId)
      .single()

    if (!product) {
      return NextResponse.json({ error: 'Produsul nu a fost găsit' }, { status: 404 })
    }

    // Build prompt based on section
    let prompt = ''
    const baseContext = `Produs: "${product.original_title}"\nDescriere originală: "${product.original_description || 'N/A'}"\nCategorie: "${product.category || 'N/A'}"\nPreț: ${product.price || 'N/A'} RON`

    switch (section) {
      case 'title':
        prompt = `${baseContext}\n\nGenerează un SINGUR titlu optimizat SEO pentru acest produs. Titlul trebuie să fie între 50-70 caractere, să conțină cuvinte cheie relevante, și să fie atractiv pentru cumpărători.\n\nRăspunde DOAR cu titlul, fără ghilimele, fără explicații.`
        break
      case 'meta_description':
        prompt = `${baseContext}\nTitlu optimizat: "${product.optimized_title || product.original_title}"\n\nGenerează o SINGURĂ meta description SEO pentru acest produs. Meta description-ul trebuie să fie sub 155 caractere, să conțină un call-to-action, și să fie persuasiv.\n\nRăspunde DOAR cu meta description-ul, fără ghilimele, fără explicații.`
        break
      case 'short_description':
        prompt = `${baseContext}\nTitlu optimizat: "${product.optimized_title || product.original_title}"\n\nGenerează o SINGURĂ descriere scurtă persuasivă pentru acest produs (2-3 propoziții). Descrierea trebuie să evidențieze beneficiul principal și să motiveze achiziția.\n\nRăspunde DOAR cu descrierea scurtă, fără ghilimele, fără explicații.`
        break
      case 'long_description':
        prompt = `${baseContext}\nTitlu optimizat: "${product.optimized_title || product.original_title}"\n\nGenerează o descriere lungă completă și profesională pentru acest produs în format HTML. Include:\n- Un paragraf introductiv captivant\n- Secțiune cu caracteristici cheie (h3 + listă)\n- Secțiune cu beneficii (h3 + listă)\n- Paragraf de încheiere cu call-to-action\n\nFolosește tag-uri HTML: h3, p, ul, li, strong. NU include tag-uri html, head, body. Răspunde DOAR cu codul HTML.`
        break
      case 'benefits':
        prompt = `${baseContext}\nTitlu optimizat: "${product.optimized_title || product.original_title}"\n\nGenerează exact 5 beneficii scurte și convingătoare pentru acest produs. Fiecare beneficiu trebuie să fie o propoziție scurtă (max 15 cuvinte) care evidențiază un avantaj clar.\n\nRăspunde DOAR cu un JSON array de 5 stringuri, exemplu: ["beneficiu 1", "beneficiu 2", ...]`
        break
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Ești un expert în copywriting eCommerce și SEO. Generezi conținut optimizat în limba română pentru magazine online. Răspunzi DOAR cu conținutul cerut, fără explicații sau text adițional.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: section === 'long_description' ? 1500 : 500,
    })

    const result = completion.choices[0].message.content?.trim() || ''

    // Update the specific field
    const updateData: Record<string, any> = {}

    switch (section) {
      case 'title':
        updateData.optimized_title = result
        break
      case 'meta_description':
        updateData.meta_description = result
        break
      case 'short_description':
        updateData.optimized_short_description = result
        break
      case 'long_description':
        updateData.optimized_long_description = result
        break
      case 'benefits':
        try {
          const cleaned = result.replace(/```json|```/g, '').trim()
          updateData.benefits = JSON.parse(cleaned)
        } catch {
          updateData.benefits = result.split('\n').filter(Boolean).map(b => b.replace(/^[-•*"\d.]+\s*/, '').trim())
        }
        break
    }

    await supabase
      .from('products')
      .update(updateData)
      .eq('id', product_id)

    // Deduct 2 credits
    const newBalance = user.credits - 2
    await supabase
      .from('users')
      .update({ credits: newBalance })
      .eq('id', userId)

    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -2,
      balance_after: newBalance,
      description: `Regenerare ${section === 'title' ? 'titlu' : section === 'meta_description' ? 'meta description' : section === 'short_description' ? 'descriere scurtă' : section === 'long_description' ? 'descriere lungă' : 'beneficii'}`,
      reference_type: 'text_generation',
    })

    return NextResponse.json({
      success: true,
      section,
      value: updateData[Object.keys(updateData)[0]],
    })
  } catch (error: any) {
    console.error('Section generation error:', error)
    return NextResponse.json({ error: 'Eroare la generare' }, { status: 500 })
  }
}