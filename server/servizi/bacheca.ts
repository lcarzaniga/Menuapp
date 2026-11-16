// Bacheche della famiglia e degli eventi (SPEC §20.1–20.4): messaggi, commenti, reazioni,
// fotografie, sondaggi e proposte di piatti. Un solo modello per tutti: il messaggio sta in
// un gruppo o in un evento e ne eredita i permessi.
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Bacheca, Commento, Messaggio, NuovoMessaggio, Reazione } from '../../src/contratto/famiglia.ts'
import { MASSIMO_ALLEGATI, REAZIONI } from '../../src/contratto/famiglia.ts'
import { LIMITE_BYTE_FOTO } from '../../src/contratto/foto.ts'
import { pulisci } from '../../src/domain/testo.ts'
import { type Db, lettura, transazione } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import * as repo from '../db/repo/famiglia.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repoRic from '../db/repo/ricettario.ts'
import { piattoPerEvento } from './condivisione.ts'
import { accessoNegato, conflittoVersione, nonTrovato, regolaViolata, richiestaNonValida } from './errori.ts'
import { creaVoci } from './eventi.ts'
import { fotoPrincipali, nomeFile, tipoDaContenuto } from './foto.ts'
import { avvisa, membriGruppo, personeEvento } from './notifiche.ts'
import { permessoEvento, puoPartecipare, richiediEvento, richiediGruppo, richiediPiatto, type UtenteCorrente } from './permessi.ts'

export interface Ambito {
  gruppoId: string | null
  eventoId: string | null
}
const ambitoDi = (m: { gruppo_id: string | null; evento_id: string | null }): Ambito => ({ gruppoId: m.gruppo_id, eventoId: m.evento_id })

/** Lettura: membri del gruppo, o chi vede l'evento. Scrittura: membri, o chi partecipa all'evento. */
export function richiediAmbito(db: Db, u: UtenteCorrente, a: Ambito, livello: 'lettura' | 'scrittura', cosa = 'Bacheca'): void {
  if (a.gruppoId) {
    try {
      richiediGruppo(db, u, a.gruppoId)
    } catch {
      throw nonTrovato(cosa)
    }
    return
  }
  richiediEvento(db, u, a.eventoId!, livello === 'lettura' ? 'lettura' : 'partecipa', cosa)
}

function puoScrivere(db: Db, u: UtenteCorrente, a: Ambito): boolean {
  return a.gruppoId ? repoAccesso.ruoloNelGruppo(db, a.gruppoId, u.id) !== undefined : puoPartecipare(db, u, a.eventoId!)
}

/** Fissa i messaggi: amministratori del gruppo; proprietario e collaboratori dell'evento. */
function puoFissare(db: Db, u: UtenteCorrente, a: Ambito): boolean {
  if (a.gruppoId) return repoAccesso.ruoloNelGruppo(db, a.gruppoId, u.id) === 'amministratore'
  const p = permessoEvento(db, u, a.eventoId!)
  return p === 'proprietario' || p === 'modifica'
}

/** Elimina messaggi altrui: amministratori del gruppo; proprietario dell'evento. */
function moderatore(db: Db, u: UtenteCorrente, a: Ambito): boolean {
  if (a.gruppoId) return repoAccesso.ruoloNelGruppo(db, a.gruppoId, u.id) === 'amministratore'
  return permessoEvento(db, u, a.eventoId!) === 'proprietario'
}

/** Il messaggio esiste e chi chiede può leggerlo (altrimenti «non trovato», come se non esistesse). */
export function richiediMessaggio(db: Db, u: UtenteCorrente, id: string, livello: 'lettura' | 'scrittura' = 'lettura'): repo.RigaMessaggio {
  const m = repo.leggiMessaggio(db, id)
  if (!m) throw nonTrovato('Messaggio')
  richiediAmbito(db, u, ambitoDi(m), 'lettura', 'Messaggio')
  if (livello === 'scrittura') richiediAmbito(db, u, ambitoDi(m), 'scrittura', 'Messaggio')
  return m
}

