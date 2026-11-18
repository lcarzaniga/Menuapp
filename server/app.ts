// Costruzione dell'app Fastify del server Debian, iniettabile nei test (SPEC §12.3, §12.7, §14.1).
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance } from 'fastify'
import { configuraApp, LIMITE_CORPO, type TipoIngresso } from './api/applicazione.ts'
import { rotteBackup, type ContestoServer } from './api/backup.ts'

export { hostLocale, type TipoIngresso } from './api/applicazione.ts'
export type { ContestoServer } from './api/backup.ts'

const NO_CACHE = /^\/(index\.html|sw\.js|registerSW\.js|manifest\.webmanifest|workbox-[^/]+\.js)?$/

export async function costruisciApp(ctx: ContestoServer, opzioni: { log?: boolean; lan?: boolean; ingresso?: TipoIngresso } = {}): Promise<FastifyInstance> {
  const ingresso: TipoIngresso = opzioni.ingresso ?? (opzioni.lan ? 'lan' : 'privato')
  const app = Fastify({
    logger: opzioni.log ? { level: 'warn' } : false,
    bodyLimit: LIMITE_CORPO,
    trustProxy: '127.0.0.1',
  })
  configuraApp(app, ctx, ingresso, (a) => rotteBackup(a, ctx))
  if (ctx.config.cartellaStatici && ingresso !== 'lan') {
    await app.register(fastifyStatic, {
      root: ctx.config.cartellaStatici,
      index: ['index.html'],
      wildcard: true,
      dotfiles: 'deny',
      cacheControl: false,
      setHeaders(reply, percorsoFile) {
        const relativo = percorsoFile.slice(ctx.config.cartellaStatici!.length).replaceAll('\\', '/')
        // File con hash nel nome: immutabili. Tutto il resto (index.html, sw.js, manifest,
        // icone) va riconvalidato a ogni richiesta, così gli aggiornamenti arrivano subito.
        const immutabile = relativo.startsWith('/assets/') && !NO_CACHE.test(relativo)
        reply.header('cache-control', immutabile ? 'public, max-age=31536000, immutable' : 'no-cache')
      },
    })
  }

  return app
}
