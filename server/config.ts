// Configurazione da variabili d'ambiente (SPEC §14.2).
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
})

export interface Config {
  host: string
  porta: number
  cartellaDati: string
  percorsoDb: string
  cartellaBackup: string
  cartellaStatici: string | null
  origini: string[]
  rilascio: string
  portaLan: number | null
  hostLan: string
}

export function leggiConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const r = Schema.safeParse(env)
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
    cartellaStatici: e.MENUAPP_STATICI ? resolve(e.MENUAPP_STATICI) : null,
    origini: e.MENUAPP_ORIGINI.split(',').map((s) => s.trim()).filter(Boolean),
    rilascio: e.MENUAPP_RILASCIO ?? 'sviluppo',
    portaLan: e.MENUAPP_PORTA_LAN ?? null,
    hostLan: e.MENUAPP_HOST_LAN,
  }
}
