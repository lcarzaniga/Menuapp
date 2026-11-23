import { type ReactNode, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ILLUSTRAZIONI, type NomeIllustrazione } from './Illustrazioni'
import { PulsanteIndietro } from './Navigazione'

/** Intestazione e contenuto di una schermata. */
export function Pagina({
  titolo,
  sottotitolo,
  indietro,
  azioni,
  children,
  larga = false,
  className,
}: {
  titolo: ReactNode
  sottotitolo?: ReactNode
  indietro?: string
  azioni?: ReactNode
  children: ReactNode
  larga?: boolean
  className?: string
}) {
  useEffect(() => {
    if (typeof titolo === 'string') document.title = `${titolo} · Ricette & Co.`
  }, [titolo])
  return (
    <div className={cn('mx-auto w-full px-4 pb-28 pt-4 md:pb-12', larga ? 'max-w-5xl' : 'max-w-3xl', className)}>
      {/* Con poco spazio (telefono stretto, testo grande) le azioni vanno a capo invece di coprire il titolo. */}
      <header className="non-stampare mb-4 flex flex-wrap items-start gap-2">
        {indietro ? <PulsanteIndietro a={indietro} /> : null}
        <div className="min-w-0 flex-[1_1_12rem]">
          <h1 className="titolo text-[1.75rem] font-bold leading-tight break-words">{titolo}</h1>
          {/* Filetto corto in oro antico sotto il titolo: dettaglio editoriale, solo decoro. */}
          <span className="mt-1.5 block h-0.5 w-10 rounded-full bg-oro" aria-hidden />
          {sottotitolo ? <div className="mt-0.5 text-sm font-semibold text-testo-tenue">{sottotitolo}</div> : null}
        </div>
        {azioni ? <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">{azioni}</div> : null}
      </header>
      {children}
    </div>
  )
}

export function Vuoto({
  icona,
  illustrazione,
  titolo,
  testo,
  azione,
}: {
  icona?: ReactNode
  illustrazione?: NomeIllustrazione
  titolo: string
  testo?: ReactNode
  azione?: ReactNode
}) {
  const Disegno = illustrazione ? ILLUSTRAZIONI[illustrazione] : null
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-bordo/70 bg-carta/70 px-6 py-10 text-center shadow-carta">
      {Disegno ? <Disegno className="mb-1 h-32 w-auto" /> : icona ? <div className="text-testo-tenue [&_svg]:size-8">{icona}</div> : null}
      <p className="titolo text-xl font-bold">{titolo}</p>
      {testo ? <p className="max-w-sm text-sm text-testo-tenue">{testo}</p> : null}
      {azione ? <div className="mt-2">{azione}</div> : null}
    </div>
  )
}

export function Caricamento({ testo = 'Caricamento…' }: { testo?: string }) {
  return <p className="py-10 text-center text-sm text-testo-tenue">{testo}</p>
}
