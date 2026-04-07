import type { StoreAdapter, StoreProduct, StoreVariation } from '../types'

// =============================================
// SHOPIFY ADAPTER — Shopify Admin REST API 2024-01
// =============================================

type ShopifyConfig = {
  store_url: string    // mystore.myshopify.com (fără https://)
  access_token: string // OAuth access token permanent
}

export class ShopifyAdapter implements StoreAdapter {
  readonly platform = 'shopify'
  private shop: string
  private accessToken: string
  private baseUrl: string

  constructor(config: ShopifyConfig) {
    // Normalizează store_url: elimină https:// și slash-ul final
    this.shop = config.store_url
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
    this.accessToken = config.access_token
    this.baseUrl = `https://${this.shop}/admin/api/2024-01`
  }

  // ─── Retry cu exponential backoff pentru rate limiting Shopify ──────────────
  // Shopify: 2 req/s pe Basic, 4 req/s pe planuri superioare
  private async requestWithRetry<T = any>(
    path: string,
    options: RequestInit = {},
    retries = 3
  ): Promise<T> {
    const url = `${this.baseUrl}/${path}`

    for (let attempt = 0; attempt <= retries; attempt++) {
      let res: Response

      try {
        res = await fetch(url, {
          ...options,
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json',
            ...((options.headers as Record<string, string>) || {}),
          },
          signal: AbortSignal.timeout(20000),
        })
      } catch (networkErr: any) {
        if (attempt < retries) {
          await this.sleep(1000 * (attempt + 1))
          continue
        }
        throw new Error(`Shopify network error: ${networkErr.message}`)
      }

      if (res.status === 429) {
        // Rate limit — respectă Retry-After header sau aşteaptă exponential
        const retryAfter = res.headers.get('retry-after')
        const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 1000 * (attempt + 1)
        if (attempt < retries) {
          await this.sleep(Math.min(waitMs, 10000))
          continue
        }
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Shopify API error: ${res.status} ${res.statusText} — ${body.substring(0, 200)}`)
      }

      return res.json()
    }

    throw new Error(`Shopify request failed după ${retries} reîncercări: ${path}`)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // ─── Metode principale ────────────────────────────────────────────────────

  async testConnection(): Promise<boolean> {
    try {
      await this.requestWithRetry('shop.json')
      return true
    } catch {
      return false
    }
  }

  async getProducts(page: number, perPage: number): Promise<StoreProduct[]> {
    const data = await this.requestWithRetry<{ products: any[] }>(
      `products.json?limit=${perPage}&page=${page}&status=any`
    )
    return (data.products || []).map(p => this.mapProduct(p))
  }

  async getProductCount(): Promise<number> {
    const data = await this.requestWithRetry<{ count: number }>('products/count.json?status=any')
    return data.count || 0
  }

  async getVariations(
    productId: string | number,
    page: number,
    perPage: number
  ): Promise<StoreVariation[]> {
    const data = await this.requestWithRetry<{ variants: any[] }>(
      `products/${productId}/variants.json?limit=${perPage}&page=${page}`
    )
    return (data.variants || []).map((v: any): StoreVariation => ({
      id: v.id,
      price: v.price || '0',
      description: '',
      image: null,
      attributes: [
        v.option1 ? { name: 'Optiune 1', option: v.option1 } : null,
        v.option2 ? { name: 'Optiune 2', option: v.option2 } : null,
        v.option3 ? { name: 'Optiune 3', option: v.option3 } : null,
      ].filter((a): a is { name: string; option: string } => a !== null && !!a.option),
    }))
  }

  async updateProduct(
    productId: string,
    data: {
      title?: string
      description?: string
      short_description?: string
      images?: { src: string }[]
    }
  ): Promise<boolean> {
    const body: Record<string, any> = { id: parseInt(productId) }
    if (data.title) body.title = data.title
    if (data.description) body.body_html = data.description
    if (data.images) body.images = data.images.map(img => ({ src: img.src }))

    try {
      await this.requestWithRetry(`products/${productId}.json`, {
        method: 'PUT',
        body: JSON.stringify({ product: body }),
      })
      return true
    } catch {
      return false
    }
  }

  async publishImage(productId: string, imageUrl: string, altText: string): Promise<boolean> {
    // Shopify: POST /products/{id}/images.json
    // Înlocuim imaginea principală (position: 1) dacă există, altfel adăugăm nouă
    try {
      // Obținem imaginile existente pentru a putea înlocui position: 1
      const imagesData = await this.requestWithRetry<{ images: any[] }>(
        `products/${productId}/images.json`
      )
      const existingImages = imagesData.images || []
      const mainImage = existingImages.find((img: any) => img.position === 1)

      if (mainImage) {
        // PUT pentru a înlocui imaginea existentă la position: 1
        await this.requestWithRetry(`products/${productId}/images/${mainImage.id}.json`, {
          method: 'PUT',
          body: JSON.stringify({
            image: { id: mainImage.id, src: imageUrl, alt: altText },
          }),
        })
      } else {
        // POST — adaugă imagine nouă la position: 1
        await this.requestWithRetry(`products/${productId}/images.json`, {
          method: 'POST',
          body: JSON.stringify({
            image: { src: imageUrl, alt: altText, position: 1 },
          }),
        })
      }
      return true
    } catch {
      return false
    }
  }

  async publishShortDescription(productId: string, shortDescription: string): Promise<boolean> {
    // Shopify nu are câmp nativ pentru short_description
    // Salvăm ca metafield custom
    try {
      await this.requestWithRetry(`products/${productId}/metafields.json`, {
        method: 'POST',
        body: JSON.stringify({
          metafield: {
            namespace: 'custom',
            key: 'short_description',
            value: shortDescription,
            type: 'multi_line_text_field',
          },
        }),
      })
      return true
    } catch {
      return false
    }
  }

  async publishSeoMetadata(
    productId: string,
    seoTitle: string,
    metaDescription: string,
    focusKeyword: string
  ): Promise<boolean> {
    // Shopify SEO: metafields în namespace "seo"
    const metafields = [
      seoTitle
        ? { namespace: 'seo', key: 'title', value: seoTitle, type: 'single_line_text_field' }
        : null,
      metaDescription
        ? { namespace: 'seo', key: 'description', value: metaDescription, type: 'single_line_text_field' }
        : null,
      focusKeyword
        ? { namespace: 'seo', key: 'focus_keyword', value: focusKeyword, type: 'single_line_text_field' }
        : null,
    ].filter(Boolean)

    let allOk = true
    for (const mf of metafields) {
      try {
        await this.requestWithRetry(`products/${productId}/metafields.json`, {
          method: 'POST',
          body: JSON.stringify({ metafield: mf }),
        })
      } catch {
        allOk = false
      }
    }
    return allOk
  }

  // ─── Mapare produs Shopify → StoreProduct ─────────────────────────────────
  private mapProduct(product: any): StoreProduct {
    return {
      id: product.id.toString(),
      name: product.title || '',
      description: product.body_html || '',
      price: product.variants?.[0]?.price || '0',
      images: (product.images || []).map((img: any) => ({ src: img.src })),
      categories: product.product_type ? [{ name: product.product_type }] : [],
      type: 'simple' as const,
      status: product.status || 'active',
    }
  }
}
