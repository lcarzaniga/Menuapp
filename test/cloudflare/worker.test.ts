// Prove dell'installazione Cloudflare sul Worker in locale (wrangler dev: workerd, Durable
// Object SQLite, R2 simulato), SPEC §32.8: ciò che il server Debian non ha. Le regole comuni
// (permessi, Famiglie, versioni) le provano la suite del server sul motore leggero e la e2e.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appDiProva } from '../../server/prova.ts'

const PORTA = 4196
const ORIGINE = `http://127.0.0.1:${PORTA}`
const CODICE = 'codice-console-della-prova-cloudflare-0123456789'
const P = `${ORIGINE}/api/v1`
let wrangler: ChildProcess
let cartella: string

async function console_(comando: string, ...argomenti: string[]): Promise<{ stato: number; testo: string }> {
  const r = await fetch(`${P}/console`, { method: 'POST', headers: { authorization: `Bearer ${CODICE}`, 'content-type': 'application/json' }, body: JSON.stringify({ comando, argomenti }) })
  const c = (await r.json()) as { testo?: string; errore?: { messaggio: string } }
  return { stato: r.status, testo: c.testo ?? c.errore?.messaggio ?? '' }
}

class Browser {
  cookie = ''
  async chiama(metodo: string, url: string, corpo?: unknown, tipo = 'application/json', origine = ORIGINE): Promise<{ stato: number; corpo: any; risposta: Response }> {
    const binario = corpo instanceof Uint8Array
    const r = await fetch(`${P}${url}`, {
      method: metodo,
      headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(metodo === 'GET' ? {} : { origin: origine }), ...(corpo === undefined ? {} : { 'content-type': tipo }) },
      body: corpo === undefined ? undefined : binario ? corpo : JSON.stringify(corpo),
    })
    for (const c of r.headers.getSetCookie()) {
      const [coppia] = c.split(';')
      const [nome] = coppia!.split('=')
      this.cookie = [...this.cookie.split('; ').filter((x) => x && !x.startsWith(`${nome}=`)), coppia].join('; ')
    }
    const testo = r.headers.get('content-type')?.includes('json') ? await r.text() : null
    return { stato: r.status, corpo: testo ? JSON.parse(testo) : null, risposta: r }
  }
}

/** Dispositivo autorizzato come in produzione: invito, richiesta, approvazione, completamento. */
async function collega(link: string, approva: (codice: string) => Promise<void>): Promise<Browser> {
  const b = new Browser()
  const token = link.split('/#/attiva/')[1]!
  const r = await b.chiama('POST', '/accesso/richiesta', { invito: token, dispositivo: 'Prova' })
  expect(r.stato, JSON.stringify(r.corpo)).toBe(201)
  await approva(r.corpo.codice)
  expect((await b.chiama('POST', '/accesso/completa', {})).stato).toBe(200)
  return b
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 200 }, (_, i) => i % 256)])

beforeAll(async () => {
  cartella = mkdtempSync(join(tmpdir(), 'menuapp-cf-'))
  wrangler = spawn(
    process.execPath,
    ['node_modules/wrangler/bin/wrangler.js', 'dev', '--port', String(PORTA), '--ip', '127.0.0.1', '--local-upstream', `127.0.0.1:${PORTA}`, '--persist-to', cartella, '--test-scheduled', '--log-level', 'warn',
      '--var', `MENUAPP_URL_PUBBLICO:${ORIGINE}`, '--var', `MENUAPP_CODICE_CONSOLE:${CODICE}`],
    {
      stdio: ['ignore', openSync(join(cartella, 'wrangler.log'), 'w'), openSync(join(cartella, 'wrangler.log'), 'a')],
      detached: true,
      // Senza le variabili di vitest: wrangler le riconosce e cambia comportamento.
      env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITEST') && k !== 'NODE_ENV' && k !== 'TEST')),
    },
  )
  for (let i = 0; i < 120; i++) {
    if (await fetch(`${P}/salute`).then((r) => r.ok, () => false)) return
    await new Promise((ok) => setTimeout(ok, 500))
  }
  throw new Error(`wrangler dev non risponde (uscita ${wrangler.exitCode} ${wrangler.signalCode}):\n${readFileSync(join(cartella, 'wrangler.log'), 'utf8').slice(-2000)}`)
}, 90_000)

