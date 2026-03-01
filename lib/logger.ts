import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'error.log')
const MAX_SIZE_MB = 5

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function rotatIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return
    const stats = fs.statSync(LOG_FILE)
    if (stats.size > MAX_SIZE_MB * 1024 * 1024) {
      const archived = LOG_FILE.replace('.log', `.${Date.now()}.log`)
      fs.renameSync(LOG_FILE, archived)
    }
  } catch {}
}

export type LogLevel = 'ERROR' | 'WARN' | 'INFO'

export function log(level: LogLevel, route: string, message: string, extra?: Record<string, unknown>) {
  try {
    ensureLogDir()
    rotatIfNeeded()

    const timestamp = new Date().toISOString()
    const extraStr = extra ? ' ' + JSON.stringify(extra) : ''
    const line = `[${timestamp}] [${level}] ${route} — ${message}${extraStr}\n`

    fs.appendFileSync(LOG_FILE, line, 'utf8')
  } catch {
    // nu blocăm request-ul dacă logging-ul pică
  }
}

export function logError(route: string, message: string, extra?: Record<string, unknown>) {
  log('ERROR', route, message, extra)
}

export function logWarn(route: string, message: string, extra?: Record<string, unknown>) {
  log('WARN', route, message, extra)
}

// Helper pentru API routes — prinde statusCode si loghează automat
export function logApiError(
  route: string,
  status: number,
  message: string,
  extra?: Record<string, unknown>
) {
  if (status >= 500) {
    logError(route, `HTTP ${status} — ${message}`, extra)
  } else if (status >= 400) {
    logWarn(route, `HTTP ${status} — ${message}`, extra)
  }
}