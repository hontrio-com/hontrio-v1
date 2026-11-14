'use client'

import { useId, useState } from 'react'
import { Download, Eye, EyeOff, Globe, KeyRound, LayoutGrid, Lock, Plug, ShoppingBag, ShoppingCart, Wifi } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { PLATFORM_NAMES } from '@/lib/commerce/platforms'
import { OPENCART_DOWNLOADS } from '@/lib/opencart/downloads'
import { Button } from '@/components/app/button'
import { Callout } from '@/components/app/feedback'
import { inputStyles } from '@/components/app/input'
import { Card, CardHeader } from '@/components/app/surface'
import { Tutorial } from '@/components/integrations/tutorial'

// =============================================
// Conectarea unui magazin Gomag, MerchantPro sau OpenCart (cu chei), aceeași în
// onboarding și în Setări → Integrări: pașii prin care omul își face cheia,
// câmpurile, „Testează" și „Conectează". Cheile pleacă doar spre serverul
// Hontrio, care le verifică la platformă și le salvează criptate.
// =============================================

export type KeyStorePlatform = 'gomag' | 'merchantpro' | 'opencart'

type FieldName = 'store_url' | 'api_key' | 'api_secret'

const FIELDS: Record<KeyStorePlatform, FieldName[]> = {
  gomag: ['store_url', 'api_key'],
  merchantpro: ['store_url', 'api_key', 'api_secret'],
  opencart: ['store_url', 'api_key'],
}

/** Câți pași are tutorialul fiecărei platforme (integrations.{platformă}_step_{n}_title / _desc). */
const STEPS: Record<KeyStorePlatform, number[]> = { gomag: [1, 2, 3], merchantpro: [1, 2, 3, 4], opencart: [1, 2, 3, 4] }

const FIELD_ICONS: Record<FieldName, typeof Globe> = { store_url: Globe, api_key: KeyRound, api_secret: Lock }

export const KEY_PLATFORM_ICONS: Record<KeyStorePlatform, typeof Globe> = { gomag: ShoppingBag, merchantpro: LayoutGrid, opencart: ShoppingCart }

export type ConnectedStore = { id: string; store_name: string | null; store_url: string }

const EMPTY: Record<FieldName, string> = { store_url: '', api_key: '', api_secret: '' }

