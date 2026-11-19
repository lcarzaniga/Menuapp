// Collaborazione sulle ricette (SPEC §41). Il proprietario controlla la versione ufficiale: gli
// altri membri autorizzati propongono modifiche, lui le approva o rifiuta una per una. Le modifiche
// approvate passano da `aggiornaPiatto` (stessi controlli, versione, cronologia). La proprietà si
// trasferisce solo con l'accettazione del destinatario.
import { randomUUID } from 'node:crypto'
import type { Collaborazione, Cronologia, Decisioni, Modifica, Proposta, Proposte, Revisione, Trasferimento } from '../../src/contratto/collaborazione.ts'
import type { AggiornaPiatto } from '../../src/contratto/ricettario.ts'
import { applica, type ContenutoRicetta, contenutoDi, differenze, dipendenzeMancanti, inConflitto, type ModificaProposta } from '../../src/domain/ricetta/proposte.ts'
import { type Db, esegui, lettura, transazione, tutti } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import * as repo from '../db/repo/collaborazione.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repoRev from '../db/repo/revisioni.ts'
import * as repoRic from '../db/repo/ricettario.ts'
import type { CartellaFile } from './cartella.ts'
import { piattoPerEvento } from './condivisione.ts'
import { accessoNegato, conflittoVersione, nonTrovato, regolaViolata } from './errori.ts'
import { caricaFoto, elencaFoto, fotoProposta, leggiFoto, nomeFile, rendiUfficiale } from './foto.ts'
import { avvisa } from './notifiche.ts'
import { richiediPiatto, richiediProponente, richiediProposta, type UtenteCorrente } from './permessi.ts'
import { aggiornaPiatto } from './ricettario.ts'
import { contenutoAttuale, persona, registraEvento } from './revisioni.ts'

const json = (v: unknown) => (v === undefined ? null : JSON.stringify(v))
const daJson = (s: string | null) => (s === null ? null : JSON.parse(s))
const nomePiatto = (db: Db, id: string) => repoRic.leggiPiatto(db, id)?.nome ?? 'una ricetta'

function modificaDi(r: repo.RigaModifica): ModificaProposta {
  return { id: r.id, campo: r.campo as ModificaProposta['campo'], operazione: r.operazione, chiave: r.chiave, prima: daJson(r.prima), dopo: daJson(r.dopo), dipendeDa: r.dipende_da }
}

// ── Lettura ──────────────────────────────────────────────────

function proposta(db: Db, u: UtenteCorrente, p: repo.RigaProposta, ufficiale: ContenutoRicetta, foto: { id: string }[]): Proposta {
  const proprietario = repoAccesso.proprietarioPiatto(db, p.piatto_id) === u.id
  const fotoProposte = new Map(fotoProposta(db, p.id).map((f) => [f.id, f]))
  const fotoUfficiali = new Map(elencaFoto(db, p.piatto_id).map((f) => [f.id, f]))
  const modifiche: Modifica[] = repo.modifiche(db, p.id).map((r) => {
    const m = modificaDi(r)
    const attuale =
      m.campo === 'ingrediente' ? (ufficiale.ingredienti.find((i) => i.id === m.chiave) ?? null) : m.campo === 'foto' ? (fotoUfficiali.get(m.chiave ?? '') ?? null) : ufficiale[m.campo]
    return {
      id: m.id,
      campo: m.campo,
      operazione: m.operazione,
      chiave: m.chiave,
      prima: m.prima,
      dopo: m.dopo,
      attuale,
      dipendeDa: m.dipendeDa,
      stato: r.stato,
      conflitto: r.stato === 'in_attesa' && inConflitto(m, ufficiale, foto),
      motivo: r.motivo,
      foto: m.campo === 'foto' ? (fotoProposte.get(m.chiave ?? '') ?? fotoUfficiali.get(m.chiave ?? '') ?? null) : null,
    }
  })
  return {
    id: p.id,
    piattoId: p.piatto_id,
    autore: { id: p.autore_id, nome: p.autore_nome },
    versioneBase: p.versione_base,
    motivazione: p.motivazione,
    stato: p.stato,
    modifiche,
    chiarimenti: (JSON.parse(p.chiarimenti) as { autoreId: string | null; autoreNome: string; testo: string; il: number }[]).map((c) => ({ autore: { id: c.autoreId, nome: c.autoreNome }, testo: c.testo, il: c.il })),
    decisoDa: p.deciso_da_nome ? { id: p.deciso_da_id, nome: p.deciso_da_nome } : null,
    decisoIl: p.deciso_il,
    puoDecidere: proprietario && p.stato === 'in_attesa',
    puoRitirare: p.autore_id === u.id && p.stato === 'in_attesa',
    versione: p.versione,
    creatoIl: p.creato_il,
  }
}

