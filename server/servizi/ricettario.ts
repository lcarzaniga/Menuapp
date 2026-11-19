// Casi d'uso del ricettario e del catalogo (SPEC §7.2, §7.5–7.6, F3–F4).
import type { AggiornaIngrediente, AggiornaPiatto, DettaglioPiatto, NuovoIngrediente, NuovoPiatto, RiepilogoPiatto } from '../../src/contratto/ricettario.ts'
import { cercaRicette, terminiRicerca } from '../../src/domain/ricerca.ts'
import { norm, pulisci } from '../../src/domain/testo.ts'
import type { Ingrediente, IngredientePiatto, Piatto, Reparto, VoceMenu } from '../../src/domain/tipi.ts'
import { REPARTO_ALTRO } from '../../src/domain/tipi.ts'
import { type Db, esegui, lettura, transazione, uno } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import * as repoEventi from '../db/repo/eventi.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repo from '../db/repo/ricettario.ts'
import { nonTrovato, regolaViolata, richiestaNonValida } from './errori.ts'
import { leggiEvento, richiediModificabile } from './eventi.ts'
import { elencaReparti, leggiReparto } from './impostazioni.ts'
import { elencaFoto, fotoPrincipali, ricollegaPassi } from './foto.ts'
import { aggiornaConVersione, controllaVersioni, creaIdempotente, eliminaConVersione, incrementaVersione } from './versioni.ts'

/** Ricette leggibili; con `ricerca` solo quelle trovate, nell'ordine della ricerca (§23). */
export function elencaPiatti(db: Db, utenteId: string, ricerca?: string, pubbliche: repo.PubblicheInElenco = 'no'): RiepilogoPiatto[] {
  const principali = fotoPrincipali(db)
  const elenco = repo.elencaPiatti(db, utenteId, pubbliche).map((p) => ({ ...p, fotoPrincipale: principali.get(p.id) ?? null }))
  return ricerca && terminiRicerca(ricerca).length ? cercaRicette(elenco, ricerca).map((x) => x.ricetta) : elenco
}

/** Scheda del piatto vista da `utenteId` (l'accesso è già stato verificato). */
export function leggiPiatto(db: Db, id: string, utenteId: string): DettaglioPiatto {
  return lettura(db, () => {
    const p = repo.leggiPiatto(db, id)
    const prop = repo.proprietaPiatto(db, id)
    if (!p || !prop) throw nonTrovato('Piatto')
    const mio = prop.proprietarioId === utenteId
    return {
      ...p,
      usatoIn: repo.usiPiatto(db, id, utenteId),
      foto: elencaFoto(db, id),
      proprietario: { id: prop.proprietarioId, nome: prop.proprietarioNome },
      mio,
      origineAutore: prop.origineAutore,
      originePiattoId: prop.originePiattoId,
      visibilita: prop.visibilita,
      famigliaOrigine: prop.famigliaOrigine,
      famiglie: mio ? repoAccesso.famigliePiatto(db, id) : [],
      famiglia: repoAccesso.famigliePiatto(db, id).find((g) => repoAccesso.ruoloNelGruppo(db, g.id, utenteId)) ?? null,
      provenienza: repo.provenienza(db, id),
      condivisaCon: mio ? repoAccesso.condivisioniPiatto(db, id).map((c) => ({ id: c.utente_id, nome: c.nome })) : [],
      soloPubblica: !mio && !repoAccesso.piattoLeggibileDaAltri(db, id, utenteId, false),
      miaCopia: mio ? null : (repo.copiaEsistente(db, id, utenteId) ?? null),
    }
  })
}

/**
 * Famiglia d'origine di una ricetta nata prima che esistesse (SPEC §35): la indica il proprietario,
 * fra le sue Famiglie, una volta sola. Il permesso di proprietario è già verificato.
 */
export function indicaFamigliaOrigine(db: Db, id: string, gruppoId: string, versione: number, utenteId: string, adesso = Date.now()): DettaglioPiatto {
  return transazione(db, () => {
    if (repo.proprietaPiatto(db, id)?.famigliaOrigine) throw regolaViolata('origine_fissa', 'La Famiglia d\'origine è già indicata e non si cambia')
    const g = repoAccesso.ruoloNelGruppo(db, gruppoId, utenteId) ? repoAccesso.leggiGruppo(db, gruppoId) : undefined
    if (!g) throw nonTrovato('Famiglia')
    aggiornaConVersione(db, 'piatti', id, versione, { famiglia_origine_id: gruppoId, famiglia_origine_nome: g.nome }, () => leggiPiatto(db, id, utenteId), adesso)
    incrementaRevisione(db)
    return leggiPiatto(db, id, utenteId)
  })
}

