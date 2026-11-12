import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n/config'

// =============================================
// Așezarea documentelor legale (termeni, confidențialitate, cookies, DPA):
// titlul, data actualizării, cuprinsul (fix pe ecran lat, pliabil pe telefon),
// secțiunile numerotate și, la final, celelalte documente. Textele stau în
// paginile lor, în română și în engleză; aici e doar forma, în alb și negru.
// =============================================

/** Versiunea documentelor; aceeași cu cea salvată la acceptarea Termenilor. */
export const LEGAL_VERSION = '2026-11-12'
const UPDATED: Record<Locale, string> = { ro: '12 noiembrie 2026', en: '12 November 2026' }

export type LegalKind = 'terms' | 'privacy' | 'cookies' | 'dpa'
export type LegalSection = { id: string; title: string; body: ReactNode }
export type LegalDoc = { title: string; summary: ReactNode; sections: LegalSection[] }

export const LEGAL_DOCS: Record<LegalKind, { href: string; ro: string; en: string }> = {
  terms: { href: '/legal/terms', ro: 'Termeni și condiții', en: 'Terms and Conditions' },
  privacy: { href: '/legal/privacy', ro: 'Politica de confidențialitate', en: 'Privacy Policy' },
  cookies: { href: '/legal/cookies', ro: 'Politica de cookies', en: 'Cookie Policy' },
  dpa: { href: '/legal/dpa', ro: 'Acordul de prelucrare a datelor', en: 'Data Processing Agreement' },
}

const UI: Record<Locale, { legal: string; updated: string; version: string; toc: string; other: string; questions: string }> = {
  ro: { legal: 'Documente legale', updated: 'Ultima actualizare', version: 'versiunea', toc: 'Cuprins', other: 'Celelalte documente', questions: 'Întrebări? Ne scrii la' },
  en: { legal: 'Legal documents', updated: 'Last updated', version: 'version', toc: 'Contents', other: 'Other documents', questions: 'Questions? Write to us at' },
}

const link = 'font-medium text-neutral-950 underline decoration-neutral-300 underline-offset-[3px] transition hover:decoration-neutral-950'

export function LegalPage({ doc, kind, locale, contact }: { doc: LegalDoc; kind: LegalKind; locale: Locale; contact: string }) {
  const ui = UI[locale]
  const toc = (
    <ol className="space-y-2">
      {doc.sections.map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="flex gap-2 text-neutral-500 transition hover:text-neutral-950">
            <span className="w-6 shrink-0 tabular-nums text-neutral-400">{i + 1}.</span>
            <span>{s.title}</span>
          </a>
        </li>
      ))}
    </ol>
  )

  return (
    <article className="px-5 pb-24 pt-10 md:pt-16">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <p className="text-[13px] font-medium text-neutral-500">{ui.legal}</p>
          <h1 className="mt-3 text-[2.2rem] font-bold leading-[1.06] tracking-[-0.04em] text-neutral-950 sm:text-5xl">{doc.title}</h1>
          <div className="mt-5 text-pretty text-[16px] leading-relaxed text-neutral-600 sm:text-[17px]">{doc.summary}</div>
          <p className="mt-6 text-[13px] text-neutral-500">{ui.updated}: {UPDATED[locale]} · {ui.version} {LEGAL_VERSION}</p>
        </header>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <nav aria-label={ui.toc} className="hidden lg:block">
            <div className="sticky top-28 text-[13px] leading-snug">
              <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{ui.toc}</p>
              {toc}
            </div>
          </nav>

          <div className="min-w-0 max-w-3xl">
            <details className="mb-10 rounded-2xl border border-line lg:hidden">
              <summary className="cursor-pointer select-none px-4 py-3 text-[14px] font-semibold text-neutral-900">{ui.toc}</summary>
              <div className="px-4 pb-4 text-[14px] leading-snug">{toc}</div>
            </details>

            <div className="space-y-12">
              {doc.sections.map((s, i) => (
                <section key={s.id} id={s.id} className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold leading-snug tracking-[-0.02em] text-neutral-950">
                    <span className="mr-2 tabular-nums text-neutral-400">{i + 1}.</span>{s.title}
                  </h2>
                  <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-neutral-700">{s.body}</div>
                </section>
              ))}
            </div>

            <footer className="mt-16 border-t border-line pt-8">
              <p className="text-[13px] font-semibold text-neutral-900">{ui.other}</p>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
                {(Object.keys(LEGAL_DOCS) as LegalKind[]).filter(k => k !== kind).map(k => (
                  <li key={k}><Link href={LEGAL_DOCS[k].href} className={link}>{LEGAL_DOCS[k][locale]}</Link></li>
                ))}
              </ul>
              <p className="mt-6 text-[13px] text-neutral-500">{ui.questions} <a href={`mailto:${contact}`} className={link}>{contact}</a></p>
            </footer>
          </div>
        </div>
      </div>
    </article>
  )
}

