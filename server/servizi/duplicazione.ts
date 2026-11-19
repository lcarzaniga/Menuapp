// Duplicazione degli eventi e ricorrenze degli eventi (SPEC §25, §28). Si sceglie cosa copiare:
// menù (portate e piatti), partecipanti da riconfermare, chi porta cosa da riassegnare, piano da
// rifare, stampa; con un'anteprima che non scrive nulla. Mai conferme, incarichi accettati, voti,
// bacheca, notifiche, spesa o archiviazione. Un evento archiviato si duplica dal suo archivio.
import { randomUUID } from 'node:crypto'
import type { AnteprimaDuplica, Duplica, Edizione, Edizioni, EsitoDuplica } from '../../src/contratto/edizioni.ts'
import type { Precedente } from '../../src/contratto/famiglia.ts'
import type { SceltaRicorrenza } from '../../src/contratto/eventi.ts'
import type { Invito } from '../../src/contratto/partecipanti.ts'
import { NESSUN_ANONIMO } from '../../src/domain/partecipanti.ts'
import { RICORRENZE_STANDARD, ricorrenzaStandard, standardPerOccasione } from '../../src/domain/ricorrenze.ts'
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
import type { CartellaFile } from './cartella.ts'
import { creaAttivita, elencaAttivita } from './attivita.ts'
import { esitoRicetta, piattoPerEvento } from './condivisione.ts'
import { ErroreApi, nonTrovato, regolaViolata } from './errori.ts'
import { creaEvento, creaVoci, leggiEvento, leggiMenu, richiediModificabile } from './eventi.ts'
import { perArchivio } from './partecipanti.ts'
import { risolviScelta } from './ricorrenze.ts'
import { permessoEvento, richiediEvento, type UtenteCorrente } from './permessi.ts'

const puoModificare = (p: string | null) => p === 'proprietario' || p === 'modifica'

/** Cosa copiare: ciò che il client non dice vale come prima della 7.6 (SPEC §25). */
function scelte(d: Duplica) {
  const c = d.copia ?? {}
  return { menu: c.menu ?? true, partecipanti: c.partecipanti ?? d.copiaPartecipanti, incarichi: c.incarichi ?? false, piano: c.piano ?? true, stampa: c.stampa ?? true }
}

const avvisoNonDisponibile = (nome: string) => `«${nome}»: la ricetta non è disponibile per te, la voce resta senza ricetta`
const avvisoDallArchivio = (nome: string) => `«${nome}»: la ricetta non c'è più, ricreata dall'archivio come tua ricetta privata`
const avvisoSparita = (nome: string) => `«${nome}»: la ricetta non c'è più, la voce resta senza ricetta`

/** Chi se ne occupava nell'originale (D7): gli id si verificano quando si leggono gli incarichi. */
const precedenteDi = (nome: string, utenteId: string | null, esternoId: string | null): Precedente | null => (nome ? { nome, utenteId, esternoId } : null)

