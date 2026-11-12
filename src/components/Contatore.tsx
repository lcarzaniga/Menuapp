import { Minus, Plus } from 'lucide-react'
import { Button } from './ui/button'

/** Campo numerico intero con − e + grandi, comodo sul telefono. */
export function Contatore({
  id,
  valore,
  onCambia,
  min = 0,
  max = 999,
  etichetta,
}: {
  id?: string
  valore: number
  onCambia: (n: number) => void
  min?: number
  max?: number
  etichetta: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button variante="contorno" misura="icona" aria-label={`Meno ${etichetta}`} onClick={() => onCambia(Math.max(min, valore - 1))} disabled={valore <= min}>
        <Minus />
      </Button>
      <input
        id={id}
        inputMode="numeric"
        aria-label={etichetta}
        className="h-11 w-16 rounded-xl border border-bordo bg-carta text-center text-[1.0625rem] font-semibold tabular-nums"
        value={valore}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''))
          if (Number.isFinite(n)) onCambia(Math.min(max, Math.max(min, n)))
        }}
      />
      <Button variante="contorno" misura="icona" aria-label={`Più ${etichetta}`} onClick={() => onCambia(Math.min(max, valore + 1))} disabled={valore >= max}>
        <Plus />
      </Button>
    </div>
  )
}
