import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { calcCompetitorScore } from '@/lib/competitor/url-utils'

// Vercel Cron: runs daily at 06:00 UTC
// Secured with CRON_SECRET env var
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()

  // Fetch all active monitors due for a check
  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString() // 20h ago
  const { data: monitors, error } = await supabase
    .from('competitor_monitors')
    .select('*')
    .eq('is_active', true)
    .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
    .limit(50) // process max 50 per run to stay within timeout

  if (error || !monitors?.length) {
    return NextResponse.json({ processed: 0, message: 'No monitors due' })
  }

  let processed = 0
  let alertsCreated = 0

  for (const monitor of monitors) {
    try {
      // Fetch & analyze competitor page
      const html = await fetchHtml(monitor.competitor_url)
      if (!html) continue

      const analysis = await analyzeWithAI(html, monitor.competitor_url)
      const newScore = calcCompetitorScore(analysis)

      // Get last snapshot for comparison
      const { data: lastSnapshot } = await supabase
        .from('competitor_snapshots')
        .select('snapshot, seo_score')
        .eq('monitor_id', monitor.id)
        .order('captured_at', { ascending: false })
        .limit(1)
        .single()

      // Save new snapshot
      await supabase.from('competitor_snapshots').insert({
        monitor_id: monitor.id,
        user_id: monitor.user_id,
        competitor_url: monitor.competitor_url,
        snapshot: analysis,
        seo_score: newScore,
      })

      // Update monitor last_checked_at
      await supabase
        .from('competitor_monitors')
        .update({ last_checked_at: new Date().toISOString() })
        .eq('id', monitor.id)

      // Detect changes and create alerts
      if (lastSnapshot?.snapshot) {
        const prev = lastSnapshot.snapshot as any
        const alerts: any[] = []

        if (prev.title !== analysis.title && analysis.title) {
          alerts.push({
            alert_type: 'title_changed',
            field_changed: 'title',
            old_value: prev.title || '',
            new_value: analysis.title,
          })
        }
        if (prev.meta_description !== analysis.meta_description && analysis.meta_description) {
          alerts.push({
            alert_type: 'meta_changed',
            field_changed: 'meta_description',
            old_value: prev.meta_description || '',
            new_value: analysis.meta_description,
          })
        }

        const prevKws = (prev.focus_keywords || []).join(',')
        const newKws  = (analysis.focus_keywords || []).join(',')
        if (prevKws !== newKws) {
          alerts.push({
            alert_type: 'keywords_changed',
            field_changed: 'focus_keywords',
            old_value: prevKws,
            new_value: newKws,
          })
        }

        const scoreDiff = newScore - (lastSnapshot.seo_score || 0)
        if (Math.abs(scoreDiff) >= 10) {
          alerts.push({
            alert_type: scoreDiff > 0 ? 'score_rise' : 'score_drop',
            field_changed: 'seo_score',
            old_value: String(lastSnapshot.seo_score),
            new_value: String(newScore),
          })
        }

        if (alerts.length > 0) {
          const rows = alerts.map(a => ({
            ...a,
            monitor_id: monitor.id,
            user_id: monitor.user_id,
          }))
          await supabase.from('competitor_alerts').insert(rows)
          alertsCreated += rows.length
        }
      }

      processed++
    } catch (err) {
      console.error(`[Cron] Failed monitor ${monitor.id}:`, err)
    }
  }

  return NextResponse.json({
    success: true,
    processed,
    alertsCreated,
    timestamp: new Date().toISOString(),
  })
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch { return null }
}

async function analyzeWithAI(html: string, url: string): Promise<any> {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const h2s = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)].map(m => m[1]).slice(0, 5)
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 2000)

  const prompt = `Analizează această pagină competitor eCommerce și extrage date SEO.
Titlu: "${titleMatch?.[1]?.trim()}"
Meta: "${metaMatch?.[1]?.trim()}"
H1: "${h1Match?.[1]?.trim()}"
H2s: ${JSON.stringify(h2s)}
Text: "${bodyText.substring(0, 1000)}"

Răspunde STRICT JSON:
{"title":"...","meta_description":"...","h1":"...","headings":[...],"focus_keywords":[...],"content_length_estimate":400,"strengths":[...],"weaknesses":[...],"opportunities":[...]}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
    })
    const raw = completion.choices[0].message.content?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '{}'
    return JSON.parse(raw)
  } catch {
    return {
      title: titleMatch?.[1]?.trim() || '',
      meta_description: metaMatch?.[1]?.trim() || '',
      h1: h1Match?.[1]?.trim() || '',
      headings: h2s,
      focus_keywords: [],
      content_length_estimate: 0,
      strengths: [], weaknesses: [], opportunities: [],
    }
  }
}