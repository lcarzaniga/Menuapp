// SQL di piatti, ingredienti dei piatti, catalogo ingredienti e sinonimi.
import { norm } from '../../../src/domain/testo.ts'
import type { CodiceUnita, Ingrediente, IngredientePiatto, Piatto, Scalatura, StatoParsing } from '../../../src/domain/tipi.ts'
import { type Db, esegui, tutti, uno } from '../connessione.ts'
import { STESSO_GRUPPO } from './accesso.ts'

interface RigaPiatto {
  id: string
  nome: string
  portata_suggerita: string | null
  porzioni_base: number | null
  tempo_preparazione_min: number | null
  tempo_cottura_min: number | null
  tempo_riposo_min: number | null
  attrezzature: string
  procedimento: string
  note: string
  fonte: string
  versione: number
  creato_il: number
  aggiornato_il: number
}

interface RigaIngPiatto {
  id: string
  ordine: number
  testo_originale: string
  nome: string
  ingrediente_id: string | null
  quantita: number | null
  quantita_max: number | null
  unita: string | null
  scalatura: string
  facoltativo: number
  nota: string
  stato_parsing: string
  problemi_parsing: string
}

const daRigaIng = (r: RigaIngPiatto): IngredientePiatto => ({
  id: r.id,
  ordine: r.ordine,
  testoOriginale: r.testo_originale,
  nome: r.nome,
  ingredienteId: r.ingrediente_id,
  quantita: r.quantita,
  quantitaMax: r.quantita_max,
  unita: r.unita as CodiceUnita | null,
  scalatura: r.scalatura as Scalatura,
  facoltativo: r.facoltativo === 1,
  nota: r.nota,
  statoParsing: r.stato_parsing as StatoParsing,
  problemiParsing: JSON.parse(r.problemi_parsing) as string[],
})

const daRigaPiatto = (r: RigaPiatto, ingredienti: IngredientePiatto[]): Piatto => ({
  id: r.id,
  nome: r.nome,
  portataSuggerita: r.portata_suggerita,
  porzioniBase: r.porzioni_base,
  tempoPreparazioneMin: r.tempo_preparazione_min,
  tempoCotturaMin: r.tempo_cottura_min,
  tempoRiposoMin: r.tempo_riposo_min,
  attrezzature: JSON.parse(r.attrezzature) as string[],
  procedimento: JSON.parse(r.procedimento) as string[],
  note: r.note,
  fonte: r.fonte,
  versione: r.versione,
  creatoIl: r.creato_il,
  aggiornatoIl: r.aggiornato_il,
  ingredienti,
})

export function ingredientiPiatto(db: Db, piattoId: string): IngredientePiatto[] {
  return tutti<RigaIngPiatto>(db, 'SELECT * FROM ingredienti_piatto WHERE piatto_id = ? ORDER BY ordine', piattoId).map(daRigaIng)
}

export function leggiPiatto(db: Db, id: string): Piatto | undefined {
  const r = uno<RigaPiatto>(db, 'SELECT * FROM piatti WHERE id = ?', id)
  return r ? daRigaPiatto(r, ingredientiPiatto(db, id)) : undefined
}

/** Tutti i piatti indicati, con ingredienti (per calcolo della spesa e snapshot). */
export function leggiPiatti(db: Db, ids: string[]): Map<string, Piatto> {
  const m = new Map<string, Piatto>()
  for (const id of new Set(ids)) {
    const p = leggiPiatto(db, id)
    if (p) m.set(id, p)
  }
  return m
}

