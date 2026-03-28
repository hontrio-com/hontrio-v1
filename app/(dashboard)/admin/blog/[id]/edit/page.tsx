'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Save, Globe, ChevronRight, ChevronDown,
  Upload, X, Tag, ImageIcon, Eye,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BlogCategory {
  id: string
  name: string
  slug: string
  color: string
}

interface BlogTag {
  id: string
  name: string
  slug: string
}

type PostStatus = 'draft' | 'published' | 'archived'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugifyLocal(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function estimateReadTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ')
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

// ─── Tag autocomplete input ───────────────────────────────────────────────────

function TagInput({
  selected,
  onChange,
}: {
  selected: BlogTag[]
  onChange: (tags: BlogTag[]) => void
}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<BlogTag[]>([])
  const [open, setOpen] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (!query.trim()) { setSuggestions([]); setOpen(false); return }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/blog/tags?q=${encodeURIComponent(query)}`, { credentials: 'include' })
        const data = await res.json()
        const filtered = (data.tags || []).filter(
          (t: BlogTag) => !selected.some(s => s.id === t.id)
        )
        setSuggestions(filtered)
        setOpen(filtered.length > 0)
      } catch {
        // silently ignore
      }
    }, 250)
  }, [query, selected])

  function addTag(tag: BlogTag) {
    onChange([...selected, tag])
    setQuery('')
    setSuggestions([])
    setOpen(false)
  }

  function removeTag(id: string) {
    onChange(selected.filter(t => t.id !== id))
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="min-h-10 flex flex-wrap gap-1.5 items-center px-3 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50 focus-within:border-neutral-400 focus-within:bg-white transition-colors">
        {selected.map(tag => (
          <span key={tag.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-200 text-xs font-medium text-neutral-700">
            <Tag className="h-3 w-3" />
            {tag.name}
            <button type="button" onClick={() => removeTag(tag.id)} className="text-neutral-400 hover:text-neutral-700 transition-colors ml-0.5">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={selected.length === 0 ? 'Cauta taguri...' : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-neutral-700 placeholder:text-neutral-400 outline-none"
        />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-neutral-200 shadow-lg overflow-hidden"
          >
            {suggestions.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => addTag(t)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors text-left"
              >
                <Tag className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                {t.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Cover Image Upload ───────────────────────────────────────────────────────

function CoverImageCard({
  coverUrl,
  coverAlt,
  onUrlChange,
  onAltChange,
}: {
  coverUrl: string
  coverAlt: string
  onUrlChange: (url: string) => void
  onAltChange: (alt: string) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/blog/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = await res.json()
      if (data.url) onUrlChange(data.url)
    } catch {
      // silently ignore
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) uploadFile(file)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
      <p className="text-sm font-semibold text-neutral-800">Imagine principala</p>
      {coverUrl ? (
        <div className="relative">
          <img src={coverUrl} alt={coverAlt} className="w-full h-40 object-cover rounded-lg" />
          <button
            type="button"
            onClick={() => onUrlChange('')}
            className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${dragging ? 'border-neutral-400 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'}`}
        >
          {uploading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <div className="h-4 w-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
              Se incarca...
            </div>
          ) : (
            <>
              <Upload className="h-7 w-7 text-neutral-300 mb-1.5" />
              <p className="text-xs text-neutral-500 text-center">Trage o imagine sau <span className="underline">alege fisier</span></p>
            </>
          )}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div>
        <label className="block text-xs font-medium text-neutral-500 mb-1">Alt text</label>
        <input
          type="text"
          value={coverAlt}
          onChange={e => onAltChange(e.target.value)}
          placeholder="Descriere imagine..."
          className="w-full h-9 px-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
        />
      </div>
    </div>
  )
}

// ─── SEO Card (collapsible) ───────────────────────────────────────────────────

