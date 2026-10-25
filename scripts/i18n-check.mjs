// =============================================
// Verificarea traducerilor: `npm run i18n:check` (opțional: un filtru de cale, ex. `-- app/admin`)
//
// Erori (codul de ieșire 1):
//   - secțiuni sau chei care există într-o limbă și lipsesc în cealaltă
//   - parametrii {{x}} diferiți între română și engleză
//   - forme de plural incomplete (română: _one/_few/_other; engleză: _one/_other)
//   - chei folosite în cod care nu există (t('a.b'), t(`a.b_${x}`) după prefix)
//   - texte scrise direct în interfață (JSX, atribute vizibile, mesaje din API)
// Avertismente: chei nefolosite, propoziții identice în ambele limbi.
//
// Un text care chiar nu se traduce (o marcă, un exemplu de cod) se marchează cu
// un comentariu `i18n-ignore` pe aceeași linie sau pe cea de deasupra; un bloc
// întreg (ex. date structurate JSON-LD) între `i18n-ignore-start` și
// `i18n-ignore-end`; un fișier întreg de conținut pe limbi (ex. un document legal
// cu variantele ro/en) cu `i18n-content-file` în primele rânduri.
//
// Site-ul de prezentare (app/(marketing), imaginea de previzualizare) se reface
// în întregime, deci deocamdată nu se verifică.
// =============================================

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const MESSAGES = join(ROOT, 'lib/i18n/messages')
const LOCALES = ['ro', 'en']
const SOURCE = 'ro'
const PLURAL_FORMS = { ro: ['one', 'few', 'other'], en: ['one', 'other'] }
const filter = process.argv.slice(2).find(a => !a.startsWith('--'))?.replace(/\\/g, '/')
const verbose = process.argv.includes('--verbose')

const errors = []
const warnings = []
const err = (msg) => errors.push(msg)
const warn = (msg) => warnings.push(msg)

// ── Dicționarele ─────────────────────────────────────────────────────────────
function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out.set(key, v)
  }
  return out
}

const dicts = {}
for (const locale of LOCALES) {
  const dir = join(MESSAGES, locale)
  const files = readdirSync(dir).filter(f => f.endsWith('.json'))
  const index = readFileSync(join(dir, 'index.ts'), 'utf8')
  const all = {}
  for (const f of files) {
    const ns = f.replace(/\.json$/, '')
    if (!new RegExp(`from '\\./${ns}\\.json'`).test(index)) err(`[${locale}] secțiunea ${ns}.json nu e în index.ts`)
    all[ns] = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  }
  dicts[locale] = flatten(all)
}

const [ro, en] = [dicts.ro, dicts.en]
for (const [a, b, la, lb] of [[ro, en, 'ro', 'en'], [en, ro, 'en', 'ro']]) {
  for (const key of a.keys()) if (!b.has(key)) err(`cheia „${key}" există în ${la}, lipsește în ${lb}`)
}
const params = (s) => [...String(s).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]).sort().join(',')
const PLURAL_RE = /_(zero|one|two|few|many|other)$/
for (const [key, text] of ro) {
  if (typeof text !== 'string' || !text.trim()) err(`cheia „${key}" e goală (ro)`)
  if (!en.has(key)) continue
  const enText = en.get(key)
  if (typeof enText !== 'string' || !enText.trim()) err(`cheia „${key}" e goală (en)`)
  // Formele de plural pot avea parametri diferiți (ex. „o ofertă" fără {{count}})
  if (!PLURAL_RE.test(key) && params(text) !== params(enText)) err(`parametri diferiți la „${key}": ro {${params(text)}} / en {${params(enText)}}`)
  if (text === enText && /\s/.test(text) && /[a-zA-Z]{3}/.test(text)) warn(`aceeași propoziție în ro și en: „${key}"`)
}
// Pluralele
// Un grup de plural are cel puțin două forme (o singură cheie în _other poate fi altceva, ex. o stare „other")
const forms = new Map()
for (const key of [...ro.keys(), ...en.keys()]) {
  const m = key.match(PLURAL_RE)
  if (!m) continue
  const base = key.replace(PLURAL_RE, '')
  if (!forms.has(base)) forms.set(base, new Set())
  forms.get(base).add(m[1])
}
const pluralBases = [...forms].filter(([, f]) => f.size >= 2).map(([b]) => b)
for (const base of pluralBases) {
  for (const locale of LOCALES) {
    for (const form of PLURAL_FORMS[locale]) {
      if (!dicts[locale].has(`${base}_${form}`)) err(`pluralul „${base}" n-are forma _${form} în ${locale}`)
    }
  }
}

// ── Codul ────────────────────────────────────────────────────────────────────
const SCAN_DIRS = ['app', 'components', 'lib', 'hooks']
// Site-ul de prezentare se reface în întregime: cheile folosite acolo se numără, textele nu se verifică încă
const EXCLUDED = ['app/(marketing)/', 'app/opengraph-image.tsx']
const files = []
function walk(dir) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (['node_modules', '.next'].includes(name)) continue
    if (p.includes(`${sep}lib${sep}i18n${sep}`)) continue
    const st = statSync(p)
    if (st.isDirectory()) walk(p)
    else if (/\.(tsx?|jsx?)$/.test(name) && !name.endsWith('.d.ts')) files.push(p)
  }
}
for (const d of SCAN_DIRS) walk(join(ROOT, d))