/** Proposte della ricetta: tutte per il proprietario, le proprie per gli altri. */
export function elencaProposte(db: Db, u: UtenteCorrente, piattoId: string): Proposte {
  return lettura(db, () => {
    richiediPiatto(db, u, piattoId, 'lettura')
    const proprietario = repoAccesso.proprietarioPiatto(db, piattoId) === u.id
    const ufficiale = contenutoAttuale(db, piattoId)
    const foto = elencaFoto(db, piattoId)
    return {
      proposte: repo.proposteDiPiatto(db, piattoId).filter((p) => proprietario || p.autore_id === u.id).map((p) => proposta(db, u, p, ufficiale, foto)),
      versionePiatto: repoRic.leggiPiatto(db, piattoId)!.versione,
    }
  })
}

export function leggiProposta(db: Db, u: UtenteCorrente, id: string): Proposta {
  return lettura(db, () => {
    const p = richiediProposta(db, u, id, 'lettura')
    return proposta(db, u, p, contenutoAttuale(db, p.piatto_id), elencaFoto(db, p.piatto_id))
  })
}

// ── Creazione ────────────────────────────────────────────────

/**
 * Nuova proposta: le differenze fra la ricetta ufficiale e il contenuto proposto, calcolate dal
 * server. Va preparata sulla versione attuale (altrimenti 409 con la ricetta di adesso).
 */
export function creaProposta(
  db: Db,
  u: UtenteCorrente,
  piattoId: string,
  d: { id: string; versioneBase: number; contenuto: Omit<AggiornaPiatto, 'versione'>; motivazione: string; rimuoviFoto: string[]; conFoto: boolean },
  adesso = Date.now(),
): Proposta {
  return transazione(db, () => {
    richiediProponente(db, u, piattoId)
    const esistente = repo.leggiProposta(db, d.id)
    if (esistente) {
      if (esistente.autore_id === u.id && esistente.piatto_id === piattoId) return leggiProposta(db, u, d.id)
      throw regolaViolata('id_esistente', 'Identificativo già usato')
    }
    const piatto = repoRic.leggiPiatto(db, piattoId)!
    if (piatto.versione !== d.versioneBase) throw conflittoVersione(piatto)
    const ufficiale = contenutoDi(piatto)
    const proposto = contenutoDi({ ...d.contenuto, ingredienti: d.contenuto.ingredienti } as ContenutoRicetta)
    const elenco = differenze(ufficiale, proposto, randomUUID)
    // Un ingrediente nuovo riceve un id del server: mai quello di un ingrediente di un'altra ricetta.
    for (const m of elenco) {
      if (m.campo === 'ingrediente' && m.operazione === 'aggiungi') {
        const id = randomUUID()
        m.chiave = id
        m.dopo = { ...(m.dopo as object), id }
      }
    }
    const ufficiali = new Set(elencaFoto(db, piattoId).map((f) => f.id))
    for (const f of new Set(d.rimuoviFoto)) {
      if (!ufficiali.has(f)) throw nonTrovato('Foto')
      const r = leggiFoto(db, f)
      elenco.push({ id: randomUUID(), campo: 'foto', operazione: 'rimuovi', chiave: f, prima: { id: f, didascalia: r.didascalia, passo: r.passo }, dopo: null, dipendeDa: null })
    }
    if (!elenco.length && !d.conFoto) throw regolaViolata('nessuna_modifica', 'Non c\'è nessuna modifica da proporre')
    repo.inserisciProposta(db, { id: d.id, piattoId, autoreId: u.id, autoreNome: u.nome, versioneBase: piatto.versione, motivazione: d.motivazione.trim() }, adesso)
    elenco.forEach((m, ordine) =>
      repo.inserisciModifica(db, { id: m.id, proposta_id: d.id, ordine, campo: m.campo, operazione: m.operazione, chiave: m.chiave, prima: json(m.prima), dopo: json(m.dopo), dipende_da: null }),
    )
    const proprietario = repoAccesso.proprietarioPiatto(db, piattoId)!
    avvisa(
      db,
      { tipo: 'modifica_ricetta', attoreId: u.id, destinatari: [proprietario], chiave: `proposte:${piattoId}`, piattoId, ancora: `proposta:${d.id}`, testo: `${u.nome} propone modifiche a «${piatto.nome}»` },
      adesso,
    )
    incrementaRevisione(db)
    return leggiProposta(db, u, d.id)
  })
}

