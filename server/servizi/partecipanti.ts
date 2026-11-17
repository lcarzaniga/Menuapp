// Partecipanti, conferme e accompagnatori (SPEC §24, §29.2). L'elenco non dà accesso all'evento e
// l'accesso non implica la partecipazione. Le presenze sono sempre manuali: le gestisce solo chi
// può modificare l'evento; nessuno risponde da sé, nemmeno per il proprio invito.
import { randomUUID } from 'node:crypto'
import type { AggiornaPartecipante, ImpostaCoperti, Invito, NuovoPartecipante, Partecipante, Partecipanti } from '../../src/contratto/partecipanti.ts'
import { type Anonimi, contaPresenze, NESSUN_ANONIMO, stessaPersona } from '../../src/domain/partecipanti.ts'
import { norm, pulisci } from '../../src/domain/testo.ts'
import { type Db, lettura, transazione } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import * as repoFam from '../db/repo/famiglia.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repo from '../db/repo/partecipanti.ts'
import { snapshotValido } from './archivio.ts'
import { accessoNegato, conflittoVersione, nonTrovato, regolaViolata } from './errori.ts'
import { leggiEvento, richiediModificabile } from './eventi.ts'
import { permessoEvento, richiediEvento, type UtenteCorrente } from './permessi.ts'
import { controllaVersione } from './versioni.ts'

const gestisce = (p: string | null) => p === 'proprietario' || p === 'modifica'

/** Incarichi dell'evento con il loro responsabile (per «porta: …» e gli avvisi). */
function incarichiEvento(db: Db, eventoId: string) {
  const voci = repoFam.vociIncarichi(db, eventoId).map((v) => ({ nome: v.nome, incaricatoId: v.incaricato_id, esternoId: v.incaricato_esterno_id, nomeNorm: norm(v.incaricato) }))
  const cose = repoFam.coseEvento(db, eventoId).map((c) => ({ nome: c.nome, incaricatoId: c.incaricato_id, esternoId: c.incaricato_esterno_id, nomeNorm: norm(c.incaricato) }))
  return [...voci, ...cose]
}

function verso(r: repo.RigaPartecipante, incarichi: ReturnType<typeof incarichiEvento>): Partecipante {
  const persona = { utenteId: r.utente_id, esternoId: r.esterno_id, nomeNorm: r.nome_norm }
  return {
    id: r.id,
    invitoId: r.invito_id,
    nome: r.nome,
    categoria: r.categoria,
    stato: r.stato,
    note: r.note,
    utenteId: r.utente_id,
    esternoId: r.esterno_id,
    anonimi: repo.anonimiDi(r),
    incarichi: incarichi.filter((i) => stessaPersona(i, persona)).map((i) => i.nome),
    versione: r.versione,
  }
}

/** Inviti con i loro accompagnatori nominativi, nell'ordine di inserimento. */
export function invitiDa(righe: Partecipante[]): Invito[] {
  return righe.filter((r) => r.invitoId === null).map((t) => ({ ...t, accompagnatori: righe.filter((a) => a.invitoId === t.id) }))
}

