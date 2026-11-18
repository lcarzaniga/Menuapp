// Motore HTTP leggero con l'interfaccia di Fastify usata dall'app (SPEC §32.1): su Cloudflare
// Fastify non può girare (genera codice con `new Function`). Stesse rotte, stessi hook, stesso
// gestore d'errori; nei test gira anche su Node con tutta la suite del server.
//
// Riproduce di Fastify: hook onRequest/onSend/onRoute, decorazioni, analisi del corpo (JSON e
// parser per tipo, limiti), gestori d'errore e di 404, risposte (JSON, testo, byte), HEAD per
// ogni GET, `inject` per i test. Non serve altro: le rotte non usano schemi né plugin.

type Gestore = (req: RichiestaLeggera, reply: RispostaLeggera) => unknown
type Hook = (req: RichiestaLeggera, reply: RispostaLeggera, payload?: unknown) => unknown
type Parser = (req: RichiestaLeggera, corpo: Buffer, fatto: (errore: Error | null, valore?: unknown) => void) => void

interface Rotta {
  metodo: string
  url: string
  parti: string[]
  bodyLimit?: number
  gestore: Gestore
}

export interface RichiestaInterna {
  method: string
  /** Percorso con la query, come arriva al server. */
  url: string
  headers: Record<string, string>
  corpo: Uint8Array | null
  ip: string
}

export interface RispostaInterna {
  statusCode: number
  headers: Record<string, string | string[]>
  corpo: Uint8Array
}

/** Opzioni e risultato di `inject`, come light-my-request per le parti usate nei test. */
export interface OpzioniInject {
  method?: string
  url: string
  headers?: Record<string, string | undefined>
  payload?: string | Uint8Array | object
  remoteAddress?: string
}
export interface RisultatoInject {
  statusCode: number
  headers: Record<string, string | string[]>
  body: string
  payload: string
  rawPayload: Buffer
  json: () => any
}

class ErroreFastify extends Error {
  code: string
  statusCode: number
  constructor(code: string, statusCode: number, messaggio: string) {
    super(messaggio)
    this.code = code
    this.statusCode = statusCode
  }
}

export class RichiestaLeggera {
  method: string
  url: string
  headers: Record<string, string>
  ip: string
  params: Record<string, string> = {}
  query: Record<string, string | string[]> = {}
  body: unknown = undefined
  routeOptions: { url?: string } = {}
  log = { error: (e: unknown) => console.error(e), warn: (e: unknown) => console.warn(e) };
  // Decorazioni (es. `utente`) aggiunte con decorateRequest.
  [chiave: string]: unknown

  constructor(r: RichiestaInterna) {
    this.method = r.method
    this.url = r.url
    this.headers = r.headers
    this.ip = r.ip
    const q = r.url.indexOf('?')
    if (q >= 0) {
      for (const [k, v] of new URLSearchParams(r.url.slice(q + 1))) {
        const prima = this.query[k]
        this.query[k] = prima === undefined ? v : Array.isArray(prima) ? [...prima, v] : [prima, v]
      }
    }
  }
}

export class RispostaLeggera {
  statusCode = 200
  sent = false
  intestazioni: Record<string, string | string[]> = {}
  payload: unknown = undefined
  private readonly app: AppLeggera
  private readonly req: RichiestaLeggera

  constructor(app: AppLeggera, req: RichiestaLeggera) {
    this.app = app
    this.req = req
  }

  code(n: number): this {
    this.statusCode = n
    return this
  }
  status(n: number): this {
    return this.code(n)
  }
  header(nome: string, valore: string | number | string[]): this {
    this.intestazioni[nome.toLowerCase()] = Array.isArray(valore) ? valore : String(valore)
    return this
  }
  getHeader(nome: string): string | string[] | undefined {
    return this.intestazioni[nome.toLowerCase()]
  }
  type(tipo: string): this {
    return this.header('content-type', tipo)
  }
  send(payload?: unknown): this {
    if (this.sent) return this
    this.sent = true
    this.payload = payload
    return this
  }
  redirect(url: string, codice = 302): this {
    return this.code(codice).header('location', url).send()
  }
  /** Come Fastify: la richiesta passa al gestore del 404. */
  callNotFound(): void {
    this.app.nonTrovato(this.req, this)
  }
}