afterAll(() => {
  if (wrangler.pid) process.kill(-wrangler.pid, 'SIGKILL')
  rmSync(cartella, { recursive: true, force: true })
})

describe('installazione Cloudflare', () => {
  let loris: Browser
  let anna: Browser

  it('senza sessione: salute minima, dati 401, file dell\'app con le intestazioni di sicurezza', async () => {
    expect(await (await fetch(`${P}/salute`)).json()).toEqual({ ok: true, versioneApi: 1 })
    expect((await fetch(`${P}/eventi`)).status).toBe(401)
    const pagina = await fetch(`${ORIGINE}/`)
    expect(pagina.status).toBe(200)
    expect(pagina.headers.get('content-security-policy')).toContain("default-src 'self'")
    expect(pagina.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(pagina.headers.get('cache-control')).toBe('no-cache')
  })

  it('console: segreto obbligatorio; primo amministratore con invito e approvazione', async () => {
    const sbagliato = await fetch(`${P}/console`, { method: 'POST', headers: { authorization: 'Bearer altro' } })
    expect(sbagliato.status).toBe(401)
    // L'intestazione interna dal browser non vale: il Worker la sostituisce con il segreto vero.
    const finto = await fetch(`${P}/console`, { method: 'POST', headers: { authorization: 'Bearer abcdefghijklmnopqrstuvwxyz0123456789', 'x-menuapp-codice-console': 'abcdefghijklmnopqrstuvwxyz0123456789' } })
    expect(finto.status).toBe(401)
    // Le chiamate col codice giusto non consumano i tentativi (gli script ne fanno molte).
    for (let i = 0; i < 15; i++) expect((await console_('stato')).stato).toBe(200)
    expect((await fetch(`${P}/console`)).status).toBe(404)
    // Controllo della Famiglia d'origine dopo la migrazione 0016 (sola lettura).
    expect((await console_('origini')).testo).toMatch(/^Ricette: \d+; con la Famiglia d'origine: \d+; da indicare: 0\./)
    const invito = await console_('invito')
    expect(invito.testo).toContain('Invito per Loris')
    const link = /https?:\/\/\S+\/#\/attiva\/\S+/.exec(invito.testo)![0]
    loris = await collega(link, async (codice) => {
      expect((await console_('approva', codice)).testo).toContain('Approvata')
    })
    const s = await loris.chiama('GET', '/sessione')
    expect(s.corpo).toMatchObject({ utente: { nome: 'Loris', ruolo: 'amministratore' }, ingresso: 'unico' })
    expect(loris.cookie).toContain('__Host-menuapp-sessione=')
    // Link già usato: nessun'altra richiesta.
    expect((await new Browser().chiama('POST', '/accesso/richiesta', { invito: link.split('/#/attiva/')[1], dispositivo: 'X' })).stato).toBe(404)
  })

  it('amministrazione dall\'app per l\'amministratore; ripristino e backup su file assenti', async () => {
    expect((await loris.chiama('POST', '/admin/utenti', { id: 'u-anna', nome: 'Anna' })).stato).toBe(201)
    const invito = (await loris.chiama('POST', '/admin/utenti/u-anna/inviti', {})).corpo
    anna = await collega(invito.link, async (codice) => {
      const r = (await loris.chiama('GET', '/admin/richieste')).corpo.find((x: { codice: string }) => x.codice === codice)
      expect((await loris.chiama('POST', `/richieste/${r.id}/approva`, {})).stato).toBe(200)
    })
    expect((await anna.chiama('GET', '/admin/utenti')).stato).toBe(403)
    expect((await anna.chiama('GET', '/backup')).stato).toBe(403)
    for (const url of ['/ripristino/verifica', '/ripristino/esegui']) expect((await loris.chiama('POST', url, {})).stato, url).toBe(404)
    // Scritture da un'altra origine rifiutate anche con una sessione valida.
    expect((await loris.chiama('POST', '/piatti', { id: 'x', nome: 'X' }, 'application/json', 'https://altro.example')).stato).toBe(403)
  })

  it('permessi e Famiglie isolati come sul server', async () => {
    expect((await loris.chiama('POST', '/eventi', { id: 'ev', nome: 'Natale', data: '2026-12-25', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 4, bambini: 0, note: '' })).stato).toBe(201)
    expect((await anna.chiama('GET', '/eventi/ev')).stato).toBe(404)
    expect((await anna.chiama('POST', '/famiglie', { id: 'f-anna', nome: 'Casa di Anna' })).stato).toBe(201)
    expect((await loris.chiama('GET', '/gruppi/f-anna/bacheca')).stato).toBe(404)
  })

  it('foto in R2: caricamento, lettura con permesso, copia della ricetta, eliminazione nel cestino', async () => {
    expect((await loris.chiama('POST', '/piatti', { id: 'p1', nome: 'Tiramisù' })).stato).toBe(201)
    const f = await loris.chiama('POST', '/piatti/p1/foto?id=f1', JPEG, 'image/jpeg')
    expect(f.stato, JSON.stringify(f.corpo)).toBe(201)
    const file = await loris.chiama('GET', '/foto/f1')
    expect(new Uint8Array(await file.risposta.arrayBuffer())).toEqual(JPEG)
    // Ricetta di famiglia: Anna la legge e la copia; la copia ha un file proprio.
    const copia = await anna.chiama('POST', '/piatti/p1/copia', { id: 'p-anna' })
    expect(copia.stato, JSON.stringify(copia.corpo)).toBe(201)
    const fotoCopia = (await anna.chiama('GET', '/piatti/p-anna')).corpo.foto[0]
    expect(fotoCopia.id).not.toBe('f1')
    expect(new Uint8Array(await (await anna.chiama('GET', `/foto/${fotoCopia.id}`)).risposta.arrayBuffer())).toEqual(JPEG)
    // Ricetta privata: Anna non vede più le foto dell'originale.
    const p = (await loris.chiama('GET', '/piatti/p1')).corpo
    expect((await loris.chiama('PUT', '/piatti/p1/visibilita', { visibilita: 'privata', versione: p.versione })).stato).toBeLessThan(300)
    expect((await anna.chiama('GET', '/foto/f1')).stato).toBe(404)
  })

  it('foto proposte in R2 (SPEC §41): fuori dalla galleria, visibili a proprietario e autore, il rifiuto cancella il file', async () => {
    expect((await loris.chiama('POST', '/piatti', { id: 'p2', nome: 'Crostata', note: '' })).stato).toBe(201)
    const p = (await anna.chiama('GET', '/piatti/p2')).corpo
    const { id: _i, versione, creatoIl: _c, aggiornatoIl: _a, ...resto } = p
    const contenuto = Object.fromEntries(['nome', 'portataSuggerita', 'porzioniBase', 'tempoPreparazioneMin', 'tempoCotturaMin', 'tempoRiposoMin', 'attrezzature', 'procedimento', 'note', 'fonte', 'ingredienti'].map((k) => [k, (resto as Record<string, unknown>)[k]]))
    const proposta = await anna.chiama('POST', '/piatti/p2/proposte', { id: 'pr1', versioneBase: versione, contenuto: { ...contenuto, note: 'Con marmellata di albicocche' }, motivazione: '', conFoto: true })
    expect(proposta.stato, JSON.stringify(proposta.corpo)).toBe(201)
    expect((await anna.chiama('POST', '/proposte/pr1/foto?id=fp1', JPEG, 'image/jpeg')).stato).toBe(201)
    expect(new Uint8Array(await (await loris.chiama('GET', '/foto/fp1')).risposta.arrayBuffer())).toEqual(JPEG)
    expect((await loris.chiama('GET', '/piatti/p2')).corpo.foto).toEqual([])
    const pr = (await loris.chiama('GET', '/proposte/pr1')).corpo
    const decisione = await loris.chiama('POST', '/proposte/pr1/decisione', {
      versione: pr.versione,
      versionePiatto: (await loris.chiama('GET', '/piatti/p2')).corpo.versione,
      decisioni: pr.modifiche.map((m: { id: string; campo: string }) => ({ modificaId: m.id, esito: m.campo === 'note' ? 'approvata' : 'rifiutata' })),
    })
    expect(decisione.stato, JSON.stringify(decisione.corpo)).toBe(200)
    expect((await loris.chiama('GET', '/piatti/p2')).corpo.note).toBe('Con marmellata di albicocche')
    expect((await loris.chiama('GET', '/foto/fp1')).stato).toBe(404)
  })

  it('backup in R2, esportazione con le foto, ripristino dalla console e cestino', async () => {
    const fotoCopiaId = (await anna.chiama('GET', '/piatti/p-anna')).corpo.foto[0].id as string
    // Una voce con gli ingredienti adattati (SPEC §44, migrazione 0022 nel Durable Object).
    const portata = (await loris.chiama('GET', '/eventi/ev/menu')).corpo.portate[4].id as string
    const creata = await loris.chiama('POST', '/eventi/ev/voci', { voci: [{ id: 'v-tiramisu', portataId: portata, nome: 'Tiramisù', piattoId: 'p1' }] })
    expect(creata.stato, JSON.stringify(creata.corpo)).toBe(201)
    const ingrediente = { id: 'iv1', ordine: 0, testoOriginale: '250 g ricotta', nome: 'ricotta', ingredienteId: null, quantita: 250, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] }
    const adattata = await loris.chiama('PUT', '/voci/v-tiramisu/variante', { variante: { descrizione: 'con ricotta', nota: '', porzioniBase: 4, ingredienti: [ingrediente] }, versione: 1 })
    expect(adattata.stato, JSON.stringify(adattata.corpo)).toBe(200)
    expect(adattata.corpo.variante).toMatchObject({ ricettaOrigine: 'p1', descrizione: 'con ricotta' })
    const b = await loris.chiama('POST', '/backup', {})
    expect(b.stato).toBe(201)
    expect(b.corpo).toMatchObject({ tipo: 'manuale', verificato: true, conteggi: { eventi: 1 } })
    const stato = (await loris.chiama('GET', '/backup')).corpo
    expect(stato.backup.map((x: { nome: string }) => x.nome)).toContain(b.corpo.nome)
    const scaricato = await loris.chiama('GET', `/backup/${b.corpo.nome}`)
    expect(scaricato.corpo).toMatchObject({ formato: 'menuapp-esportazione', conteggi: { eventi: 1 } })

    const zip = unzipSync(new Uint8Array(await (await fetch(`${P}/esportazione?foto=1`, { headers: { cookie: loris.cookie } })).arrayBuffer()))
    // La ricetta originale e la copia di Anna, ognuna con il suo file.
    expect(Object.keys(zip).sort()).toEqual(['esportazione.json', `foto/${fotoCopiaId}.jpg`, 'foto/f1.jpg'].sort())
    expect(zip['foto/f1.jpg']).toEqual(JPEG)

    // Dopo il backup: evento e foto eliminati, poi ripristino dalla console.
    const ev = (await loris.chiama('GET', '/eventi/ev')).corpo
    expect((await loris.chiama('DELETE', `/eventi/ev?versione=${ev.versione}`)).stato).toBe(204)
    const foto = (await loris.chiama('GET', '/piatti/p1')).corpo.foto[0]
    expect((await loris.chiama('DELETE', `/foto/f1?versione=${foto.versione}`)).stato).toBe(204)
    expect((await loris.chiama('GET', '/foto/f1')).stato).toBe(404)
    expect((await console_('backup')).testo).toContain(b.corpo.nome)
    const esito = await console_('ripristina', b.corpo.nome)
    expect(esito.stato, esito.testo).toBe(200)
    expect(esito.testo).toContain('Dati precedenti salvati in pre-ripristino-')
    expect((await loris.chiama('GET', '/eventi/ev')).stato).toBe(200)
    expect((await loris.chiama('GET', '/voci/v-tiramisu')).corpo.variante).toMatchObject({ descrizione: 'con ricotta' })
    expect(new Uint8Array(await (await loris.chiama('GET', '/foto/f1')).risposta.arrayBuffer())).toEqual(JPEG)
    // Le sessioni restano valide dopo il ripristino.
    expect((await anna.chiama('GET', '/sessione')).stato).toBe(200)
  })

  it('manutenzione notturna (Cron Trigger): backup giornaliero', async () => {
    expect((await fetch(`${ORIGINE}/cdn-cgi/local/scheduled?cron=45+2+*+*+*`)).status).toBe(200)
    for (let i = 0; i < 20; i++) {
      const tipi = (await loris.chiama('GET', '/backup')).corpo.backup.map((x: { tipo: string }) => x.tipo)
      if (tipi.includes('giornaliero')) return
      await new Promise((ok) => setTimeout(ok, 250))
    }
    throw new Error('Nessun backup giornaliero dopo il Cron Trigger')
  })

  it('migrazione da Debian: contenuti sostituiti, utenti e sessioni di Cloudflare intatti, corrispondenza esplicita, annullamento', async () => {
    // «Debian» di prova: Loris, Anna (c'è anche su Cloudflare, con un altro id) e Bruno (solo su Debian).
    const d = await appDiProva()
    try {
      const annaD = d.utente('Anna')
      const brunoD = d.utente('Bruno')
      const q = '/api/v1'
      const scrivi = async (c: { scrivi: typeof d.scrivi }, m: 'POST' | 'PUT', url: string, corpo: unknown) => {
        const r = await c.scrivi(m, `${q}${url}`, corpo)
        expect(r.statusCode, r.body).toBeLessThan(300)
        return r.body ? JSON.parse(r.body) : null
      }
      const ev = await scrivi(annaD, 'POST', '/eventi', { id: 'ev-debian', nome: 'Pranzo di Pasqua', data: '2027-03-28', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 6, bambini: 0, note: '', gruppoId: 'gruppo-famiglia' })
      await scrivi(annaD, 'PUT', `/eventi/ev-debian/condivisioni/${brunoD.id}`, { permesso: 'modifica' })
      await scrivi(annaD, 'POST', '/eventi/ev-debian/voci', { voci: [{ id: 'v-colomba', portataId: ev.portate[4].id, nome: 'Colomba' }] })
      await scrivi(brunoD, 'POST', '/eventi/ev-debian/cose', { id: 'c-vino', nome: 'Vino', prendo: true })
      await scrivi(annaD, 'POST', '/piatti', { id: 'p-debian', nome: 'Pastiera' })
      const foto = await d.app.inject({ method: 'POST', url: `${q}/piatti/p-debian/foto?id=f-debian`, headers: { origin: 'http://localhost:5173', 'content-type': 'image/jpeg', cookie: annaD.cookie! }, payload: Buffer.from(JPEG) })
      expect(foto.statusCode, foto.body).toBe(201)
      await scrivi(brunoD, 'POST', '/gruppi/gruppo-famiglia/messaggi', { id: 'm-debian', testo: 'Chi porta il vino?' })

      const migra = (...argomenti: string[]) =>
        execFileSync(process.execPath, ['scripts/cloudflare/migra.ts', ...argomenti], {
          encoding: 'utf8',
          env: { ...process.env, MENUAPP_DATI: d.cartella, MENUAPP_URL: ORIGINE, MENUAPP_CODICE_CONSOLE: CODICE, MENUAPP_R2_LOCALE: cartella },
        })
      const preparato = migra('prepara')
      const id = /Esportazione (\d{8}-\d{4})/.exec(preparato)![1]!
      expect(preparato).toContain('1 file')
      const caricato = migra('carica', id)
      expect(caricato).toContain('«Bruno» non esiste su Cloudflare')
      const file = join(d.cartella, 'migrazione', id, 'corrispondenza.json')
      const proposta = JSON.parse(readFileSync(file, 'utf8'))
      expect(proposta.utenti['utente-amministratore'].utente).toBe('utente-amministratore')
      expect(proposta.utenti[annaD.id].utente).toBe('u-anna')
      expect(proposta.utenti[brunoD.id].nuovo).toEqual({ nome: 'Bruno', ruolo: 'utente' })
      // Senza conferma esplicita non si va avanti.
      expect(() => migra('conferma', id)).toThrow()
      writeFileSync(file, JSON.stringify({ ...proposta, confermata: true }))
      expect(migra('conferma', id)).toContain('nessuna modifica fatta')
      expect((await loris.chiama('GET', '/eventi/ev')).stato).toBe(200)

      const importato = migra('importa', id)
      expect(importato).toContain('Verifica superata')
      const backup = /(pre-migrazione-\S+\.json)/.exec(importato)![1]!

      // Utenti e dispositivi di Cloudflare intatti; Bruno nuovo, senza dispositivi.
      expect((await loris.chiama('GET', '/sessione')).corpo.utente.nome).toBe('Loris')
      expect((await anna.chiama('GET', '/sessione')).corpo.utente.id).toBe('u-anna')
      const utenti = (await loris.chiama('GET', '/admin/utenti')).corpo as { id: string; nome: string }[]
      expect(utenti.map((u) => u.nome).sort()).toEqual(['Anna', 'Bruno', 'Loris'])
      // Contenuti di prova sostituiti da quelli di Debian, con i riferimenti tradotti.
      expect((await loris.chiama('GET', '/eventi/ev')).stato).toBe(404)
      const evento = await anna.chiama('GET', '/eventi/ev-debian')
      expect(evento.stato).toBe(200)
      const riepilogo = ((await anna.chiama('GET', '/eventi')).corpo as { id: string; proprietario: { id: string }; permesso: string }[]).find((x) => x.id === 'ev-debian')!
      expect([riepilogo.proprietario.id, riepilogo.permesso]).toEqual(['u-anna', 'proprietario'])
      const accesso = (await anna.chiama('GET', '/eventi/ev-debian/accesso')).corpo
      expect(JSON.stringify(accesso)).toContain(brunoD.id)
      const fotoCf = await anna.chiama('GET', '/foto/f-debian')
      expect(new Uint8Array(await fotoCf.risposta.arrayBuffer())).toEqual(JPEG)
      expect((await anna.chiama('GET', '/piatti/p-debian')).corpo.proprietario.id).toBe('u-anna')
      expect(JSON.stringify((await anna.chiama('GET', '/gruppi/gruppo-famiglia/bacheca')).corpo)).toContain('Chi porta il vino?')

      // Annullamento: torna lo stato di prima (contenuti di prova).
      expect(migra('annulla', backup)).toContain('Ripristinato')
      expect((await loris.chiama('GET', '/eventi/ev')).stato).toBe(200)
      expect((await anna.chiama('GET', '/eventi/ev-debian')).stato).toBe(404)
    } finally {
      d.chiudi()
    }
  }, 120_000)
})
