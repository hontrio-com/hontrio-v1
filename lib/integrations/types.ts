// =============================================
// GENERIC STORE INTEGRATION INTERFACE
// All eCommerce platform adapters must implement this
// =============================================

export type StoreProduct = {
  id: string
  name: string
  description: string
  price: string
  images: { src: string }[]
  categories: { name: string }[]
  type: 'simple' | 'variable' | 'grouped' | 'external'
  status: string
}

export type StoreVariation = {
  id: number
  price: string
  description: string
  image: { src: string } | null
  attributes: { name: string; option: string }[]
}

export type SyncProgress = {
  phase: 'downloading' | 'saving'
  current: number
  total: number
  message?: string
}

export interface StoreAdapter {
  // Platform identifier
  readonly platform: string

  // Connection
  testConnection(): Promise<boolean>

  // Products
  getProducts(page: number, perPage: number): Promise<StoreProduct[]>
  getProductCount(): Promise<number>

  // Variations
  getVariations(productId: string | number, page: number, perPage: number): Promise<StoreVariation[]>

  // Publishing (push optimized content back to store)
  updateProduct(productId: string, data: {
    title?: string
    description?: string
    short_description?: string
    images?: { src: string }[]
  }): Promise<boolean>

  // Publică o imagine generată de AI în magazin
  publishImage(productId: string, imageUrl: string, altText: string): Promise<boolean>

  // Publică descrierea scurtă (WooCommerce nativ, Shopify prin metafield)
  publishShortDescription(productId: string, shortDescription: string): Promise<boolean>

  // Publică metadate SEO (titlu SEO, meta description, focus keyword)
  publishSeoMetadata(
    productId: string,
    seoTitle: string,
    metaDescription: string,
    focusKeyword: string
  ): Promise<boolean>
}

// =============================================
// ADAPTER REGISTRY
// Register new adapters here when implementing
// =============================================

import { WooCommerceAdapter } from './adapters/woocommerce'
import { ShopifyAdapter } from './adapters/shopify'

const adapters: Record<string, new (config: any) => StoreAdapter> = {
  woocommerce: WooCommerceAdapter,
  shopify: ShopifyAdapter,
  // gomag: GomagAdapter,          // TODO: Future
  // merchantpro: MerchantProAdapter, // TODO: Future
  // opencart: OpencartAdapter,    // TODO: Future
}

export function createAdapter(platform: string, config: any): StoreAdapter {
  const AdapterClass = adapters[platform]
  if (!AdapterClass) {
    throw new Error(`Platform "${platform}" is not supported yet. Available: ${Object.keys(adapters).join(', ')}`)
  }
  return new AdapterClass(config)
}

export function getSupportedPlatforms(): string[] {
  return Object.keys(adapters)
}