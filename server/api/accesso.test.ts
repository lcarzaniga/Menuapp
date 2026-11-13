// Sicurezza dell'accesso (SPEC §19): inviti, attivazione dei dispositivi, sessioni, ingressi.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { esegui, uno } from '../db/connessione.ts'
import * as identita from '../servizi/identita.ts'
import { appDiProva, type AppDiProva, ID_AMMINISTRATORE, ORIGINE_PROVA } from '../prova.ts'

let t: AppDiProva
beforeEach(async () => {
  t = await appDiProva()
})
afterEach(() => t.chiudi())

const corpo = (r: { body: string }) => JSON.parse(r.body)
const P = '/api/v1'

/** Rotte senza sessione per definizione. */
const PUBBLICHE = new Set([`GET ${P}/salute`, `POST ${P}/accesso/richiesta`, `GET ${P}/accesso/richiesta`, `POST ${P}/accesso/completa`])

/** Ogni rotta API registrata, con parametri d'esempio. */
function rotteApi(a: AppDiProva) {
  return a.app.rotte
    .filter((r) => r.url.startsWith(`${P}/`))
    .map((r) => ({ ...r, percorso: r.url.replace(/:(\w+)/g, (_m, nome: string) => `prova-${nome}`) }))
}

function cookieDa(r: { headers: Record<string, unknown> }, nome: string): string | null {
  const intestazioni = [r.headers['set-cookie']].flat().filter(Boolean).map(String)
  const c = intestazioni.find((h) => h.startsWith(`${nome}=`))
  return c ? c.split(';')[0]!.slice(nome.length + 1) : null
}

/** Browser che apre un link d'invito: richiesta con il proprio cookie. */
async function apriInvito(token: string, dispositivo = 'Telefono di Anna') {
  const r = await t.anonimo.scrivi('POST', `${P}/accesso/richiesta`, { invito: token, dispositivo })
  return { r, segreto: cookieDa(r, '__Host-menuapp-richiesta') }
}
const conCookie = (cookie: string, metodo: 'GET' | 'POST', url: string) =>
  t.inietta({ method: metodo, url, headers: { cookie, origin: ORIGINE_PROVA, ...(metodo === 'POST' ? { 'content-type': 'application/json' } : {}) }, payload: metodo === 'POST' ? '{}' : undefined })

describe('accesso senza sessione', () => {
  it('ogni rotta API non pubblica risponde 401 senza cookie, anche in lettura', async () => {
    const rotte = rotteApi(t).filter((r) => !PUBBLICHE.has(`${r.metodo} ${r.url}`))
    expect(rotte.length).toBeGreaterThan(80)
    for (const r of rotte) {
      const risposta = await t.app.inject({
        method: r.metodo as 'GET',
        url: r.percorso,
        headers: { origin: ORIGINE_PROVA, 'content-type': 'application/json' },
        payload: r.metodo === 'GET' || r.metodo === 'DELETE' ? undefined : '{}',
      })
      expect(risposta.statusCode, `${r.metodo} ${r.url}`).toBe(401)
      expect(corpo(risposta).errore.codice).toBe('non_autenticato')
    }
  })

  it('un cookie inventato o malformato vale come nessuna sessione', async () => {
    for (const cookie of ['__Host-menuapp-sessione=' + 'A'.repeat(43), '__Host-menuapp-sessione=../../x', 'menuapp-sessione=' + 'B'.repeat(43)]) {
      const r = await t.inietta({ method: 'GET', url: `${P}/eventi`, headers: { cookie } })
      expect(r.statusCode).toBe(401)
    }
  })

  it('la salute non rivela dati sull\'ingresso pubblico senza sessione', async () => {
    const pub = await appDiProva({ ingresso: 'pubblico' })
    try {
      expect(corpo(await pub.anonimo.leggi(`${P}/salute`))).toEqual({ ok: true, versioneApi: 1 })
      expect(corpo(await pub.leggi(`${P}/salute`))).toHaveProperty('rilascio')
    } finally {
      pub.chiudi()
    }
  })
})

