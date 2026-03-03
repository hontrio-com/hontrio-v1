import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'

type Intent = 'buying_ready'|'browsing'|'comparing'|'compatibility'|'info_product'|'info_shipping'|'problem'|'off_topic'|'escalate'|'greeting'

type Product = {
  id: string; external_id: string|null; title: string; price: number|null
  image: string|null; category: string|null; description: string; url: string; score?: number
}

type AgentResponse = {
  message: string; intent: Intent; confidence: number
  products?: Product[]; quick_replies?: string[]
  show_whatsapp?: boolean; whatsapp_number?: string; whatsapp_prefill?: string
  redirect_url?: string
}

type VisitorMemory = {
  total_sessions: number
  total_messages: number
  last_seen_at: string
  first_seen_at: string
  preferred_categories: string[]
  viewed_product_ids: string[]
  carted_product_ids: string[]
  conversation_summary: string | null
  key_facts: Array<{ fact: string; at: string }>
  last_intent: string | null
  return_count: number
}

function buildSystemPrompt(config: any, storeName: string, catalog: string, memory: VisitorMemory | null, ragContext = ''): string {
  const isReturningVisitor = memory && memory.total_sessions > 0

  let memoryContext = ''
  if (isReturningVisitor) {
    const daysSinceLast = Math.floor(
      (Date.now() - new Date(memory.last_seen_at).getTime()) / (1000 * 60 * 60 * 24)
    )
    const timeAgo = daysSinceLast === 0 ? 'astăzi mai devreme' :
      daysSinceLast === 1 ? 'ieri' :
      `acum ${daysSinceLast} zile`

    memoryContext = `

MEMORIE VIZITATOR (conversații anterioare):
- Număr vizite: ${memory.total_sessions}
- Ultima vizită: ${timeAgo}
- Rezumat: ${memory.conversation_summary || 'N/A'}
${memory.key_facts?.length > 0 ? `- Ce știm despre el: ${memory.key_facts.slice(0, 5).map(f => f.fact).join(', ')}` : ''}
${memory.preferred_categories?.length > 0 ? `- Categorii de interes: ${memory.preferred_categories.join(', ')}` : ''}

INSTRUCȚIUNI MEMORIE:
- Recunoaște vizitatorul care se întoarce: "Bună revenire!" sau "Te-am mai văzut pe aici!"
- Folosește ce știi despre el pentru recomandări personalizate
- Menționează produse noi din categoriile lui preferate dacă există`
  }

  return `Ești ${config.agent_name || 'Asistentul'} de la ${storeName}.

CATALOG COMPLET (acestea sunt TOATE produsele disponibile — nu inventa altele):
${catalog}
${memoryContext}

PERSONALITATE: Vorbești ca un prieten helpful, nu ca un robot. Limbaj cald, natural, scurt.
Exemple bune: "Super alegere!", "Hai să vedem ce avem...", "Uite ce mi se pare perfect pentru tine:"
Exemple proaste: "Bună ziua! Sunt asistentul virtual. Cum vă pot fi de folos astăzi?"

REGULI ABSOLUTE:
1. Răspunzi DOAR despre produse din catalogul de mai sus și politicile ${storeName}
2. Dacă un produs NU e în catalog → spui clar "Nu avem asta" și oferi alternativa cea mai apropiată
3. NU inventa prețuri, specificații, disponibilitate
4. MAX 2 propoziții în mesaj — niciodată mai mult
5. O singură întrebare per mesaj dacă ai nevoie de clarificare
${ragContext ? `
CUNOȘTINȚE SPECIFICE MAGAZIN (folosește pentru întrebări despre livrare, garanție, politici, FAQ):
${ragContext}` : ''}

INTENȚIE — detectezi imediat:
- Orice mention de produs specific → buying_ready → search_query imediat
- "caut ceva", "am nevoie" fără detalii → browsing → O întrebare scurtă
- "care e diferența", "care e mai bun" → comparing → search_query pentru ambele
- "livrare", "retur", "garanție", "pickup", "ridicare", "termen" → info_shipping → răspunzi DIN CUNOȘTINȚELE SPECIFICE de mai sus, NU inventa
- "unde e comanda", "status comandă", "număr comandă", "AWB" → order_tracking → order_query cu numărul/emailul
- "problemă cu comanda", "comanda greșită", "nu am primit" → problem → escaladare WhatsApp
- Orice altceva → off_topic → refuzi politicos în 1 propoziție

UPSELL (natural, niciodată forțat):
- Dacă clientul vrea produs ieftin și există variantă mai bună la +20-30% → menționezi scurt

CROSSSELL (după ce alege):
- Sugerezi 1 singur produs complementar
- crosssell_query = categoria complementară logică

FORMAT RĂSPUNS — JSON strict:
{
  "message": "mesaj uman, max 2 propoziții",
  "intent": "buying_ready|browsing|comparing|compatibility|info_product|info_shipping|problem|off_topic|escalate|greeting|order_tracking",
  "confidence": 0.0-1.0,
  "quick_replies": ["2-3 opțiuni max, scurte"],
  "show_whatsapp": false,
  "search_query": "1-3 cuvinte cheie SIMPLE SAU null",
  "crosssell_query": "1-2 cuvinte categorie complementară SAU null",
  "selected_product_index": null,
  "order_query": "numărul comenzii sau emailul clientului SAU null — când întreabă despre o comandă",
  "check_stock": true/false — când trebuie să verifici stocul live pentru produsele găsite
}`
}

