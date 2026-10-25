'use client'

import { useT } from '@/lib/i18n/context'
import type { LucideIcon } from 'lucide-react'

export default function ComingSoon({ titleKey, icon: Icon }: { titleKey: string; icon: LucideIcon }) {
  const { t } = useT()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t(titleKey)}</h1>
      </div>
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100">
          <Icon className="h-6 w-6 text-neutral-500" />
        </div>
        <p className="mt-4 text-[15px] font-semibold text-neutral-900">{t('common.coming_soon')}</p>
        <p className="mt-1 text-[13px] text-neutral-400">{t('common.coming_soon_desc')}</p>
      </div>
    </div>
  )
}