const usedKeys = new Set()
const usedPrefixes = new Set()
const findings = new Map() // fișier → [{ line, text }]

// Ce se poate lăsa netradus: mărci, nume de produse, coduri și simboluri
const ALLOW = /^(?:[\s\d.,:;!?·•|/\\()[\]{}+\-–—=*#%&@$€£→←↑↓✓✕✔✖×…'"’„”«»_<>^~`]|Hontrio|Google(?: Ads| Merchant Center| for WooCommerce| & YouTube)?|Merchant Center|Performance Max|PMax|WooCommerce|WordPress|Shopify|Edinio|Stripe|Resend|OAuth(?: 2\.0)?|API|REST|ROAS|CPC|CTR|SKU|GTIN|MPN|UTM|gclid|COD|TVA|VAT|CUI|SRL|PDF|CSV|URL|SEO|AI|PRO|TEST|BETA|NEW|RON|EUR|USD|GBP|ck_|cs_|https?:\/\/\S+|[\w.+-]+@[\w-]+\.[\w.]+|v?\d[\d.]*|©|™|®)*$/
const TEXT_ATTRS = new Set(['placeholder', 'title', 'aria-label', 'aria-description', 'alt', 'label', 'content', 'tooltip', 'helperText', 'description', 'emptyText', 'confirmText', 'cancelText'])
const TEXT_PROPS = new Set(['error', 'message', 'title', 'label', 'description', 'desc', 'text', 'placeholder', 'tooltip', 'hint', 'subtitle', 'cta', 'heading', 'body', 'detail', 'details', 'reason', 'warning', 'notice', 'success', 'caption', 'question', 'answer', 'tip', 'badge', 'note'])
const LOG_CALLS = /^(console\.\w+|log|logError|logWarn|logApiError|logger\.\w+|require|import|debug)$/
const RO = /[ăâîșțşţĂÂÎȘȚŞŢ]/

const isKeyLike = (s) => /^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(s) || /^[a-z0-9]+(_[a-z0-9]+)+$/.test(s) || /^[a-z][a-zA-Z0-9]*$/.test(s)
const isSentence = (s) => {
  const t = s.trim()
  if (t.length < 2 || isKeyLike(t) || ALLOW.test(t)) return false
  if (/^[./#?&=:]|^https?:|[{}]|^\$|^[a-z-]+:[a-z]/.test(t) || /^[\w-]+\/[\w/-]+$/.test(t)) return false
  if (RO.test(t)) return true
  const words = t.split(/\s+/).filter(w => /[A-Za-z]{2,}/.test(w))
  // Propoziție: începe cu majusculă și are cuvinte; clasele CSS (lowercase-cu-cratime) nu trec
  return /^[A-ZĂÂÎȘȚ]/.test(t) && words.length >= 1 && !/^[A-Z0-9_]+$/.test(t) && !/^[A-Z][a-zA-Z]+$/.test(t) || (words.length >= 3 && /^[a-zăâîșț]/.test(t) && !/[a-z]+-[a-z0-9]+/.test(t))
}

function ignoredBlock(lines, line) {
  for (let i = line; i >= 0; i--) {
    if (/i18n-ignore-end/.test(lines[i])) return false
    if (/i18n-ignore-start/.test(lines[i])) return true
  }
  return false
}

function record(file, sf, node, text) {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
  const lines = sf.text.split('\n')
  if (/i18n-ignore(?!-)/.test(lines[line] ?? '') || /i18n-ignore(?!-)/.test(lines[line - 1] ?? '') || ignoredBlock(lines, line)) return
  if (!findings.has(file)) findings.set(file, [])
  findings.get(file).push({ line: line + 1, text: text.replace(/\s+/g, ' ').trim().slice(0, 100) })
}

function calleeName(call) {
  const e = call.expression
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return `${e.expression.getText()}.${e.name.text}`
  return ''
}

for (const path of files) {
  const rel = relative(ROOT, path).split(sep).join('/')
  const src = readFileSync(path, 'utf8')
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const contentFile = /i18n-content-file/.test(src.split('\n').slice(0, 15).join('\n'))
  const isApi = rel.startsWith('app/api/')
  const isLib = !path.endsWith('x') && !rel.startsWith('app/')
  const excluded = EXCLUDED.some(p => rel.startsWith(p))
  const checkText = !contentFile && !excluded && (!filter || rel.startsWith(filter))

  const visit = (node, ctx) => {
    // Cheile folosite: t('a.b') și t(`a.b_${x}`)
    if (ts.isCallExpression(node) && /(^|\.)t$/.test(calleeName(node)) && node.arguments.length) {
      const a = node.arguments[0]
      if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) {
        usedKeys.add(a.text)
        if (!ro.has(a.text) && !ro.has(`${a.text}_other`)) err(`cheie inexistentă „${a.text}" în ${rel}:${sf.getLineAndCharacterOfPosition(a.getStart(sf)).line + 1}`)
      } else if (ts.isTemplateExpression(a)) {
        const prefix = a.head.text
        usedPrefixes.add(prefix)
        if (prefix && ![...ro.keys()].some(k => k.startsWith(prefix))) err(`nicio cheie nu începe cu „${prefix}" (${rel})`)
      }
    }
    if (!checkText) { ts.forEachChild(node, n => visit(n, ctx)); return }

    let next = ctx
    if (ts.isCallExpression(node)) {
      const name = calleeName(node)
      if (LOG_CALLS.test(name) || /(^|\.)(log|warn|error|info|debug)$/.test(name) && name.startsWith('console')) next = 'log'
      if (/(^|\.)t$/.test(name)) next = 'key'
    }
    if (ts.isNewExpression(node) && /Error$/.test(node.expression.getText())) next = 'log'
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return

    if (ctx !== 'log' && ctx !== 'key') {
      if (ts.isJsxText(node) && !isApi) {
        const text = node.text.trim()
        if (text && /[A-Za-zĂÂÎȘȚăâîșț]{2}/.test(text) && !ALLOW.test(text)) record(rel, sf, node, text)
      }
      if (ts.isJsxAttribute(node) && node.initializer) {
        const attr = node.name.getText()
        let lit = null
        if (ts.isStringLiteral(node.initializer)) lit = node.initializer
        else if (ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isStringLiteral(node.initializer.expression)) lit = node.initializer.expression
        if (lit) {
          if (TEXT_ATTRS.has(attr) && /[A-Za-zăâîșț]{2}/.test(lit.text) && !ALLOW.test(lit.text) && !isKeyLike(lit.text)) record(rel, sf, lit, `${attr}="${lit.text}"`)
          return // celelalte atribute (className, href...) nu sunt text
        }
      }
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const parent = node.parent
        const prop = parent && ts.isPropertyAssignment(parent) && parent.initializer === node ? parent.name.getText().replace(/['"]/g, '') : null
        const isPropertyKey = parent && ts.isPropertyAssignment(parent) && parent.name === node
        const inJsxAttr = parent && (ts.isJsxAttribute(parent) || ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent))
        if (!isPropertyKey && !inJsxAttr && !ts.isLiteralTypeNode(parent) && !ts.isElementAccessExpression(parent) && !ts.isCaseClause(parent)) {
          const text = node.text
          const flagged = prop && TEXT_PROPS.has(prop)
            ? /[A-Za-zăâîșț]{2}/.test(text) && !isKeyLike(text) && !ALLOW.test(text) && !/^[a-z]+([_-][a-z0-9]+)*$/.test(text)
            : isLib ? RO.test(text) : isSentence(text) && !(isApi && !prop)
          if (flagged) record(rel, sf, node, text)
        }
      }
      if (ts.isTemplateExpression(node)) {
        const parts = [node.head.text, ...node.templateSpans.map(s => s.literal.text)].join(' … ')
        if (RO.test(parts) || /[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(parts) && !/[a-z]+-[a-z0-9]+/.test(parts) && !/^[./]/.test(node.head.text)) record(rel, sf, node, parts)
      }
    }
    ts.forEachChild(node, n => visit(n, next))
  }
  visit(sf, null)
}

// ── Raportul ─────────────────────────────────────────────────────────────────
const unused = [...ro.keys()].filter(k => {
  const base = k.replace(PLURAL_RE, '')
  return !usedKeys.has(k) && !usedKeys.has(base) && ![...usedPrefixes].some(p => p && k.startsWith(p))
})
if (unused.length) warn(`${unused.length} chei nefolosite (ex. ${unused.slice(0, 5).join(', ')})`)

const hardcoded = [...findings.values()].reduce((s, l) => s + l.length, 0)
if (hardcoded) err(`${hardcoded} texte scrise direct, în ${findings.size} fișiere`)

for (const e of errors.filter(e => !e.includes('texte scrise direct'))) console.log(`✖ ${e}`)
if (findings.size) {
  const sorted = [...findings].sort((a, b) => b[1].length - a[1].length)
  for (const [file, list] of sorted) {
    console.log(`\n✖ ${file} (${list.length})`)
    for (const f of verbose ? list : list.slice(0, 12)) console.log(`    ${f.line}: ${f.text}`)
    if (!verbose && list.length > 12) console.log(`    … încă ${list.length - 12} (--verbose)`)
  }
}
if (verbose) for (const w of warnings) console.log(`⚠ ${w}`)
console.log(`\nDicționar: ${ro.size} chei (ro) / ${en.size} (en) · chei folosite: ${usedKeys.size} · prefixe: ${usedPrefixes.size}`)
console.log(`Erori: ${errors.length}${hardcoded ? ` (din care ${hardcoded} texte scrise direct în ${findings.size} fișiere)` : ''} · avertismente: ${warnings.length}`)
process.exitCode = errors.length ? 1 : 0
