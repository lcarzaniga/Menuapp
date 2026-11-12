import { AlertDialog as AD, Dialog as D } from 'radix-ui'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

const sovrapposizione = 'fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0'
const pannello =
  'fixed z-50 inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-bordo bg-carta p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95'

/** Finestra: sul telefono sale dal basso, su schermi larghi è centrata. */
export function Finestra({
  aperta,
  onCambia,
  titolo,
  descrizione,
  children,
  piede,
  className,
}: {
  aperta: boolean
  onCambia: (aperta: boolean) => void
  titolo: ReactNode
  descrizione?: ReactNode
  children?: ReactNode
  piede?: ReactNode
  className?: string
}) {
  return (
    <D.Root open={aperta} onOpenChange={onCambia}>
      <D.Portal>
        <D.Overlay className={sovrapposizione} />
        <D.Content className={cn(pannello, className)} aria-describedby={descrizione ? undefined : undefined}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <D.Title className="text-lg font-semibold leading-tight">{titolo}</D.Title>
              {descrizione ? <D.Description className="mt-1 text-sm text-testo-tenue">{descrizione}</D.Description> : <D.Description className="sr-only">{String(titolo)}</D.Description>}
            </div>
            <D.Close asChild>
              <Button variante="fantasma" misura="iconaPiccola" aria-label="Chiudi">
                <X />
              </Button>
            </D.Close>
          </div>
          {children}
          {piede ? <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{piede}</div> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

/** Conferma esplicita (eliminazioni, ripristini). */
export function Conferma({
  aperta,
  onCambia,
  titolo,
  descrizione,
  etichettaConferma = 'Conferma',
  pericolosa = false,
  onConferma,
  children,
  disabilitata = false,
}: {
  aperta: boolean
  onCambia: (aperta: boolean) => void
  titolo: ReactNode
  descrizione?: ReactNode
  etichettaConferma?: string
  pericolosa?: boolean
  onConferma: () => void
  children?: ReactNode
  disabilitata?: boolean
}) {
  return (
    <AD.Root open={aperta} onOpenChange={onCambia}>
      <AD.Portal>
        <AD.Overlay className={sovrapposizione} />
        <AD.Content className={pannello}>
          <AD.Title className="text-lg font-semibold">{titolo}</AD.Title>
          <AD.Description className={cn('mt-2 text-sm text-testo-tenue', !descrizione && 'sr-only')}>{descrizione ?? String(titolo)}</AD.Description>
          {children}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AD.Cancel asChild>
              <Button variante="contorno">Annulla</Button>
            </AD.Cancel>
            <AD.Action asChild>
              <Button variante={pericolosa ? 'pericolo' : 'primario'} onClick={onConferma} disabled={disabilitata}>
                {etichettaConferma}
              </Button>
            </AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  )
}
