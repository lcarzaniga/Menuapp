// Console amministrativa di Cloudflare (SPEC §32.4): sostituisce il terminale del server per
// il primo amministratore, il recupero dell'accesso e il ripristino. Esiste solo mentre è
// impostato il segreto MENUAPP_CODICE_CONSOLE (`wrangler secret put`, poi `wrangler secret
// delete`); senza segreto risponde 404 come una rotta inesistente. La usa scripts/cloudflare/console.ts.
import { createHash, timingSafeEqual } from 'node:crypto'
import { norm } from '../src/domain/testo.ts'
import { Limitatore } from '../server/api/limiti.ts'
import type { Db } from '../server/db/connessione.ts'
import * as identita from '../server/servizi/identita.ts'
import type { UtenteCorrente } from '../server/servizi/permessi.ts'
import { elencaBackupR2, ripristinaDaR2 } from './backup.ts'
import { importa, leggiEsportazione, preparaPiano, proponiCorrispondenza, verificaImportazione } from './importazione.ts'

export const PERCORSO_CONSOLE = '/api/v1/console'
const LUNGHEZZA_MINIMA = 32
const tentativi = new Limitatore(10, 15 * 60_000)

const SISTEMA: UtenteCorrente = { id: '', nome: 'console', ruolo: 'amministratore', sessioneId: '', ingresso: 'unico' }

interface Ambito {
  db: Db
  bucket: R2Bucket
  codice: string | undefined
  urlInviti: string
  versioneApp: string
  ip: string
  /** Durante il ripristino le altre richieste rispondono 503. */
  manutenzione: (attiva: boolean) => void
}

const json = (stato: number, corpo: unknown) => Response.json(corpo, { status: stato, headers: { 'cache-control': 'no-store' } })
const impronta = (s: string) => createHash('sha256').update(s).digest()

function autorizzata(req: Request, codice: string | undefined): boolean {
  if (!codice || codice.length < LUNGHEZZA_MINIMA) return false
  const dato = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1] ?? ''
  return timingSafeEqual(impronta(dato), impronta(codice))
}

function utentePerNome(db: Db, nome: string | undefined) {
  const utenti = identita.elencaUtenti(db)
  if (!nome) {
    const admin = utenti.find((u) => u.ruolo === 'amministratore' && u.stato === 'attivo')
    if (!admin) throw new Error('Nessun amministratore attivo')
    return admin
  }
  const u = utenti.find((x) => norm(x.nome) === norm(nome))
  if (!u) throw new Error(`Utente «${nome}» inesistente. Utenti: ${utenti.map((x) => x.nome).join(', ')}`)
  return u
}

function richiestaPerCodice(db: Db, codice: string | undefined) {
  if (!codice) throw new Error('Indica il codice mostrato dal dispositivo (es. K7P-M2Q)')
  const r = identita.richiesteInAttesa(db, null).find((x) => x.codice === codice.toUpperCase() || x.id === codice)
  if (!r) throw new Error(`Nessuna richiesta in attesa con codice ${codice}`)
  return r
}

const data = (ms: number) => new Date(ms).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Rome' })