/** Controllo dopo la migrazione 0016 (console): le ricette ancora senza Famiglia d'origine. */
export function riepilogoOrigini(db: Db): string[] {
  const mancanti = lettura(db, () => repo.statoOrigini(db))
  const totale = lettura(db, () => uno<{ n: number }>(db, 'SELECT count(*) AS n FROM piatti')!.n)
  return [
    `Ricette: ${totale}; con la Famiglia d'origine: ${totale - mancanti.length}; da indicare: ${mancanti.length}.`,
    ...mancanti.map((m) => `  ${m.proprietario.padEnd(16)} ${m.nome}  (${m.id})`),
    ...(mancanti.length ? ['Le indica il proprietario nella scheda della ricetta («In quale Famiglia è nata?»).'] : []),
  ]
}

function datiPiatto(d: NuovoPiatto | AggiornaPiatto): repo.DatiPiatto {
  return {
    nome: pulisci(d.nome),
    portataSuggerita: d.portataSuggerita?.trim() || null,
    porzioniBase: d.porzioniBase ?? null,
    tempoPreparazioneMin: d.tempoPreparazioneMin ?? null,
    tempoCotturaMin: d.tempoCotturaMin ?? null,
    tempoRiposoMin: d.tempoRiposoMin ?? null,
    attrezzature: (d.attrezzature ?? []).map(pulisci),
    procedimento: (d.procedimento ?? []).map((p) => p.trim()),
    note: d.note ?? '',
    fonte: pulisci(d.fonte ?? ''),
  }
}

function controllaIngredienti(db: Db, piattoId: string, ingredienti: IngredientePiatto[]): IngredientePiatto[] {
  const ids = ingredienti.map((i) => i.id)
  if (new Set(ids).size !== ids.length) throw richiestaNonValida('Ingrediente ripetuto nel piatto')
  if (repo.idIngredientiPiattoAltrui(db, piattoId, ids).length) throw richiestaNonValida('Identificativo di ingrediente già usato da un altro piatto')
  for (const i of ingredienti) {
    if (i.ingredienteId && !repo.ingredienteEsiste(db, i.ingredienteId)) {
      throw regolaViolata('ingrediente_inesistente', `L'ingrediente di catalogo collegato a «${i.nome}» non esiste più`)
    }
  }
  return ingredienti.map((i, ordine) => ({ ...i, ordine, nome: pulisci(i.nome), nota: pulisci(i.nota) }))
}

export function creaPiatto(db: Db, d: NuovoPiatto, proprieta: repo.Proprieta, adesso = Date.now()): { creato: boolean; valore: DettaglioPiatto } {
  return transazione(db, () => {
    const dati = datiPiatto(d)
    const ingredienti = controllaIngredienti(db, d.id, d.ingredienti ?? [])
    const esito = creaIdempotente(
      db,
      'piatti',
      d.id,
      () => repo.leggiPiatto(db, d.id),
      // Ripetizione della stessa creazione solo se il piatto è dello stesso utente.
      (p) => p.nome === dati.nome && repo.proprietaPiatto(db, d.id)?.proprietarioId === proprieta.proprietarioId,
      () => {
        repo.inserisciPiatto(db, d.id, dati, adesso, proprieta)
        repo.scriviIngredienti(db, d.id, ingredienti)
      },
    )
    if (esito.creato) incrementaRevisione(db)
    return { creato: esito.creato, valore: leggiPiatto(db, d.id, proprieta.proprietarioId) }
  })
}

export function aggiornaPiatto(db: Db, id: string, d: AggiornaPiatto, utenteId: string, adesso = Date.now()): DettaglioPiatto {
  return transazione(db, () => {
    const ingredienti = controllaIngredienti(db, id, d.ingredienti)
    const prima = repo.leggiPiatto(db, id)?.procedimento ?? []
    const dati = datiPiatto(d)
    aggiornaConVersione(db, 'piatti', id, d.versione, repo.colonnePiatto(dati), () => leggiPiatto(db, id, utenteId), adesso)
    ricollegaPassi(db, id, prima, dati.procedimento)
    repo.scriviIngredienti(db, id, ingredienti)
    incrementaRevisione(db)
    return leggiPiatto(db, id, utenteId)
  })
}

