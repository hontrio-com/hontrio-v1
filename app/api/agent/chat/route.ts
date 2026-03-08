import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { sendEmail, buildEscalationEmail } from '@/lib/email'

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

function buildSystemPrompt(config: any, storeName: string, catalog: string, memory: VisitorMemory | null, ragContext = '', trainingContext = ''): string {
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
${trainingContext ? `
CORECȚII OBLIGATORII (acestea suprascriu orice alt răspuns — respectă-le exact):
${trainingContext}` : ''}

INTENȚIE — detectezi imediat:
- Orice mention de produs specific → buying_ready → search_query imediat
- "caut ceva", "am nevoie" fără detalii → browsing → O întrebare scurtă
- "care e diferența", "care e mai bun" → comparing → search_query pentru ambele
- "livrare", "retur", "garanție", "pickup", "ridicare", "termen" → info_shipping → răspunzi DIN CUNOȘTINȚELE SPECIFICE de mai sus, NU inventa
- "unde e comanda", "status comandă", "număr comandă", "AWB" → order_tracking → order_query cu numărul/emailul
- "problemă cu comanda", "comanda greșită", "nu am primit" → problem → escaladare WhatsApp
- "vreau să vorbesc cu cineva", "vreau un om", "agent uman", "persoană reală", "vorbesc cu echipa", "sun", "contactez" → escalate → direcționezi IMEDIAT către WhatsApp, NU refuza
- Orice altceva → off_topic → refuzi politicos în 1 propoziție

ESCALADARE — când detectezi intent=escalate sau problem:
- Răspunzi ÎNTOTDEAUNA ceva de genul: "Sigur! Te conectez cu echipa noastră acum." sau "Înțeles, un coleg te va ajuta imediat."
- Setezi show_whatsapp: true OBLIGATORIU
- NU refuza, NU spune că nu poți ajuta cu asta
- NU încerca să rezolvi tu problema în loc să escaladezi
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

// ─── SEARCH ENGINE v3 — Hybrid Precision Search ─────────────────────────────
// Multi-layer: normalize → keyword → semantic → score fusion → category filter

// Normalizare text românesc: elimină diacritice, lowercase, trim
function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/ă/g,'a').replace(/â/g,'a').replace(/î/g,'i').replace(/ș/g,'s').replace(/ț/g,'t')
    .replace(/Ă/g,'a').replace(/Â/g,'a').replace(/Î/g,'i').replace(/Ș/g,'s').replace(/Ț/g,'t')
    .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()
}

// Levenshtein distance
function lev(a: string, b: string): number {
  const dp = Array.from({length:a.length+1}, (_,i) =>
    Array.from({length:b.length+1}, (_,j) => i===0?j:j===0?i:0))
  for (let i=1;i<=a.length;i++)
    for (let j=1;j<=b.length;j++)
      dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1])
  return dp[a.length][b.length]
}

// Similarity 0-1 based on levenshtein
function sim(a:string,b:string):number {
  if(!a||!b)return 0; if(a===b)return 1
  if(a.includes(b)||b.includes(a))return 0.92
  return 1-lev(a,b)/Math.max(a.length,b.length)
}

// Trigram similarity
function ngram(a:string,b:string,n=3):number {
  const g=(s:string)=>{const r=new Set<string>();for(let i=0;i<=s.length-n;i++)r.add(s.slice(i,i+n));return r}
  const sa=g(a),sb=g(b),inter=Array.from(sa).filter(x=>sb.has(x)).length
  return sa.size+sb.size>0?(2*inter)/(sa.size+sb.size):0
}

// Romanian stemmer — mai agresiv, suportă mai multe sufixe
function stem(w:string):string {
  // Ordine: sufixe lungi primele
  for(const s of[
    'atoare','ătoare','itoare','ătorul','atorul','itorul',
    'urilor','oarele','oarea','urile','atori','atori','itori',
    'elor','ilor','ului','oare','ator','itor','abil',
    'ile','lor','uri','ele','ări','eri','iri',
    'are','ere','ire','tor','ala','ală',
    'ul','ea','ii','le','al','ic','at','it','or'
  ]) if(w.endsWith(s)&&w.length-s.length>=3)return w.slice(0,w.length-s.length)
  return w
}