export async function gestisciConsole(req: Request, a: Ambito): Promise<Response> {
  if (!a.codice || a.codice.length < LUNGHEZZA_MINIMA) return json(404, { errore: { codice: 'non_trovato', messaggio: 'Risorsa non trovata' } })
  if (req.method !== 'POST') return json(404, { errore: { codice: 'non_trovato', messaggio: 'Risorsa non trovata' } })
  if (!tentativi.prova(a.ip)) return json(429, { errore: { codice: 'troppi_tentativi', messaggio: 'Troppi tentativi, riprova più tardi' } })
  if (!autorizzata(req, a.codice)) return json(401, { errore: { codice: 'non_autenticato', messaggio: 'Codice della console errato' } })
  const { comando = 'stato', argomenti = [] } = (await req.json().catch(() => ({}))) as { comando?: string; argomenti?: string[] }
  const { db } = a
  try {
    const righe: string[] = []
    let dati: unknown
    switch (comando) {
      case 'stato': {
        for (const u of identita.elencaUtenti(db)) righe.push(`${u.nome.padEnd(20)} ${u.ruolo.padEnd(15)} ${u.stato}`)
        const richieste = identita.richiesteInAttesa(db, null)
        righe.push(richieste.length ? '\nRichieste in attesa:' : '\nNessuna richiesta in attesa.')
        for (const r of richieste) righe.push(`  ${r.codice}  ${r.utenteNome} — ${r.dispositivo || 'dispositivo senza nome'} (${data(r.creatoIl)})`)
        break
      }
      case 'invito': {
        const u = utentePerNome(db, argomenti.join(' ') || undefined)
        const i = identita.creaInvito(db, null, u.id, a.urlInviti)
        righe.push(`Invito per ${u.nome}, valido fino al ${data(i.scadeIl)} e utilizzabile una sola volta:\n\n  ${i.link}\n`)
        righe.push('Aprilo sul dispositivo da autorizzare, poi approva con: approva <codice mostrato>')
        break
      }
      case 'approva':
      case 'rifiuta': {
        const r = richiestaPerCodice(db, argomenti[0])
        identita.decidiRichiesta(db, null, r.id, comando)
        righe.push(`${comando === 'approva' ? 'Approvata' : 'Rifiutata'} la richiesta ${r.codice} di ${r.utenteNome} (${r.dispositivo || 'dispositivo senza nome'}).`)
        break
      }
      case 'sessioni': {
        for (const s of identita.elencaSessioni(db, SISTEMA, true)) righe.push(`${s.id}  ${s.utenteNome.padEnd(16)} ${(s.dispositivo || '—').padEnd(24)} ultimo uso ${data(s.ultimoUso)}`)
        break
      }
      case 'revoca': {
        const bersaglio = argomenti.join(' ')
        const sessioni = identita.elencaSessioni(db, SISTEMA, true)
        const scelte = sessioni.some((s) => s.id === bersaglio) ? sessioni.filter((s) => s.id === bersaglio) : sessioni.filter((s) => s.utenteId === utentePerNome(db, bersaglio).id)
        for (const s of scelte) identita.revocaSessione(db, null, s.id)
        righe.push(`Sessioni revocate: ${scelte.length}`)
        break
      }
      case 'backup': {
        for (const b of await elencaBackupR2(a.bucket)) righe.push(`${b.nome}  ${(b.byte / 1024).toFixed(0)} kB  ${b.conteggi.eventi ?? 0} eventi`)
        if (righe.length === 0) righe.push('Nessun backup.')
        break
      }
      case 'ripristina': {
        const nome = argomenti[0]
        if (!nome) throw new Error('Indica il nome del backup (comando: backup)')
        a.manutenzione(true)
        try {
          const esito = await ripristinaDaR2(db, a.bucket, nome, a.versioneApp)
          righe.push(`Ripristinato ${nome}. Dati precedenti salvati in ${esito.backupPrecedente}.`)
          righe.push(`Contenuto: ${Object.entries(esito.conteggi).filter(([, n]) => n > 0).map(([t, n]) => `${t} ${n}`).join(', ')}`)
          if (esito.fotoMancanti.length) righe.push(`File di foto non recuperati: ${esito.fotoMancanti.join(', ')}`)
        } finally {
          a.manutenzione(false)
        }
        break
      }
      // ── Migrazione dei contenuti da Debian (SPEC §33) ──
      case 'proponi': {
        const id = argomenti[0] ?? ''
        const p = proponiCorrispondenza(db, await leggiEsportazione(a.bucket, id), id)
        dati = p.corrispondenza
        righe.push(p.problemi.length ? `Da decidere:\n${p.problemi.map((x) => `  - ${x}`).join('\n')}` : 'Nessuna omonimia: ogni utente Debian ha un solo corrispondente su Cloudflare.')
        break
      }
      case 'piano': {
        const p = await preparaPiano(db, a.bucket, argomenti[0] ?? '')
        righe.push('Controlli superati, nessuna modifica fatta. L\'importazione:')
        for (const [d, c] of p.mappa) righe.push(`  utente ${d} → ${c}`)
        if (p.nuovi.length) righe.push(`  nuovi utenti senza dispositivi: ${p.nuovi.map((u) => u.nome).join(', ')}`)
        righe.push(`  ${p.file.length} file di foto e allegati verificati`)
        righe.push(`  contenuti: ${Object.entries(p.esportazione.conteggi).filter(([t, n]) => n > 0 && !['utenti', 'sessioni', 'meta'].includes(t)).map(([t, n]) => `${t} ${n}`).join(', ')}`)
        break
      }
      case 'importa': {
        a.manutenzione(true)
        try {
          const esito = await importa(db, a.bucket, argomenti[0] ?? '', a.versioneApp)
          righe.push(`Importazione completata. Stato precedente salvato in ${esito.backupPrecedente} (annullamento: ripristina ${esito.backupPrecedente}).`)
          if (esito.nuoviUtenti.length) righe.push(`Nuovi utenti senza dispositivi: ${esito.nuoviUtenti.join(', ')}`)
        } finally {
          a.manutenzione(false)
        }
        break
      }
      case 'verifica': {
        const problemi = await verificaImportazione(db, a.bucket, argomenti[0] ?? '')
        righe.push(problemi.length ? `PROBLEMI:\n${problemi.map((x) => `  - ${x}`).join('\n')}` : 'Verifica superata: conteggi uguali a Debian, riferimenti integri, tutti i file presenti e identici.')
        if (problemi.length) dati = { problemi }
        break
      }
      case 'utenti': {
        dati = identita.elencaUtenti(db)
        for (const u of dati as { id: string; nome: string; ruolo: string }[]) righe.push(`${u.id}  ${u.nome}  ${u.ruolo}`)
        break
      }
      default:
        throw new Error(`Comando sconosciuto: ${comando}. Comandi: stato, invito, approva, rifiuta, sessioni, revoca, backup, ripristina, utenti, proponi, piano, importa, verifica`)
    }
    return json(200, { testo: righe.join('\n'), dati })
  } catch (e) {
    return json(422, { errore: { codice: 'regola_violata', messaggio: e instanceof Error ? e.message : String(e) } })
  }
}
