'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ExternalLink, Eye, FileText, Pencil, Plus, Search, Star, Tag, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app/page-header'
import { Card } from '@/components/app/surface'
import { StatCard } from '@/components/app/kpi'
import { Badge, type Tone } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Input, Select } from '@/components/app/input'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { Pagination } from '@/components/app/pagination'
import { ConfirmDialog } from '@/components/app/dialog'
import { EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useFormats } from '@/components/app/formats'
import { useDebounced } from '@/components/app/time'

// =============================================
// Blogul: articolele, cu căutare și filtre, de unde se editează, se scot în
// față sau se șterg.
// =============================================

type BlogCategory = { id: string; name: string; slug: string; color: string }
type RawPost = {
  id: string; title: string; slug: string; excerpt?: string; cover_image_url?: string
  status: 'draft' | 'published' | 'archived'; featured: boolean; views_count: number; published_at?: string
  locale?: string; blog_categories?: BlogCategory | null
}
type Stats = { total: number; published: number; drafts: number; views: number }
type Page = { key: string; posts: RawPost[]; pages: number }

const STATUS_TONE: Record<RawPost['status'], Tone> = { draft: 'outline', published: 'green', archived: 'amber' }

const summarize = (posts: RawPost[], total: number): Stats => ({
  total,
  published: posts.filter(p => p.status === 'published').length,
  drafts: posts.filter(p => p.status === 'draft').length,
  views: posts.reduce((sum, p) => sum + (p.views_count || 0), 0),
})