// Sinonim map: search term → [alternative normalized terms]
const SYNONYM_MAP: Record<string, string[]> = {
  'storcator': ['juicer','presare','suc','citrice','fresh'],
  'juicer': ['storcator','presare','suc'],
  'blender': ['mixer','smoothie','zdrobitor'],
  'mixer': ['blender','amestecare'],
  'aspirator': ['vacuum','curatare','praf'],
  'frigider': ['racire','refrigerator','combina frigorifica'],
  'masina spalat': ['washing','rufe','spalare'],
  'cuptor': ['aragaz','gatit','coacere','electric'],
  'tigaie': ['tava','gatit','prajit','wok'],
  'robot bucatarie': ['procesor','tocare','maruntire','blender'],
  'cafetiera': ['espressor','cafea','cappuccino'],
  'espressor': ['cafetiera','cafea','cappuccino'],
  'fier calcat': ['calcare','abur','haine'],
  'sandwich maker': ['grill','prajire','toaster'],
  'toaster': ['paine','prajitor','sandwich'],
  'mop': ['curatenie','pardoseala','spalare','stergatoare'],
}

// Tipuri stopwords românești
const STOP_WORDS = new Set([
  'pentru','care','este','sunt','caut','vreau','unui','ceva','unul',
  'mai','din','sau','bun','buna','cel','cea','cele','acesta','aceasta',
  'acest','asta','acel','acea','unde','cum','cat','cand','daca',
  'dar','ori','fie','nici','tot','doar','chiar','foarte','prea',
  'un','una','o','al','ale','lui','lor','ei','lor',
  'la','cu','si','pe','de','in','prin','spre','sub','catre',
  'imi','mie','tie','iti','ne','va','le','ma','te','se',
  'am','ai','are','avem','aveti','au',
  'este','esti','suntem','sunteti','sunt','era','eram','erai',
  'voi','vei','va','vom','veti','vor',
  'pot','poti','poate','putem','puteti','pot',
  'trebuie','vreau','vrei','vrea','vrem','vreti',
  'as','ar','am','ati','au',
  'sa','fie','fii','fi','fost',
  'ala','aia','alea','asta','astea',
  'bine','rau','mare','mic','nou','vechi',
  'da','nu','ok','deci','apoi','acum',
])

// Extrage keywords din query: normalize + split + remove stops + stem
function extractKeywords(query: string): { raw: string[]; normalized: string[]; stemmed: string[] } {
  const norm = normalize(query)
  const words = norm.split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w))
  return {
    raw: words,
    normalized: words,
    stemmed: words.map(w => stem(w)),
  }
}

// Best fuzzy match score between a keyword and a word
function bestFuzzy(kw: string, word: string): number {
  const nkw = normalize(kw)
  const nw = normalize(word)
  const skw = stem(nkw)
  const sw = stem(nw)

  if (nkw === nw) return 1.0
  if (skw === sw && skw.length >= 3) return 0.95
  if (nw.includes(nkw) || nkw.includes(nw)) return 0.90
  if (sw.includes(skw) || skw.includes(sw)) return 0.85

  // Levenshtein pe normalized
  const levSim = sim(nkw, nw)
  // Levenshtein pe stemmed
  const stemSim = skw.length >= 3 ? sim(skw, sw) : 0
  // Trigram
  const triSim = ngram(nkw, nw)
  const triStemSim = skw.length >= 3 ? ngram(skw, sw) : 0

  return Math.max(levSim, stemSim, triSim, triStemSim)
}

