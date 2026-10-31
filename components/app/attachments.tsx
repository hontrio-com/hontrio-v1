'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, FileText, Loader2, Upload, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

// =============================================
// Atașamentele unei conversații de suport, de ambele părți (omul și
// administratorul): se încarcă pe loc, se văd ca niște etichete mici, iar în
// conversație imaginile apar ca miniaturi.
// =============================================

export type Attachment = { url: string; name: string; size: number; type: string }
type PendingFile = Attachment & { uploading: boolean; error?: string; localId: string }

export const MAX_FILES = 5
const MAX_SIZE = 10 * 1024 * 1024
/** Ce primește omul în fereastra de alegere; serverul mai acceptă și documente Word. */
export const ACCEPTED_FILES = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain'

const isImage = (type: string) => type.startsWith('image/')

export function useAttachments() {
  const { t } = useT()
  const [pending, setPending] = useState<PendingFile[]>([])

  async function addFiles(files: FileList) {
    const toAdd = Array.from(files).slice(0, MAX_FILES - pending.length)
    for (const file of toAdd) {
      if (file.size > MAX_SIZE) { toast.error(t('support.file_too_large', { name: file.name })); continue }
      const localId = Math.random().toString(36).slice(2)
      const preview = isImage(file.type) ? URL.createObjectURL(file) : ''
      setPending(p => [...p, { localId, name: file.name, size: file.size, type: file.type, url: preview, uploading: true }])
      const fd = new FormData(); fd.append('file', file)
      try {
        const res = await fetch('/api/tickets/upload', { method: 'POST', body: fd })
        const data = await res.json()
        setPending(p => p.map(f => f.localId === localId ? { ...f, url: res.ok ? data.url : f.url, uploading: false, error: res.ok ? undefined : data.error } : f))
      } catch {
        setPending(p => p.map(f => f.localId === localId ? { ...f, uploading: false, error: t('common.error_upload') } : f))
      }
    }
  }

  function remove(id: string) { setPending(p => p.filter(f => f.localId !== id)) }
  function clear() { setPending([]) }
  const ready = pending.filter(f => !f.uploading && !f.error).map(({ url, name, size, type }) => ({ url, name, size, type }))

  return { pending, addFiles, remove, clear, ready, uploading: pending.some(f => f.uploading) }
}

export function AttachChip({ att, onRemove }: { att: PendingFile; onRemove?: () => void }) {
  const { t } = useT()
  return (
    <div className={cn('flex max-w-[220px] items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] ring-1 ring-inset', att.error ? 'bg-red-50 ring-red-200' : 'bg-white ring-neutral-200')}>
      {isImage(att.type)
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={att.url} alt="" className="size-5 shrink-0 rounded object-cover" />
        : <FileText className="size-3.5 shrink-0 text-neutral-400" />}
      <span className="truncate font-medium text-neutral-700">{att.name}</span>
      {att.uploading ? <Loader2 className="size-3 shrink-0 animate-spin text-neutral-400" />
        : att.error ? <span className="shrink-0 text-[11px] font-semibold text-red-600" title={att.error}>!</span>
        : onRemove ? <button type="button" onClick={onRemove} aria-label={t('common.delete')} className="shrink-0 text-neutral-400 transition-colors hover:text-red-600"><X className="size-3" /></button>
        : att.url && <a href={att.url} target="_blank" rel="noopener" className="shrink-0 text-neutral-400 hover:text-neutral-700"><Download className="size-3" /></a>}
    </div>
  )
}

export function AttachGallery({ attachments }: { attachments: Attachment[] }) {
  if (!attachments?.length) return null
  const imgs = attachments.filter(a => isImage(a.type))
  const files = attachments.filter(a => !isImage(a.type))
  return (
    <div className="mt-3 space-y-2">
      {imgs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imgs.map(a => (
            <a key={a.url} href={a.url} target="_blank" rel="noopener">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} className="size-20 rounded-lg object-cover ring-1 ring-neutral-200 transition-opacity hover:opacity-90" />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((a, i) => <AttachChip key={a.url} att={{ ...a, uploading: false, localId: String(i) }} />)}
        </div>
      )}
    </div>
  )
}

export function DropZone({ onFiles, disabled, accept = ACCEPTED_FILES, hint }: {
  onFiles: (f: FileList) => void
  disabled?: boolean
  accept?: string
  hint: string
}) {
  const { t } = useT()
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files) }}
      onClick={() => ref.current?.click()}
      className={cn('flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors',
        drag ? 'border-neutral-500 bg-neutral-100' : 'border-neutral-300 bg-neutral-50/60 hover:border-neutral-400', disabled && 'pointer-events-none opacity-40')}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-500 ring-1 ring-neutral-200"><Upload className="size-3.5" /></span>
      <div>
        <p className="text-[13px] font-medium text-neutral-700">{t('common.add_files')} <span className="text-neutral-900 underline underline-offset-2">{t('common.or_drag')}</span></p>
        <p className="mt-0.5 text-[12px] text-neutral-500">{hint}</p>
      </div>
      <input ref={ref} type="file" multiple accept={accept} className="hidden" onChange={e => e.target.files && onFiles(e.target.files)} />
    </div>
  )
}
