// Duplicazione degli eventi e ricorrenze degli eventi (SPEC §25, §28). Si copia la struttura
// (portate, menù, porzioni personalizzate, stile di stampa, piano da rifare e, a richiesta, i
// partecipanti da riconfermare); mai conferme, incarichi, voti, bacheca, notifiche, spesa o
// archiviazione. Un evento archiviato si duplica dal suo archivio, che resta com'è.
import { randomUUID } from 'node:crypto'
import type { Duplica, Edizione, Edizioni, EsitoDuplica } from '../../src/contratto/edizioni.ts'
import type { Invito } from '../../src/contratto/partecipanti.ts'
import { NESSUN_ANONIMO } from '../../src/domain/partecipanti.ts'
import { aggiungiGiorni, differenzaGiorni } from '../../src/domain/tempo.ts'
import { norm, pulisci } from '../../src/domain/testo.ts'
import { type Db, lettura, transazione, uno } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import * as repo from '../db/repo/eventi.ts'
import * as repoFam from '../db/repo/famiglia.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repoPart from '../db/repo/partecipanti.ts'
import * as repoRic from '../db/repo/ricettario.ts'
import * as repoRicorrenze from '../db/repo/ricorrenze.ts'
import * as repoStampa from '../db/repo/stampa.ts'
import { copiaPiattoDaSnapshot, eventoDaSnapshot, snapshotValido } from './archivio.ts'
import { creaAttivita, elencaAttivita } from './attivita.ts'
import { piattoPerEvento } from './condivisione.ts'
import { ErroreApi, nonTrovato, regolaViolata } from './errori.ts'
import { creaEvento, creaVoci, leggiEvento, leggiMenu, richiediModificabile } from './eventi.ts'
import { perArchivio } from './partecipanti.ts'
import { permessoEvento, richiediEvento, type UtenteCorrente } from './permessi.ts'

const puoModificare = (p: string | null) => p === 'proprietario' || p === 'modifica'

