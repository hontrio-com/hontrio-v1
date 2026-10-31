'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, ChevronDown, Eye, Globe, ImageIcon, Save, Tag, Upload, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { LOCALE_NAMES } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app/page-header'
import { Card } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Button, textActionStyles } from '@/components/app/button'
import { Input, Select, Switch, Textarea, inputStyles } from '@/components/app/input'
import { Segmented } from '@/components/app/tabs'
import { Callout, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useDebounced } from '@/components/app/time'
import { slugify } from '@/components/admin/blog'

// =============================================
// Editorul unui articol de blog: același pentru unul nou și pentru unul
// existent. Ciorna existentă se salvează singură la 30 de secunde după ultima
// modificare a conținutului. Timpul de citire îl calculează serverul.
// =============================================

type BlogCategory = { id: string; name: string; slug: string; color: string }
type BlogTag = { id: string; name: string; slug: string }
type PostStatus = 'draft' | 'published' | 'archived'

type Form = {
  title: string; excerpt: string; content: string; slug: string; status: PostStatus
  publishedAt: string; locale: 'ro' | 'en'; featured: boolean; categoryId: string; tags: BlogTag[]
  coverUrl: string; coverAlt: string; seoTitle: string; seoDesc: string; seoOgImage: string; seoKeywords: string
}

const minuteNow = () => {
  const now = new Date()
  now.setSeconds(0, 0)
  return now.toISOString().slice(0, 16)
}

const EMPTY: Omit<Form, 'publishedAt'> = {
  title: '', excerpt: '', content: '', slug: '', status: 'draft', locale: 'ro', featured: false, categoryId: '', tags: [],
  coverUrl: '', coverAlt: '', seoTitle: '', seoDesc: '', seoOgImage: '', seoKeywords: '',
}

const estimateReadTime = (html: string) => Math.max(1, Math.ceil(html.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length / 200))

function Label({ htmlFor, children, aside }: { htmlFor?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-neutral-700">{children}</label>
      {aside}
    </div>
  )
}

function CharCount({ current, warn, max }: { current: number; warn: number; max: number }) {
  return <span className={cn('text-[12px] tabular-nums', current > max ? 'text-red-600' : current > warn ? 'text-amber-600' : 'text-neutral-400')}>{current}/{max}</span>
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-3 p-4">
      <p className="text-[14px] font-semibold tracking-[-0.01em] text-neutral-900">{title}</p>
      {children}
    </Card>
  )
}

