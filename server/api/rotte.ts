// Registro di tutte le rotte API.
import type { FastifyInstance } from 'fastify'
import type { Contesto } from './aiuti.ts'
import { rotteBackup } from './backup.ts'
import { rotteEventi } from './eventi.ts'
import { rotteRicettario } from './ricettario.ts'
import { rotteSpesa } from './spesa.ts'
import { rotteFoto } from './foto.ts'
import { rotteSistema } from './sistema.ts'
import { rotteStampa } from './stampa.ts'

export function registraRotte(app: FastifyInstance, ctx: Contesto): void {
  rotteSistema(app, ctx)
  rotteBackup(app, ctx)
  rotteEventi(app, ctx)
  rotteRicettario(app, ctx)
  rotteSpesa(app, ctx)
  rotteFoto(app, ctx)
  rotteStampa(app, ctx)
}
