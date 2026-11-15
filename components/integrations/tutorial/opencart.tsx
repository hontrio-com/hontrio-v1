'use client'
// i18n-content-file: panoul OpenCart 4 (în engleză, limba lui de bază) și pagina extensiei Hontrio din el

import type { CSSProperties, ReactNode } from 'react'
import { Open_Sans } from 'next/font/google'
import { motion } from 'framer-motion'
import {
  Bell, Calendar, ChartBar, Check, ChevronDown, ChevronRight, ChevronUp, ChevronsRight, CircleMinus, CirclePlus, Copy, CreditCard, Download,
  FolderOpen, Funnel, Globe, House, Info, Link, LogOut, Menu, Monitor, Pencil, Puzzle, Reply, RotateCw, Save, Settings, Share2, ShoppingCart,
  Tag, Trash2, Upload, User, Users,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { CLICK_AT, Frame, HontrioCard, Page, Screen, UNIT, hit, hover } from './parts'
import type { Beat, Scene, SceneProps } from './player'

// =============================================
// Ghidul OpenCart, după capturile panoului OpenCart 4.0.2.3 (antetul, meniul,
// Dashboard) și după aceeași versiune instalată local (Installer, Extensions,
// pagina extensiei Hontrio): arhiva descărcată din Hontrio → Extensions →
// Installer (urcată, apoi instalată) → Extensions → Extensions → Modules →
// Hontrio (instalat, apoi deschis) → cheia copiată și lipită în Hontrio.
// API-ul nativ (System → Users → API) nu poate citi produsele și comenzile,
// de aceea conectarea trece prin extensia Hontrio.
// =============================================

const openSans = Open_Sans({ subsets: ['latin'], weight: ['300', '400', '700'], display: 'swap', preload: false })

/** Pagina e mai lungă decât fereastra (lista de module): camera coboară pe ea. */
const PAGE_HEIGHT = 1760

const KEY = '9f2c41d7a03b8e65c1f4d92a7e0b36c58d1a4f7e2b9c06d3'
const ADMIN = '{shop}/admin/index.php?route='

// Data de azi, ca în lista Installer (zz/ll/aaaa)
const TODAY = (() => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
})()

const BEATS: Beat[] = [
  /* 0 */ { ms: 1450, step: 0, to: 'o-dl-4', click: true, cam: { on: 'o-dl', z: 1.3 }, url: 'app.hontrio.com/onboarding' },
  /* 1 */ { ms: 1100, step: 0 },
  /* 2 */ { ms: 1500, step: 1, to: 'o-ext', click: true, cam: { z: 1 }, url: `${ADMIN}common/dashboard` },
  /* 3 */ { ms: 1200, step: 1, to: 'o-sub-installer', click: true, cam: { on: 'f-nav' } },
  /* 4 */ { ms: 1350, step: 1, to: 'o-upload', click: true, cam: { on: 'f-inst-head' }, url: `${ADMIN}marketplace/installer` },
  /* 5 */ { ms: 1600, step: 1, cam: { on: 'f-inst-left' } },
  /* 6 */ { ms: 1250, step: 1, to: 'o-install', click: true, cam: { on: 'f-inst-right' } },
  /* 7 */ { ms: 800, step: 1 },
  /* 8 */ { ms: 1300, step: 2, to: 'o-sub-extensions', click: true, cam: { on: 'f-nav' } },
  /* 9 */ { ms: 1300, step: 2, to: 'o-type', click: true, cam: { on: 'f-type' }, url: `${ADMIN}marketplace/extension` },
  /* 10 */ { ms: 1050, step: 2, to: 'o-type-module', click: true },
  /* 11 */ { ms: 1300, step: 2, to: 'o-hontrio-name', cam: { on: 'f-row-left' } },
  /* 12 */ { ms: 1200, step: 2, to: 'o-mod-install', click: true, cam: { on: 'f-row-right' } },
  /* 13 */ { ms: 1150, step: 2, to: 'o-mod-edit', click: true },
  /* 14 */ { ms: 1300, step: 3, to: 'o-key', cam: { on: 'f-key-left' }, url: `${ADMIN}extension/hontrio/module/hontrio` },
  /* 15 */ { ms: 1200, step: 3, to: 'o-copy', click: true, cam: { on: 'f-key-right' } },
  /* 16 */ { ms: 1400, step: 3, to: 'h-key', click: true, cam: { on: 'h-card', z: 1.12 }, url: 'app.hontrio.com/onboarding' },
  /* 17 */ { ms: 1150, step: 3, to: 'h-connect', click: true },
  /* 18 */ { ms: 1900, step: 3 },
]

