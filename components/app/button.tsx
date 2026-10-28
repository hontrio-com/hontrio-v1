'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================
// Butoanele platformei. Unul singur „primary" pe ecran (accentul), restul
// „secondary" (alb, cu contur fin) sau „ghost". Apăsarea se simte (scale),
// focusul se vede (inel în culoarea accentului).
// =============================================

export const buttonStyles = cva(
  'relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[background-color,box-shadow,color,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-600/25 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(16_24_40/0.14)] hover:bg-brand-700',
        secondary: 'bg-white text-neutral-800 shadow-[0_1px_2px_rgb(16_24_40/0.05)] ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300',
        ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
        danger: 'bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50',
        dark: 'bg-neutral-900 text-white hover:bg-neutral-800',
      },
      size: {
        xs: 'h-7 rounded-md px-2 text-[12px] [&_svg]:size-3.5',
        sm: 'h-8 rounded-lg px-2.5 text-[13px] [&_svg]:size-3.5',
        md: 'h-9 rounded-lg px-3.5 text-[13px] [&_svg]:size-4',
        lg: 'h-10 rounded-xl px-4 text-[14px] [&_svg]:size-4',
        icon: 'size-8 rounded-lg [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

/** Un link în text: negru, subliniat discret; sublinierea se închide la hover. */
export const linkStyles = 'font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:decoration-neutral-900'

/** O acțiune scrisă (cu săgeată după ea): neagră, se estompează la hover. */
export const textActionStyles = 'inline-flex items-center gap-1 font-medium text-neutral-900 transition-colors hover:text-neutral-500 [&_svg]:size-3.5'

type Props = React.ComponentProps<'button'> & VariantProps<typeof buttonStyles> & {
  /** Randează copilul (ex. un Link) cu stilul butonului. */
  asChild?: boolean
  loading?: boolean
}

export function Button({ className, variant, size, asChild, loading, children, disabled, ...props }: Props) {
  if (asChild) return <Slot.Root className={cn(buttonStyles({ variant, size }), className)} {...props}>{children}</Slot.Root>
  return (
    <button className={cn(buttonStyles({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  )
}
