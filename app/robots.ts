import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = 'https://hontrio.com'
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/blog',
          '/blog/',
          '/features',
          '/features/',
          '/pricing',
          '/roadmap',
          '/about',
          '/contact',
          '/careers',
          '/legal/',
        ],
        disallow: [
          '/dashboard',
          '/products',
          '/settings',
          '/support',
          '/admin',
          '/api/',
          '/onboarding',
          '/login',
          '/register',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