/** Lettura dell'originale e scelte comuni ad anteprima e duplicazione (nessuna scrittura). */
function prepara(db: Db, u: UtenteCorrente, origineId: string, d: Duplica) {
  richiediEvento(db, u, origineId, 'lettura')
  const vivo = leggiEvento(db, origineId)
  const snap = vivo.stato === 'archiviato' ? snapshotValido(db, origineId) : undefined
  const origine = snap ? eventoDaSnapshot(snap.contenuto.evento) : vivo
  const c = scelte(d)
  // Famiglia: quella scelta (se ne fai parte), altrimenti quella dell'originale se ne fai parte.
  const famigliaOrigine = repoAccesso.gruppoEvento(db, origineId)
  const gruppoId = d.gruppoId !== undefined ? d.gruppoId : famigliaOrigine && repoAccesso.ruoloNelGruppo(db, famigliaOrigine, u.id) ? famigliaOrigine : null
  if (gruppoId && !repoAccesso.ruoloNelGruppo(db, gruppoId, u.id)) throw nonTrovato('Famiglia')
  const portate = snap ? snap.contenuto.menu : leggiMenu(db, origineId).portate
  const giorni = differenzaGiorni(origine.data, d.data)
  const attivita = c.piano ? (snap ? snap.contenuto.attivita : elencaAttivita(db, origineId)) : []
  // Chi porta cosa: solo da un evento vivo (l'archivio non conserva gli incarichi).
  const incarichi = c.incarichi && !snap
  const vociIncarico = new Map(incarichi ? repoFam.vociIncarichi(db, origineId).map((v) => [v.id, v]) : [])
  return {
    vivo,
    snap,
    origine,
    c,
    gruppoId,
    famigliaOrigine,
    portate,
    stile: c.stampa ? (snap ? (snap.contenuto.stampa ?? null) : JSON.parse(repoStampa.leggiStile(db, origineId)?.opzioni ?? 'null')) : null,
    attivita: attivita.map((a) => ({ ...a, data: aggiungiGiorni(a.data, giorni) })),
    inviti: c.partecipanti ? (snap ? (snap.contenuto.partecipanti ?? []) : perArchivio(db, origineId)) : ([] as Invito[]),
    vociIncarico,
    cose: incarichi ? repoFam.coseEvento(db, origineId) : [],
  }
}

/**
 * Anteprima di «Duplica evento» (SPEC §25, D8): cosa verrà creato con le scelte fatte, senza
 * scrivere nulla. Le ricette seguono le stesse regole della duplicazione (`esitoRicetta`).
 */
export function anteprimaDuplica(db: Db, u: UtenteCorrente, origineId: string, d: Duplica): AnteprimaDuplica {
  return lettura(db, () => {
    const p = prepara(db, u, origineId, d)
    const avvisi: string[] = []
    const esiti = new Map<string, AnteprimaDuplica['portate'][number]['voci'][number]['ricetta']>()
    const ricetta = (piattoId: string | null, nome: string) => {
      if (!piattoId) return 'nessuna' as const
      if (!esiti.has(piattoId)) {
        if (repoRic.leggiPiatto(db, piattoId)) {
          try {
            const e = esitoRicetta(db, u, u.id, p.gruppoId, piattoId)
            esiti.set(piattoId, e.tipo === 'stessa' ? 'collegata' : e.tipo === 'riusa' ? 'copia_esistente' : 'copia')
          } catch (e) {
            if (!(e instanceof ErroreApi)) throw e
            avvisi.push(avvisoNonDisponibile(nome))
            esiti.set(piattoId, 'non_disponibile')
          }
        } else if (p.snap?.contenuto.piatti.some((x) => x.id === piattoId)) {
          avvisi.push(avvisoDallArchivio(nome))
          esiti.set(piattoId, 'dall_archivio')
        } else {
          avvisi.push(avvisoSparita(nome))
          esiti.set(piattoId, 'non_disponibile')
        }
      }
      return esiti.get(piattoId)!
    }
    const voci = p.c.menu ? p.portate.flatMap((x) => x.voci) : []
    return {
      portate: p.portate.map((x) => ({ nome: x.nome, voci: p.c.menu ? x.voci.map((v) => ({ nome: v.nome, ricetta: ricetta(v.piattoId, v.nome) })) : [] })),
      attivita: p.attivita.map((a) => ({ titolo: a.titolo, data: a.data, ora: a.ora })),
      partecipanti: p.inviti.reduce((n, i) => n + 1 + i.accompagnatori.length, 0),
      incarichi: [
        ...voci.flatMap((v) => {
          const r = p.vociIncarico.get(v.id)
          return r?.incaricato ? [{ nome: v.nome, precedente: r.incaricato }] : []
        }),
        ...p.cose.map((c) => ({ nome: c.nome, precedente: c.incaricato || null })),
      ],
      stampa: p.stile !== null,
      incarichiDisponibili: !p.snap,
      avvisi,
    }
  })
}

