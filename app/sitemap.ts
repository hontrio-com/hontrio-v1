import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = 'https://hontrio.com'

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'monthly', priority: 1.0 },
    { url: `${siteUrl}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${siteUrl}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${siteUrl}/features`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${siteUrl}/features/ai-images`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/features/seo`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/features/ai-agent`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/features/risk-shield`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/roadmap`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/careers`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/legal/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/legal/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/legal/cookies`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]

  try {
    const supabase = createAdminClient()

    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })

    const { data: categories } = await supabase
      .from('blog_categories')
      .select('slug')

    const { data: tags } = await supabase
      .from('blog_tags')
      .select('slug')

    const blogPosts: MetadataRoute.Sitemap = (posts || []).map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updated_at),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    const categoryPages: MetadataRoute.Sitemap = (categories || []).map((cat) => ({
      url: `${siteUrl}/blog/category/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    }))

    const tagPages: MetadataRoute.Sitemap = (tags || []).map((tag) => ({
      url: `${siteUrl}/blog/tag/${tag.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    }))

    return [...staticPages, ...blogPosts, ...categoryPages, ...tagPages]
  } catch {
    return staticPages
  }
}
