'use client'

import type { ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Button } from '@/components/app/button'

// =============================================
// Ferestrele peste pagină (Radix Dialog): pentru un lucru scurt, care cere
// atenție acum (o confirmare, un formular de câteva câmpuri). Se închid cu
// Esc sau cu un clic în afară. Pentru lucruri mai lungi: panoul lateral.
// =============================================

export function Modal({ open, onOpenChange, title, description, icon, footer, width = 460, children }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  /** Rândul de jos, cu butoanele. */
  footer?: ReactNode
  width?: number
  children?: ReactNode
}) {
  const { t } = useT()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content aria-describedby={undefined} style={{ maxWidth: width }}
          className="app fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-pop outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="flex min-w-0 items-start gap-3">
              {icon && <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 [&_svg]:size-[18px]">{icon}</div>}
              <div className="min-w-0">
                <Dialog.Title className="text-[16px] font-semibold tracking-[-0.015em] text-neutral-950">{title}</Dialog.Title>
                {description && <Dialog.Description className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">{description}</Dialog.Description>}
              </div>
            </div>
            <Dialog.Close aria-label={t('common.close')} className="-mr-1 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">{children}</div>}
          <div className={footer ? 'mt-5 flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/50 px-5 py-3' : 'h-5'}>{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Întrebarea dinaintea unei acțiuni care nu se poate da înapoi. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, loading, tone = 'danger', disabled, children }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel: ReactNode
  onConfirm: () => void
  loading?: boolean
  /** `danger` pentru ștergeri; `primary` când acțiunea e doar definitivă (o trimitere). */
  tone?: 'danger' | 'primary'
  disabled?: boolean
  children?: ReactNode
}) {
  const { t } = useT()
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description} width={420}
      footer={(
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant={tone} loading={loading} disabled={disabled} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}>
      {children}
    </Modal>
  )
}
