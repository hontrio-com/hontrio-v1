'use client'
// i18n-content-file: etichetele panoului OpenCart 4 (în engleză, limba lui de bază) și ale extensiei Hontrio

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronDown, ChevronRight, Copy, Download, Info, Minus, Pencil, Plus, Puzzle, Trash2, Upload } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { HontrioCard, Screen, hit, hover } from './parts'
import type { Beat, Scene, SceneProps } from './player'

// =============================================
// Ghidul OpenCart: arhiva descărcată din Hontrio → Extensions → Installer (urcată
// și instalată) → Extensions → Extensions → Modules → Hontrio (instalat, apoi
// deschis) → cheia copiată și lipită în Hontrio. Panoul e refăcut după OpenCart
// 4.1 (meniul, paginile Installer și Extensions, pagina extensiei Hontrio).
// =============================================

const MENU_TOP = ['Dashboard', 'Catalog', 'CMS']
const MENU_AFTER = ['Design', 'Sales', 'Customers', 'Marketing', 'System', 'Reports']
const SUB = ['Marketplace', 'Installer', 'Extensions', 'Modification', 'Startup', 'Events', 'Cron Jobs']
const MODULES = ['Account', 'Banner', 'Bestsellers', 'Category', 'Featured', 'Filter', 'Hontrio', 'HTML Content']
const KEY = '9f2c41d7a03b8e65c1f4d92a7e0b36c58d1a4f7e2b9c06d3'

const BEATS: Beat[] = [
  /* 0 */ { ms: 1400, step: 0, to: 'o-dl-4', click: true, cam: { on: 'o-dl', z: 1.3 }, url: 'app.hontrio.com/onboarding' },
  /* 1 */ { ms: 1150, step: 0 },
  /* 2 */ { ms: 1350, step: 1, to: 'o-ext', click: true, cam: { on: 'o-ext', z: 1.5 }, url: '{shop}/admin/index.php?route=common/dashboard' },
  /* 3 */ { ms: 1150, step: 1, to: 'o-installer', click: true },
  /* 4 */ { ms: 1300, step: 1, to: 'o-upload', click: true, cam: { on: 'o-head', z: 1.3 }, url: '{shop}/admin/index.php?route=marketplace/installer' },
  /* 5 */ { ms: 1600, step: 1, cam: { on: 'o-installed', z: 1.4 } },
  /* 6 */ { ms: 1150, step: 1, to: 'o-install', click: true },
  /* 7 */ { ms: 800, step: 1 },
  /* 8 */ { ms: 1250, step: 2, to: 'o-extensions', click: true, cam: { on: 'o-extensions', z: 1.5 } },
  /* 9 */ { ms: 1500, step: 2, to: 'o-mod-install', click: true, cam: { on: 'o-modules', z: 1.35 }, url: '{shop}/admin/index.php?route=marketplace/extension&type=module' },
  /* 10 */ { ms: 1250, step: 2, to: 'o-mod-edit', click: true },
  /* 11 */ { ms: 1500, step: 3, to: 'o-copy', click: true, cam: { on: 'o-key', z: 1.5 }, url: '{shop}/admin/index.php?route=extension/hontrio/module/hontrio' },
  /* 12 */ { ms: 1250, step: 3, to: 'h-key', click: true, cam: { on: 'h-card', z: 1.12 }, url: 'app.hontrio.com/onboarding' },
  /* 13 */ { ms: 1250, step: 3, to: 'h-connect', click: true },
  /* 14 */ { ms: 1800, step: 3 },
]

/** Butoanele mici din tabelele OpenCart (albastru, portocaliu, roșu), aici în tonuri de gri. */
const action = 'grid size-[17px] place-items-center rounded-[3px] text-white'