/** Alegerea etichetelor: caută pe măsură ce scrii, iar cele alese rămân ca niște pastile. */
function TagInput({ selected, onChange }: { selected: BlogTag[]; onChange: (tags: BlogTag[]) => void }) {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ q: string; tags: BlogTag[] }>({ q: '', tags: [] })
  const [focused, setFocused] = useState(false)
  const q = useDebounced(query.trim(), 250)

  useEffect(() => {
    if (!q) return
    let alive = true
    fetch(`/api/blog/tags?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { if (alive) setFound({ q, tags: d.tags ?? [] }) })
      .catch(() => {})
    return () => { alive = false }
  }, [q])

  const suggestions = q && found.q === query.trim() ? found.tags.filter(x => !selected.some(s => s.id === x.id)) : []

  return (
    <div className="relative">
      <div className={cn(inputStyles, 'flex h-auto min-h-9 flex-wrap items-center gap-1.5 py-1.5 focus-within:border-brand-500 focus-within:ring-[3px] focus-within:ring-brand-600/15')}>
        {selected.map(tag => (
          <span key={tag.id} className="flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[12px] font-medium text-neutral-700">
            <Tag className="size-3" />{tag.name}
            <button type="button" onClick={() => onChange(selected.filter(x => x.id !== tag.id))} aria-label={t('admin.blog_tags_delete')} className="text-neutral-400 hover:text-neutral-700">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={selected.length === 0 ? t('admin.blog_editor_search_tags') : ''}
          className="min-w-[100px] flex-1 bg-transparent text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400" />
      </div>
      {focused && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-neutral-200/80 bg-white p-1 shadow-pop">
          {suggestions.map(tag => (
            <button key={tag.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange([...selected, tag]); setQuery('') }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-neutral-700 transition-colors hover:bg-neutral-100">
              <Tag className="size-3.5 shrink-0 text-neutral-400" />{tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CoverCard({ url, alt, onUrl, onAlt }: { url: string; alt: string; onUrl: (v: string) => void; onAlt: (v: string) => void }) {
  const { t } = useT()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/blog/upload-image', { method: 'POST', body: form })
      const data = await res.json()
      if (data.url) onUrl(data.url)
      else toast.error(data.error || t('common.error_upload'))
    } catch {
      toast.error(t('common.error_upload'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <SideCard title={t('admin.blog_editor_cover')}>
      {url ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="h-40 w-full rounded-lg object-cover" />
          <button type="button" onClick={() => onUrl('')} aria-label={t('common.delete')}
            className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white transition-colors hover:bg-black/70">
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files[0]
            if (file?.type.startsWith('image/')) upload(file)
          }}
          onClick={() => input.current?.click()}
          className={cn('flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed transition-colors',
            dragging ? 'border-neutral-500 bg-neutral-100' : 'border-neutral-300 bg-neutral-50/60 hover:border-neutral-400')}>
          {uploading ? <p className="text-[13px] text-neutral-500">{t('common.uploading')}</p> : (
            <>
              <Upload className="mb-1.5 size-5 text-neutral-400" />
              <p className="px-4 text-center text-[12px] text-neutral-500">{t('admin.blog_editor_drop_image')} <span className="text-neutral-900 underline underline-offset-2">{t('admin.blog_editor_choose_file')}</span></p>
            </>
          )}
        </div>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) upload(file) }} />
      <div>
        <Label htmlFor="cover-alt">{t('admin.blog_editor_alt_text')}</Label>
        <Input id="cover-alt" value={alt} onChange={e => onAlt(e.target.value)} placeholder={t('admin.blog_editor_alt_placeholder')} />
      </div>
    </SideCard>
  )
}

function SeoCard({ form, set }: { form: Form; set: <K extends keyof Form>(key: K, value: Form[K]) => void }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-[14px] font-semibold tracking-[-0.01em] text-neutral-900 transition-colors hover:bg-neutral-50/70">
        <span>SEO</span>
        <ChevronDown className={cn('size-4 text-neutral-400 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-neutral-100 p-4">
          <div>
            <Label htmlFor="seo-title" aside={<CharCount current={form.seoTitle.length} warn={50} max={60} />}>{t('admin.blog_editor_seo_title')}</Label>
            <Input id="seo-title" value={form.seoTitle} onChange={e => set('seoTitle', e.target.value)} placeholder={t('admin.blog_editor_seo_title_placeholder')} />
          </div>
          <div>
            <Label htmlFor="seo-desc" aside={<CharCount current={form.seoDesc.length} warn={140} max={160} />}>{t('admin.blog_editor_meta_description')}</Label>
            <Textarea id="seo-desc" value={form.seoDesc} onChange={e => set('seoDesc', e.target.value)} placeholder={t('admin.blog_editor_meta_description_placeholder')} rows={2} className="min-h-0" />
          </div>
          <div>
            <Label htmlFor="seo-og">{t('admin.blog_editor_og_image')}</Label>
            <div className="flex gap-2">
              <Input id="seo-og" value={form.seoOgImage} onChange={e => set('seoOgImage', e.target.value)} placeholder="https://..." />
              {form.coverUrl && <Button type="button" onClick={() => set('seoOgImage', form.coverUrl)}><ImageIcon />{t('admin.blog_editor_use_cover')}</Button>}
            </div>
          </div>
          <div>
            <Label htmlFor="seo-keywords">{t('admin.blog_editor_keywords')}</Label>
            <Input id="seo-keywords" value={form.seoKeywords} onChange={e => set('seoKeywords', e.target.value)} placeholder={t('admin.blog_editor_keywords_placeholder')} />
          </div>
          {(form.seoTitle || form.seoDesc) && (
            <div className="rounded-xl p-3 ring-1 ring-neutral-200">
              <p className="mb-2 text-[12px] font-medium text-neutral-500">{t('admin.blog_editor_google_preview')}</p>
              {/* Culorile rezultatelor Google, ca să se vadă cum va arăta */}
              <p className="truncate text-[16px] font-medium leading-tight text-[#1a0dab]">{form.seoTitle || t('admin.blog_editor_no_title')}</p>
              {/* i18n-ignore */}
              <p className="mt-0.5 truncate text-[12px] text-[#006621]">hontrio.com/blog/{form.slug || t('admin.blog_editor_slug_placeholder')}</p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-neutral-600">{form.seoDesc || t('admin.blog_editor_no_meta')}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export function BlogEditor({ postId }: { postId?: string }) {
  const { t, intlLocale } = useT()
  const router = useRouter()
  const [form, setForm] = useState<Form>(() => ({ ...EMPTY, publishedAt: minuteNow() }))
  const [slugManual, setSlugManual] = useState(false)
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [pageLoading, setPageLoading] = useState(!!postId)
  const [saving, setSaving] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')
  const [previewSlug, setPreviewSlug] = useState('')
  const [error, setError] = useState('')
  const lastSavedContent = useRef('')

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => ({ ...f, [key]: value }))

  useEffect(() => {
    fetch('/api/blog/categories')
      .then(r => r.json())
      .then(d => setCategories(d.categories ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!postId) return
    fetch(`/api/blog/posts/${postId}`)
      .then(r => r.json())
      .then(data => {
        const p = data.post
        if (!p) { router.replace('/admin/blog'); return }
        setForm(f => ({
          ...f,
          title: p.title || '',
          excerpt: p.excerpt || '',
          content: p.content || '',
          slug: p.slug || '',
          status: p.status || 'draft',
          locale: p.locale === 'en' ? 'en' : 'ro',
          featured: p.featured || false,
          categoryId: p.category_id || p.blog_categories?.id || '',
          tags: (p.blog_posts_tags || []).map((pt: { blog_tags: BlogTag | null }) => pt.blog_tags).filter(Boolean),
          coverUrl: p.cover_image_url || '',
          coverAlt: p.cover_image_alt || '',
          seoTitle: p.seo_title || '',
          seoDesc: p.seo_description || '',
          seoOgImage: p.seo_og_image_url || '',
          seoKeywords: p.seo_keywords || '',
          publishedAt: p.published_at ? new Date(new Date(p.published_at).setSeconds(0, 0)).toISOString().slice(0, 16) : f.publishedAt,
        }))
        setPreviewSlug(p.slug || '')
        lastSavedContent.current = p.content || ''
      })
      .catch(() => router.replace('/admin/blog'))
      .finally(() => setPageLoading(false))
  }, [postId, router])

  const payload = (status: PostStatus = form.status) => ({
    title: form.title,
    excerpt: form.excerpt || null,
    content: form.content || null,
    slug: form.slug || slugify(form.title),
    status,
    locale: form.locale,
    featured: form.featured,
    category_id: form.categoryId || null,
    cover_image_url: form.coverUrl || null,
    cover_image_alt: form.coverAlt || null,
    seo_title: form.seoTitle || null,
    seo_description: form.seoDesc || null,
    seo_og_image_url: form.seoOgImage || null,
    seo_keywords: form.seoKeywords || null,
    tags: form.tags.map(x => x.id),
    published_at: status === 'published' ? form.publishedAt : undefined,
  })

  // Salvarea automată pornește de la ultima modificare a conținutului și trimite formularul de atunci
  const latest = useRef(payload())
  useEffect(() => { latest.current = payload() })

  useEffect(() => {
    if (!postId || form.status !== 'draft') return
    const timer = setTimeout(async () => {
      if (form.content === lastSavedContent.current) return
      setSaveLabel(t('common.saving'))
      try {
        await fetch(`/api/blog/posts/${postId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(latest.current),
        })
        lastSavedContent.current = form.content
        setSaveLabel(t('admin.blog_editor_autosaved'))
      } catch {
        setSaveLabel('')
      }
    }, 30_000)
    return () => clearTimeout(timer)
  }, [form.content, form.status, postId, t])

  async function save(status?: PostStatus) {
    if (!form.title.trim()) { setError(t('admin.blog_editor_title_required')); return }
    setError('')
    setSaving(true)
    try {
      const res = await fetch(postId ? `/api/blog/posts/${postId}` : '/api/blog/posts', {
        method: postId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(status)),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || t('admin.blog_editor_save_error')); return }
      lastSavedContent.current = form.content
      if (status) set('status', status)
      if (postId) {
        setSaveLabel(t('common.saved'))
        if (data.post?.slug) setPreviewSlug(data.post.slug)
      } else {
        router.push(`/admin/blog/${data.post?.id}/edit`)
      }
    } catch {
      setError(t('admin.network_error_retry'))
    } finally {
      setSaving(false)
    }
  }

  async function checkSlug() {
    if (!form.slug) return
    try {
      const res = await fetch(`/api/blog/posts?q=${encodeURIComponent(form.slug)}&limit=5`)
      const data = await res.json()
      if ((data.posts ?? []).some((p: { id: string; slug: string }) => p.slug === form.slug && p.id !== postId)) setError(t('admin.blog_editor_slug_taken'))
    } catch {}
  }

  if (pageLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
          <div className="w-full space-y-4 lg:max-w-[340px]">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  const charCount = form.content.replace(/<[^>]*>/g, '').length

  return (
    <FadeIn className="space-y-5">
      <Link href="/admin/blog" className={cn(textActionStyles, 'text-[13px]')}><ArrowLeft />{t('admin.blog_title')}</Link>

      <PageHeader title={postId ? t('admin.blog_editor_edit_title') : t('admin.blog_new_post')}
        meta={saveLabel ? <Badge dot>{saveLabel}</Badge> : undefined}
        actions={(
          <>
            {previewSlug && (
              <Button asChild>
                <a href={`/blog/${previewSlug}?preview=true`} target="_blank" rel="noopener noreferrer"><Eye />{t('admin.blog_editor_preview')}</a>
              </Button>
            )}
            <Button onClick={() => save('draft')} disabled={saving}><Save />{t('admin.blog_editor_save_draft')}</Button>
            <Button variant="primary" onClick={() => save('published')} loading={saving}>{!saving && <Globe />}{saving ? t('common.saving') : t('common.publish_label')}</Button>
          </>
        )} />

      {error && <Callout tone="danger" onClose={() => setError('')}>{error}</Callout>}

      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <Card className="p-4">
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              onBlur={() => { if (!postId && !slugManual && form.title.trim()) set('slug', slugify(form.title)) }}
              placeholder={t('admin.blog_editor_title_placeholder')} aria-label={t('admin.field_title')}
              className="w-full bg-transparent text-[22px] font-semibold tracking-[-0.02em] text-neutral-950 outline-none placeholder:text-neutral-300" />
          </Card>

          <Card className="p-4">
            <Label htmlFor="post-excerpt" aside={<CharCount current={form.excerpt.length} warn={170} max={200} />}>{t('admin.blog_editor_excerpt')}</Label>
            <Textarea id="post-excerpt" value={form.excerpt} onChange={e => set('excerpt', e.target.value.slice(0, 200))} placeholder={t('admin.blog_editor_excerpt_placeholder')} rows={3} className="min-h-0" />
          </Card>

          <Card className="p-4">
            <Label htmlFor="post-content" aside={(
              <span className="flex items-center gap-3 text-[12px] text-neutral-400">
                <span>{t('admin.blog_editor_chars', { count: charCount, value: charCount.toLocaleString(intlLocale) })}</span>
                <span>{t('admin.blog_editor_read_time', { minutes: estimateReadTime(form.content) })}</span>
              </span>
            )}>{t('admin.blog_editor_content')}</Label>
            <Textarea id="post-content" value={form.content} onChange={e => set('content', e.target.value)} placeholder={t('admin.blog_editor_content_placeholder')}
              className="min-h-[420px] resize-y font-mono" />
          </Card>
        </div>

        <div className="w-full space-y-4 lg:sticky lg:top-20 lg:max-w-[340px] lg:self-start">
          <SideCard title={t('admin.blog_editor_publishing')}>
            <div>
              <Label htmlFor="post-status">{t('admin.status')}</Label>
              <Select id="post-status" value={form.status} onChange={e => set('status', e.target.value as PostStatus)}>
                <option value="draft">{t('admin.blog_status_draft')}</option>
                <option value="published">{t('admin.blog_status_published')}</option>
                <option value="archived">{t('admin.blog_status_archived')}</option>
              </Select>
            </div>
            <div>
              <Label>{t('admin.blog_editor_language')}</Label>
              <Segmented id="post-locale" size="sm" value={form.locale} onChange={v => set('locale', v)} items={[{ value: 'ro', label: LOCALE_NAMES.ro }, { value: 'en', label: LOCALE_NAMES.en }]} />
            </div>
            {form.status === 'published' && (
              <div>
                <Label htmlFor="post-date">{t('admin.blog_editor_publish_date')}</Label>
                <Input id="post-date" type="datetime-local" value={form.publishedAt} onChange={e => set('publishedAt', e.target.value)} />
              </div>
            )}
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[13px] text-neutral-700">{t('admin.blog_editor_featured')}</span>
              <Switch checked={form.featured} onChange={v => set('featured', v)} label={t('admin.blog_editor_featured')} />
            </div>
          </SideCard>

          <SideCard title={t('admin.blog_editor_organization')}>
            <div>
              <Label htmlFor="post-category">{t('common.category')}</Label>
              <Select id="post-category" value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                <option value="">{t('admin.blog_editor_no_category')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>{t('admin.blog_tags_title')}</Label>
              <TagInput selected={form.tags} onChange={v => set('tags', v)} />
            </div>
          </SideCard>

          <CoverCard url={form.coverUrl} alt={form.coverAlt} onUrl={v => set('coverUrl', v)} onAlt={v => set('coverAlt', v)} />
          <SeoCard form={form} set={set} />

          <SideCard title={t('admin.blog_editor_url_slug')}>
            <div className="flex items-stretch overflow-hidden rounded-lg border border-neutral-200 transition-[border-color,box-shadow] focus-within:border-brand-500 focus-within:ring-[3px] focus-within:ring-brand-600/15">
              {/* i18n-ignore */}
              <span className="flex shrink-0 items-center whitespace-nowrap border-r border-neutral-200 bg-neutral-50 px-2.5 text-[12px] text-neutral-500">hontrio.com/blog/</span>
              <input type="text" value={form.slug} onChange={e => { set('slug', e.target.value); setSlugManual(true) }} onBlur={checkSlug}
                placeholder={t('admin.blog_editor_slug_placeholder')} aria-label={t('admin.blog_editor_url_slug')}
                className="h-9 min-w-0 flex-1 bg-transparent px-2.5 font-mono text-[13px] text-neutral-900 outline-none" />
            </div>
          </SideCard>
        </div>
      </div>
    </FadeIn>
  )
}
