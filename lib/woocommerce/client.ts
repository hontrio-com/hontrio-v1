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
  // Stoc live pentru un produs după external_id
  async getStockStatus(productId: string) {
    const { data } = await this.request(`products/${productId}`)
    return {
      id: data.id,
      name: data.name,
      stock_status: data.stock_status,           // 'instock' | 'outofstock' | 'onbackorder'
      stock_quantity: data.stock_quantity ?? null,
      manage_stock: data.manage_stock,
      low_stock_amount: data.low_stock_amount ?? null,
    }
  }

  // Stoc pentru mai multe produse dintr-o dată (batch)
  async getStockBatch(productIds: string[]) {
    const results = await Promise.allSettled(
      productIds.map(id => this.getStockStatus(id))
    )
    return results.map((r, i) => ({
      id: productIds[i],
      ...(r.status === 'fulfilled' ? r.value : { stock_status: 'unknown', error: true }),
    }))
  }

  // Comenzi după număr de comandă sau ID
  async getOrder(orderId: string) {
    const { data } = await this.request(`orders/${orderId}`)
    return data
  }

  // Comenzi după email client
  async getOrdersByEmail(email: string, limit = 5) {
    const { data } = await this.request('orders', {
      search: email,
      per_page: limit.toString(),
      orderby: 'date',
      order: 'desc',
    })
    return data
  }

  // Caută comenzi după număr (billing phone sau order number)
  async searchOrders(query: string, limit = 3) {
    const { data } = await this.request('orders', {
      search: query,
      per_page: limit.toString(),
      orderby: 'date',
      order: 'desc',
    })
    return data
  }