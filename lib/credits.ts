// ─── Centralized credit costs — single source of truth ──────────────────────
// Folosit de toate rutele de API care consumă credite

export const IMAGE_STYLE_COSTS: Record<string, number> = {
  white_bg: 6,
  lifestyle: 7,
  premium_dark: 7,
  industrial: 7,
  seasonal: 8,
  manual: 7,
}

export const CREDIT_COSTS = {
  // SEO
  seo_title: 1,
  seo_meta: 1,
  seo_short_description: 1,
  seo_long_description: 2,
  seo_all_sections: 3,
  seo_bulk_per_product: 3,

  // Images
  image_white_bg: 6,
  image_lifestyle: 7,
  image_premium_dark: 7,
  image_industrial: 7,
  image_seasonal: 8,
  image_manual: 7,

  // Agent
  product_intelligence: 3,  // per product

  // Text generation per section
  text_title: 1,
  text_meta_description: 1,
  text_short_description: 1,
  text_long_description: 2,
  text_benefits: 1,
  text_all: 3,
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
