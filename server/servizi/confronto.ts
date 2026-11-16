// Confronto fra due edizioni (SPEC §27): menù, portate, coperti, partecipanti e valutazioni
// delle preparazioni effettive. Un evento archiviato si legge dal suo archivio. Solo eventi
// visibili all'utente e della stessa Famiglia.
import type { Confronto } from '../../src/contratto/edizioni.ts'
import { confrontaMenu, type VoceConfronto } from '../../src/domain/confronto.ts'
import { norm } from '../../src/domain/testo.ts'
import { type Db, lettura } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import * as repo from '../db/repo/eventi.ts'
import * as repoFam from '../db/repo/famiglia.ts'
import * as repoRic from '../db/repo/ricettario.ts'
import { menuDaSnapshot } from './archivio.ts'
import { regolaViolata } from './errori.ts'
import { leggiEvento, leggiMenu } from './eventi.ts'
import { elenca as elencaPartecipanti } from './partecipanti.ts'
import { richiediEvento, type UtenteCorrente } from './permessi.ts'

interface Voce extends VoceConfronto {
  porzioni: number
  valutazione: { media: number; numero: number } | null
}

function lato(db: Db, u: UtenteCorrente, eventoId: string) {
  const e = leggiEvento(db, eventoId)
  const archiviato = e.stato === 'archiviato'
  const menu = archiviato ? menuDaSnapshot(db, eventoId) : leggiMenu(db, eventoId)
  const voti = repoFam.valutazioniEvento(db, eventoId)
  // Ricetta d'origine registrata con i voti: resta anche se la ricetta è stata eliminata.
  const origineVotata = new Map(repoFam.originiValutate(db, eventoId).map((r) => [r.voce_id, r.ricetta_origine_id]))
  const identita = (voceId: string, piattoId: string | null): string | null => {
    if (!piattoId) return null
    const vivo = repoRic.proprietaPiatto(db, piattoId)
    return vivo ? (vivo.originePiattoId ?? piattoId) : (origineVotata.get(voceId) ?? piattoId)
  }
  const origini = repo.originiVoci(db, eventoId)
  const voci: Voce[] = menu.portate.flatMap((p) =>
    p.voci.map((v) => {
      const stelle = voti.filter((x) => x.voce_id === v.id).map((x) => x.stelle)
      return {
        id: v.id,
        nome: v.nome,
        portata: p.nome,
        identita: identita(v.id, v.piattoId),
        origine: origini.get(v.id) ?? null,
        porzioni: v.porzioniEffettive,
        valutazione: stelle.length ? { media: Math.round((stelle.reduce((a, b) => a + b, 0) / stelle.length) * 10) / 10, numero: stelle.length } : null,
      }
    }),
  )
  const c = elencaPartecipanti(db, u, eventoId)
  return {
    info: {
      id: e.id,
      nome: menu.evento.nome,
      data: menu.evento.data,
      archiviato,
      coperti: { equivalenti: menu.copertiEquivalenti, adulti: menu.evento.adulti, bambini: menu.evento.bambini, automatici: menu.evento.copertiAutomatici },
      partecipanti: c.inviti.length
        ? { confermati: c.conteggio.adulti.confermati + c.conteggio.bambini.confermati, inAttesa: c.conteggio.adulti.inAttesa + c.conteggio.bambini.inAttesa, assenti: c.conteggio.adulti.assenti + c.conteggio.bambini.assenti }
        : null,
      portate: menu.portate.filter((p) => p.voci.length).map((p) => p.nome),
    },
    voci,
  }
}

const piatto = (v: Voce) => ({ nome: v.nome, portata: v.portata, porzioni: v.porzioni, valutazione: v.valutazione })

export function confronta(db: Db, u: UtenteCorrente, eventoId: string, conId: string): Confronto {
  return lettura(db, () => {
    richiediEvento(db, u, eventoId, 'lettura')
    richiediEvento(db, u, conId, 'lettura')
    if (conId === eventoId) throw regolaViolata('stessa_edizione', 'Scegli un altro evento da confrontare')
    if (repoAccesso.gruppoEvento(db, eventoId) !== repoAccesso.gruppoEvento(db, conId)) {
      throw regolaViolata('famiglie_diverse', 'Si confrontano solo eventi della stessa Famiglia')
    }
    const ora = lato(db, u, eventoId)
    const prima = lato(db, u, conId)
    const esito = confrontaMenu(ora.voci, prima.voci)
    const nomiPrima = new Set(prima.info.portate.map(norm))
    const nomiOra = new Set(ora.info.portate.map(norm))
    return {
      ora: ora.info,
      prima: prima.info,
      mantenuti: esito.mantenuti.map((m) => ({ ora: piatto(m.ora), prima: piatto(m.prima), corrispondenza: m.corrispondenza })),
      aggiunti: esito.aggiunti.map((v) => ({ ...piatto(v), omonimo: v.omonimo })),
      nonRiproposti: esito.nonRiproposti.map((v) => ({ ...piatto(v), omonimo: v.omonimo })),
      portate: { aggiunte: ora.info.portate.filter((p) => !nomiPrima.has(norm(p))), tolte: prima.info.portate.filter((p) => !nomiOra.has(norm(p))) },
    }
  })
}