function piattoLeggibile(db: Db, u: UtenteCorrente, piattoId: string): boolean {
  try {
    richiediPiatto(db, u, piattoId, 'lettura')
    return true
  } catch {
    return false
  }
}

function schedaPiatto(db: Db, u: UtenteCorrente, piattoId: string | null, principali: Map<string, string>) {
  if (!piattoId || !piattoLeggibile(db, u, piattoId)) return null
  const p = repoRic.leggiPiatto(db, piattoId)
  const prop = repoRic.proprietaPiatto(db, piattoId)
  if (!p || !prop) return null
  return { id: p.id, nome: p.nome, fotoPrincipale: principali.get(p.id) ?? null, proprietario: prop.proprietarioNome }
}

const sondaggioChiuso = (s: repo.RigaSondaggio, adesso: number) => s.chiuso_il !== null || (s.scade_il !== null && s.scade_il <= adesso)

/** Messaggi pronti per chi legge: ricette e risultati mostrati solo se può vederli. */
function componi(db: Db, u: UtenteCorrente, righe: repo.RigaMessaggio[], adesso: number): Messaggio[] {
  const ids = righe.map((m) => m.id)
  const commenti = repo.commentiMessaggi(db, ids)
  const reazioni = repo.reazioniMessaggi(db, ids)
  const allegati = repo.allegatiMessaggi(db, ids)
  const principali = fotoPrincipali(db)
  const permessi = new Map<string, { scrivi: boolean; fissa: boolean; modera: boolean; decide: boolean }>()
  const perAmbito = (a: Ambito) => {
    const k = a.gruppoId ? `g:${a.gruppoId}` : `e:${a.eventoId}`
    let p = permessi.get(k)
    if (!p) {
      const perm = a.eventoId ? permessoEvento(db, u, a.eventoId) : null
      p = { scrivi: puoScrivere(db, u, a), fissa: puoFissare(db, u, a), modera: moderatore(db, u, a), decide: perm === 'proprietario' || perm === 'modifica' }
      permessi.set(k, p)
    }
    return p
  }
  return righe.map((m) => {
    const a = ambitoDi(m)
    const p = perAmbito(a)
    const mio = m.autore_id === u.id
    let sondaggio: Messaggio['sondaggio'] = null
    if (m.tipo === 'sondaggio') {
      const s = repo.leggiSondaggio(db, m.id)!
      const voti = repo.votiSondaggio(db, m.id)
      const chiuso = sondaggioChiuso(s, adesso)
      const mieScelte = voti.filter((v) => v.utente_id === u.id).map((v) => v.opzione_id)
      const visibili = s.risultati === 'sempre' || chiuso || (s.risultati === 'dopo_voto' && mieScelte.length > 0)
      sondaggio = {
        multipla: s.multipla === 1,
        risultati: s.risultati,
        scadeIl: s.scade_il,
        chiuso,
        risultatiVisibili: visibili,
        votanti: visibili ? new Set(voti.map((v) => v.utente_id)).size : null,
        opzioni: repo.opzioniSondaggio(db, m.id).map((o) => {
          const suoi = voti.filter((v) => v.opzione_id === o.id)
          return { id: o.id, testo: o.testo, voti: visibili ? suoi.length : null, nomi: visibili ? suoi.map((v) => v.nome) : [] }
        }),
        mieScelte,
        puoVotare: p.scrivi && !chiuso,
        puoChiudere: !chiuso && (mio || p.modera),
      }
    }
    let proposta: Messaggio['proposta'] = null
    if (m.tipo === 'proposta') {
      const r = repo.leggiProposta(db, m.id)!
      proposta = {
        nome: r.nome,
        piatto: schedaPiatto(db, u, r.piatto_id, principali),
        portataNome: r.portata_nome,
        stato: r.stato,
        voceId: r.voce_id,
        decisoDa: r.deciso_da_nome,
        puoDecidere: p.decide,
      }
    }
    const mieReazioni = reazioni.filter((r) => r.messaggio_id === m.id)
    return {
      id: m.id,
      ambito: m.gruppo_id ? { tipo: 'gruppo' as const, id: m.gruppo_id } : { tipo: 'evento' as const, id: m.evento_id! },
      tipo: m.tipo,
      autore: { id: m.autore_id, nome: m.autore_nome },
      testo: m.testo,
      fissato: m.fissato === 1,
      creatoIl: m.creato_il,
      modificatoIl: m.modificato_il,
      versione: m.versione,
      piatto: schedaPiatto(db, u, m.piatto_id, principali),
      piattoNascosto: m.piatto_id !== null && !piattoLeggibile(db, u, m.piatto_id),
      allegati: allegati.filter((x) => x.messaggio_id === m.id).map((x) => x.id),
      reazioni: REAZIONI.map((r) => {
        const chi = mieReazioni.filter((x) => x.reazione === r)
        return { reazione: r, numero: chi.length, mia: chi.some((x) => x.utente_id === u.id), nomi: chi.map((x) => x.nome) }
      }).filter((r) => r.numero > 0),
      commenti: commenti
        .filter((c) => c.messaggio_id === m.id)
        .map(
          (c): Commento => ({
            id: c.id,
            autore: { id: c.autore_id, nome: c.autore_nome },
            testo: c.testo,
            creatoIl: c.creato_il,
            modificatoIl: c.modificato_il,
            versione: c.versione,
            puoModificare: c.autore_id === u.id && p.scrivi,
          }),
        ),
      sondaggio,
      proposta,
      puoModificare: mio && p.scrivi,
      puoEliminare: (mio && p.scrivi) || p.modera,
      puoFissare: p.fissa,
    }
  })
}

