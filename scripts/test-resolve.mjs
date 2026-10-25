// Rezolvarea modulelor pentru teste: `@/x` → rădăcina proiectului, `./x` → `./x.ts`,
// iar JSON-ul se încarcă fără `with { type: 'json' }` (ca în bundler).
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '/index.ts']

function existing(base) {
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const ext of EXTENSIONS) if (existsSync(base + ext)) return base + ext
  return null
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const file = existing(resolvePath(ROOT, specifier.slice(2)))
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier)
    const file = existing(base)
    if (file && file !== base) return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  if (url.endsWith('.json')) {
    return { format: 'module', source: `export default ${readFileSync(fileURLToPath(url), 'utf8')}`, shortCircuit: true }
  }
  return next(url, context)
}
