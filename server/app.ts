// Costruzione dell'app Fastify, iniettabile nei test (SPEC §12.3, §12.7, §14.1).
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import { PREFISSO_API, type RispostaErrore } from '../src/contratto/comune.ts'
import { revisione } from './db/repo/meta.ts'
import { type Contesto } from './api/aiuti.ts'
import { registraRotte } from './api/rotte.ts'
import { ErroreApi } from './servizi/errori.ts'
import { LIMITE_BYTE_FOTO, TIPI_FOTO } from '../src/contratto/foto.ts'

const RE_ROTTE_FOTO = /^\/api\/v1\/(piatti\/[^/]+\/foto|foto\/[^/]+\/file)$/

const METODI_SCRITTURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const LIMITE_CORPO = 1024 * 1024
export const LIMITE_CORPO_RIPRISTINO = 50 * 1024 * 1024

const NO_CACHE = /^\/(index\.html|sw\.js|registerSW\.js|manifest\.webmanifest|workbox-[^/]+\.js)?$/

const SICUREZZA: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), screen-wake-lock=(self)',
  'content-security-policy':
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
}

function corpoErrore(codice: RispostaErrore['errore']['codice'], messaggio: string, dettagli?: unknown): RispostaErrore {
  return { errore: dettagli === undefined ? { codice, messaggio } : { codice, messaggio, dettagli } }
}

/** Nomi host ammessi sull'ascolto di rete locale: IP privati e nomi della macchina, mai domini esterni (DNS rebinding). */
export function hostLocale(host: string | undefined): boolean {
  if (!host) return false
  const nome = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase()
  if (nome === 'localhost' || nome === 'loris-srv01' || nome.endsWith('.local') || nome.endsWith('.lan') || nome.endsWith('.home')) return true
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(nome)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)
}

export async function costruisciApp(ctx: Contesto, opzioni: { log?: boolean; lan?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opzioni.log ? { level: 'warn' } : false,
    bodyLimit: LIMITE_CORPO,
    trustProxy: '127.0.0.1',
  })

  // Protezione dalle richieste di altri siti (SPEC §12.7) e manutenzione.
  app.addHook('onRequest', async (req, reply) => {
    const percorso = req.url.split('?')[0] ?? ''
    if (opzioni.lan && !hostLocale(req.headers.host)) {
      return reply.code(403).send(corpoErrore('origine_non_ammessa', 'Indirizzo non ammesso sulla rete locale'))
    }
    if (!percorso.startsWith('/api/')) return
    if (ctx.stato.manutenzione && percorso !== `${PREFISSO_API}/salute`) {
      return reply.code(503).send(corpoErrore('servizio_non_pronto', 'Operazione di manutenzione in corso, riprova tra poco'))
    }
    if (!METODI_SCRITTURA.has(req.method)) return
    const origine = req.headers.origin
    // Sulla rete locale l'origine ammessa è quella dell'indirizzo usato (già verificato come locale).
    const propria = opzioni.lan && origine === `http://${req.headers.host}`
    if (!origine || (!ctx.config.origini.includes(origine) && !propria)) {
      return reply.code(403).send(corpoErrore('origine_non_ammessa', 'Richiesta da un\'origine non ammessa'))
    }
    if (req.method !== 'DELETE' || req.headers['content-length']) {
      const tipo = (req.headers['content-type'] ?? '').split(';')[0]?.trim()
      const immagine = RE_ROTTE_FOTO.test(percorso) && (TIPI_FOTO as readonly string[]).includes(tipo ?? '')
      if (tipo !== 'application/json' && !immagine) {
        return reply.code(415).send(corpoErrore('tipo_non_supportato', 'Le scritture richiedono un corpo JSON'))
      }
    }
  })

  app.addHook('onSend', async (req, reply, payload) => {
    for (const [k, v] of Object.entries(SICUREZZA)) reply.header(k, v)
    const percorso = req.url.split('?')[0] ?? ''
    if (percorso.startsWith('/api/')) {
      reply.header('cache-control', 'no-store')
      if (METODI_SCRITTURA.has(req.method) && ctx.db.isOpen) reply.header('x-revisione', String(revisione(ctx.db)))
    }
    return payload
  })

  app.setErrorHandler((errore: FastifyError | ErroreApi | Error, req, reply) => {
    if (errore instanceof ErroreApi) {
      return reply.code(errore.stato).send(corpoErrore(errore.codice, errore.message, errore.dettagli))
    }
    const f = errore as FastifyError
    if (f.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      return reply.code(415).send(corpoErrore('tipo_non_supportato', 'Tipo di contenuto non supportato'))
    }
    if (f.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send(corpoErrore('troppo_grande', 'Richiesta troppo grande'))
    }
    if (f.statusCode && f.statusCode >= 400 && f.statusCode < 500) {
      return reply.code(400).send(corpoErrore('richiesta_non_valida', f.message))
    }
    req.log.error(errore)
    return reply.code(500).send(corpoErrore('errore_interno', 'Errore interno del server'))
  })

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send(corpoErrore('non_trovato', `Risorsa non trovata: ${req.method} ${req.url.split('?')[0]}`))
  })

  app.addContentTypeParser([...TIPI_FOTO], { parseAs: 'buffer', bodyLimit: LIMITE_BYTE_FOTO }, (_req, corpo, fatto) => fatto(null, corpo))
  registraRotte(app, ctx)

  if (ctx.config.cartellaStatici) {
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
