'use client'

import Link from 'next/link'
import { ChevronRight, CircleHelp, Menu, Search } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import NotificationBell from '@/components/notification-bell'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// =============================================
// Bara de sus: unde ești (magazinul › pagina), ajutorul și notificările.
// Pe telefon, de aici se deschid meniul și căutarea.
// =============================================

export function Topbar({ store, page, onMenu, onSearch }: { store: string | null; page: string | null; onMenu: () => void; onSearch: () => void }) {
  const { t } = useT()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-neutral-200/70 bg-white/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 sm:px-6 lg:px-10">
      <button onClick={onMenu} aria-label={t('sidebar.open_menu')} className="-ml-1.5 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 lg:hidden">
        <Menu className="size-5" />
      </button>
      <nav aria-label={t('sidebar.breadcrumb')} className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {store && <span className="hidden truncate text-neutral-500 sm:inline">{store}</span>}
        {store && page && <ChevronRight className="hidden size-3.5 shrink-0 text-neutral-300 sm:block" />}
        {page && <span className="truncate font-medium text-neutral-900">{page}</span>}
      </nav>
      <div className="ml-auto flex items-center gap-0.5">
        <button onClick={onSearch} aria-label={t('sidebar.search')} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 lg:hidden">
          <Search className="size-[18px]" />
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/support" aria-label={t('sidebar.help')} className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700">
              <CircleHelp className="size-[18px]" />
            </Link>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} className="bg-neutral-900 text-white [&>span]:hidden">{t('sidebar.help')}</TooltipContent>
        </Tooltip>
        <NotificationBell />
      </div>
    </header>
  )
}
