'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Button } from '@/components/app/button'

/** Rândul de sub un tabel împărțit pe pagini; nu apare când e o singură pagină. */
export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  const { t } = useT()
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-2.5 text-[12px] text-neutral-500">
      <span className="tabular-nums">{t('admin.page_of', { page, total: pages })}</span>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label={t('catalog.prev')}><ChevronLeft /></Button>
        <Button size="icon" variant="ghost" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label={t('catalog.next')}><ChevronRight /></Button>
      </div>
    </div>
  )
}