const STATO_TESTO: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No Content', 302: 'Found', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 413: 'Payload Too Large', 415: 'Unsupported Media Type', 422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server Error', 503: 'Service Unavailable' }

export class AppLeggera {
  private readonly rotteRegistrate: Rotta[] = []
  private readonly onRequest: Hook[] = []
  private readonly onSend: Hook[] = []
  private readonly onRoute: ((r: { method: string; url: string }) => void)[] = []
  private readonly decorazioniRichiesta: [string, unknown][] = []
  private readonly parser = new Map<string, { limite: number; fn: Parser }>()
  private gestoreErrori: ((e: Error, req: RichiestaLeggera, reply: RispostaLeggera) => unknown) | null = null
  private gestore404: Gestore | null = null
  private readonly limiteCorpo: number;
  [chiave: string]: unknown

  constructor(opzioni: { bodyLimit?: number } = {}) {
    this.limiteCorpo = opzioni.bodyLimit ?? 1024 * 1024
  }

  // ── Registrazione (interfaccia di Fastify) ──

  addHook(nome: 'onRequest' | 'onSend' | 'onRoute', fn: Hook | ((r: { method: string; url: string }) => void)): this {
    if (nome === 'onRequest') this.onRequest.push(fn as Hook)
    else if (nome === 'onSend') this.onSend.push(fn as Hook)
    else if (nome === 'onRoute') this.onRoute.push(fn as (r: { method: string; url: string }) => void)
    else throw new Error(`Hook non supportato dal motore leggero: ${String(nome)}`)
    return this
  }
  decorate(nome: string, valore: unknown): this {
    this[nome] = valore
    return this
  }
  decorateRequest(nome: string, valore: unknown): this {
    this.decorazioniRichiesta.push([nome, valore])
    return this
  }
  setErrorHandler(fn: (e: Error, req: RichiestaLeggera, reply: RispostaLeggera) => unknown): this {
    this.gestoreErrori = fn
    return this
  }
  setNotFoundHandler(fn: Gestore): this {
    this.gestore404 = fn
    return this
  }
  addContentTypeParser(tipi: string | string[], opzioni: { parseAs?: string; bodyLimit?: number }, fn: Parser): this {
    for (const t of [tipi].flat()) this.parser.set(t, { limite: opzioni.bodyLimit ?? this.limiteCorpo, fn })
    return this
  }

  private route(metodo: string, url: string, a: Gestore | { bodyLimit?: number }, b?: Gestore): this {
    const gestore = (typeof a === 'function' ? a : b) as Gestore
    const opzioni = typeof a === 'function' ? {} : a
    this.rotteRegistrate.push({ metodo, url, parti: url.split('/'), bodyLimit: opzioni.bodyLimit, gestore })
    for (const fn of this.onRoute) fn({ method: metodo, url })
    return this
  }
  get(url: string, a: Gestore | object, b?: Gestore) {
    return this.route('GET', url, a as Gestore, b)
  }
  post(url: string, a: Gestore | object, b?: Gestore) {
    return this.route('POST', url, a as Gestore, b)
  }
  put(url: string, a: Gestore | object, b?: Gestore) {
    return this.route('PUT', url, a as Gestore, b)
  }
  patch(url: string, a: Gestore | object, b?: Gestore) {
    return this.route('PATCH', url, a as Gestore, b)
  }
  delete(url: string, a: Gestore | object, b?: Gestore) {
    return this.route('DELETE', url, a as Gestore, b)
  }
  async register(): Promise<void> {
    throw new Error('Plugin non supportati dal motore leggero')
  }
  async ready(): Promise<void> {}
  async close(): Promise<void> {}

  // ── Esecuzione ──