export function duplica(db: Db, cartellaFoto: CartellaFile, u: UtenteCorrente, origineId: string, d: Duplica, adesso = Date.now()): EsitoDuplica {
  return transazione(db, () => {
    richiediEvento(db, u, origineId, 'lettura')
    // Ripetizione della stessa richiesta: l'evento c'è già ed è di chi lo ha chiesto.
    if (uno(db, 'SELECT 1 FROM eventi WHERE id = ?', d.id)) {
      if (repoAccesso.proprietarioEvento(db, d.id) === u.id) return { evento: leggiEvento(db, d.id), avvisi: [] }
      throw regolaViolata('id_esistente', 'Identificativo già usato')
    }
    const { vivo, snap, origine, c, gruppoId, famigliaOrigine, portate, stile, attivita, inviti, vociIncarico, cose } = prepara(db, u, origineId, d)
    const avvisi: string[] = []

    // Ricorrenza: quella scelta (della Famiglia del nuovo evento, o standard), altrimenti quella
    // dell'originale: una standard vale in ogni Famiglia, una della Famiglia solo se la Famiglia
    // resta la stessa e la ricorrenza esiste ancora. Mai una nuova definizione (SPEC §28, §30).
    const scelta = d.ricorrenza !== undefined ? d.ricorrenza : d.ricorrenzaId !== undefined ? (d.ricorrenzaId ? { tipo: 'famiglia' as const, id: d.ricorrenzaId } : null) : undefined
    let ricorrenza: repo.AssociazioneRicorrenza
    if (scelta !== undefined) ricorrenza = { ...risolviScelta(db, scelta, gruppoId), manuale: true }
    else {
      const manuale = repo.ricorrenzaManuale(db, origineId)
      const stessa = gruppoId && gruppoId === famigliaOrigine && vivo.ricorrenzaId && repoRicorrenze.leggiRicorrenza(db, vivo.ricorrenzaId)?.gruppo_id === gruppoId
      ricorrenza = stessa
        ? { ricorrenzaId: vivo.ricorrenzaId, standard: null, manuale }
        : gruppoId && vivo.ricorrenzaStandard
          ? { ricorrenzaId: null, standard: vivo.ricorrenzaStandard, manuale }
          : { ricorrenzaId: null, standard: null, manuale: false }
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
          avvisi.push(avvisoNonDisponibile(nome))
        }
      } else if (snap?.contenuto.piatti.some((p) => p.id === piattoId)) {
        id = copiaPiattoDaSnapshot(db, snap.id, piattoId, randomUUID(), u.id, gruppoId).id
        avvisi.push(avvisoDallArchivio(nome))
      } else {
        avvisi.push(avvisoSparita(nome))
      }
      ricette.set(piattoId, id)
      return id
    }
    const idVoci = new Map<string, string>()
    for (const p of c.menu ? portate : []) {
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

    // Chi porta cosa (D7): da assegnare, ricordando chi se ne occupava; nessun incarico accettato.
    for (const [origine, nuova] of idVoci) {
      const r = vociIncarico.get(origine)
      const prec = r ? precedenteDi(r.incaricato, r.incaricato_id, r.incaricato_esterno_id) : null
      if (prec) repoFam.impostaPrecedenteVoce(db, nuova, JSON.stringify(prec))
    }
    for (const x of cose) {
      const prec = precedenteDi(x.incaricato, x.incaricato_id, x.incaricato_esterno_id)
      repoFam.inserisciCosa(
        db,
        { id: randomUUID(), eventoId: d.id, nome: x.nome, quantita: x.quantita, quantitaNumero: x.quantita_numero, unita: x.unita, note: x.note, creatoDa: u.id, precedente: prec ? JSON.stringify(prec) : null },
        adesso,
      )
    }

    if (stile) repoStampa.inserisciStile(db, d.id, JSON.stringify(stile), adesso)

    // Piano: le stesse attività spostate sulla nuova data, tutte da fare.
    for (const a of attivita) {
      creaAttivita(db, d.id, { id: randomUUID(), titolo: a.titolo, data: a.data, ora: a.ora, voceMenuId: a.voceMenuId ? (idVoci.get(a.voceMenuId) ?? null) : null, note: a.note }, adesso)
    }

    // Partecipanti: stessa composizione, tutto da riconfermare.
    if (inviti.length) copiaPartecipanti(db, d.id, gruppoId, inviti, avvisi, adesso)

    // Sempre: creando l'evento si sarebbe applicata l'associazione automatica dall'occasione.
    repo.impostaRicorrenza(db, d.id, ricorrenza)
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

/** Ricorrenza dell'evento, le altre sue edizioni e gli altri eventi della Famiglia, solo quelli visibili. */
export function edizioni(db: Db, u: UtenteCorrente, eventoId: string): Edizioni {
  return lettura(db, () => {
    const permesso = richiediEvento(db, u, eventoId, 'lettura')
    const e = leggiEvento(db, eventoId)
    const famiglia = repoAccesso.gruppoEvento(db, eventoId)
    const membro = Boolean(famiglia && repoAccesso.ruoloNelGruppo(db, famiglia, u.id))
    const visibile = (id: string) => id !== eventoId && permessoEvento(db, u, id) !== null
    const ricorrenza = e.ricorrenzaId ? repoRicorrenze.leggiRicorrenza(db, e.ricorrenzaId) : undefined
    // Una ricorrenza standard raccoglie le edizioni dentro la Famiglia dell'evento.
    const standard = famiglia ? ricorrenzaStandard(e.ricorrenzaStandard) : undefined
    const stesse = (ricorrenza ? repo.eventiDellaRicorrenza(db, ricorrenza.id) : standard && famiglia ? repo.eventiDellaRicorrenzaStandard(db, famiglia, standard.id) : []).filter(visibile)
    const altri = repo
      .elencaEventi(db, u.id)
      .filter((x) => x.id !== eventoId && x.gruppo?.id === (famiglia ?? undefined) && !stesse.includes(x.id))
      .sort((a, b) => b.data.localeCompare(a.data))
    const puoAssociare = puoModificare(permesso) && membro && e.stato !== 'archiviato'
    // Proposta dall'occasione, finché nessuno ha scelto (o dopo un cambio d'occasione).
    const proposta = standardPerOccasione(e.occasione)
    const suggerita = puoAssociare && proposta && proposta.id !== e.ricorrenzaStandard && !repo.ricorrenzaManuale(db, eventoId) ? { id: proposta.id, nome: proposta.nome } : null
    return {
      ricorrenza: ricorrenza ? { tipo: 'famiglia' as const, id: ricorrenza.id, nome: ricorrenza.nome } : standard ? { tipo: 'standard' as const, id: standard.id, nome: standard.nome } : null,
      suggerita,
      standard: puoAssociare ? RICORRENZE_STANDARD.map((r) => ({ id: r.id, nome: r.nome })) : [],
      edizioni: stesse.map((id) => edizione(db, id)),
      altriEventi: altri.map((x) => ({ id: x.id, nome: x.nome, data: x.data, stato: x.stato })),
      ricorrenze: puoAssociare && famiglia ? repoRicorrenze.ricorrenzeFamiglia(db, famiglia).map((r) => ({ id: r.id, nome: r.nome })) : [],
      puoAssociare,
    }
  })
}

/**
 * Associa l'evento a una ricorrenza della sua Famiglia o standard (chi lo modifica e ne fa parte),
 * o la toglie. È una scelta manuale: l'app non la cambierà più da sola (SPEC §30).
 */
export function associaRicorrenza(db: Db, u: UtenteCorrente, eventoId: string, scelta: SceltaRicorrenza | null): Edizioni {
  transazione(db, () => {
    richiediEvento(db, u, eventoId, 'modifica')
    richiediModificabile(leggiEvento(db, eventoId))
    const famiglia = repoAccesso.gruppoEvento(db, eventoId)
    if (scelta && famiglia && !repoAccesso.ruoloNelGruppo(db, famiglia, u.id)) throw nonTrovato('Ricorrenza')
    repo.impostaRicorrenza(db, eventoId, { ...risolviScelta(db, scelta, famiglia), manuale: true })
    incrementaRevisione(db)
  })
  return edizioni(db, u, eventoId)
}