/**
 * Foto da aggiungere con la proposta: archiviata come le altre (file, impronta, backup), ma fuori
 * dalla galleria finché non è approvata. Un passaggio nuovo la lega al procedimento proposto.
 */
export async function aggiungiFotoProposta(db: Db, cartella: CartellaFile, u: UtenteCorrente, id: string, f: { id: string; dati: Uint8Array; didascalia: string; passo: number | null }, adesso = Date.now()) {
  const { p, passaggi, procedimento, base } = lettura(db, () => {
    const p = richiediProposta(db, u, id, 'autore')
    if (p.stato !== 'in_attesa') throw regolaViolata('proposta_chiusa', 'La proposta è già stata decisa o ritirata')
    const proc = repo.modifiche(db, id).find((m) => m.campo === 'procedimento')
    const base = (contenutoAttuale(db, p.piatto_id).procedimento ?? []).length
    return { p, passaggi: proc ? (JSON.parse(proc.dopo!) as string[]).length : base, procedimento: proc?.id ?? null, base }
  })
  const foto = await caricaFoto(db, cartella, p.piatto_id, { id: f.id, dati: f.dati, didascalia: f.didascalia, principale: false, passo: f.passo, proposta: { id, passaggi } }, adesso)
  transazione(db, () => {
    if (repo.modifiche(db, id).some((m) => m.chiave === foto.id)) return // ripetizione
    // La foto di un passaggio che esiste solo nel procedimento proposto dipende da quella modifica.
    const dipende = f.passo !== null && f.passo >= base ? procedimento : null
    repo.inserisciModifica(db, {
      id: randomUUID(),
      proposta_id: id,
      ordine: repo.prossimoOrdine(db, id),
      campo: 'foto',
      operazione: 'aggiungi',
      chiave: foto.id,
      prima: null,
      dopo: json({ id: foto.id, didascalia: foto.didascalia, passo: foto.passo }),
      dipende_da: dipende,
    })
    incrementaRevisione(db)
  })
  return foto
}

// ── Decisione ────────────────────────────────────────────────

/**
 * Il proprietario approva o rifiuta le singole modifiche, tutte insieme e in modo atomico. Ogni
 * modifica in conflitto si approva solo con una conferma esplicita; le dipendenze devono essere
 * rispettate. La versione della ricetta deve essere quella vista (decisioni concorrenti → 409).
 */
