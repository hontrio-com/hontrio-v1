export type User = {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  role: 'user' | 'admin'
  credits: number
  plan: 'free' | 'starter' | 'pro' | 'enterprise'
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export type Store = {
  id: string
  user_id: string
  platform: 'woocommerce' | 'shopify' | 'gomag' | 'merchantpro' | 'emag'
  store_url: string
  api_key: string | null
  api_secret: string | null
  webhook_secret: string | null
  sync_status: 'pending' | 'active' | 'paused' | 'error'
  last_sync_at: string | null
  products_count: number
  created_at: string
}

export type Product = {
  id: string
  store_id: string
  user_id: string
  external_id: string | null
  original_title: string | null
  optimized_title: string | null
  original_description: string | null
  original_short_description: string | null   // short_description din WooCommerce
  optimized_short_description: string | null
  optimized_long_description: string | null
  benefits: string[] | null
  specifications: Record<string, string> | null
  meta_description: string | null             // initial: din Yoast/RankMath la sync; ulterior: optimizat Hontrio
  focus_keyword: string | null                // initial: din Yoast la sync; ulterior: optimizat Hontrio
  secondary_keywords: string[] | null
  seo_score: number                           // calculat real la sync si la fiecare save
  seo_suggestions: string[] | null
  original_images: string[] | null
  thumbnail_url: string | null                // enriched la fetch, nu in DB
  status: 'draft' | 'optimized' | 'published'
  category: string | null
  price: number | null
  parent_id: string | null
  variant_name: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export type GeneratedImage = {
  id: string
  product_id: string
  user_id: string
  style: 'white_bg' | 'lifestyle' | 'premium_dark' | 'industrial' | 'seasonal' | 'auto'
  prompt: string | null
  original_image_url: string | null
  generated_image_url: string | null
  quality_score: number
  quality_checks: {
    shape_preserved: boolean
    logo_correct: boolean
    color_consistent: boolean
    no_artifacts: boolean
  } | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'published'
  credits_used: number
  processing_time_ms: number | null
  created_at: string
}

export type CreditTransaction = {
  id: string
  user_id: string
  type: 'purchase' | 'usage' | 'refund' | 'bonus'
  amount: number
  balance_after: number
  description: string | null
  reference_type: string | null
  reference_id: string | null
  created_at: string
}

export type GenerationJob = {
  id: string
  user_id: string
  product_id: string | null
  type: 'image' | 'text' | 'full_product'
  status: 'queued' | 'processing' | 'completed' | 'failed'
  input_data: Record<string, unknown> | null
  output_data: Record<string, unknown> | null
  error_message: string | null
  retry_count: number
  inngest_event_id: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}