export function leggiBacheca(db: Db, u: UtenteCorrente, a: Ambito, adesso = Date.now()): Bacheca {
  return lettura(db, () => {
    richiediAmbito(db, u, a, 'lettura')
    return { messaggi: componi(db, u, repo.messaggiBacheca(db, a), adesso), puoScrivere: puoScrivere(db, u, a) }
  })
}

export function leggiMessaggio(db: Db, u: UtenteCorrente, id: string, adesso = Date.now()): Messaggio {
  return componi(db, u, [richiediMessaggio(db, u, id)], adesso)[0]!
}

function destinatari(db: Db, a: Ambito): string[] {
  return a.gruppoId ? membriGruppo(db, a.gruppoId) : personeEvento(db, a.eventoId!)
}

export function pubblica(db: Db, u: UtenteCorrente, a: Ambito, d: NuovoMessaggio, adesso = Date.now()): Messaggio {
  return transazione(db, () => {
    richiediAmbito(db, u, a, 'scrittura')
    const esistente = repo.leggiMessaggio(db, d.id)
    if (esistente) {
      // Ripetizione dello stesso invio (rete instabile): stesso autore e stesso testo.
      if (esistente.autore_id === u.id && esistente.testo === d.testo.trim()) return leggiMessaggio(db, u, d.id, adesso)
      throw regolaViolata('id_esistente', 'Identificativo di messaggio già usato')
    }
    if (d.piattoId && !piattoLeggibile(db, u, d.piattoId)) throw nonTrovato('Piatto')
    if (d.proposta && !a.eventoId) throw richiestaNonValida('Le proposte di piatti si fanno nella bacheca di un evento')
    if (d.proposta?.piattoId && !piattoLeggibile(db, u, d.proposta.piattoId)) throw nonTrovato('Piatto')
    const tipo = d.sondaggio ? 'sondaggio' : d.proposta ? 'proposta' : 'messaggio'
    const testo = d.testo.trim()
    repo.inserisciMessaggio(db, { id: d.id, gruppoId: a.gruppoId, eventoId: a.eventoId, autoreId: u.id, tipo, testo, piattoId: d.piattoId }, adesso)
    if (d.sondaggio) {
      if (!testo) throw richiestaNonValida('Scrivi la domanda del sondaggio')
      const testi = d.sondaggio.opzioni.map((o) => pulisci(o))
      if (new Set(testi.map((x) => x.toLowerCase())).size !== testi.length) throw richiestaNonValida('Due opzioni sono uguali')
      if (d.sondaggio.scadeIl !== null && d.sondaggio.scadeIl <= adesso) throw richiestaNonValida('La scadenza deve essere nel futuro')
      repo.inserisciSondaggio(db, d.id, { ...d.sondaggio, opzioni: testi.map((t) => ({ id: randomUUID(), testo: t })) })
    }
    if (d.proposta) repo.inserisciProposta(db, d.id, { nome: pulisci(d.proposta.nome), piattoId: d.proposta.piattoId, portataNome: pulisci(d.proposta.portataNome) })
    const sintesi = d.proposta ? `propone «${pulisci(d.proposta.nome)}»` : testo
    avvisa(
      db,
      {
        tipo: d.sondaggio ? 'sondaggio' : d.proposta ? 'proposta' : a.gruppoId ? 'bacheca_famiglia' : 'bacheca_evento',
        attoreId: u.id,
        destinatari: destinatari(db, a),
        chiave: d.sondaggio ? `sondaggio:${d.id}` : d.proposta ? `proposte:${a.eventoId}` : `bacheca:${a.gruppoId ?? a.eventoId}`,
        gruppoId: a.gruppoId,
        eventoId: a.eventoId,
        messaggioId: d.id,
        testo: sintesi,
      },
      adesso,
    )
    incrementaRevisione(db)
    return leggiMessaggio(db, u, d.id, adesso)
  })
}