/** Elimina il piatto: le voci restano con il loro nome e senza piatto; gli snapshot non cambiano. */
export function eliminaPiatto(db: Db, id: string, versione: number, utenteId: string): void {
  transazione(db, () => {
    const usi = repo.usiPiatto(db, id)
    eliminaConVersione(db, 'piatti', id, versione, () => leggiPiatto(db, id, utenteId))
    // Le voci scollegate cambiano: la loro versione sale, così chi le modifica se ne accorge.
    for (const u of usi) incrementaVersione(db, 'voci_menu', u.voceId)
    incrementaRevisione(db)
  })
}

/** «Crea nel ricettario»: nuovo piatto con il nome della voce, collegato in una transazione. */
export function creaPiattoDaVoce(db: Db, voceId: string, piattoId: string, versioneVoce: number, adesso = Date.now()): { voce: VoceMenu; piatto: Piatto } {
  return transazione(db, () => {
    const voce = repoEventi.leggiVoce(db, voceId)
    if (!voce) throw nonTrovato('Voce di menù')
    richiediModificabile(leggiEvento(db, voce.eventoId))
    if (voce.piattoId) throw regolaViolata('voce_gia_collegata', 'La voce è già collegata a un piatto')
    controllaVersioni(db, 'voci_menu', [{ id: voceId, versione: versioneVoce }], () => repoEventi.leggiVoce(db, voceId))
    if (uno(db, 'SELECT 1 FROM piatti WHERE id = ?', piattoId)) throw richiestaNonValida('Identificativo di piatto già usato')
    // Il piatto nasce nel ricettario del proprietario dell'evento, come richiede il collegamento.
    const proprietario = repoAccesso.proprietarioEvento(db, voce.eventoId)!
    repo.inserisciPiatto(db, piattoId, datiPiatto({ id: piattoId, nome: voce.nome }), adesso, {
      proprietarioId: proprietario,
      famigliaOrigine: repoAccesso.famigliaEventoPer(db, voce.eventoId, proprietario),
    })
    aggiornaConVersione(db, 'voci_menu', voceId, versioneVoce, { piatto_id: piattoId }, () => repoEventi.leggiVoce(db, voceId), adesso)
    incrementaRevisione(db)
    return { voce: repoEventi.leggiVoce(db, voceId)!, piatto: repo.leggiPiatto(db, piattoId)! }
  })
}

// ── Catalogo ingredienti ────────────────────────────────────

export function elencaIngredienti(db: Db): Ingrediente[] {
  return lettura(db, () => repo.elencaIngredienti(db))
}

export function leggiIngrediente(db: Db, id: string): Ingrediente {
  const i = repo.leggiIngrediente(db, id)
  if (!i) throw nonTrovato('Ingrediente')
  return i
}

function preparaIngrediente(db: Db, id: string, d: NuovoIngrediente | AggiornaIngrediente) {
  const nome = pulisci(d.nome)
  const sinonimi = [...new Map(d.sinonimi.map((s) => pulisci(s)).filter((s) => norm(s) !== norm(nome)).map((s) => [norm(s), s])).values()]
  if (!leggiReparto(db, d.repartoId)) throw richiestaNonValida('Reparto inesistente')
  const conflitto = repo.conflittoNomi(db, id, [nome, ...sinonimi])
  if (conflitto) throw regolaViolata('nome_duplicato', conflitto)
  return { nome, sinonimi }
}

