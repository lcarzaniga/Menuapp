// Regressione dell'incidente del 19/11/2026 (SPEC §32.6): sul Worker il backup pre-migrazione è
// un'esportazione fatta dal codice nuovo sullo schema vecchio, che non ha ancora le tabelle delle
// migrazioni da applicare. Deve riuscire per ogni schema precedente, e il backup si deve ripristinare.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { esegui, uno, versioneSchema } from '../db/connessione.ts'
import { apriDatabase, chiudiDatabase } from '../db/sqlite-node.ts'
import { applicaElenco } from '../db/migrazioni/applica.ts'
import { applicaMigrazioni, elencaMigrazioni } from '../db/migrazioni/esegui.ts'
import { esporta } from './esportazione.ts'
import { inserisciContenuto } from './contenuto.ts'

describe('backup pre-migrazione con il codice nuovo sullo schema vecchio', () => {
  const tutte = elencaMigrazioni()
  for (const da of [15, 19, tutte.length - 1]) {
    it(`dallo schema ${da}: esportazione completa, poi migrazione`, async () => {
      const cartella = mkdtempSync(join(tmpdir(), 'menuapp-premig-'))
      try {
        const db = apriDatabase(join(cartella, 'menuapp.db'))
        await applicaMigrazioni(db, { cartellaBackup: null, fino: da })
        esegui(db, "INSERT INTO piatti (id, nome, nome_norm, proprietario_id, creato_il, aggiornato_il) VALUES ('p', 'Torta', 'torta', 'utente-amministratore', 1, 1)")
        let backup: ReturnType<typeof esporta> | undefined
        const esito = await applicaElenco(db, tutte, async () => {
          backup = esporta(db, 'prova')
          return 'pre-migrazione-prova'
        })
        expect(esito).toMatchObject({ versionePrima: da, versioneDopo: tutte.length, backup: 'pre-migrazione-prova' })
        expect(backup!.versioneSchema).toBe(da)
        expect(backup!.dati.piatti).toHaveLength(1)
        // Il backup (senza le tabelle nuove) si rimette in un database dello schema attuale.
        const nuovo = apriDatabase(join(cartella, 'nuovo.db'))
        await applicaMigrazioni(nuovo, { cartellaBackup: null })
        esegui(nuovo, 'PRAGMA defer_foreign_keys = ON')
        esegui(nuovo, 'BEGIN')
        inserisciContenuto(nuovo, backup!.dati)
        esegui(nuovo, 'COMMIT')
        expect(uno(nuovo, "SELECT nome FROM piatti WHERE id = 'p'")).toEqual({ nome: 'Torta' })
        expect(versioneSchema(nuovo)).toBe(tutte.length)
        chiudiDatabase(nuovo)
        chiudiDatabase(db)
      } finally {
        rmSync(cartella, { recursive: true, force: true })
      }
    })
  }
})
