'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Zap, CreditCard, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

type UpgradePromptProps = {
  credits: number
  plan: string
  variant?: 'banner' | 'card' | 'inline' | 'modal'
  action?: string
  creditsNeeded?: number
}

export function UpgradePrompt({
  credits,
  plan,
  variant = 'banner',
  action = 'această acțiune',
  creditsNeeded = 0,
}: UpgradePromptProps) {
  const isOutOfCredits = credits <= 0
  const isLowCredits = credits > 0 && credits <= 5
  const isFree = plan === 'free'

  if (!isOutOfCredits && !isLowCredits) return null

  if (variant === 'inline') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          isOutOfCredits
            ? 'bg-red-50 border border-red-100 text-red-700'
            : 'bg-yellow-50 border border-yellow-100 text-yellow-700'
        }`}
      >
        {isOutOfCredits ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <CreditCard className="h-4 w-4 shrink-0" />
        )}
        <span className="flex-1">
          {isOutOfCredits
            ? `Nu ai suficiente credite pentru ${action}.`
            : `Mai ai doar ${credits} credite rămase.`}
        </span>
        <Link href="/credits">
          <Button size="sm" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white h-7 px-3 text-xs">
            {isFree ? 'Upgrade' : 'Cumpără credite'}
          </Button>
        </Link>
      </motion.div>
    )
  }

  if (variant === 'card') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-6 text-white relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              {isOutOfCredits ? <AlertTriangle className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-semibold">
                {isOutOfCredits ? 'Creditele s-au epuizat' : 'Credite aproape epuizate'}
              </h3>
              <p className="text-blue-200 text-sm">
                {isOutOfCredits
                  ? 'Fă upgrade pentru a continua să optimizezi produse'
                  : `Mai ai doar ${credits} credite disponibile`}
              </p>
            </div>
          </div>

          {isFree && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { name: 'Starter', price: '49', credits: '200' },
                { name: 'Professional', price: '99', credits: '500' },
                { name: 'Enterprise', price: '249', credits: '2000' },
              ].map(p => (
                <div key={p.name} className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
                  <p className="text-xs font-medium">{p.name}</p>
                  <p className="text-sm font-bold">{p.credits} cr</p>
                  <p className="text-[10px] text-blue-200">{p.price} RON/lună</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Link href="/credits" className="flex-1">
              <Button className="w-full bg-white text-blue-700 hover:bg-white/90 rounded-xl h-10 font-medium">
                <Zap className="h-4 w-4 mr-2" />
                {isFree ? 'Alege un plan' : 'Cumpără credite'}
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    )
  }

  // Default: banner variant
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl ${
        isOutOfCredits
          ? 'bg-red-50 border border-red-100'
          : 'bg-yellow-50 border border-yellow-100'
      }`}
    >
      <div className="flex items-center gap-3 flex-1">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
          isOutOfCredits ? 'bg-red-100' : 'bg-yellow-100'
        }`}>
          {isOutOfCredits ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : (
            <CreditCard className="h-4 w-4 text-yellow-600" />
          )}
        </div>
        <div>
          <p className={`text-sm font-medium ${isOutOfCredits ? 'text-red-900' : 'text-yellow-900'}`}>
            {isOutOfCredits
              ? 'Nu mai ai credite disponibile'
              : `Atenție — mai ai doar ${credits} credite`}
          </p>
          <p className={`text-xs ${isOutOfCredits ? 'text-red-600' : 'text-yellow-600'}`}>
            {isOutOfCredits
              ? (isFree
                  ? 'Free trial-ul tău s-a încheiat. Fă upgrade pentru a continua.'
                  : 'Cumpără credite suplimentare pentru a continua generările.')
              : 'Recomandăm să îți suplimentezi creditele pentru a nu fi întrerupt.'}
          </p>
        </div>
      </div>
      <Link href="/credits">
        <Button
          size="sm"
          className={`rounded-xl h-9 px-4 shrink-0 ${
            isOutOfCredits
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-yellow-600 hover:bg-yellow-700 text-white'
          }`}
        >
          {isFree ? 'Fă upgrade' : 'Cumpără credite'}
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </Link>
    </motion.div>
  )
}

export function CreditCheck({
  credits,
  plan,
  needed,
  action,
  children,
}: {
  credits: number
  plan: string
  needed: number
  action: string
  children: React.ReactNode
}) {
  if (credits >= needed) {
    return <>{children}</>
  }

  return (
    <div className="space-y-4">
      <UpgradePrompt
        credits={credits}
        plan={plan}
        variant="card"
        action={action}
        creditsNeeded={needed}
      />
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
    </div>
  )
}