// Famiglia attiva (SPEC §21.4): un filtro di navigazione ricordato su questo dispositivo, mai
// un'autorizzazione (il server verifica sempre l'appartenenza). Con una sola Famiglia è
// implicita e il selettore non compare; se quella scelta non è più valida se ne usa un'altra.
import { House } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import type { Gruppo } from '@/contratto/famiglia.ts'
import { cn } from '@/lib/utils'
import { useGruppi } from './api'

const CHIAVE = 'menuapp.famiglia'
const ascoltatori = new Set<() => void>()

function leggi(): string | null {
  try {
    return localStorage.getItem(CHIAVE)
  } catch {
    return null
  }
}

function scrivi(id: string): void {
  try {
    localStorage.setItem(CHIAVE, id)
  } catch {
    // preferenza non salvabile: vale finché la pagina resta aperta
  }
  memoria = id
  ascoltatori.forEach((f) => f())
}

let memoria: string | null = typeof window === 'undefined' ? null : leggi()

export interface FamigliaAttiva {
  famiglie: Gruppo[]
  attiva: Gruppo | null
  /** Più di una Famiglia: si mostra il selettore. */
  multiple: boolean
  caricamento: boolean
  scegli: (id: string) => void
}

export function useFamigliaAttiva(): FamigliaAttiva {
  const g = useGruppi()
  const scelta = useSyncExternalStore(
    (f) => {
      ascoltatori.add(f)
      return () => ascoltatori.delete(f)
    },
    () => memoria,
    () => memoria,
  )
  const famiglie = g.data ?? []
  const attiva = famiglie.find((f) => f.id === scelta) ?? famiglie[0] ?? null
  return { famiglie, attiva, multiple: famiglie.length >= 2, caricamento: g.isPending, scegli: scrivi }
}

/** Selettore discreto: compare solo con almeno due Famiglie. */
export function SelettoreFamiglia({ className }: { className?: string }) {
  const { famiglie, attiva, multiple, scegli } = useFamigliaAttiva()
  if (!multiple || !attiva) return null
  return (
    <label className={cn('flex min-w-0 items-center gap-2 rounded-xl border border-bordo/70 bg-carta px-2.5 text-sm', className)}>
      <House className="size-4 shrink-0 text-primario" aria-hidden />
      <span className="sr-only">Famiglia attiva</span>
      <select
        aria-label="Famiglia attiva"
        className="h-9 min-w-0 flex-1 cursor-pointer truncate bg-transparent font-medium outline-none"
        value={attiva.id}
        onChange={(e) => scegli(e.target.value)}
      >
        {famiglie.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
          </option>
        ))}
      </select>
    </label>
  )
}