  private trova(metodo: string, percorso: string): { rotta: Rotta; params: Record<string, string> } | null {
    const parti = percorso.split('/')
    const cercato = metodo === 'HEAD' ? 'GET' : metodo
    for (const r of this.rotteRegistrate) {
      if (r.metodo !== cercato || r.parti.length !== parti.length) continue
      const params: Record<string, string> = {}
      let ok = true
      for (let i = 0; i < parti.length && ok; i++) {
        const atteso = r.parti[i]!
        if (atteso.startsWith(':')) {
          if (!parti[i]) ok = false
          else params[atteso.slice(1)] = decodeURIComponent(parti[i]!)
        } else ok = atteso === parti[i]
      }
      if (ok) return { rotta: r, params }
    }
    return null
  }

  /** Gestore del 404 (anche da `callNotFound`). */
  nonTrovato(req: RichiestaLeggera, reply: RispostaLeggera): void {
    if (this.gestore404) void this.gestore404(req, reply)
    else reply.code(404).send({ message: `Route ${req.method}:${req.url} not found`, error: 'Not Found', statusCode: 404 })
  }

  private analizzaCorpo(req: RichiestaLeggera, corpo: Uint8Array | null, limiteRotta?: number): unknown {
    if (req.method === 'GET' || req.method === 'HEAD' || corpo === null) return undefined
    const tipo = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase()
    if (corpo.length === 0 && !tipo) return undefined
    if (tipo === 'application/json') {
      if (corpo.length > (limiteRotta ?? this.limiteCorpo)) throw new ErroreFastify('FST_ERR_CTP_BODY_TOO_LARGE', 413, 'Request body is too large')
      const testo = new TextDecoder().decode(corpo)
      if (testo === '') throw new ErroreFastify('FST_ERR_CTP_EMPTY_JSON_BODY', 400, "Body cannot be empty when content-type is set to 'application/json'")
      try {
        return JSON.parse(testo)
      } catch {
        throw new ErroreFastify('FST_ERR_CTP_INVALID_JSON_BODY', 400, 'Body is not valid JSON')
      }
    }
    const p = this.parser.get(tipo)
    if (!p) throw new ErroreFastify('FST_ERR_CTP_INVALID_MEDIA_TYPE', 415, `Unsupported Media Type: ${tipo}`)
    if (corpo.length > (limiteRotta ?? p.limite)) throw new ErroreFastify('FST_ERR_CTP_BODY_TOO_LARGE', 413, 'Request body is too large')
    let esito: { errore: Error | null; valore?: unknown } | null = null
    p.fn(req, Buffer.from(corpo.buffer, corpo.byteOffset, corpo.byteLength), (errore, valore) => {
      esito = { errore, valore }
    })
    const e = esito as { errore: Error | null; valore?: unknown } | null
    if (!e) throw new Error('Parser asincrono non supportato dal motore leggero')
    if (e.errore) throw e.errore
    return e.valore
  }

