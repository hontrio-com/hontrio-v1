import { createAdminClient } from '@/lib/supabase/admin'
import { ATTACHMENT_TYPES, cleanFileName } from '@/lib/security/upload'

// =============================================
// Atașamentele tichetelor de suport.
//
// Fișierele noi stau în bucketul privat `ticket-attachments`, la
// <cont>/<uuid>.<ext>. În tichet se păstrează doar { path, name, size, type };
// linkul (semnat, valabil o oră) îl face serverul la fiecare citire, pentru
// omul tichetului sau pentru echipă.
// Atașamentele vechi (înainte de 12.11.2026) au o adresă publică din bucketul
// `uploads`; se arată mai departe, dar numai dacă adresa e chiar de acolo.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

export const ATTACHMENTS_BUCKET = 'ticket-attachments'
export const MAX_ATTACHMENTS = 5
export const MAX_ATTACHMENT_SIZE = 4 * 1024 * 1024
const SIGNED_URL_TTL_SEC = 60 * 60

/** Ce se salvează în tichet. */
export type StoredAttachment = { path?: string; url?: string; name: string; size: number; type: string }
/** Ce primește pagina: cu link (semnat sau vechi) ori fără, dacă fișierul nu mai poate fi deschis. */
export type ShownAttachment = { name: string; size: number; type: string; url: string | null; path?: string }

const PATH_RE = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp|gif|pdf|txt|docx|doc)$/

const LEGACY_PREFIX = (() => {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  return base ? `${base}/storage/v1/object/public/uploads/ticket-attachments/` : null
})()

/** Calea din bucketul `uploads` a unui atașament vechi (pentru ștergere), sau null. */
export function legacyAttachmentPath(url: unknown): string | null {
  if (typeof url !== 'string' || !LEGACY_PREFIX || !url.startsWith(LEGACY_PREFIX)) return null
  const rest = url.slice(LEGACY_PREFIX.length).split('?')[0]
  return /^[0-9a-f-]{36}\/[\w.-]+$/.test(rest) ? `ticket-attachments/${rest}` : null
}

/**
 * Atașamentele trimise de pagină la un tichet sau la un răspuns: doar fișiere
 * încărcate de acest cont (calea începe cu id-ul lui), cu tipul și extensia potrivite.
 */
export function parseAttachments(input: unknown, ownerId: string): { ok: true; list: StoredAttachment[] } | { ok: false; error: string } {
  if (input === undefined || input === null) return { ok: true, list: [] }
  if (!Array.isArray(input)) return { ok: false, error: 'api.invalid_request' }
  if (input.length > MAX_ATTACHMENTS) return { ok: false, error: 'api.too_many_attachments' }
  const list: StoredAttachment[] = []
  for (const raw of input) {
    const a = (raw ?? {}) as Record<string, unknown>
    const path = typeof a.path === 'string' ? a.path : ''
    const m = PATH_RE.exec(path)
    const type = typeof a.type === 'string' ? a.type : ''
    if (!m || m[1] !== ownerId || ATTACHMENT_TYPES[type] !== m[2]) return { ok: false, error: 'api.invalid_request' }
    const size = Number(a.size)
    list.push({ path, name: cleanFileName(a.name), size: Number.isFinite(size) && size > 0 ? Math.min(size, MAX_ATTACHMENT_SIZE) : 0, type })
  }
  return { ok: true, list }
}

/** Atașamentele mai multor tichete/răspunsuri, gata de arătat: linkurile semnate, dintr-o singură cerere. */
export async function showAttachments(supabase: Supabase, lists: unknown[]): Promise<ShownAttachment[][]> {
  const parsed = lists.map(l => (Array.isArray(l) ? l : []).map(raw => (raw ?? {}) as Record<string, unknown>))
  const paths = [...new Set(parsed.flat().map(a => (typeof a.path === 'string' && PATH_RE.test(a.path) ? a.path : null)).filter((p): p is string => !!p))]
  const signed = new Map<string, string>()
  if (paths.length) {
    const { data } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SEC)
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }
  return parsed.map(list => list.map(a => {
    const path = typeof a.path === 'string' ? a.path : undefined
    const url = path ? signed.get(path) ?? null : legacyAttachmentPath(a.url) ? String(a.url) : null
    return { name: cleanFileName(a.name), size: Number(a.size) || 0, type: typeof a.type === 'string' ? a.type : '', url, ...(path ? { path } : {}) }
  }))
}

/** Căile din Storage ale atașamentelor (noi și vechi), pentru ștergerea contului. */
export function attachmentObjects(lists: unknown[]): { private: string[]; legacy: string[] } {
  const all = lists.flatMap(l => (Array.isArray(l) ? l : []).map(raw => (raw ?? {}) as Record<string, unknown>))
  return {
    private: all.map(a => (typeof a.path === 'string' && PATH_RE.test(a.path) ? a.path : null)).filter((p): p is string => !!p),
    legacy: all.map(a => legacyAttachmentPath(a.url)).filter((p): p is string => !!p),
  }
}
