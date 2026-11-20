import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const varianteBadge = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    variante: {
      neutro: 'bg-tenue text-testo-tenue',
      primario: 'bg-primario-tenue text-primario-forte',
      successo: 'bg-successo-tenue text-successo',
      avviso: 'bg-avviso-tenue text-avviso',
      pericolo: 'bg-pericolo-tenue text-pericolo',
      info: 'bg-info-tenue text-info',
      /** Conto alla rovescia di un evento («tra 35 giorni»): ottanio con il contorno in oro antico. */
      tempo: 'bg-primario-tenue text-primario-forte font-semibold ring-1 ring-oro',
    },
  },
  defaultVariants: { variante: 'neutro' },
})

export function Badge({ className, variante, ...props }: ComponentProps<'span'> & VariantProps<typeof varianteBadge>) {
  return <span className={cn(varianteBadge({ variante }), className)} {...props} />
}