/** Piatti visibili all'utente nel ricettario: i suoi, quelli di famiglia e quelli condivisi con lui. */
export function elencaPiatti(db: Db, utenteId: string, ricerca?: string) {
  const filtro = ricerca ? `%${norm(ricerca).replace(/[%_]/g, '')}%` : '%'
  return tutti<{
    id: string
    nome: string
    portata_suggerita: string | null
    porzioni_base: number | null
    versione: number
    aggiornato_il: number
    numero_ingredienti: number
    da_verificare: number
    usi: number
    proprietario_id: string
    proprietario_nome: string
    origine_autore: string
    condiviso: number
    visibilita: 'famiglia' | 'privata'
  }>(
    db,
    `SELECT p.id, p.nome, p.portata_suggerita, p.porzioni_base, p.versione, p.aggiornato_il, p.proprietario_id, p.origine_autore, p.visibilita,
       u.nome AS proprietario_nome,
       (SELECT count(*) FROM ingredienti_piatto i WHERE i.piatto_id = p.id) AS numero_ingredienti,
       (SELECT count(*) FROM ingredienti_piatto i WHERE i.piatto_id = p.id AND i.stato_parsing = 'da_verificare') AS da_verificare,
       (SELECT count(*) FROM voci_menu v WHERE v.piatto_id = p.id) AS usi,
       EXISTS (SELECT 1 FROM condivisioni_piatto c WHERE c.piatto_id = p.id) AS condiviso
     FROM piatti p JOIN utenti u ON u.id = p.proprietario_id
     WHERE p.nome_norm LIKE ?
       AND (p.proprietario_id = ? OR (p.visibilita = 'famiglia' AND ${STESSO_GRUPPO}) OR EXISTS (SELECT 1 FROM condivisioni_piatto c WHERE c.piatto_id = p.id AND c.utente_id = ?))
     ORDER BY p.nome_norm`,
    filtro,
    utenteId,
    utenteId,
    utenteId,
    utenteId,
  ).map((r) => ({
    id: r.id,
    nome: r.nome,
    portataSuggerita: r.portata_suggerita,
    porzioniBase: r.porzioni_base,
    numeroIngredienti: r.numero_ingredienti,
    daVerificare: r.da_verificare,
    usi: r.proprietario_id === utenteId ? r.usi : 0,
    versione: r.versione,
    aggiornatoIl: r.aggiornato_il,
    proprietario: { id: r.proprietario_id, nome: r.proprietario_nome },
    mio: r.proprietario_id === utenteId,
    condiviso: r.proprietario_id === utenteId && r.condiviso === 1,
    origineAutore: r.origine_autore,
    visibilita: r.visibilita,
  }))
}

export interface InfoProprieta {
  proprietarioId: string
  proprietarioNome: string
  originePiattoId: string | null
  origineAutore: string
  visibilita: 'famiglia' | 'privata'
}

export function proprietaPiatto(db: Db, id: string): InfoProprieta | undefined {
  const r = uno<{ proprietario_id: string; nome: string; origine_piatto_id: string | null; origine_autore: string; visibilita: 'famiglia' | 'privata' }>(
    db,
    'SELECT p.proprietario_id, u.nome, p.origine_piatto_id, p.origine_autore, p.visibilita FROM piatti p JOIN utenti u ON u.id = p.proprietario_id WHERE p.id = ?',
    id,
  )
  return (
    r && { proprietarioId: r.proprietario_id, proprietarioNome: r.nome, originePiattoId: r.origine_piatto_id, origineAutore: r.origine_autore, visibilita: r.visibilita }
  )
}

/** Copia già fatta di un piatto nel ricettario di un utente (la più recente). */
export const copiaEsistente = (db: Db, originaleId: string, proprietarioId: string) =>
  uno<{ id: string }>(db, 'SELECT id FROM piatti WHERE origine_piatto_id = ? AND proprietario_id = ? ORDER BY creato_il DESC LIMIT 1', originaleId, proprietarioId)?.id

