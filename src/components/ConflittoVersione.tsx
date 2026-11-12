import { Button } from '@/components/ui/button'
import { Finestra } from '@/components/ui/dialog'
import { mostraConflitto, useConflitto } from '@/api/scrittura'

/** Finestra unica per i conflitti di versione fra dispositivi (SPEC §12.5). */
export function ConflittoVersione() {
  const c = useConflitto()
  return (
    <Finestra
      aperta={c !== null}
      onCambia={(a) => !a && c?.onRicarica()}
      titolo="Modificato da un altro dispositivo"
      descrizione={`${c?.titolo ?? 'Questo elemento'} è stato cambiato altrove mentre lo modificavi. La tua modifica non è stata salvata.`}
      piede={
        <>
          {c?.onSovrascrivi ? (
            <Button variante="contorno" onClick={() => c.onSovrascrivi?.()}>
              Sovrascrivi con la mia
            </Button>
          ) : null}
          <Button onClick={() => (c ? c.onRicarica() : mostraConflitto(null))}>Ricarica i dati attuali</Button>
        </>
      }
    >
      <p className="text-sm text-testo-tenue">
        <strong className="text-testo">Ricarica</strong> mostra la versione salvata dall'altro dispositivo (la tua modifica resta
        nel modulo, se è ancora aperto, per poterla ricopiare).{' '}
        {c?.onSovrascrivi ? (
          <>
            <strong className="text-testo">Sovrascrivi</strong> salva la tua versione al posto dell'altra.
          </>
        ) : null}
      </p>
    </Finestra>
  )
}
