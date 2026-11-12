// Impostazioni condivise e reparti (lettura): SPEC §6.6, §7.6.
import type { AggiornaImpostazioni } from '../../src/contratto/impostazioni.ts'
import { norm, pulisci } from '../../src/domain/testo.ts'
import type { Impostazioni, Reparto } from '../../src/domain/tipi.ts'
import { type Db, esegui, transazione, tutti, uno } from '../db/connessione.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import { richiestaNonValida } from './errori.ts'
import { aggiornaConVersione } from './versioni.ts'

export function leggiImpostazioni(db: Db): Impostazioni {
  const r = uno<{ coefficiente_bambini: number; versione: number; aggiornato_il: number }>(
    db,
    'SELECT coefficiente_bambini, versione, aggiornato_il FROM impostazioni WHERE id = 1',
  )
  if (!r) throw new Error('Impostazioni mancanti: seed non eseguito')
  const portate = tutti<{ id: string; nome: string; ordine: number }>(
    db,
    'SELECT id, nome, ordine FROM portate_predefinite ORDER BY ordine, nome',
  )
  return {
    coefficienteBambini: r.coefficiente_bambini,
    portatePredefinite: portate,
    versione: r.versione,
    aggiornatoIl: r.aggiornato_il,
  }
}

export function aggiornaImpostazioni(db: Db, dati: AggiornaImpostazioni): Impostazioni {
  const nomi = dati.portatePredefinite.map((p) => norm(p.nome))
  if (new Set(nomi).size !== nomi.length) throw richiestaNonValida('Due portate hanno lo stesso nome')
  return transazione(db, () => {
    aggiornaConVersione(
      db,
      'impostazioni',
      1,
      dati.versione,
      { coefficiente_bambini: dati.coefficienteBambini },
      () => leggiImpostazioni(db),
    )
    esegui(db, 'DELETE FROM portate_predefinite')
    dati.portatePredefinite.forEach((p, i) => {
      esegui(db, 'INSERT INTO portate_predefinite (id, nome, ordine) VALUES (?, ?, ?)', p.id, pulisci(p.nome), i)
    })
    incrementaRevisione(db)
    return leggiImpostazioni(db)
  })
}

interface RigaReparto {
  id: string
  nome: string
  ordine: number
  di_sistema: number
  versione: number
  creato_il: number
  aggiornato_il: number
}

export const daRigaReparto = (r: RigaReparto): Reparto => ({
  id: r.id,
  nome: r.nome,
  ordine: r.ordine,
  diSistema: r.di_sistema === 1,
  versione: r.versione,
  creatoIl: r.creato_il,
  aggiornatoIl: r.aggiornato_il,
})

export function elencaReparti(db: Db): Reparto[] {
  return tutti<RigaReparto>(db, 'SELECT * FROM reparti ORDER BY ordine, nome').map(daRigaReparto)
}

export function leggiReparto(db: Db, id: string): Reparto | undefined {
  const r = uno<RigaReparto>(db, 'SELECT * FROM reparti WHERE id = ?', id)
  return r ? daRigaReparto(r) : undefined
}
