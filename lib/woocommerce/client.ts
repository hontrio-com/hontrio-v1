type WooConfig = {
  store_url: string
  consumer_key: string
  consumer_secret: string
}

export class WooCommerceClient {
  private config: WooConfig
  private authHeader: string

  constructor(config: WooConfig) {
    this.config = config
    // Basic Authentication - funcționează pe toate magazinele WooCommerce
    this.authHeader = 'Basic ' + Buffer.from(
      `${config.consumer_key}:${config.consumer_secret}`
    ).toString('base64')
  }

  private async request(endpoint: string, params: Record<string, string> = {}) {
    const url = new URL(`${this.config.store_url}/wp-json/wc/v3/${endpoint}`)

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }

    console.log('WooCommerce request:', endpoint, 'page:', params.page || '1')

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const errorBody = await res.text()
      console.error('WooCommerce error body:', errorBody)
      throw new Error(`WooCommerce API error: ${res.status} ${res.statusText} - ${errorBody}`)
    }

    const data = await res.json()
    const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1')
    const total = parseInt(res.headers.get('x-wp-total') || '0')

    return { data, totalPages, total }
  }

  async getProducts(page: number = 1, perPage: number = 50) {
    return this.request('products', {
      page: page.toString(),
      per_page: perPage.toString(),
    })
  }

  async getProduct(id: string) {
    const { data } = await this.request(`products/${id}`)
    return data
  }

  async getVariations(productId: string, page: number = 1, perPage: number = 50) {
    return this.request(`products/${productId}/variations`, {
      page: page.toString(),
      per_page: perPage.toString(),
    })
  }

  async updateProduct(id: string, productData: Record<string, unknown>) {
    const url = new URL(`${this.config.store_url}/wp-json/wc/v3/products/${id}`)

    const res = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productData),
    })

    if (!res.ok) {
      throw new Error(`WooCommerce update error: ${res.status}`)
    }

    return res.json()
  }

  async uploadImage(productId: string, imageUrl: string) {
    return this.updateProduct(productId, {
      images: [{ src: imageUrl }],
    })
  }
}