  private async gestisciErrore(e: unknown, req: RichiestaLeggera, reply: RispostaLeggera): Promise<void> {
    const errore = e instanceof Error ? e : new Error(String(e))
    reply.sent = false
    delete reply.intestazioni['content-type']
    delete reply.intestazioni['content-length']
    try {
      if (!this.gestoreErrori) throw errore
      const r = await this.gestoreErrori(errore, req, reply)
      if (!reply.sent && r !== undefined && r !== reply) reply.send(r)
    } catch (e2) {
      console.error(e2)
      reply.sent = false
      reply.code(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Errore interno' })
    }
  }

  /** Esegue una richiesta: hook, analisi del corpo, rotta, errori, serializzazione. */
  async esegui(r: RichiestaInterna): Promise<RispostaInterna> {
    const req = new RichiestaLeggera(r)
    for (const [nome, valore] of this.decorazioniRichiesta) req[nome] = valore
    const reply = new RispostaLeggera(this, req)
    const percorso = r.url.split('?')[0] ?? ''
    try {
      let interrotta = false
      for (const h of this.onRequest) {
        await h(req, reply)
        if (reply.sent) {
          interrotta = true
          break
        }
      }
      if (!interrotta) {
        const trovata = this.trova(r.method, percorso)
        if (!trovata) this.nonTrovato(req, reply)
        else {
          req.params = trovata.params
          req.routeOptions = { url: trovata.rotta.url }
          req.body = this.analizzaCorpo(req, r.corpo, trovata.rotta.bodyLimit)
          const valore = await trovata.rotta.gestore(req, reply)
          if (!reply.sent && valore !== reply) reply.send(valore)
        }
      }
    } catch (e) {
      await this.gestisciErrore(e, req, reply)
    }
    let payload = reply.payload
    for (const h of this.onSend) {
      const nuovo = await h(req, reply, payload)
      if (nuovo !== undefined) payload = nuovo
    }
    return this.serializza(req, reply, payload)
  }

  private serializza(req: RichiestaLeggera, reply: RispostaLeggera, payload: unknown): RispostaInterna {
    const headers = { ...reply.intestazioni }
    let corpo: Uint8Array
    if (payload === undefined || payload === null) corpo = new Uint8Array()
    else if (payload instanceof Uint8Array) {
      corpo = payload
      headers['content-type'] ??= 'application/octet-stream'
    } else if (typeof payload === 'string') {
      corpo = new TextEncoder().encode(payload)
      headers['content-type'] ??= 'text/plain; charset=utf-8'
    } else {
      corpo = new TextEncoder().encode(JSON.stringify(payload))
      headers['content-type'] ??= 'application/json; charset=utf-8'
    }
    if (reply.statusCode === 204 || reply.statusCode === 304) corpo = new Uint8Array()
    headers['content-length'] = String(corpo.length)
    return { statusCode: reply.statusCode, headers, corpo: req.method === 'HEAD' ? new Uint8Array() : corpo }
  }

  /** Richiesta finta per i test, come `fastify.inject`. */
  async inject(o: OpzioniInject): Promise<RisultatoInject> {
    const headers: Record<string, string> = { host: 'localhost:80', 'user-agent': 'lightMyRequest' }
    for (const [k, v] of Object.entries(o.headers ?? {})) if (v !== undefined) headers[k.toLowerCase()] = String(v)
    let corpo: Uint8Array | null = null
    if (o.payload !== undefined) {
      if (typeof o.payload === 'string') corpo = new TextEncoder().encode(o.payload)
      else if (o.payload instanceof Uint8Array) corpo = o.payload
      else {
        corpo = new TextEncoder().encode(JSON.stringify(o.payload))
        headers['content-type'] ??= 'application/json'
      }
      headers['content-length'] = String(corpo.length)
    }
    const r = await this.esegui({ method: (o.method ?? 'GET').toUpperCase(), url: o.url, headers, corpo, ip: o.remoteAddress ?? '127.0.0.1' })
    const rawPayload = Buffer.from(r.corpo)
    const body = rawPayload.toString('utf8')
    return { statusCode: r.statusCode, headers: r.headers, body, payload: body, rawPayload, json: () => JSON.parse(body) }
  }

  /** Richiesta del Worker: dalla Request del web alla Response. */
  async gestisci(richiesta: Request, ip: string): Promise<Response> {
    const url = new URL(richiesta.url)
    const headers: Record<string, string> = {}
    richiesta.headers.forEach((v, k) => {
      headers[k] = v
    })
    const corpo = richiesta.body ? new Uint8Array(await richiesta.arrayBuffer()) : null
    const r = await this.esegui({ method: richiesta.method, url: url.pathname + url.search, headers, corpo, ip })
    const h = new Headers()
    for (const [k, v] of Object.entries(r.headers)) for (const x of [v].flat()) h.append(k, x)
    const senzaCorpo = r.statusCode === 204 || r.statusCode === 304 || richiesta.method === 'HEAD'
    return new Response(senzaCorpo ? null : r.corpo, { status: r.statusCode, statusText: STATO_TESTO[r.statusCode] ?? '', headers: h })
  }
}