export function KeyStoreForm({ platform, variant, onConnected }: {
  platform: KeyStorePlatform
  variant: 'onboarding' | 'settings'
  onConnected: (store: ConnectedStore, reconnected: boolean) => void
}) {
  const { t } = useT()
  const idBase = useId()
  const [values, setValues] = useState(EMPTY)
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState<'' | 'test' | 'connect'>('')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const fields = FIELDS[platform]
  const name = PLATFORM_NAMES[platform]
  const onboarding = variant === 'onboarding'

  const update = (field: FieldName, value: string) => {
    setValues(prev => ({ ...prev, [field]: value }))
    setResult(null)
  }
  const complete = fields.every(f => values[f].trim())
  const body = () => JSON.stringify({ platform, ...Object.fromEntries(fields.map(f => [f, values[f].trim()])) })

  async function test() {
    if (!complete) { setResult({ ok: false, text: t('onboarding.fill_all') }); return }
    setBusy('test'); setResult(null)
    try {
      const res = await fetch('/api/stores/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body() })
      const data = await res.json().catch(() => ({}))
      setResult(data.ok ? { ok: true, text: t('integrations.test_ok', { platform: name }) } : { ok: false, text: data.error || t('settings.conn_cant_connect') })
    } catch {
      setResult({ ok: false, text: t('settings.conn_cant_connect') })
    } finally {
      setBusy('')
    }
  }

  async function connect() {
    if (!complete) { setResult({ ok: false, text: t('onboarding.fill_all') }); return }
    setBusy('connect'); setResult(null)
    try {
      const res = await fetch('/api/stores/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.store) { setResult({ ok: false, text: data.error || t('onboarding.error_connect') }); return }
      setValues(EMPTY)
      onConnected(data.store as ConnectedStore, !!data.reconnected)
    } catch {
      setResult({ ok: false, text: t('common.error_connection') })
    } finally {
      setBusy('')
    }
  }

  const label = onboarding ? 'block text-[12px] font-semibold tracking-[0.02em] text-neutral-500' : 'text-[13px] font-medium text-neutral-700'

  const fieldList = fields.map(f => {
    const id = `${idBase}-${f}`
    const Icon = FIELD_ICONS[f]
    const secret = f !== 'store_url'
    const hintKey = `integrations.${platform}_${f}_hint`
    return (
      <div key={f}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor={id} className={label}>{t(`integrations.${platform}_${f}`)}</label>
          {f === 'api_key' && (
            <button type="button" onClick={() => setShown(s => !s)} className="flex items-center gap-1 text-[12px] font-medium text-neutral-500 transition-colors hover:text-black">
              {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}{shown ? t('onboarding.hide_keys') : t('onboarding.show_keys')}
            </button>
          )}
        </div>
        <div className="relative">
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          {/* Nu e un formular de autentificare: managerul de parole nu are ce completa aici */}
          <input id={id} value={values[f]} onChange={e => update(f, e.target.value)} placeholder={t(`integrations.${platform}_${f}_placeholder`)}
            type={secret && !shown ? 'password' : 'text'} name={`${platform}_${f}`} autoComplete={secret ? 'new-password' : 'url'} spellCheck={false}
            className={cn(inputStyles, 'pl-10', onboarding && 'h-11', secret && 'font-mono text-[13px] placeholder:font-sans placeholder:text-[14px]')} />
        </div>
        {t.has(hintKey) && <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">{t(hintKey)}</p>}
      </div>
    )
  })

  const steps = (
    <ol className="mt-2 space-y-3">
      {STEPS[platform].map(n => (
        <li key={n} className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 font-mono text-[11px] font-semibold text-neutral-600">{n}</span>
          <span className="text-[13px] leading-relaxed text-neutral-600">
            <span className="block font-semibold text-neutral-900">{t(`integrations.${platform}_step_${n}_title`)}</span>
            {t(`integrations.${platform}_step_${n}_desc`)}
          </span>
        </li>
      ))}
    </ol>
  )

  const downloads = platform === 'opencart' && (
    <div>
      <p className={cn(label, 'mb-1.5')}>{t('integrations.opencart_download')}</p>
      <div className="grid grid-cols-2 gap-2">
        {OPENCART_DOWNLOADS.map(d => (
          <Button key={d.version} asChild size="sm" className="w-full">
            <a href={d.href} download><Download />{d.label}</a>
          </Button>
        ))}
      </div>
    </div>
  )

  const feedback = result && <Callout tone={result.ok ? 'success' : 'danger'}>{result.text}</Callout>

  // În onboarding, titlul și descrierea platformei le pune pagina; aici, pașii și câmpurile
  if (onboarding) {
    return (
      <div className="space-y-4">
        <Tutorial title={t('integrations.tutorial_title')} platform={platform}
          steps={STEPS[platform].map(n => ({ title: t(`integrations.${platform}_step_${n}_title`), desc: t(`integrations.${platform}_step_${n}_desc`) }))} />
        {downloads}
        {fieldList}
        {feedback}
        <Button variant="primary" onClick={connect} disabled={!!busy} loading={busy === 'connect'} className="h-11 w-full text-[14px]">
          {busy !== 'connect' && t('onboarding.connect_store')}
        </Button>
      </div>
    )
  }

  const Icon = KEY_PLATFORM_ICONS[platform]
  return (
    <Card className="flex flex-col">
      <CardHeader icon={<Icon />} title={name} description={t(`integrations.${platform}_subtitle`)} />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4">
        <p className="text-[13px] leading-relaxed text-neutral-500">{t(`integrations.${platform}_desc`)}</p>
        {downloads}
        {fieldList}
        {feedback}
        <details className="group rounded-lg bg-neutral-50 px-3 py-2 text-[12px] text-neutral-600 ring-1 ring-inset ring-neutral-200/60">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-neutral-700"><KeyRound className="size-3.5 text-neutral-400" />{t('integrations.tutorial_title')}</summary>
          {steps}
        </details>
        <div className="mt-auto flex gap-2 pt-1">
          <Button loading={busy === 'test'} disabled={!!busy} onClick={test}>{busy !== 'test' && <Wifi />}{t('settings.test_btn')}</Button>
          <Button variant="primary" loading={busy === 'connect'} disabled={!!busy} onClick={connect} className="flex-1">
            {busy !== 'connect' && <Plug />}{busy === 'connect' ? t('common.connecting') : t('onboarding.connect_store')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