export async function decidi(db: Db, cartella: CartellaFile, u: UtenteCorrente, id: string, d: Decisioni, adesso = Date.now()): Promise<Proposta> {
  const daEliminare: string[] = []
  const risultato = transazione(db, () => {
    const p = richiediProposta(db, u, id, 'decisione')
    if (p.stato !== 'in_attesa') throw regolaViolata('proposta_chiusa', 'La proposta è già stata decisa o ritirata')
    if (p.versione !== d.versione) throw conflittoVersione(leggiProposta(db, u, id))
    const piatto = repoRic.leggiPiatto(db, p.piatto_id)!
    if (piatto.versione !== d.versionePiatto) throw conflittoVersione(leggiProposta(db, u, id))
    const righe = repo.modifiche(db, id)
    const perId = new Map(righe.map((r) => [r.id, r]))
    const ufficiale = contenutoDi(piatto)
    const fotoUfficiali = elencaFoto(db, p.piatto_id)
    const approvate = new Set(righe.filter((r) => r.stato === 'approvata').map((r) => r.id))
    for (const x of d.decisioni) {
      const r = perId.get(x.modificaId)
      if (!r) throw nonTrovato('Modifica')
      if (r.stato !== 'in_attesa') throw regolaViolata('gia_decisa', 'Una delle modifiche è già stata decisa')
      if (x.esito !== 'approvata') continue
      if (inConflitto(modificaDi(r), ufficiale, fotoUfficiali) && !x.confermaConflitto) {
        throw regolaViolata('conflitto', 'Una modifica tocca qualcosa cambiato nel frattempo: conferma esplicitamente se vuoi applicarla')
      }
      approvate.add(r.id)
    }
    const tutte = righe.map(modificaDi)
    const mancanti = dipendenzeMancanti(tutte, approvate)
    if (mancanti.length) throw regolaViolata('dipendenza', 'Una foto riguarda un passaggio del nuovo procedimento: approva anche il procedimento, o rifiuta la foto')
    const ora = tutte.filter((m) => approvate.has(m.id) && perId.get(m.id)!.stato === 'in_attesa')
    const proponente = { id: p.autore_id, nome: p.autore_nome }
    const proprietario = persona(db, u.id)
    const meta = { tipo: 'proposta' as const, autore: proponente, approvatoDa: proprietario, propostaId: id }

    // Contenuto: un solo aggiornamento con tutte le modifiche approvate (cronologia compresa).
    const contenuto = ora.filter((m) => m.campo !== 'foto')
    if (contenuto.length) {
      const nuovo = applica(ufficiale, contenuto)
      aggiornaPiatto(db, p.piatto_id, { ...nuovo, versione: piatto.versione }, u.id, adesso, meta)
    }
    // Foto: le approvate entrano nella galleria (o ne escono), le rifiutate spariscono.
    const passaggi = contenutoAttuale(db, p.piatto_id).procedimento.length
    const campiFoto: { campo: string; prima: unknown; dopo: unknown }[] = []
    for (const m of ora.filter((x) => x.campo === 'foto')) {
      if (m.operazione === 'aggiungi') {
        const f = leggiFoto(db, m.chiave!)
        if (f.passo !== null && f.passo >= passaggi) esegui(db, 'UPDATE foto_piatti SET passo = NULL WHERE id = ?', f.id)
        rendiUfficiale(db, f.id, p.piatto_id, adesso)
        campiFoto.push({ campo: 'foto', prima: null, dopo: m.dopo })
      } else if (fotoUfficiali.some((f) => f.id === m.chiave)) {
        daEliminare.push(nomeFile(leggiFoto(db, m.chiave!)))
        esegui(db, 'DELETE FROM foto_piatti WHERE id = ?', m.chiave)
        campiFoto.push({ campo: 'foto', prima: m.prima, dopo: null })
      }
    }
    if (campiFoto.length) registraEvento(db, p.piatto_id, { ...meta, tipo: 'foto' }, campiFoto, adesso)

    let approvateOra = 0
    let rifiutateOra = 0
    for (const x of d.decisioni) {
      const r = perId.get(x.modificaId)!
      if (x.esito === 'approvata') approvateOra++
      else {
        rifiutateOra++
        if (r.campo === 'foto' && r.operazione === 'aggiungi') {
          const f = fotoProposta(db, id).find((y) => y.id === r.chiave)
          if (f) {
            daEliminare.push(nomeFile(f))
            esegui(db, 'DELETE FROM foto_piatti WHERE id = ?', f.id)
          }
        }
      }
      repo.decidiModifica(db, r.id, x.esito, x.esito === 'rifiutata' ? x.motivo : '')
    }
    const restano = repo.modifiche(db, id).filter((r) => r.stato === 'in_attesa').length
    repo.aggiornaStatoProposta(db, id, restano ? 'in_attesa' : 'conclusa', proprietario, adesso)

    // Una sola notifica riepilogativa all'autore.
    const tot = approvateOra + rifiutateOra
    const esito = !rifiutateOra ? `approvata${restano ? ' in parte' : ''}` : !approvateOra ? 'rifiutata' : `approvata in parte (${approvateOra} su ${tot})`
    if (p.autore_id) {
      avvisa(
        db,
        { tipo: 'modifica_ricetta', attoreId: u.id, destinatari: [p.autore_id], chiave: `esito:${id}`, piattoId: p.piatto_id, ancora: `proposta:${id}`, testo: `La tua proposta per «${piatto.nome}»: ${esito}` },
        adesso,
      )
    }
    incrementaRevisione(db)
    return leggiProposta(db, u, id)
  })
  for (const f of daEliminare) await cartella.elimina(f)
  return risultato
}

/** L'autore ritira una proposta in attesa: la traccia resta, le foto proposte spariscono. */
export async function ritira(db: Db, cartella: CartellaFile, u: UtenteCorrente, id: string, versione: number, adesso = Date.now()): Promise<Proposta> {
  const daEliminare: string[] = []
  const r = transazione(db, () => {
    const p = richiediProposta(db, u, id, 'autore')
    if (p.stato !== 'in_attesa') throw regolaViolata('proposta_chiusa', 'La proposta è già stata decisa o ritirata')
    if (p.versione !== versione) throw conflittoVersione(leggiProposta(db, u, id))
    for (const m of repo.modifiche(db, id).filter((x) => x.stato === 'in_attesa')) repo.decidiModifica(db, m.id, 'ritirata', '')
    for (const f of fotoProposta(db, id)) {
      daEliminare.push(nomeFile(f))
      esegui(db, 'DELETE FROM foto_piatti WHERE id = ?', f.id)
    }
    repo.aggiornaStatoProposta(db, id, 'ritirata', null, adesso)
    incrementaRevisione(db)
    return leggiProposta(db, u, id)
  })
  for (const f of daEliminare) await cartella.elimina(f)
  return r
}