/** Persone con l'app che si possono indicare: membri della Famiglia dell'evento e persone dell'evento. */
function personeScegliibili(db: Db, eventoId: string): { id: string; nome: string }[] {
  const famiglia = repoAccesso.gruppoEvento(db, eventoId)
  const ids = new Set([...(famiglia ? repoAccesso.membriGruppo(db, famiglia).map((m) => m.utente_id) : []), ...repoAccesso.personeEvento(db, eventoId)])
  return [...ids]
    .map((id) => repoAccesso.leggiUtente(db, id))
    .filter((x) => x !== undefined && x.stato === 'attivo')
    .map((x) => ({ id: x!.id, nome: x!.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
}

const membroFamiglia = (db: Db, u: UtenteCorrente, famiglia: string | null) => Boolean(famiglia && repoAccesso.ruoloNelGruppo(db, famiglia, u.id))

export function elenca(db: Db, u: UtenteCorrente, eventoId: string): Partecipanti {
  return lettura(db, () => {
    const permesso = richiediEvento(db, u, eventoId, 'lettura')
    const e = leggiEvento(db, eventoId)
    // Evento archiviato: l'elenco com'era all'archiviazione (gli snapshot precedenti non lo hanno).
    const archiviato = e.stato === 'archiviato' ? snapshotValido(db, eventoId)?.contenuto.partecipanti : undefined
    const incarichi = incarichiEvento(db, eventoId)
    const righe = archiviato ? archiviato.flatMap(({ accompagnatori, ...t }) => [t, ...accompagnatori]) : repo.partecipantiEvento(db, eventoId).map((r) => verso(r, incarichi))
    const conteggio = contaPresenze(righe)
    const famiglia = repoAccesso.gruppoEvento(db, eventoId)
    const puoGestire = gestisce(permesso) && e.stato !== 'archiviato'
    return {
      inviti: invitiDa(righe),
      conteggio,
      copertiAutomatici: e.copertiAutomatici,
      copertiManuali: e.copertiManuali,
      copertiCalcolati: { adulti: conteggio.adulti.confermati, bambini: conteggio.bambini.confermati },
      coefficienteBambini: e.coefficienteBambini,
      maxAccompagnatori: e.maxAccompagnatori,
      puoGestire,
      gestori: gestori(db, eventoId),
      solaLettura: e.stato === 'archiviato',
      scelte: {
        persone: puoGestire ? personeScegliibili(db, eventoId) : [],
        rubrica: puoGestire && famiglia && membroFamiglia(db, u, famiglia) ? repoFam.rubrica(db, famiglia).map((x) => ({ id: x.id, nome: x.nome })) : [],
      },
    }
  })
}

/** Chi può aggiornare le presenze: il proprietario e chi ha il permesso di modifica. */
function gestori(db: Db, eventoId: string): string[] {
  const proprietario = repoAccesso.leggiUtente(db, repoAccesso.proprietarioEvento(db, eventoId) ?? '')?.nome
  const inModifica = repoAccesso.condivisioniEvento(db, eventoId).filter((c) => c.permesso === 'modifica').map((c) => c.nome)
  return [...(proprietario ? [proprietario] : []), ...inModifica]
}

/** Elenco da conservare nell'archivio: nomi, stati e accompagnatori, senza permessi. */
export function perArchivio(db: Db, eventoId: string): Invito[] {
  const incarichi = incarichiEvento(db, eventoId)
  return invitiDa(repo.partecipantiEvento(db, eventoId).map((r) => verso(r, incarichi)))
}

interface Contesto {
  r: repo.RigaPartecipante
}

/** Partecipante visibile all'utente (404 altrimenti), su un evento modificabile. */
const SOLO_CHI_ORGANIZZA = 'Le presenze le aggiorna solo chi può modificare l\'evento'

/** Per la rotta di creazione, prima di validare il corpo: solo chi può modificare l'evento. */
export function richiediAggiunta(db: Db, u: UtenteCorrente, eventoId: string): void {
  if (!gestisce(richiediEvento(db, u, eventoId, 'lettura'))) throw accessoNegato(SOLO_CHI_ORGANIZZA)
}

/**
 * Per le rotte, prima di validare il corpo: 404 se il partecipante non esiste o l'evento non è
 * visibile; 403 senza il permesso di modifica (anche per il proprio invito: niente risposte
 * personali, SPEC §29.2).
 */
export function richiedi(db: Db, u: UtenteCorrente, id: string): void {
  contesto(db, u, id)
}

function contesto(db: Db, u: UtenteCorrente, id: string): Contesto {
  const r = repo.leggiPartecipante(db, id)
  const permesso = r ? permessoEvento(db, u, r.evento_id) : null
  if (!r || !permesso) throw nonTrovato('Partecipante')
  if (!gestisce(permesso)) throw accessoNegato(SOLO_CHI_ORGANIZZA)
  richiediModificabile(leggiEvento(db, r.evento_id))
  return { r }
}

function riletto(db: Db, id: string): Partecipante {
  const r = repo.leggiPartecipante(db, id)
  if (!r) throw nonTrovato('Partecipante')
  return verso(r, incarichiEvento(db, r.evento_id))
}

/** Persone già nell'elenco: una persona compare una volta sola (niente doppi conteggi). */
function controllaDoppione(db: Db, eventoId: string, p: { utenteId: string | null; esternoId: string | null; nomeNorm: string }, escludi?: string): void {
  const altro = repo
    .partecipantiEvento(db, eventoId)
    .find((x) => x.id !== escludi && ((p.utenteId && x.utente_id === p.utenteId) || (p.esternoId && x.esterno_id === p.esternoId) || x.nome_norm === p.nomeNorm))
  if (altro) throw regolaViolata('gia_partecipante', `${altro.nome} è già nell'elenco dei partecipanti`, { partecipanteId: altro.id })
}

/** Chi è: un utente con l'app, una persona della rubrica o un nome (riconosciuto se già noto). */
function risolvi(db: Db, u: UtenteCorrente, eventoId: string, d: NuovoPartecipante, adesso: number) {
  const famiglia = repoAccesso.gruppoEvento(db, eventoId)
  const membro = membroFamiglia(db, u, famiglia)
  if (d.utenteId) {
    const p = personeScegliibili(db, eventoId).find((x) => x.id === d.utenteId)
    if (!p) throw nonTrovato('Persona')
    return { nome: p.nome, utenteId: p.id, esternoId: null }
  }
  if (d.esternoId) {
    const e = repoFam.leggiEsterno(db, d.esternoId)
    if (!e || e.gruppo_id !== famiglia || !membro) throw nonTrovato('Persona')
    return { nome: e.nome, utenteId: null, esternoId: e.id }
  }
  const nome = pulisci(d.nome!)
  const chiave = norm(nome)
  // Un nome già noto diventa quella persona: niente doppioni con chi usa l'app o con la rubrica.
  const conApp = personeScegliibili(db, eventoId).find((x) => norm(x.nome) === chiave)
  if (conApp) return { nome: conApp.nome, utenteId: conApp.id, esternoId: null }
  if (famiglia && membro) {
    const esistente = repoFam.esternoPerNome(db, famiglia, chiave)
    if (esistente) return { nome: esistente.nome, utenteId: null, esternoId: esistente.id }
    if (d.salvaInRubrica) {
      const id = randomUUID()
      repoFam.inserisciEsterno(db, { id, gruppoId: famiglia, nome, nomeNorm: chiave, note: '', creatoDa: u.id }, adesso)
      return { nome, utenteId: null, esternoId: id }
    }
  }
  return { nome, utenteId: null, esternoId: null }
}

export function crea(db: Db, u: UtenteCorrente, eventoId: string, d: NuovoPartecipante, adesso = Date.now()): Partecipante {
  return transazione(db, () => {
    richiediAggiunta(db, u, eventoId)
    richiediModificabile(leggiEvento(db, eventoId))
    const esistente = repo.leggiPartecipante(db, d.id)
    if (esistente) {
      // Ripetizione della stessa richiesta (rete instabile): restituisce quello già creato.
      if (esistente.evento_id === eventoId) return riletto(db, d.id)
      throw nonTrovato('Partecipante')
    }
    let titolare: repo.RigaPartecipante | undefined
    if (d.invitoId) {
      titolare = repo.leggiPartecipante(db, d.invitoId)
      if (!titolare || titolare.evento_id !== eventoId || titolare.invito_id !== null) throw nonTrovato('Invito')
    }
    const chi = risolvi(db, u, eventoId, d, adesso)
    const nomeNorm = norm(chi.nome)
    controllaDoppione(db, eventoId, { ...chi, nomeNorm })
    repo.inserisciPartecipante(
      db,
      {
        id: d.id,
        eventoId,
        invitoId: titolare?.id ?? null,
        nome: chi.nome,
        nomeNorm,
        categoria: d.categoria,
        stato: d.stato,
        note: pulisci(d.note),
        utenteId: chi.utenteId,
        esternoId: chi.esternoId,
        anonimi: NESSUN_ANONIMO,
        ordine: repo.prossimoOrdine(db, eventoId),
      },
      adesso,
    )
    incrementaRevisione(db)
    return riletto(db, d.id)
  })
}

function scrivi(db: Db, c: Contesto, versione: number, dati: Partial<Parameters<typeof repo.aggiornaPartecipante>[3]>, adesso: number): void {
  const r = c.r
  const ok = repo.aggiornaPartecipante(
    db,
    r.id,
    versione,
    {
      invitoId: r.invito_id,
      nome: r.nome,
      nomeNorm: r.nome_norm,
      categoria: r.categoria,
      stato: r.stato,
      note: r.note,
      utenteId: r.utente_id,
      esternoId: r.esterno_id,
      anonimi: repo.anonimiDi(r),
      ...dati,
    },
    adesso,
  )
  if (!ok) throw conflittoVersione(riletto(db, r.id))
}

/**
 * Nome, categoria, stato e note, solo da chi può modificare l'evento. Il nome di una persona
 * collegata (app o rubrica) segue la sua origine e non si cambia qui.
 */
export function aggiorna(db: Db, u: UtenteCorrente, id: string, d: AggiornaPartecipante, adesso = Date.now()): Partecipante {
  return transazione(db, () => {
    const c = contesto(db, u, id)
    const collegato = c.r.utente_id !== null || c.r.esterno_id !== null
    let nome = c.r.nome
    if (!collegato && pulisci(d.nome) !== c.r.nome) {
      nome = pulisci(d.nome)
      controllaDoppione(db, c.r.evento_id, { utenteId: null, esternoId: null, nomeNorm: norm(nome) }, id)
    }
    scrivi(db, c, d.versione, { nome, nomeNorm: norm(nome), categoria: d.categoria, stato: d.stato, note: pulisci(d.note) }, adesso)
    incrementaRevisione(db)
    return riletto(db, id)
  })
}

/** Accompagnatori senza nome dell'invito, per categoria e stato. */
export function impostaAnonimi(db: Db, u: UtenteCorrente, id: string, anonimi: Anonimi, versione: number, adesso = Date.now()): Partecipante {
  return transazione(db, () => {
    const c = contesto(db, u, id)
    if (c.r.invito_id !== null) throw regolaViolata('non_titolare', 'Gli accompagnatori si indicano sull\'invito principale')
    scrivi(db, c, versione, { anonimi }, adesso)
    incrementaRevisione(db)
    return riletto(db, id)
  })
}

/**
 * Un accompagnatore nominativo diventa un invito a sé: è la stessa riga, quindi la persona
 * continua a contare una volta sola (con il suo stato).
 */
export function rendiAutonomo(db: Db, u: UtenteCorrente, id: string, versione: number, adesso = Date.now()): Partecipante {
  return transazione(db, () => {
    const c = contesto(db, u, id)
    if (c.r.invito_id === null) throw regolaViolata('gia_autonomo', `${c.r.nome} ha già un invito suo`)
    scrivi(db, c, versione, { invitoId: null }, adesso)
    incrementaRevisione(db)
    return riletto(db, id)
  })
}

/** Togliere un invito toglie anche i suoi accompagnatori nominativi. */
export function elimina(db: Db, u: UtenteCorrente, id: string, versione: number): void {
  transazione(db, () => {
    contesto(db, u, id)
    controllaVersione(db, 'partecipanti', id, versione, () => riletto(db, id))
    repo.eliminaPartecipante(db, id)
    incrementaRevisione(db)
  })
}

/**
 * Modalità dei coperti e limite degli accompagnatori. I numeri manuali restano salvati: tornando
 * al manuale si possono copiare i calcolati (li manda il client). Partecipanti mai toccati.
 */
export function impostaCoperti(db: Db, u: UtenteCorrente, eventoId: string, d: ImpostaCoperti, adesso = Date.now()) {
  return transazione(db, () => {
    richiediEvento(db, u, eventoId, 'modifica')
    const e = leggiEvento(db, eventoId)
    richiediModificabile(e)
    controllaVersione(db, 'eventi', eventoId, d.versione, () => e)
    repo.impostaCoperti(db, eventoId, { automatici: d.automatici, adulti: d.adulti, bambini: d.bambini, maxAccompagnatori: d.maxAccompagnatori }, adesso)
    incrementaRevisione(db)
    return leggiEvento(db, eventoId)
  })
}
