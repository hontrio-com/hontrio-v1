import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const supabase = createAdminClient()

    // Numara generarile
    const { count: imageCount } = await supabase
      .from('generated_images')
      .select('*', { count: 'exact', head: true })

    const { data: textTransactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('type', 'usage')
      .eq('reference_type', 'text_generation')

    const { data: allUsageTransactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('type', 'usage')
      .order('created_at', { ascending: false })
      .limit(50)

    const totalCreditsUsed = (allUsageTransactions || []).reduce(
      (sum: number, t: any) => sum + Math.abs(t.amount), 0
    )

    const textGenerations = textTransactions?.length || 0

    // Costuri estimate (approximate)
    // KIE: ~$0.12 per imagine
    // OpenAI GPT-4o-mini: ~$0.01 per generare text
    const estimatedImageCost = (imageCount || 0) * 0.12
    const estimatedTextCost = textGenerations * 0.01

    return NextResponse.json({
      totalImageGenerations: imageCount || 0,
      totalTextGenerations: textGenerations,
      estimatedImageCost,
      estimatedTextCost,
      totalCreditsUsed,
      transactions: allUsageTransactions || [],
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}