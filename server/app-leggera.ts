// App sul motore leggero (Cloudflare e seconda passata dei test del server, SPEC §32.1).
import type { FastifyInstance } from 'fastify'
import type { Contesto } from './api/aiuti.ts'
import { configuraApp, LIMITE_CORPO, type TipoIngresso } from './api/applicazione.ts'
import { AppLeggera } from './motore-leggero.ts'

export function costruisciAppLeggera(ctx: Contesto, ingresso: TipoIngresso, rotteAggiuntive?: (app: FastifyInstance) => void): AppLeggera {
  const app = new AppLeggera({ bodyLimit: LIMITE_CORPO })
  // Il motore leggero imita la parte di Fastify usata da configuraApp e dalle rotte.
  configuraApp(app as unknown as FastifyInstance, ctx, ingresso, rotteAggiuntive)
  return app
}
