// Tabelle di contenuto e lettura/scrittura in blocco (esportazione e ripristino).
import { type Db, esegui, tutti } from '../db/connessione.ts'

/** Tabelle di contenuto in ordine di dipendenza: prima i genitori. */
export const TABELLE_CONTENUTO = [
  'impostazioni',
  'portate_predefinite',
  'reparti',
  'ingredienti',
  'sinonimi_ingrediente',
  'piatti',
  'ingredienti_piatto',
  'eventi',
  'portate_evento',
  'voci_menu',
  'articoli_spesa',
  'attivita',
  'snapshot_eventi',
  'meta',
] as const

/** Chiavi di meta che descrivono il servizio, non il contenuto: escluse da esportazioni e ripristini. */
export const META_DI_SERVIZIO = ['revisione', 'ultimo_backup', 'ultima_esportazione']

export type RigaGenerica = Record<string, string | number | null>

export function colonne(db: Db, tabella: string, schema = 'main'): { nome: string; pk: number }[] {
  return tutti<{ name: string; pk: number }>(db, `SELECT name, pk FROM pragma_table_info(?, ?) ORDER BY cid`, tabella, schema).map(
    (c) => ({ nome: c.name, pk: c.pk }),
  )
}

function ordinePk(db: Db, tabella: string, schema = 'main'): string {
  const pk = colonne(db, tabella, schema)
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => `"${c.nome}"`)
  return pk.length ? pk.join(', ') : 'rowid'
}

/** Legge tutte le tabelle di contenuto, righe ordinate per chiave primaria. */
export function leggiContenuto(db: Db, schema = 'main'): Record<string, RigaGenerica[]> {
  const dati: Record<string, RigaGenerica[]> = {}
  for (const t of TABELLE_CONTENUTO) {
    let righe = tutti<RigaGenerica>(db, `SELECT * FROM ${schema}."${t}" ORDER BY ${ordinePk(db, t, schema)}`)
    if (t === 'meta') righe = righe.filter((r) => !META_DI_SERVIZIO.includes(String(r.chiave)))
    dati[t] = righe.map((r) => ({ ...r }))
  }
  return dati
}

export function conteggi(dati: Record<string, unknown[]>): Record<string, number> {
  return Object.fromEntries(Object.entries(dati).map(([t, righe]) => [t, righe.length]))
}

/** Inserisce le righe di un'esportazione in un database vuoto con lo stesso schema. */
export function inserisciContenuto(db: Db, dati: Record<string, RigaGenerica[]>): void {
  for (const t of TABELLE_CONTENUTO) {
    const righe = dati[t] ?? []
    if (righe.length === 0) continue
    const ammesse = new Set(colonne(db, t).map((c) => c.nome))
    for (const riga of righe) {
      const nomi = Object.keys(riga)
      const estranee = nomi.filter((n) => !ammesse.has(n))
      if (estranee.length) throw new Error(`Colonne sconosciute in ${t}: ${estranee.join(', ')}`)
      if (t === 'meta' && META_DI_SERVIZIO.includes(String(riga.chiave))) continue
      esegui(
        db,
        `INSERT INTO "${t}" (${nomi.map((n) => `"${n}"`).join(', ')}) VALUES (${nomi.map(() => '?').join(', ')})`,
        ...nomi.map((n) => riga[n] ?? null),
      )
    }
  }
}
