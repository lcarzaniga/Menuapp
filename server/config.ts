// Configurazione da variabili d'ambiente (SPEC §14.2).
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

const Schema = z.object({
  MENUAPP_HOST: z.string().default('127.0.0.1'),
  MENUAPP_PORTA: z.coerce.number().int().min(1).max(65535).default(9871),
  MENUAPP_DATI: z.string().default('./dati-sviluppo'),
  MENUAPP_STATICI: z.string().optional(),
  MENUAPP_ORIGINI: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173,https://loris-srv01.dala-tortoise.ts.net:8443'),
  MENUAPP_RILASCIO: z.string().optional(),
  /** Accesso dalla rete di casa in HTTP, senza Tailscale (es. Echo Show). Assente = disattivato. */
  MENUAPP_PORTA_LAN: z.coerce.number().int().min(1).max(65535).optional(),
  MENUAPP_HOST_LAN: z.string().default('0.0.0.0'),
  /** Indirizzo HTTPS esterno (Tailscale Funnel) usato nei link d'invito. Assente = nessun accesso esterno. */
  MENUAPP_URL_PUBBLICO: z.url({ protocol: /^https$/ }).optional(),
  /** Indirizzo privato (Tailscale Serve): link d'invito quando manca quello pubblico. */
  MENUAPP_URL_PRIVATO: z.url({ protocol: /^https?$/ }).optional(),
  /** Ascolto su loopback dedicato all'ingresso pubblico (Funnel): senza funzioni di sistema. */
  MENUAPP_PORTA_PUBBLICA: z.coerce.number().int().min(1).max(65535).optional(),
  /** Cookie con attributo Secure (sempre in produzione; i browser lo accettano anche su localhost). */
  MENUAPP_COOKIE_SICURO: z.enum(['0', '1']).default('1'),
})

export interface Config {
  host: string
  porta: number
  cartellaDati: string
  percorsoDb: string
  cartellaBackup: string
  cartellaFoto: string
  cartellaStatici: string | null
  origini: string[]
  rilascio: string
  portaLan: number | null
  hostLan: string
  urlPubblico: string | null
  urlPrivato: string | null
  portaPubblica: number | null
  cookieSicuro: boolean
}

/**
 * Impostazioni facoltative in `<dati>/server.json` (stesse chiavi delle variabili
 * d'ambiente): permettono di attivare l'ingresso pubblico senza toccare il servizio systemd.
 * Le variabili d'ambiente hanno la precedenza.
 */
export function leggiFileConfig(cartellaDati: string): Record<string, string> {
  const percorso = resolve(cartellaDati, 'server.json')
  if (!existsSync(percorso)) return {}
  const dati = JSON.parse(readFileSync(percorso, 'utf8')) as Record<string, unknown>
  return Object.fromEntries(Object.entries(dati).filter(([k]) => k.startsWith('MENUAPP_') && k !== 'MENUAPP_DATI').map(([k, v]) => [k, String(v)]))
}

const origine = (url: string) => new URL(url).origin

export function leggiConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const dati = env.MENUAPP_DATI ?? './dati-sviluppo'
  const r = Schema.safeParse({ ...leggiFileConfig(resolve(dati)), ...env })
  if (!r.success) {
    throw new Error(`Configurazione non valida: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
  }
  const e = r.data
  const cartellaDati = resolve(e.MENUAPP_DATI)
  return {
    host: e.MENUAPP_HOST,
    porta: e.MENUAPP_PORTA,
    cartellaDati,
    percorsoDb: resolve(cartellaDati, 'menuapp.db'),
    cartellaBackup: resolve(cartellaDati, 'backup'),
    cartellaFoto: resolve(cartellaDati, 'foto'),
    cartellaStatici: e.MENUAPP_STATICI ? resolve(e.MENUAPP_STATICI) : null,
    origini: [
      ...new Set([
        ...e.MENUAPP_ORIGINI.split(',').map((s) => s.trim()).filter(Boolean),
        ...[e.MENUAPP_URL_PUBBLICO, e.MENUAPP_URL_PRIVATO].filter((u) => u !== undefined).map(origine),
      ]),
    ],
    rilascio: e.MENUAPP_RILASCIO ?? 'sviluppo',
    portaLan: e.MENUAPP_PORTA_LAN ?? null,
    hostLan: e.MENUAPP_HOST_LAN,
    urlPubblico: e.MENUAPP_URL_PUBBLICO ?? null,
    urlPrivato: e.MENUAPP_URL_PRIVATO ?? null,
    portaPubblica: e.MENUAPP_PORTA_PUBBLICA ?? null,
    cookieSicuro: e.MENUAPP_COOKIE_SICURO === '1',
  }
}
