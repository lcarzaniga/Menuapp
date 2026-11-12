import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const baseCampo =
  'w-full rounded-xl border border-bordo bg-carta px-3 text-[16px] text-testo placeholder:text-testo-tenue/70 focus:outline-2 focus:outline-anello disabled:opacity-60 aria-invalid:border-pericolo'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(baseCampo, 'h-11', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(baseCampo, 'min-h-24 py-2.5 leading-snug', className)} {...props} />
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(baseCampo, 'h-11 appearance-auto pr-2', className)} {...props} />
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('text-sm font-medium text-testo', className)} {...props} />
}

export function Campo({
  etichetta,
  aiuto,
  errore,
  children,
  className,
  htmlFor,
}: {
  etichetta: ReactNode
  aiuto?: ReactNode
  errore?: string | undefined
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{etichetta}</Label>
      {children}
      {errore ? <p className="text-sm text-pericolo">{errore}</p> : aiuto ? <p className="text-[13px] text-testo-tenue">{aiuto}</p> : null}
    </div>
  )
}

export function Casella({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return <input type="checkbox" className={cn('size-5 shrink-0 accent-primario', className)} {...props} />
}
