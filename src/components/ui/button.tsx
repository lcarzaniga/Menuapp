import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const varianteBottone = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 select-none',
  {
    variants: {
      variante: {
        primario: 'bg-primario text-primario-testo hover:bg-primario-forte active:bg-primario-forte',
        secondario: 'bg-tenue text-testo hover:bg-bordo/70',
        contorno: 'border border-oro/60 bg-carta hover:bg-tenue',
        /** Destinazioni equivalenti (Menù, Persone, Prepara): nessuna prevale, distinte dalle azioni piene. */
        navigazione: 'border border-primario/30 bg-carta text-primario-forte hover:border-primario/55 hover:bg-primario-tenue active:border-primario/55 active:bg-primario-tenue',
        fantasma: 'hover:bg-tenue',
        pericolo: 'bg-pericolo text-white hover:brightness-110',
        collegamento: 'text-primario underline decoration-oro/70 underline-offset-4 hover:decoration-oro px-0',
      },
      misura: {
        normale: 'h-11 px-4',
        piccolo: 'h-9 px-3 text-[0.8125rem]',
        grande: 'h-12 px-5 text-base',
        icona: 'size-11',
        iconaPiccola: 'size-9',
      },
    },
    defaultVariants: { variante: 'primario', misura: 'normale' },
  },
)

export function Button({
  className,
  variante,
  misura,
  asChild = false,
  type,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof varianteBottone> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return <Comp type={asChild ? undefined : (type ?? 'button')} className={cn(varianteBottone({ variante, misura }), className)} {...props} />
}