/** Richiesta di chiarimento (o risposta) fra proprietario e autore: notifica all'altro. */
export function chiarimento(db: Db, u: UtenteCorrente, id: string, testo: string, adesso = Date.now()): Proposta {
  return transazione(db, () => {
    const p = richiediProposta(db, u, id, 'lettura')
    if (p.stato !== 'in_attesa') throw regolaViolata('proposta_chiusa', 'La proposta è già stata decisa o ritirata')
    const elenco = JSON.parse(p.chiarimenti) as unknown[]
    if (elenco.length >= 50) throw regolaViolata('troppi_messaggi', 'Troppi messaggi su questa proposta')
    elenco.push({ autoreId: u.id, autoreNome: u.nome, testo: testo.trim(), il: adesso })
    repo.scriviChiarimenti(db, id, JSON.stringify(elenco), adesso)
    const proprietario = repoAccesso.proprietarioPiatto(db, p.piatto_id)!
    const altro = u.id === proprietario ? p.autore_id : proprietario
    if (altro) {
      avvisa(
        db,
        { tipo: 'modifica_ricetta', attoreId: u.id, destinatari: [altro], chiave: `chiarimento:${id}`, piattoId: p.piatto_id, ancora: `proposta:${id}`, testo: `${u.nome} sulla proposta per «${nomePiatto(db, p.piatto_id)}»: ${testo.trim()}` },
        adesso,
      )
    }
    incrementaRevisione(db)
    return leggiProposta(db, u, id)
  })
}

// ── Cronologia e ripristino ─────────────────────────────────

/** Vede la cronologia chi fa parte della ricetta: il proprietario e chi la ha condivisa con sé. */
const vedeCronologia = (db: Db, u: UtenteCorrente, piattoId: string) => repoAccesso.proprietarioPiatto(db, piattoId) === u.id || repoAccesso.piattoCondivisoCon(db, piattoId, u.id)

export function cronologia(db: Db, u: UtenteCorrente, piattoId: string): Cronologia {
  return lettura(db, () => {
    richiediPiatto(db, u, piattoId, 'lettura')
    if (!vedeCronologia(db, u, piattoId)) throw accessoNegato('La cronologia la vede chi fa parte della ricetta')
    const proprietario = repoAccesso.proprietarioPiatto(db, piattoId) === u.id
    const revisioni: Revisione[] = repoRev.revisioni(db, piattoId).map((r) => ({
      id: r.id,
      numero: r.numero,
      tipo: r.tipo,
      autore: { id: r.autore_id, nome: r.autore_nome },
      approvatoDa: r.approvato_da_nome ? { id: r.approvato_da_id, nome: r.approvato_da_nome } : null,
      propostaId: r.proposta_id,
      ripristinaNumero: r.ripristina_numero,
      campi: JSON.parse(r.campi) as Revisione['campi'],
      ripristinabile: proprietario && r.contenuto !== null,
      motivazione: r.motivazione,
      creatoIl: r.creato_il,
    }))
    return { revisioni, versionePiatto: repoRic.leggiPiatto(db, piattoId)!.versione }
  })
}

/**
 * Torna al contenuto di una revisione (solo il proprietario, con la versione vista): una revisione
 * nuova, nessuna cancellata. Foto, memoria, proposte ed eventi non si toccano.
 */
export function ripristina(db: Db, u: UtenteCorrente, piattoId: string, revisioneId: string, versione: number, adesso = Date.now()) {
  return transazione(db, () => {
    richiediPiatto(db, u, piattoId, 'proprietario')
    const r = repoRev.leggiRevisione(db, revisioneId)
    if (!r || r.piatto_id !== piattoId || !r.contenuto) throw nonTrovato('Versione')
    const c = JSON.parse(r.contenuto) as ContenutoRicetta
    // Ingredienti con id nuovi: quelli di allora possono essere stati riusati altrove.
    const ingredienti = c.ingredienti.map((i, ordine) => ({ ...i, id: randomUUID(), ordine }))
    return aggiornaPiatto(db, piattoId, { ...c, ingredienti, versione }, u.id, adesso, { tipo: 'ripristino', autore: persona(db, u.id), ripristinaNumero: r.numero })
  })
}

// ── Proprietà ────────────────────────────────────────────────

