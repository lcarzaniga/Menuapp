import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const varianteBadge = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    variante: {
      neutro: 'bg-tenue text-testo-tenue',
      /** L'anello tiene la forma anche sulla superficie secondaria, che in chiaro ha lo stesso ottanio chiarissimo. */
      primario: 'bg-primario-tenue text-primario-forte ring-1 ring-primario/20',
      successo: 'bg-successo-tenue text-successo',
      avviso: 'bg-avviso-tenue text-avviso',
      pericolo: 'bg-pericolo-tenue text-pericolo',
      info: 'bg-info-tenue text-info',
      /** Conto alla rovescia di un evento («tra 35 giorni»): nelle tonalità dell'oro. */
      tempo: 'bg-oro-tenue text-oro-forte font-semibold ring-1 ring-oro',
    },
  },
  defaultVariants: { variante: 'neutro' },
})

export function Badge({ className, variante, ...props }: ComponentProps<'span'> & VariantProps<typeof varianteBadge>) {
  return <span className={cn(varianteBadge({ variante }), className)} {...props} />
}