export function modifica(db: Db, u: UtenteCorrente, id: string, testo: string, versione: number, adesso = Date.now()): Messaggio {
  return transazione(db, () => {
    const m = richiediMessaggio(db, u, id, 'scrittura')
    if (m.autore_id !== u.id) throw accessoNegato('Puoi modificare solo i tuoi messaggi')
    if (m.tipo === 'sondaggio' && !testo.trim()) throw richiestaNonValida('Scrivi la domanda del sondaggio')
    if (repo.aggiornaTestoMessaggio(db, id, versione, testo.trim(), adesso) !== 1) throw conflittoVersione(leggiMessaggio(db, u, id, adesso))
    incrementaRevisione(db)
    return leggiMessaggio(db, u, id, adesso)
  })
}

/** Elimina un messaggio (autore o moderatore): restituisce i file degli allegati da togliere. */
export function elimina(db: Db, u: UtenteCorrente, id: string): string[] {
  return transazione(db, () => {
    const m = richiediMessaggio(db, u, id)
    const a = ambitoDi(m)
    if (!(m.autore_id === u.id && puoScrivere(db, u, a)) && !moderatore(db, u, a)) throw accessoNegato('Puoi eliminare solo i tuoi messaggi')
    const file = repo.allegatiMessaggi(db, [id]).map((x) => nomeFile(x))
    repo.eliminaMessaggio(db, id)
    incrementaRevisione(db)
    return file
  })
}

export function fissa(db: Db, u: UtenteCorrente, id: string, fissato: boolean, adesso = Date.now()): Messaggio {
  return transazione(db, () => {
    const m = richiediMessaggio(db, u, id)
    if (!puoFissare(db, u, ambitoDi(m))) throw accessoNegato('Solo chi organizza può fissare i messaggi')
    repo.fissaMessaggio(db, id, fissato, adesso)
    incrementaRevisione(db)
    return leggiMessaggio(db, u, id, adesso)
  })
}

// ── Commenti e reazioni ─────────────────────────────────────

