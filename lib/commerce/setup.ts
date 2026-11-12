import { FEED_PLUGINS, TRACKING_PLUGINS } from '@/lib/woocommerce/mapping'
import type { GlaConnection } from '@/lib/woocommerce/types'

// =============================================
// Pregătirea magazinului pentru reclame, spusă la fel pentru orice platformă:
// Merchant Center, conversia de cumpărare, unde se repară ce lipsește.
//
// Edinio știe sigur (are integrările lui). La WooCommerce, Hontrio vede doar
// pluginurile: Google for WooCommerce își spune legăturile, celelalte doar că
// sunt instalate. Shopify nu spune aplicațiilor ce canale de vânzare are
// magazinul (aplicația Google & YouTube). Ce nu putem verifica e „de
// verificat", nu „gata".
// =============================================

export type SetupStatus = 'ok' | 'missing' | 'unverified'

export type StoreSetup = {
  platform: 'edinio' | 'woocommerce' | 'shopify'
  platformName: string
  merchant: { status: SetupStatus; via: string | null; href: string }
  conversion: { status: SetupStatus; via: string | null; href: string }
  /** Unde merge feedul: țara și limba campaniei. */
  feed: { country: string | null; language: string | null }
  /** Starea ofertelor la Google vine de la platformă (Edinio); altfel n-o știm încă. */
  googleStatusKnown: boolean
  /** Unde se editează produsele, în panoul magazinului. */
  productsHref: string
}

type StoreLike = {
  platform: string
  store_url: string | null
  country: string | null
  language: string | null
  platform_data: unknown
}

type EdinioData = {
  google_merchant?: { conectat?: boolean; tara?: string | null; limba?: string | null } | null
  google_ads?: { conversie_id?: string | null } | null
}

type WooData = {
  feed_plugins?: string[] | null
  tracking_plugins?: string[] | null
  google_for_woocommerce?: { merchant: GlaConnection | null; ads: GlaConnection | null } | null
}

const edinioBase = () => (process.env.EDINIO_BASE_URL || 'https://www.edinio.com').replace(/\/+$/, '')
/** Aplicația gratuită Google & YouTube: trimite produsele la Merchant Center și pune conversia. */
const GOOGLE_APP = 'https://apps.shopify.com/google'

export function storeSetup(store: StoreLike): StoreSetup | null {
  if (store.platform === 'edinio') {
    const pd = (store.platform_data ?? {}) as EdinioData
    const base = edinioBase()
    return {
      platform: 'edinio',
      platformName: 'Edinio',
      merchant: { status: pd.google_merchant?.conectat ? 'ok' : 'missing', via: 'Edinio', href: `${base}/dashboard/features/google-merchant` },
      conversion: { status: pd.google_ads?.conversie_id ? 'ok' : 'missing', via: 'Edinio', href: `${base}/dashboard/features/google-ads` },
      feed: {
        country: pd.google_merchant?.tara || store.country,
        language: pd.google_merchant?.limba || store.language,
      },
      googleStatusKnown: true,
      productsHref: `${base}/dashboard/products`,
    }
  }

  if (store.platform === 'woocommerce') {
    const pd = (store.platform_data ?? {}) as WooData
    const admin = `${(store.store_url ?? '').replace(/\/+$/, '')}/wp-admin`
    const gla = pd.google_for_woocommerce ?? null
    const glaPage = `${admin}/admin.php?page=wc-admin&path=%2Fgoogle%2Fdashboard`
    const installGla = `${admin}/plugin-install.php?s=Google%20for%20WooCommerce&tab=search&type=term`
    const feedOther = (pd.feed_plugins ?? []).find(p => p !== 'google-listings-and-ads')
    const trackingOther = (pd.tracking_plugins ?? []).find(p => p !== 'google-listings-and-ads')

    // Pluginurile necitite (încă nesincronizat, sau cheia nu vede starea sistemului): nu știm
    const pluginsKnown = Array.isArray(pd.feed_plugins) && Array.isArray(pd.tracking_plugins)

    // Google for WooCommerce își spune legătura; când n-a răspuns, e doar instalat
    const merchant: StoreSetup['merchant'] = gla
      ? { status: gla.merchant ? (gla.merchant.connected ? 'ok' : 'missing') : 'unverified', via: FEED_PLUGINS['google-listings-and-ads'], href: glaPage }
      : feedOther ? { status: 'unverified', via: FEED_PLUGINS[feedOther], href: `${admin}/plugins.php` }
      : { status: pluginsKnown ? 'missing' : 'unverified', via: null, href: installGla }
    const conversion: StoreSetup['conversion'] = gla?.ads?.connected
      ? { status: 'ok', via: TRACKING_PLUGINS['google-listings-and-ads'], href: glaPage }
      : trackingOther ? { status: 'unverified', via: TRACKING_PLUGINS[trackingOther], href: `${admin}/plugins.php` }
      : gla ? { status: gla.ads ? 'missing' : 'unverified', via: TRACKING_PLUGINS['google-listings-and-ads'], href: glaPage }
      : { status: pluginsKnown ? 'missing' : 'unverified', via: null, href: installGla }

    return {
      platform: 'woocommerce',
      platformName: 'WooCommerce',
      merchant,
      conversion,
      feed: { country: store.country, language: store.language },
      googleStatusKnown: false,
      productsHref: `${admin}/edit.php?post_type=product`,
    }
  }

  if (store.platform === 'shopify') {
    const shop = (store.store_url ?? '').replace(/\/+$/, '')
    const admin = `${/^https?:\/\//.test(shop) ? shop : `https://${shop}`}/admin`
    // Shopify nu spune aplicațiilor ce canale are magazinul: Google & YouTube (feedul și
    // conversia) se verifică la lansare, din contul Google
    const googleApp = { status: 'unverified' as const, via: null, href: GOOGLE_APP }
    return {
      platform: 'shopify',
      platformName: 'Shopify',
      merchant: googleApp,
      conversion: googleApp,
      feed: { country: store.country, language: store.language },
      googleStatusKnown: false,
      productsHref: `${admin}/products`,
    }
  }

  return null
}
