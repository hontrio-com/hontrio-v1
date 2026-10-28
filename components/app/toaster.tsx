'use client'

import { Toaster as Sonner } from 'sonner'
import { CircleAlert, CircleCheck, Info, Loader2, TriangleAlert } from 'lucide-react'

// =============================================
// Mesajele scurte de după o acțiune („Salvat", „Nu s-a putut salva"), jos în
// dreapta, pe sonner (github.com/emilkowalski/sonner). Dispar singure; se
// folosesc cu `toast.success(...)` / `toast.error(...)` din „sonner".
// =============================================

export function Toaster() {
  return (
    <Sonner position="bottom-right" theme="light" offset={20} gap={8} visibleToasts={4}
      icons={{
        success: <CircleCheck className="size-4 text-emerald-600" />,
        error: <CircleAlert className="size-4 text-red-600" />,
        warning: <TriangleAlert className="size-4 text-amber-600" />,
        info: <Info className="size-4 text-neutral-500" />,
        loading: <Loader2 className="size-4 animate-spin text-neutral-500" />,
      }}
      toastOptions={{
        classNames: {
          toast: 'app !items-start !gap-2.5 !rounded-xl !border !border-neutral-200 !bg-white !px-4 !py-3 !text-[13px] !font-medium !text-neutral-900 !shadow-pop',
          // i18n-ignore: clase de stil, nu text
          description: '!font-normal !text-neutral-500',
          icon: '!mt-px',
        },
      }} />
  )
}