export function commenta(db: Db, u: UtenteCorrente, messaggioId: string, d: { id: string; testo: string }, adesso = Date.now()): Messaggio {
  return transazione(db, () => {
    const m = richiediMessaggio(db, u, messaggioId, 'scrittura')
    const esistente = repo.leggiCommento(db, d.id)
    if (esistente) {
      if (esistente.autore_id === u.id && esistente.messaggio_id === messaggioId) return leggiMessaggio(db, u, messaggioId, adesso)
      throw regolaViolata('id_esistente', 'Identificativo di commento già usato')
    }
    const altri = repo.commentatori(db, messaggioId)
    repo.inserisciCommento(db, { id: d.id, messaggioId, autoreId: u.id, testo: d.testo.trim() }, adesso)
    // Risposta: all'autore del messaggio e a chi ne sta già discutendo.
    avvisa(
      db,
      {
        tipo: 'risposta',
        attoreId: u.id,
        destinatari: [m.autore_id, ...altri],
        chiave: `risposta:${messaggioId}`,
        gruppoId: m.gruppo_id,
        eventoId: m.evento_id,
        messaggioId,
        testo: d.testo,
      },
      adesso,
    )
    incrementaRevisione(db)
    return leggiMessaggio(db, u, messaggioId, adesso)
  })
}

export function modificaCommento(db: Db, u: UtenteCorrente, id: string, testo: string, versione: number, adesso = Date.now()): Messaggio {
  return transazione(db, () => {
    const c = repo.leggiCommento(db, id)
    if (!c) throw nonTrovato('Commento')
    richiediMessaggio(db, u, c.messaggio_id, 'scrittura')
    if (c.autore_id !== u.id) throw accessoNegato('Puoi modificare solo i tuoi commenti')
    if (repo.aggiornaCommento(db, id, versione, testo.trim(), adesso) !== 1) throw conflittoVersione(leggiMessaggio(db, u, c.messaggio_id, adesso))
    incrementaRevisione(db)
    return leggiMessaggio(db, u, c.messaggio_id, adesso)
  })
}

export function eliminaCommento(db: Db, u: UtenteCorrente, id: string): void {
  transazione(db, () => {
    const c = repo.leggiCommento(db, id)
    if (!c) throw nonTrovato('Commento')
    const m = richiediMessaggio(db, u, c.messaggio_id)
    if (c.autore_id !== u.id && !moderatore(db, u, ambitoDi(m))) throw accessoNegato('Puoi eliminare solo i tuoi commenti')
    repo.eliminaCommento(db, id)
    incrementaRevisione(db)
  })
}

export function reagisci(db: Db, u: UtenteCorrente, messaggioId: string, reazione: Reazione, attiva: boolean, adesso = Date.now()): Messaggio {
  return transazione(db, () => {
    richiediMessaggio(db, u, messaggioId, 'scrittura')
    if (attiva) repo.aggiungiReazione(db, messaggioId, u.id, reazione, adesso)
    else repo.togliReazione(db, messaggioId, u.id, reazione)
    incrementaRevisione(db)
    return leggiMessaggio(db, u, messaggioId, adesso)
  })
}

// ── Fotografie ──────────────────────────────────────────────

export async function allega(db: Db, cartella: string, u: UtenteCorrente, messaggioId: string, d: { id: string; dati: Buffer }, adesso = Date.now()): Promise<Messaggio> {
  const m = richiediMessaggio(db, u, messaggioId, 'scrittura')
  if (m.autore_id !== u.id) throw accessoNegato('Puoi aggiungere foto solo ai tuoi messaggi')
  if (d.dati.length === 0 || d.dati.length > LIMITE_BYTE_FOTO) throw richiestaNonValida('Foto vuota o più grande di 8 MB')
  const tipo = tipoDaContenuto(d.dati)
  if (!tipo) throw richiestaNonValida('Formato non supportato: servono JPEG, PNG o WebP')
  if (repo.leggiAllegato(db, d.id)) throw regolaViolata('id_esistente', 'Identificativo di foto già usato')
  const presenti = repo.allegatiMessaggi(db, [messaggioId]).length
  if (presenti >= MASSIMO_ALLEGATI) throw regolaViolata('troppe_foto', `Al massimo ${MASSIMO_ALLEGATI} foto per messaggio`)
  await mkdir(cartella, { recursive: true })
  const finale = join(cartella, nomeFile({ id: d.id, tipo }))
  await writeFile(`${finale}.tmp-${process.pid}`, d.dati)
  await rename(`${finale}.tmp-${process.pid}`, finale)
  try {
    return transazione(db, () => {
      repo.inserisciAllegato(db, { id: d.id, messaggio_id: messaggioId, ordine: presenti, tipo, byte: d.dati.length, sha256: createHash('sha256').update(d.dati).digest('hex') }, adesso)
      incrementaRevisione(db)
      return leggiMessaggio(db, u, messaggioId, adesso)
    })
  } catch (e) {
    await rm(finale, { force: true })
    throw e
  }
}

