// Esportazione JSON portabile con impronta canonica (SPEC §11.3).
import { createHash } from 'node:crypto'
import { FORMATO_ESPORTAZIONE, type Esportazione } from '../../src/contratto/backup.ts'
import { serializzaCanonico } from '../../src/domain/canonico.ts'
import { type Db, lettura, versioneSchema } from '../db/connessione.ts'
import { conteggi, leggiContenuto } from './contenuto.ts'

export function calcolaImpronta(e: Pick<Esportazione, 'versioneFormato' | 'versioneSchema' | 'dati'>): string {
  const testo = serializzaCanonico({ versioneFormato: e.versioneFormato, versioneSchema: e.versioneSchema, dati: e.dati })
  return `sha256:${createHash('sha256').update(testo, 'utf8').digest('hex')}`
}

export function esporta(db: Db, versioneApp: string, adesso = new Date()): Esportazione {
  return lettura(db, () => {
    const dati = leggiContenuto(db)
    const base = { versioneFormato: 1 as const, versioneSchema: versioneSchema(db), dati }
    return {
      formato: FORMATO_ESPORTAZIONE,
      ...base,
      versioneApp,
      esportatoAt: adesso.toISOString(),
      conteggi: conteggi(dati),
      impronta: calcolaImpronta(base),
    }
  })
}

export function nomeFileEsportazione(adesso = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `menuapp-esportazione-${adesso.getFullYear()}-${p(adesso.getMonth() + 1)}-${p(adesso.getDate())}-${p(adesso.getHours())}${p(adesso.getMinutes())}.json`
}