function trasferimento(db: Db, t: repo.RigaTrasferimento): Trasferimento {
  const nome = (id: string | null) => (id ? (repoAccesso.leggiUtente(db, id)?.nome ?? '') : '')
  return {
    id: t.id,
    piattoId: t.piatto_id,
    tipo: t.tipo,
    da: { id: t.da_id, nome: nome(t.da_id) },
    a: { id: t.a_id, nome: nome(t.a_id) },
    motivazione: t.motivazione,
    stato: t.stato,
    creatoDa: { id: t.creato_da_id, nome: t.creato_da_nome },
    creatoIl: t.creato_il,
    versione: t.versione,
  }
}

/** Membri attivi di una Famiglia, tranne `escluso`. */
const membriIdonei = (db: Db, gruppoId: string, escluso: string) =>
  repoAccesso
    .membriGruppo(db, gruppoId)
    .map((m) => repoAccesso.leggiUtente(db, m.utente_id))
    .filter((x): x is NonNullable<typeof x> => x !== undefined && x.stato === 'attivo' && x.id !== escluso)
    .map((x) => ({ id: x.id, nome: x.nome }))

/** La Famiglia con cui la ricetta è condivisa e di cui fanno parte sia `a` che `b` (se c'è). */
const famigliaComune = (db: Db, piattoId: string, a: string, b: string) =>
  repo.famiglieCondivise(db, piattoId).find((g) => repoAccesso.ruoloNelGruppo(db, g, a) && repoAccesso.ruoloNelGruppo(db, g, b)) ?? null

/** Cosa mostra la scheda della ricetta per collaborare. */
export function collaborazione(db: Db, u: UtenteCorrente, piattoId: string): Collaborazione {
  const proprietario = repoAccesso.proprietarioPiatto(db, piattoId)!
  const mio = proprietario === u.id
  const t = repo.trasferimentoInAttesa(db, piattoId)
  const condivise = repo.famiglieCondivise(db, piattoId)
  const famigliaMia = condivise.find((g) => repoAccesso.ruoloNelGruppo(db, g, u.id))
  return {
    puoProporre: !mio && repoAccesso.piattoCondivisoCon(db, piattoId, u.id),
    proposteInAttesa: repo.contaInAttesa(db, piattoId, mio ? undefined : u.id),
    vedeCronologia: vedeCronologia(db, u, piattoId),
    trasferimento: t && (t.a_id === u.id || mio || t.creato_da_id === u.id) ? trasferimento(db, t) : null,
    destinatari: mio && famigliaMia ? membriIdonei(db, famigliaMia, u.id) : [],
    puoRiassegnare: !mio && condivise.some((g) => repoAccesso.ruoloNelGruppo(db, g, u.id) === 'amministratore'),
  }
}

/** Membri a cui l'amministratore può riassegnare la ricetta (della Famiglia che amministra). */
export function destinatariRiassegnazione(db: Db, u: UtenteCorrente, piattoId: string) {
  return lettura(db, () => {
    const g = famigliaAmministrata(db, u, piattoId)
    return membriIdonei(db, g, repoAccesso.proprietarioPiatto(db, piattoId)!)
  })
}

function famigliaAmministrata(db: Db, u: UtenteCorrente, piattoId: string): string {
  const g = repo.famiglieCondivise(db, piattoId).find((x) => repoAccesso.ruoloNelGruppo(db, x, u.id) === 'amministratore')
  // Una ricetta privata (o di un'altra Famiglia) per l'amministratore «non esiste».
  if (!g) throw nonTrovato('Piatto')
  return g
}

/** Il proprietario chiede di trasferire la ricetta a un membro della Famiglia con cui è condivisa. */
export function proponiTrasferimento(db: Db, u: UtenteCorrente, piattoId: string, d: { id: string; a: string; versionePiatto: number }, adesso = Date.now()): Trasferimento {
  return transazione(db, () => {
    richiediPiatto(db, u, piattoId, 'proprietario')
    const piatto = repoRic.leggiPiatto(db, piattoId)!
    if (piatto.versione !== d.versionePiatto) throw conflittoVersione(piatto)
    if (d.a === u.id) throw regolaViolata('gia_proprietario', 'La ricetta è già tua')
    const gruppo = famigliaComune(db, piattoId, u.id, d.a)
    const destinatario = repoAccesso.leggiUtente(db, d.a)
    if (!gruppo || !destinatario || destinatario.stato !== 'attivo') throw regolaViolata('destinatario', 'Si trasferisce a un membro della Famiglia con cui la ricetta è condivisa')
    if (repo.trasferimentoInAttesa(db, piattoId)) throw regolaViolata('trasferimento_in_corso', 'C\'è già un trasferimento in attesa per questa ricetta')
    repo.inserisciTrasferimento(db, { id: d.id, piatto_id: piattoId, da_id: u.id, a_id: d.a, gruppo_id: gruppo, tipo: 'volontario', motivazione: '', creato_da_id: u.id, creato_da_nome: u.nome, creato_il: adesso })
    avvisa(db, { tipo: 'proprieta_ricetta', attoreId: u.id, destinatari: [d.a], chiave: `trasferimento:${d.id}`, piattoId, testo: `${u.nome} ti propone di diventare proprietario di «${piatto.nome}»` }, adesso)
    incrementaRevisione(db)
    return trasferimento(db, repo.leggiTrasferimento(db, d.id)!)
  })
}

