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
    const { title, short_description, category, price, section } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Titlul este obligatoriu' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check credits
    const isFullGeneration = !section
    const creditCost = isFullGeneration ? 5 : 2

    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single()

    if (!user || user.credits < creditCost) {
      return NextResponse.json({ error: `Credite insuficiente (necesare: ${creditCost})` }, { status: 400 })
    }

    const baseContext = `Produs: "${title}"\nDescriere: "${short_description || 'N/A'}"\nCategorie: "${category || 'N/A'}"\nPreț: ${price || 'N/A'} RON`

    if (isFullGeneration) {
      // Generate ALL content at once
      const prompt = `${baseContext}

Generează conținut complet optimizat SEO pentru acest produs eCommerce în limba română. Returnează DOAR un JSON valid cu următoarea structură (fără markdown, fără backticks):

{
  "optimized_title": "titlu SEO optimizat 50-70 caractere",
  "short_description": "descriere scurtă persuasivă 2-3 propoziții",
  "long_description": "<h3>Titlu secțiune</h3><p>paragraf introductiv captivant</p><h3>Caracteristici</h3><ul><li>caracteristică 1</li><li>caracteristică 2</li><li>caracteristică 3</li></ul><h3>Beneficii</h3><ul><li>beneficiu 1</li><li>beneficiu 2</li><li>beneficiu 3</li></ul><p>Call to action final</p>",
  "meta_description": "meta description sub 155 caractere cu call-to-action",
  "benefits": ["beneficiu 1", "beneficiu 2", "beneficiu 3", "beneficiu 4", "beneficiu 5"]
}`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Ești un expert în copywriting eCommerce și SEO. Generezi conținut optimizat în limba română. Răspunzi DOAR cu JSON valid, fără markdown, fără backticks, fără explicații.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      })

      const raw = completion.choices[0].message.content?.trim() || '{}'
      let result
      try {
        const cleaned = raw.replace(/```json|```/g, '').trim()
        result = JSON.parse(cleaned)
      } catch {
        return NextResponse.json({ error: 'Eroare la parsarea răspunsului AI' }, { status: 500 })
      }

      // Deduct credits
      const newBalance = user.credits - 5
      await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        type: 'usage',
        amount: -5,
        balance_after: newBalance,
        description: 'Generare conținut AI — produs nou',
        reference_type: 'text_generation',
      })

      return NextResponse.json(result)
    } else {
      // Generate single section
      const validSections = ['title', 'meta_description', 'short_description', 'long_description', 'benefits']
      if (!validSections.includes(section)) {
        return NextResponse.json({ error: 'Secțiune invalidă' }, { status: 400 })
      }

      let prompt = ''
      switch (section) {
        case 'title':
          prompt = `${baseContext}\n\nGenerează un SINGUR titlu optimizat SEO pentru acest produs. Între 50-70 caractere, cu cuvinte cheie relevante.\n\nRăspunde DOAR cu titlul, fără ghilimele.`
          break
        case 'meta_description':
          prompt = `${baseContext}\n\nGenerează o meta description SEO sub 155 caractere, cu call-to-action persuasiv.\n\nRăspunde DOAR cu meta description-ul.`
          break
        case 'short_description':
          prompt = `${baseContext}\n\nGenerează o descriere scurtă persuasivă (2-3 propoziții) care evidențiază beneficiul principal.\n\nRăspunde DOAR cu descrierea.`
          break
        case 'long_description':
          prompt = `${baseContext}\n\nGenerează o descriere lungă în format HTML cu: paragraf intro, secțiune caracteristici (h3 + ul/li), secțiune beneficii (h3 + ul/li), paragraf call-to-action. Folosește tag-uri h3, p, ul, li, strong. NU include html/head/body.\n\nRăspunde DOAR cu HTML-ul.`
          break
        case 'benefits':
          prompt = `${baseContext}\n\nGenerează exact 5 beneficii scurte și convingătoare (max 15 cuvinte fiecare).\n\nRăspunde DOAR cu un JSON array: ["beneficiu 1", "beneficiu 2", ...]`
          break
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Ești un expert în copywriting eCommerce și SEO. Generezi conținut optimizat în limba română. Răspunzi DOAR cu conținutul cerut.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: section === 'long_description' ? 1500 : 500,
      })

      let value: any = completion.choices[0].message.content?.trim() || ''

      if (section === 'benefits') {
        try {
          const cleaned = value.replace(/```json|```/g, '').trim()
          value = JSON.parse(cleaned)
        } catch {
          value = value.split('\n').filter(Boolean).map((b: string) => b.replace(/^[-•*"\d.]+\s*/, '').trim())
        }
      }

      // Deduct credits
      const newBalance = user.credits - 2
      await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        type: 'usage',
        amount: -2,
        balance_after: newBalance,
        description: `Generare ${section} — produs nou`,
        reference_type: 'text_generation',
      })

      return NextResponse.json({ section, value })
    }
  } catch (error: any) {
    console.error('New product AI generation error:', error)
    return NextResponse.json({ error: 'Eroare la generare' }, { status: 500 })
  }
}