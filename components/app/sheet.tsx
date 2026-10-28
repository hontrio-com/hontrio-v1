'use client'

import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

// =============================================
// Panoul lateral (vaul, github.com/emilkowalski/vaul): alunecă din dreapta,
// plutește deasupra paginii, se închide cu Esc sau un clic în afară. Pentru
// lucruri care se fac fără să pierzi pagina din ochi (o campanie, un editor).
// =============================================

export function Sheet({ open, onOpenChange, width = 720, children }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  width?: number
  children: ReactNode
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction="right" handleOnly>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-neutral-950/25 backdrop-blur-[2px]" />
        <Drawer.Content aria-describedby={undefined} className="app fixed inset-y-0 right-0 z-50 flex w-full outline-none sm:inset-y-2 sm:right-2 sm:w-[calc(100%-1rem)]" style={{ maxWidth: width }}>
          <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-pop sm:rounded-2xl">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

/** Capul panoului: iconița, titlul, o frază și închiderea. */
export function SheetHeader({ icon, title, description, onClose, children }: {
  icon?: ReactNode; title: ReactNode; description?: ReactNode; onClose: () => void; children?: ReactNode
}) {
  const { t } = useT()
  return (
    <div className="border-b border-neutral-100 px-6 pt-5 pb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 [&_svg]:size-[18px]">{icon}</div>}
          <div className="min-w-0">
            <Drawer.Title className="truncate text-[17px] font-semibold tracking-[-0.015em] text-neutral-950">{title}</Drawer.Title>
            {description && <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">{description}</p>}
          </div>
        </div>
        <button onClick={onClose} aria-label={t('common.close')}
          className="-mr-1 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700">
          <X className="size-4" />
        </button>
      </div>
      {children}
    </div>
  )
}
