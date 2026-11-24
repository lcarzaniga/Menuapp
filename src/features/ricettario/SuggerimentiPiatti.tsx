// Pezzi comuni per scegliere una ricetta da collegare a una voce di menù: ricerca, note sotto il
// nome, ordine. Li usano «Collega» nell'editor della voce e il ricettario contestuale del menù (§43).
import { Globe } from 'lucide-react'
import type { RiepilogoPiatto } from '@/contratto/ricettario.ts'
import { cercaRicette, type Risultato } from '@/domain/ricerca.ts'

/** Ricette per nome e ingredienti, le più pertinenti per prime (SPEC §23). */
export function cercaPiatti(piatti: RiepilogoPiatto[], testo: string, massimo = 5): Risultato<RiepilogoPiatto>[] {
  return cercaRicette(piatti, testo).slice(0, massimo)
}

/** «con zucchine, menta» sotto un piatto trovato per i suoi ingredienti. */
export function NotaIngredienti({ r }: { r: Risultato<RiepilogoPiatto> }) {
  return r.ingredientiTrovati.length ? <span className="block truncate text-xs text-testo-tenue">con {r.ingredientiTrovati.join(', ')}</span> : null
}

/**
 * Una pubblica di un'altra Famiglia si usa per copia (SPEC §36, D5): collegarla ne crea una copia
 * privata nel ricettario di chi organizza l'evento (riusata se esiste già). Lo si dice prima.
 */
export function NotaPubblica({ piatto }: { piatto: RiepilogoPiatto }) {
  return piatto.soloPubblica ? (
    <span className="block truncate text-xs text-primario">
      <Globe className="mr-1 inline size-3" />
      pubblica{piatto.famigliaOrigine ? ` · ${piatto.famigliaOrigine.nome}` : ''} · verrà copiata nel ricettario
    </span>
  ) : null
}

/** Le proprie prima delle pubbliche di altre Famiglie, a parità di pertinenza. */
export const propriePrima = <T extends { ricetta: RiepilogoPiatto }>(r: T[]) => [...r.filter((x) => !x.ricetta.soloPubblica), ...r.filter((x) => x.ricetta.soloPubblica)]
