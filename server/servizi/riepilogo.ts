// «A che punto siamo?» (SPEC §26): un colpo d'occhio che aggrega dati già esistenti, senza
// nuovi obblighi né scadenze. Le parti non usate nell'evento sono null (nessun falso allarme).
import type { PerTe, RiepilogoOrganizzativo } from '../../src/contratto/edizioni.ts'
import { contaPresenze } from '../../src/domain/partecipanti.ts'
import { copertiEquivalenti } from '../../src/domain/porzioni.ts'
import { oggiISO } from '../../src/domain/tempo.ts'
import { type Db, lettura } from '../db/connessione.ts'
import * as repoPart from '../db/repo/partecipanti.ts'
import * as repo from '../db/repo/riepilogo.ts'
import { elenca as elencaIncarichi } from './incarichi.ts'
import { leggiEvento } from './eventi.ts'
import { permessoEvento, puoPartecipare, richiediEvento, type UtenteCorrente } from './permessi.ts'
import { listaSpesa } from './spesa.ts'

export function riepilogo(db: Db, u: UtenteCorrente, eventoId: string, adesso = Date.now(), oggi = oggiISO()): RiepilogoOrganizzativo {
  return lettura(db, () => {
    richiediEvento(db, u, eventoId, 'lettura')
    const e = leggiEvento(db, eventoId)
    const archiviato = e.stato === 'archiviato'
    const righe = repoPart.partecipantiEvento(db, eventoId)
    const c = contaPresenze(righe.map(repoPart.presenza))
    const base = {
      menu: { voci: repo.vociMenu(db, eventoId), portateVuote: repo.portateVuote(db, eventoId) },
      coperti: { equivalenti: copertiEquivalenti(e), adulti: e.adulti, bambini: e.bambini, automatici: e.copertiAutomatici },
      partecipanti: righe.length
        ? { confermati: c.adulti.confermati + c.bambini.confermati, inAttesa: c.adulti.inAttesa + c.bambini.inAttesa, assenti: c.adulti.assenti + c.bambini.assenti }
        : null,
      archiviato,
    }
    if (archiviato) return { ...base, incarichi: null, attivita: null, proposte: null, sondaggi: null, spesa: null }

    // «Chi porta» conta solo se usato: almeno un piatto affidato o una cosa da portare.
    const inc = elencaIncarichi(db, u, eventoId).incarichi
    const voci = inc.filter((i) => i.tipo === 'voce')
    const cose = inc.filter((i) => i.tipo === 'cosa')
    const usato = cose.length > 0 || voci.some((v) => v.incaricato)
    const a = repo.attivita(db, eventoId, oggi)
    const s = listaSpesa(db, eventoId)
    const articoli = s.voci.length + s.manuali.length
    const proposte = repo.proposteInAttesa(db, eventoId)
    const sondaggi = repo.sondaggiAperti(db, eventoId, adesso)
    return {
      ...base,
      incarichi: usato
        ? {
            coseSenzaResponsabile: cose.filter((x) => !x.incaricato).length,
            daCompletare: inc.filter((x) => x.stato === 'assegnato').length,
            piattiNonAffidati: voci.filter((v) => !v.incaricato).length,
            responsabiliAssenti: inc.filter((x) => x.responsabileAssente).length,
          }
        : null,
      attivita: a.totale ? { daFare: a.da_fare, inRitardo: a.in_ritardo } : null,
      proposte: proposte ? { inAttesa: proposte } : null,
      sondaggi: sondaggi ? { aperti: sondaggi } : null,
      spesa: articoli ? { daComprare: s.contatori.da_comprare, daVerificare: s.contatori.da_verificare, avvisi: s.avvisi.length } : null,
    }
  })
}

/**
 * «Per te» (SPEC §31.3): cose da portare affidate all'utente e sondaggi a cui non ha risposto,
 * fra tutti gli eventi in corso e le sue Famiglie. Solo ciò che può ancora vedere e votare.
 */
export function perTe(db: Db, u: UtenteCorrente, adesso = Date.now()): PerTe {
  return lettura(db, () => ({
    incarichi: repo
      .incarichiMiei(db, u.id)
      .filter((r) => permessoEvento(db, u, r.evento_id) !== null)
      .map((r) => ({ tipo: r.tipo, id: r.id, nome: r.nome, evento: r.evento, data: r.data, collegamento: `/eventi/${r.evento_id}/chi-porta?incarico=${encodeURIComponent(`${r.tipo}:${r.id}`)}` })),
    sondaggi: repo
      .sondaggiDaVotare(db, u.id, adesso)
      .filter((r) => (r.evento_id ? puoPartecipare(db, u, r.evento_id) : true))
      .map((r) => ({
        id: r.id,
        testo: r.testo,
        dove: r.dove,
        collegamento: r.evento_id
          ? `/eventi/${r.evento_id}/bacheca?messaggio=${encodeURIComponent(r.id)}`
          : `/famiglia?famiglia=${encodeURIComponent(r.gruppo_id!)}&messaggio=${encodeURIComponent(r.id)}`,
      })),
  }))
}
