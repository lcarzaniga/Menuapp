// Collaborazione sulle ricette (SPEC §41): chi può proporre, approvazione per singola modifica,
// conflitti, concorrenza, dipendenze, ritiro, foto proposte, notifiche, cronologia e ripristino,
// trasferimento volontario e riassegnazione amministrativa, copie ed eventi.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaProposta, SchemaProposte } from '../../src/contratto/collaborazione.ts'
import { esegui, tutti, uno } from '../db/connessione.ts'
import { appDiProva, type AppDiProva, type ClientDiProva, ID_AMMINISTRATORE, ORIGINE_PROVA } from '../prova.ts'

let t: AppDiProva // Loris: amministratore della Famiglia di prova
let anna: ClientDiProva & { id: string } // proprietaria della torta
let bruno: ClientDiProva & { id: string } // familiare
let estraneo: ClientDiProva & { id: string } // nessuna Famiglia
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const regola = async (r: Promise<{ statusCode: number; body: string }>) => corpo(await r).errore?.dettagli?.regola
const ing = (id: string, testo: string, nome: string, quantita: number | null, unita: string | null = 'g') => ({
  id, ordine: 0, testoOriginale: testo, nome, ingredienteId: null, quantita, quantitaMax: null, unita, scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [],
})
const jpeg = (n = 1) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, n), Buffer.from([0xff, 0xd9])])
const torta = (c: ClientDiProva = anna) => ok(c.leggi(`${P}/piatti/torta`))
const contenuto = (p: Record<string, unknown>) => {
  const { nome, portataSuggerita, porzioniBase, tempoPreparazioneMin, tempoCotturaMin, tempoRiposoMin, attrezzature, procedimento, note, fonte, ingredienti } = p
  return { nome, portataSuggerita, porzioniBase, tempoPreparazioneMin, tempoCotturaMin, tempoRiposoMin, attrezzature, procedimento, note, fonte, ingredienti } as Record<string, any>
}
/** Bruno propone, partendo dalla torta di adesso, i cambiamenti indicati. */
async function proponi(c: ClientDiProva, id: string, cambia: (x: Record<string, any>) => void, extra: Record<string, unknown> = {}) {
  const p = await torta(c)
  const x = contenuto(p)
  cambia(x)
  return c.scrivi('POST', `${P}/piatti/torta/proposte`, { id, versioneBase: p.versione, contenuto: x, motivazione: 'La faccio così da anni', ...extra })
}
const fotoProposta = (c: ClientDiProva, proposta: string, id: string, passo?: number) =>
  t.inietta({ method: 'POST', url: `${P}/proposte/${proposta}/foto?id=${id}&didascalia=Fetta${passo === undefined ? '' : `&passo=${passo}`}`, headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg', cookie: c.cookie! }, payload: jpeg() })
const leggiProposta = async (c: ClientDiProva, id: string) => SchemaProposta.parse(await ok(c.leggi(`${P}/proposte/${id}`)))
async function decidi(c: ClientDiProva, id: string, esiti: Record<string, 'approvata' | 'rifiutata'>, opzioni: { motivo?: string; conferma?: boolean; versionePiatto?: number } = {}) {
  const p = await leggiProposta(c, id)
  const versionePiatto = opzioni.versionePiatto ?? (await torta(c)).versione
  const decisioni = p.modifiche
    .filter((m) => m.stato === 'in_attesa')
    .map((m) => {
      const chiave = m.campo === 'ingrediente' ? `ingrediente:${(m.dopo as { nome?: string } | null)?.nome ?? (m.prima as { nome: string }).nome}` : m.campo
      return { modificaId: m.id, esito: esiti[chiave] ?? 'rifiutata', motivo: opzioni.motivo ?? '', confermaConflitto: opzioni.conferma ?? false }
    })
  return c.scrivi('POST', `${P}/proposte/${id}/decisione`, { versione: p.versione, versionePiatto, decisioni })
}
const notifiche = async (c: ClientDiProva) => corpo(await c.leggi(`${P}/notifiche`)) as { tipo: string; testo: string; collegamento: string }[]

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno')
  estraneo = t.utente('Estraneo', 'utente', false)
  esegui(t.db, "UPDATE membri_gruppo SET ruolo = 'amministratore' WHERE gruppo_id = ? AND utente_id = ?", G, ID_AMMINISTRATORE)
  await ok(anna.scrivi('POST', `${P}/piatti`, {
    id: 'torta',
    nome: 'Torta della nonna',
    porzioniBase: 8,
    tempoCotturaMin: 30,
    procedimento: ['Impastare', 'Cuocere'],
    famiglie: [G],
    ingredienti: [ing('i-farina', '400 g farina', 'farina', 400), ing('i-uova', '3 uova', 'uova', 3, null), ing('i-burro', '100 g burro', 'burro', 100)],
  }))
})
afterEach(() => t.chiudi())