function OpenCartScreen({ beat, hot }: SceneProps) {
  const { locale, t } = useT()
  const shop = locale === 'ro' ? 'https://www.magazinul-tau.ro' : 'https://www.your-store.com'
  const page = beat <= 1 ? 'hontrio' : beat <= 3 ? 'dash' : beat <= 7 ? 'installer' : beat <= 10 ? 'modules' : 'module'
  const extOpen = beat >= 3
  const uploaded = beat >= 5
  const installed = beat >= 7
  const moduleInstalled = beat >= 10

  return (
    <div className="absolute inset-0 bg-[#f5f5f5] text-[#2b2b2b]">
      {/* Pasul 1, în Hontrio: arhiva pentru versiunea magazinului */}
      <Screen on={page === 'hontrio'} className="bg-white [font-family:var(--font-geist-sans),system-ui,sans-serif]">
        <div className="px-[90px] pt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-black.png" alt="" className="h-[10px] w-auto" />
          <p className="mt-3 text-[15px] font-bold tracking-[-0.03em]">{t('onboarding.form_title_extension')}</p>
          <div data-t="o-dl" className="mt-3">
            <p className="mb-1.5 text-[8.5px] font-semibold tracking-[0.02em] text-neutral-500">{t('integrations.opencart_download')}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {['OpenCart 3.x', 'OpenCart 4.x'].map(v => (
                <span key={v} {...(v.endsWith('4.x') ? hit('o-dl-4', hot) : {})}
                  className={cn('flex h-[26px] items-center justify-center gap-1 rounded-full border border-[#e3e3e3] text-[9.5px] font-medium', hover, 'data-hot:border-neutral-900 data-hot:bg-neutral-50')}>
                  <Download className="size-[10px]" />{v}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* Descărcarea, ca în bara browserului */}
        {beat >= 1 && (
          <div className="absolute right-3 top-2.5 flex items-center gap-2 rounded-[10px] bg-white px-2.5 py-2 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.07]">
            <span className="grid size-[18px] place-items-center rounded-[5px] bg-neutral-100"><Check className="size-[10px]" strokeWidth={3} /></span>
            <span className="leading-tight">
              <span className="block text-[9px] font-semibold">hontrio.ocmod.zip</span>
              <span className="block text-[7.5px] text-neutral-500">66 KB</span>
            </span>
          </div>
        )}
      </Screen>

      {/* Panoul OpenCart */}
      <Screen on={page !== 'hontrio'}>
        <div className="absolute inset-x-0 top-0 flex h-[32px] items-center border-b border-[#e3e3e3] bg-white px-3">
          <span className="flex items-center gap-1 text-[13px] font-bold tracking-[-0.02em] text-[#3a3a3a]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/logos/opencart.png" alt="" className="h-[14px] w-auto grayscale" />opencart
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-[8.5px] text-[#555]"><span className="size-[15px] rounded-full bg-[#d6d6d6]" />Andrei ▾</span>
        </div>

        <nav className="absolute bottom-0 left-0 top-[32px] w-[118px] bg-[#23272b] text-[9px] text-white/80">
          <span className="flex h-[20px] items-center bg-[#1a1d20] pl-2.5 text-[7.5px] font-semibold tracking-[0.04em] text-white/70">≡ NAVIGATION</span>
          {MENU_TOP.map(label => <NavItem key={label} label={label} current={label === 'Dashboard' && !extOpen} />)}
          <NavItem label="Extensions" open={extOpen} current={extOpen} {...hit('o-ext', hot)} />
          {extOpen && SUB.map(label => (
            <span key={label} {...(label === 'Installer' ? hit('o-installer', hot) : label === 'Extensions' ? hit('o-extensions', hot) : {})}
              className={cn('flex h-[16px] items-center pl-[18px] text-[8.5px] text-white/50', hover, 'data-hot:text-white',
                ((label === 'Installer' && page === 'installer') || (label === 'Extensions' && (page === 'modules' || page === 'module'))) && 'text-white')}>
              <span className="mr-1 text-[7px] opacity-70">»</span>{label}
            </span>
          ))}
          {MENU_AFTER.map(label => <NavItem key={label} label={label} />)}
        </nav>

        <div className="absolute bottom-0 left-[118px] right-0 top-[32px] overflow-hidden">
          <Screen on={page === 'dash'} className="px-3.5 pt-2.5">
            <PageHead title="Dashboard" />
            <div className="mt-2 grid grid-cols-3 gap-2">
              {['TOTAL ORDERS', 'TOTAL SALES', 'TOTAL CUSTOMERS'].map(label => (
                <div key={label} className="rounded-[3px] bg-[#3d4248] p-2 text-white">
                  <p className="text-[6.5px] font-semibold tracking-[0.03em] opacity-80">{label}</p>
                  <p className="mt-2 text-right text-[16px] font-light">0</p>
                </div>
              ))}
            </div>
            <div className="mt-2 h-[90px] rounded-[3px] border border-[#e3e3e3] bg-white" />
          </Screen>

          <Screen on={page === 'installer'} className="px-3.5 pt-2.5">
            <div data-t="o-head" className="flex items-center justify-between">
              <PageHead title="Extension Installer" crumb="Extension Installer" />
              <span {...hit('o-upload', hot)} className={cn(action, 'size-[22px] bg-[#2b2f33]', hover, 'data-hot:bg-black')}><Upload className="size-[10px]" /></span>
            </div>
            <Card title="Extension Installer">
              <p className="text-[10.5px] font-light">Install Progress</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="w-[46px] text-right text-[7.5px] font-semibold">Progress</span>
                <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-[#e9ecef]">
                  {beat === 5 && <motion.span className="block h-full rounded-full bg-[#2b2f33]" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 0.9, ease: 'easeOut' }} />}
                  {beat >= 6 && <span className="block h-full w-full rounded-full bg-[#2b2f33]" />}
                </span>
              </div>
              <p className="mt-2.5 text-[10.5px] font-light">Installed Extensions</p>
              <div data-t="o-installed" className="mt-1.5 border border-[#e3e3e3] text-[8px]">
                <TableHead cols={['Extension Name', 'Version', 'Date Added', 'Action']} />
                {uploaded && (
                  <Row cells={['Hontrio', '1.0.0', '14/11/2026']}>
                    <span className={cn(action, 'bg-[#8a9096]')}><Info className="size-[8px]" /></span>
                    {installed
                      ? <span className={cn(action, 'bg-[#55595e]')}><Minus className="size-[8px]" /></span>
                      : <span {...hit('o-install', hot)} className={cn(action, 'bg-[#2b2f33]', hover, 'data-hot:bg-black data-hot:ring-2 data-hot:ring-black/20')}><Plus className="size-[8px]" /></span>}
                    <span className={cn(action, 'bg-[#a7abaf]')}><Trash2 className="size-[8px]" /></span>
                  </Row>
                )}
                <Row cells={['OpenCart Default Extensions', '1.0', '29/08/2020']} faded={false}>
                  <span className={cn(action, 'bg-[#8a9096]')}><Info className="size-[8px]" /></span>
                  <span className={cn(action, 'bg-[#55595e]')}><Minus className="size-[8px]" /></span>
                  <span className={cn(action, 'bg-[#a7abaf]')}><Trash2 className="size-[8px]" /></span>
                </Row>
              </div>
            </Card>
          </Screen>

          <Screen on={page === 'modules'} className="px-3.5 pt-2.5">
            <PageHead title="Extensions" crumb="Extensions" />
            <Card title="Extension List">
              <p className="text-[10.5px] font-light">Choose the extension type</p>
              <span className="mt-1.5 flex h-[19px] items-center justify-between rounded-[3px] border border-[#dee2e6] px-1.5 text-[8.5px]">Modules (14)<ChevronDown className="size-[9px]" /></span>
              <div data-t="o-modules" className="mt-2 border border-[#e3e3e3] text-[8px]">
                <TableHead cols={['Module Name', 'Action']} />
                {MODULES.slice(4).map(name => (
                  <Row key={name} cells={[name]} bold={name === 'Hontrio'}>
                    {name === 'Hontrio'
                      ? (moduleInstalled
                        ? <>
                            <span {...hit('o-mod-edit', hot)} className={cn(action, 'bg-[#2b2f33]', hover, 'data-hot:bg-black data-hot:ring-2 data-hot:ring-black/20')}><Pencil className="size-[8px]" /></span>
                            <span className={cn(action, 'bg-[#55595e]')}><Minus className="size-[8px]" /></span>
                          </>
                        : <span {...hit('o-mod-install', hot)} className={cn(action, 'bg-[#2b2f33]', hover, 'data-hot:bg-black data-hot:ring-2 data-hot:ring-black/20')}><Plus className="size-[8px]" /></span>)
                      : <><span className={cn(action, 'bg-[#2b2f33]')}><Pencil className="size-[8px]" /></span><span className={cn(action, 'bg-[#55595e]')}><Minus className="size-[8px]" /></span></>}
                  </Row>
                ))}
              </div>
            </Card>
          </Screen>

          <Screen on={page === 'module'} className="px-3.5 pt-2.5">
            <PageHead title="Hontrio" crumb="Extensions › Hontrio" />
            <Card title="Hontrio settings">
              <div className="space-y-2">
                <Field label="Store address"><span className="flex h-[20px] flex-1 items-center rounded-[3px] border border-[#dee2e6] px-1.5 text-[8.5px]">{shop}</span></Field>
                <div data-t="o-key">
                  <Field label="Hontrio key">
                    <span className="flex h-[20px] min-w-0 flex-1 items-center overflow-hidden rounded-l-[3px] border border-[#dee2e6] px-1.5 font-mono text-[7.5px]"><span className="truncate">{KEY}</span></span>
                    <span {...hit('o-copy', hot)} className={cn('-ml-px flex h-[20px] items-center gap-1 rounded-r-[3px] border border-[#dee2e6] bg-[#f8f9fa] px-1.5 text-[8px]', hover, 'data-hot:border-[#2b2f33] data-hot:bg-white')}>
                      <Copy className="size-[8px]" />{beat >= 12 ? 'Copied' : 'Copy'}
                    </span>
                  </Field>
                </div>
                <Field label="Hontrio API"><span className="flex h-[11px] w-[20px] items-center justify-end rounded-full bg-[#2b2f33] p-[1.5px]"><span className="size-[8px] rounded-full bg-white" /></span></Field>
              </div>
            </Card>
          </Screen>
        </div>
      </Screen>

      <HontrioCard on={beat >= 12} hot={hot} connected={beat >= 14}
        title={t('onboarding.form_title_extension')}
        fields={[
          { id: 'h-url', label: t('integrations.opencart_store_url'), value: shop, pasted: true },
          { id: 'h-key', label: t('integrations.opencart_api_key'), value: KEY, pasted: beat >= 13, mono: true },
        ]} />
    </div>
  )
}

function NavItem({ label, current, open, ...rest }: { label: string; current?: boolean; open?: boolean; 'data-t'?: string; 'data-hot'?: string }) {
  return (
    <span {...rest} className={cn('flex h-[20px] items-center gap-1.5 border-b border-white/[0.04] pl-2.5 pr-2', hover, 'data-hot:bg-white/[0.08] data-hot:text-white', current && 'bg-[#1a1d20] font-semibold text-white')}>
      <span className="size-[8px] shrink-0 rounded-[2px] bg-current opacity-60" />
      <span className="flex-1">{label}</span>
      {open ? <ChevronDown className="size-[8px]" /> : <ChevronRight className="size-[8px] opacity-70" />}
    </span>
  )
}

function PageHead({ title, crumb }: { title: string; crumb?: string }) {
  return (
    <p className="flex items-baseline gap-2">
      <span className="text-[15px] font-light text-[#3a3a3a]">{title}</span>
      {crumb && <span className="text-[8px] text-[#888]">Home › {crumb}</span>}
    </p>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-2 border border-[#e3e3e3] bg-white">
      <p className="flex items-center gap-1.5 border-b border-[#e3e3e3] bg-[#f8f8f8] px-2 py-1.5 text-[8.5px]"><Puzzle className="size-[9px]" />{title}</p>
      <div className="px-2.5 py-2">{children}</div>
    </div>
  )
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <div className="flex border-b border-[#e3e3e3] px-1.5 py-1 font-semibold">
      {cols.map((c, i) => <span key={c} className={cn(i === 0 ? 'flex-[2.2]' : 'flex-1', i === cols.length - 1 && 'text-right')}>{c}</span>)}
    </div>
  )
}

function Row({ cells, bold, faded, children }: { cells: string[]; bold?: boolean; faded?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex items-center border-b border-[#efefef] px-1.5 py-[3px] last:border-b-0', faded && 'opacity-50')}>
      {cells.map((c, i) => <span key={c} className={cn(i === 0 ? 'flex-[2.2]' : 'flex-1', bold && i === 0 && 'font-semibold')}>{c}</span>)}
      <span className="flex flex-1 justify-end gap-[3px]">{children}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[62px] shrink-0 text-right text-[8px] font-semibold">{label}</span>
      <span className="flex min-w-0 flex-1 items-center">{children}</span>
    </div>
  )
}

export const OPENCART: Scene = { beats: BEATS, Screen: OpenCartScreen }
