import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Pagina } from '@/components/Pagina'
import { Button } from '@/components/ui/button'

export function PaginaErrore() {
  const errore = useRouteError()
  const nonTrovata = isRouteErrorResponse(errore) && errore.status === 404
  return (
    <Pagina titolo={nonTrovata ? 'Pagina non trovata' : 'Qualcosa non ha funzionato'}>
      <p className="text-testo-tenue">
        {nonTrovata
          ? 'L\'indirizzo non corrisponde a nessuna schermata.'
          : 'Si è verificato un errore inatteso nell\'interfaccia. I dati salvati sul server non sono stati toccati.'}
      </p>
      {!nonTrovata && errore instanceof Error ? <pre className="mt-3 overflow-x-auto rounded-xl bg-tenue p-3 text-xs">{errore.message}</pre> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/">Torna agli eventi</Link>
        </Button>
        <Button variante="contorno" onClick={() => window.location.reload()}>
          Ricarica l'app
        </Button>
      </div>
    </Pagina>
  )
}

export function NonTrovata() {
  return (
    <Pagina titolo="Pagina non trovata">
      <p className="text-testo-tenue">L'indirizzo non corrisponde a nessuna schermata.</p>
      <Button asChild className="mt-5">
        <Link to="/">Torna agli eventi</Link>
      </Button>
    </Pagina>
  )
}