describe('chi può proporre', () => {
  it('i familiari e chi l\'ha condivisa personalmente sì; il proprietario, gli estranei, chi la vede pubblica o per un evento no', async () => {
    expect((await proponi(anna, 'x1', (x) => (x.note = 'mia'))).statusCode).toBe(403)
    expect((await proponi(bruno, 'p1', (x) => (x.note = 'Con la scorza di limone'))).statusCode).toBe(201)
    expect((await estraneo.scrivi('POST', `${P}/piatti/torta/proposte`, { id: 'x2', versioneBase: 1, contenuto: {}, motivazione: '' })).statusCode).toBe(404)
    // Pubblica: l'estraneo la legge ma non propone.
    await ok(anna.scrivi('PUT', `${P}/piatti/torta/visibilita`, { visibilita: 'pubblica' }))
    expect((await proponi(estraneo, 'x3', (x) => (x.note = 'io'))).statusCode).toBe(403)
    // Per un evento: Bruno (ricetta privata, quindi non tramite la Famiglia) la legge ma non propone.
    const ev = await ok(anna.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Pranzo', data: '2030-01-10', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 4, bambini: 0, note: '', gruppoId: G }))
    await ok(anna.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v1', portataId: ev.portate[4].id, nome: 'Torta', piattoId: 'torta' }] }))
    await ok(anna.scrivi('PUT', `${P}/piatti/torta/visibilita`, { visibilita: 'privata' }))
    await ok(anna.scrivi('PUT', `${P}/eventi/ev/condivisioni/${bruno.id}`, { permesso: 'modifica' }))
    expect((await bruno.leggi(`${P}/piatti/torta`)).statusCode).toBe(200)
    expect((await proponi(bruno, 'x4', (x) => (x.note = 'io'))).statusCode).toBe(403)
    // Condivisa personalmente (con Loris): sì.
    await ok(anna.scrivi('PUT', `${P}/piatti/torta/condivisioni`, { utenti: [ID_AMMINISTRATORE] }))
    expect((await proponi(t, 'p2', (x) => (x.note = 'Anche cannella'))).statusCode).toBe(201)
    await ok(anna.scrivi('PUT', `${P}/piatti/torta/famiglie`, { gruppi: [G] }))
    // Una proposta senza cambiamenti non serve; una preparata su una versione vecchia va rifatta.
    expect(await regola(proponi(bruno, 'x5', () => {}))).toBe('nessuna_modifica')
    const vecchia = await torta(bruno)
    await ok(anna.scrivi('PUT', `${P}/piatti/torta`, { ...contenuto(await torta()), note: 'aggiornata', versione: (await torta()).versione }))
    expect((await bruno.scrivi('POST', `${P}/piatti/torta/proposte`, { id: 'x6', versioneBase: vecchia.versione, contenuto: { ...contenuto(vecchia), fonte: 'x' }, motivazione: '' })).statusCode).toBe(409)
  })
})

describe('scenario completo: tre modifiche, due approvate, una rifiutata', () => {
  it('proposta, notifica, decisione parziale atomica, esito, cronologia, foto', async () => {
    const p = await ok(proponi(bruno, 'p1', (x) => {
      x.tempoCotturaMin = 25
      x.ingredienti = x.ingredienti.map((i: { id: string }) => (i.id === 'i-farina' ? ing('i-farina', '450 g farina', 'farina', 450) : i))
    }))
    expect(p.modifiche.map((m: { campo: string; operazione: string }) => [m.campo, m.operazione])).toEqual([['tempoCotturaMin', 'modifica'], ['ingrediente', 'modifica']])
    expect((await fotoProposta(bruno, 'p1', 'f-fetta')).statusCode).toBe(201)
    // La ricetta ufficiale non cambia; la foto non è nella galleria.
    expect(await torta()).toMatchObject({ tempoCotturaMin: 30, foto: [] })
    // Foto proposta: la vedono il proprietario e l'autore, non gli altri familiari.
    for (const [c, stato] of [[anna, 200], [bruno, 200], [t, 404]] as const) expect((await c.leggi(`${P}/foto/f-fetta`)).statusCode).toBe(stato)
    expect((await t.leggi(`${P}/proposte/p1`)).statusCode).toBe(404)
    // Notifica al proprietario, che porta alla proposta.
    const n = (await notifiche(anna)).find((x) => x.tipo === 'modifica_ricetta')!
    expect(n).toMatchObject({ testo: 'Bruno propone modifiche a «Torta della nonna»', collegamento: '/ricettario/torta/proposte?proposta=p1' })
    // Il proprietario approva farina e foto, rifiuta la cottura.
    expect((await bruno.scrivi('POST', `${P}/proposte/p1/decisione`, { versione: 1, versionePiatto: 1, decisioni: [{ modificaId: p.modifiche[0].id, esito: 'approvata' }] })).statusCode).toBe(403)
    const deciso = await ok(decidi(anna, 'p1', { 'ingrediente:farina': 'approvata', foto: 'approvata' }, { motivo: 'In 30 minuti viene meglio' }))
    expect(deciso.stato).toBe('conclusa')
    expect(deciso.modifiche.map((m: { campo: string; stato: string; motivo: string }) => [m.campo, m.stato, m.motivo])).toEqual([
      ['tempoCotturaMin', 'rifiutata', 'In 30 minuti viene meglio'],
      ['ingrediente', 'approvata', ''],
      ['foto', 'approvata', ''],
    ])
    const dopo = await torta()
    expect(dopo).toMatchObject({ tempoCotturaMin: 30 })
    expect(dopo.ingredienti.map((i: { id: string; quantita: number }) => [i.id, i.quantita])).toEqual([['i-farina', 450], ['i-uova', 3], ['i-burro', 100]])
    expect(dopo.foto).toEqual([expect.objectContaining({ id: 'f-fetta', principale: true })])
    // Il proponente vede l'esito: una sola notifica riepilogativa.
    const esiti = (await notifiche(bruno)).filter((x) => x.tipo === 'modifica_ricetta')
    expect(esiti.map((x) => x.testo)).toEqual(['La tua proposta per «Torta della nonna»: approvata in parte (2 su 3)'])
    // Cronologia: com'era, la modifica dalla proposta (Bruno, approvata da Anna), la foto.
    const c = await ok(anna.leggi(`${P}/piatti/torta/cronologia`))
    expect(c.revisioni.map((r: { tipo: string; autore: { nome: string }; approvatoDa: { nome: string } | null; propostaId: string | null }) => [r.tipo, r.autore.nome, r.approvatoDa?.nome ?? null, r.propostaId])).toEqual([
      ['foto', 'Bruno', 'Anna', 'p1'],
      ['proposta', 'Bruno', 'Anna', 'p1'],
      ['iniziale', 'Anna', null, null],
    ])
    expect(c.revisioni[1].campi).toEqual([{ campo: 'ingrediente', prima: expect.objectContaining({ quantita: 400 }), dopo: expect.objectContaining({ quantita: 450 }) }])
    // Chi la vede solo per un evento non vede la cronologia; un familiare sì.
    expect((await ok(bruno.leggi(`${P}/piatti/torta/cronologia`))).revisioni).toHaveLength(3)
  })

  it('rifiutata del tutto: notifica e foto eliminata', async () => {
    await ok(proponi(bruno, 'p1', (x) => (x.note = 'Zucchero a velo')))
    expect((await fotoProposta(bruno, 'p1', 'f1')).statusCode).toBe(201)
    await ok(decidi(anna, 'p1', {}))
    expect((await notifiche(bruno)).find((x) => x.tipo === 'modifica_ricetta')?.testo).toBe('La tua proposta per «Torta della nonna»: rifiutata')
    expect((await anna.leggi(`${P}/foto/f1`)).statusCode).toBe(404)
    expect(uno(t.db, "SELECT count(*) AS n FROM revisioni_piatto WHERE piatto_id = 'torta'")).toEqual({ n: 0 })
  })
})

describe('conflitti, concorrenza, dipendenze', () => {
  it('una modifica su un campo cambiato nel frattempo si approva solo con una conferma; le altre sì', async () => {
    await ok(proponi(bruno, 'p1', (x) => {
      x.tempoCotturaMin = 25
      x.note = 'Servire tiepida'
    }))
    const v = (await torta()).versione
    await ok(anna.scrivi('PUT', `${P}/piatti/torta`, { ...contenuto(await torta()), tempoCotturaMin: 35, versione: v }))
    const p = await leggiProposta(anna, 'p1')
    expect(p.modifiche.map((m) => [m.campo, m.conflitto, m.attuale])).toEqual([['tempoCotturaMin', true, 35], ['note', false, '']])
    expect(await regola(decidi(anna, 'p1', { tempoCotturaMin: 'approvata', note: 'approvata' }))).toBe('conflitto')
    expect((await torta()).tempoCotturaMin).toBe(35)
    await ok(decidi(anna, 'p1', { tempoCotturaMin: 'approvata', note: 'approvata' }, { conferma: true }))
    expect(await torta()).toMatchObject({ tempoCotturaMin: 25, note: 'Servire tiepida' })
  })

  it('due decisioni sulla stessa versione: la seconda trova la ricetta cambiata (409) e riesamina', async () => {
    await ok(proponi(bruno, 'p1', (x) => (x.note = 'A')))
    await ok(proponi(t, 'p2', (x) => (x.fonte = 'Zia Rosa')))
    const v = (await torta()).versione
    await ok(decidi(anna, 'p1', { note: 'approvata' }, { versionePiatto: v }))
    expect((await decidi(anna, 'p2', { fonte: 'approvata' }, { versionePiatto: v })).statusCode).toBe(409)
    await ok(decidi(anna, 'p2', { fonte: 'approvata' }))
    expect(await torta()).toMatchObject({ note: 'A', fonte: 'Zia Rosa' })
  })

  it('la foto di un passaggio nuovo dipende dal nuovo procedimento: non si approva senza', async () => {
    await ok(proponi(bruno, 'p1', (x) => (x.procedimento = ['Impastare', 'Cuocere', 'Decorare'])))
    expect((await fotoProposta(bruno, 'p1', 'f-dec', 2)).statusCode).toBe(201)
    expect((await fotoProposta(bruno, 'p1', 'f-x', 5)).statusCode).toBe(422)
    expect(await regola(decidi(anna, 'p1', { foto: 'approvata' }))).toBe('dipendenza')
    await ok(decidi(anna, 'p1', { foto: 'approvata', procedimento: 'approvata' }))
    expect((await torta()).foto).toEqual([expect.objectContaining({ id: 'f-dec', passo: 2 })])
  })

  it('ritiro: la traccia resta, le foto proposte spariscono; ritira solo l\'autore', async () => {
    await ok(proponi(bruno, 'p1', (x) => (x.note = 'B')))
    expect((await fotoProposta(bruno, 'p1', 'f1')).statusCode).toBe(201)
    expect((await anna.scrivi('POST', `${P}/proposte/p1/ritira`, { versione: 1 })).statusCode).toBe(403)
    const r = await ok(bruno.scrivi('POST', `${P}/proposte/p1/ritira`, { versione: (await leggiProposta(bruno, 'p1')).versione }))
    expect(r).toMatchObject({ stato: 'ritirata' })
    expect(r.modifiche.map((m: { stato: string }) => m.stato)).toEqual(['ritirata', 'ritirata'])
    expect((await bruno.leggi(`${P}/foto/f1`)).statusCode).toBe(404)
    expect(SchemaProposte.parse(await ok(anna.leggi(`${P}/piatti/torta/proposte`))).proposte).toHaveLength(1)
  })

  it('chiarimenti fra proprietario e autore, con notifica all\'altro', async () => {
    await ok(proponi(bruno, 'p1', (x) => (x.note = 'C')))
    await ok(anna.scrivi('POST', `${P}/proposte/p1/chiarimenti`, { testo: 'Che farina usi?' }))
    expect((await notifiche(bruno)).find((x) => x.tipo === 'modifica_ricetta')?.testo).toBe('Anna sulla proposta per «Torta della nonna»: Che farina usi?')
    expect((await t.scrivi('POST', `${P}/proposte/p1/chiarimenti`, { testo: 'Io?' })).statusCode).toBe(404)
  })
})

describe('cronologia e ripristino', () => {
  it('il proprietario torna a una versione: revisione nuova, foto e memoria intatte, versione controllata', async () => {
    await ok(t.inietta({ method: 'POST', url: `${P}/piatti/torta/foto?id=f-ufficiale`, headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg', cookie: anna.cookie! }, payload: jpeg() }))
    await ok(bruno.scrivi('POST', `${P}/piatti/torta/memorie`, { id: 'm1', tipo: 'ricordo', testo: 'La domenica' }))
    const v = (await torta()).versione
    await ok(anna.scrivi('PUT', `${P}/piatti/torta`, { ...contenuto(await torta()), nome: 'Torta nuova', tempoCotturaMin: 40, versione: v }))
    const c = await ok(anna.leggi(`${P}/piatti/torta/cronologia`))
    const iniziale = c.revisioni.find((r: { tipo: string }) => r.tipo === 'iniziale')
    expect(iniziale.ripristinabile).toBe(true)
    expect((await ok(bruno.leggi(`${P}/piatti/torta/cronologia`))).revisioni[0].ripristinabile).toBe(false)
    expect((await bruno.scrivi('POST', `${P}/piatti/torta/ripristina`, { revisioneId: iniziale.id, versione: c.versionePiatto })).statusCode).toBe(403)
    expect((await anna.scrivi('POST', `${P}/piatti/torta/ripristina`, { revisioneId: iniziale.id, versione: c.versionePiatto - 1 })).statusCode).toBe(409)
    await ok(anna.scrivi('POST', `${P}/piatti/torta/ripristina`, { revisioneId: iniziale.id, versione: c.versionePiatto }))
    const r = await torta()
    expect(r).toMatchObject({ nome: 'Torta della nonna', tempoCotturaMin: 30, foto: [expect.objectContaining({ id: 'f-ufficiale' })] })
    expect(r.ingredienti.map((i: { testoOriginale: string }) => i.testoOriginale)).toEqual(['400 g farina', '3 uova', '100 g burro'])
    const dopo = await ok(anna.leggi(`${P}/piatti/torta/cronologia`))
    expect(dopo.revisioni[0]).toMatchObject({ tipo: 'ripristino', ripristinaNumero: iniziale.numero })
    expect(dopo.revisioni.length).toBe(c.revisioni.length + 1)
    expect((await ok(anna.leggi(`${P}/piatti/torta/memoria`))).ricordi).toHaveLength(1)
  })
})

describe('proprietà', () => {
  it('trasferimento volontario: rifiutato, poi accettato; stesso id, foto, memoria, cronologia; le proposte passano al nuovo proprietario', async () => {
    await ok(t.inietta({ method: 'POST', url: `${P}/piatti/torta/foto?id=f-ufficiale`, headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg', cookie: anna.cookie! }, payload: jpeg() }))
    await ok(anna.scrivi('PUT', `${P}/piatti/torta/storia`, { testo: 'Di nonna Lina', pubblica: false }))
    await ok(proponi(t, 'p-loris', (x) => (x.note = 'Dalla zia')))
    const ev = await ok(anna.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Pranzo', data: '2030-01-10', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 4, bambini: 0, note: '', gruppoId: G }))
    await ok(anna.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v1', portataId: ev.portate[4].id, nome: 'Torta', piattoId: 'torta' }] }))
    // Solo a un membro della Famiglia della ricetta.
    expect(await regola(anna.scrivi('POST', `${P}/piatti/torta/trasferimento`, { id: 'tx', a: estraneo.id, versionePiatto: (await torta()).versione }))).toBe('destinatario')
    const tr = await ok(anna.scrivi('POST', `${P}/piatti/torta/trasferimento`, { id: 't1', a: bruno.id, versionePiatto: (await torta()).versione }))
    expect((await notifiche(bruno)).find((x) => x.tipo === 'proprieta_ricetta')?.testo).toBe('Anna ti propone di diventare proprietario di «Torta della nonna»')
    expect((await t.scrivi('POST', `${P}/trasferimenti/t1/decisione`, { esito: 'accetta', versione: tr.versione })).statusCode).toBe(404)
    await ok(bruno.scrivi('POST', `${P}/trasferimenti/t1/decisione`, { esito: 'rifiuta', versione: tr.versione }))
    expect((await torta()).mio).toBe(true)
    const t2 = await ok(anna.scrivi('POST', `${P}/piatti/torta/trasferimento`, { id: 't2', a: bruno.id, versionePiatto: (await torta()).versione }))
    expect(await regola(anna.scrivi('POST', `${P}/piatti/torta/trasferimento`, { id: 't3', a: bruno.id, versionePiatto: (await torta()).versione }))).toBe('trasferimento_in_corso')
    await ok(bruno.scrivi('POST', `${P}/trasferimenti/t2/decisione`, { esito: 'accetta', versione: t2.versione }))
    const r = await torta(bruno)
    expect(r).toMatchObject({ id: 'torta', mio: true, famigliaOrigine: { id: G }, famiglie: [{ id: G }], foto: [expect.objectContaining({ id: 'f-ufficiale' })] })
    expect((await ok(bruno.leggi(`${P}/piatti/torta/memoria`))).storia.testo).toBe('Di nonna Lina')
    expect(uno(t.db, "SELECT count(*) AS n FROM piatti WHERE nome = 'Torta della nonna' AND famiglia_origine_id IS NOT NULL")).toEqual({ n: 2 })
    // L'evento di Anna non dipende dalla ricetta di Bruno: è passato a una sua copia.
    const voce = uno<{ piatto_id: string }>(t.db, "SELECT piatto_id FROM voci_menu WHERE id = 'v1'")!
    expect(voce.piatto_id).not.toBe('torta')
    expect(uno(t.db, 'SELECT proprietario_id FROM piatti WHERE id = ?', voce.piatto_id)).toEqual({ proprietario_id: anna.id })
    // Le proposte in attesa ora le decide Bruno; Anna non è più proprietaria.
    expect((await anna.leggi(`${P}/proposte/p-loris`)).statusCode).toBe(404)
    expect((await leggiProposta(bruno, 'p-loris')).puoDecidere).toBe(true)
    expect((await ok(bruno.leggi(`${P}/piatti/torta/cronologia`))).revisioni[0]).toMatchObject({ tipo: 'trasferimento', autore: { nome: 'Anna' }, approvatoDa: { nome: 'Bruno' } })
    expect((await notifiche(anna)).some((x) => x.testo === '«Torta della nonna» ora è di Bruno')).toBe(true)
    // Anna resta nella Famiglia: ora può proporre modifiche.
    expect((await proponi(anna, 'p-anna', (x) => (x.note = 'Mia idea'))).statusCode).toBe(201)
  })

  it('un trasferimento decade se intanto la ricetta diventa privata', async () => {
    const tr = await ok(anna.scrivi('POST', `${P}/piatti/torta/trasferimento`, { id: 't1', a: bruno.id, versionePiatto: (await torta()).versione }))
    await ok(anna.scrivi('PUT', `${P}/piatti/torta/famiglie`, { gruppi: [] }))
    expect(await regola(bruno.scrivi('POST', `${P}/trasferimenti/t1/decisione`, { esito: 'accetta', versione: tr.versione }))).toBe('trasferimento_decaduto')
    expect((await torta()).mio).toBe(true)
  })

  it('riassegnazione amministrativa: motivazione, accettazione, cronologia; mai sulle ricette private', async () => {
    expect((await anna.scrivi('POST', `${P}/piatti/torta/riassegnazione`, { id: 'r0', a: bruno.id, motivazione: 'x' })).statusCode).toBe(403)
    expect((await t.scrivi('POST', `${P}/piatti/torta/riassegnazione`, { id: 'r0', a: bruno.id, motivazione: ' ' })).statusCode).toBe(400)
    expect((await ok(t.leggi(`${P}/piatti/torta/riassegnazione`))).map((x: { nome: string }) => x.nome).sort()).toEqual(['Bruno', 'Loris'])
    const r = await ok(t.scrivi('POST', `${P}/piatti/torta/riassegnazione`, { id: 'r1', a: bruno.id, motivazione: 'Anna non usa più l\'app' }))
    expect(r).toMatchObject({ tipo: 'amministrativo', stato: 'in_attesa' })
    expect((await notifiche(anna)).find((x) => x.tipo === 'proprieta_ricetta')?.testo).toBe('Loris propone di riassegnare «Torta della nonna»: Anna non usa più l\'app')
    await ok(bruno.scrivi('POST', `${P}/trasferimenti/r1/decisione`, { esito: 'accetta', versione: r.versione }))
    expect((await torta(bruno)).mio).toBe(true)
    expect((await ok(bruno.leggi(`${P}/piatti/torta/cronologia`))).revisioni[0]).toMatchObject({ tipo: 'riassegnazione', autore: { nome: 'Loris' }, motivazione: 'Anna non usa più l\'app' })
    // Privata: per l'amministratore non esiste; non ne vede il contenuto.
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'segreta', nome: 'Segreta', visibilita: 'privata' }))
    expect((await t.scrivi('POST', `${P}/piatti/segreta/riassegnazione`, { id: 'r2', a: anna.id, motivazione: 'x' })).statusCode).toBe(404)
    expect((await t.leggi(`${P}/piatti/segreta`)).statusCode).toBe(404)
    // A sé stesso: già accettata.
    await ok(t.scrivi('POST', `${P}/piatti/torta/riassegnazione`, { id: 'r3', a: ID_AMMINISTRATORE, motivazione: 'Bruno è partito' }))
    expect((await torta(t)).mio).toBe(true)
  })
})

describe('copie ed eventi', () => {
  it('le modifiche approvate non toccano le copie; una proposta in attesa non cambia la spesa', async () => {
    const ev = await ok(anna.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Pranzo', data: '2030-01-10', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 8, bambini: 0, note: '', gruppoId: G }))
    await ok(anna.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v1', portataId: ev.portate[4].id, nome: 'Torta', piattoId: 'torta' }] }))
    const spesa = async () => (corpo(await anna.leggi(`${P}/eventi/ev/spesa`)).voci as { nome: string; quantita: number | null }[]).find((x) => x.nome === 'farina')
    const prima = await spesa()
    await ok(t.scrivi('POST', `${P}/famiglie`, { id: 'altra', nome: 'Altra' }))
    await ok(t.scrivi('POST', `${P}/piatti/torta/copia-in-famiglia`, { id: 'copia', gruppoId: 'altra' }))
    await ok(proponi(bruno, 'p1', (x) => (x.ingredienti = x.ingredienti.map((i: { id: string }) => (i.id === 'i-farina' ? ing('i-farina', '500 g farina', 'farina', 500) : i)))))
    expect(await spesa()).toEqual(prima)
    await ok(decidi(anna, 'p1', { 'ingrediente:farina': 'approvata' }))
    expect((await ok(t.leggi(`${P}/piatti/copia`))).ingredienti[0].quantita).toBe(400)
    expect(await spesa()).not.toEqual(prima)
  })

  it('eliminare la ricetta elimina le sue proposte', async () => {
    await ok(proponi(bruno, 'p1', (x) => (x.note = 'D')))
    const v = (await torta()).versione
    await ok(anna.scrivi('DELETE', `${P}/piatti/torta?versione=${v}`))
    expect((await bruno.leggi(`${P}/proposte/p1`)).statusCode).toBe(404)
    expect(tutti(t.db, 'SELECT * FROM proposte_piatto')).toEqual([])
  })
})
