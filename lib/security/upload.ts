// =============================================
// Fișierele încărcate de oameni (avatar, atașamente la tichete): tipul declarat
// de browser se verifică după primii octeți ai fișierului, iar extensia vine
// din tip, nu din numele ales de om.
// =============================================

export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const ATTACHMENT_TYPES: Record<string, string> = {
  ...IMAGE_TYPES,
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
}

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b)

/** Conținutul se potrivește cu tipul declarat (semnătura de la început). */
export function contentMatchesType(bytes: Uint8Array, type: string): boolean {
  switch (type) {
    case 'image/jpeg': return startsWith(bytes, [0xff, 0xd8, 0xff])
    case 'image/png': return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/gif': return startsWith(bytes, [0x47, 0x49, 0x46, 0x38])
    case 'image/webp': return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
    case 'application/pdf': return startsWith(bytes, [0x25, 0x50, 0x44, 0x46])
    // DOCX e o arhivă ZIP; DOC e un document OLE
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
    case 'application/msword': return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    // Text: fără octeți nuli și fără să înceapă ca o pagină HTML
    case 'text/plain': {
      const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 512)).trimStart().toLowerCase()
      return !bytes.subarray(0, 4096).includes(0) && !head.startsWith('<!doctype') && !head.startsWith('<html') && !head.startsWith('<svg') && !head.startsWith('<script')
    }
    default: return false
  }
}

/** Numele afișat al unui fișier: fără căi, fără caractere de control, cel mult 120 de caractere. */
export function cleanFileName(name: unknown): string {
  const base = typeof name === 'string' ? name.split(/[\\/]/).pop() ?? '' : ''
  const clean = base.replace(/[\u0000-\u001f\u007f<>"]/g, '').trim().slice(0, 120)
  return clean || 'file'
}