// Score un produs contra keywords — returnează 0-100
function scoreProductV3(product: any, keywords: { raw: string[]; normalized: string[]; stemmed: string[] }): number {
  const titleRaw = product.optimized_title || product.original_title || ''
  const titleNorm = normalize(titleRaw)
  const titleWords = titleNorm.split(/\s+/).filter(Boolean)
  const catNorm = normalize(product.category || '')
  const descNorm = normalize(
    (product.optimized_short_description || product.original_description || '').replace(/<[^>]*>/g, '')
  ).slice(0, 300)

  // ── Pas 1: Scorează fiecare keyword individual ──────────────────────────────
  const kwScores: { score: number; inTitle: boolean; perfect: boolean }[] = []

  for (let i = 0; i < keywords.normalized.length; i++) {
    const kw = keywords.normalized[i]
    const kwStem = keywords.stemmed[i]
    let bestScore = 0
    let inTitle = false
    let perfect = false

    // Layer 1: Exact substring in normalized title
    if (titleNorm.includes(kw)) {
      bestScore = 100; inTitle = true; perfect = true
    }
    // Layer 2: Stem match in title
    else if (kwStem.length >= 3 && titleWords.some(w => stem(w) === kwStem)) {
      bestScore = 92; inTitle = true
    }
    // Layer 3: Fuzzy match against each title word (strict threshold 0.85)
    else {
      let topFuzzy = 0
      for (const tw of titleWords) {
        const f = bestFuzzy(kw, tw)
        if (f > topFuzzy) topFuzzy = f
      }
      if (topFuzzy >= 0.85) {
        bestScore = Math.round(topFuzzy * 88); inTitle = true
      }
      // Layer 4: Synonym match in title
      else {
        const syns = SYNONYM_MAP[kw] || SYNONYM_MAP[kwStem] || []
        for (const syn of syns) {
          const synNorm = normalize(syn)
          if (titleNorm.includes(synNorm)) { bestScore = 55; inTitle = true; break }
          for (const tw of titleWords) {
            if (bestFuzzy(synNorm, tw) >= 0.88) { bestScore = 45; inTitle = true; break }
          }
          if (inTitle) break
        }
      }
      // Layer 5: Category match (nu contează ca "in title")
      if (!inTitle && (catNorm.includes(kw) || (kwStem.length >= 3 && catNorm.includes(kwStem)))) {
        bestScore = Math.max(bestScore, 15)
      }
      // Layer 6: Description match (very weak, nu contează ca "in title")
      if (!inTitle && bestScore === 0 && (descNorm.includes(kw) || (kwStem.length >= 3 && descNorm.includes(kwStem)))) {
        bestScore = 5
      }
    }

    kwScores.push({ score: bestScore, inTitle, perfect })
  }

  const titleMatches = kwScores.filter(k => k.inTitle).length
  const perfectMatches = kwScores.filter(k => k.perfect).length
  const totalKw = keywords.normalized.length

  // ── Pas 2: Reguli stricte bazate pe câte keywords au matched ────────────────

  // REGULA 1: Dacă NICIUN keyword nu e în titlu → 0 (eliminat)
  if (titleMatches === 0) return 0

  // REGULA 2: Pentru queries cu 2+ cuvinte, TOATE trebuie să fie în titlu
  // "suport condimente" → "suport dublu metalic" are doar "suport" → ELIMINAT
  // "mop electric" → "mop steam" are doar "mop" → OK dacă un singur keyword principal
  if (totalKw >= 2) {
    const missingFromTitle = totalKw - titleMatches

    if (missingFromTitle >= 2) {
      // 2+ keywords lipsesc din titlu → eliminat complet
      return 0
    }

    if (missingFromTitle === 1) {
      // 1 keyword lipsește — verificăm dacă cel care lipsește e important (scor = 0 sau foarte mic)
      const missingKw = kwScores.find(k => !k.inTitle)
      if (!missingKw || missingKw.score <= 15) {
        // Keyword-ul lipsă nu e nici în categorie nici nicăieri relevant → eliminat
        return 0
      }
      // E în categorie (scor 15-30) — permitem dar cu penalizare drastică
      // Asta permite: query "cafea robusta" → produs "Cafea" din categoria "Robusta" → ok dar scor mic
    }
  }

  // ── Pas 3: Calculează scor final ───────────────────────────────────────────
  let totalScore = kwScores.reduce((sum, k) => sum + k.score, 0)

  // Normalizare: scorul e relativ la numărul de keywords
  totalScore = Math.round(totalScore / totalKw)

  // Bonus: TOATE keywords sunt perfect matched (exact substring)
  if (perfectMatches === totalKw) {
    totalScore = Math.round(totalScore * 1.5)
  } else if (titleMatches === totalKw) {
    totalScore = Math.round(totalScore * 1.2)
  }

  // Penalizare finală dacă 1 keyword e doar în categorie/descriere
  const allInTitle = kwScores.every(k => k.inTitle)
  if (!allInTitle) {
    totalScore = Math.round(totalScore * 0.4)
  }

  return Math.min(100, totalScore)
}

