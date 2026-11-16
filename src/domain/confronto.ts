// Confronto fra due edizioni di un evento (SPEC §27): quali piatti restano, quali sono nuovi e
// quali non sono stati riproposti. L'identità di un piatto è la sua ricetta d'origine (copie
// comprese); il nome da solo non basta: senza ricetta la corrispondenza è «incerta».
import { norm } from './testo.ts'

export interface VoceConfronto {
  id: string
  nome: string
  portata: string
  /** Ricetta d'origine (null: voce senza ricetta). */
  identita: string | null
  /** Voce da cui è stata copiata duplicando l'evento (null: aggiunta a mano). */
  origine: string | null
}

export interface Abbinamento<V extends VoceConfronto> {
  ora: V
  prima: V
  /** certa: copiata da quella voce o stessa ricetta d'origine; incerta: solo lo stesso nome, almeno una senza ricetta. */
  corrispondenza: 'certa' | 'incerta'
}

export interface EsitoConfronto<V extends VoceConfronto> {
  mantenuti: Abbinamento<V>[]
  aggiunti: (V & { omonimo: boolean })[]
  nonRiproposti: (V & { omonimo: boolean })[]
}

/**
 * Abbina le voci di `ora` a quelle di `prima`: prima per copia (la voce è stata duplicata da
 * quella) o ricetta d'origine (una a una), poi,
 * fra le rimaste, per nome quando almeno una delle due non ha ricetta (incerta). Due voci con lo
 * stesso nome ma ricette diverse restano distinte e sono segnalate come «omonime».
 */
export function confrontaMenu<V extends VoceConfronto>(ora: readonly V[], prima: readonly V[]): EsitoConfronto<V> {
  const libere = new Set(prima.map((v) => v.id))
  const mantenuti: Abbinamento<V>[] = []
  const restanti: V[] = []
  for (const v of ora) {
    const copiata = prima.find((x) => libere.has(x.id) && (v.origine === x.id || (x.origine !== null && x.origine === v.id)))
    // Una copia la cui ricetta è stata poi cambiata con un'altra non è più lo stesso piatto.
    const p = (copiata && (copiata.identita === v.identita || !copiata.identita || !v.identita) ? copiata : undefined) ?? (v.identita ? prima.find((x) => libere.has(x.id) && x.identita === v.identita) : undefined)
    if (p) {
      libere.delete(p.id)
      mantenuti.push({ ora: v, prima: p, corrispondenza: 'certa' })
    } else restanti.push(v)
  }
  const nuovi: V[] = []
  for (const v of restanti) {
    const p = prima.find((x) => libere.has(x.id) && norm(x.nome) === norm(v.nome) && (x.identita === null || v.identita === null))
    if (p) {
      libere.delete(p.id)
      mantenuti.push({ ora: v, prima: p, corrispondenza: 'incerta' })
    } else nuovi.push(v)
  }
  const tolti = prima.filter((x) => libere.has(x.id))
  const omonimo = (v: V, altri: V[]) => altri.some((x) => norm(x.nome) === norm(v.nome))
  return {
    mantenuti,
    aggiunti: nuovi.map((v) => ({ ...v, omonimo: omonimo(v, tolti) })),
    nonRiproposti: tolti.map((v) => ({ ...v, omonimo: omonimo(v, nuovi) })),
  }
}