describe('invito e attivazione del dispositivo', () => {
  it('flusso completo: invito → richiesta con codice → approvazione → sessione persistente', async () => {
    const anna = await t.scrivi('POST', `${P}/admin/utenti`, { id: 'u-anna', nome: 'Anna' })
    expect(anna.statusCode, anna.body).toBe(201)
    const invito = await t.scrivi('POST', `${P}/admin/utenti/u-anna/inviti`, {})
    expect(invito.statusCode).toBe(201)
    const { link, scadeIl, creatoIl } = corpo(invito)
    expect(scadeIl - creatoIl).toBe(24 * 3600_000)
    const token = link.split('/#/attiva/')[1]
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    // Sul server solo l'impronta del token.
    expect(uno(t.db, 'SELECT count(*) AS n FROM inviti WHERE token_hash = ?', token)).toEqual({ n: 0 })

    const { r, segreto } = await apriInvito(token)
    expect(r.statusCode, r.body).toBe(201)
    expect(corpo(r)).toMatchObject({ stato: 'in_attesa', utenteNome: 'Anna' })
    expect(corpo(r).codice).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/)
    const intestazione = [r.headers['set-cookie']].flat().map(String).find((h) => h.startsWith('__Host-menuapp-richiesta='))!
    for (const attributo of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) expect(intestazione).toContain(attributo)
    const cookieRichiesta = `__Host-menuapp-richiesta=${segreto}`

    // Prima dell'approvazione: in attesa, nessuna sessione.
    expect(corpo(await conCookie(cookieRichiesta, 'GET', `${P}/accesso/richiesta`)).stato).toBe('in_attesa')
    expect((await conCookie(cookieRichiesta, 'POST', `${P}/accesso/completa`)).statusCode).toBe(404)

    const richieste = corpo(await t.leggi(`${P}/admin/richieste`))
    expect(richieste).toHaveLength(1)
    expect(richieste[0]).toMatchObject({ utenteNome: 'Anna', dispositivo: 'Telefono di Anna', codice: corpo(r).codice })
    expect((await t.scrivi('POST', `${P}/richieste/${richieste[0].id}/approva`, {})).statusCode).toBe(200)

    expect(corpo(await conCookie(cookieRichiesta, 'GET', `${P}/accesso/richiesta`)).stato).toBe('approvata')
    const completa = await conCookie(cookieRichiesta, 'POST', `${P}/accesso/completa`)
    expect(completa.statusCode).toBe(200)
    const sessione = cookieDa(completa, '__Host-menuapp-sessione')!
    const intSessione = [completa.headers['set-cookie']].flat().map(String).find((h) => h.startsWith('__Host-menuapp-sessione='))!
    for (const attributo of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=15552000']) expect(intSessione).toContain(attributo)

    const io = await t.inietta({ method: 'GET', url: `${P}/sessione`, headers: { cookie: `__Host-menuapp-sessione=${sessione}` } })
    expect(corpo(io)).toMatchObject({ utente: { nome: 'Anna', ruolo: 'utente' }, ingresso: 'privato' })
    // La sessione si ottiene una sola volta.
    expect((await conCookie(cookieRichiesta, 'POST', `${P}/accesso/completa`)).statusCode).toBe(404)
  })

  it('invito già usato, scaduto, annullato o inventato: nessuna richiesta', async () => {
    const anna = t.utente('Anna')
    const nuovo = () => identita.creaInvito(t.db, null, anna.id, 'https://x').link.split('/#/attiva/')[1]!

    const usato = nuovo()
    expect((await apriInvito(usato)).r.statusCode).toBe(201)
    const secondo = await apriInvito(usato)
    expect(secondo.r.statusCode).toBe(404)
    expect(corpo(secondo.r).errore.messaggio).toMatch(/già stato usato/)
    expect(secondo.segreto).toBeNull()

    const scaduto = nuovo()
    esegui(t.db, 'UPDATE inviti SET scade_il = 1 WHERE usato_il IS NULL')
    expect(corpo((await apriInvito(scaduto)).r).errore.messaggio).toMatch(/scaduto/)

    const annullato = nuovo()
    const id = identita.elencaInviti(t.db).find((i) => i.stato === 'valido')!.id
    expect((await t.scrivi('DELETE', `${P}/admin/inviti/${id}`)).statusCode).toBe(204)
    expect(corpo((await apriInvito(annullato)).r).errore.messaggio).toMatch(/annullato/)

    expect(corpo((await apriInvito('x'.repeat(43))).r).errore.messaggio).toMatch(/non valido/)
  })

  it('tentativi ripetuti dallo stesso indirizzo: 429', async () => {
    const esiti = []
    for (let i = 0; i < 12; i++) esiti.push((await apriInvito(`${'y'.repeat(40)}${i.toString().padStart(3, '0')}`)).r.statusCode)
    expect(esiti.slice(0, 10).every((s) => s === 404)).toBe(true)
    expect(esiti.slice(10)).toEqual([429, 429])
  })

  it('chi ha solo il link non ottiene la sessione approvata per un altro browser', async () => {
    const anna = t.utente('Anna')
    const token = identita.creaInvito(t.db, null, anna.id, 'https://x').link.split('/#/attiva/')[1]!
    const { segreto } = await apriInvito(token)
    const richiesta = identita.richiesteInAttesa(t.db, null).find((r) => r.utenteId === anna.id)!
    identita.decidiRichiesta(t.db, null, richiesta.id, 'approva')
    // Un altro browser: stesso link (già consumato), nessun cookie della richiesta.
    expect((await apriInvito(token)).r.statusCode).toBe(404)
    expect((await t.anonimo.scrivi('POST', `${P}/accesso/completa`, {})).statusCode).toBe(404)
    expect((await conCookie(`__Host-menuapp-richiesta=${'z'.repeat(43)}`, 'POST', `${P}/accesso/completa`)).statusCode).toBe(404)
    // Il browser giusto sì.
    expect((await conCookie(`__Host-menuapp-richiesta=${segreto}`, 'POST', `${P}/accesso/completa`)).statusCode).toBe(200)
  })

  it('richiesta rifiutata: nessuna sessione', async () => {
    const anna = t.utente('Anna')
    const token = identita.creaInvito(t.db, null, anna.id, 'https://x').link.split('/#/attiva/')[1]!
    const { segreto } = await apriInvito(token)
    const id = identita.richiesteInAttesa(t.db, null)[0]!.id
    expect((await t.scrivi('POST', `${P}/richieste/${id}/rifiuta`, {})).statusCode).toBe(200)
    const cookie = `__Host-menuapp-richiesta=${segreto}`
    expect(corpo(await conCookie(cookie, 'GET', `${P}/accesso/richiesta`)).stato).toBe('rifiutata')
    expect((await conCookie(cookie, 'POST', `${P}/accesso/completa`)).statusCode).toBe(404)
    // Non si approva dopo il rifiuto.
    expect((await t.scrivi('POST', `${P}/richieste/${id}/approva`, {})).statusCode).toBe(422)
  })

  it('nuovo dispositivo: l\'utente crea il proprio link e approva da un dispositivo già autorizzato', async () => {
    const anna = t.utente('Anna')
    const bruno = t.utente('Bruno')
    const invito = await anna.scrivi('POST', `${P}/account/inviti`, {})
    expect(invito.statusCode).toBe(201)
    const { segreto } = await apriInvito(corpo(invito).link.split('/#/attiva/')[1])
    const [richiesta] = corpo(await anna.leggi(`${P}/account/richieste`))
    expect(richiesta.utenteNome).toBe('Anna')
    // Bruno non vede né approva le richieste di Anna.
    expect(corpo(await bruno.leggi(`${P}/account/richieste`))).toEqual([])
    expect((await bruno.scrivi('POST', `${P}/richieste/${richiesta.id}/approva`, {})).statusCode).toBe(404)
    expect((await anna.scrivi('POST', `${P}/richieste/${richiesta.id}/approva`, {})).statusCode).toBe(200)
    expect((await conCookie(`__Host-menuapp-richiesta=${segreto}`, 'POST', `${P}/accesso/completa`)).statusCode).toBe(200)
    expect(corpo(await anna.leggi(`${P}/account/sessioni`))).toHaveLength(2)
  })

  it('un utente non crea inviti per altri e non vede le funzioni di amministrazione', async () => {
    const anna = t.utente('Anna')
    for (const [metodo, url] of [
      ['GET', `${P}/admin/utenti`],
      ['POST', `${P}/admin/utenti/${ID_AMMINISTRATORE}/inviti`],
      ['GET', `${P}/admin/sessioni`],
      ['GET', `${P}/admin/richieste`],
      ['GET', `${P}/admin/inviti`],
    ] as const) {
      const r = metodo === 'GET' ? await anna.leggi(url) : await anna.scrivi(metodo, url, {})
      expect(r.statusCode, url).toBe(403)
    }
    expect((await anna.scrivi('POST', `${P}/admin/utenti`, { id: 'u-x', nome: 'Intruso', ruolo: 'amministratore' })).statusCode).toBe(403)
  })
})

