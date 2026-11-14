'use client'
// i18n-content-file: etichetele panoului Gomag (din centrul lor de ajutor), în română și engleză

import type { ReactNode } from 'react'
import { Copy, Eye } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Bars, HontrioCard, Screen, hit, hover } from './parts'
import type { Beat, Scene, SceneProps } from './player'

// =============================================
// Ghidul Gomag: Setări → Conturi → contul principal → Token API, copiat și lipit
// în Hontrio. Drumul e cel din articolul Gomag despre token-ul API (MCP), iar
// meniul și setările sunt cele numite în ajutorul lor („Conturi", „Permisiuni").
// Panoul Gomag e în română, deci și în engleză etichetele lui rămân românești.
// =============================================

const L = { search: 'Caută comenzi, produse, clienți', accounts: 'Conturi', create: 'Creează un cont', name: 'Nume', type: 'Tip', main: 'Cont principal', second: 'Cont secundar', details: 'Date cont', security: 'Securitate', sms: 'Autentificare prin SMS', copied: 'Copiat', today: 'Comenzi azi', sales: 'Vânzări' }
const MENU = ['Dashboard', 'Comenzi', 'Produse', 'CRM', 'Marketing', 'Conținut', 'Rapoarte', 'Aplicații', 'Design', 'Setări']
const SETTINGS = ['Generale', 'Plată', 'Livrare', 'Confidențialitate', 'Domenii', 'Email', 'Newsletter', 'Analytics', 'Conturi', 'Abonament']
const TOKEN = '5e1b8c07f94d2a63b0e7c1d84f29a6b3c50e7d12'

const BEATS: Beat[] = [
  /* 0 */ { ms: 1500, step: 0, cam: { z: 1 }, url: '{shop}/gomag/dashboard' },
  /* 1 */ { ms: 1150, step: 0, to: 'g-setari', click: true, cam: { on: 'g-setari', z: 1.5 } },
  /* 2 */ { ms: 1250, step: 0, to: 'g-conturi', click: true, cam: { on: 'g-subnav', z: 1.4 }, url: '{shop}/gomag/setari' },
  /* 3 */ { ms: 1450, step: 0, to: 'g-main', click: true, cam: { on: 'g-accounts', z: 1.35 }, url: '{shop}/gomag/setari/conturi' },
  /* 4 */ { ms: 1600, step: 1, to: 'g-copy', click: true, cam: { on: 'g-token', z: 1.55 }, url: '{shop}/gomag/setari/conturi/cont-principal' },
  /* 5 */ { ms: 850, step: 1 },
  /* 6 */ { ms: 1250, step: 2, to: 'h-key', click: true, cam: { on: 'h-card', z: 1.12 }, url: 'app.hontrio.com/onboarding' },
  /* 7 */ { ms: 1250, step: 2, to: 'h-connect', click: true },
  /* 8 */ { ms: 1800, step: 2 },
]

const field = 'flex h-[21px] items-center rounded-[6px] border border-[#dedede] bg-white px-2 text-[9px]'

