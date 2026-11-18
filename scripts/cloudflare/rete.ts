// Chiamata alla console del Worker dagli script (SPEC §32.4). Per gli indirizzi pubblici il nome
// si risolve col DNS di Cloudflare: quello di casa può ricordare per un po' che un nome nuovo
// (app.ricettedifamiglia.online) non esisteva.
import { promises as dns } from 'node:dns'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { request } from 'node:https'

export interface RispostaConsole {
  stato: number
  testo?: string
  dati?: unknown
  errore?: { messaggio: string }
}

/** Segreto della console: dall'ambiente o da ~/.config/menuapp/cloudflare.env (console.sh attiva). */
export function codiceConsole(): string | undefined {
  if (process.env.MENUAPP_CODICE_CONSOLE) return process.env.MENUAPP_CODICE_CONSOLE
  const file = join(homedir(), '.config/menuapp/cloudflare.env')
  if (!existsSync(file)) return undefined
  return /^MENUAPP_CODICE_CONSOLE=(.+)$/m.exec(readFileSync(file, 'utf8'))?.[1]?.trim()
}

const risolutore = new dns.Resolver()
risolutore.setServers(['1.1.1.1', '1.0.0.1'])

export async function chiamaConsole(url: string, codice: string, comando: string, argomenti: string[] = []): Promise<RispostaConsole> {
  const corpo = JSON.stringify({ comando, argomenti })
  const intestazioni = { authorization: `Bearer ${codice}`, 'content-type': 'application/json' }
  const indirizzo = new URL(`${url.replace(/\/+$/, '')}/api/v1/console`)
  if (indirizzo.protocol === 'http:') {
    const r = await fetch(indirizzo, { method: 'POST', headers: intestazioni, body: corpo })
    return { stato: r.status, ...((await r.json().catch(() => ({}))) as object) }
  }
  const [ip] = await risolutore.resolve4(indirizzo.hostname)
  if (!ip) throw new Error(`${indirizzo.hostname} non risolve nel DNS di Cloudflare`)
  return new Promise((ok, ko) => {
    const r = request(
      indirizzo,
      { method: 'POST', headers: intestazioni, lookup: (_h, opz, cb) => (opz.all ? cb(null, [{ address: ip, family: 4 }]) : cb(null, ip, 4)) },
      (risposta) => {
        let testo = ''
        risposta.setEncoding('utf8')
        risposta.on('data', (x: string) => (testo += x))
        risposta.on('end', () => {
          let json: object = {}
          try {
            json = JSON.parse(testo) as object
          } catch {
            // risposta non JSON: resta solo lo stato
          }
          ok({ stato: risposta.statusCode ?? 0, ...json })
        })
      },
    )
    r.on('error', ko)
    r.end(corpo)
  })
}
