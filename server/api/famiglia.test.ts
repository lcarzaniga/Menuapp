// Spazio della famiglia (SPEC §20): bacheche, sondaggi, proposte, notifiche.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { esegui, uno } from '../db/connessione.ts'
import { appDiProva, type AppDiProva, type ClientDiProva, ORIGINE_PROVA } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string }
let bruno: ClientDiProva & { id: string }
let estraneo: ClientDiProva & { id: string } // account senza famiglia
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
const jpeg = (n = 1) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, n), Buffer.from([0xff, 0xd9])])
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const notifiche = async (c: ClientDiProva) => corpo(await c.leggi(`${P}/notifiche`)) as { tipo: string; testo: string; conteggio: number; letta: boolean; collegamento: string; id: string }[]

async function evento(id = 'ev') {
  return ok(t.scrivi('POST', `${P}/eventi`, { id, nome: 'Pranzo della domenica', data: '2026-12-20', oraServizio: '13:00', tipo: 'pranzo', occasione: '', adulti: 6, bambini: 0, note: '' }))
}

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno')
  estraneo = t.utente('Estraneo', 'utente', false)
})
afterEach(() => t.chiudi())

describe('bacheca della famiglia', () => {
  it('solo i membri del gruppo la vedono: per gli altri non esiste, nemmeno messaggi, commenti e foto', async () => {
    const m = await ok(anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'm1', testo: 'Domenica pranzo da noi?' }))
    expect(m).toMatchObject({ autore: { nome: 'Anna' }, testo: 'Domenica pranzo da noi?', puoModificare: true })
    await ok(t.app.inject({ method: 'POST', url: `${P}/messaggi/m1/allegati?id=a1`, headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg', cookie: anna.cookie! }, payload: jpeg() }))
    await ok(bruno.scrivi('POST', `${P}/messaggi/m1/commenti`, { id: 'c1', testo: 'Ci sono!' }))
    expect(corpo(await bruno.leggi(`${P}/gruppi/${G}/bacheca`)).messaggi).toHaveLength(1)
    expect((await bruno.leggi(`${P}/allegati/a1`)).statusCode).toBe(200)

    const nessuno = corpo(await estraneo.leggi(`${P}/gruppi/inesistente/bacheca`))
    for (const [metodo, url, dati] of [
      ['GET', `${P}/gruppi/${G}/bacheca`],
      ['POST', `${P}/gruppi/${G}/messaggi`, { id: 'x', testo: 'ciao' }],
      ['GET', `${P}/messaggi/m1`],
      ['PUT', `${P}/messaggi/m1`, { testo: 'x', versione: 1 }],
      ['POST', `${P}/messaggi/m1/commenti`, { id: 'cx', testo: 'x' }],
      ['PUT', `${P}/messaggi/m1/reazioni/cuore`],
      ['PUT', `${P}/commenti/c1`, { testo: 'x', versione: 1 }],
      ['DELETE', `${P}/commenti/c1`],
      ['DELETE', `${P}/messaggi/m1`],
      ['GET', `${P}/allegati/a1`],
    ] as const) {
      const r = metodo === 'GET' ? await estraneo.leggi(url) : await estraneo.scrivi(metodo, url, dati ?? {})
      expect(r.statusCode, `${metodo} ${url}`).toBe(404)
    }
    expect(nessuno.errore.codice).toBe('non_trovato')
    expect(corpo(await estraneo.leggi(`${P}/gruppi`))).toEqual([])
  })

  it('ordine: fissati prima, poi dal più recente; fissa solo chi amministra la famiglia', async () => {
    await ok(anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'vecchio', testo: 'Importante: cena il 31' }))
    await ok(bruno.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'nuovo', testo: 'Ho comprato il panettone' }))
    expect((await anna.scrivi('PUT', `${P}/messaggi/vecchio/fissato`, { fissato: true })).statusCode).toBe(403)
    await ok(t.scrivi('PUT', `${P}/messaggi/vecchio/fissato`, { fissato: true }))
    const ordine = corpo(await anna.leggi(`${P}/gruppi/${G}/bacheca`)).messaggi.map((m: { id: string; fissato: boolean }) => [m.id, m.fissato])
    expect(ordine).toEqual([
      ['vecchio', true],
      ['nuovo', false],
    ])
  })

  it('modifiche e permessi: l\'autore modifica (con versione), gli altri no; l\'amministratore modera', async () => {
    const m = await ok(anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'm1', testo: 'Bozza' }))
    expect((await bruno.scrivi('PUT', `${P}/messaggi/m1`, { testo: 'Mio!', versione: m.versione })).statusCode).toBe(403)
    const mod = await ok(anna.scrivi('PUT', `${P}/messaggi/m1`, { testo: 'Testo giusto', versione: m.versione }))
    expect(mod.modificatoIl).not.toBeNull()
    const conflitto = await anna.scrivi('PUT', `${P}/messaggi/m1`, { testo: 'Vecchia versione', versione: m.versione })
    expect(conflitto.statusCode).toBe(409)
    expect(corpo(conflitto).errore.dettagli.attuale.testo).toBe('Testo giusto')
    expect((await bruno.scrivi('DELETE', `${P}/messaggi/m1`)).statusCode).toBe(403)
    expect((await t.scrivi('DELETE', `${P}/messaggi/m1`)).statusCode).toBe(204)
  })

  it('reazioni e commenti; una ricetta privata segnalata non si rivela', async () => {
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p-segreto', nome: 'Torta segreta', ingredienti: [], visibilita: 'privata' }))
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p-fam', nome: 'Lasagne della nonna', ingredienti: [] }))
    // Non si segnala una ricetta che non si può vedere.
    expect((await bruno.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'x', testo: 'guarda', piattoId: 'p-segreto' })).statusCode).toBe(404)
    await ok(anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'm1', testo: 'Provate questa', piattoId: 'p-segreto' }))
    await ok(anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'm2', testo: 'E questa', piattoId: 'p-fam' }))
    const [m2, m1] = corpo(await bruno.leggi(`${P}/gruppi/${G}/bacheca`)).messaggi
    expect(m1).toMatchObject({ piatto: null, piattoNascosto: true })
    expect(JSON.stringify(m1)).not.toContain('Torta segreta')
    expect(m2.piatto).toMatchObject({ id: 'p-fam', nome: 'Lasagne della nonna', proprietario: 'Anna' })

    await ok(bruno.scrivi('PUT', `${P}/messaggi/m2/reazioni/gnam`, {}))
    await ok(bruno.scrivi('PUT', `${P}/messaggi/m2/reazioni/gnam`, {})) // ripetuta: idempotente
    const r = await ok(t.scrivi('PUT', `${P}/messaggi/m2/reazioni/gnam`, {}))
    expect(r.reazioni).toEqual([{ reazione: 'gnam', numero: 2, mia: true, nomi: ['Bruno', 'Loris'] }])
    expect((await bruno.scrivi('PUT', `${P}/messaggi/m2/reazioni/sbagliata`, {})).statusCode).toBe(400)
    await ok(bruno.scrivi('DELETE', `${P}/messaggi/m2/reazioni/gnam`))
    const c = await ok(bruno.scrivi('POST', `${P}/messaggi/m2/commenti`, { id: 'c1', testo: 'La faccio sabato' }))
    expect(c.commenti).toEqual([expect.objectContaining({ autore: { id: bruno.id, nome: 'Bruno' }, testo: 'La faccio sabato', puoModificare: true })])
    expect((await anna.scrivi('PUT', `${P}/commenti/c1`, { testo: 'no', versione: 1 })).statusCode).toBe(403)
  })

  it('foto: solo l\'autore, al massimo 4, file rimossi con il messaggio', async () => {
    await ok(anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'm1', testo: 'Foto del pranzo' }))
    const carica = (c: ClientDiProva, id: string) =>
      t.app.inject({ method: 'POST', url: `${P}/messaggi/m1/allegati?id=${id}`, headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg', cookie: c.cookie! }, payload: jpeg() })
    expect((await carica(bruno, 'b1')).statusCode).toBe(403)
    for (const id of ['a1', 'a2', 'a3', 'a4']) expect((await carica(anna, id)).statusCode).toBe(201)
    expect((await carica(anna, 'a5')).statusCode).toBe(422)
    expect(corpo(await anna.leggi(`${P}/messaggi/m1`)).allegati).toEqual(['a1', 'a2', 'a3', 'a4'])
    expect((await anna.scrivi('DELETE', `${P}/messaggi/m1`)).statusCode).toBe(204)
    expect((await anna.leggi(`${P}/allegati/a1`)).statusCode).toBe(404)
    expect(uno(t.db, 'SELECT count(*) AS n FROM allegati')).toEqual({ n: 0 })
  })
})

