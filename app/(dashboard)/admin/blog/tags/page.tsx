'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Hash, Plus, X } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BlogTag {
  id: string
  name: string
  slug: string
  posts_count?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugifyLocal(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── Edit Tag Modal ───────────────────────────────────────────────────────────

function EditTagModal({
  tag,
  onClose,
  onSave,
  saving,
}: {
  tag: BlogTag
  onClose: () => void
  onSave: (id: string, name: string) => Promise<void>
  saving: boolean
}) {
  const [name, setName] = useState(tag.name)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold text-neutral-900">Redenumeste tag</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-800 focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors mb-4"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Anuleaza
          </button>
          <button
            onClick={() => onSave(tag.id, name)}
            disabled={saving || !name.trim()}
            className="flex-1 h-10 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteTagModal({
  tag,
  onCancel,
  onConfirm,
  loading,
}: {
  tag: BlogTag
  onCancel: () => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
      >
        <h2 className="text-[17px] font-bold text-neutral-900 mb-2">Sterge tag-ul?</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Tag-ul <span className="font-medium text-neutral-700">&quot;{tag.name}&quot;</span> va fi eliminat din toate articolele.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Anuleaza
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Se sterge...' : 'Sterge'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminBlogTagsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [tags, setTags] = useState<BlogTag[]>([])
  const [loading, setLoading] = useState(true)
  const [inlineInput, setInlineInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [editTarget, setEditTarget] = useState<BlogTag | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BlogTag | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auth guard
  useEffect(() => {
    if (sessionStatus === 'loading') return
    if ((session?.user as any)?.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [session, sessionStatus, router])

  async function fetchTags() {
    try {
      const res = await fetch('/api/blog/tags', { credentials: 'include' })
      const data = await res.json()
      setTags(data.tags || [])
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTags() }, [])

  async function createTag(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    try {
      const res = await fetch('/api/blog/tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, slug: slugifyLocal(trimmed) }),
      })
      const data = await res.json()
      if (data.tag) {
        setTags(prev => [...prev, data.tag])
        setInlineInput('')
      }
    } catch {
      // silently ignore
    } finally {
      setCreating(false)
    }
  }

  async function handleEditSave(id: string, name: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/blog/tags', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, slug: slugifyLocal(name) }),
      })
      const data = await res.json()
      if (data.tag) {
        setTags(prev => prev.map(t => t.id === id ? data.tag : t))
        setEditTarget(null)
      }
    } catch {
      // silently ignore
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await fetch('/api/blog/tags', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      setTags(prev => prev.filter(t => t.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      // silently ignore
    } finally {
      setDeleteLoading(false)
    }
  }

  function handleInlineKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      createTag(inlineInput)
    }
  }

  if (sessionStatus === 'loading') return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 style={{ fontSize: 28, fontWeight: 800 }} className="text-neutral-900">Taguri</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inlineInput}
              onChange={e => setInlineInput(e.target.value)}
              onKeyDown={handleInlineKeyDown}
              placeholder="Nume tag + Enter"
              className="h-9 pl-3 pr-9 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 transition-colors w-48"
            />
            {inlineInput && (
              <button
                onClick={() => setInlineInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => createTag(inlineInput)}
            disabled={creating || !inlineInput.trim()}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Tag nou
          </button>
        </div>
      </div>

      {/* Tag grid */}
      {loading ? (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-8 w-24 bg-neutral-100 rounded-full animate-pulse" />
          ))}
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Hash className="h-16 w-16 text-neutral-200 mb-4" />
          <p className="text-lg font-semibold text-neutral-700 mb-1">Niciun tag</p>
          <p className="text-sm text-neutral-400 mb-6">Adauga primul tag pentru a eticheta articolele.</p>
          <button
            onClick={() => { inputRef.current?.focus() }}
            className="flex items-center gap-2 h-9 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adauga primul tag
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {tags.map(tag => (
              <motion.div
                key={tag.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors"
              >
                <button
                  onClick={() => setEditTarget(tag)}
                  className="text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
                >
                  {tag.name}
                </button>
                {typeof tag.posts_count === 'number' && (
                  <span className="text-xs text-neutral-400 bg-white px-1.5 py-0.5 rounded-full border border-neutral-200">
                    {tag.posts_count}
                  </span>
                )}
                <button
                  onClick={() => setDeleteTarget(tag)}
                  className="ml-0.5 text-neutral-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  title="Sterge tag"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {editTarget && (
          <EditTagModal
            tag={editTarget}
            onClose={() => setEditTarget(null)}
            onSave={handleEditSave}
            saving={saving}
          />
        )}
        {deleteTarget && (
          <DeleteTagModal
            tag={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            loading={deleteLoading}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
