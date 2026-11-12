import { ArrowLeft } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

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
    if (typeof titolo === 'string') document.title = `${titolo} · Menù & Co.`
  }, [titolo])
  return (
    <div className={cn('mx-auto w-full px-4 pb-28 pt-4 md:pb-12', larga ? 'max-w-5xl' : 'max-w-3xl', className)}>
      <header className="non-stampare mb-4 flex items-start gap-2">
        {indietro ? (
          <Link to={indietro} aria-label="Indietro" className="-ml-2 mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-tenue">
            <ArrowLeft className="size-5" />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{titolo}</h1>
          {sottotitolo ? <div className="mt-0.5 text-sm text-testo-tenue">{sottotitolo}</div> : null}
        </div>
        {azioni ? <div className="flex shrink-0 items-center gap-1">{azioni}</div> : null}
      </header>
      {children}
    </div>
  )
}

export function Vuoto({ icona, titolo, testo, azione }: { icona?: ReactNode; titolo: string; testo?: ReactNode; azione?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-bordo px-6 py-10 text-center">
      {icona ? <div className="text-testo-tenue [&_svg]:size-8">{icona}</div> : null}
      <p className="font-medium">{titolo}</p>
      {testo ? <p className="max-w-sm text-sm text-testo-tenue">{testo}</p> : null}
      {azione ? <div className="mt-2">{azione}</div> : null}
    </div>
  )
}

export function Caricamento({ testo = 'Caricamento…' }: { testo?: string }) {
  return <p className="py-10 text-center text-sm text-testo-tenue">{testo}</p>
}
