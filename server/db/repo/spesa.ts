// SQL degli articoli di spesa (stati, interventi dell'utente, articoli manuali).
import type { ArticoloSpesa, StatoSpesa } from '../../../src/domain/tipi.ts'
import { type Db, esegui, tutti, uno } from '../connessione.ts'

interface Riga {
  id: string
  evento_id: string
  tipo: string
  chiave: string | null
  stato: string
  fabbisogno_coperto: number | null
  quantita_utente: number | null
  quantita_calcolata_alla_correzione: number | null
  reparto_id: string | null
  nascosto: number
  inclusa: number
  nota: string
  nome: string
  quantita_testo: string
  versione: number
  creato_il: number
  aggiornato_il: number
}

const daRiga = (r: Riga): ArticoloSpesa => ({
  id: r.id,
  eventoId: r.evento_id,
  tipo: r.tipo as ArticoloSpesa['tipo'],
  chiave: r.chiave,
  stato: r.stato as StatoSpesa,
  fabbisognoCoperto: r.fabbisogno_coperto,
  quantitaUtente: r.quantita_utente,
  quantitaCalcolataAllaCorrezione: r.quantita_calcolata_alla_correzione,
  repartoId: r.reparto_id,
  nascosto: r.nascosto === 1,
  inclusa: r.inclusa === 1,
  nota: r.nota,
  nome: r.nome,
  quantitaTesto: r.quantita_testo,
  versione: r.versione,
  creatoIl: r.creato_il,
  aggiornatoIl: r.aggiornato_il,
})

export function articoliEvento(db: Db, eventoId: string): ArticoloSpesa[] {
  return tutti<Riga>(db, 'SELECT * FROM articoli_spesa WHERE evento_id = ? ORDER BY creato_il', eventoId).map(daRiga)
}

export function articoloPerChiave(db: Db, eventoId: string, chiave: string): ArticoloSpesa | undefined {
  const r = uno<Riga>(db, 'SELECT * FROM articoli_spesa WHERE evento_id = ? AND chiave = ?', eventoId, chiave)
  return r ? daRiga(r) : undefined
}

export function leggiArticolo(db: Db, id: string): ArticoloSpesa | undefined {
  const r = uno<Riga>(db, 'SELECT * FROM articoli_spesa WHERE id = ?', id)
  return r ? daRiga(r) : undefined
}

export type DatiArticolo = Omit<ArticoloSpesa, 'id' | 'eventoId' | 'tipo' | 'chiave' | 'versione' | 'creatoIl' | 'aggiornatoIl'>

export function colonne(d: DatiArticolo) {
  return {
    stato: d.stato,
    fabbisogno_coperto: d.fabbisognoCoperto,
    quantita_utente: d.quantitaUtente,
    quantita_calcolata_alla_correzione: d.quantitaCalcolataAllaCorrezione,
    reparto_id: d.repartoId,
    nascosto: d.nascosto,
    inclusa: d.inclusa,
    nota: d.nota,
    nome: d.nome,
    quantita_testo: d.quantitaTesto,
  }
}

export function inserisciArticolo(db: Db, id: string, eventoId: string, tipo: 'calcolato' | 'manuale', chiave: string | null, d: DatiArticolo, adesso: number): void {
  const c = colonne(d)
  esegui(
    db,
    `INSERT INTO articoli_spesa (id, evento_id, tipo, chiave, ${Object.keys(c).join(', ')}, versione, creato_il, aggiornato_il)
     VALUES (?, ?, ?, ?, ${Object.keys(c).map(() => '?').join(', ')}, 1, ?, ?)`,
    id, eventoId, tipo, chiave, ...Object.values(c), adesso, adesso,
  )
}

export function eliminaArticolo(db: Db, id: string): void {
  esegui(db, 'DELETE FROM articoli_spesa WHERE id = ?', id)
}
