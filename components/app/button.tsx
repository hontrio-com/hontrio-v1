'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================
// Butoanele platformei, în designul Bezeno: pastile. Unul singur „primary" pe
// ecran (negru), restul „secondary" (alb, contur fin care se înnegrește la
// hover) sau „ghost". Apăsarea se simte, focusul se vede.
// =============================================

export const buttonStyles = cva(
  'relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-[background-color,border-color,box-shadow,color,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-black/15 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-[#0a0a0a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_20px_-10px_rgba(0,0,0,0.55)] hover:bg-[#2a2a2a]',
        secondary: 'border border-line bg-white text-neutral-900 hover:border-black',
        ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-black',
        danger: 'border border-line bg-white text-red-600 hover:border-red-600',
        dark: 'bg-neutral-900 text-white hover:bg-neutral-800',
      },
      size: {
        xs: 'h-7 px-2.5 text-[12px] [&_svg]:size-3.5',
        sm: 'h-8 px-3 text-[13px] [&_svg]:size-3.5',
        md: 'h-10 px-[1.1rem] text-[14px] [&_svg]:size-4',
        lg: 'h-12 px-6 text-[15px] [&_svg]:size-4',
        icon: 'size-9 [&_svg]:size-4',
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