// Culorile panoului OpenCart 4.0.2.3, măsurate pe capturi
const C = {
  nav: '#242d37', navHead: '#19222e', navCurrent: '#171b21', navText: '#b3cbdd', navLine: '#2b3642', sub: '#293141', subText: '#7f8a9b', active: '#0b91d2',
  bg: '#f6f6f6', title: '#4c4d5a', text: '#212529', link: '#1e91cf', line: '#dee2e6', cardLine: '#d2d2d2', muted: '#595c5f',
}
const BTN: Record<string, CSSProperties> = {
  primary: { background: '#1e91cf', borderColor: '#1872a2', color: '#fff' },
  success: { background: '#4cb64c', borderColor: '#3c933c', color: '#fff' },
  warning: { background: '#f3a638', borderColor: '#ea8f0e', color: '#fff' },
  danger: { background: '#e3503e', borderColor: '#d0321e', color: '#fff' },
  info: { background: '#54b7d3', borderColor: '#32a2c2', color: '#fff' },
  light: { background: '#fff', borderColor: '#ced4da', color: '#000' },
  outlinePrimary: { background: 'transparent', borderColor: '#1e91cf', color: '#1e91cf' },
  outlineDanger: { background: 'transparent', borderColor: '#e3503e', color: '#e3503e' },
}
const HOT_BG: Record<string, string> = {
  primary: 'data-hot:bg-[#1872a2]!', success: 'data-hot:bg-[#3c933c]!', warning: 'data-hot:bg-[#ea8f0e]!', light: 'data-hot:bg-[#e2e6ea]!',
}
/**
 * Tranziția efectelor care vin imediat după clic: în stil, pentru că regula globală din
 * globals.css (în afara straturilor Tailwind) ar anula clasele transition-*.
 */
const fade = (delayed: boolean) => ({ transition: `opacity 0.1s ease ${delayed ? CLICK_AT : 0}s` })

const MENU = [
  { label: 'Dashboard', icon: <House fill="currentColor" /> },
  { label: 'Catalog', icon: <Tag fill="currentColor" stroke={C.nav} /> },
  { label: 'Extensions', icon: <Puzzle fill="currentColor" /> },
  { label: 'Design', icon: <Monitor /> },
  { label: 'Sales', icon: <ShoppingCart fill="currentColor" /> },
  { label: 'Customers', icon: <User fill="currentColor" /> },
  { label: 'Marketing', icon: <Share2 fill="currentColor" /> },
  { label: 'System', icon: <Settings fill="currentColor" stroke={C.nav} /> },
  { label: 'Reports', icon: <ChartBar /> },
]
const EXT_SUB = ['Marketplace', 'Installer', 'Extensions', 'Startup', 'Events', 'Cron Jobs']
const TYPES = ['Analytics (0)', 'Captchas (1)', 'Currency Rates (2)', 'Dashboard (8)', 'Feeds (0)', 'Anti-Fraud (1)', 'Languages (0)', 'Marketplaces (0)', 'Modules (12)', 'Other (0)', 'Payments (4)', 'Reports (15)', 'Shipping (5)', 'Themes (1)', 'Order Totals (10)']
type Mod = { name: string; status: string; kind: 'installed' | 'multi' | 'child' | 'available' }
const MODULES: Mod[] = [
  { name: 'Account', status: 'Enabled', kind: 'installed' },
  { name: 'Banner', status: '', kind: 'multi' },
  { name: 'Category Banner', status: 'Enabled', kind: 'child' },
  { name: 'Homepage Manufacturers', status: 'Enabled', kind: 'child' },
  { name: 'Homepage Slideshow', status: 'Enabled', kind: 'child' },
  { name: 'Best Sellers', status: 'Disabled', kind: 'available' },
  { name: 'Category', status: 'Enabled', kind: 'installed' },
  { name: 'Featured', status: '', kind: 'multi' },
  { name: 'Featured', status: 'Enabled', kind: 'child' },
  { name: 'Filter', status: 'Disabled', kind: 'available' },
  { name: 'HTML Content', status: 'Disabled', kind: 'available' },
  { name: 'Hontrio', status: 'Disabled', kind: 'available' },
  { name: 'Information', status: 'Disabled', kind: 'available' },
  { name: 'Latest', status: 'Disabled', kind: 'available' },
  { name: 'Specials', status: 'Disabled', kind: 'available' },
  { name: 'Store', status: 'Disabled', kind: 'available' },
]

function OpenCartScreen({ beat, hot }: SceneProps) {
  const { locale, t } = useT()
  const shop = locale === 'ro' ? 'https://www.magazinul-tau.ro' : 'https://www.your-store.com'
  const page = beat <= 1 ? 'hontrio' : beat <= 3 ? 'dash' : beat <= 8 ? 'installer' : beat <= 13 ? 'extensions' : 'module'

  return (
    <div className="absolute inset-0 bg-white">
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
          // În cadrul camerei (apropiată pe butoane), ca să nu fie tăiată la margine
          <div className="absolute right-[64px] top-2.5 flex items-center gap-2 rounded-[10px] bg-white px-2.5 py-2 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.07]">
            <span className="grid size-[18px] place-items-center rounded-[5px] bg-neutral-100"><Check className="size-[10px]" strokeWidth={3} /></span>
            <span className="leading-tight">
              <span className="block text-[9px] font-semibold">hontrio.ocmod.zip</span>
              <span className="block text-[7.5px] text-neutral-500">66 KB</span>
            </span>
          </div>
        )}
      </Screen>

      {/* Panoul OpenCart, la mărime reală */}
      <Screen on={page !== 'hontrio'}>
        <Page height={PAGE_HEIGHT} className={openSans.className}>
          <div className="absolute inset-0 text-[13px] leading-[1.4]" style={{ background: C.bg, color: '#545454' }}>
            <Header />
            <Nav page={page} beat={beat} hot={hot} />
            <div className="absolute bottom-0 left-[235px] right-0 top-[67px]">
              <Screen on={page === 'dash'}><Dashboard /></Screen>
              <Screen on={page === 'installer'}><Installer beat={beat} hot={hot} /></Screen>
              <Screen on={page === 'extensions'}><Extensions beat={beat} hot={hot} /></Screen>
              <Screen on={page === 'module'}><HontrioModule beat={beat} hot={hot} shop={shop} /></Screen>
            </div>

            {/* Cadrele camerei (în pixeli ai panoului) */}
            <Frame id="f-nav" x={0} y={120} w={420} h={320} />
            <Frame id="f-inst-head" x={250} y={70} w={1020} h={260} />
            <Frame id="f-inst-left" x={255} y={210} w={565} h={350} />
            <Frame id="f-inst-right" x={700} y={380} w={565} h={180} />
            <Frame id="f-type" x={255} y={260} w={565} h={380} />
            <Frame id="f-row-left" x={255} y={1130} w={565} h={330} />
            <Frame id="f-row-right" x={700} y={1130} w={565} h={330} />
            <Frame id="f-key-left" x={255} y={400} w={565} h={300} />
            <Frame id="f-key-right" x={700} y={400} w={565} h={300} />
          </div>
        </Page>
      </Screen>

      <HontrioCard on={beat >= 16} hot={hot} connected={beat >= 18}
        title={t('onboarding.form_title_extension')}
        fields={[
          { id: 'h-url', label: t('integrations.opencart_store_url'), value: shop, pasted: true },
          { id: 'h-key', label: t('integrations.opencart_api_key'), value: KEY, pasted: beat >= 16, mono: true, delay: beat === 16 ? CLICK_AT : 0 },
        ]} />
    </div>
  )
}

