import { AlertDialog as AD, Dialog as D } from 'radix-ui'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

const sovrapposizione = 'fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0'
// Il pannello non scorre: scorre solo il contenuto, dentro i bordi arrotondati; titolo e pulsanti
// restano fermi.
const pannello =
  'fixed z-50 inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border border-bordo bg-carta pb-[env(safe-area-inset-bottom)] shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95'

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
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-5">
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
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {piede ? <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-bordo/60 px-5 py-4 sm:flex-row sm:justify-end">{piede}</div> : null}
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
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <AD.Title className="text-lg font-semibold">{titolo}</AD.Title>
            <AD.Description className={cn('mt-2 text-sm text-testo-tenue', !descrizione && 'sr-only')}>{descrizione ?? String(titolo)}</AD.Description>
            {children}
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 px-5 pb-5 sm:flex-row sm:justify-end">
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