/** Allegato da servire: solo a chi può leggere il messaggio. */
export function leggiAllegato(db: Db, u: UtenteCorrente, id: string): repo.RigaAllegato {
  const a = repo.leggiAllegato(db, id)
  if (!a) throw nonTrovato('Foto')
  try {
    richiediMessaggio(db, u, a.messaggio_id)
  } catch {
    throw nonTrovato('Foto')
  }
  return a
}

/** File degli allegati di un evento (da togliere quando l'evento viene eliminato). */
export const fileAllegatiEvento = (db: Db, eventoId: string) => repo.allegatiEvento(db, eventoId).map((x) => nomeFile(x))

export async function togliFile(cartella: string, nomi: string[]): Promise<void> {
  for (const n of nomi) await rm(join(cartella, n), { force: true })
}

// ── Sondaggi ────────────────────────────────────────────────

/** Un insieme di preferenze per utente: il nuovo voto sostituisce il precedente (vuoto = ritiro). */
export function vota(db: Db, u: UtenteCorrente, id: string, opzioni: string[], adesso = Date.now()): Messaggio {
  return transazione(db, () => {
    const m = richiediMessaggio(db, u, id, 'scrittura')
    const s = m.tipo === 'sondaggio' ? repo.leggiSondaggio(db, id) : undefined
    if (!s) throw richiestaNonValida('Il messaggio non è un sondaggio')
    if (sondaggioChiuso(s, adesso)) throw regolaViolata('sondaggio_chiuso', 'Il sondaggio è chiuso')
    const valide = new Set(repo.opzioniSondaggio(db, id).map((o) => o.id))
    const scelte = [...new Set(opzioni)]
    if (scelte.some((o) => !valide.has(o))) throw richiestaNonValida('Opzione inesistente')
    if (s.multipla === 0 && scelte.length > 1) throw richiestaNonValida('In questo sondaggio si sceglie una sola opzione')
    repo.sostituisciVoti(db, id, u.id, scelte, adesso)
    incrementaRevisione(db)
    return leggiMessaggio(db, u, id, adesso)
  })
}

export function chiudi(db: Db, u: UtenteCorrente, id: string, adesso = Date.now()): Messaggio {
  return transazione(db, () => {
    const m = richiediMessaggio(db, u, id)
    const s = m.tipo === 'sondaggio' ? repo.leggiSondaggio(db, id) : undefined
    if (!s) throw richiestaNonValida('Il messaggio non è un sondaggio')
    if (m.autore_id !== u.id && !moderatore(db, u, ambitoDi(m))) throw accessoNegato('Solo chi ha creato il sondaggio (o chi organizza) può chiuderlo')
    if (repo.chiudiSondaggio(db, id, u.id, adesso) === 1) {
      avvisa(
        db,
        { tipo: 'sondaggio', attoreId: u.id, destinatari: destinatari(db, ambitoDi(m)), chiave: `sondaggio-chiuso:${id}`, gruppoId: m.gruppo_id, eventoId: m.evento_id, messaggioId: id, testo: `Sondaggio chiuso: ${m.testo}` },
        adesso,
      )
      incrementaRevisione(db)
    }
    return leggiMessaggio(db, u, id, adesso)
  })
}

// ── Proposte di piatti ──────────────────────────────────────