// ——— Antetul și meniul ———

function Header() {
  return (
    <div className="absolute inset-x-0 top-0 z-10 h-[67px] border-b border-[#d8d8d8] bg-white shadow-[0_1px_0_#e6e6e6]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/guides/opencart/logo.png" alt="" width={180} height={35} className="absolute left-[20px] top-[16px]" />
      <div className="absolute right-[30px] top-0 flex h-[66px] items-center text-[13px]" style={{ color: '#545454' }}>
        <Bell className="mr-[29px] size-[23px]" strokeWidth={1.6} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/guides/opencart/en-gb.png" alt="" width={16} height={11} className="mr-[24px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/guides/opencart/profile.png" alt="" width={36} height={36} className="mr-[9px] rounded-full" />
        John Doe
        <svg width="10" height="6" viewBox="0 0 10 6" className="ml-[6px] mr-[24px]"><path d="M0 0h10L5 6Z" fill="currentColor" /></svg>
        <LogOut className="mr-[4px] size-[13px]" strokeWidth={2.4} />Logout
      </div>
    </div>
  )
}

function Nav({ page, beat, hot }: { page: string; beat: number; hot: string | undefined }) {
  const open = beat >= 3
  const inExtensions = page === 'installer' || page === 'extensions' || page === 'module'
  const activeSub = page === 'installer' ? 'Installer' : page === 'extensions' || page === 'module' ? 'Extensions' : ''
  return (
    <nav className="absolute bottom-0 left-0 top-[67px] w-[235px]" style={{ background: C.nav }}>
      <span className="flex h-[41px] items-center gap-[4px] pl-[15px] text-[13px] text-white" style={{ background: C.navHead }}><Menu className="size-[14px]" strokeWidth={3} />NAVIGATION</span>
      {MENU.map(item => {
        const current = item.label === 'Dashboard' ? page === 'dash' : item.label === 'Extensions' && inExtensions
        const isExt = item.label === 'Extensions'
        return (
          <div key={item.label}>
            <span {...(isExt ? hit('o-ext', hot) : {})}
              className={cn('flex h-[40.6px] items-center border-b pl-[20px] pr-[18px] text-[14px]', hover, 'data-hot:text-white!')}
              style={{ borderColor: C.navLine, background: current ? C.navCurrent : undefined, color: current ? C.active : C.navText }}>
              <span className="mr-[13px] grid w-[14px] place-items-center [&>svg]:size-[15px] [&>svg]:stroke-[2]">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.label !== 'Dashboard' && (isExt && open ? <ChevronDown className="size-[13px]" strokeWidth={3} /> : <ChevronRight className="size-[13px]" strokeWidth={3} />)}
            </span>
            {isExt && open && (
              <motion.div initial={beat === 3 ? { height: 0 } : false} animate={{ height: 'auto' }} transition={{ duration: 0.3, ease: 'easeOut' }} className="overflow-hidden" style={{ background: C.sub }}>
                {EXT_SUB.map(label => {
                  const active = label === activeSub
                  return (
                    <span key={label} {...(label === 'Installer' ? hit('o-sub-installer', hot) : label === 'Extensions' ? hit('o-sub-extensions', hot) : {})}
                      className={cn('flex h-[39.2px] items-center pl-[30px] text-[13px]', hover, 'data-hot:text-white!')}
                      style={{ color: active ? C.active : C.subText, background: active ? C.nav : undefined }}>
                      <ChevronsRight className="mr-[10px] size-[13px]" strokeWidth={2.2} />{label}
                    </span>
                  )
                })}
              </motion.div>
            )}
          </div>
        )
      })}
      {/* Starea comenzilor, sub meniu */}
      <div className="mx-[20px] mt-[26px] rounded-[3px] px-[10px] py-[8px]" style={{ background: '#2e3a47' }}>
        {[['Orders Completed', '0%'], ['Orders Processing', '100%'], ['Other Statuses', '0%']].map(([label, value]) => (
          <div key={label} className="py-[6px] text-[9.75px]" style={{ color: '#9d9d9d' }}>
            <span className="flex justify-between">{label}<span>{value}</span></span>
            <span className="mt-[5px] block h-[3px] rounded-[3px] bg-[#e9ecef]" />
          </div>
        ))}
      </div>
    </nav>
  )
}