function lev(a: string, b: string): number {
  const dp = Array.from({length:a.length+1}, (_,i) =>
    Array.from({length:b.length+1}, (_,j) => i===0?j:j===0?i:0))
  for (let i=1;i<=a.length;i++)
    for (let j=1;j<=b.length;j++)
      dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1])
  return dp[a.length][b.length]
}
function sim(a:string,b:string):number {
  if(!a||!b)return 0; if(a===b)return 1
  if(a.includes(b)||b.includes(a))return 0.92
  return 1-lev(a,b)/Math.max(a.length,b.length)
}
function ngram(a:string,b:string,n=3):number {
  const g=(s:string)=>{const r=new Set<string>();for(let i=0;i<=s.length-n;i++)r.add(s.slice(i,i+n));return r}
  const sa=g(a),sb=g(b),inter=Array.from(sa).filter(x=>sb.has(x)).length
  return sa.size+sb.size>0?(2*inter)/(sa.size+sb.size):0
}
function stem(w:string):string {
  for(const s of['urile','elor','ilor','ului','ile','lor','uri','ele','are','ere','ire','ul','ea','ii','le','al','ic'])
    if(w.endsWith(s)&&w.length-s.length>=3)return w.slice(0,w.length-s.length)
  return w
}
function scoreProduct(p:any, keywords:string[]):number {
  const title=(p.optimized_title||p.original_title||'').toLowerCase()
  const cat=(p.category||'').toLowerCase()
  const desc=(p.optimized_short_description||p.original_description||'').replace(/<[^>]*>/g,'').toLowerCase().slice(0,200)
  const words=title.split(/\s+/).filter(Boolean)
  let score=0,titleHits=0,exactHits=0

  for(const kw of keywords){
    const st=stem(kw);let best=0
    if(title.includes(kw)){best=100;titleHits++;exactHits++}
    else if(st.length>=3&&title.includes(st)){best=85;titleHits++}
    else if(cat.includes(kw)){best=35}
    else if(st.length>=3&&cat.includes(st)){best=25}
    else{
      let fuzz=0
      for(const w of words){
        const s=Math.max(sim(kw,w),ngram(kw,w),st.length>=3?sim(st,stem(w)):0)
        if(s>fuzz)fuzz=s
      }
      if(fuzz>=0.85){best=Math.round(fuzz*80);titleHits++}
      else if(desc.includes(kw)||(st.length>=3&&desc.includes(st)))best=5
    }
    score+=best
  }

  // REGULA STRICTĂ: dacă niciun keyword nu e în titlu → 0
  if(titleHits===0) return 0

  // Penalizare dacă sunt mai multe keywords dar doar unul e în titlu
  if(keywords.length>=2 && titleHits===1) score=Math.round(score*0.6)

  // Bonus dacă TOATE keyword-urile sunt exact în titlu
  if(exactHits===keywords.length) score=Math.round(score*1.8)
  else if(titleHits===keywords.length) score=Math.round(score*1.3)

  return score
}