// ─── Main search function ────────────────────────────────────────────────────

async function searchProducts(query:string, userId:string, max=3, boostIds: string[]=[]): Promise<Product[]> {
  const supabase=createAdminClient()
  const keywords = extractKeywords(query)
  if (!keywords.normalized.length) return []

  // Colectăm candidați din AMBELE surse, apoi scorăm unificat
  type Candidate = {
    product: any
    semanticSim: number    // 0-1 din pgvector
    keywordScore: number   // 0-100 din scoreProductV3
    finalScore: number     // scor combinat
  }

  const candidateMap = new Map<string, Candidate>()

  // ── Source 1: Semantic search (pgvector) ────────────────────────────────────
  try {
    const embRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: query.slice(0, 500) })
    const embedding = embRes.data[0].embedding

    const { data: matches } = await supabase.rpc('match_product_intelligence', {
      query_embedding: embedding, match_user_id: userId, match_threshold: 0.30, match_count: max * 3,
    })

    if (matches?.length) {
      const matchedIds = matches.map((m: any) => m.product_id)
      const { data: products } = await supabase.from('products')
        .select('id,external_id,original_title,optimized_title,price,original_images,category,optimized_short_description,original_description')
        .in('id', matchedIds).is('parent_id', null)

      if (products?.length) {
        const simMap = new Map<string, number>(matches.map((m: any) => [m.product_id as string, Number(m.similarity) || 0]))
        for (const p of products) {
          candidateMap.set(p.id, {
            product: p,
            semanticSim: (simMap.get(p.id) || 0) + (boostIds.includes(p.id) ? 0.03 : 0),
            keywordScore: 0,
            finalScore: 0,
          })
        }
      }
    }
  } catch (err) {
    console.log('[Search] Semantic search failed:', err)
  }

  // ── Source 2: Keyword search (full scan) ───────────────────────────────────
  let allData: any[] = []
  let from = 0
  const batch = 1000
  while (true) {
    const {data} = await supabase.from('products')
      .select('id,external_id,original_title,optimized_title,price,original_images,category,optimized_short_description,original_description')
      .eq('user_id', userId).is('parent_id', null).range(from, from + batch - 1)
    if (!data?.length) break
    allData.push(...data)
    if (data.length < batch) break
    from += batch
  }

  for (const p of allData) {
    const kwScore = scoreProductV3(p, keywords)
    if (kwScore > 0 || candidateMap.has(p.id)) {
      const existing = candidateMap.get(p.id)
      if (existing) {
        existing.keywordScore = kwScore
      } else if (kwScore >= 40) {
        // Doar keyword hits puternice (>=40) intră fără semantic match
        candidateMap.set(p.id, { product: p, semanticSim: 0, keywordScore: kwScore, finalScore: 0 })
      }
    }
  }

  if (!candidateMap.size) return []

  // ── Fusion scoring ─────────────────────────────────────────────────────────
  // REGULA DE AUR: Keyword match e OBLIGATORIU. Semantic e doar bonus.
  // Dacă keyword score = 0 → produsul NU apare, indiferent de semantic similarity.
  // Asta previne "mop" și "suport haine" când cauți "condimente".
  // Semantic search ajută la RE-RANKING (cine e primul), nu la FILTRARE (cine intră).

  for (const c of candidateMap.values()) {
    const kwNorm = c.keywordScore / 100           // 0-1
    const semNorm = c.semanticSim                  // 0-1

    if (c.keywordScore >= 40) {
      // Keyword match solid → semantic e bonus
      c.finalScore = kwNorm * 0.75 + semNorm * 0.25
    } else if (c.keywordScore > 0 && c.keywordScore < 40) {
      // Keyword match slab (doar în descriere/categorie) → acceptăm doar cu semantic puternic
      if (semNorm >= 0.55) {
        c.finalScore = kwNorm * 0.50 + semNorm * 0.50
      } else {
        c.finalScore = 0 // Prea slab pe ambele fronturi
      }
    } else {
      // keyword = 0 → ELIMINAT, indiferent de semantic
      c.finalScore = 0
    }
  }

  // Sortează + filtrare finală
  const sorted = Array.from(candidateMap.values())
    .filter(c => c.finalScore > 0)
    .sort((a, b) => b.finalScore - a.finalScore)

  if (!sorted.length) return []

  // Relevance gap: produsele sub 55% din cel mai bun sunt eliminate
  // Asta asigură că doar produse cu adevărat similare ca relevanță rămân
  const topScore = sorted[0].finalScore
  const minScore = topScore * 0.55
  const final = sorted.filter(c => c.finalScore >= minScore).slice(0, max)

  return final.map(c => ({
    id: c.product.id,
    external_id: c.product.external_id,
    title: c.product.optimized_title || c.product.original_title,
    price: c.product.price,
    image: c.product.original_images?.[0] || null,
    category: c.product.category,
    description: (c.product.optimized_short_description || c.product.original_description || '').replace(/<[^>]*>/g, '').substring(0, 100),
    url: c.product.external_id ? `__STORE__/?p=${c.product.external_id}` : '',
    score: Math.round(c.finalScore * 100),
  }))
}

