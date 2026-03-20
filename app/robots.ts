import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.hontrio.com'
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register', '/forgot-password', '/reset-password'],
        disallow: [
          '/dashboard',
          '/products',
          '/images',
          '/seo',
          '/risk',
          '/agent',
          '/credits',
          '/settings',
          '/support',
          '/admin',
          '/api/',
          '/onboarding',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