describe('sessioni e revoca', () => {
  it('revoca di una singola sessione: quel dispositivo perde subito l\'accesso, gli altri no', async () => {
    const anna = t.utente('Anna')
    const tablet = t.sessione(anna.id)
    const sessioni = corpo(await anna.leggi(`${P}/account/sessioni`))
    expect(sessioni).toHaveLength(2)
    const altra = sessioni.find((s: { corrente: boolean }) => !s.corrente)
    expect((await anna.scrivi('DELETE', `${P}/account/sessioni/${altra.id}`)).statusCode).toBe(204)
    expect((await tablet.leggi(`${P}/eventi`)).statusCode).toBe(401)
    expect((await anna.leggi(`${P}/eventi`)).statusCode).toBe(200)
  })

  it('un utente non revoca le sessioni di altri; l\'amministratore sì', async () => {
    const anna = t.utente('Anna')
    const bruno = t.utente('Bruno')
    const [sb] = corpo(await bruno.leggi(`${P}/account/sessioni`))
    expect((await anna.scrivi('DELETE', `${P}/account/sessioni/${sb.id}`)).statusCode).toBe(404)
    expect((await bruno.leggi(`${P}/eventi`)).statusCode).toBe(200)
    expect((await t.scrivi('DELETE', `${P}/admin/sessioni/${sb.id}`)).statusCode).toBe(204)
    expect((await bruno.leggi(`${P}/eventi`)).statusCode).toBe(401)
  })

  it('uscita: la sessione corrente è revocata e il cookie cancellato', async () => {
    const anna = t.utente('Anna')
    const r = await anna.scrivi('POST', `${P}/sessione/esci`, {})
    expect(r.statusCode).toBe(200)
    expect(String([r.headers['set-cookie']].flat()[0])).toContain('Max-Age=0')
    expect((await anna.leggi(`${P}/sessione`)).statusCode).toBe(401)
  })

  it('utente sospeso: tutte le sessioni smettono di funzionare e gli inviti sono annullati', async () => {
    const anna = t.utente('Anna')
    const invito = corpo(await anna.scrivi('POST', `${P}/account/inviti`, {}))
    const u = corpo(await t.leggi(`${P}/admin/utenti`)).find((x: { nome: string }) => x.nome === 'Anna')
    const r = await t.scrivi('PUT', `${P}/admin/utenti/${anna.id}`, { nome: 'Anna', ruolo: 'utente', stato: 'sospeso', versione: u.versione })
    expect(r.statusCode, r.body).toBe(200)
    expect((await anna.leggi(`${P}/eventi`)).statusCode).toBe(401)
    expect((await apriInvito(invito.link.split('/#/attiva/')[1])).r.statusCode).toBe(404)
  })

  it('sessione scaduta: 401', async () => {
    const anna = t.utente('Anna')
    esegui(t.db, 'UPDATE sessioni SET scade_il = 1 WHERE utente_id = ?', anna.id)
    expect((await anna.leggi(`${P}/eventi`)).statusCode).toBe(401)
  })

  it('serve sempre un amministratore attivo; nessuno sospende sé stesso', async () => {
    const u = corpo(await t.leggi(`${P}/admin/utenti`))[0]
    const r = await t.scrivi('PUT', `${P}/admin/utenti/${ID_AMMINISTRATORE}`, { nome: u.nome, ruolo: 'utente', stato: 'attivo', versione: u.versione })
    expect(corpo(r).errore.dettagli.regola).toBe('ultimo_amministratore')
  })
})

