// =============================================
// Arhivele extensiei Hontrio pentru OpenCart, din integrations/opencart/:
//
//   public/downloads/hontrio-opencart-3.ocmod.zip   OpenCart 3.0.x (dosarul upload/)
//   public/downloads/opencart-4/hontrio.ocmod.zip   OpenCart 4.x (install.json la rădăcină)
//
// ⚠ OpenCart 4 face codul extensiei din numele fișierului urcat (hontrio.ocmod.zip →
// extension/hontrio/). Arhiva pentru 4 trebuie să se numească exact așa.
//
// Arhivele sunt deterministe: intrările în ordine, aceeași dată pentru toate,
// rândurile textelor cu LF, fișierele păstrate necomprimate (STORE). Așa se obțin
// aceiași octeți pe orice calculator și cu orice versiune de zlib, iar testul
// tests/opencart-extension.test.ts poate cere arhive identice cu sursele.
//
//   node scripts/build-opencart.mjs           scrie arhivele
//   node scripts/build-opencart.mjs --check   doar verifică (cod 1 dacă diferă)
// =============================================
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32 } from 'node:zlib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'integrations', 'opencart')
const CORE = join(SOURCE, 'shared', 'core.php')

/** Data tuturor intrărilor: 1 ianuarie 2026, 00:00 (format DOS). */
const DOS_TIME = 0
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1
const TEXT = /\.(php|twig|json|txt|md|xml|js|css|html)$/i

/**
 * @typedef {{ path: string, source: string, data: Buffer }} Entry
 * @typedef {{ id: 'opencart-3' | 'opencart-4', file: string, entries: Entry[], zip: Buffer }} Package
 */

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  const out = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name)
    if (name.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

/** @param {string} file @returns {Buffer} */
function read(file) {
  const data = readFileSync(file)
  return TEXT.test(file) ? Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : data
}

/** @param {string} source @param {string} path @returns {Entry} */
function entry(source, path) {
  return { path, source: relative(ROOT, source).replace(/\\/g, '/'), data: read(source) }
}

/** Intrările unei arhive: fișierele versiunii + miezul comun, pus unde îl caută versiunea. */
function entriesFor(/** @type {'opencart-3' | 'opencart-4'} */ id) {
  const base = id === 'opencart-3' ? join(SOURCE, 'oc3') : join(SOURCE, 'oc4')
  const list = walk(base).map(file => entry(file, relative(base, file).replace(/\\/g, '/')))
  list.push(entry(CORE, id === 'opencart-3' ? 'upload/system/library/hontrio/core.php' : 'system/library/core.php'))
  return list.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

/** O arhivă ZIP fără compresie (metoda 0), cu numele în UTF-8. @param {Entry[]} entries */
export function zip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const e of entries) {
    const name = Buffer.from(e.path, 'utf8')
    const crc = crc32(e.data) >>> 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // versiunea necesară
    local.writeUInt16LE(0x0800, 6) // nume în UTF-8
    local.writeUInt16LE(0, 8) // STORE
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(e.data.length, 18)
    local.writeUInt32LE(e.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, name, e.data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4) // făcută de: MS-DOS, 2.0
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(DOS_TIME, 12)
    central.writeUInt16LE(DOS_DATE, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(e.data.length, 20)
    central.writeUInt32LE(e.data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30) // extra
    central.writeUInt16LE(0, 32) // comentariu
    central.writeUInt16LE(0, 34) // discul
    central.writeUInt16LE(0, 36) // atribute interne
    central.writeUInt32LE(0, 38) // atribute externe
    central.writeUInt32LE(offset, 42)
    centrals.push(central, name)

    offset += local.length + name.length + e.data.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, directory, end])
}

/** Cele două arhive, construite în memorie. @returns {Package[]} */
export function buildOpencartPackages() {
  return /** @type {const} */ (['opencart-3', 'opencart-4']).map(id => {
    const entries = entriesFor(id)
    const file = id === 'opencart-3' ? 'public/downloads/hontrio-opencart-3.ocmod.zip' : 'public/downloads/opencart-4/hontrio.ocmod.zip'
    return { id, file, entries, zip: zip(entries) }
  })
}

/** Lista intrărilor dintr-o arhivă ZIP (din directorul central). @param {Buffer} buffer */
export function readZip(buffer) {
  const endAt = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (endAt < 0) throw new Error('ZIP fără directorul central')
  const count = buffer.readUInt16LE(endAt + 10)
  let at = buffer.readUInt32LE(endAt + 16)
  const out = []
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) throw new Error('ZIP stricat')
    const method = buffer.readUInt16LE(at + 10)
    const crc = buffer.readUInt32LE(at + 16)
    const size = buffer.readUInt32LE(at + 24)
    const nameLength = buffer.readUInt16LE(at + 28)
    const extraLength = buffer.readUInt16LE(at + 30)
    const commentLength = buffer.readUInt16LE(at + 32)
    const localAt = buffer.readUInt32LE(at + 42)
    const path = buffer.subarray(at + 46, at + 46 + nameLength).toString('utf8')
    const localName = buffer.readUInt16LE(localAt + 26)
    const localExtra = buffer.readUInt16LE(localAt + 28)
    const start = localAt + 30 + localName + localExtra
    out.push({ path, method, crc, data: buffer.subarray(start, start + size) })
    at += 46 + nameLength + extraLength + commentLength
  }
  return out
}

function main() {
  const check = process.argv.includes('--check')
  let drift = false
  for (const pkg of buildOpencartPackages()) {
    const target = join(ROOT, pkg.file)
    if (check) {
      const same = existsSync(target) && readFileSync(target).equals(pkg.zip)
      if (!same) drift = true
      console.log(`${same ? 'ok     ' : 'DIFERĂ '} ${pkg.file}`)
      continue
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, pkg.zip)
    console.log(`${pkg.file}  ${pkg.zip.length} octeți, ${pkg.entries.length} fișiere`)
    for (const e of pkg.entries) console.log(`  ${e.path}  ←  ${e.source}`)
  }
  if (drift) {
    console.error('Arhivele nu mai corespund surselor: rulează node scripts/build-opencart.mjs')
    process.exit(1)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
