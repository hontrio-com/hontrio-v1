import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = 'https://hontrio.com'
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/legal/'],
        disallow: [
          '/dashboard',
          '/campaigns',
          '/products',
          '/reports',
          '/recommendations',
          '/settings',
          '/support',
          '/admin',
          '/api/',
          '/onboarding',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/verify-email',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