async function buildCatalog(userId:string):Promise<string> {
  const supabase=createAdminClient()
  // Paginare — aduce TOATE produsele, nu doar 500
  let allProducts: any[] = []
  let from = 0
  const batch = 1000
  while (true) {
    const {data}=await supabase.from('products')
      .select('original_title,optimized_title,price,category').eq('user_id',userId).is('parent_id', null)
      .range(from, from + batch - 1)
    if (!data?.length) break
    allProducts.push(...data)
    if (data.length < batch) break
    from += batch
  }
  if(!allProducts.length)return 'Catalog gol.'

  // Construim lista completă de produse grupate pe categorii cu TOATE titlurile
  const by:Record<string,{titles:string[],lo:number,hi:number}>={}
  for(const p of allProducts){
    const c=p.category||'General'
    if(!by[c])by[c]={titles:[],lo:Infinity,hi:0}
    by[c].titles.push(p.optimized_title||p.original_title||'Fără titlu')
    if(p.price){by[c].lo=Math.min(by[c].lo,Number(p.price));by[c].hi=Math.max(by[c].hi,Number(p.price))}
  }

  // Dacă sunt sub 200 produse, arătăm TOATE titlurile — GPT trebuie să știe de fiecare
  // Dacă sunt peste 200, arătăm primele 8 per categorie ca să nu depășim context window
  const compact = allProducts.length > 200
  const lines=Object.entries(by).map(([c,i])=>{
    const r=i.lo<Infinity?` (${i.lo}-${i.hi} RON)`:''
    if (compact) {
      const shown = i.titles.slice(0, 8)
      return `${c} (${i.titles.length}${r}): ${shown.join(', ')}${i.titles.length > 8 ? ' ...' : ''}`
    }
    return `${c} (${i.titles.length}${r}): ${i.titles.join(', ')}`
  })
  return `${allProducts.length} produse în ${Object.keys(by).length} categorii:\n${lines.join('\n')}`
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



async function searchTrainingCorrections(query: string, userId: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const embRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: query.slice(0, 500) })
    const embedding = embRes.data[0].embedding
    const { data: corrections } = await supabase.rpc('match_training_corrections', {
      query_embedding: embedding,
      match_user_id: userId,
      match_threshold: 0.80,
      match_count: 3,
    })
    if (!corrections?.length) return ''
    return corrections.map((c: any) => `- "${c.correct_answer}"`).join('\n')
  } catch { return '' }
}