/**
 * Riassegnazione dall'amministratore della Famiglia con cui la ricetta è condivisa (proprietario
 * non più disponibile): motivazione obbligatoria, destinatario della stessa Famiglia, che accetta.
 * Se il destinatario è l'amministratore stesso vale come già accettata.
 */
export async function riassegna(db: Db, cartella: CartellaFile, u: UtenteCorrente, piattoId: string, d: { id: string; a: string; motivazione: string }, adesso = Date.now()): Promise<Trasferimento> {
  const t = transazione(db, () => {
    const gruppo = famigliaAmministrata(db, u, piattoId)
    const proprietario = repoAccesso.proprietarioPiatto(db, piattoId)!
    if (proprietario === u.id) throw regolaViolata('gia_proprietario', 'La ricetta è già tua: trasferiscila tu')
    const destinatario = repoAccesso.leggiUtente(db, d.a)
    if (!destinatario || destinatario.stato !== 'attivo' || !repoAccesso.ruoloNelGruppo(db, gruppo, d.a) || d.a === proprietario) {
      throw regolaViolata('destinatario', 'Si riassegna a un membro della Famiglia diverso dal proprietario')
    }
    if (repo.trasferimentoInAttesa(db, piattoId)) throw regolaViolata('trasferimento_in_corso', 'C\'è già un trasferimento in attesa per questa ricetta')
    repo.inserisciTrasferimento(db, { id: d.id, piatto_id: piattoId, da_id: proprietario, a_id: d.a, gruppo_id: gruppo, tipo: 'amministrativo', motivazione: d.motivazione.trim(), creato_da_id: u.id, creato_da_nome: u.nome, creato_il: adesso })
    const nome = nomePiatto(db, piattoId)
    avvisa(db, { tipo: 'proprieta_ricetta', attoreId: u.id, destinatari: [proprietario], chiave: `trasferimento:${d.id}`, piattoId, testo: `${u.nome} propone di riassegnare «${nome}»: ${d.motivazione.trim()}` }, adesso)
    if (d.a !== u.id) {
      avvisa(db, { tipo: 'proprieta_ricetta', attoreId: u.id, destinatari: [d.a], chiave: `trasferimento:${d.id}:a`, piattoId, testo: `${u.nome} ti propone di diventare proprietario di «${nome}»` }, adesso)
    }
    incrementaRevisione(db)
    return repo.leggiTrasferimento(db, d.id)!
  })
  if (t.a_id !== u.id) return trasferimento(db, t)
  return decidiTrasferimento(db, cartella, u, t.id, { esito: 'accetta', versione: t.versione }, adesso)
}

/**
 * Il destinatario accetta o rifiuta; chi l'ha chiesto può annullare. All'accettazione si ricontrolla
 * tutto (proprietario, condivisione, appartenenza): se qualcosa è cambiato, il trasferimento decade.
 */
