// Controlli comuni delle pagine di stampa (menù e segnaposto).
import { Check, CloudOff, Loader2 } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Casella } from '@/components/ui/campi'
import { cn } from '@/lib/utils'
import type { StatoSalvataggio } from './useStile'

export function useLarghezza<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [larghezza, setLarghezza] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const aggiorna = () => setLarghezza(el.clientWidth)
    aggiorna()
    const ro = new ResizeObserver(aggiorna)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, larghezza }
}


export function Sezione({ titolo, children, className }: { titolo: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={titolo} className={cn('flex flex-col gap-3 rounded-2xl border border-bordo/70 bg-carta p-4 shadow-carta', className)}>
      <h2 className="titolo text-lg font-semibold">{titolo}</h2>
      {children}
    </section>
  )
}

export function Scelta({ attiva, disabled, onClick, children, verticale }: { attiva: boolean; disabled: boolean; onClick: () => void; children: ReactNode; verticale?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={attiva}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60',
        verticale && 'flex-col justify-center gap-1 px-2',
        attiva ? 'border-primario bg-primario-tenue/60 ring-1 ring-primario' : 'border-bordo bg-carta hover:bg-tenue',
      )}
    >
      {children}
    </button>
  )
}


export function Interruttore({ etichetta, aiuto, checked, disabled, onChange }: { etichetta: string; aiuto?: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 py-0.5 text-sm">
      <Casella className="mt-0.5" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex flex-col">
        <span className="font-medium">{etichetta}</span>
        {aiuto ? <span className="text-[0.8125rem] text-testo-tenue">{aiuto}</span> : null}
      </span>
    </label>
  )
}


export function StatoStile({ stato, modificabile, archiviato, onRiprova, salvato = 'stile salvato' }: { stato: StatoSalvataggio; modificabile: boolean; archiviato: boolean; onRiprova: () => void; salvato?: string }) {
  if (archiviato) return <span>sola lettura</span>
  if (!modificabile) return <span>sola lettura (server non raggiungibile)</span>
  if (stato === 'errore')
    return (
      <button type="button" className="inline-flex items-center gap-1 text-pericolo underline" onClick={onRiprova}>
        <CloudOff className="size-3.5" /> non salvato, riprova
      </button>
    )
  if (stato === 'salvato')
    return (
      <span className="inline-flex items-center gap-1" aria-live="polite">
        <Check className="size-3.5" /> {salvato}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1" aria-live="polite">
      <Loader2 className="size-3.5 animate-spin" /> salvataggio…
    </span>
  )
}