describe('bacheca dell\'evento', () => {
  beforeEach(async () => {
    await evento()
    await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura' }))
  })

  it('chi ha la sola lettura partecipa; se il proprietario lo esclude legge ma non scrive', async () => {
    await ok(anna.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 'm1', testo: 'Porto le bevande!' }))
    expect(corpo(await anna.leggi(`${P}/eventi/ev/accesso`)).partecipa).toBe(true)
    await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura', partecipa: false }))
    const b = corpo(await anna.leggi(`${P}/eventi/ev/bacheca`))
    expect(b).toMatchObject({ puoScrivere: false, messaggi: [expect.objectContaining({ id: 'm1', puoModificare: false })] })
    expect((await anna.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 'm2', testo: 'x' })).statusCode).toBe(403)
    expect((await anna.scrivi('POST', `${P}/messaggi/m1/commenti`, { id: 'c', testo: 'x' })).statusCode).toBe(403)
    // Bruno non vede l'evento: per lui la bacheca non esiste.
    expect((await bruno.leggi(`${P}/eventi/ev/bacheca`)).statusCode).toBe(404)
    expect((await bruno.leggi(`${P}/messaggi/m1`)).statusCode).toBe(404)
  })

  it('revoca della condivisione: bacheca, messaggi e notifiche dell\'evento spariscono per l\'ex invitata', async () => {
    await ok(t.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 'm1', testo: 'Inizio alle 13' }))
    expect((await notifiche(anna)).map((n) => n.tipo).sort()).toEqual(['bacheca_evento', 'condivisione'])
    expect((await t.scrivi('DELETE', `${P}/eventi/ev/condivisioni/${anna.id}`)).statusCode).toBe(204)
    expect((await anna.leggi(`${P}/eventi/ev/bacheca`)).statusCode).toBe(404)
    expect((await anna.leggi(`${P}/messaggi/m1`)).statusCode).toBe(404)
    expect(await notifiche(anna)).toEqual([])
    expect(corpo(await anna.leggi(`${P}/notifiche/conteggio`))).toEqual({ nonLette: 0 })
  })

  it('eliminazione dell\'evento: messaggi, foto e notifiche se ne vanno', async () => {
    await ok(t.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 'm1', testo: 'Foto della tavola' }))
    await ok(t.app.inject({ method: 'POST', url: `${P}/messaggi/m1/allegati?id=a1`, headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg', cookie: t.cookie! }, payload: jpeg() }))
    const ev = corpo(await t.leggi(`${P}/eventi/ev`))
    expect((await t.scrivi('DELETE', `${P}/eventi/ev?versione=${ev.versione}`)).statusCode).toBe(204)
    for (const tab of ['messaggi', 'allegati', 'notifiche']) expect(uno(t.db, `SELECT count(*) AS n FROM ${tab}`), tab).toEqual({ n: 0 })
  })
})

