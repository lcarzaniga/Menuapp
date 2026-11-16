// Duplicazione degli eventi ed edizioni di una ricorrenza (SPEC §25). Si copia la struttura
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
import * as repoStampa from '../db/repo/stampa.ts'
import { copiaPiattoDaSnapshot, eventoDaSnapshot, snapshotValido } from './archivio.ts'
import { creaAttivita, elencaAttivita } from './attivita.ts'
import { piattoPerEvento } from './condivisione.ts'
import { ErroreApi, nonTrovato, regolaViolata } from './errori.ts'
import { creaEvento, creaVoci, leggiEvento, leggiMenu } from './eventi.ts'
import { perArchivio } from './partecipanti.ts'
import { permessoEvento, richiediEvento, type UtenteCorrente } from './permessi.ts'

const puoModificare = (p: string | null) => p === 'proprietario' || p === 'modifica'

export function duplica(db: Db, cartellaFoto: string, u: UtenteCorrente, origineId: string, d: Duplica, adesso = Date.now()): EsitoDuplica {
  return transazione(db, () => {
    const permesso = richiediEvento(db, u, origineId, 'lettura')
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
    if (d.collegaSerie && gruppoId !== famigliaOrigine) throw regolaViolata('serie_altra_famiglia', 'Le edizioni di una ricorrenza restano nella stessa Famiglia: scegli la stessa Famiglia o non collegarle')
    if (d.collegaSerie && !origine.serieId && !puoModificare(permesso)) throw regolaViolata('serie_non_modificabile', 'Per collegare le edizioni serve poter modificare l\'evento originale')

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

    if (stile) repoStampa.inserisciStile(db, d.id, JSON.stringify(stile), adesso)

    // Piano: le stesse attività spostate sulla nuova data, tutte da fare.
    const giorni = differenzaGiorni(origine.data, d.data)
    for (const a of attivita) {
      creaAttivita(db, d.id, { id: randomUUID(), titolo: a.titolo, data: aggiungiGiorni(a.data, giorni), ora: a.ora, voceMenuId: a.voceMenuId ? (idVoci.get(a.voceMenuId) ?? null) : null, note: a.note }, adesso)
    }

    // Partecipanti: stessa composizione, tutto da riconfermare.
    if (inviti.length) copiaPartecipanti(db, d.id, gruppoId, inviti, avvisi, adesso)

    if (d.collegaSerie) {
      const serie = origine.serieId ?? repo.leggiEvento(db, origineId)?.serieId ?? randomUUID()
      if (!vivo.serieId) repo.impostaSerie(db, origineId, serie)
      repo.impostaSerie(db, d.id, serie)
    }
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

const edizione = (db: Db, id: string): Edizione => {
  const e = repo.leggiEvento(db, id)!
  return { id, nome: e.nome, data: e.data, stato: e.stato }
}

/** Edizioni della serie e altri eventi della stessa Famiglia, solo quelli che l'utente vede. */
export function edizioni(db: Db, u: UtenteCorrente, eventoId: string): Edizioni {
  return lettura(db, () => {
    const permesso = richiediEvento(db, u, eventoId, 'lettura')
    const e = leggiEvento(db, eventoId)
    const famiglia = repoAccesso.gruppoEvento(db, eventoId)
    const visibile = (id: string) => id !== eventoId && permessoEvento(db, u, id) !== null
    const serie = e.serieId ? repo.eventiDellaSerie(db, e.serieId).filter(visibile) : []
    // Altri eventi: della stessa Famiglia (o personali dello stesso tipo se l'evento è personale).
    const altri = repo
      .elencaEventi(db, u.id)
      .filter((x) => x.id !== eventoId && x.gruppo?.id === (famiglia ?? undefined) && !serie.includes(x.id))
      .sort((a, b) => b.data.localeCompare(a.data))
    return {
      serieId: e.serieId,
      edizioni: serie.map((id) => edizione(db, id)),
      altriEventi: altri.map((x) => ({ id: x.id, nome: x.nome, data: x.data, stato: x.stato })),
      puoCollegare: puoModificare(permesso),
    }
  })
}

/**
 * Collega l'evento alla serie di un altro (che deve poter modificare anche lui se non ha ancora
 * una serie), oppure lo scollega. Mai fra Famiglie diverse.
 */
export function collegaSerie(db: Db, u: UtenteCorrente, eventoId: string, conEventoId: string | null): Edizioni {
  transazione(db, () => {
    richiediEvento(db, u, eventoId, 'modifica')
    if (conEventoId === null) repo.impostaSerie(db, eventoId, null)
    else {
      const altro = richiediEvento(db, u, conEventoId, 'lettura')
      if (conEventoId === eventoId) throw regolaViolata('stessa_edizione', 'Scegli un altro evento')
      if (repoAccesso.gruppoEvento(db, conEventoId) !== repoAccesso.gruppoEvento(db, eventoId)) {
        throw regolaViolata('serie_altra_famiglia', 'Si collegano solo eventi della stessa Famiglia')
      }
      let serie = leggiEvento(db, conEventoId).serieId
      if (!serie) {
        if (!puoModificare(altro)) throw regolaViolata('serie_non_modificabile', 'Per collegarli serve poter modificare anche l\'altro evento')
        serie = randomUUID()
        repo.impostaSerie(db, conEventoId, serie)
      }
      repo.impostaSerie(db, eventoId, serie)
    }
    incrementaRevisione(db)
  })
  return edizioni(db, u, eventoId)
}