async function searchProducts(query:string, userId:string, max=3, boostIds: string[]=[]): Promise<Product[]> {
  const supabase=createAdminClient()
  const STOP=new Set(['pentru','care','este','sunt','caut','vreau','unui','ceva','unul','mai','din','sau','bun','un','o','al','la','cu','si','sau','ori'])
  const keywords=query.toLowerCase().replace(/[^a-zăâîșțA-ZĂÂÎȘȚ0-9\s]/g,' ')
    .split(/\s+/).map(k=>k.trim()).filter(k=>k.length>2&&!STOP.has(k))
  if(!keywords.length)return []

  const {data}=await supabase.from('products')
    .select('id,external_id,original_title,optimized_title,price,original_images,category,optimized_short_description,original_description')
    .eq('user_id',userId).limit(500)
  if(!data?.length)return []

  const allScored = data
    .map((p:any)=>({...p,_s:scoreProduct(p,keywords)+(boostIds.includes(p.id)?8:0)}))
    .filter((p:any)=>p._s>=50)
    .sort((a:any,b:any)=>b._s-a._s)

  if(!allScored.length) return []

  // Filtrare bazată pe gap față de scorul maxim:
  // Un produs e relevant doar dacă e în cel mult 55% din scorul primului
  const topScore = allScored[0]._s
  const minAcceptable = Math.max(50, topScore * 0.45)
  const relevant = allScored.filter((p:any) => p._s >= minAcceptable).slice(0, max)

  return relevant.map((p:any)=>({
      id:p.id, external_id:p.external_id,
      title:p.optimized_title||p.original_title,
      price:p.price, image:p.original_images?.[0]||null,
      category:p.category,
      description:(p.optimized_short_description||p.original_description||'').replace(/<[^>]*>/g,'').substring(0,100),
      url:p.external_id?`__STORE__/?p=${p.external_id}`:'',
      score:Math.min(99,p._s),
    }))
}

async function buildCatalog(userId:string):Promise<string> {
  const supabase=createAdminClient()
  const {data}=await supabase.from('products')
    .select('original_title,optimized_title,price,category').eq('user_id',userId).limit(80)
  if(!data?.length)return 'Catalog gol.'
  const by:Record<string,string[]>={}
  for(const p of data){
    const c=p.category||'General';if(!by[c])by[c]=[]
    by[c].push(`${p.optimized_title||p.original_title}${p.price?` (${p.price} RON)`:''}`)
  }
  return Object.entries(by).map(([c,ps])=>`${c}: ${ps.slice(0,12).join(' | ')}`).join('\n')
}