// ——— Piese comune ale paginilor ———

function PageHead({ title, crumbs, children }: { title: string; crumbs: string[]; children?: ReactNode }) {
  return (
    <div className="relative h-[76px] border-b border-[#e9e9e9]">
      <p className="absolute left-[20px] top-[20px] flex items-baseline whitespace-nowrap">
        <span className="text-[30px] font-light leading-[36px]" style={{ color: C.title }}>{title}</span>
        <span className="ml-[13px] flex items-center text-[14.77px]">
          {['Home', ...crumbs].map((c, i, all) => (
            <span key={c} className="flex items-center">
              {i > 0 && <ChevronRight className="mx-[8px] size-[12px]" strokeWidth={2} style={{ color: '#ced4da' }} />}
              <span style={{ color: i === all.length - 1 ? C.link : '#6c757d' }}>{c}</span>
            </span>
          ))}
        </span>
      </p>
      {children && <div className="absolute right-[20px] top-[20px] flex gap-[3px]">{children}</div>}
    </div>
  )
}

function Card({ icon, title, className, children }: { icon: ReactNode; title: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-[3.7px] border bg-white', className)} style={{ borderColor: C.cardLine }}>
      <p className="flex h-[47px] items-center gap-[8px] rounded-t-[2.7px] border-b bg-[#f8f8f8] px-[16px] text-[15px]" style={{ borderColor: C.cardLine, color: C.text }}>
        <span className="[&>svg]:size-[15px]">{icon}</span>{title}
      </p>
      <div className="p-[16px]">{children}</div>
    </div>
  )
}