describe('sondaggi', () => {
  const sondaggio = (c: ClientDiProva, extra: Record<string, unknown> = {}) =>
    c.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 's1', testo: 'Carne o pesce?', sondaggio: { opzioni: ['Carne', 'Pesce'], ...extra } })

  it('validazione: almeno due opzioni, diverse, scadenza futura', async () => {
    expect((await anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 's', testo: 'x', sondaggio: { opzioni: ['Solo una'] } })).statusCode).toBe(400)
    expect((await anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 's', testo: 'x', sondaggio: { opzioni: ['A', 'a'] } })).statusCode).toBe(400)
    expect((await anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 's', testo: 'x', sondaggio: { opzioni: ['A', 'B'], scadeIl: 1 } })).statusCode).toBe(400)
  })

  it('voto singolo, cambio di voto, un insieme per utente, risultati dopo il voto', async () => {
    const s = await ok(sondaggio(anna))
    const [carne, pesce] = s.sondaggio.opzioni.map((o: { id: string }) => o.id)
    expect(s.sondaggio).toMatchObject({ multipla: false, risultatiVisibili: false, votanti: null })
    expect((await bruno.scrivi('PUT', `${P}/messaggi/s1/voto`, { opzioni: [carne, pesce] })).statusCode).toBe(400)
    let v = await ok(bruno.scrivi('PUT', `${P}/messaggi/s1/voto`, { opzioni: [carne] }))
    expect(v.sondaggio).toMatchObject({ risultatiVisibili: true, votanti: 1, mieScelte: [carne] })
    // Cambio di voto: sostituisce, non aggiunge (anche da un altro dispositivo dello stesso utente).
    const tablet = t.sessione(bruno.id)
    v = await ok(tablet.scrivi('PUT', `${P}/messaggi/s1/voto`, { opzioni: [pesce] }))
    expect(v.sondaggio.opzioni.map((o: { voti: number }) => o.voti)).toEqual([0, 1])
    expect(v.sondaggio.votanti).toBe(1)
    expect(uno(t.db, 'SELECT count(*) AS n FROM voti_sondaggio')).toEqual({ n: 1 })
    // Chi non ha votato non vede i risultati.
    expect(corpo(await t.leggi(`${P}/messaggi/s1`)).sondaggio).toMatchObject({ risultatiVisibili: false, opzioni: [expect.objectContaining({ voti: null, nomi: [] }), expect.anything()] })
    expect((await bruno.scrivi('PUT', `${P}/messaggi/s1/voto`, { opzioni: ['inventata'] })).statusCode).toBe(400)
  })

  it('scelta multipla; risultati alla chiusura; chiude l\'autore o chi amministra, poi niente voti', async () => {
    const s = await ok(sondaggio(anna, { multipla: true, risultati: 'alla_chiusura' }))
    const ids = s.sondaggio.opzioni.map((o: { id: string }) => o.id)
    const v = await ok(bruno.scrivi('PUT', `${P}/messaggi/s1/voto`, { opzioni: ids }))
    expect([...v.sondaggio.mieScelte].sort()).toEqual([...ids].sort())
    expect(v.sondaggio.risultatiVisibili).toBe(false)
    expect((await bruno.scrivi('POST', `${P}/messaggi/s1/chiudi`, {})).statusCode).toBe(403)
    const chiuso = await ok(t.scrivi('POST', `${P}/messaggi/s1/chiudi`, {}))
    expect(chiuso.sondaggio).toMatchObject({ chiuso: true, risultatiVisibili: true, votanti: 1, puoVotare: false })
    expect(chiuso.sondaggio.opzioni[0].nomi).toEqual(['Bruno'])
    expect((await bruno.scrivi('PUT', `${P}/messaggi/s1/voto`, { opzioni: [] })).statusCode).toBe(422)
    expect((await notifiche(bruno)).map((n) => n.testo)).toContain('Sondaggio chiuso: Carne o pesce?')
  })

  it('scadenza: dopo la data il sondaggio è chiuso', async () => {
    await ok(sondaggio(anna, { scadeIl: Date.now() + 60_000 }))
    esegui(t.db, "UPDATE sondaggi SET scade_il = 1 WHERE messaggio_id = 's1'")
    const s = corpo(await bruno.leggi(`${P}/messaggi/s1`))
    expect(s.sondaggio).toMatchObject({ chiuso: true, risultatiVisibili: true, puoVotare: false })
  })
})

