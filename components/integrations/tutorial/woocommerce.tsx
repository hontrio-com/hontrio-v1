'use client'
// i18n-content-file: etichetele panoului WordPress și WooCommerce, luate din traducerile lor oficiale (ro, en)

import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Bars, HontrioCard, Screen, Typed, hit, hover } from './parts'
import type { Beat, Scene, SceneProps } from './player'

// =============================================
// Ghidul WooCommerce: panoul WordPress → WooCommerce → Setări → Avansate →
// REST API → „Creează o cheie API" cu „Citește" → cele două chei copiate și
// lipite în Hontrio. Textele panoului sunt cele din traducerea WooCommerce.
// =============================================

const TEXT = {
  ro: {
    site: 'Magazinul tău', howdy: 'Salut, andrei',
    top: ['Panou control', 'Articole', 'Media', 'Pagini'], woo: 'WooCommerce',
    rest: ['Produse', 'Analytics', 'Marketing', 'Aspect', 'Module', 'Utilizatori', 'Unelte', 'Setări'],
    sub: ['Prima pagină', 'Comenzi', 'Clienți', 'Rapoarte', 'Setări', 'Stare', 'Extensii'],
    dashboard: 'Panou control', activity: 'Activitate', home: 'Prima pagină', stats: 'Prezentare generală statistici',
    tabs: ['Generale', 'Produse', 'Livrare', 'Plăți', 'Emailuri', 'Avansate'],
    sections: ['Inițializare pagină', 'REST API', 'Cârlige web', 'API moștenit'],
    general: ['Primul rând pentru adresă', 'Localitate', 'Țară/județ', 'Monedă'],
    pages: ['Pagină coș', 'Pagină finalizare comandă', 'Pagină Contul meu', 'Termeni și condiții'],
    intro: 'REST API WooCommerce permite aplicații externe pentru a vizualiza și administra datele magazinului. Accesul este acordat numai celor cu chei API valide.',
    create: 'Creează o cheie API', details: 'Detalii cheie', description: 'Descriere', user: 'Utilizator', permissions: 'Permisiuni',
    read: 'Citește', generate: 'Generează cheia API',
    success: 'Cheie API generată cu succes. Asigură-te să copiezi noile chei acum, deoarece cheia secretă va fi ascunsă după ce părăsești această pagină.',
    ck: 'Cheie client', cs: 'Secret client', copy: 'Copiază', copied: 'Copiat!',
  },
  en: {
    site: 'My Store', howdy: 'Howdy, andrei',
    top: ['Dashboard', 'Posts', 'Media', 'Pages'], woo: 'WooCommerce',
    rest: ['Products', 'Analytics', 'Marketing', 'Appearance', 'Plugins', 'Users', 'Tools', 'Settings'],
    sub: ['Home', 'Orders', 'Customers', 'Reports', 'Settings', 'Status', 'Extensions'],
    dashboard: 'Dashboard', activity: 'Activity', home: 'Home', stats: 'Stats overview',
    tabs: ['General', 'Products', 'Shipping', 'Payments', 'Emails', 'Advanced'],
    sections: ['Page setup', 'REST API', 'Webhooks', 'Legacy API'],
    general: ['Address line 1', 'City', 'Country / State', 'Currency'],
    pages: ['Cart page', 'Checkout page', 'My account page', 'Terms and conditions'],
    intro: 'The WooCommerce REST API allows external apps to view and manage store data. Access is granted only to those with valid API keys.',
    create: 'Create an API key', details: 'Key details', description: 'Description', user: 'User', permissions: 'Permissions',
    read: 'Read', generate: 'Generate API key',
    success: 'API Key generated successfully. Make sure to copy your new keys now as the secret key will be hidden once you leave this page.',
    ck: 'Consumer key', cs: 'Consumer secret', copy: 'Copy', copied: 'Copied!',
  },
}

const CK = 'ck_7d2f9a61c3e84b05f1a6c9d2e7b4083f5a1c6e92'
const CS = 'cs_41d90b7e2a5f8c63d1e09a4b7c2f6e85d3a10b9c'