function richiediProposta(db: Db, u: UtenteCorrente, id: string) {
  const m = richiediMessaggio(db, u, id)
  const p = m.tipo === 'proposta' ? repo.leggiProposta(db, id) : undefined
  if (!p || !m.evento_id) throw richiestaNonValida('Il messaggio non è una proposta')
  // Decide chi organizza: proprietario o collaboratore con la modifica.
  richiediEvento(db, u, m.evento_id, 'modifica')
  return { m, p, eventoId: m.evento_id }
}

export function decidi(db: Db, u: UtenteCorrente, id: string, stato: 'in_valutazione' | 'accettata' | 'rifiutata', adesso = Date.now()): Messaggio {
  return transazione(db, () => {
    const { m, p, eventoId } = richiediProposta(db, u, id)
    if (p.stato !== stato) {
      repo.decidiProposta(db, id, stato, u.id, adesso)
      if (stato !== 'in_valutazione') {
        avvisa(
          db,
          { tipo: 'esito_proposta', attoreId: u.id, destinatari: [m.autore_id], chiave: `esito:${id}`, eventoId, messaggioId: id, testo: `«${p.nome}» ${stato === 'accettata' ? 'accettata' : 'non accettata'}` },
          adesso,
        )
      }
      incrementaRevisione(db)
    }
    return leggiMessaggio(db, u, id, adesso)
  })
}

/**
 * Inserisce la proposta nel menù (una volta sola: se la voce c'è già non ne crea un'altra).
 * La ricetta proposta entra come copia nel ricettario del proprietario dell'evento, con
 * l'accesso di chi l'ha proposta; se nel frattempo non è più leggibile, entra il solo nome.
 */
export function inserisciNelMenu(db: Db, cartellaFoto: string, u: UtenteCorrente, id: string, portataId: string, adesso = Date.now()): Messaggio {
  return transazione(db, () => {
    const { m, p, eventoId } = richiediProposta(db, u, id)
    const voceId = `${id}:voce`
    if (p.voce_id && repoAccesso.eventoDiVoce(db, p.voce_id)) return leggiMessaggio(db, u, id, adesso)
    const proponente: UtenteCorrente = { id: m.autore_id, nome: m.autore_nome, ruolo: 'utente', sessioneId: '', ingresso: 'privato' }
    let piattoId: string | null = null
    if (p.piatto_id) {
      try {
        piattoId = piattoPerEvento(db, cartellaFoto, proponente, eventoId, p.piatto_id, adesso)
      } catch {
        piattoId = null
      }
    }
    if (repoAccesso.eventoDiVoce(db, voceId)) {
      repo.collegaVoceProposta(db, id, voceId)
    } else {
      creaVoci(db, eventoId, [{ id: voceId, portataId, nome: p.nome, piattoId }], (x) => x, adesso)
      repo.collegaVoceProposta(db, id, voceId)
    }
    if (p.stato !== 'accettata') {
      repo.decidiProposta(db, id, 'accettata', u.id, adesso)
      avvisa(db, { tipo: 'esito_proposta', attoreId: u.id, destinatari: [m.autore_id], chiave: `esito:${id}`, eventoId, messaggioId: id, testo: `«${p.nome}» entra nel menù` }, adesso)
    }
    avvisa(db, { tipo: 'menu', attoreId: u.id, destinatari: personeEvento(db, eventoId), chiave: `menu:${eventoId}`, eventoId, testo: `Aggiunto «${p.nome}» al menù` }, adesso)
    incrementaRevisione(db)
    return leggiMessaggio(db, u, id, adesso)
  })
}

/** Il commento esiste e chi chiede vede il suo messaggio. */
export function richiediCommento(db: Db, u: UtenteCorrente, id: string): void {
  const c = repo.leggiCommento(db, id)
  if (!c) throw nonTrovato('Commento')
  richiediMessaggio(db, u, c.messaggio_id)
}

/** Decisioni sulle proposte: chi organizza l'evento (prima della validazione del corpo). */
export function richiediDecisione(db: Db, u: UtenteCorrente, id: string): void {
  richiediProposta(db, u, id)
}