describe('ingressi', () => {
  it('dall\'ingresso pubblico le funzioni di sistema non esistono, nemmeno per l\'amministratore', async () => {
    const pub = await appDiProva({ ingresso: 'pubblico' })
    try {
      const inesistente = corpo(await pub.leggi(`${P}/nessuna-rotta`))
      for (const r of rotteApi(pub).filter((x) => /^\/api\/v1\/(admin\/|backup|esportazione$|ripristino\/)|\/foto\/:id\/file$/.test(x.url))) {
        const risposta = await pub.inietta({
          method: r.metodo as 'GET',
          url: r.percorso,
          headers: { origin: ORIGINE_PROVA, 'content-type': 'application/json' },
          payload: r.metodo === 'GET' || r.metodo === 'DELETE' ? undefined : '{}',
        })
        expect(risposta.statusCode, `${r.metodo} ${r.url}`).toBe(404)
        expect(corpo(risposta).errore.codice).toBe(inesistente.errore.codice)
      }
      // Le funzioni dell'utente invece ci sono.
      expect((await pub.leggi(`${P}/eventi`)).statusCode).toBe(200)
      expect((await pub.leggi(`${P}/account/sessioni`)).statusCode).toBe(200)
    } finally {
      pub.chiudi()
    }
  })

  it('backup, esportazione completa e ripristino: solo amministratore dall\'ingresso privato', async () => {
    const anna = t.utente('Anna')
    for (const url of [`${P}/backup`, `${P}/esportazione`]) {
      expect((await anna.leggi(url)).statusCode, url).toBe(403)
      expect((await t.leggi(url)).statusCode, url).toBe(200)
    }
    expect((await anna.scrivi('POST', `${P}/backup`, {})).statusCode).toBe(403)
    expect((await anna.scrivi('POST', `${P}/ripristino/verifica`, { origine: 'backup', nome: 'x.db' })).statusCode).toBe(403)
    expect((await anna.scrivi('POST', `${P}/ripristino/esegui`, { token: 'x' })).statusCode).toBe(403)
  })

  it('richieste marcate dal Funnel rifiutate sull\'ingresso privato', async () => {
    const r = await t.inietta({ method: 'GET', url: `${P}/eventi`, headers: { 'tailscale-funnel-request': '?1' } })
    expect(r.statusCode).toBe(403)
  })
})