async function searchKnowledge(query: string, userId: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.slice(0, 500),
    })
    const embedding = embRes.data[0].embedding

    // Încearcă mai întâi cu threshold normal
    let { data: chunks, error } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: embedding,  // array direct, NU JSON.stringify
      match_user_id: userId,
      match_threshold: 0.5,        // threshold mai permisiv
      match_count: 5,
    })

    if (error) {
      console.error('[RAG] RPC error:', error.message)
      // Fallback: caută direct fără vector dacă RPC eșuează
      const { data: allChunks } = await supabase
        .from('knowledge_chunks')
        .select('content')
        .eq('user_id', userId)
        .limit(5)
      if (allChunks?.length) {
        console.log('[RAG] Fallback: returning first chunks without similarity')
        return allChunks.map((c: any) => c.content).join('\n---\n')
      }
      return ''
    }

    console.log('[RAG] Found chunks:', chunks?.length, 'for query:', query.slice(0, 50))
    if (!chunks?.length) {
      // Dacă nu găsește nimic cu threshold 0.5, ia primele chunks disponibile
      const { data: anyChunks } = await supabase
        .from('knowledge_chunks')
        .select('content')
        .eq('user_id', userId)
        .limit(3)
      if (anyChunks?.length) {
        console.log('[RAG] No similarity match, using all available chunks')
        return anyChunks.map((c: any) => c.content).join('\n---\n')
      }
      return ''
    }

    return chunks.map((c: any) => c.content).join('\n---\n')
  } catch (err) {
    console.error('[RAG] searchKnowledge error:', err)
    return ''
  }
}



async function loadVisitorMemory(userId: string, visitorId: string): Promise<VisitorMemory | null> {
  if (!visitorId) return null
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('visitor_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('visitor_id', visitorId)
      .single()
    return data || null
  } catch {
    return null
  }
}

async function persistMemory(params: {
  userId: string; visitorId: string; sessionId: string
  messages: Array<{role: string; content: string}>
  searchQueries: string[]; productsShown: string[]; intent: string
}) {
  try {
    const supabase = createAdminClient()
    const { data: existing } = await supabase
      .from('visitor_memory').select('*')
      .eq('user_id', params.userId).eq('visitor_id', params.visitorId).single()

    let newSummary = existing?.conversation_summary || null
    let newKeyFacts: any[] = existing?.key_facts || []

    if (params.messages.length >= 4) {
      try {
        const summaryRes = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Analizează conversația și extrage informații utile pentru viitor. Răspunde DOAR JSON: {"summary": "max 2 propoziții", "facts": ["fapt1", "fapt2"]}' },
            { role: 'user', content: params.messages.map(m => `${m.role}: ${m.content}`).join('\n') }
          ],
          temperature: 0.3, max_tokens: 200, response_format: { type: 'json_object' },
        })
        const parsed = JSON.parse(summaryRes.choices[0].message.content || '{}')
        if (parsed.summary) newSummary = parsed.summary
        if (parsed.facts?.length > 0) {
          const ts = new Date().toISOString()
          newKeyFacts = [...parsed.facts.map((f: string) => ({ fact: f, at: ts })), ...(existing?.key_facts || [])].slice(0, 20)
        }
      } catch { }
    }

    const freq: Record<string, number> = {}
    for (const item of (existing?.preferred_categories || [])) freq[item] = (freq[item] || 0) + 2
    for (const item of params.searchQueries) { const c = item.toLowerCase().trim(); if (c.length > 2) freq[c] = (freq[c] || 0) + 1 }
    const updatedCategories = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k)

    const updatedViewed = [...params.productsShown, ...(existing?.viewed_product_ids||[])].filter((v,i,a)=>a.indexOf(v)===i).slice(0,50)

    await supabase.from('visitor_memory').upsert({
      user_id: params.userId, visitor_id: params.visitorId,
      total_sessions: (existing?.total_sessions || 0) + 1,
      total_messages: (existing?.total_messages || 0) + params.messages.length,
      last_seen_at: new Date().toISOString(),
      first_seen_at: existing?.first_seen_at || new Date().toISOString(),
      preferred_categories: updatedCategories,
      viewed_product_ids: updatedViewed,
      carted_product_ids: existing?.carted_product_ids || [],
      conversation_summary: newSummary,
      key_facts: newKeyFacts,
      last_intent: params.intent,
      return_count: existing ? (existing.return_count || 0) + 1 : 0,
    }, { onConflict: 'user_id,visitor_id' })

    // Citim sesiunea existentă ca să acumulăm date între mesaje
    const { data: existingSession } = await supabase
      .from('visitor_sessions').select('intents, products_shown, search_queries, messages_count')
      .eq('session_id', params.sessionId).single()

    const accIntents = [...new Set([...(existingSession?.intents || []), params.intent])].filter(Boolean)
    const accProducts = [...new Set([...(existingSession?.products_shown || []), ...params.productsShown])].filter(Boolean).slice(0, 50)
    const accQueries = [...new Set([...(existingSession?.search_queries || []), ...params.searchQueries])].filter(Boolean).slice(0, 50)

    await supabase.from('visitor_sessions').upsert({
      user_id: params.userId, visitor_id: params.visitorId, session_id: params.sessionId,
      messages_count: params.messages.length,
      intents: accIntents,
      products_shown: accProducts,
      search_queries: accQueries,
      messages_log: params.messages, ended_at: new Date().toISOString(),
    }, { onConflict: 'session_id' })
  } catch (err) { console.error('[Memory persist]', err) }
}

