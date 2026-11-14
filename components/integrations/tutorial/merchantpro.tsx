'use client'
// i18n-content-file: etichetele panoului MerchantPro, scrise ca în panoul lor (ro, fără diacritice) și în documentația lor (en)

import { Copy, KeyRound, MoreVertical, Pencil, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Bars, HontrioCard, Screen, Typed, hit, hover } from './parts'
import type { Beat, Scene, SceneProps } from './player'

// =============================================
// Ghidul MerchantPro: Setări → API și webhook-uri → „Adaugă API user", cu
// Read only pentru catalog și comenzi → Utilizator API și Parolă API, copiate
// în Hontrio. Fereastra și tabelul urmează capturile din articolul MerchantPro
// „Cum pot obține credențialele API" (help.merchantpro.ro).
// =============================================

const TEXT = {
  ro: {
    menu: ['Panou de control', 'Comenzi', 'Catalog', 'Inventar', 'Clienti', 'Marketing', 'Website', 'Aplicatii', 'Setari'],
    settings: ['Generale', 'Plata', 'Livrare', 'Facturare', 'Notificari', 'Utilizatori', 'API si webhook-uri'],
    api: 'API si webhook-uri', tabs: ['Utilizatori API', 'Webhook-uri', 'Proxy-uri API'], add: 'Adauga API user', empty: 'Nu ai adaugat inca niciun user API.',
    modal: 'Adauga API user', name: 'Denumire interna', perms: ['Permisiuni catalog', 'Permisiuni comenzi', 'Permisiuni clienti', 'Permisiuni blog', 'Website'],
    readOnly: 'Read only', readWrite: 'Read & Write', cancel: 'Anuleaza', save: 'Salveaza',
    cols: ['Referinta interna', 'Utilizator API', 'Parola API', 'Creat'], created: '14 nov. 2026', orders: 'Comenzi noi', revenue: 'Incasari',
  },
  en: {
    menu: ['Dashboard', 'Orders', 'Catalog', 'Inventory', 'Customers', 'Marketing', 'Website', 'Apps', 'Settings'],
    settings: ['General', 'Payment', 'Shipping', 'Invoicing', 'Notifications', 'Users', 'API and webhooks'],
    api: 'API and webhooks', tabs: ['API Users', 'Webhooks', 'API Proxies'], add: 'Add API user', empty: 'You haven’t added any API user yet.',
    modal: 'Add API user', name: 'Internal name', perms: ['Catalog permissions', 'Orders permissions', 'Customers permissions', 'Blog permissions', 'Website'],
    readOnly: 'Read only', readWrite: 'Read & Write', cancel: 'Cancel', save: 'Save',
    cols: ['Internal reference', 'API User', 'API Secret', 'Created'], created: '14 Nov 2026', orders: 'New orders', revenue: 'Revenue',
  },
}
const USER = 'Hk7qLm2XwP9sTzB4vNcR8dYe'
const SECRET = 'mP3x9QeR7tLk2VbN8sWz4YhC6dFj1Ga5'

const BEATS: Beat[] = [
  /* 0 */ { ms: 1500, step: 0, cam: { z: 1 }, url: 'flex.merchantpro.com/dashboard' },
  /* 1 */ { ms: 1150, step: 0, to: 'm-setari', click: true, cam: { on: 'm-setari', z: 1.5 } },
  /* 2 */ { ms: 1250, step: 0, to: 'm-api', click: true, cam: { on: 'm-subnav', z: 1.4 }, url: 'flex.merchantpro.com/settings' },
  /* 3 */ { ms: 1400, step: 1, to: 'm-add', click: true, cam: { on: 'm-head', z: 1.45 }, url: 'flex.merchantpro.com/settings/api' },
  /* 4 */ { ms: 1000, step: 1, to: 'm-name', click: true, cam: { on: 'm-modal', z: 1.18 } },
  /* 5 */ { ms: 1150, step: 1 },
  /* 6 */ { ms: 1100, step: 2, to: 'm-cat', click: true, cam: { on: 'm-modal', z: 1.04 } },
  /* 7 */ { ms: 1100, step: 2, to: 'm-ord', click: true },
  /* 8 */ { ms: 1200, step: 2, to: 'm-save', click: true },
  /* 9 */ { ms: 1250, step: 3, to: 'm-user', click: true, cam: { on: 'm-row', z: 1.55 } },
  /* 10 */ { ms: 1200, step: 3, to: 'm-copy', click: true },
  /* 11 */ { ms: 1250, step: 3, to: 'h-user', click: true, cam: { on: 'h-card', z: 1.12 }, url: 'app.hontrio.com/onboarding' },
  /* 12 */ { ms: 1050, step: 3, to: 'h-pass', click: true },
  /* 13 */ { ms: 1200, step: 3, to: 'h-connect', click: true },
  /* 14 */ { ms: 1800, step: 3 },
]

