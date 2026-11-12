import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  accessLostMail, lossLimitMail, mailBody, moneyIn, pilotBlockedMail, proposalsMail, protectionFailedMail, tIn,
} from '@/lib/ads/emails'

// E-mailurile pilotului, în limba omului: oprirea de siguranță, oprirea eșuată,
// accesul pierdut, pilotul blocat, propunerile. Textele vin din dicționar (fără
// chei rămase netraduse), iar numele se scapă în HTML.

const ro = tIn('ro')
const en = tIn('en')
const noKeys = (s: string) => assert.ok(!/notifications\.\w+/.test(s), `cheie netradusă: ${s}`)

test('oprirea de siguranță: numele campaniei, magazinul și suma, în ambele limbi', () => {
  const spend = moneyIn('ro', 'RON')(312.5)
  const m = lossLimitMail(ro, { store: 'Casa Luminii', campaign: 'Hontrio · Shopping', spend })
  assert.match(m.subject, /Hontrio · Shopping/)
  assert.match(m.paragraphs[0], /Casa Luminii/)
  assert.match(m.paragraphs[0], /312,50/)
  assert.ok(m.cta.href.endsWith('/campaigns?tab=pilot'))
  const e = lossLimitMail(en, { store: 'Casa Luminii', campaign: 'X', spend: moneyIn('en', 'EUR')(10) })
  assert.match(e.subject, /paused/i)
  for (const mail of [m, e]) [mail.subject, ...mail.paragraphs, mail.cta.label].forEach(noKeys)
})

test('oprirea eșuată, accesul pierdut, pilotul blocat și propunerile au texte în ambele limbi', () => {
  for (const t of [ro, en]) {
    const mails = [
      protectionFailedMail(t, { store: 'S', campaign: 'C' }),
      accessLostMail(t),
      pilotBlockedMail(t, { store: 'S' }),
      proposalsMail(t, { store: 'S', count: 3 }),
      proposalsMail(t, { store: 'S', count: 1 }),
    ]
    for (const m of mails) [m.subject, m.title, ...m.paragraphs, m.cta.label].forEach(noKeys)
  }
  assert.match(proposalsMail(ro, { store: 'S', count: 3 }).paragraphs[0], /3 schimbări/)
  assert.match(proposalsMail(en, { store: 'S', count: 1 }).paragraphs[0], /^One change/)
  assert.ok(accessLostMail(en).cta.href.endsWith('/settings?tab=integrations'))
})

test('corpul e-mailului scapă numele (un magazin cu „<" în nume nu strică HTML-ul)', () => {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const html = mailBody(pilotBlockedMail(ro, { store: 'A<b>' }), esc, ro)
  assert.ok(html.includes('A&lt;b&gt;'))
  assert.ok(!html.includes('A<b>'))
  assert.ok(html.includes(esc(ro('notifications.email_footer_prefs'))))
})