/** Voci che usano il piatto, solo negli eventi visibili all'utente indicato. */
export function usiPiatto(db: Db, piattoId: string, utenteId?: string) {
  const righe = tutti<{ evento_id: string; evento_nome: string; data: string; stato: string; voce_id: string; voce_nome: string; proprietario_id: string }>(
    db,
    `SELECT e.id AS evento_id, e.nome AS evento_nome, e.data, e.stato, v.id AS voce_id, v.nome AS voce_nome, e.proprietario_id
     FROM voci_menu v JOIN eventi e ON e.id = v.evento_id WHERE v.piatto_id = ? ORDER BY e.data DESC`,
    piattoId,
  )
  const visibile = (r: (typeof righe)[number]) =>
    utenteId === undefined || r.proprietario_id === utenteId || uno(db, 'SELECT 1 FROM condivisioni_evento WHERE evento_id = ? AND utente_id = ?', r.evento_id, utenteId) !== undefined
  return righe
    .filter(visibile)
    .map((r) => ({ eventoId: r.evento_id, eventoNome: r.evento_nome, data: r.data, stato: r.stato, voceId: r.voce_id, voceNome: r.voce_nome }))
}

export type DatiPiatto = Omit<Piatto, 'id' | 'versione' | 'creatoIl' | 'aggiornatoIl' | 'ingredienti'>

export function colonnePiatto(d: DatiPiatto) {
  return {
    nome: d.nome,
    nome_norm: norm(d.nome),
    portata_suggerita: d.portataSuggerita,
    porzioni_base: d.porzioniBase,
    tempo_preparazione_min: d.tempoPreparazioneMin,
    tempo_cottura_min: d.tempoCotturaMin,
    tempo_riposo_min: d.tempoRiposoMin,
    attrezzature: JSON.stringify(d.attrezzature),
    procedimento: JSON.stringify(d.procedimento),
    note: d.note,
    fonte: d.fonte,
  }
}

export interface Proprieta {
  proprietarioId: string
  originePiattoId?: string | null
  origineAutore?: string
  visibilita?: 'famiglia' | 'privata'
}

export function inserisciPiatto(db: Db, id: string, d: DatiPiatto, adesso: number, p: Proprieta): void {
  const c = {
    ...colonnePiatto(d),
    proprietario_id: p.proprietarioId,
    origine_piatto_id: p.originePiattoId ?? null,
    origine_autore: p.origineAutore ?? '',
    visibilita: p.visibilita ?? 'famiglia',
  }
  const nomi = Object.keys(c)
  esegui(
    db,
    `INSERT INTO piatti (id, ${nomi.join(', ')}, versione, creato_il, aggiornato_il) VALUES (?, ${nomi.map(() => '?').join(', ')}, 1, ?, ?)`,
    id,
    ...Object.values(c),
    adesso,
    adesso,
  )
}