function Legend({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mb-[16px] border-b border-[#e5e5e5] text-[24px] leading-[34px]', className)} style={{ color: C.text }}>{children}</p>
}

function Btn({ kind, icon, label, className, style, ...rest }: { kind: keyof typeof BTN; icon?: ReactNode; label?: ReactNode; className?: string; style?: CSSProperties; 'data-t'?: string; 'data-hot'?: string }) {
  return (
    <span {...rest} className={cn('inline-flex h-[37px] items-center justify-center gap-[5px] rounded-[3.7px] border px-[12.3px] text-[13px] [&>svg]:size-[13px]', hover, HOT_BG[kind], className)}
      style={{ ...BTN[kind], ...style }}>
      {icon}{label}
    </span>
  )
}

/** Iconițele pline din butoane (plus, minus în cerc), cu semnul în culoarea butonului. */
function Round({ kind, plus }: { kind: string; plus?: boolean }) {
  const bg = (BTN[kind]?.background as string) ?? '#fff'
  return plus ? <CirclePlus fill="#fff" stroke={bg} strokeWidth={2.6} /> : <CircleMinus fill="#fff" stroke={bg} strokeWidth={2.6} />
}

function Th({ children, className, style }: { children?: ReactNode; className?: string; style?: CSSProperties }) {
  return <span className={cn('flex h-[36px] items-center border-r px-[8px] text-[13px] font-bold text-black last:border-r-0', className)} style={{ borderColor: C.line, ...style }}>{children}</span>
}

function Td({ children, className, style }: { children?: ReactNode; className?: string; style?: CSSProperties }) {
  return <span className={cn('flex h-[54px] items-center border-r px-[8px] text-[13px] text-black last:border-r-0', className)} style={{ borderColor: C.line, ...style }}>{children}</span>
}

function Footer({ top }: { top: number }) {
  return (
    <p className="absolute inset-x-0 text-center text-[13px] leading-[18.2px]" style={{ top, color: '#545454' }}>
      <span style={{ color: C.link }}>OpenCart</span> © 2009-2026 All Rights Reserved.<br />Version 4.0.2.3
    </p>
  )
}

// ——— Dashboard ———

function Dashboard() {
  const tiles = [
    { title: 'TOTAL ORDERS', change: '0%', value: '186', icon: <ShoppingCart fill="currentColor" /> },
    { title: 'TOTAL SALES', change: '▲ 12%', value: '48.2K', icon: <CreditCard fill="currentColor" stroke="#1b80c2" /> },
    { title: 'TOTAL CUSTOMERS', change: '0%', value: '1.3K', icon: <User fill="currentColor" /> },
    { title: 'PEOPLE ONLINE', change: '', value: '3', icon: <Users fill="currentColor" /> },
  ]
  return (
    <div className="absolute inset-0">
      <PageHead title="Dashboard" crumbs={['Dashboard']}>
        <Btn kind="info" icon={<Settings fill="#fff" stroke="#54b7d3" strokeWidth={2.4} />} className="w-[40px] px-0" />
      </PageHead>
      <div className="absolute left-[20px] right-[20px] top-[92px]">
        <div className="grid grid-cols-4 gap-[24px]">
          {tiles.map(tile => (
            <div key={tile.title} className="overflow-hidden rounded-[3px] text-white" style={{ background: '#1b80c2' }}>
              <p className="flex h-[28px] items-center justify-between px-[8px] text-[13px]" style={{ background: '#328dc8' }}>{tile.title}<span className="text-[12px]">{tile.change}</span></p>
              <div className="flex h-[94px] items-center justify-between px-[15px]">
                <span className="[&>svg]:size-[58px] [&>svg]:stroke-[1.5]" style={{ color: '#60a6d4' }}>{tile.icon}</span>
                <span className="text-[44px] font-light leading-none">{tile.value}</span>
              </div>
              <p className="flex h-[27px] items-center px-[8px] text-[13px]" style={{ background: '#1873ae' }}>View more...</p>
            </div>
          ))}
        </div>

        <div className="mt-[32px] grid grid-cols-2 gap-[26px]">
          <Card icon={<Globe />} title="World Map" className="h-[340px]">
            <div className="relative h-[260px]">
              <span className="absolute left-0 top-0 flex flex-col gap-[6px]">
                {['+', '−'].map(s => <span key={s} className="grid size-[13px] place-items-center rounded-[2px] bg-black text-[11px] font-bold leading-none text-white">{s}</span>)}
              </span>
              <WorldMap />
            </div>
          </Card>
          <Card icon={<ChartBar />} title="Sales Analytics" className="h-[340px]">
            <SalesChart />
          </Card>
        </div>

        <div className="mt-[34px] grid grid-cols-[318px_1fr] gap-[26px]">
          <Card icon={<Calendar />} title="Recent Activity"><p className="text-center text-black">No results!</p></Card>
          <Card icon={<ShoppingCart fill="currentColor" />} title="Latest Orders"><p className="text-black">&nbsp;</p></Card>
        </div>
      </div>
    </div>
  )
}

/** Harta lumii din Dashboard, cu continentele simplificate (lon/lat → x/y). */
function WorldMap() {
  const shapes = [
    [[-168, 66], [-140, 70], [-100, 72], [-80, 73], [-62, 66], [-55, 52], [-66, 45], [-75, 35], [-81, 25], [-97, 26], [-97, 18], [-87, 15], [-83, 9], [-78, 8], [-90, 16], [-105, 20], [-117, 32], [-124, 40], [-125, 49], [-135, 58], [-150, 60], [-165, 60]],
    [[-73, 78], [-20, 83], [-18, 72], [-42, 60], [-55, 64]],
    [[-80, 9], [-60, 10], [-50, 0], [-35, -6], [-40, -22], [-48, -28], [-58, -38], [-65, -55], [-72, -50], [-75, -35], [-70, -18], [-81, -5]],
    [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [8, 54], [10, 58], [5, 62], [15, 69], [28, 71], [40, 67], [40, 60], [30, 57], [28, 45], [24, 40], [18, 40], [12, 44], [8, 44], [3, 43], [-2, 37]],
    [[-6, 50], [2, 51], [-2, 58], [-6, 57]],
    [[-17, 21], [-10, 30], [-6, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [40, -2], [40, -15], [35, -25], [20, -35], [17, -28], [12, -15], [12, -5], [8, 4], [-8, 4], [-15, 10]],
    [[28, 45], [30, 57], [40, 67], [60, 70], [80, 73], [105, 78], [140, 72], [170, 70], [180, 66], [160, 58], [140, 55], [135, 43], [122, 40], [120, 30], [110, 20], [105, 10], [100, 2], [98, 10], [92, 22], [80, 8], [72, 20], [60, 25], [50, 30], [48, 28], [55, 22], [43, 13], [35, 30], [36, 36]],
    [[130, 31], [141, 36], [142, 44], [138, 38]],
    [[95, 5], [106, -6], [116, -8], [120, 0], [110, 2], [100, 2]],
    [[114, -22], [122, -18], [131, -12], [137, -12], [142, -11], [146, -19], [153, -28], [150, -37], [140, -38], [131, -31], [115, -34]],
    [[166, -46], [174, -41], [178, -38], [172, -44]],
  ]
  const pt = ([lon, lat]: number[]) => `${((lon + 180) / 360 * 400).toFixed(1)},${((84 - lat) / 144 * 200).toFixed(1)}`
  return (
    <svg viewBox="0 0 400 200" className="absolute left-[30px] top-[8px] h-[248px] w-[420px]">
      {shapes.map((s, i) => <polygon key={i} points={s.map(pt).join(' ')} fill="#9fd5f1" stroke="#fff" strokeWidth="0.6" strokeLinejoin="round" />)}
    </svg>
  )
}

function SalesChart() {
  const orders = [26, 18, 28, 15, 2, 15, 22, 19, 56, 10, 13, 15, 22, 17, 19]
  return (
    <div className="relative h-[260px] text-[10.8px]" style={{ color: '#545454' }}>
      <div className="absolute bottom-[22px] left-[24px] right-[4px] top-[8px] border-2" style={{ borderColor: '#545454' }}>
        {[1, 2, 3, 4, 5].map(i => <span key={i} className="absolute inset-x-0 border-t border-[#e0e0e0]" style={{ bottom: `${i * (100 / 6)}%` }} />)}
        <div className="absolute inset-0 flex items-end gap-[1px] px-[1px]">
          {Array.from({ length: 30 }, (_, i) => (
            <span key={i} className="flex-1 border border-b-0" style={{ height: `${((orders[i] ?? 0) / 60) * 100}%`, background: '#9fc1ed', borderColor: orders[i] ? '#1266d2' : 'transparent' }} />
          ))}
        </div>
        <span className="absolute right-[6px] top-[6px] border bg-white/80 px-[4px] py-[2px] leading-[16px]" style={{ borderColor: '#ccc' }}>
          <span className="flex items-center gap-[4px]"><span className="size-[10px] border border-[#ccc] bg-[#9fc1ed]" />Orders</span>
          <span className="flex items-center gap-[4px]"><span className="size-[10px] border border-[#ccc] bg-[#0f4fa8]" />Customers</span>
        </span>
      </div>
      {[0, 10, 20, 30, 40, 50, 60].map((v, i) => <span key={v} className="absolute left-0 w-[20px] text-right" style={{ bottom: `${22 + i * ((260 - 30) / 6) - 6}px` }}>{v}</span>)}
    </div>
  )
}

// ——— Extensions → Installer ———

function Installer({ beat, hot }: { beat: number; hot: string | undefined }) {
  const uploaded = beat >= 5
  const installed = beat >= 7
  const rows = [
    ...(uploaded ? [{ name: 'Hontrio', version: '1.0.0', date: TODAY, hontrio: true }] : []),
    { name: 'OpenCart Default Extensions', version: '1.0', date: '29/08/2020', hontrio: false },
  ]
  return (
    <div className="absolute inset-0">
      <PageHead title="Extension Installer" crumbs={['Extension Installer']}>
        <Btn kind="primary" icon={<Upload strokeWidth={3} />} className="w-[40px] px-0" {...hit('o-upload', hot)} />
      </PageHead>
      <div className="absolute left-[20px] right-[20px] top-[92px]">
        <Card icon={<Puzzle fill="currentColor" />} title="Extension Installer">
          <Legend>Install Progress</Legend>
          <div className="flex h-[37px] items-center">
            <span className="w-[166px] shrink-0 pr-[12px] text-right font-bold" style={{ color: C.text }}>Progress</span>
            <span className="ml-[12px] h-[16px] flex-1 overflow-hidden rounded-[3.7px] bg-[#e9ecef]">
              {beat === 5 && <motion.span className="block h-full bg-[#4cb64c]" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 0.9, ease: 'easeOut' }} />}
              {beat >= 6 && <span className="block h-full w-full bg-[#4cb64c]" />}
            </span>
          </div>
          <Legend className="mt-[37px]">Installed Extensions</Legend>
          <div className="border" style={{ borderColor: C.line }}>
            <div className="grid grid-cols-[410px_140px_197px_1fr] border-b" style={{ borderColor: C.line }}>
              <Th style={{ color: C.link }}>Extension Name<ChevronUp className="ml-[3px] size-[12px]" strokeWidth={3} /></Th>
              <Th style={{ color: C.link }}>Version</Th>
              <Th style={{ color: C.link }}>Date Added</Th>
              <Th className="justify-end">Action</Th>
            </div>
            {rows.map(r => (
              <motion.div key={r.name} initial={r.hontrio && beat === 5 ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: 0.95, duration: 0.25 }}
                className="grid grid-cols-[410px_140px_197px_1fr] border-b last:border-b-0" style={{ borderColor: C.line }}>
                <Td style={{ color: C.link }}>{r.name}</Td>
                <Td>{r.version}</Td>
                <Td>{r.date}</Td>
                <Td className="justify-end gap-[3px]">
                  {r.hontrio && !installed
                    ? <Btn kind="success" icon={<Round kind="success" plus />} className="w-[40px] px-0" {...hit('o-install', hot)} />
                    : <Btn kind="warning" icon={<Round kind="warning" />} className="w-[40px] px-0" />}
                  <Btn kind="danger" icon={<Trash2 strokeWidth={2.4} />} className={cn('w-[38px] px-0', (!r.hontrio || installed) && 'opacity-65')} />
                </Td>
              </motion.div>
            ))}
          </div>
          <p className="mt-[16px] text-right" style={{ color: C.text }}>Showing 1 to {rows.length} of {rows.length} (1 Pages)</p>
        </Card>
      </div>
      <Footer top={720} />
    </div>
  )
}