const BEATS: Beat[] = [
  /* 0 */ { ms: 1500, step: 0, cam: { z: 1 }, url: '{shop}/wp-admin/' },
  /* 1 */ { ms: 1150, step: 1, to: 'w-woo', click: true, cam: { on: 'w-woo', z: 1.55 } },
  /* 2 */ { ms: 1150, step: 1, to: 'w-sub-settings', click: true, url: '{shop}/wp-admin/admin.php?page=wc-admin' },
  /* 3 */ { ms: 1250, step: 1, to: 'w-tab-adv', click: true, cam: { on: 'w-tab-adv', z: 1.45 }, url: '{shop}/wp-admin/admin.php?page=wc-settings' },
  /* 4 */ { ms: 1250, step: 1, to: 'w-sec-rest', click: true, cam: { on: 'w-sections', z: 1.6 }, url: '{shop}/wp-admin/admin.php?page=wc-settings&tab=advanced' },
  /* 5 */ { ms: 1350, step: 2, to: 'w-create', click: true, cam: { on: 'w-empty', z: 1.4 }, url: '{shop}/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys' },
  /* 6 */ { ms: 950, step: 2, to: 'w-desc', click: true, cam: { on: 'w-form', z: 1.5 }, url: '{shop}/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys&create-key=1' },
  /* 7 */ { ms: 1150, step: 2 },
  /* 8 */ { ms: 950, step: 2, to: 'w-perm' },
  /* 9 */ { ms: 1250, step: 2, to: 'w-generate', click: true },
  /* 10 */ { ms: 1350, step: 3, to: 'w-copy-ck', click: true, cam: { on: 'w-keys', z: 1.45 } },
  /* 11 */ { ms: 1250, step: 3, to: 'w-copy-cs', click: true },
  /* 12 */ { ms: 1200, step: 3, to: 'h-ck', click: true, cam: { on: 'h-card', z: 1.12 }, url: 'app.hontrio.com/onboarding' },
  /* 13 */ { ms: 1050, step: 3, to: 'h-cs', click: true },
  /* 14 */ { ms: 1200, step: 3, to: 'h-connect', click: true },
  /* 15 */ { ms: 1800, step: 3 },
]

const box = 'rounded-[3px] border border-[#8c8f94] bg-white'
const primary = 'inline-flex h-[23px] items-center rounded-[3px] bg-[#1d2327] px-2.5 text-[9.5px] font-medium text-white'