export function creaIngrediente(db: Db, d: NuovoIngrediente, adesso = Date.now()): { creato: boolean; valore: Ingrediente } {
  return transazione(db, () => {
    if (repo.ingredienteEsiste(db, d.id)) {
      const e = leggiIngrediente(db, d.id)
      if (norm(e.nome) === norm(d.nome)) return { creato: false, valore: e }
    }
    const { nome, sinonimi } = preparaIngrediente(db, d.id, d)
    const esito = creaIdempotente(
      db,
      'ingredienti',
      d.id,
      () => repo.leggiIngrediente(db, d.id),
      (e) => norm(e.nome) === norm(nome),
      () => {
        esegui(
          db,
          `INSERT INTO ingredienti (id, nome, nome_norm, reparto_id, unita_preferita, scalatura_abituale, versione, creato_il, aggiornato_il)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          d.id, nome, norm(nome), d.repartoId, d.unitaPreferita, d.scalaturaAbituale, adesso, adesso,
        )
        repo.scriviSinonimi(db, d.id, sinonimi)
      },
    )
    if (esito.creato) incrementaRevisione(db)
    return esito
  })
}

export function aggiornaIngrediente(db: Db, id: string, d: AggiornaIngrediente, adesso = Date.now()): Ingrediente {
  return transazione(db, () => {
    const { nome, sinonimi } = preparaIngrediente(db, id, d)
    aggiornaConVersione(
      db,
      'ingredienti',
      id,
      d.versione,
      { nome, nome_norm: norm(nome), reparto_id: d.repartoId, unita_preferita: d.unitaPreferita, scalatura_abituale: d.scalaturaAbituale },
      () => leggiIngrediente(db, id),
      adesso,
    )
    repo.scriviSinonimi(db, id, sinonimi)
    incrementaRevisione(db)
    return leggiIngrediente(db, id)
  })
}

export function eliminaIngrediente(db: Db, id: string, versione: number): void {
  transazione(db, () => {
    eliminaConVersione(db, 'ingredienti', id, versione, () => leggiIngrediente(db, id))
    incrementaRevisione(db)
  })
}

export function usiIngrediente(db: Db, id: string, utenteId: string) {
  leggiIngrediente(db, id)
  return repo.piattiConIngrediente(db, id, utenteId)
}

// ── Reparti ─────────────────────────────────────────────────

function nomeRepartoLibero(db: Db, id: string, nome: string): void {
  const altro = uno<{ id: string }>(db, 'SELECT id FROM reparti WHERE nome_norm = ? AND id <> ?', norm(nome), id)
  if (altro) throw regolaViolata('nome_duplicato', `Esiste già un reparto «${nome}»`)
}

export function creaReparto(db: Db, id: string, nome: string, adesso = Date.now()): Reparto {
  return transazione(db, () => {
    const n = pulisci(nome)
    const esistente = leggiReparto(db, id)
    if (esistente) {
      if (norm(esistente.nome) === norm(n)) return esistente
      throw regolaViolata('id_esistente', 'Identificativo di reparto già usato')
    }
    nomeRepartoLibero(db, id, n)
    const ordine = (uno<{ m: number | null }>(db, 'SELECT max(ordine) AS m FROM reparti')?.m ?? -1) + 1
    esegui(
      db,
      'INSERT INTO reparti (id, nome, nome_norm, ordine, di_sistema, versione, creato_il, aggiornato_il) VALUES (?, ?, ?, ?, 0, 1, ?, ?)',
      id, n, norm(n), ordine, adesso, adesso,
    )
    incrementaRevisione(db)
    return leggiReparto(db, id)!
  })
}

export function rinominaReparto(db: Db, id: string, nome: string, versione: number): Reparto {
  return transazione(db, () => {
    const n = pulisci(nome)
    nomeRepartoLibero(db, id, n)
    aggiornaConVersione(db, 'reparti', id, versione, { nome: n, nome_norm: norm(n) }, () => leggiReparto(db, id))
    incrementaRevisione(db)
    return leggiReparto(db, id)!
  })
}

export function riordinaReparti(db: Db, voci: { id: string; versione: number }[]): Reparto[] {
  return transazione(db, () => {
    const tutti = elencaReparti(db)
    if (voci.length !== tutti.length || !tutti.every((r) => voci.some((v) => v.id === r.id))) {
      throw richiestaNonValida('L\'ordine deve contenere tutti i reparti')
    }
    controllaVersioni(db, 'reparti', voci, () => elencaReparti(db))
    voci.forEach((v, i) => esegui(db, 'UPDATE reparti SET ordine = ? WHERE id = ?', i, v.id))
    incrementaRevisione(db)
    return elencaReparti(db)
  })
}

/** Elimina un reparto: i suoi ingredienti passano ad «Altro» nella stessa transazione. */
export function eliminaReparto(db: Db, id: string, versione: number, adesso = Date.now()): void {
  transazione(db, () => {
    const r = leggiReparto(db, id)
    if (!r) throw nonTrovato('Reparto')
    if (r.diSistema || id === REPARTO_ALTRO) throw regolaViolata('reparto_di_sistema', '«Altro» non si può eliminare')
    esegui(db, 'UPDATE ingredienti SET reparto_id = ?, versione = versione + 1, aggiornato_il = ? WHERE reparto_id = ?', REPARTO_ALTRO, adesso, id)
    eliminaConVersione(db, 'reparti', id, versione, () => leggiReparto(db, id))
    incrementaRevisione(db)
  })
}