function SeoCard({
  seoTitle,
  seoDesc,
  seoOgImage,
  seoKeywords,
  coverUrl,
  slug,
  onSeoTitleChange,
  onSeoDescChange,
  onSeoOgImageChange,
  onSeoKeywordsChange,
}: {
  seoTitle: string
  seoDesc: string
  seoOgImage: string
  seoKeywords: string
  coverUrl: string
  slug: string
  onSeoTitleChange: (v: string) => void
  onSeoDescChange: (v: string) => void
  onSeoOgImageChange: (v: string) => void
  onSeoKeywordsChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const titleColor = seoTitle.length > 60 ? 'text-red-500' : seoTitle.length > 50 ? 'text-amber-500' : 'text-neutral-400'
  const descColor = seoDesc.length > 160 ? 'text-red-500' : seoDesc.length > 140 ? 'text-amber-500' : 'text-neutral-400'

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors"
      >
        <span>SEO</span>
        <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-neutral-100">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-500">Titlu SEO</label>
                  <span className={`text-xs tabular-nums ${titleColor}`}>{seoTitle.length}/60</span>
                </div>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={e => onSeoTitleChange(e.target.value)}
                  placeholder="Titlu pentru motoare de cautare..."
                  className="w-full h-9 px-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-500">Meta descriere</label>
                  <span className={`text-xs tabular-nums ${descColor}`}>{seoDesc.length}/160</span>
                </div>
                <textarea
                  value={seoDesc}
                  onChange={e => onSeoDescChange(e.target.value)}
                  placeholder="Descriere scurta pentru motoare de cautare..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700 resize-none focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">OG Image URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={seoOgImage}
                    onChange={e => onSeoOgImageChange(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 h-9 px-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
                  />
                  {coverUrl && (
                    <button
                      type="button"
                      onClick={() => onSeoOgImageChange(coverUrl)}
                      className="h-9 px-3 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors whitespace-nowrap flex items-center gap-1"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Cover
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Cuvinte cheie</label>
                <input
                  type="text"
                  value={seoKeywords}
                  onChange={e => onSeoKeywordsChange(e.target.value)}
                  placeholder="keyword1, keyword2, keyword3"
                  className="w-full h-9 px-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
                />
              </div>
              {(seoTitle || seoDesc) && (
                <div className="rounded-xl border border-neutral-200 p-3 bg-white">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Google Preview</p>
                  <div className="text-[#1a0dab] text-base font-medium truncate leading-tight">
                    {seoTitle || '(fara titlu)'}
                  </div>
                  <div className="text-[#006621] text-xs mt-0.5 truncate">
                    hontrio.com/blog/{slug || 'slug-articol'}
                  </div>
                  <div className="text-neutral-600 text-xs mt-1 line-clamp-2 leading-relaxed">
                    {seoDesc || '(fara meta descriere)'}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-neutral-100 rounded-xl ${className || ''}`} />
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminBlogEditPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const params = useParams()
  const postId = params.id as string

  // Form state
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [status, setStatus] = useState<PostStatus>('draft')
  const [publishedAt, setPublishedAt] = useState(() => {
    const now = new Date()
    now.setSeconds(0, 0)
    return now.toISOString().slice(0, 16)
  })
  const [featured, setFeatured] = useState(false)
  const [readTime, setReadTime] = useState(1)
  const [categoryId, setCategoryId] = useState('')
  const [selectedTags, setSelectedTags] = useState<BlogTag[]>([])
  const [coverUrl, setCoverUrl] = useState('')
  const [coverAlt, setCoverAlt] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [seoOgImage, setSeoOgImage] = useState('')
  const [seoKeywords, setSeoKeywords] = useState('')

  // Meta
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoSaveLabel, setAutoSaveLabel] = useState('')
  const [error, setError] = useState('')
  const [postSlugForPreview, setPostSlugForPreview] = useState('')

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContent = useRef('')

  // Auth guard
  useEffect(() => {
    if (sessionStatus === 'loading') return
    if ((session?.user as any)?.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [session, sessionStatus, router])

  // Fetch categories
  useEffect(() => {
    fetch('/api/blog/categories', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setCategories(d.categories || []))
      .catch(() => {})
  }, [])

  // Load post
  useEffect(() => {
    if (!postId) return
    fetch(`/api/blog/posts/${postId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const p = data.post
        if (!p) { router.replace('/admin/blog'); return }
        setTitle(p.title || '')
        setExcerpt(p.excerpt || '')
        setContent(p.content || '')
        setSlug(p.slug || '')
        setPostSlugForPreview(p.slug || '')
        setStatus(p.status || 'draft')
        setFeatured(p.featured || false)
        setReadTime(p.read_time_minutes || 1)
        setCategoryId(p.category_id || p.blog_categories?.id || '')
        setCoverUrl(p.cover_image_url || '')
        setCoverAlt(p.cover_image_alt || '')
        setSeoTitle(p.seo_title || '')
        setSeoDesc(p.seo_description || '')
        setSeoOgImage(p.seo_og_image_url || '')
        setSeoKeywords(p.seo_keywords || '')
        if (p.published_at) {
          const d = new Date(p.published_at)
          d.setSeconds(0, 0)
          setPublishedAt(d.toISOString().slice(0, 16))
        }
        // Normalise tags from joined data
        const tags: BlogTag[] = (p.blog_posts_tags || [])
          .map((pt: any) => pt.blog_tags)
          .filter(Boolean)
        setSelectedTags(tags)
        lastSavedContent.current = p.content || ''
      })
      .catch(() => router.replace('/admin/blog'))
      .finally(() => setPageLoading(false))
  }, [postId, router])

  // Update read time when content changes
  useEffect(() => {
    setReadTime(estimateReadTime(content))
  }, [content])

  // Auto-save every 30s when draft
  useEffect(() => {
    if (!postId || status !== 'draft') return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      if (content === lastSavedContent.current) return
      setAutoSaveLabel('Se salveaza...')
      try {
        await fetch(`/api/blog/posts/${postId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title, excerpt, content, slug, status, featured,
            category_id: categoryId || null,
            cover_image_url: coverUrl || null,
            cover_image_alt: coverAlt || null,
            seo_title: seoTitle || null,
            seo_description: seoDesc || null,
            seo_og_image_url: seoOgImage || null,
            seo_keywords: seoKeywords || null,
            tags: selectedTags.map(t => t.id),
          }),
        })
        lastSavedContent.current = content
        setAutoSaveLabel('Salvat automat')
      } catch {
        setAutoSaveLabel('')
      }
    }, 30000)

    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, postId, status])

  function handleTitleBlur() {
    if (!slugManual && title.trim()) {
      setSlug(slugifyLocal(title))
    }
  }

  const buildPayload = useCallback((overrideStatus?: PostStatus) => ({
    title,
    excerpt: excerpt || null,
    content: content || null,
    slug: slug || slugifyLocal(title),
    status: overrideStatus ?? status,
    featured,
    category_id: categoryId || null,
    cover_image_url: coverUrl || null,
    cover_image_alt: coverAlt || null,
    seo_title: seoTitle || null,
    seo_description: seoDesc || null,
    seo_og_image_url: seoOgImage || null,
    seo_keywords: seoKeywords || null,
    tags: selectedTags.map(t => t.id),
    published_at: (overrideStatus ?? status) === 'published' ? publishedAt : undefined,
  }), [title, excerpt, content, slug, status, featured, categoryId, coverUrl, coverAlt, seoTitle, seoDesc, seoOgImage, seoKeywords, selectedTags, publishedAt])

  async function save(overrideStatus?: PostStatus) {
    if (!title.trim()) { setError('Titlul este obligatoriu.'); return }
    setError('')
    setSaving(true)
    try {
      const payload = buildPayload(overrideStatus)
      const res = await fetch(`/api/blog/posts/${postId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Eroare la salvare.'); return }
      lastSavedContent.current = content
      setAutoSaveLabel('Salvat')
      if (data.post?.slug) setPostSlugForPreview(data.post.slug)
    } catch {
      setError('Eroare de retea. Incearca din nou.')
    } finally {
      setSaving(false)
    }
  }

  if (sessionStatus === 'loading' || pageLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-24" />
            <Skeleton className="h-96" />
          </div>
          <div className="w-full lg:max-w-sm space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </div>
    )
  }

  const charCount = content.replace(/<[^>]*>/g, '').length

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-neutral-400">
        <Link href="/admin/blog" className="hover:text-neutral-700 transition-colors">Admin</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/admin/blog" className="hover:text-neutral-700 transition-colors">Blog</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-neutral-600 truncate max-w-[200px]">{title || 'Editeaza articol'}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 style={{ fontSize: 28, fontWeight: 800 }} className="text-neutral-900">Editeaza articol</h1>
          {autoSaveLabel && (
            <span className="text-xs text-neutral-400 bg-neutral-100 px-2.5 py-1 rounded-full">
              {autoSaveLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {postSlugForPreview && (
            <a
              href={`/blog/${postSlugForPreview}?preview=true`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <button
                type="button"
                className="flex items-center gap-2 h-9 px-4 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                <Eye className="h-4 w-4" />
                Previzualizeaza
              </button>
            </a>
          )}
          <button
            type="button"
            onClick={() => save('draft')}
            disabled={saving}
            className="flex items-center gap-2 h-9 px-4 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Salveaza draft
          </button>
          <button
            type="button"
            onClick={() => save('published')}
            disabled={saving}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Globe className="h-4 w-4" />
            {saving ? 'Se salveaza...' : 'Publica'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <X className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* LEFT column */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* Title */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Titlul articolului..."
              className="w-full text-2xl font-bold text-neutral-900 placeholder:text-neutral-300 bg-transparent border-none outline-none"
            />
          </div>

          {/* Excerpt */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-neutral-700">Rezumat</label>
              <span className={`text-xs tabular-nums ${excerpt.length > 200 ? 'text-red-500' : excerpt.length > 170 ? 'text-amber-500' : 'text-neutral-400'}`}>
                {excerpt.length}/200
              </span>
            </div>
            <textarea
              value={excerpt}
              onChange={e => setExcerpt(e.target.value.slice(0, 200))}
              placeholder="Rezumat scurt..."
              rows={3}
              className="w-full text-sm text-neutral-700 placeholder:text-neutral-400 bg-transparent border-none outline-none resize-none"
            />
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-neutral-700">Continut (HTML)</label>
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                <span>{charCount.toLocaleString('ro-RO')} caractere</span>
                <span>{readTime} min citire</span>
              </div>
            </div>
            {/* TODO: Replace with TipTap editor */}
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Scrie continutul articolului... (HTML acceptat)"
              className="w-full min-h-[400px] text-sm text-neutral-700 placeholder:text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono resize-y focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* RIGHT column */}
        <div className="w-full lg:max-w-sm space-y-4 lg:sticky lg:top-6 lg:self-start">

          {/* Publicare */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-neutral-800">Publicare</p>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as PostStatus)}
                className="w-full h-9 px-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
              >
                <option value="draft">Draft</option>
                <option value="published">Publicat</option>
                <option value="archived">Arhivat</option>
              </select>
            </div>

            {status === 'published' && (
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Data publicare</label>
                <input
                  type="datetime-local"
                  value={publishedAt}
                  onChange={e => setPublishedAt(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
                />
              </div>
            )}

            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-neutral-700">Articol recomandat</span>
              <button
                type="button"
                onClick={() => setFeatured(!featured)}
                className={`relative w-11 h-6 rounded-full ${featured ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                style={{ transition: 'background-color 150ms cubic-bezier(0.4,0,0.2,1)' }}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 bg-white rounded-full shadow"
                  style={{
                    left: featured ? 'calc(100% - 22px)' : '2px',
                    transition: 'left 150ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Timp citire (minute)</label>
              <input
                type="number"
                min={1}
                max={120}
                value={readTime}
                onChange={e => setReadTime(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full h-9 px-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Organizare */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-neutral-800">Organizare</p>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Categorie</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
              >
                <option value="">Fara categorie</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Taguri</label>
              <TagInput selected={selectedTags} onChange={setSelectedTags} />
            </div>
          </div>

          {/* Cover image */}
          <CoverImageCard
            coverUrl={coverUrl}
            coverAlt={coverAlt}
            onUrlChange={setCoverUrl}
            onAltChange={setCoverAlt}
          />

          {/* SEO */}
          <SeoCard
            seoTitle={seoTitle}
            seoDesc={seoDesc}
            seoOgImage={seoOgImage}
            seoKeywords={seoKeywords}
            coverUrl={coverUrl}
            slug={slug}
            onSeoTitleChange={setSeoTitle}
            onSeoDescChange={setSeoDesc}
            onSeoOgImageChange={setSeoOgImage}
            onSeoKeywordsChange={setSeoKeywords}
          />

          {/* Slug */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-2">
            <p className="text-sm font-semibold text-neutral-800">URL Slug</p>
            <div className="flex items-center gap-0 rounded-xl border border-neutral-200 overflow-hidden focus-within:border-neutral-400 transition-colors">
              <span className="text-xs text-neutral-400 bg-neutral-50 px-2.5 py-2 border-r border-neutral-200 whitespace-nowrap shrink-0">
                hontrio.com/blog/
              </span>
              <input
                type="text"
                value={slug}
                onChange={e => { setSlug(e.target.value); setSlugManual(true) }}
                placeholder="slug-articol"
                className="flex-1 px-3 py-2 text-sm font-mono text-neutral-700 bg-transparent outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
