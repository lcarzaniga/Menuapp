// Registro di tutte le rotte API.
import type { FastifyInstance } from 'fastify'
import type { Contesto } from './aiuti.ts'
import { rotteBackup } from './backup.ts'
import { rotteEventi } from './eventi.ts'
import { rotteSistema } from './sistema.ts'

export function registraRotte(app: FastifyInstance, ctx: Contesto): void {
  rotteSistema(app, ctx)
  rotteBackup(app, ctx)
  rotteEventi(app, ctx)
}
