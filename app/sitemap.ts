import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = 'https://hontrio.com'
  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'monthly', priority: 1.0 },
    { url: `${siteUrl}/legal/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/legal/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/legal/cookies`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]
}