export default function AdminBlogPage() {
  const { t } = useT()
  const f = useFormats('USD')

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)

  // O pagină de articole, cu filtrele ei: cât nu vine pagina cerută, se încarcă
  const key = JSON.stringify({ q, status, category, page })
  const [list, setList] = useState<Page | null>(null)
  const loading = list?.key !== key
  const posts = list?.posts ?? []

  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, drafts: 0, views: 0 })
  const [deleteTarget, setDeleteTarget] = useState<RawPost | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch('/api/blog/categories').then(r => r.json()).then(d => setCategories(d.categories ?? [])).catch(() => {})
    fetch('/api/blog/posts?limit=1000').then(r => r.json()).then(d => setStats(summarize(d.posts ?? [], d.total ?? 0))).catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    const params = new URLSearchParams({ page: String(page), limit: '15' })
    if (status !== 'all') params.set('status', status)
    if (category) params.set('category', category)
    if (q) params.set('q', q)
    fetch(`/api/blog/posts?${params}`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(d => { if (alive) setList({ key, posts: d?.posts ?? [], pages: d?.totalPages ?? 1 }) })
    return () => { alive = false }
  }, [key, page, status, category, q])

  const setPosts = (update: (posts: RawPost[]) => RawPost[]) => setList(l => l && { ...l, posts: update(l.posts) })

  async function toggleFeatured(post: RawPost) {
    const flip = (featured: boolean) => setPosts(ps => ps.map(p => p.id === post.id ? { ...p, featured } : p))
    flip(!post.featured)
    try {
      const res = await fetch(`/api/blog/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: !post.featured }),
      })
      if (!res.ok) flip(post.featured)
    } catch {
      flip(post.featured)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/blog/posts/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error(t('admin.network_error_retry')); return }
      setPosts(ps => ps.filter(p => p.id !== deleteTarget.id))
      setStats(s => ({
        total: s.total - 1,
        published: s.published - (deleteTarget.status === 'published' ? 1 : 0),
        drafts: s.drafts - (deleteTarget.status === 'draft' ? 1 : 0),
        views: s.views - (deleteTarget.views_count || 0),
      }))
      setDeleteTarget(null)
    } catch {
      toast.error(t('admin.network_error_retry'))
    } finally {
      setDeleting(false)
    }
  }

  const filter = (apply: () => void) => { apply(); setPage(1) }

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.blog_title')}
        actions={(
          <>
            <Button asChild><Link href="/admin/blog/categories"><Tag />{t('admin.blog_categories')}</Link></Button>
            <Button asChild variant="primary"><Link href="/admin/blog/new"><Plus />{t('admin.blog_new_post')}</Link></Button>
          </>
        )} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('admin.blog_total_posts')} value={f.int.format(stats.total)} />
        <StatCard label={t('admin.blog_published_count')} value={f.int.format(stats.published)} />
        <StatCard label={t('admin.blog_drafts')} value={f.int.format(stats.drafts)} />
        <StatCard label={t('admin.blog_total_views')} value={f.int.format(stats.views)} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input icon={<Search />} wrapperClassName="flex-1" value={search} onChange={e => filter(() => setSearch(e.target.value))} placeholder={t('admin.blog_search_placeholder')} />
        <Select value={status} onChange={e => filter(() => setStatus(e.target.value))} wrapperClassName="sm:w-40" aria-label={t('admin.status')}>
          <option value="all">{t('common.all')}</option>
          <option value="draft">{t('admin.blog_status_draft')}</option>
          <option value="published">{t('admin.blog_status_published')}</option>
          <option value="archived">{t('admin.blog_status_archived')}</option>
        </Select>
        <Select value={category} onChange={e => filter(() => setCategory(e.target.value))} wrapperClassName="sm:w-48" aria-label={t('common.category')}>
          <option value="">{t('common.all_categories')}</option>
          {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading && !list ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : posts.length === 0 ? (
          <EmptyState icon={<FileText />} title={t('admin.blog_empty')} description={t('admin.blog_empty_desc')}
            action={<Button asChild variant="primary"><Link href="/admin/blog/new"><Plus />{t('admin.blog_create_post')}</Link></Button>} />
        ) : (
          <>
            <Table className={cn(loading && 'opacity-60')}>
              <thead>
                <tr>
                  <Th>{t('admin.blog_col_post')}</Th>
                  <Th className="hidden md:table-cell">{t('common.category')}</Th>
                  <Th>{t('admin.status')}</Th>
                  <Th className="hidden lg:table-cell">{t('admin.date')}</Th>
                  <Th className="hidden xl:table-cell" align="right">{t('admin.blog_col_views')}</Th>
                  <Th align="right">{t('admin.actions')}</Th>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <Tr key={post.id}>
                    <Td className="max-w-[340px]">
                      <div className="flex items-center gap-3">
                        {post.cover_image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={post.cover_image_url} alt="" className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-neutral-200" />
                          : <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400"><FileText className="size-4" /></span>}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-900">{post.title}</p>
                          {post.excerpt && <p className="truncate text-[12px] text-neutral-500">{post.excerpt}</p>}
                        </div>
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell">
                      {post.blog_categories
                        ? <Badge><span className="size-2 rounded-full" style={{ backgroundColor: post.blog_categories.color || '#a3a3a3' }} />{post.blog_categories.name}</Badge>
                        : <span className="text-neutral-300">—</span>}
                    </Td>
                    <Td><Badge tone={STATUS_TONE[post.status]} dot>{t(`admin.blog_status_${post.status}`)}</Badge></Td>
                    <Td className="hidden whitespace-nowrap text-neutral-500 lg:table-cell">
                      {post.published_at ? f.date.format(new Date(post.published_at)) : '—'}
                      <span className="ml-2 text-[11px] font-medium text-neutral-400">{post.locale === 'en' ? 'EN' : 'RO'}</span>
                    </Td>
                    <Td className="hidden text-neutral-500 xl:table-cell" align="right">
                      <span className="inline-flex items-center gap-1"><Eye className="size-3.5 text-neutral-400" />{f.int.format(post.views_count)}</span>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button size="icon" variant="ghost" onClick={() => toggleFeatured(post)} title={post.featured ? t('admin.blog_unfeature') : t('admin.blog_feature')} aria-label={post.featured ? t('admin.blog_unfeature') : t('admin.blog_feature')} aria-pressed={post.featured}>
                          <Star className={cn(post.featured ? 'fill-neutral-900 text-neutral-900' : 'text-neutral-300')} />
                        </Button>
                        <Button asChild size="icon" variant="ghost" title={t('common.edit')} aria-label={t('common.edit')}>
                          <Link href={`/admin/blog/${post.id}/edit`}><Pencil /></Link>
                        </Button>
                        <Button asChild size="icon" variant="ghost" title={t('admin.blog_open_new_tab')} aria-label={t('admin.blog_open_new_tab')}>
                          <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink /></a>
                        </Button>
                        <Button size="icon" variant="ghost" className="hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteTarget(post)} title={t('common.delete')} aria-label={t('common.delete')}>
                          <Trash2 />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pages={list?.pages ?? 1} onChange={setPage} />
          </>
        )}
      </Card>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null) }} title={t('admin.blog_delete_title')}
        description={deleteTarget ? `${t('admin.quoted', { text: deleteTarget.title })} ${t('admin.irreversible')}` : undefined}
        confirmLabel={deleting ? t('admin.deleting') : t('admin.delete_permanently')} loading={deleting} onConfirm={handleDelete} />
    </FadeIn>
  )
}