function MerchantProScreen({ beat, hot }: SceneProps) {
  const { locale, t } = useT()
  const L = TEXT[locale]
  const inSettings = beat >= 2
  const modal = beat >= 4 && beat <= 8
  const saved = beat >= 9

  return (
    <div className="absolute inset-0 bg-[#f6f6f9] text-[#232323]">
      {/* Meniul, cu logo-ul MerchantPro */}
      <nav className="absolute bottom-0 left-0 top-0 w-[122px] border-r border-[#ececf1] bg-white text-[9.5px]">
        <div className="flex h-[34px] items-center pl-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site/logos/merchantpro.png" alt="" className="h-[9px] w-auto grayscale" />
        </div>
        {L.menu.map((label, i) => {
          const isSettings = i === L.menu.length - 1
          const current = isSettings ? inSettings : i === 0 && !inSettings
          return (
            <span key={label} {...(isSettings ? hit('m-setari', hot) : {})}
              className={cn('mx-1.5 flex h-[22px] items-center gap-2 rounded-[6px] px-2 text-[#4b4b55]', hover, 'data-hot:bg-[#f3f3f6]', current && 'bg-[#efeff3] font-semibold text-black')}>
              <span className="size-[9px] shrink-0 rounded-full border-[1.5px] border-current opacity-60" />{label}
            </span>
          )
        })}
      </nav>

      <div className="absolute bottom-0 left-[122px] right-0 top-0 overflow-hidden">
        <Screen on={!inSettings} className="px-4 pt-4">
          <p className="text-[13px] font-semibold">{L.menu[0]}</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {[L.orders, L.revenue].map(label => (
              <div key={label} className="rounded-[8px] bg-white p-2.5 ring-1 ring-[#ececf1]">
                <p className="text-[8px] text-[#8b8b95]">{label}</p>
                <span className="mt-1.5 block h-[9px] w-[54px] rounded-full bg-[#232323]" />
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-[8px] bg-white p-2.5 ring-1 ring-[#ececf1]"><Bars widths={[290, 230, 260, 170, 210]} /></div>
        </Screen>

        <Screen on={inSettings} className="flex gap-3 px-3.5 pt-4">
          {/* Lista setărilor, până se deschide pagina API (care ocupă toată lățimea) */}
          <div data-t="m-subnav" style={{ display: beat >= 3 ? 'none' : undefined }} className="w-[106px] shrink-0 rounded-[8px] bg-white py-1.5 ring-1 ring-[#ececf1]">
            {L.settings.map((label, i) => {
              const isApi = i === L.settings.length - 1
              return (
                <span key={label} {...(isApi ? hit('m-api', hot) : {})}
                  className={cn('mx-1 flex h-[18px] items-center rounded-[5px] px-2 text-[8.5px] text-[#4b4b55]', hover, 'data-hot:bg-[#f3f3f6]',
                    (beat >= 3 ? isApi : i === 0) && 'bg-[#efeff3] font-semibold text-black')}>{label}</span>
              )
            })}
          </div>

          <div className="relative min-w-0 flex-1">
            <Screen on={beat === 2}>
              <div className="rounded-[8px] bg-white p-2.5 ring-1 ring-[#ececf1]">
                <p className="mb-2 text-[9.5px] font-semibold">{L.settings[0]}</p>
                <Bars widths={[150, 120, 170, 90, 130]} />
              </div>
            </Screen>

            <Screen on={beat >= 3}>
              <div data-t="m-head" className="flex items-center justify-between">
                <p className="text-[12px] font-semibold">{L.api}</p>
                <span {...hit('m-add', hot)} className={cn('rounded-[6px] bg-[#232323] px-2 py-[4.5px] text-[8.5px] font-semibold text-white', hover, 'data-hot:bg-black')}>{L.add}</span>
              </div>
              <div className="mt-2 flex gap-3 border-b border-[#e6e6ec] text-[8.5px]">
                {L.tabs.map((tab, i) => <span key={tab} className={cn('-mb-px pb-1.5', i === 0 ? 'border-b-[1.5px] border-[#232323] font-semibold text-black' : 'text-[#8b8b95]')}>{tab}</span>)}
              </div>
              <div className="mt-2 rounded-[8px] bg-white ring-1 ring-[#ececf1]">
                <div className="grid grid-cols-[0.95fr_1.7fr_1.1fr_0.75fr] gap-1.5 border-b border-[#f0f0f4] px-2.5 py-1.5 text-[7.5px] font-semibold text-[#8b8b95]">
                  {L.cols.map(c => <span key={c} className="truncate">{c}</span>)}
                </div>
                {!saved && <p className="px-2.5 py-3 text-center text-[8.5px] text-[#8b8b95]">{L.empty}</p>}
                {saved && (
                  <div data-t="m-row" className="grid grid-cols-[0.95fr_1.7fr_1.1fr_0.75fr] items-center gap-1.5 px-2.5 py-2 text-[8.5px]">
                    <span className="truncate font-semibold">Hontrio</span>
                    <span {...hit('m-user', hot)} className={cn('truncate rounded-[3px] font-mono text-[8px]', beat >= 10 && 'bg-[#232323] text-white')}>{USER}</span>
                    <span className="flex items-center gap-1">
                      <span className="font-mono text-[8px] tracking-[0.04em]">••••••••••</span>
                      <span {...hit('m-copy', hot)} className={cn('relative grid size-[15px] place-items-center rounded-[4px] text-[#55555f]', hover, 'data-hot:bg-[#efeff3] data-hot:text-black')}>
                        <Copy className="size-[9px]" />
                        {beat >= 11 && <span className="absolute -top-[17px] right-0 rounded-[4px] bg-[#232323] px-1.5 py-[2px] text-[7px] font-medium text-white">✓</span>}
                      </span>
                    </span>
                    <span className="flex items-center justify-between text-[7.5px] text-[#55555f]">
                      {L.created}
                      <span className="flex items-center gap-1"><KeyRound className="size-[8px]" /><Pencil className="size-[8px]" /><MoreVertical className="size-[8px]" /></span>
                    </span>
                  </div>
                )}
              </div>
            </Screen>
          </div>
        </Screen>
      </div>

      {/* Fereastra „Adauga API user" */}
      {modal && <div className="absolute inset-0 bg-black/20" />}
      {modal && (
        <div data-t="m-modal" className="absolute left-[150px] top-[10px] w-[250px] rounded-[10px] bg-white shadow-[0_16px_36px_-14px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between border-b border-[#f0f0f4] px-3 py-2">
            <span className="text-[10.5px] font-semibold">{L.modal}</span>
            <X className="size-[10px] text-[#8b8b95]" />
          </div>
          <div className="px-3 py-2">
            <p className="text-[8.5px] font-semibold">{L.name} <span className="text-[#c0392b]">*</span></p>
            <span {...hit('m-name', hot)} className={cn('mt-1 flex h-[20px] w-[160px] items-center rounded-[5px] border border-[#dcdce3] px-1.5 text-[9px]', beat >= 5 && 'border-[#232323]')}>
              <Typed text="Hontrio" typing={beat === 5} done={beat > 5} />
            </span>
            <div className="mt-2 space-y-[3px]">
              {L.perms.map((label, i) => {
                const checked = (i === 0 && beat >= 7) || (i === 1 && beat >= 8)
                return (
                  <div key={label}>
                    <Check label={label} checked={checked} target={i === 0 ? hit('m-cat', hot) : i === 1 ? hit('m-ord', hot) : {}} />
                    {checked && (
                      <div className="ml-[15px] mt-[2px] space-y-[2px]">
                        <Radio label={L.readOnly} on />
                        <Radio label={L.readWrite} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex justify-end gap-1.5 border-t border-[#f0f0f4] px-3 py-2">
            <span className="rounded-[5px] border border-[#dcdce3] px-2 py-[3px] text-[8.5px] text-[#55555f]">{L.cancel}</span>
            <span {...hit('m-save', hot)} className={cn('rounded-[5px] bg-[#232323] px-2 py-[3px] text-[8.5px] font-semibold text-white', hover, 'data-hot:bg-black')}>{L.save}</span>
          </div>
        </div>
      )}

      <HontrioCard on={beat >= 11} hot={hot} connected={beat >= 14}
        title={t('onboarding.form_title_key', { platform: 'MerchantPro' })}
        fields={[
          { id: 'h-url', label: t('integrations.merchantpro_store_url'), value: locale === 'ro' ? 'https://www.magazinul-tau.ro' : 'https://www.your-store.com', pasted: true },
          { id: 'h-user', label: t('integrations.merchantpro_api_key'), value: USER, pasted: beat >= 12, mono: true },
          { id: 'h-pass', label: t('integrations.merchantpro_api_secret'), value: SECRET, pasted: beat >= 13, mono: true },
        ]} />
    </div>
  )
}

function Check({ label, checked, target }: { label: string; checked: boolean; target: { 'data-t'?: string; 'data-hot'?: string } }) {
  return (
    <span className="flex items-center gap-1.5 text-[8.5px] text-[#3a3a44]">
      <span {...target} className={cn('grid size-[10px] place-items-center rounded-[2.5px] border', hover, 'data-hot:border-[#232323]',
        checked ? 'border-[#232323] bg-[#232323] text-white' : 'border-[#c9c9d2] bg-white')}>
        {checked && <svg width="6" height="5" viewBox="0 0 6 5"><path d="M.7 2.6 2.3 4 5.3.9" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>}
      </span>
      {label}
    </span>
  )
}

function Radio({ label, on }: { label: string; on?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[8px] text-[#55555f]">
      <span className={cn('grid size-[9px] place-items-center rounded-full border', on ? 'border-[#232323]' : 'border-[#c9c9d2]')}>
        {on && <span className="size-[4px] rounded-full bg-[#232323]" />}
      </span>
      {label}
    </span>
  )
}

export const MERCHANTPRO: Scene = { beats: BEATS, Screen: MerchantProScreen }

