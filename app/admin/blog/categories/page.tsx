'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Input, Textarea } from '@/components/app/input'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { ConfirmDialog, Modal } from '@/components/app/dialog'
import { EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { slugify } from '@/components/admin/blog'

// =============================================
// Categoriile blogului. Fiecare are o culoare proprie, folosită pe blog (de
// aceea alegerea culorii e colorată, deși platforma e alb-negru).
// =============================================

type BlogCategory = { id: string; name: string; slug: string; description?: string; color: string; posts_count?: number }

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6']
const FALLBACK_COLOR = '#a3a3a3'

const send = (method: string, body: unknown) =>
  fetch('/api/blog/categories', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

/** Formularul din fereastră: montat la deschidere, deci pornește mereu de la categoria aleasă. */
function CategoryForm({ initial, onClose, onSave, saving }: {
  initial: BlogCategory | null
  onClose: () => void
  onSave: (data: Partial<BlogCategory>) => void
  saving: boolean
}) {
  const { t } = useT()
  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugManual, setSlugManual] = useState(false)
  const [description, setDescription] = useState(initial?.description ?? '')
  const [color, setColor] = useState(initial?.color || PRESET_COLORS[0])
  const [hex, setHex] = useState(color)

  const onName = (value: string) => {
    setName(value)
    if (!slugManual) setSlug(slugify(value))
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onClose() }} title={initial ? t('admin.blog_categories_edit') : t('admin.blog_categories_new')}
      footer={(
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={saving} disabled={!name.trim() || !slug.trim()} onClick={() => onSave({ name, slug, description, color })}>
            {saving ? t('common.saving') : initial ? t('common.save') : t('admin.blog_create')}
          </Button>
        </>
      )}>
      <div className="space-y-4">
        <div>
          <label htmlFor="cat-name" className="mb-1.5 block text-[13px] font-medium text-neutral-700">{t('common.name_label')}</label>
          <Input id="cat-name" value={name} onChange={e => onName(e.target.value)} placeholder={t('admin.blog_categories_name_placeholder')} />
        </div>
        <div>
          <label htmlFor="cat-slug" className="mb-1.5 block text-[13px] font-medium text-neutral-700">{t('admin.blog_slug')}</label>
          <Input id="cat-slug" value={slug} onChange={e => { setSlug(e.target.value); setSlugManual(true) }} placeholder={t('admin.blog_categories_slug_placeholder')} className="font-mono" />
        </div>
        <div>
          <label htmlFor="cat-desc" className="mb-1.5 block text-[13px] font-medium text-neutral-700">{t('admin.blog_categories_description')}</label>
          <Textarea id="cat-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('admin.blog_categories_description_placeholder')} rows={2} className="min-h-0" />
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-neutral-700">{t('admin.blog_categories_color')}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button" onClick={() => { setColor(c); setHex(c) }} aria-label={c} aria-pressed={color === c}
                className="flex size-7 items-center justify-center rounded-lg ring-offset-2 transition-shadow aria-pressed:ring-2 aria-pressed:ring-neutral-900" style={{ backgroundColor: c }}>
                {color === c && <Check className="size-3.5 text-white" strokeWidth={3} />}
              </button>
            ))}
            <span className="ml-1 size-7 shrink-0 rounded-lg ring-1 ring-neutral-200" style={{ backgroundColor: color }} />
            <Input value={hex} aria-label={t('admin.blog_categories_color')} placeholder={PRESET_COLORS[0]} className="h-7 w-24 px-2 font-mono text-[12px]"
              onChange={e => { setHex(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setColor(e.target.value) }} />
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function AdminBlogCategoriesPage() {
  const { t } = useT()
  const [categories, setCategories] = useState<BlogCategory[] | null>(null)
  const [tick, setTick] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BlogCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BlogCategory | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/blog/categories')
      .then(r => r.json())
      .then(d => { if (alive) setCategories(d.categories ?? []) })
      .catch(() => { if (alive) setCategories(c => c ?? []) })
    return () => { alive = false }
  }, [tick])

  const open = (category: BlogCategory | null) => { setEditTarget(category); setFormOpen(true) }

  async function handleSave(data: Partial<BlogCategory>) {
    setSaving(true)
    try {
      const res = await (editTarget ? send('PUT', { id: editTarget.id, ...data }) : send('POST', data))
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(body.error || t('admin.network_error_retry')); return }
      setTick(n => n + 1)
      setFormOpen(false)
    } catch {
      toast.error(t('admin.network_error_retry'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await send('DELETE', { id: deleteTarget.id })
      if (!res.ok) { toast.error(t('admin.network_error_retry')); return }
      setCategories(prev => (prev ?? []).filter(c => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      toast.error(t('admin.network_error_retry'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.blog_categories')} actions={<Button variant="primary" onClick={() => open(null)}><Plus />{t('admin.blog_categories_new')}</Button>} />

      <Card className="overflow-hidden">
        {!categories ? (
          <div className="space-y-3 p-5">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>
        ) : categories.length === 0 ? (
          <EmptyState icon={<Tag />} title={t('admin.blog_categories_empty')} description={t('admin.blog_categories_empty_desc')}
            action={<Button variant="primary" onClick={() => open(null)}><Plus />{t('admin.blog_categories_add_first')}</Button>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('common.name_label')}</Th>
                <Th className="hidden sm:table-cell">{t('admin.blog_slug')}</Th>
                <Th className="hidden lg:table-cell">{t('admin.blog_categories_description')}</Th>
                <Th className="hidden md:table-cell">{t('admin.blog_categories_posts')}</Th>
                <Th align="right">{t('admin.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <Tr key={cat.id}>
                  <Td>
                    <span className="flex items-center gap-2.5 font-medium text-neutral-900">
                      <span className="size-3 shrink-0 rounded" style={{ backgroundColor: cat.color || FALLBACK_COLOR }} />{cat.name}
                    </span>
                  </Td>
                  <Td className="hidden font-mono text-[12px] text-neutral-500 sm:table-cell">{cat.slug}</Td>
                  <Td className="hidden max-w-xs truncate text-neutral-500 lg:table-cell">{cat.description || '—'}</Td>
                  <Td className="hidden md:table-cell"><Badge>{t('admin.blog_posts_count', { count: cat.posts_count ?? 0 })}</Badge></Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button size="icon" variant="ghost" onClick={() => open(cat)} title={t('common.edit')} aria-label={t('common.edit')}><Pencil /></Button>
                      <Button size="icon" variant="ghost" className="hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteTarget(cat)} title={t('common.delete')} aria-label={t('common.delete')}><Trash2 /></Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {formOpen && <CategoryForm initial={editTarget} onClose={() => setFormOpen(false)} onSave={handleSave} saving={saving} />}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null) }} title={t('admin.blog_categories_delete_title')}
        description={deleteTarget ? `${t('admin.quoted', { text: deleteTarget.name })} ${t('admin.blog_categories_delete_desc')}` : undefined}
        confirmLabel={deleting ? t('admin.deleting') : t('admin.delete_permanently')} loading={deleting} onConfirm={handleDelete} />
    </FadeIn>
  )
}
