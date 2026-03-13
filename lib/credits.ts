// ─── Centralized credit costs — single source of truth ──────────────────────
// Folosit de toate rutele de API care consumă credite

export const IMAGE_STYLE_COSTS: Record<string, number> = {
  white_bg: 2,
  lifestyle: 3,
  premium_dark: 3,
  industrial: 3,
  seasonal: 4,
  manual: 3,
}

export const CREDIT_COSTS = {
  // SEO
  seo_title: 1,
  seo_meta: 1,
  seo_short_description: 1,
  seo_long_description: 2,
  seo_all_sections: 5,
  seo_bulk_per_product: 5,

  // Images
  image_white_bg: 2,
  image_lifestyle: 3,
  image_premium_dark: 3,
  image_industrial: 3,
  image_seasonal: 4,
  image_manual: 3,

  // Agent
  product_intelligence: 2,  // per produs

  // Text generation per section
  text_title: 1,
  text_meta_description: 1,
  text_short_description: 1,
  text_long_description: 2,
  text_benefits: 1,
  text_all: 5,
} as const

export type CreditOperation = keyof typeof CREDIT_COSTS

// Helper: get image cost by style
export function getImageCost(style: string): number {
  return IMAGE_STYLE_COSTS[style] || 3
}

// Helper: atomic credit deduction via Supabase
// Returns new balance or null if insufficient
export async function deductCredits(
  supabase: any,
  userId: string,
  amount: number,
  description: string,
  referenceType?: string,
  referenceId?: string,
): Promise<{ success: boolean; newBalance: number }> {
  // Atomic: UPDATE ... WHERE credits >= amount
  const { data, error } = await supabase
    .from('users')
    .select('credits')
    .eq('id', userId)
    .single()

  if (error || !data || data.credits < amount) {
    return { success: false, newBalance: data?.credits ?? 0 }
  }

  const newBalance = data.credits - amount
  await supabase.from('users').update({ credits: newBalance }).eq('id', userId)

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'usage',
    amount: -amount,
    balance_after: newBalance,
    description,
    reference_type: referenceType || null,
    reference_id: referenceId || null,
  })

  return { success: true, newBalance }
}

// Helper: refund credits
export async function refundCredits(
  supabase: any,
  userId: string,
  amount: number,
  description: string,
  referenceType?: string,
  referenceId?: string,
): Promise<number> {
  const { data } = await supabase
    .from('users')
    .select('credits')
    .eq('id', userId)
    .single()

  const newBalance = (data?.credits ?? 0) + amount
  await supabase.from('users').update({ credits: newBalance }).eq('id', userId)

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'refund',
    amount,
    balance_after: newBalance,
    description,
    reference_type: referenceType || null,
    reference_id: referenceId || null,
  })

  return newBalance
}