describe('proposte di piatti', () => {
  beforeEach(async () => {
    await evento()
    await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura' }))
    await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${bruno.id}`, { permesso: 'modifica' }))
  })

  it('una proposta con la ricetta privata del proponente: gli altri vedono il nome, non la ricetta', async () => {
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p-anna', nome: 'Tiramisù di Anna', porzioniBase: 8, ingredienti: [], visibilita: 'privata' }))
    const m = await ok(anna.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 'pr1', testo: 'Lo faccio io!', proposta: { nome: 'Tiramisù', piattoId: 'p-anna', portataNome: 'Dolci' } }))
    expect(m.proposta).toMatchObject({ nome: 'Tiramisù', stato: 'in_valutazione', puoDecidere: false, piatto: { id: 'p-anna' } })
    const perLoris = corpo(await t.leggi(`${P}/messaggi/pr1`))
    expect(perLoris.proposta).toMatchObject({ piatto: null, puoDecidere: true })
    expect((await t.leggi(`${P}/piatti/p-anna`)).statusCode).toBe(404)
    // Le proposte stanno solo nelle bacheche degli eventi.
    expect((await anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'x', testo: '', proposta: { nome: 'Pizza' } })).statusCode).toBe(400)
    expect((await notifiche(t)).map((n) => n.tipo)).toContain('proposta')
  })

  it('decide chi organizza; l\'inserimento nel menù è unico e la ricetta entra come copia', async () => {
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p-anna', nome: 'Tiramisù di Anna', porzioniBase: 8, ingredienti: [], visibilita: 'privata' }))
    await ok(anna.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 'pr1', testo: '', proposta: { nome: 'Tiramisù', piattoId: 'p-anna' } }))
    await ok(t.scrivi('PUT', `${P}/messaggi/pr1/reazioni/mi_piace`, {}))
    expect((await anna.scrivi('PUT', `${P}/messaggi/pr1/decisione`, { stato: 'accettata' })).statusCode).toBe(403)
    expect((await anna.scrivi('POST', `${P}/messaggi/pr1/inserisci`, { portataId: 'x' })).statusCode).toBe(403)
    const ev = corpo(await t.leggi(`${P}/eventi/ev`))
    const dolci = ev.portate.find((p: { nome: string }) => p.nome === 'Dolci').id
    const dentro = await ok(bruno.scrivi('POST', `${P}/messaggi/pr1/inserisci`, { portataId: dolci }))
    expect(dentro.proposta).toMatchObject({ stato: 'accettata', decisoDa: 'Bruno' })
    // Ripetuto: nessun doppione nel menù.
    await ok(t.scrivi('POST', `${P}/messaggi/pr1/inserisci`, { portataId: dolci }))
    const menu = corpo(await t.leggi(`${P}/eventi/ev/menu`))
    const voci = menu.portate.flatMap((p: { voci: { nome: string; piattoId: string | null }[] }) => p.voci)
    expect(voci.filter((v: { nome: string }) => v.nome === 'Tiramisù')).toHaveLength(1)
    const copia = voci.find((v: { nome: string }) => v.nome === 'Tiramisù').piattoId
    expect(copia).not.toBe('p-anna')
    expect(corpo(await t.leggi(`${P}/piatti/${copia}`))).toMatchObject({ mio: true, origineAutore: 'Anna', nome: 'Tiramisù di Anna' })
    expect((await notifiche(anna)).map((n) => n.testo)).toContain('«Tiramisù» entra nel menù')
  })

  it('rifiuto e ritorno in valutazione; la decisione non dipende dai voti', async () => {
    await ok(anna.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 'pr1', testo: '', proposta: { nome: 'Pizza' } }))
    for (const c of [anna, bruno, t]) await ok(c.scrivi('PUT', `${P}/messaggi/pr1/reazioni/mi_piace`, {}))
    expect((await ok(t.scrivi('PUT', `${P}/messaggi/pr1/decisione`, { stato: 'rifiutata' }))).proposta.stato).toBe('rifiutata')
    expect((await ok(t.scrivi('PUT', `${P}/messaggi/pr1/decisione`, { stato: 'in_valutazione' }))).proposta.stato).toBe('in_valutazione')
  })
})

describe('notifiche', () => {
  it('raggruppate, mai per le proprie azioni, con letta/tutte lette e preferenze', async () => {
    await ok(anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'm1', testo: 'Primo' }))
    await ok(anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'm2', testo: 'Secondo' }))
    expect(await notifiche(anna)).toEqual([])
    const perBruno = await notifiche(bruno)
    expect(perBruno).toEqual([expect.objectContaining({ tipo: 'bacheca_famiglia', conteggio: 2, testo: 'Secondo', letta: false, collegamento: '/famiglia?messaggio=m2' })])
    expect(corpo(await bruno.leggi(`${P}/notifiche/conteggio`))).toEqual({ nonLette: 1 })
    await ok(bruno.scrivi('POST', `${P}/notifiche/${perBruno[0]!.id}/letta`, {}))
    expect(corpo(await bruno.leggi(`${P}/notifiche/conteggio`))).toEqual({ nonLette: 0 })
    // Dopo la lettura ne nasce una nuova.
    await ok(anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'm3', testo: 'Terzo' }))
    expect((await notifiche(bruno)).map((n) => [n.conteggio, n.letta])).toEqual([
      [1, false],
      [2, true],
    ])
    await ok(bruno.scrivi('POST', `${P}/notifiche/lette`, {}))
    expect(corpo(await bruno.leggi(`${P}/notifiche/conteggio`))).toEqual({ nonLette: 0 })
    // Preferenze: niente più bacheca della famiglia, ma le risposte sì.
    await ok(bruno.scrivi('PUT', `${P}/notifiche/preferenze`, { disattivate: ['bacheca_famiglia'] }))
    await ok(bruno.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'mb', testo: 'Domanda di Bruno' }))
    await ok(anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'm4', testo: 'Quarto' }))
    await ok(anna.scrivi('POST', `${P}/messaggi/mb/commenti`, { id: 'c1', testo: 'Risposta di Anna' }))
    const nuove = (await notifiche(bruno)).filter((n) => !n.letta)
    expect(nuove.map((n) => [n.tipo, n.testo])).toEqual([['risposta', 'Risposta di Anna']])
    expect((await bruno.scrivi('PUT', `${P}/notifiche/preferenze`, { disattivate: ['inventato'] })).statusCode).toBe(400)
  })

  it('le notifiche di un altro non si segnano come lette', async () => {
    await ok(anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'm1', testo: 'Ciao' }))
    const [n] = await notifiche(bruno)
    await ok(t.scrivi('POST', `${P}/notifiche/${n!.id}/letta`, {}))
    expect((await notifiche(bruno))[0]!.letta).toBe(false)
  })

  it('chi esce dalla famiglia perde bacheca e notifiche della famiglia', async () => {
    await ok(anna.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'm1', testo: 'Ciao' }))
    expect(await notifiche(bruno)).toHaveLength(1)
    expect((await t.scrivi('DELETE', `${P}/admin/gruppi/${G}/membri/${bruno.id}`)).statusCode).toBe(204)
    expect(await notifiche(bruno)).toEqual([])
    expect((await bruno.leggi(`${P}/gruppi/${G}/bacheca`)).statusCode).toBe(404)
    expect((await anna.scrivi('DELETE', `${P}/admin/gruppi/${G}/membri/${anna.id}`)).statusCode).toBe(403)
  })

  it('modifiche importanti al menù notificate agli invitati, raggruppate', async () => {
    const ev = await evento()
    await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura' }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v1', portataId: ev.portate[0].id, nome: 'Crostini' }] }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v2', portataId: ev.portate[1].id, nome: 'Lasagne' }] }))
    const menu = (await notifiche(anna)).filter((n) => n.tipo === 'menu')
    expect(menu).toEqual([expect.objectContaining({ conteggio: 2, testo: 'Aggiunto «Lasagne» al menù', collegamento: '/eventi/ev/menu' })])
  })
})