// ——— Extensions → Extensions ———

function Extensions({ beat, hot }: { beat: number; hot: string | undefined }) {
  const modules = beat >= 11
  const open = beat === 10
  const hontrioInstalled = beat >= 13
  return (
    <div className="absolute inset-0">
      <PageHead title="Extensions" crumbs={['Extensions']} />
      <div className="absolute left-[20px] right-[20px] top-[92px]">
        <Card icon={<Puzzle fill="currentColor" />} title="Extension List">
          <Legend>Choose the extension type</Legend>
          <div className="relative rounded-[3.7px] border p-[16px]" style={{ borderColor: C.line }}>
            <div className="flex">
              <span {...hit('o-type', hot)} className={cn('flex h-[37px] flex-1 items-center justify-between rounded-l-[3.7px] border pl-[12.3px] pr-[14px]', hover, 'data-hot:border-[#8fc9e8]!')}
                style={{ borderColor: open ? '#8fc9e8' : C.line, color: C.text, boxShadow: open ? '0 0 0 3.2px rgba(30,145,207,0.25)' : undefined }}>
                {modules ? 'Modules (12)' : 'Analytics (0)'}<ChevronDown className="size-[15px]" strokeWidth={2} />
              </span>
              <Btn kind="light" icon={<Funnel fill="currentColor" />} label="Filter" className="rounded-l-none border-l-0 bg-[#f8f9fa]" style={{ background: '#f8f9fa' }} />
            </div>
            {/* Lista deschisă a câmpului (cea a sistemului) */}
            {open && (
              <div className="absolute left-[16px] top-[53px] z-10 w-[865px] border border-[#767676] bg-white py-[1px] shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                {TYPES.map(type => {
                  // Lista se deschide cu tipul ales evidențiat; evidențierea trece pe Modules când ajunge cursorul
                  const from = type.startsWith('Analytics')
                  const to = type.startsWith('Modules')
                  const on = { backgroundColor: '#0078d7', color: '#ffffff' }
                  const off = { backgroundColor: '#ffffff', color: '#000000' }
                  return (
                    <motion.span key={type} {...(to ? hit('o-type-module', hot) : {})} className="flex h-[20px] items-center px-[4px] text-[13px]"
                      initial={from ? on : off} animate={to ? on : off} transition={{ duration: 0.08, delay: from || to ? 0.52 : 0 }} style={{ transition: 'none' }}>
                      {type}
                    </motion.span>
                  )
                })}
              </div>
            )}
          </div>

          {!modules && (
            <>
              <Legend className="mt-[21px]">Analytics</Legend>
              <div className="border" style={{ borderColor: C.line }}>
                <div className="grid grid-cols-[488px_240px_1fr] border-b" style={{ borderColor: C.line }}>
                  <Th>Analytics Name</Th><Th>Status</Th><Th className="justify-end">Action</Th>
                </div>
                <p className="flex h-[36px] items-center justify-center text-black">No results!</p>
              </div>
            </>
          )}

          {modules && (
            <>
              <Legend className="mt-[21px]">Recommended</Legend>
              <div className="border" style={{ borderColor: C.line }}>
                <div className="grid grid-cols-[633px_1fr] border-b" style={{ borderColor: C.line }}><Th>Module Name</Th><Th className="justify-end">Action</Th></div>
                <div className="grid grid-cols-[633px_1fr]">
                  <Td style={{ color: C.link }}>Facebook for OpenCart</Td>
                  <Td className="justify-end">
                    <Btn kind="primary" icon={<Download strokeWidth={3} />} className="w-[40px] rounded-r-none px-0" />
                    <Btn kind="light" icon={<svg width="9" height="6" viewBox="0 0 9 6"><path d="M0 0h9L4.5 6Z" fill="currentColor" /></svg>} className="w-[29px] rounded-l-none border-l-0 px-0" style={{ borderColor: '#212529', background: 'transparent' }} />
                  </Td>
                </div>
              </div>

              <Legend className="mt-[37px]">Modules</Legend>
              <p className="flex h-[52px] items-center gap-[5px] rounded-[3.7px] border px-[16px]" style={{ background: '#ddf1f6', borderColor: '#bbe2ed', color: '#224954' }}>
                <Info className="size-[13px]" fill="#224954" stroke="#ddf1f6" strokeWidth={2.4} />After you have installed and configured a module you can add it to a layout <b>here</b>!
              </p>
              <div className="mt-[17px] border" style={{ borderColor: C.line }}>
                <div className="grid grid-cols-[538px_178px_1fr] border-b" style={{ borderColor: C.line }}><Th>Module Name</Th><Th>Status</Th><Th className="justify-end">Action</Th></div>
                {MODULES.map((m, i) => {
                  const isHontrio = m.name === 'Hontrio'
                  const kind = isHontrio && hontrioInstalled ? 'installed' : m.kind
                  return (
                    <div key={`${m.name}-${i}`} className="grid h-[54.4px] grid-cols-[538px_178px_1fr] border-b last:border-b-0" style={{ borderColor: C.line }}>
                      <Td className={cn(kind !== 'child' && 'font-bold', kind === 'child' && 'pl-[16px]')}>
                        {kind === 'child' && <FolderOpen className="mr-[10px] size-[14px]" fill="#000" stroke="#fff" strokeWidth={1.4} />}
                        <span {...(isHontrio ? hit('o-hontrio-name', hot) : {})}>{m.name}</span>
                      </Td>
                      <Td>{isHontrio && hontrioInstalled ? 'Enabled' : m.status}</Td>
                      <Td className="justify-end gap-[3px]">
                        {kind === 'installed' && <>
                          <Btn kind="primary" icon={<Pencil fill="#fff" strokeWidth={2} />} className="w-[40px] px-0" {...(isHontrio ? hit('o-mod-edit', hot) : {})} />
                          <Btn kind="danger" icon={<Round kind="danger" />} className="w-[40px] px-0" />
                        </>}
                        {kind === 'multi' && <>
                          <Btn kind="primary" icon={<Round kind="primary" plus />} className="w-[40px] px-0" />
                          <Btn kind="danger" icon={<Round kind="danger" />} className="w-[40px] px-0" />
                        </>}
                        {kind === 'child' && <>
                          <Btn kind="outlinePrimary" icon={<Pencil fill="currentColor" strokeWidth={1.6} />} className="w-[40px] px-0" />
                          <Btn kind="outlineDanger" icon={<Trash2 strokeWidth={2} />} className="w-[38px] px-0" />
                        </>}
                        {kind === 'available' && <>
                          <Btn kind="primary" icon={<Pencil fill="#fff" strokeWidth={2} />} className="w-[40px] px-0 opacity-65" />
                          <Btn kind="success" icon={<Round kind="success" plus />} className="w-[40px] px-0" {...(isHontrio ? hit('o-mod-install', hot) : {})} />
                        </>}
                      </Td>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </Card>
      </div>
      <Footer top={modules ? 1600 : 530} />
    </div>
  )
}

// ——— Pagina extensiei Hontrio ———

function HontrioModule({ beat, hot, shop }: { beat: number; hot: string | undefined; shop: string }) {
  const copied = beat === 15 || beat === 16
  return (
    <div className="absolute inset-0">
      <PageHead title="Hontrio" crumbs={['Extensions', 'Hontrio']}>
        <Btn kind="primary" icon={<Save strokeWidth={2.6} />} className="w-[38px] px-0" />
        <Btn kind="light" icon={<Reply strokeWidth={2.6} />} className="w-[40px] px-0" />
      </PageHead>
      <div className="absolute left-[20px] right-[20px] top-[92px] space-y-[17px]">
        <Card icon={<Link strokeWidth={2.6} />} title="Connect the store in Hontrio">
          <div className="space-y-[13px] leading-[18.2px]" style={{ color: C.text }}>
            <p>Hontrio creates and optimizes your store’s Google Ads campaigns. This extension gives it read-only access to your products and orders: your store stays unchanged.</p>
            <ol className="list-decimal pl-[32px]">
              <li>In Hontrio, open Settings → Integrations and choose OpenCart.</li>
              <li>Enter the store address: {shop}</li>
              <li>Copy the key below, paste it in Hontrio and press Connect.</li>
            </ol>
            <p style={{ color: 'rgba(33,37,41,0.75)' }}>Hontrio reads the products (name, price, stock, codes, categories, image, link) and the orders (status, amounts, products, country, coupon and the visit source). It does not read customer names, e-mail addresses, phone numbers or addresses.</p>
          </div>
        </Card>
        <Card icon={<Pencil fill="currentColor" />} title="Hontrio settings">
          <FormRow label="Store address"><Control>{shop}</Control></FormRow>
          <FormRow label="Hontrio key">
            <span className="flex flex-1">
              <span {...hit('o-key', hot)} className="flex h-[37px] flex-1 items-center rounded-l-[3.7px] border px-[12.3px] text-[13px] [font-family:SFMono-Regular,Menlo,Monaco,Consolas,'Liberation_Mono','Courier_New',monospace]" style={{ borderColor: C.line, color: C.text }}>{KEY}</span>
              {/* „Copy" devine „Copied" imediat după clic */}
              <Btn kind="light" icon={<Copy strokeWidth={2.4} />} className="-ml-px rounded-l-none" {...hit('o-copy', hot)}
                label={<Swap a="Copy" b="Copied" on={copied} style={fade(beat === 15)} />} />
            </span>
          </FormRow>
          <FormRow label="Hontrio API" help="When off, Hontrio cannot read the store."><Toggle /></FormRow>
          <FormRow label="Save the order source" help="Saves on every new order where the visit came from (UTM parameters, gclid, gbraid, wbraid), so Hontrio can see which sales its campaigns brought. The source is kept in the OpenCart session: no new cookie." last>
            <Toggle />
          </FormRow>
          <div className="ml-[178px] mt-[16px]">
            <Btn kind="warning" icon={<RotateCw strokeWidth={2.8} />} label="Generate a new key" />
            <p className="mt-[4px] text-[11.4px]" style={{ color: 'rgba(33,37,41,0.75)' }}>Use it if the key was shared by mistake. Hontrio will need the new key.</p>
          </div>
        </Card>
      </div>
      <Footer top={880} />
    </div>
  )
}

/** Două texte în același loc: se vede `b` când `on` (fără să se schimbe lățimea butonului). */
function Swap({ a, b, on, style }: { a: string; b: string; on: boolean; style?: CSSProperties }) {
  return (
    <span className="grid">
      <span className={cn('col-start-1 row-start-1', on && 'opacity-0')} style={style}>{a}</span>
      <span className={cn('col-start-1 row-start-1', !on && 'opacity-0')} style={style}>{b}</span>
    </span>
  )
}

function FormRow({ label, help, last, children }: { label: string; help?: string; last?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex py-[16px] first:pt-0', !last && 'border-b border-[#ededed]')}>
      <span className="w-[166px] shrink-0 pr-[12px] pt-[9.6px] text-right font-bold leading-[18.2px]" style={{ color: C.text }}>{label}</span>
      <span className="ml-[12px] min-w-0 flex-1">
        {children}
        {help && <span className="mt-[8px] block text-[11.4px] leading-[16px]" style={{ color: 'rgba(33,37,41,0.75)' }}>{help}</span>}
      </span>
    </div>
  )
}

function Control({ children }: { children: ReactNode }) {
  return <span className="flex h-[37px] items-center rounded-[3.7px] border px-[12.3px]" style={{ borderColor: C.line, color: C.text }}>{children}</span>
}

function Toggle() {
  return (
    <span className="mt-[5px] flex h-[26px] w-[52px] items-center justify-end rounded-full border p-[3px]" style={{ background: '#1e91cf', borderColor: '#1e91cf' }}>
      <span className="size-[20px] rounded-full bg-white" />
    </span>
  )
}

export const OPENCART: Scene = { beats: BEATS, Screen: OpenCartScreen, height: PAGE_HEIGHT * UNIT }