async function getVisitorMemory(userId: string, visitorId: string): Promise<VisitorMemory | null> {
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

    const [catalog, memory, ragContext, trainingContext] = await Promise.all([
      buildCatalog(store_user_id),
      getVisitorMemory(store_user_id, visitor_id),
      searchKnowledge(message, store_user_id),
      searchTrainingCorrections(message, store_user_id),
    ])
    console.log('[Chat] RAG context length:', ragContext.length, 'chars')

    const systemPrompt = buildSystemPrompt(config, storeName, catalog, memory, ragContext, trainingContext)

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
      // Semantic search returnează rezultate relevante — nu le mai filtrăm pe keyword
      // Filtrarea strictă era incorectă: anula produse găsite semantic (ex: "storcător" găsit corect dar filtrat)
      products=rawProducts.map(p=>({...p,url:p.url.replace('__STORE__',storeUrl)}))
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

      // Fetch product intelligence for deep knowledge
      let intelCtx = ''
      try {
        const { data: intel } = await supabase.from('product_intelligence')
          .select('product_id, technical_summary, sales_summary, best_for, key_specs, faq_candidates, compatibility_notes')
          .in('product_id', products.map((p:any) => p.id))
          .eq('status', 'ready')
        if (intel?.length) {
          const iMap = new Map(intel.map((i: any) => [i.product_id, i]))
          intelCtx = products.map((p: any) => {
            const pi = iMap.get(p.id)
            if (!pi) return ''
            const parts: string[] = []
            if (pi.technical_summary) parts.push(`Detalii: ${pi.technical_summary}`)
            if (pi.sales_summary) parts.push(`De ce: ${pi.sales_summary}`)
            if (pi.best_for) parts.push(`Ideal pentru: ${pi.best_for}`)
            if (pi.key_specs) parts.push(`Spec: ${Object.entries(pi.key_specs).map(([k,v]) => `${k}: ${v}`).join(', ')}`)
            if (pi.compatibility_notes && pi.compatibility_notes !== 'Informație nedisponibilă') parts.push(`Compatibil: ${pi.compatibility_notes}`)
            return parts.length ? `[${p.title}] ${parts.join('. ')}` : ''
          }).filter(Boolean).join('\n')
        }
      } catch {}

      const ctx=products.map((p:any,i:number)=>{
        const stockLabel = p.stock ? ` [${p.stock.label}]` : ''
        return `${i+1}. "${p.title}" — ${p.price?p.price+' RON':'preț indisponibil'}${stockLabel}`
      }).join('\n')
      const cross=crossProducts.length>0?`\nPentru crosssell: "${crossProducts[0].title}" (${crossProducts[0].price} RON)`:''
      const memCtx=memory?.conversation_summary?`\nContext vizitator: ${memory.conversation_summary}`:''
      const intelSection = intelCtx ? `\n\nCUNOȘTINȚE DETALIATE (folosește pentru răspunsuri precise):\n${intelCtx}` : ''
      const r2=await openai.chat.completions.create({
        model:'gpt-4o-mini',
        messages:[
          {role:'system',content:systemPrompt},
          ...history.slice(-6).map((m:any)=>({role:m.role as 'user'|'assistant',content:m.content})),
          {role:'user',content:message},
          {role:'system',content:`Produse găsite (cu stoc real):\n${ctx}${cross}${memCtx}${intelSection}\n\nFOARTE IMPORTANT: Prezintă EXACT aceste produse. Folosește CUNOȘTINȚELE DETALIATE pentru întrebări tehnice. Dacă stocul e "Stoc epuizat" spune-o clar. Max 2 propoziții. JSON.`},
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

    // 13. Unanswered questions tracking
    if(response.intent==='off_topic'||(response.intent==='escalate'&&response.confidence<0.6)||response.confidence<0.35){
      trackUnanswered({supabase,userId:store_user_id,sessionId:session_id,question:message,intent:response.intent,confidence:response.confidence||0}).catch(()=>{})
    }

    // 15. Product events tracking
    if(allProducts.length>0){
      trackProductEvents({supabase,userId:store_user_id,sessionId:session_id,products:allProducts,intent:response.intent}).catch(()=>{})
    }

    // Notificări escaladare — async, nu blochează răspunsul
    const shouldNotify = (
      (response.intent === 'escalate' && config.notify_on_escalation !== false) ||
      (response.intent === 'problem' && config.notify_on_problem !== false)
    ) && config.notify_email

    if (shouldNotify) {
      sendEscalationNotification({
        supabase, config, storeName,
        userId: store_user_id, sessionId: session_id, visitorId: visitor_id,
        message, intent: response.intent,
        history: full_history.length > 0 ? full_history : currentHistory,
      }).catch(() => {})
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

async function sendEscalationNotification(p: {
  supabase: any; config: any; storeName: string
  userId: string; sessionId: string; visitorId?: string
  message: string; intent: string
  history: Array<{ role: string; content: string }>
}) {
  try {
    // Evită duplicate — nu trimite dacă am trimis deja pentru această sesiune + intent
    const { data: existing } = await p.supabase
      .from('escalation_notifications')
      .select('id').eq('session_id', p.sessionId).eq('trigger_intent', p.intent).limit(1)
    if (existing?.length) return

    const html = buildEscalationEmail({
      agentName: p.config.agent_name || 'Asistent',
      storeName: p.storeName,
      visitorMessage: p.message,
      intent: p.intent,
      conversationHistory: p.history,
    })

    const sent = await sendEmail({
      to: p.config.notify_email,
      subject: p.intent === 'escalate'
        ? `🔴 Client solicită ajutor uman — ${p.storeName}`
        : `⚠️ Problemă raportată de client — ${p.storeName}`,
      html,
    })

    if (sent) {
      await p.supabase.from('escalation_notifications').insert({
        user_id: p.userId, session_id: p.sessionId, visitor_id: p.visitorId,
        trigger_intent: p.intent, trigger_message: p.message,
        email_sent_to: p.config.notify_email, status: 'sent',
      })
      console.log('[Notification] Escalation email sent to', p.config.notify_email)
    }
  } catch (err) {
    console.error('[Notification] Error:', err)
  }
}

// ── 13. UNANSWERED QUESTIONS ─────────────────────────────────────────────────
async function trackUnanswered(p:{supabase:any;userId:string;sessionId?:string;question:string;intent:string;confidence:number}){
  try{
    // Încearcă să găsească o întrebare similară existentă (simplificat: primele 80 chars)
    const key = p.question.trim().toLowerCase().slice(0,80)
    const {data:existing}=await p.supabase.from('unanswered_questions')
      .select('id,count').eq('user_id',p.userId).eq('resolved',false)
      .ilike('question',`%${key.slice(0,40)}%`).limit(1).single()
    if(existing){
      await p.supabase.from('unanswered_questions')
        .update({count:existing.count+1,last_seen_at:new Date().toISOString()})
        .eq('id',existing.id)
    } else {
      await p.supabase.from('unanswered_questions').insert({
        user_id:p.userId, session_id:p.sessionId,
        question:p.question, intent:p.intent, confidence:p.confidence,
      })
    }
  }catch{}
}

// ── 15. PRODUCT EVENTS ───────────────────────────────────────────────────────
async function trackProductEvents(p:{supabase:any;userId:string;sessionId?:string;products:any[];intent:string}){
  try{
    const eventType = p.intent==='comparing'?'compared':p.intent==='escalate'?'escalated':'shown'
    const rows = p.products.map(prod=>({
      user_id:p.userId, session_id:p.sessionId,
      product_id:prod.id||'', external_id:prod.external_id?String(prod.external_id):null,
      product_name:prod.title||prod.name||'',
      event_type:eventType,
    }))
    await p.supabase.from('product_events').insert(rows)
  }catch{}
}