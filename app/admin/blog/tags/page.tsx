'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Hash, Plus, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card } from '@/components/app/surface'
import { Button } from '@/components/app/button'
import { Input } from '@/components/app/input'
import { ConfirmDialog, Modal } from '@/components/app/dialog'
import { EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { slugify } from '@/components/admin/blog'

// =============================================
// Etichetele blogului: se adaugă dintr-un câmp, iar un clic pe etichetă o
// redenumește. Ștergerea o scoate din toate articolele.
// =============================================

type BlogTag = { id: string; name: string; slug: string; posts_count?: number }

const send = (method: string, body: unknown) =>
  fetch('/api/blog/tags', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

/** Fereastra de redenumire: montată la deschidere, deci pornește mereu de la numele etichetei. */
function RenameModal({ tag, onClose, onSave, saving }: { tag: BlogTag; onClose: () => void; onSave: (name: string) => void; saving: boolean }) {
  const { t } = useT()
  const [name, setName] = useState(tag.name)
  return (
    <Modal open onOpenChange={o => { if (!o) onClose() }} title={t('admin.blog_tags_rename')} width={380}
      footer={(
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={saving} disabled={!name.trim()} onClick={() => onSave(name)}>{saving ? t('common.saving') : t('common.save')}</Button>
        </>
      )}>
      <Input value={name} onChange={e => setName(e.target.value)} autoFocus aria-label={t('common.name_label')} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name) }} />
    </Modal>
  )
}

export default function AdminBlogTagsPage() {
  const { t } = useT()
  const [tags, setTags] = useState<BlogTag[] | null>(null)
  const [input, setInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [editTarget, setEditTarget] = useState<BlogTag | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BlogTag | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/blog/tags')
      .then(r => r.json())
      .then(d => { if (alive) setTags(d.tags ?? []) })
      .catch(() => { if (alive) setTags([]) })
    return () => { alive = false }
  }, [])

  async function createTag() {
    const name = input.trim()
    if (!name) return
    setCreating(true)
    try {
      const res = await send('POST', { name, slug: slugify(name) })
      const data = await res.json()
      if (data.tag) {
        setTags(prev => [...(prev ?? []), data.tag])
        setInput('')
      } else {
        toast.error(data.error || t('admin.network_error_retry'))
      }
    } catch {
      toast.error(t('admin.network_error_retry'))
    } finally {
      setCreating(false)
    }
  }

  async function rename(name: string) {
    if (!editTarget) return
    setSaving(true)
    try {
      const res = await send('PUT', { id: editTarget.id, name, slug: slugify(name) })
      const data = await res.json()
      if (data.tag) {
        setTags(prev => (prev ?? []).map(x => x.id === editTarget.id ? { ...x, ...data.tag } : x))
        setEditTarget(null)
      } else {
        toast.error(data.error || t('admin.network_error_retry'))
      }
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
      setTags(prev => (prev ?? []).filter(x => x.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      toast.error(t('admin.network_error_retry'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.blog_tags_title')}
        actions={(
          <>
            <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createTag() } }}
              placeholder={t('admin.blog_tags_input_placeholder')} className="w-52" />
            <Button variant="primary" loading={creating} disabled={!input.trim()} onClick={createTag}>{!creating && <Plus />}{t('admin.blog_tags_new')}</Button>
          </>
        )} />

      <Card className="overflow-hidden">
        {!tags ? (
          <div className="flex flex-wrap gap-2 p-5">{[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-8 w-24" />)}</div>
        ) : tags.length === 0 ? (
          <EmptyState icon={<Hash />} title={t('admin.blog_tags_empty')} description={t('admin.blog_tags_empty_desc')}
            action={<Button variant="primary" onClick={() => inputRef.current?.focus()}><Plus />{t('admin.blog_tags_add_first')}</Button>} />
        ) : (
          <div className="flex flex-wrap gap-2 p-5">
            {tags.map(tag => (
              <div key={tag.id} className="group flex h-8 items-center gap-1.5 rounded-lg bg-white pl-2.5 pr-1.5 ring-1 ring-inset ring-neutral-200 transition-colors hover:ring-neutral-300">
                <button onClick={() => setEditTarget(tag)} title={t('admin.blog_tags_rename')} className="text-[13px] font-medium text-neutral-800 hover:text-neutral-950">{tag.name}</button>
                {typeof tag.posts_count === 'number' && <span className="rounded bg-neutral-100 px-1 text-[11px] font-medium tabular-nums text-neutral-500">{tag.posts_count}</span>}
                <button onClick={() => setDeleteTarget(tag)} title={t('admin.blog_tags_delete')} aria-label={t('admin.blog_tags_delete')}
                  className="rounded p-0.5 text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-600">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editTarget && <RenameModal tag={editTarget} onClose={() => setEditTarget(null)} onSave={rename} saving={saving} />}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null) }} title={t('admin.blog_tags_delete_title')}
        description={deleteTarget ? `${t('admin.blog_tags_delete_before')} ${t('admin.quoted', { text: deleteTarget.name })} ${t('admin.blog_tags_delete_after')}` : undefined}
        confirmLabel={deleting ? t('admin.deleting') : t('common.delete')} loading={deleting} onConfirm={handleDelete} />
    </FadeIn>
  )
}