export async function decidiTrasferimento(
  db: Db,
  cartella: CartellaFile,
  u: UtenteCorrente,
  id: string,
  d: { esito: 'accetta' | 'rifiuta' | 'annulla'; versione: number },
  adesso = Date.now(),
): Promise<Trasferimento> {
  return transazione(db, () => {
    const t = repo.leggiTrasferimento(db, id)
    if (!t) throw nonTrovato('Trasferimento')
    const coinvolto = t.a_id === u.id || t.creato_da_id === u.id || t.da_id === u.id
    if (!coinvolto) throw nonTrovato('Trasferimento')
    if (t.stato !== 'in_attesa') throw regolaViolata('trasferimento_chiuso', 'Il trasferimento non è più in attesa')
    if (t.versione !== d.versione) throw conflittoVersione(trasferimento(db, t))
    const nome = nomePiatto(db, t.piatto_id)
    if (d.esito === 'annulla') {
      if (t.creato_da_id !== u.id && t.da_id !== u.id) throw accessoNegato('Annulla chi l\'ha chiesto')
      repo.chiudiTrasferimento(db, id, 'annullato', t.versione, adesso)
    } else {
      if (t.a_id !== u.id) throw accessoNegato('Decide il destinatario')
      if (d.esito === 'rifiuta') {
        repo.chiudiTrasferimento(db, id, 'rifiutato', t.versione, adesso)
        avvisa(db, { tipo: 'proprieta_ricetta', attoreId: u.id, destinatari: [t.creato_da_id ?? ''], chiave: `trasferimento:${id}:esito`, piattoId: t.piatto_id, testo: `${u.nome} non ha accettato «${nome}»` }, adesso)
      } else {
        const proprietario = repoAccesso.proprietarioPiatto(db, t.piatto_id)
        const valido =
          proprietario === t.da_id &&
          t.gruppo_id !== null &&
          repo.famiglieCondivise(db, t.piatto_id).includes(t.gruppo_id) &&
          repoAccesso.ruoloNelGruppo(db, t.gruppo_id, u.id) !== undefined &&
          (t.tipo === 'amministrativo'
            ? repoAccesso.ruoloNelGruppo(db, t.gruppo_id, t.creato_da_id ?? '') === 'amministratore'
            : repoAccesso.ruoloNelGruppo(db, t.gruppo_id, t.da_id ?? '') !== undefined)
        if (!valido) {
          repo.chiudiTrasferimento(db, id, 'annullato', t.versione, adesso)
          incrementaRevisione(db)
          throw regolaViolata('trasferimento_decaduto', 'Nel frattempo sono cambiati proprietario, condivisione o Famiglia: il trasferimento è decaduto')
        }
        repo.chiudiTrasferimento(db, id, 'accettato', t.versione, adesso)
        repo.cambiaProprietarioPiatto(db, t.piatto_id, u.id, adesso)
        // Gli eventi degli altri non dipendono da ricette altrui (§19.4): passano a una loro copia.
        scollegaEventiAltrui(db, cartella, t.piatto_id, u.id, adesso)
        const precedente = { id: t.da_id, nome: t.da_id ? persona(db, t.da_id).nome : '' }
        registraEvento(
          db,
          t.piatto_id,
          {
            tipo: t.tipo === 'volontario' ? 'trasferimento' : 'riassegnazione',
            autore: { id: t.creato_da_id, nome: t.creato_da_nome },
            approvatoDa: persona(db, u.id),
            motivazione: t.motivazione,
          },
          [{ campo: 'proprietario', prima: precedente.nome, dopo: u.nome }],
          adesso,
        )
        const destinatari = [t.da_id, t.creato_da_id].filter((x): x is string => x !== null && repoAccesso.leggiUtente(db, x)?.stato === 'attivo')
        avvisa(db, { tipo: 'proprieta_ricetta', attoreId: u.id, destinatari, chiave: `trasferimento:${id}:esito`, piattoId: t.piatto_id, testo: `«${nome}» ora è di ${u.nome}` }, adesso)
      }
    }
    incrementaRevisione(db)
    return trasferimento(db, repo.leggiTrasferimento(db, id)!)
  })
}

/**
 * Dopo un cambio di proprietario: le voci di eventi di altri utenti collegate alla ricetta passano
 * alla copia del proprietario dell'evento (riusata se c'è), come per ogni ricetta altrui (§19.4).
 */
function scollegaEventiAltrui(db: Db, cartella: CartellaFile, piattoId: string, nuovoProprietario: string, adesso: number): void {
  const voci = tutti<{ id: string; evento_id: string; proprietario_id: string }>(
    db,
    'SELECT v.id, v.evento_id, e.proprietario_id FROM voci_menu v JOIN eventi e ON e.id = v.evento_id WHERE v.piatto_id = ? AND e.proprietario_id <> ?',
    piattoId,
    nuovoProprietario,
  )
  for (const v of voci) {
    const proprietarioEvento = { id: v.proprietario_id, nome: persona(db, v.proprietario_id).nome, ruolo: 'utente' as const, sessioneId: '', ingresso: 'privato' as const }
    const copia = piattoPerEvento(db, cartella, proprietarioEvento, v.evento_id, piattoId, adesso)
    esegui(db, 'UPDATE voci_menu SET piatto_id = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ?', copia, adesso, v.id)
  }
}