export async function POST(request:Request) {
  try {
    const {message, history=[], session_id, store_user_id, visitor_id, full_history=[]} = await request.json()
    if(!message||!store_user_id)return NextResponse.json({error:'Parametri lipsă'},{status:400})

    // Base URL pentru apeluri interne
    const reqUrl = new URL(request.url)
    const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`

    const supabase=createAdminClient()
    const {data:config}=await supabase.from('agent_configs').select('*').eq('user_id',store_user_id).single()
    if(!config?.is_active)return NextResponse.json({error:'Agent inactiv'},{status:403})

    const {data:store}=await supabase.from('stores').select('store_name,store_url').eq('user_id',store_user_id).single()
    const storeName=store?.store_name||config.agent_name||'magazin'
    const storeUrl=store?.store_url?.replace(/\/$/,'')||''

    const [catalog, memory, ragContext] = await Promise.all([
      buildCatalog(store_user_id),
      loadVisitorMemory(store_user_id, visitor_id),
      searchKnowledge(message, store_user_id),
    ])
    console.log('[Chat] RAG context length:', ragContext.length, 'chars')

    const systemPrompt = buildSystemPrompt(config, storeName, catalog, memory, ragContext)

    const gpt=await openai.chat.completions.create({
      model:'gpt-4o-mini',
      messages:[
        {role:'system',content:systemPrompt},
        ...history.slice(-8).map((m:any)=>({role:m.role as 'user'|'assistant',content:m.content})),
        {role:'user',content:message},
      ],
      temperature:0.45, max_tokens:500, response_format:{type:'json_object'},
    })

    let parsed:any
    try{parsed=JSON.parse(gpt.choices[0].message.content||'{}')}
    catch{parsed={message:'Ceva n-a mers, încearcă din nou!',intent:'browsing',confidence:0.5,quick_replies:['Încearcă din nou']}}

    const boostIds = memory?.viewed_product_ids?.slice(0,10) || []
    let products:Product[]=[],crossProducts:Product[]=[],searchQueriesUsed:string[]=[]
    let stockInfo:Record<string,any> = {}
    let orderData:any[] = []

    if(parsed.search_query&&parsed.intent!=='off_topic'&&parsed.intent!=='info_shipping'){
      searchQueriesUsed.push(parsed.search_query)
      const rawProducts=await searchProducts(parsed.search_query, store_user_id, config.max_products_shown||3, boostIds)
      // Filtrare strictă: păstrează doar produsele unde query-ul apare în titlu sau categorie
      const queryWords=parsed.search_query.toLowerCase().split(/\s+/).filter((w:string)=>w.length>2)
      products=rawProducts.filter((p:any)=>{
        const t=(p.title||'').toLowerCase()
        const c=(p.category||'').toLowerCase()
        // Cel puțin un cuvânt cheie relevant trebuie să fie în titlu
        return queryWords.some((w:string)=>t.includes(w)||t.includes(stem(w)))
      }).map(p=>({...p,url:p.url.replace('__STORE__',storeUrl)}))
    }
    if(parsed.crosssell_query && products.length > 0){
      const cs=await searchProducts(parsed.crosssell_query,store_user_id,1)
      // Crosssell valid doar dacă e dintr-o categorie diferită față de produsul principal
      const mainCat=(products[0]?.category||'').toLowerCase()
      crossProducts=cs
        .map(p=>({...p,url:p.url.replace('__STORE__',storeUrl)}))
        .filter(p=>!products.find(x=>x.id===p.id))
        .filter(p=>(p.category||'').toLowerCase()!==mainCat)
    }

    // Stoc live — verifică ÎNTOTDEAUNA pentru orice produse afișate
    if(products.length > 0) {
      const externalIds = products.map((p:any) => p.external_id ? String(p.external_id) : null).filter(Boolean) as string[]
      if(externalIds.length > 0) {
        try {
          const stockRes = await fetch(`${baseUrl}/api/agent/stock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: store_user_id, productIds: externalIds }),
          })
          const stockData = await stockRes.json()
          if(stockData.stock) stockInfo = stockData.stock
        } catch(e) { console.error('[Chat Stock Error]', e) }
      }
    }

    // Tracking comenzi
    if(parsed.order_query && parsed.intent === 'order_tracking') {
      try {
        const isEmail = parsed.order_query.includes('@')
        const orderRes = await fetch(`${baseUrl}/api/agent/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: store_user_id,
            query: parsed.order_query,
            type: isEmail ? 'email' : 'search',
          }),
        })
        const orderResult = await orderRes.json()
        if(orderResult.orders?.length > 0) orderData = orderResult.orders
      } catch {}
    }

    if(products.length>0){
      // Adaugă stoc în produse ÎNAINTE de al doilea apel GPT
      if(Object.keys(stockInfo).length > 0) {
        products = products.map((p:any) => ({
          ...p,
          stock: p.external_id ? (stockInfo[String(p.external_id)] || undefined) : undefined,
        }))
      }

      const ctx=products.map((p:any,i:number)=>{
        const stockLabel = p.stock ? ` [${p.stock.label}]` : ''
        return `${i+1}. "${p.title}" — ${p.price?p.price+' RON':'preț indisponibil'}${stockLabel}`
      }).join('\n')
      const cross=crossProducts.length>0?`\nPentru crosssell: "${crossProducts[0].title}" (${crossProducts[0].price} RON)`:''
      const memCtx=memory?.conversation_summary?`\nContext vizitator: ${memory.conversation_summary}`:''
      const r2=await openai.chat.completions.create({
        model:'gpt-4o-mini',
        messages:[
          {role:'system',content:systemPrompt},
          ...history.slice(-6).map((m:any)=>({role:m.role as 'user'|'assistant',content:m.content})),
          {role:'user',content:message},
          {role:'system',content:`Produse găsite (cu stoc real):\n${ctx}${cross}${memCtx}\n\nFOARTE IMPORTANT: Prezintă EXACT aceste produse, nu inventa altele. Dacă stocul e "Stoc epuizat" spune-o clar. Max 2 propoziții. JSON.`},
        ],
        temperature:0.4, max_tokens:300, response_format:{type:'json_object'},
      })
      try{const r=JSON.parse(r2.choices[0].message.content||'{}');parsed.message=r.message||parsed.message;parsed.quick_replies=r.quick_replies||parsed.quick_replies}catch{}
    } else if(parsed.intent === 'order_tracking') {
      if(orderData.length > 0) {
        const ord = orderData[0]
        const trackingInfo = ord.tracking_number ? ` AWB: ${ord.tracking_number}.` : ''
        const itemsList = ord.items.map((i:any) => `${i.name} x${i.quantity}`).join(', ')
        parsed.message = `Comanda #${ord.number} din ${ord.date} — ${ord.status_label}.${trackingInfo} Produse: ${itemsList}.`
        parsed.quick_replies = ord.status === 'processing' ? ['Când ajunge?', 'Modific comanda', 'Anulare'] : ['Mai am o întrebare', 'Vorbesc cu echipa']
      } else if(parsed.order_query) {
        parsed.message = `Nu am găsit comanda după "${parsed.order_query}". Încearcă cu numărul exact al comenzii sau emailul folosit la comandă.`
        parsed.quick_replies = ['Număr comandă', 'Email comandă', 'Vorbesc cu echipa']
      }
    } else if(parsed.search_query){
      parsed.message=`Nu am găsit "${parsed.search_query}" în catalog. Cum altfel ai descrie ce cauți?`
      parsed.quick_replies=['Descriu altfel','Arată tot','Vorbesc cu echipa']
    }

    const allProducts=[...products,...crossProducts].slice(0,config.max_products_shown||3)

    let redirectUrl:string|undefined
    if(parsed.selected_product_index!=null){const sel=products[Number(parsed.selected_product_index)]||products[0];if(sel?.url)redirectUrl=sel.url}
    if(parsed.intent==='escalate'||parsed.intent==='problem')parsed.show_whatsapp=true

    const response:AgentResponse={
      message:parsed.message||'Cum te pot ajuta?',
      intent:parsed.intent||'browsing',
      confidence:parsed.confidence||0.7,
      quick_replies:parsed.quick_replies||[],
      show_whatsapp:parsed.show_whatsapp||false,
      whatsapp_number:parsed.show_whatsapp?config.whatsapp_number:undefined,
      whatsapp_prefill:parsed.show_whatsapp?encodeURIComponent(`${config.whatsapp_message||'Bună ziua!'}\nÎntrebare: "${message}"`):undefined,
    }
    if(allProducts.length>0)response.products=allProducts
    if(redirectUrl)response.redirect_url=redirectUrl

    const currentHistory=[...history,{role:'user',content:message},{role:'assistant',content:response.message}]

    saveConv({supabase,userId:store_user_id,sessionId:session_id,visitorId:visitor_id,intent:response.intent,products:allProducts.map(p=>p.id)}).catch(()=>{})

    if(visitor_id){
      persistMemory({
        userId:store_user_id, visitorId:visitor_id, sessionId:session_id,
        messages:full_history.length>0?full_history:currentHistory,
        searchQueries:searchQueriesUsed, productsShown:allProducts.map(p=>p.id), intent:response.intent,
      }).catch(()=>{})
    }

    return NextResponse.json(response,{headers:{'Access-Control-Allow-Origin':'*'}})
  }catch(err:any){
    console.error('[Agent]',err)
    return NextResponse.json({message:'Ups! Ceva n-a funcționat. Încearcă din nou!',intent:'browsing',confidence:0,quick_replies:['Încearcă din nou'],show_whatsapp:false},{headers:{'Access-Control-Allow-Origin':'*'}})
  }
}

async function saveConv(p:{supabase:any;userId:string;sessionId:string;visitorId?:string;intent:string;products:string[]}) {
  try{
    const {data:c}=await p.supabase.from('agent_conversations').upsert({user_id:p.userId,session_id:p.sessionId,visitor_id:p.visitorId,intent:p.intent,last_message_at:new Date().toISOString(),escalated:p.intent==='escalate'||p.intent==='problem'},{onConflict:'session_id'}).select('id,message_count').single()
    if(c)await p.supabase.from('agent_conversations').update({message_count:(c.message_count||0)+2,products_shown:p.products.length>0?p.products:undefined}).eq('id',c.id)
  }catch{}
}

export async function OPTIONS() {
  return new Response(null,{headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}})
}