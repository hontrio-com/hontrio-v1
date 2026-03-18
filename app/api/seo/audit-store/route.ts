import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { url, strategy = 'mobile' } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing GOOGLE_PAGESPEED_API_KEY in .env. Create a free key at console.cloud.google.com → APIs → PageSpeed Insights API → Credentials.' },
        { status: 503 }
      )
    }

    const cats = 'category=performance&category=seo&category=accessibility&category=best-practices'
    const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${apiKey}&${cats}`

    const psiRes = await fetch(psiUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(45000),
    })

    if (!psiRes.ok) {
      const errData = await psiRes.json().catch(() => ({}))
      console.error('[PSI] Error:', errData)
      return NextResponse.json(
        { error: 'PageSpeed API error: ' + (errData?.error?.message || psiRes.statusText) },
        { status: 502 }
      )
    }

    const psiData = await psiRes.json()

    // Extract and structure the relevant data
    const categories = psiData.lighthouseResult?.categories || {}
    const audits = psiData.lighthouseResult?.audits || {}

    const scores = {
      performance: Math.round((categories.performance?.score || 0) * 100),
      seo: Math.round((categories.seo?.score || 0) * 100),
      accessibility: Math.round((categories.accessibility?.score || 0) * 100),
      best_practices: Math.round((categories['best-practices']?.score || 0) * 100),
    }

    // Core Web Vitals
    const cwv = {
      lcp: audits['largest-contentful-paint']?.displayValue || '—',
      lcp_score: audits['largest-contentful-paint']?.score || 0,
      fid: audits['total-blocking-time']?.displayValue || '—',
      cls: audits['cumulative-layout-shift']?.displayValue || '—',
      cls_score: audits['cumulative-layout-shift']?.score || 0,
      fcp: audits['first-contentful-paint']?.displayValue || '—',
      ttfb: audits['server-response-time']?.displayValue || '—',
      speed_index: audits['speed-index']?.displayValue || '—',
    }

    // SEO-specific audits
    const seoAudits = [
      'document-title',
      'meta-description',
      'link-text',
      'crawlable-anchors',
      'is-crawlable',
      'robots-txt',
      'image-alt',
      'hreflang',
      'canonical',
      'font-size',
      'tap-targets',
      'structured-data',
      'http-status-code',
    ]

    const seoIssues: Array<{
      id: string
      title: string
      description: string
      score: number | null
      displayValue: string
      impact: 'critical' | 'warning' | 'passed'
      fix: string
    }> = []

    // Extended fix instructions for each audit type
    const fixInstructions: Record<string, string> = {
      'document-title': 'Adaugă tag <title> unic și descriptiv (50-70 caractere) care include cuvântul cheie principal. Evită titluri generice sau duplicate între pagini.',
      'meta-description': 'Adaugă meta description pentru fiecare pagină (max 155 caractere). Include beneficiul principal și un CTA. Evită duplicate — fiecare pagină trebuie să aibă meta description unică.',
      'link-text': 'Înlocuiește link-urile generice ("click aici", "află mai mult") cu text descriptiv care explică destinația (ex: "Vezi pantofi sport Nike Air Max").',
      'crawlable-anchors': 'Asigură-te că toate link-urile folosesc <a href="URL"> valid și crawlabil. Evită navigația JavaScript-only — Google nu poate urmări link-urile fără href.',
      'is-crawlable': 'Verifică că pagina nu are meta robots cu "noindex" accidental și că robots.txt nu blochează Googlebot de la crawlarea paginilor importante.',
      'robots-txt': 'Creează sau corectează fișierul robots.txt. Nu bloca accesul la resurse CSS/JS care sunt necesare pentru randarea paginii.',
      'image-alt': 'Adaugă text alt descriptiv la toate imaginile importante (nu decorative). Descrie imaginea natural — nu repeta cuvinte cheie. Ex: alt="Pantofi sport Nike Air Max 90 albi, vedere laterală".',
      'hreflang': 'Dacă ai versiuni în limbi diferite, implementează atributul hreflang corect și reciproc pe toate paginile. Include și x-default.',
      'canonical': 'Adaugă tag canonical self-referential pe fiecare pagină. Asigură-te că canonical-ul este consistent cu URL-ul din sitemap și linkurile interne.',
      'font-size': 'Asigură dimensiune minimă de 16px pentru textul body pe mobile. Evită texte mai mici de 12px oriunde pe pagină.',
      'tap-targets': 'Butoanele și link-urile trebuie să fie minim 48x48px pe mobile și să aibă spațiu de minim 8px între ele pentru a evita click-urile greșite.',
      'structured-data': 'Implementează JSON-LD cu schema Product + Offer pentru produse. Include: name, image, description, price, priceCurrency, availability. Validează cu Google Rich Results Test.',
      'http-status-code': 'Asigură-te că toate paginile returnează status code 200. Paginile șterse permanent trebuie să returneze 404 sau 410, nu 200 cu mesaj de eroare (soft 404).',
    }

    for (const auditId of seoAudits) {
      const audit = audits[auditId]
      if (!audit) continue

      const score = audit.score
      const impact =
        score === null ? 'warning' :
        score >= 0.9 ? 'passed' :
        score >= 0.5 ? 'warning' :
        'critical'

      seoIssues.push({
        id: auditId,
        title: audit.title || auditId,
        description: audit.description || '',
        score: score !== null ? Math.round(score * 100) : null,
        displayValue: audit.displayValue || '',
        impact,
        fix: fixInstructions[auditId] || 'Consultați documentația Google Search Console pentru detalii.',
      })
    }

    // Performance issues with fixes
    const perfAudits = [
      'render-blocking-resources',
      'unused-css-rules',
      'unused-javascript',
      'uses-optimized-images',
      'uses-webp-images',
      'uses-responsive-images',
      'efficiently-encode-images',
      'uses-long-cache-ttl',
      'server-response-time',
      'mainthread-work-breakdown',
    ]

    const perfFixInstructions: Record<string, string> = {
      'render-blocking-resources': 'Elimină sau amână (defer/async) resursele CSS/JS care blochează randarea paginii. Folosește <link rel="preload"> pentru resurse critice.',
      'unused-css-rules': 'Elimină CSS-ul neutilizat. Folosește instrumente precum PurgeCSS sau optimizarea din build tool (Vite, Webpack). Consideră CSS-ul critic inline.',
      'unused-javascript': 'Elimină JavaScript-ul neutilizat și împarte codul în chunks care se încarcă la nevoie (code splitting, lazy loading pentru componente).',
      'uses-optimized-images': 'Comprimă imaginile fără pierdere vizibilă de calitate. Folosește Squoosh, ImageOptim sau optimizare automată în pipeline-ul de build.',
      'uses-webp-images': 'Convertește imaginile la format WebP (sau AVIF). Oferă fallback PNG/JPG cu tag <picture> pentru browsere mai vechi.',
      'uses-responsive-images': 'Implementează srcset și sizes pentru a servi imagini de dimensiunea potrivită pe fiecare device. Evită încărcarea de imagini 2000px pe mobile.',
      'efficiently-encode-images': 'Reduce dimensiunea fișierelor imagine prin compresie mai agresivă. Imaginile JPEG pot fi comprimate la quality 80-85 fără diferențe vizibile.',
      'uses-long-cache-ttl': 'Configurează Cache-Control cu max-age lung (31536000) pentru resurse statice cu versioning (hash în nume). Servere: Nginx, Apache, CDN.',
      'server-response-time': 'Optimizează TTFB (Time to First Byte): upgrade hosting, activează caching server-side, folosește CDN, optimizează query-urile de bază de date.',
      'mainthread-work-breakdown': 'Reduce JavaScript-ul care blochează thread-ul principal. Identifică și elimină codul greu cu Chrome DevTools > Performance profiler.',
    }

    const perfIssues: Array<{
      id: string
      title: string
      displayValue: string
      score: number | null
      impact: 'critical' | 'warning' | 'passed'
      fix: string
    }> = []

    for (const auditId of perfAudits) {
      const audit = audits[auditId]
      if (!audit) continue

      const score = audit.score
      if (score === null || score >= 0.9) continue // skip passed audits for perf

      perfIssues.push({
        id: auditId,
        title: audit.title || auditId,
        displayValue: audit.displayValue || '',
        score: score !== null ? Math.round(score * 100) : null,
        impact: score < 0.5 ? 'critical' : 'warning',
        fix: perfFixInstructions[auditId] || 'Consultați documentația web.dev/performance pentru detalii.',
      })
    }

    return NextResponse.json({
      success: true,
      url,
      strategy,
      scores,
      cwv,
      seo_issues: seoIssues,
      perf_issues: perfIssues,
      fetch_time: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[PSI Audit] Error:', err)
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return NextResponse.json({ error: 'Timeout — analysis took too long. Please try again.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Internal error: ' + err.message }, { status: 500 })
  }
}