// ─── Piesele textului ────────────────────────────────────────────────────────

export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 text-[15px] font-semibold text-neutral-950">{children}</h3>
}

export function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-5">
      {items.map((item, i) => <li key={i} className="list-disc marker:text-neutral-400">{item}</li>)}
    </ul>
  )
}

/** Listă cu litere: a), b), c)... */
export function OL({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2 pl-6 [list-style-type:lower-alpha]">
      {items.map((item, i) => <li key={i} className="pl-1 marker:text-neutral-500">{item}</li>)}
    </ol>
  )
}

/** Un alineat numerotat (ex. 4.1), cu numărul în față. */
export function Clause({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-9 shrink-0 tabular-nums font-medium text-neutral-400">{n}</span>
      <div className="min-w-0 flex-1 space-y-3">{children}</div>
    </div>
  )
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px] leading-relaxed">
        <thead>
          <tr className="border-b border-line bg-neutral-50">
            {head.map(h => <th key={h} scope="col" className="px-4 py-3 font-semibold text-neutral-900">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line last:border-b-0">
              {row.map((cell, j) => <td key={j} className={`px-4 py-3 align-top ${j === 0 ? 'font-medium text-neutral-900' : 'text-neutral-600'}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Box({ children }: { children: ReactNode }) {
  return <div className="space-y-3 rounded-2xl border border-line bg-neutral-50 p-5">{children}</div>
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="break-all rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[12.5px] text-neutral-800">{children}</code>
}

/** Link spre alt site, într-un tab nou. */
export function A({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={link}>{children}</a>
}

/** Link spre o pagină a site-ului. */
export function L({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className={link}>{children}</Link>
}

export function Mail({ to }: { to: string }) {
  return <a href={`mailto:${to}`} className={link}>{to}</a>
}

/** Datele firmei (Legea nr. 365/2002, art. 5). */
export function Company({ locale }: { locale: Locale }) {
  const ro = locale === 'ro'
  return (
    <Box>
      <p className="font-semibold text-neutral-950">VOID SFT GAMES SRL</p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-[14px] sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-neutral-500">{ro ? 'Sediul social' : 'Registered office'}</dt>
        <dd>Str. Progresului 2, Bl. A29, Sc. 2, Et. 2, Ap. 10, Sat Mătăsari, {ro ? 'Jud. Gorj, cod poștal 217295, România' : 'Gorj County, postal code 217295, Romania'}</dd>
        <dt className="text-neutral-500">{ro ? 'Nr. Reg. Com.' : 'Trade Register No.'}</dt>
        <dd>J18/1054/2020 · EUID ROONRC.J18/1054/2020</dd>
        <dt className="text-neutral-500">CUI</dt>
        <dd>43474393</dd>
        <dt className="text-neutral-500">{ro ? 'Telefon' : 'Phone'}</dt>
        <dd><a href="tel:+40750456096" className={link}>+40 750 456 096</a></dd>
        <dt className="text-neutral-500">E-mail</dt>
        <dd>
          <Mail to="contact@hontrio.com" /> (general) · <Mail to="support@hontrio.com" /> ({ro ? 'suport' : 'support'}) · <Mail to="privacy@hontrio.com" /> ({ro ? 'protecția datelor' : 'data protection'})
        </dd>
      </dl>
    </Box>
  )
}
