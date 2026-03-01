import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import fs from 'fs'
import path from 'path'

const LOG_FILE = path.join(process.cwd(), 'logs', 'error.log')

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const lines = parseInt(searchParams.get('lines') || '100')
    const level = searchParams.get('level') || 'ALL' // ERROR, WARN, ALL

    if (!fs.existsSync(LOG_FILE)) {
      return NextResponse.json({ logs: [], total: 0, message: 'Nu există încă erori înregistrate.' })
    }

    const content = fs.readFileSync(LOG_FILE, 'utf8')
    const allLines = content.split('\n').filter(Boolean).reverse() // newest first

    const filtered = level === 'ALL'
      ? allLines
      : allLines.filter(l => l.includes(`[${level}]`))

    const size = fs.statSync(LOG_FILE).size
    const sizeKb = (size / 1024).toFixed(1)

    return NextResponse.json({
      logs: filtered.slice(0, lines),
      total: filtered.length,
      size_kb: sizeKb,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Eroare la citirea logurilor' }, { status: 500 })
  }
}

// DELETE — golește log-ul
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    if (fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, '', 'utf8')
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Eroare' }, { status: 500 })
  }
}