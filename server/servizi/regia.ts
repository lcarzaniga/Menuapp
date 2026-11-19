// Regia della cucina (SPEC §38): lettura che unisce piano, menù e ricette dell'evento. Le ricette
// collegate al menù si leggono come sempre da chi vede l'evento (§19.4).
import type { Regia } from '../../src/contratto/regia.ts'
import { attrezzatureRicetta } from '../../src/domain/regia.ts'
import { type Db, lettura } from '../db/connessione.ts'
import * as repoRic from '../db/repo/ricettario.ts'
import { elencaAttivita } from './attivita.ts'
import { leggiEvento, leggiMenu } from './eventi.ts'
import { richiediEvento, type UtenteCorrente } from './permessi.ts'

export function regia(db: Db, u: UtenteCorrente, eventoId: string): Regia {
  return lettura(db, () => {
    const permesso = richiediEvento(db, u, eventoId, 'lettura')
    const e = leggiEvento(db, eventoId)
    const archiviato = e.stato === 'archiviato'
    const piatti = leggiMenu(db, eventoId).portate.flatMap((p) =>
      p.voci.map((v) => {
        const r = v.piattoId ? repoRic.leggiPiatto(db, v.piattoId) : undefined
        return {
          voceId: v.id,
          nome: v.nome,
          portata: p.nome,
          piattoId: r ? r.id : null,
          preparazione: r?.tempoPreparazioneMin ?? null,
          cottura: r?.tempoCotturaMin ?? null,
          riposo: r?.tempoRiposoMin ?? null,
          attrezzature: r?.attrezzature ?? [],
          usa: r ? attrezzatureRicetta(r.attrezzature, r.procedimento) : [],
        }
      }),
    )
    return {
      evento: { id: e.id, nome: e.nome, data: e.data, oraServizio: e.oraServizio, archiviato },
      attivita: archiviato ? [] : elencaAttivita(db, eventoId),
      piatti,
      puoModificare: !archiviato && (permesso === 'proprietario' || permesso === 'modifica'),
    }
  })
}