function WooScreen({ beat, hot }: SceneProps) {
  const { locale, t } = useT()
  const L = TEXT[locale]
  const inWoo = beat >= 2
  const page = beat <= 1 ? 'dash' : beat === 2 ? 'home' : 'settings'
  const advanced = beat >= 4
  const view = beat < 5 ? 'pages' : beat === 5 ? 'empty' : beat < 10 ? 'form' : 'keys'

  return (
    <div className="absolute inset-0 bg-[#f0f0f1] text-[#1d2327]">
      {/* Bara de sus a WordPress */}
      <div className="absolute inset-x-0 top-0 flex h-5 items-center gap-2 bg-[#1d2327] px-2 text-[8.5px] text-[#f0f0f1]/85">
        <span className="grid size-[11px] place-items-center rounded-full border border-[#f0f0f1]/70 text-[7px] font-bold leading-none">W</span>
        <span>{L.site}</span>
        <span className="ml-auto">{L.howdy}</span>
        <span className="size-[10px] rounded-[2px] bg-[#f0f0f1]/40" />
      </div>

      {/* Meniul din stânga */}
      <nav className="absolute bottom-0 left-0 top-5 w-[112px] bg-[#1d2327] pt-1.5 text-[9.5px] text-[#f0f0f1]/85">
        {L.top.map(label => <MenuItem key={label} label={label} />)}
        <MenuItem label={L.woo} current={inWoo} {...hit('w-woo', hot)} />
        {inWoo && (
          <div className="bg-[#2c3338] py-1">
            {L.sub.map((label, i) => (
              <span key={label} {...(i === 4 ? hit('w-sub-settings', hot) : {})}
                className={cn('block py-[2.5px] pl-[27px] text-[8.5px] text-[#f0f0f1]/70', hover, 'data-hot:text-white',
                  ((beat === 2 && i === 0) || (beat >= 3 && i === 4)) && 'font-semibold text-white')}>{label}</span>
            ))}
          </div>
        )}
        {L.rest.map(label => <MenuItem key={label} label={label} />)}
      </nav>

      {/* Conținutul */}
      <div className="absolute bottom-0 left-[112px] right-0 top-5 overflow-hidden">
        <Screen on={page === 'dash'} className="px-4 pt-3">
          <p className="text-[14px]">{L.dashboard}</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <Postbox title={L.activity}><Bars widths={[120, 96, 132, 80]} /></Postbox>
            <Postbox><Bars widths={[110, 140, 70]} /></Postbox>
            <Postbox><Bars widths={[90, 124]} /></Postbox>
            <Postbox><Bars widths={[134, 100, 60]} /></Postbox>
          </div>
        </Screen>

        <Screen on={page === 'home'}>
          <div className="flex h-[30px] items-center border-b border-[#e0e0e0] bg-white px-4 text-[11px] font-semibold">{L.home}</div>
          <div className="px-4 pt-3">
            <Postbox title={L.stats}>
              <div className="grid grid-cols-3 gap-3 pt-0.5">
                {[60, 44, 52].map(w => <Bars key={w} widths={[w, 30]} />)}
              </div>
            </Postbox>
            <div className="mt-2.5"><Postbox><Bars widths={[220, 180, 120]} /></Postbox></div>
          </div>
        </Screen>

        <Screen on={page === 'settings'} className="px-4 pt-3">
          <div data-t="w-tabs" className="flex gap-[3px] overflow-hidden whitespace-nowrap border-b border-[#c3c4c7]">
            {L.tabs.map((tab, i) => {
              const active = advanced ? i === 5 : i === 0
              return (
                <span key={tab} {...(i === 5 ? hit('w-tab-adv', hot) : {})}
                  className={cn('-mb-px rounded-t-[2px] border border-[#c3c4c7] px-[7px] py-[4px] text-[9.5px] font-semibold', hover,
                    active ? 'border-b-[#f0f0f1] bg-[#f0f0f1] text-[#1d2327]' : 'bg-[#dcdcde] text-[#50575e] data-hot:bg-white data-hot:text-[#1d2327]')}>{tab}</span>
              )
            })}
          </div>

          {!advanced && (
            <div className="mt-3 space-y-2">
              {L.general.map(label => <Row key={label} label={label}><span className={cn(box, 'block h-[20px] w-[150px]')} /></Row>)}
            </div>
          )}

          {advanced && (
            <>
              <p data-t="w-sections" className="mt-2.5 flex w-fit gap-1.5 whitespace-nowrap text-[9.5px] text-[#50575e]">
                {L.sections.map((s, i) => (
                  <span key={s} className="flex gap-1.5">
                    {i > 0 && <span className="text-[#a7aaad]">|</span>}
                    <span {...(i === 1 ? hit('w-sec-rest', hot) : {})}
                      className={cn('underline-offset-2', hover, 'data-hot:text-black data-hot:underline', (view === 'pages' ? i === 0 : i === 1) && 'font-semibold text-black')}>{s}</span>
                  </span>
                ))}
              </p>

              {view === 'pages' && (
                <div className="mt-3 space-y-2">
                  {L.pages.map(label => <Row key={label} label={label}><span className={cn(box, 'block h-[20px] w-[150px]')} /></Row>)}
                </div>
              )}

              {view === 'empty' && (
                <div data-t="w-empty" className="mx-auto mt-7 flex w-[270px] flex-col items-center text-center">
                  <p className="text-[10px] leading-[1.45] text-[#50575e]">{L.intro}</p>
                  <span {...hit('w-create', hot)} className={cn(primary, 'mt-3', hover, 'data-hot:bg-black')}>{L.create}</span>
                </div>
              )}

              {view === 'form' && (
                <div data-t="w-form" className="mt-3 w-fit">
                  <p className="text-[11.5px] font-semibold">{L.details}</p>
                  <div className="mt-2 space-y-2">
                    <Row label={L.description}>
                      <span {...hit('w-desc', hot)} className={cn(box, 'flex h-[21px] w-[160px] items-center px-1.5 text-[9.5px]', beat >= 7 && 'border-[#1d2327] shadow-[0_0_0_1px_#1d2327]')}>
                        <Typed text="Hontrio" typing={beat === 7} done={beat > 7} />
                      </span>
                    </Row>
                    <Row label={L.user}><span className={cn(box, 'flex h-[21px] w-[160px] items-center justify-between px-1.5 text-[9.5px]')}>andrei (#1)<Chevron /></span></Row>
                    <Row label={L.permissions}>
                      <span {...hit('w-perm', hot)} className={cn(box, 'flex h-[21px] w-[160px] items-center justify-between px-1.5 text-[9.5px]', hover, 'data-hot:border-[#1d2327] data-hot:shadow-[0_0_0_1px_#1d2327]')}>{L.read}<Chevron /></span>
                    </Row>
                  </div>
                  <span {...hit('w-generate', hot)} className={cn(primary, 'mt-3', hover, 'data-hot:bg-black')}>{L.generate}</span>
                </div>
              )}

              {view === 'keys' && (
                <div data-t="w-keys" className="mt-2.5 w-fit">
                  <p className="w-[300px] rounded-[2px] border-l-[3px] border-[#1d2327] bg-white px-2 py-1.5 text-[8.5px] leading-[1.4] shadow-[0_1px_1px_rgba(0,0,0,0.04)]">{L.success}</p>
                  <div className="mt-2.5 space-y-2">
                    {([['ck', L.ck, CK, beat >= 11], ['cs', L.cs, CS, beat >= 12]] as const).map(([id, label, value, copied]) => (
                      <Row key={id} label={label}>
                        <span className={cn(box, 'flex h-[21px] w-[150px] items-center overflow-hidden px-1.5 font-mono text-[8.5px]')}><span className="truncate">{value}</span></span>
                        <span {...hit(`w-copy-${id}`, hot)} className={cn('ml-1.5 inline-flex h-[21px] items-center rounded-[3px] border border-[#8c8f94] bg-[#f6f7f7] px-2 text-[9px]', hover, 'data-hot:border-[#1d2327] data-hot:bg-white')}>
                          {copied ? L.copied : L.copy}
                        </span>
                      </Row>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Screen>
      </div>

      <HontrioCard on={beat >= 12} hot={hot} connected={beat >= 15}
        title={t('onboarding.form_title_key', { platform: 'WooCommerce' })}
        fields={[
          { id: 'h-url', label: t('onboarding.store_url'), value: locale === 'ro' ? 'https://magazinul-tau.ro' : 'https://your-store.com', pasted: true },
          { id: 'h-ck', label: t('onboarding.api_key'), value: CK, pasted: beat >= 13, mono: true },
          { id: 'h-cs', label: t('onboarding.api_secret'), value: CS, pasted: beat >= 14, mono: true },
        ]} />
    </div>
  )
}

function MenuItem({ label, current, ...rest }: { label: string; current?: boolean; 'data-t'?: string; 'data-hot'?: string }) {
  return (
    <span {...rest} className={cn('relative flex h-[19px] items-center gap-[7px] pl-[9px]', hover, 'data-hot:text-white', current && 'bg-white/[0.14] font-semibold text-white')}>
      <span className="size-[9px] shrink-0 rounded-[2px] bg-current opacity-45" />
      {label}
      {/* Săgeata albă a meniului curent, spre conținut */}
      {current && <span className="absolute right-0 top-1/2 size-0 -translate-y-1/2 border-y-[5px] border-r-[5px] border-y-transparent border-r-[#f0f0f1]" />}
    </span>
  )
}

function Postbox({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="border border-[#c3c4c7] bg-white px-2.5 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.04)]">
      {title && <p className="mb-2 text-[9.5px] font-semibold">{title}</p>}
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center">
      <span className="w-[96px] shrink-0 pr-2 text-[9px] font-semibold leading-tight">{label}</span>
      {children}
    </div>
  )
}

function Chevron() {
  return <svg width="7" height="5" viewBox="0 0 7 5" className="shrink-0"><path d="M.8.8 3.5 3.6 6.2.8" stroke="#50575e" strokeWidth="1.2" fill="none" /></svg>
}

export const WOOCOMMERCE: Scene = { beats: BEATS, Screen: WooScreen }
