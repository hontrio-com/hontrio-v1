import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32 } from 'node:zlib'
import { buildOpencartPackages, readZip } from '../scripts/build-opencart.mjs'

// Extensia Hontrio pentru OpenCart (integrations/opencart/): arhivele din
// public/downloads/ trebuie să fie exact cele construite din surse, cu structura
// cerută de Installer-ul fiecărei versiuni, cod care merge pe PHP 7.3 la
// OpenCart 3 și fără date de identificare a cumpărătorilor în comenzi.
// Contractul API: docs/integrari/OPENCART.md; verificarea pe un magazin viu:
// node integrations/opencart/tests/contract.mjs <adresă> <cheie>.

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCE = join(ROOT, 'integrations', 'opencart')
const packages = buildOpencartPackages()
const pkg = (id: 'opencart-3' | 'opencart-4') => packages.find(p => p.id === id)!

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]))
}

test('arhivele din public/downloads sunt exact cele construite din surse (rulează node scripts/build-opencart.mjs dacă diferă)', () => {
  for (const p of packages) {
    const target = join(ROOT, p.file)
    assert.ok(existsSync(target), `${p.file} lipsește`)
    assert.ok(readFileSync(target).equals(p.zip), `${p.file} nu mai corespunde surselor`)
  }
})

test('fiecare intrare din arhive are conținutul sursei ei (CRC, fără compresie, rânduri LF)', () => {
  for (const p of packages) {
    const entries = readZip(p.zip)
    assert.equal(entries.length, p.entries.length)
    for (const [i, e] of entries.entries()) {
      const source = p.entries[i]
      assert.equal(e.path, source.path)
      assert.equal(e.method, 0, `${e.path}: STORE`)
      assert.equal(e.crc >>> 0, crc32(e.data) >>> 0, `${e.path}: CRC`)
      assert.ok(e.data.equals(source.data), `${e.path}: conținutul`)
      assert.ok(!e.data.includes(Buffer.from('\r\n')), `${e.path}: rânduri CRLF`)
    }
  }
})

test('OpenCart 3: tot conținutul e în upload/, doar în dosarele pe care Installer-ul le acceptă', () => {
  // admin/controller/marketplace/install.php (3.0.x), lista $allowed
  const allowed = [
    'admin/controller/extension/', 'admin/language/', 'admin/model/extension/', 'admin/view/template/extension/',
    'catalog/controller/extension/', 'catalog/language/', 'catalog/model/extension/', 'catalog/view/theme/',
    'system/config/', 'system/library/', 'image/catalog/',
  ]
  const paths = pkg('opencart-3').entries.map(e => e.path)
  for (const path of paths) {
    assert.ok(path.startsWith('upload/'), path)
    assert.ok(allowed.some(a => path.slice('upload/'.length).startsWith(a)), `${path} nu e într-un dosar permis`)
  }
  for (const required of [
    'upload/admin/controller/extension/module/hontrio.php',
    'upload/admin/language/en-gb/extension/module/hontrio.php',
    'upload/admin/language/ro-ro/extension/module/hontrio.php',
    'upload/admin/view/template/extension/module/hontrio.twig',
    'upload/catalog/controller/extension/hontrio/api.php',
    'upload/catalog/controller/extension/hontrio/event.php',
    'upload/system/library/hontrio/core.php',
  ]) assert.ok(paths.includes(required), `lipsește ${required}`)
})

test('OpenCart 4: install.json la rădăcină, arhiva numită hontrio.ocmod.zip (codul extensiei vine din nume)', () => {
  const p = pkg('opencart-4')
  assert.ok(p.file.endsWith('/hontrio.ocmod.zip'))
  const paths = p.entries.map(e => e.path)
  const manifest = JSON.parse(p.entries.find(e => e.path === 'install.json')!.data.toString('utf8'))
  for (const key of ['name', 'version', 'author', 'link']) assert.ok(typeof manifest[key] === 'string' && manifest[key], `install.json: ${key}`)
  for (const required of [
    'admin/controller/module/hontrio.php',
    'admin/language/en-gb/module/hontrio.php',
    'admin/language/ro-ro/module/hontrio.php',
    'admin/view/template/module/hontrio.twig',
    'catalog/controller/api.php',
    'catalog/controller/event.php',
    'system/library/core.php',
  ]) assert.ok(paths.includes(required), `lipsește ${required}`)
  assert.ok(paths.every(path => !path.startsWith('upload/') && !path.includes('..')))
})

