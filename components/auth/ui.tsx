'use client'

import { useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Button } from '@/components/app/button'
import { inputStyles } from '@/components/app/input'
import { cn } from '@/lib/utils'

// =============================================
// Paginile de cont (intrare, cont nou, parolă uitată, parolă nouă, acordul),
// în aspectul onboarding-ului: logo-ul și clipul sunt în app/(auth)/layout.tsx,
// aici e coloana din stânga, cu titlul mare, etichete mici, câmpuri cu inel la
// focus și butoane-pastilă. Logica (validări, cereri, redirecționări) rămâne
// în pagini.
// =============================================

export type AuthNotice = { message: string; type: 'success' | 'error' } | null

/** Conținutul paginii: iconița (opțional), titlul, fraza de sub el, formularul și, dedesubt, linkul spre cealaltă pagină. */
export function AuthCard({ icon, tone = 'neutral', title, description, children, footer }: {
  icon?: ReactNode
  tone?: 'neutral' | 'danger'
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Sub formular: linkul spre cealaltă pagină. */
  footer?: ReactNode
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      {icon && (
        <div className={cn('mb-6 grid size-11 place-items-center rounded-full [&_svg]:size-5',
          tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-black text-white')}>
          {icon}
        </div>
      )}
      <h1 className="text-balance text-[32px] font-bold leading-[1.08] tracking-[-0.04em] text-neutral-950 sm:text-[38px]">{title}</h1>
      {description && <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">{description}</p>}
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-6 text-sm text-neutral-500">{footer}</div>}
    </motion.div>
  )
}

/** Cât se încarcă pagina: un cerc mic, în locul formularului. */
export function AuthLoading() {
  return (
    <div className="flex justify-center py-24">
      <Loader2 className="size-5 animate-spin text-neutral-300" />
    </div>
  )
}

const labelStyles = 'block text-[12px] font-semibold tracking-[0.02em] text-neutral-500'

/** Un câmp cu etichetă și iconiță; în dreapta etichetei poate sta o acțiune (ex. „Ai uitat parola?"). */
export function AuthField({ label, aside, icon, className, ...props }: React.ComponentProps<'input'> & {
  label: ReactNode
  aside?: ReactNode
  icon: ReactNode
}) {
  const id = useId()
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={id} className={labelStyles}>{label}</label>
        {aside}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 [&_svg]:size-4">{icon}</span>
        <input id={id} className={cn(inputStyles, 'h-11 pl-10', className)} {...props} />
      </div>
    </div>
  )
}

/** Cât de bună e parola, pe 4 trepte (aceeași regulă ca până acum). */
function strengthOf(pw: string) {
  const n = pw.length
  return n === 0 ? 0 : n < 6 ? 1 : n < 10 ? 2 : /[A-Z]/.test(pw) && /[0-9]/.test(pw) ? 4 : 3
}
// i18n-ignore-start: clase de stil, nu text
const STRENGTH = ['', 'bg-red-400', 'bg-amber-400', 'bg-neutral-400', 'bg-black']
// i18n-ignore-end

/** Parola, cu butonul care o arată și, la nevoie, treptele de siguranță dedesubt. */
export function PasswordField({ label, aside, icon, strength, value, ...props }: Omit<React.ComponentProps<'input'>, 'type' | 'value'> & {
  label: ReactNode
  aside?: ReactNode
  icon: ReactNode
  value: string
  strength?: boolean
}) {
  const { t } = useT()
  const id = useId()
  const [show, setShow] = useState(false)
  const level = strengthOf(value)
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={id} className={labelStyles}>{label}</label>
        {aside}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 [&_svg]:size-4">{icon}</span>
        <input id={id} type={show ? 'text' : 'password'} value={value} className={cn(inputStyles, 'h-11 pl-10 pr-11')} {...props} />
        <button type="button" onClick={() => setShow(s => !s)} tabIndex={-1} aria-label={show ? t('auth.hide_password') : t('auth.show_password')}
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-black [&_svg]:size-4">
          {show ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {strength && value.length > 0 && (
        <div className="mt-2 flex gap-1 px-0.5" aria-hidden>
          {[1, 2, 3, 4].map(i => (
            <span key={i} className={cn('h-[3px] flex-1 rounded-full transition-colors duration-300', i <= level ? STRENGTH[level] : 'bg-neutral-100')} />
          ))}
        </div>
      )}
    </div>
  )
}

export function OrDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="select-none text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{children}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

export function GoogleButton({ onClick, loading, children }: { onClick: () => void; loading: boolean; children: ReactNode }) {
  return (
    <Button type="button" variant="secondary" onClick={onClick} loading={loading} className="h-11 w-full text-[14px]">
      {!loading && <GoogleIcon />}{children}
    </Button>
  )
}

/** Butonul principal al formularului: pastila neagră, pe toată lățimea. */
export function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <Button type="submit" variant="primary" loading={loading} className="h-11 w-full text-[14px]">
      {!loading && children}
    </Button>
  )
}

/** Mesajul de sus (reușită sau eroare), ca o pastilă; pe ecranele late, deasupra coloanei cu formularul. */
export function AuthToast({ notice, onClose }: { notice: AuthNotice; onClose: () => void }) {
  const { t } = useT()
  return (
    <AnimatePresence>
      {notice && (
        <motion.div role="status" aria-live="polite"
          initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.96 }}
          className={cn('fixed left-1/2 top-6 z-50 flex lg:left-[24%] max-w-[calc(100vw-2.5rem)] -translate-x-1/2 items-center gap-3 rounded-full border bg-white/95 py-2.5 pl-4 pr-2.5 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.35)] backdrop-blur',
            notice.type === 'success' ? 'border-line text-neutral-900' : 'border-red-200 text-red-700')}>
          {notice.type === 'success' ? <CheckCircle className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0 text-red-500" />}
          <span className="text-sm font-medium">{notice.message}</span>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="grid size-6 shrink-0 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-black">
            <X className="size-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
