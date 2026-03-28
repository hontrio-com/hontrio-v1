'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Tag, Pencil, Trash2, X, Check } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BlogCategory {
  id: string
  name: string
  slug: string
  description?: string
  color: string
  posts_count?: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6',
]

function slugifyLocal(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── Category Modal ──────────────────────────────────────────────────────────

function CategoryModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: BlogCategory | null
  onClose: () => void
  onSave: (data: Partial<BlogCategory>) => Promise<void>
  saving: boolean
}) {
  const [name, setName] = useState(initial?.name || '')
  const [slug, setSlug] = useState(initial?.slug || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [color, setColor] = useState(initial?.color || PRESET_COLORS[0])
  const [hexInput, setHexInput] = useState(initial?.color || PRESET_COLORS[0])
  const [slugManual, setSlugManual] = useState(false)

  function handleNameChange(val: string) {
    setName(val)
    if (!slugManual) {
      const generated = slugifyLocal(val)
      setSlug(generated)
      setHexInput(color)
    }
  }

  function handleColorSwatch(c: string) {
    setColor(c)
    setHexInput(c)
  }

  function handleHexInput(val: string) {
    setHexInput(val)
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setColor(val)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSave({ name, slug, description, color })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[17px] font-bold text-neutral-900">
            {initial ? 'Editeaza categoria' : 'Categorie noua'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Nume</label>
            <input
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="ex: Tutoriale"
              required
              className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-800 focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugManual(true) }}
              placeholder="tutoriale"
              required
              className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-800 font-mono focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Descriere</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descriere optionala..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-800 resize-none focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Culoare</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleColorSwatch(c)}
                  className="h-8 w-8 rounded-lg border-2 transition-all flex items-center justify-center"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? 'rgba(0,0,0,0.3)' : 'transparent',
                  }}
                >
                  {color === c && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </button>
              ))}
              <div className="flex items-center gap-1.5 ml-1">
                <div
                  className="h-8 w-8 rounded-lg border border-neutral-200 shrink-0"
                  style={{ backgroundColor: color }}
                />
                <input
                  type="text"
                  value={hexInput}
                  onChange={e => handleHexInput(e.target.value)}
                  placeholder="#6366f1"
                  className="w-24 h-8 px-2 rounded-lg border border-neutral-200 bg-neutral-50 text-xs font-mono focus:outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              Anuleaza
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-10 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Se salveaza...' : initial ? 'Salveaza' : 'Creeaza'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Delete modal ────────────────────────────────────────────────────────────

function DeleteModal({
  category,
  onCancel,
  onConfirm,
  loading,
}: {
  category: BlogCategory
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
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-[17px] font-bold text-neutral-900">Sterge categoria?</h2>
          <button onClick={onCancel} className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-neutral-500 mb-1">
          <span className="font-medium text-neutral-700">&quot;{category.name}&quot;</span>
        </p>
        <p className="text-sm text-neutral-400 mb-6">
          Articolele din aceasta categorie vor ramane fara categorie.
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
            {loading ? 'Se sterge...' : 'Sterge definitiv'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminBlogCategoriesPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BlogCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BlogCategory | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Auth guard
  useEffect(() => {
    if (sessionStatus === 'loading') return
    if ((session?.user as any)?.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [session, sessionStatus, router])

  async function fetchCategories() {
    try {
      const res = await fetch('/api/blog/categories', { credentials: 'include' })
      const data = await res.json()
      setCategories(data.categories || [])
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCategories() }, [])

  async function handleSave(data: Partial<BlogCategory>) {
    setSaving(true)
    try {
      if (editTarget) {
        await fetch('/api/blog/categories', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editTarget.id, ...data }),
        })
      } else {
        await fetch('/api/blog/categories', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      }
      await fetchCategories()
      setModalOpen(false)
      setEditTarget(null)
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
      await fetch('/api/blog/categories', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      setCategories(prev => prev.filter(c => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      // silently ignore
    } finally {
      setDeleteLoading(false)
    }
  }

  function openCreate() {
    setEditTarget(null)
    setModalOpen(true)
  }

  function openEdit(cat: BlogCategory) {
    setEditTarget(cat)
    setModalOpen(true)
  }

  if (sessionStatus === 'loading') return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 style={{ fontSize: 28, fontWeight: 800 }} className="text-neutral-900">Categorii</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Categorie noua
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-neutral-100 rounded-xl animate-pulse" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Tag className="h-16 w-16 text-neutral-200 mb-4" />
          <p className="text-lg font-semibold text-neutral-700 mb-1">Nicio categorie</p>
          <p className="text-sm text-neutral-400 mb-6">Adauga prima categorie pentru a organiza articolele.</p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-9 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adauga prima categorie
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">Culoare</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">Nume</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Slug</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Descriere</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Articole</th>
                <th className="text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">Actiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <div
                      className="h-4 w-4 rounded"
                      style={{ backgroundColor: cat.color || '#6366f1' }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-neutral-900">{cat.name}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-neutral-400 font-mono">{cat.slug}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-neutral-500 truncate max-w-xs block">
                      {cat.description || <span className="text-neutral-300">-</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                      {cat.posts_count ?? 0} articole
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                        title="Editeaza"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Sterge"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modalOpen && (
          <CategoryModal
            initial={editTarget}
            onClose={() => { setModalOpen(false); setEditTarget(null) }}
            onSave={handleSave}
            saving={saving}
          />
        )}
        {deleteTarget && (
          <DeleteModal
            category={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            loading={deleteLoading}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