export function duplica(db: Db, cartellaFoto: string, u: UtenteCorrente, origineId: string, d: Duplica, adesso = Date.now()): EsitoDuplica {
  return transazione(db, () => {
    richiediEvento(db, u, origineId, 'lettura')
    // Ripetizione della stessa richiesta: l'evento c'è già ed è di chi lo ha chiesto.
    if (uno(db, 'SELECT 1 FROM eventi WHERE id = ?', d.id)) {
      if (repoAccesso.proprietarioEvento(db, d.id) === u.id) return { evento: leggiEvento(db, d.id), avvisi: [] }
      throw regolaViolata('id_esistente', 'Identificativo già usato')
    }
    const vivo = leggiEvento(db, origineId)
    const snap = vivo.stato === 'archiviato' ? snapshotValido(db, origineId) : undefined
    const origine = snap ? eventoDaSnapshot(snap.contenuto.evento) : vivo
    const portate = snap ? snap.contenuto.menu : leggiMenu(db, origineId).portate
    const stile = snap ? (snap.contenuto.stampa ?? null) : JSON.parse(repoStampa.leggiStile(db, origineId)?.opzioni ?? 'null')
    const attivita = snap ? snap.contenuto.attivita : elencaAttivita(db, origineId)
    const inviti: Invito[] = d.copiaPartecipanti ? (snap ? (snap.contenuto.partecipanti ?? []) : perArchivio(db, origineId)) : []
    const avvisi: string[] = []

    // Famiglia: quella scelta (se ne fai parte), altrimenti quella dell'originale se ne fai parte.
    const famigliaOrigine = repoAccesso.gruppoEvento(db, origineId)
    const gruppoId = d.gruppoId !== undefined ? d.gruppoId : famigliaOrigine && repoAccesso.ruoloNelGruppo(db, famigliaOrigine, u.id) ? famigliaOrigine : null
    if (gruppoId && !repoAccesso.ruoloNelGruppo(db, gruppoId, u.id)) throw nonTrovato('Famiglia')
    // Ricorrenza: quella scelta (della Famiglia del nuovo evento), altrimenti quella dell'originale
    // se resta nella stessa Famiglia e la ricorrenza esiste ancora.
    let ricorrenzaId: string | null = null
    if (d.ricorrenzaId) ricorrenzaId = ricorrenzaDellaFamiglia(db, d.ricorrenzaId, gruppoId)
    else if (d.ricorrenzaId === undefined && gruppoId && gruppoId === famigliaOrigine && origine.ricorrenzaId && repoRicorrenze.leggiRicorrenza(db, origine.ricorrenzaId)?.gruppo_id === gruppoId) {
      ricorrenzaId = origine.ricorrenzaId
    }

    // Nuovo evento: coperti manuali (con i partecipanti da riconfermare i calcolati sarebbero zero).
    const idPortate = new Map(portate.map((p) => [p.id, randomUUID()]))
    creaEvento(
      db,
      {
        id: d.id,
        nome: pulisci(d.nome),
        data: d.data,
        oraServizio: origine.oraServizio,
        tipo: origine.tipo,
        occasione: origine.occasione,
        adulti: origine.adulti,
        bambini: origine.bambini,
        coefficienteBambini: origine.coefficienteBambini,
        note: origine.note,
        portate: portate.map((p) => ({ id: idPortate.get(p.id)!, nome: p.nome })),
      },
      u.id,
      adesso,
      gruppoId,
    )
    repoPart.impostaCoperti(db, d.id, { automatici: false, adulti: origine.adulti, bambini: origine.bambini, maxAccompagnatori: origine.maxAccompagnatori }, adesso)

    // Menù: le ricette secondo le regole di sempre (del proprietario, o una copia riusata).
    const ricette = new Map<string, string | null>()
    const ricetta = (piattoId: string | null, nome: string): string | null => {
      if (!piattoId) return null
      if (ricette.has(piattoId)) return ricette.get(piattoId)!
      let id: string | null = null
      if (repoRic.leggiPiatto(db, piattoId)) {
        try {
          id = piattoPerEvento(db, cartellaFoto, u, d.id, piattoId, adesso)
        } catch (e) {
          if (!(e instanceof ErroreApi)) throw e
          avvisi.push(`«${nome}»: la ricetta non è disponibile per te, la voce resta senza ricetta`)
        }
      } else if (snap?.contenuto.piatti.some((p) => p.id === piattoId)) {
        id = copiaPiattoDaSnapshot(db, snap.id, piattoId, randomUUID(), u.id).id
        avvisi.push(`«${nome}»: la ricetta non c'è più, ricreata dall'archivio come tua ricetta privata`)
      } else {
        avvisi.push(`«${nome}»: la ricetta non c'è più, la voce resta senza ricetta`)
      }
      ricette.set(piattoId, id)
      return id
    }
    const idVoci = new Map<string, string>()
    for (const p of portate) {
      if (!p.voci.length) continue
      creaVoci(
        db,
        d.id,
        p.voci.map((v) => {
          const id = randomUUID()
          idVoci.set(v.id, id)
          // Uscite dalla spesa per un incarico: nella copia l'incarico non c'è, quindi tornano.
          const toltaDaIncarico = snap ? Boolean(v.incaricato) && !v.inSpesa : repoFam.leggiVoceIncarico(db, v.id)?.spesa_tolta_da_incarico === 1
          return { id, portataId: idPortate.get(p.id)!, nome: v.nome, piattoId: ricetta(v.piattoId, v.nome), porzioni: v.porzioni, inSpesa: v.inSpesa || toltaDaIncarico, note: v.note, incaricato: '' }
        }),
        (id) => id,
        adesso,
      )
    }
    // Da quale voce viene ciascuna: identità per il confronto fra edizioni.
    for (const [origine, nuova] of idVoci) repo.impostaOrigineVoce(db, nuova, origine)

    if (stile) repoStampa.inserisciStile(db, d.id, JSON.stringify(stile), adesso)

    // Piano: le stesse attività spostate sulla nuova data, tutte da fare.
    const giorni = differenzaGiorni(origine.data, d.data)
    for (const a of attivita) {
      creaAttivita(db, d.id, { id: randomUUID(), titolo: a.titolo, data: aggiungiGiorni(a.data, giorni), ora: a.ora, voceMenuId: a.voceMenuId ? (idVoci.get(a.voceMenuId) ?? null) : null, note: a.note }, adesso)
    }

    // Partecipanti: stessa composizione, tutto da riconfermare.
    if (inviti.length) copiaPartecipanti(db, d.id, gruppoId, inviti, avvisi, adesso)

    if (ricorrenzaId) repo.impostaRicorrenza(db, d.id, ricorrenzaId)
    incrementaRevisione(db)
    return { evento: leggiEvento(db, d.id), avvisi }
  })
}