test('limbile panoului (en-gb, ro-ro) au aceleași chei, iar șabloanele nu folosesc chei lipsă', () => {
  const keysOf = (file: string) => new Set([...readFileSync(file, 'utf8').matchAll(/\$_\['([a-z0-9_]+)'\]/g)].map(m => m[1]))
  for (const [dir, template] of [
    [join(SOURCE, 'oc3', 'upload', 'admin', 'language'), join(SOURCE, 'oc3', 'upload', 'admin', 'view', 'template', 'extension', 'module', 'hontrio.twig')],
    [join(SOURCE, 'oc4', 'admin', 'language'), join(SOURCE, 'oc4', 'admin', 'view', 'template', 'module', 'hontrio.twig')],
  ]) {
    const file = (lang: string) => files(join(dir, lang)).find(f => f.endsWith('hontrio.php'))!
    const en = keysOf(file('en-gb'))
    const ro = keysOf(file('ro-ro'))
    assert.deepEqual([...ro].sort(), [...en].sort(), `${dir}: cheile ro-ro ≠ en-gb`)
    // Variabilele din șablon: din limbă, din controler sau din limba de bază a OpenCart
    const fromController = new Set(['header', 'column_left', 'footer', 'breadcrumbs', 'breadcrumb', 'action', 'regenerate', 'cancel', 'save', 'back', 'installed', 'key', 'store_url', 'module_hontrio_status', 'module_hontrio_tracking', 'error_warning', 'success', 'text_step_2'])
    const fromOpencart = new Set(['button_save', 'button_cancel', 'button_back'])
    const used = [...readFileSync(template, 'utf8').matchAll(/\{\{\s*([a-z0-9_]+)/g)].map(m => m[1])
    for (const name of used) assert.ok(en.has(name) || fromController.has(name) || fromOpencart.has(name), `${template}: {{ ${name} }} nu vine de nicăieri`)
  }
})

test('versiunea extensiei e aceeași în miez și în install.json', () => {
  const core = readFileSync(join(SOURCE, 'shared', 'core.php'), 'utf8')
  const version = core.match(/EXTENSION_VERSION = '([^']+)'/)?.[1]
  const manifest = JSON.parse(readFileSync(join(SOURCE, 'oc4', 'install.json'), 'utf8'))
  assert.ok(version && /^\d+\.\d+\.\d+$/.test(version))
  assert.equal(manifest.version, version)
})

test('codul folosit de OpenCart 3 (miezul și fișierele oc3) nu cere mai mult de PHP 7.3', () => {
  const sources = [join(SOURCE, 'shared', 'core.php'), ...files(join(SOURCE, 'oc3')).filter(f => f.endsWith('.php'))]
  const php8 = [
    [/\bfn\s*\(/, 'funcții săgeată (7.4)'], [/\?->/, 'nullsafe (8.0)'], [/\bmatch\s*\(/, 'match (8.0)'],
    [/\bstr_(contains|starts_with|ends_with)\s*\(/, 'str_contains & co (8.0)'], [/\?\?=/, '??= (7.4)'],
    [/\b(public|protected|private)\s+(static\s+)?\??(int|string|bool|array|float|object|mixed|iterable)\s+\$/, 'proprietăți tipizate (7.4)'],
    [/\bmixed\b/, 'mixed (8.0)'], [/#\[/, 'atribute (8.0)'], [/\breadonly\b/, 'readonly (8.1)'], [/\benum\s+\w+/, 'enum (8.1)'],
    [/\):\s*(static|never)\b/, 'static / never ca tip întors (8.0 / 8.1)'],
  ] as const
  for (const file of sources) {
    const code = readFileSync(file, 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')
    for (const [pattern, what] of php8) assert.ok(!pattern.test(code), `${file}: ${what}`)
  }
})

test('miezul nu citește și nu trimite date de identificare ale cumpărătorului', () => {
  const core = readFileSync(join(SOURCE, 'shared', 'core.php'), 'utf8')
  for (const word of ['email', 'telephone', 'firstname', 'lastname', 'address_1', 'address_2', 'postcode', 'user_agent', 'accept_language', 'forwarded_ip', 'custom_field', 'fax', 'company', 'customer_id', "'ip'", '`ip`', '.ip`', 'comment']) {
    assert.ok(!core.toLowerCase().includes(word), `core.php conține „${word}”`)
  }
  // Din comenzi se citesc doar coloanele din contract
  const select = core.match(/SELECT o\.`order_id`, o\.`invoice_no`[\s\S]*?FROM `" \. DB_PREFIX \. "order` o/)?.[0] ?? ''
  const columns = [...select.matchAll(/o\.`([a-z_]+)`/g)].map(m => m[1]).sort()
  assert.deepEqual(columns, ['currency_code', 'currency_value', 'date_added', 'date_modified', 'invoice_no', 'invoice_prefix', 'marketing_id', 'order_id', 'order_status_id', 'payment_country_id', 'payment_method', 'shipping_country_id', 'shipping_method', 'total', 'tracking'].sort())
})

test('sintaxa PHP a tuturor fișierelor (php -l), când PHP e pe calculator', t => {
  const candidates = [process.env.PHP_BIN, 'C:/xampp/php/php.exe', 'php'].filter((x): x is string => !!x)
  const php = candidates.find(bin => {
    try {
      execFileSync(bin, ['-v'], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })
  if (!php) {
    t.skip('PHP nu e instalat (setează PHP_BIN)')
    return
  }
  for (const file of files(SOURCE).filter(f => f.endsWith('.php'))) {
    const out = execFileSync(php, ['-l', file], { encoding: 'utf8' })
    assert.match(out, /No syntax errors/, file)
  }
})
