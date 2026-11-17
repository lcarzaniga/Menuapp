// Scelta della ricorrenza di un evento (SPEC §28, §30): un solo elenco con le ricorrenze standard
// (sempre disponibili, uguali per tutte le Famiglie) e quelle della Famiglia, ben distinte anche
// quando hanno lo stesso nome, più «Nessuna». Usato creando, in Panoramica e duplicando.
import { Select } from '@/components/ui/campi'
import type { SceltaRicorrenza } from '@/contratto/eventi.ts'
import { RICORRENZE_STANDARD } from '@/domain/ricorrenze.ts'

/** Valore del selettore: '' nessuna, «standard:<id>» o «famiglia:<id>». */
export type ValoreRicorrenza = string

export const valoreDi = (r: { ricorrenzaId: string | null; ricorrenzaStandard: string | null }): ValoreRicorrenza =>
  r.ricorrenzaId ? `famiglia:${r.ricorrenzaId}` : r.ricorrenzaStandard ? `standard:${r.ricorrenzaStandard}` : ''

export function sceltaDi(v: ValoreRicorrenza): SceltaRicorrenza | null {
  if (v.startsWith('standard:')) return { tipo: 'standard', id: v.slice(9) }
  if (v.startsWith('famiglia:')) return { tipo: 'famiglia', id: v.slice(9) }
  return null
}

/** «Natale · standard», «Natale · della Famiglia». */
export const etichettaRicorrenza = (r: { tipo: 'standard' | 'famiglia'; nome: string }) => `${r.nome} · ${r.tipo === 'standard' ? 'standard' : 'della Famiglia'}`

export function SelettoreRicorrenza({
  id,
  valore,
  onCambia,
  famiglia,
  disabilitato,
  etichetta,
}: {
  id?: string
  valore: ValoreRicorrenza
  onCambia: (v: ValoreRicorrenza) => void
  /** Ricorrenze della Famiglia dell'evento. */
  famiglia: { id: string; nome: string }[]
  disabilitato?: boolean
  etichetta?: string
}) {
  return (
    <Select id={id} aria-label={etichetta} value={valore} disabled={disabilitato} onChange={(ev) => onCambia(ev.target.value)}>
      <option value="">Nessuna ricorrenza</option>
      <optgroup label="Ricorrenze standard">
        {RICORRENZE_STANDARD.map((r) => (
          <option key={r.id} value={`standard:${r.id}`}>
            {r.nome}
          </option>
        ))}
      </optgroup>
      {famiglia.length ? (
        <optgroup label="Ricorrenze della Famiglia">
          {famiglia.map((r) => (
            <option key={r.id} value={`famiglia:${r.id}`}>
              {r.nome} (della Famiglia)
            </option>
          ))}
        </optgroup>
      ) : null}
    </Select>
  )
}