function copiaPartecipanti(db: Db, eventoId: string, gruppoId: string | null, inviti: Invito[], avvisi: string[], adesso: number): void {
  let ordine = 0
  const rubrica = new Set(gruppoId ? repoFam.rubrica(db, gruppoId).map((e) => e.id) : [])
  const collegamenti = (p: Invito | Invito['accompagnatori'][number]) => {
    const utente = p.utenteId ? repoAccesso.leggiUtente(db, p.utenteId) : undefined
    const esterno = p.esternoId && rubrica.has(p.esternoId) ? p.esternoId : null
    if (p.esternoId && !esterno) avvisi.push(`${p.nome}: non è nella rubrica di questa Famiglia, resta solo il nome`)
    return { utenteId: utente && utente.stato === 'attivo' ? utente.id : null, esternoId: esterno }
  }
  for (const i of inviti) {
    const id = randomUUID()
    const a = i.anonimi
    repoPart.inserisciPartecipante(
      db,
      {
        id,
        eventoId,
        invitoId: null,
        nome: i.nome,
        nomeNorm: norm(i.nome),
        categoria: i.categoria,
        stato: 'in_attesa',
        note: i.note,
        ...collegamenti(i),
        anonimi: { ...NESSUN_ANONIMO, adultiInAttesa: a.adultiConfermati + a.adultiInAttesa, bambiniInAttesa: a.bambiniConfermati + a.bambiniInAttesa },
        ordine: ordine++,
      },
      adesso,
    )
    for (const c of i.accompagnatori) {
      repoPart.inserisciPartecipante(
        db,
        { id: randomUUID(), eventoId, invitoId: id, nome: c.nome, nomeNorm: norm(c.nome), categoria: c.categoria, stato: 'in_attesa', note: c.note, ...collegamenti(c), anonimi: NESSUN_ANONIMO, ordine: ordine++ },
        adesso,
      )
    }
  }
}

/** Una ricorrenza della Famiglia indicata (che l'utente ha già dimostrato di frequentare). */
function ricorrenzaDellaFamiglia(db: Db, ricorrenzaId: string, gruppoId: string | null): string {
  const r = repoRicorrenze.leggiRicorrenza(db, ricorrenzaId)
  if (!r) throw nonTrovato('Ricorrenza')
  if (r.gruppo_id !== gruppoId) throw regolaViolata('ricorrenza_altra_famiglia', 'La ricorrenza è di un\'altra Famiglia')
  return r.id
}

const edizione = (db: Db, id: string): Edizione => {
  const e = repo.leggiEvento(db, id)!
  return { id, nome: e.nome, data: e.data, stato: e.stato }
}

/** Ricorrenza dell'evento, le altre sue edizioni e gli altri eventi della Famiglia, solo quelli visibili. */
export function edizioni(db: Db, u: UtenteCorrente, eventoId: string): Edizioni {
  return lettura(db, () => {
    const permesso = richiediEvento(db, u, eventoId, 'lettura')
    const e = leggiEvento(db, eventoId)
    const famiglia = repoAccesso.gruppoEvento(db, eventoId)
    const membro = Boolean(famiglia && repoAccesso.ruoloNelGruppo(db, famiglia, u.id))
    const visibile = (id: string) => id !== eventoId && permessoEvento(db, u, id) !== null
    const ricorrenza = e.ricorrenzaId ? repoRicorrenze.leggiRicorrenza(db, e.ricorrenzaId) : undefined
    const stesse = ricorrenza ? repo.eventiDellaRicorrenza(db, ricorrenza.id).filter(visibile) : []
    const altri = repo
      .elencaEventi(db, u.id)
      .filter((x) => x.id !== eventoId && x.gruppo?.id === (famiglia ?? undefined) && !stesse.includes(x.id))
      .sort((a, b) => b.data.localeCompare(a.data))
    const puoAssociare = puoModificare(permesso) && membro && e.stato !== 'archiviato'
    return {
      ricorrenza: ricorrenza ? { id: ricorrenza.id, nome: ricorrenza.nome } : null,
      edizioni: stesse.map((id) => edizione(db, id)),
      altriEventi: altri.map((x) => ({ id: x.id, nome: x.nome, data: x.data, stato: x.stato })),
      ricorrenze: puoAssociare && famiglia ? repoRicorrenze.ricorrenzeFamiglia(db, famiglia).map((r) => ({ id: r.id, nome: r.nome })) : [],
      puoAssociare,
    }
  })
}

/** Associa l'evento a una ricorrenza della sua Famiglia (chi lo modifica e ne fa parte) o la toglie. */
export function associaRicorrenza(db: Db, u: UtenteCorrente, eventoId: string, ricorrenzaId: string | null): Edizioni {
  transazione(db, () => {
    richiediEvento(db, u, eventoId, 'modifica')
    richiediModificabile(leggiEvento(db, eventoId))
    if (ricorrenzaId) {
      const famiglia = repoAccesso.gruppoEvento(db, eventoId)
      if (!famiglia) throw regolaViolata('evento_personale', 'Un evento personale non ha ricorrenze: spostalo prima in una Famiglia')
      if (!repoAccesso.ruoloNelGruppo(db, famiglia, u.id)) throw nonTrovato('Ricorrenza')
      ricorrenzaDellaFamiglia(db, ricorrenzaId, famiglia)
    }
    repo.impostaRicorrenza(db, eventoId, ricorrenzaId)
    incrementaRevisione(db)
  })
  return edizioni(db, u, eventoId)
}
