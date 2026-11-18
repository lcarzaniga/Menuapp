// Casi d'uso dei backup: registrazione dell'esito e avvisi (SPEC §11.2, §11.6).
import type { StatoBackup } from '../../src/contratto/backup.ts'
import { type Db, uno } from '../db/connessione.ts'
import { leggiMeta, scriviMeta } from '../db/repo/meta.ts'
import { creaBackup, elencaBackup, type InfoBackup, type TipoBackup } from '../backup/backup.ts'
import { sincronizzaFotoNelBackup } from '../backup/foto.ts'

interface UltimoBackup {
  nome: string
  creatoIl: string
  tipo: string
  esito: 'ok' | 'errore'
  messaggio?: string
}

const ORE = 3_600_000

export async function eseguiBackup(db: Db, cartella: string, tipo: TipoBackup, cartellaFoto?: string): Promise<InfoBackup> {
  try {
    const info = await creaBackup(db, cartella, tipo)
    if (cartellaFoto) await sincronizzaFotoNelBackup(cartellaFoto, cartella)
    scriviMeta(db, 'ultimo_backup', { nome: info.nome, creatoIl: info.creatoIl, tipo, esito: 'ok' } satisfies UltimoBackup)
    return info
  } catch (e) {
    try {
      scriviMeta(db, 'ultimo_backup', {
        nome: '',
        creatoIl: new Date().toISOString(),
        tipo,
        esito: 'errore',
        messaggio: (e as Error).message,
      } satisfies UltimoBackup)
    } catch {
      // database non scrivibile: l'errore originale è più importante
    }
    throw e
  }
}

export function registraEsportazione(db: Db, quando = new Date()): void {
  scriviMeta(db, 'ultima_esportazione', quando.toISOString())
}

export async function statoBackup(db: Db, cartella: string, adesso = Date.now()): Promise<StatoBackup> {
  const backup = await elencaBackup(cartella)
  const ultimo = leggiMeta<UltimoBackup>(db, 'ultimo_backup')
  const ultimaEsportazione = leggiMeta<string>(db, 'ultima_esportazione') ?? null
  const avvisi: string[] = []
  if (ultimo?.esito === 'errore') avvisi.push(`L'ultimo backup (${ultimo.tipo}) non è riuscito: ${ultimo.messaggio ?? 'errore'}`)
  const giornaliero = backup.find((b) => b.tipo === 'giornaliero')
  const eventi = Number(uno<{ n: number }>(db, 'SELECT count(*) AS n FROM eventi')?.n ?? 0)
  if (eventi > 0 && (!giornaliero || adesso - Date.parse(giornaliero.creatoIl) > 36 * ORE)) {
    avvisi.push('Nessun backup giornaliero riuscito nelle ultime 36 ore.')
  }
  if (eventi > 0 && (!ultimaEsportazione || adesso - Date.parse(ultimaEsportazione) > 14 * 24 * ORE)) {
    avvisi.push('Da più di 14 giorni non scarichi un\'esportazione su un altro dispositivo.')
  }
  return { backup, ultimaEsportazione, avvisi }
}
