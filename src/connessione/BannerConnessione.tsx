import { CloudOff, RefreshCw, Wrench } from 'lucide-react'
import { useStatoConnessione } from './stato'

/** Banner fisso quando il server non è raggiungibile (SPEC §13). */
export function BannerConnessione({ onRiprova }: { onRiprova: () => void }) {
  const stato = useStatoConnessione()
  if (stato === 'connesso') return null
  const manutenzione = stato === 'in_manutenzione'
  return (
    <div role="status" aria-live="polite" className="non-stampare sticky top-0 z-40 flex items-center gap-3 bg-avviso-tenue px-4 py-2.5 text-sm text-avviso">
      {manutenzione ? <Wrench className="size-5 shrink-0" /> : <CloudOff className="size-5 shrink-0" />}
      <p className="flex-1 leading-snug">
        <strong>{manutenzione ? 'Manutenzione in corso' : 'Server non raggiungibile'}</strong>
        {' — '}le modifiche sono disattivate{manutenzione ? ' per qualche istante.' : '. Verifica che Tailscale sia attivo.'}
      </p>
      <button type="button" onClick={onRiprova} className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium hover:bg-avviso/10">
        <RefreshCw className="size-4" /> Riprova
      </button>
    </div>
  )
}