/** Sostituisce gli ingredienti del piatto (fanno parte dell'aggregato piatto). */
export function scriviIngredienti(db: Db, piattoId: string, ingredienti: IngredientePiatto[]): void {
  esegui(db, 'DELETE FROM ingredienti_piatto WHERE piatto_id = ?', piattoId)
  ingredienti.forEach((i, ordine) => {
    esegui(
      db,
      `INSERT INTO ingredienti_piatto (id, piatto_id, ordine, testo_originale, nome, ingrediente_id, quantita, quantita_max, unita,
         scalatura, facoltativo, nota, stato_parsing, problemi_parsing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      i.id, piattoId, ordine, i.testoOriginale, i.nome, i.ingredienteId, i.quantita, i.quantitaMax, i.unita,
      i.scalatura, i.facoltativo, i.nota, i.statoParsing, JSON.stringify(i.problemiParsing),
    )
  })
}

export function idIngredientiPiattoAltrui(db: Db, piattoId: string, ids: string[]): string[] {
  return ids.filter((id) => uno(db, 'SELECT 1 FROM ingredienti_piatto WHERE id = ? AND piatto_id <> ?', id, piattoId))
}

// ── Catalogo ────────────────────────────────────────────────

interface RigaIngrediente {
  id: string
  nome: string
  reparto_id: string
  unita_preferita: string | null
  scalatura_abituale: string
  versione: number
  creato_il: number
  aggiornato_il: number
}

export function elencaIngredienti(db: Db): Ingrediente[] {
  const sinonimi = new Map<string, string[]>()
  for (const s of tutti<{ ingrediente_id: string; sinonimo: string }>(db, 'SELECT ingrediente_id, sinonimo FROM sinonimi_ingrediente ORDER BY sinonimo_norm')) {
    sinonimi.set(s.ingrediente_id, [...(sinonimi.get(s.ingrediente_id) ?? []), s.sinonimo])
  }
  return tutti<RigaIngrediente>(db, 'SELECT * FROM ingredienti ORDER BY nome_norm').map((r) => daRigaIngrediente(r, sinonimi.get(r.id) ?? []))
}

const daRigaIngrediente = (r: RigaIngrediente, sinonimi: string[]): Ingrediente => ({
  id: r.id,
  nome: r.nome,
  sinonimi,
  repartoId: r.reparto_id,
  unitaPreferita: r.unita_preferita as CodiceUnita | null,
  scalaturaAbituale: r.scalatura_abituale as Scalatura,
  versione: r.versione,
  creatoIl: r.creato_il,
  aggiornatoIl: r.aggiornato_il,
})

export function leggiIngrediente(db: Db, id: string): Ingrediente | undefined {
  const r = uno<RigaIngrediente>(db, 'SELECT * FROM ingredienti WHERE id = ?', id)
  if (!r) return undefined
  const s = tutti<{ sinonimo: string }>(db, 'SELECT sinonimo FROM sinonimi_ingrediente WHERE ingrediente_id = ? ORDER BY sinonimo_norm', id)
  return daRigaIngrediente(r, s.map((x) => x.sinonimo))
}

export function ingredienteEsiste(db: Db, id: string): boolean {
  return uno(db, 'SELECT 1 FROM ingredienti WHERE id = ?', id) !== undefined
}

/** Primo conflitto di nome o sinonimo con altri ingredienti (unicità fra nomi e sinonimi). */
export function conflittoNomi(db: Db, id: string, nomi: string[]): string | null {
  for (const n of nomi) {
    const k = norm(n)
    const a = uno<{ nome: string }>(db, 'SELECT nome FROM ingredienti WHERE nome_norm = ? AND id <> ?', k, id)
    if (a) return `«${n}» è già il nome di «${a.nome}»`
    const b = uno<{ nome: string }>(
      db,
      'SELECT i.nome FROM sinonimi_ingrediente s JOIN ingredienti i ON i.id = s.ingrediente_id WHERE s.sinonimo_norm = ? AND s.ingrediente_id <> ?',
      k,
      id,
    )
    if (b) return `«${n}» è già un sinonimo di «${b.nome}»`
  }
  return null
}

export function scriviSinonimi(db: Db, id: string, sinonimi: string[]): void {
  esegui(db, 'DELETE FROM sinonimi_ingrediente WHERE ingrediente_id = ?', id)
  for (const s of sinonimi) {
    esegui(db, 'INSERT OR IGNORE INTO sinonimi_ingrediente (ingrediente_id, sinonimo, sinonimo_norm) VALUES (?, ?, ?)', id, s, norm(s))
  }
}

/** Piatti dell'utente che usano l'ingrediente, più il numero di quelli di altri utenti (senza nomi). */
export function piattiConIngrediente(db: Db, id: string, utenteId: string) {
  const righe = tutti<{ id: string; nome: string; proprietario_id: string }>(
    db,
    'SELECT DISTINCT p.id, p.nome, p.proprietario_id FROM ingredienti_piatto i JOIN piatti p ON p.id = i.piatto_id WHERE i.ingrediente_id = ? ORDER BY p.nome_norm',
    id,
  )
  return {
    piatti: righe.filter((r) => r.proprietario_id === utenteId).map((r) => ({ id: r.id, nome: r.nome })),
    altri: righe.filter((r) => r.proprietario_id !== utenteId).length,
  }
}

/** Piatto collegato a una voce di menù (null se la voce è solo un nome). */
export const voceConPiatto = (db: Db, voceId: string) => uno<{ piatto_id: string | null }>(db, 'SELECT piatto_id FROM voci_menu WHERE id = ?', voceId)?.piatto_id ?? null