function GomagScreen({ beat, hot }: SceneProps) {
  const { locale, t } = useT()
  const page = beat <= 1 ? 'dash' : beat === 2 ? 'settings' : beat === 3 ? 'accounts' : 'account'
  const inSettings = beat >= 2

  return (
    <div className="absolute inset-0 bg-[#f5f5f6] text-[#1f1f1f]">
      {/* Sus: logo-ul, căutarea, magazinul */}
      <div className="absolute inset-x-0 top-0 flex h-[30px] items-center border-b border-[#ebebeb] bg-white">
        <span className="flex w-[118px] items-center pl-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site/logos/gomag.png" alt="" className="h-[14px] w-auto grayscale" />
        </span>
        <span className="flex h-[19px] w-[190px] items-center rounded-full bg-[#f2f2f3] px-2.5 text-[8.5px] text-[#9a9a9a]">{L.search}</span>
        <span className="ml-auto mr-3 flex items-center gap-1.5 text-[8.5px] text-[#555]">
          {locale === 'ro' ? 'magazinul-tau.ro' : 'your-store.com'}
          <span className="size-[15px] rounded-full bg-[#d9d9d9]" />
        </span>
      </div>

      {/* Meniul */}
      <nav className="absolute bottom-0 left-0 top-[30px] w-[118px] border-r border-[#ebebeb] bg-white pt-2 text-[9.5px]">
        {MENU.map(label => {
          const current = label === 'Setări' ? inSettings : label === 'Dashboard' && !inSettings
          return (
            <span key={label} {...(label === 'Setări' ? hit('g-setari', hot) : {})}
              className={cn('relative mx-1.5 flex h-[21px] items-center gap-2 rounded-[6px] px-2 text-[#3a3a3a]', hover, 'data-hot:bg-[#f2f2f2]', current && 'bg-[#f0f0f0] font-semibold text-black')}>
              <span className="size-[9px] shrink-0 rounded-[2.5px] bg-current opacity-40" />{label}
            </span>
          )
        })}
      </nav>

      <div className="absolute bottom-0 left-[118px] right-0 top-[30px] overflow-hidden">
        <Screen on={page === 'dash'} className="px-4 pt-3.5">
          <p className="text-[13px] font-semibold">Dashboard</p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {[L.today, L.sales, 'Conversie'].map(label => (
              <div key={label} className="rounded-[8px] bg-white p-2.5 ring-1 ring-[#ececec]">
                <p className="text-[8px] text-[#8a8a8a]">{label}</p>
                <span className="mt-1.5 block h-[9px] w-[46px] rounded-full bg-[#1f1f1f]" />
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-[8px] bg-white p-2.5 ring-1 ring-[#ececec]"><Bars widths={[300, 250, 280, 190]} /></div>
        </Screen>

        {/* Setări: lista secțiunilor în stânga, conținutul alături */}
        <Screen on={inSettings} className="flex gap-3 px-3.5 pt-3.5">
          <div data-t="g-subnav" className="w-[104px] shrink-0 rounded-[8px] bg-white py-1.5 ring-1 ring-[#ececec]">
            {SETTINGS.map(label => (
              <span key={label} {...(label === 'Conturi' ? hit('g-conturi', hot) : {})}
                className={cn('mx-1 flex h-[17px] items-center rounded-[5px] px-2 text-[8.5px] text-[#4a4a4a]', hover, 'data-hot:bg-[#f2f2f2]',
                  (beat >= 3 ? label === 'Conturi' : label === 'Generale') && 'bg-[#f0f0f0] font-semibold text-black')}>{label}</span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            <Screen on={page === 'settings'}>
              <Panel title="Generale"><Bars widths={[150, 120, 170, 90]} /></Panel>
            </Screen>

            <Screen on={page === 'accounts'}>
              <div data-t="g-accounts">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold">{L.accounts}</p>
                  <span className="rounded-full bg-[#1f1f1f] px-2.5 py-[4px] text-[8.5px] font-medium text-white">{L.create}</span>
                </div>
                <div className="mt-2.5 overflow-hidden rounded-[8px] bg-white ring-1 ring-[#ececec]">
                  <div className="grid grid-cols-[1fr_1.4fr_0.9fr] border-b border-[#efefef] px-2.5 py-1.5 text-[8px] font-semibold text-[#8a8a8a]">
                    <span>{L.name}</span><span>Email</span><span>{L.type}</span>
                  </div>
                  <div {...hit('g-main', hot)} className={cn('grid grid-cols-[1fr_1.4fr_0.9fr] items-center px-2.5 py-2 text-[8.5px]', hover, 'data-hot:bg-[#f6f6f6]')}>
                    <span className="font-semibold">Andrei Popescu</span>
                    <span className="truncate text-[#555]">andrei@{locale === 'ro' ? 'magazinul-tau.ro' : 'your-store.com'}</span>
                    <span><span className="rounded-full bg-[#1f1f1f] px-1.5 py-[2px] text-[7.5px] font-semibold text-white">{L.main}</span></span>
                  </div>
                  <div className="grid grid-cols-[1fr_1.4fr_0.9fr] items-center border-t border-[#f3f3f3] px-2.5 py-2 text-[8.5px]">
                    <span>Maria Ionescu</span>
                    <span className="truncate text-[#555]">maria@{locale === 'ro' ? 'magazinul-tau.ro' : 'your-store.com'}</span>
                    <span className="text-[#777]">{L.second}</span>
                  </div>
                </div>
              </div>
            </Screen>

            <Screen on={page === 'account'} className="space-y-2">
              <Panel title={L.details}>
                <div className="grid grid-cols-2 gap-1.5">
                  <span className={field}>Andrei</span>
                  <span className={field}>Popescu</span>
                </div>
              </Panel>
              <Panel title={L.security}>
                <span className="flex items-center justify-between text-[8.5px] text-[#555]">{L.sms}<Toggle /></span>
              </Panel>
              <div data-t="g-token">
                <Panel title="Token API">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(field, 'min-w-0 flex-1 font-mono text-[8.5px] tracking-[0.06em] text-[#333]')}>••••••••••••••••••••••••</span>
                    <span className="grid size-[21px] place-items-center rounded-[6px] border border-[#dedede] bg-white text-[#555]"><Eye className="size-[10px]" /></span>
                    <span {...hit('g-copy', hot)} className={cn('relative grid size-[21px] place-items-center rounded-[6px] border border-[#dedede] bg-white text-[#555]', hover, 'data-hot:border-[#1f1f1f] data-hot:text-black')}>
                      <Copy className="size-[10px]" />
                      {beat >= 5 && <span className="absolute -top-[19px] right-0 rounded-[4px] bg-[#1f1f1f] px-1.5 py-[2px] text-[7.5px] font-medium text-white">{L.copied}</span>}
                    </span>
                  </div>
                </Panel>
              </div>
            </Screen>
          </div>
        </Screen>
      </div>

      <HontrioCard on={beat >= 6} hot={hot} connected={beat >= 8}
        title={t('onboarding.form_title_key', { platform: 'Gomag' })}
        fields={[
          { id: 'h-url', label: t('integrations.gomag_store_url'), value: locale === 'ro' ? 'https://www.magazinul-tau.ro' : 'https://www.your-store.com', pasted: true },
          { id: 'h-key', label: t('integrations.gomag_api_key'), value: TOKEN, pasted: beat >= 7, mono: true },
        ]} />
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[8px] bg-white p-2.5 ring-1 ring-[#ececec]">
      <p className="mb-2 text-[9.5px] font-semibold">{title}</p>
      {children}
    </div>
  )
}

function Toggle() {
  return <span className="flex h-[11px] w-[19px] items-center rounded-full bg-[#d6d6d6] p-[1.5px]"><span className="size-[8px] rounded-full bg-white" /></span>
}

export const GOMAG: Scene = { beats: BEATS, Screen: GomagScreen }
