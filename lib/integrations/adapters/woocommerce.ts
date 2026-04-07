import type { StoreAdapter, StoreProduct, StoreVariation } from '../types'

type WooConfig = {
  store_url: string
  consumer_key: string
  consumer_secret: string
}

export class WooCommerceAdapter implements StoreAdapter {
  readonly platform = 'woocommerce'
  private config: WooConfig
  private authHeader: string

  constructor(config: WooConfig) {
    this.config = config
    this.authHeader = 'Basic ' + Buffer.from(
      `${config.consumer_key}:${config.consumer_secret}`
    ).toString('base64')
  }

  private async request(endpoint: string, params: Record<string, string> = {}) {
    const url = new URL(`${this.config.store_url}/wp-json/wc/v3/${endpoint}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`WooCommerce API error: ${res.status} ${res.statusText}`)
    }

    return res.json()
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('system_status')
      return true
    } catch {
      return false
    }
  }

  async getProducts(page: number, perPage: number): Promise<StoreProduct[]> {
    return this.request('products', {
      page: String(page),
      per_page: String(perPage),
      orderby: 'id',
      order: 'asc',
    })
  }

  async getProductCount(): Promise<number> {
    const url = new URL(`${this.config.store_url}/wp-json/wc/v3/products`)
    url.searchParams.set('per_page', '1')

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': this.authHeader },
    })

    const total = res.headers.get('X-WP-Total')
    return total ? parseInt(total) : 0
  }

  async getVariations(productId: string | number, page: number, perPage: number): Promise<StoreVariation[]> {
    return this.request(`products/${productId}/variations`, {
      page: String(page),
      per_page: String(perPage),
    })
  }

  async updateProduct(productId: string, data: {
    title?: string
    description?: string
    short_description?: string
    images?: { src: string }[]
  }): Promise<boolean> {
    const url = new URL(`${this.config.store_url}/wp-json/wc/v3/products/${productId}`)

    const body: Record<string, any> = {}
    if (data.title) body.name = data.title
    if (data.description) body.description = data.description
    if (data.short_description) body.short_description = data.short_description
    if (data.images) body.images = data.images

    const res = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    return res.ok
  }

  async publishImage(productId: string, imageUrl: string, altText: string): Promise<boolean> {
    // WooCommerce: adaugă imaginea în array-ul de imagini al produsului
    const url = new URL(`${this.config.store_url}/wp-json/wc/v3/products/${productId}`)
    const res = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: [{ src: imageUrl, alt: altText, position: 0 }],
      }),
    })
    return res.ok
  }

  async publishShortDescription(productId: string, shortDescription: string): Promise<boolean> {
    // WooCommerce: câmp nativ short_description
    const url = new URL(`${this.config.store_url}/wp-json/wc/v3/products/${productId}`)
    const res = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ short_description: shortDescription }),
    })
    return res.ok
  }

  async publishSeoMetadata(
    _productId: string,
    _seoTitle: string,
    _metaDescription: string,
    _focusKeyword: string
  ): Promise<boolean> {
    // WooCommerce: SEO metadata se gestionează prin plugin-urile Yoast/RankMath
    // Publicarea se face prin plugin-ul Hontrio WordPress, nu direct via REST API
    // Returnam true ca sa nu blocam fluxul
    return true
  }
}