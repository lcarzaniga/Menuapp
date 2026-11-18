// Console di amministrazione, solo dal terminale del server (SPEC §19.2): primo accesso e
// recupero dell'amministratore senza credenziali predefinite né rotte pubbliche.
//
//   node server/amministrazione.ts stato
//   node server/amministrazione.ts invito [nome utente] [--url https://…]
//   node server/amministrazione.ts approva <codice>      (es. K7P-M2Q)
//   node server/amministrazione.ts rifiuta <codice>
//   node server/amministrazione.ts sessioni
//   node server/amministrazione.ts revoca <id sessione | nome utente>
//
// In produzione: scripts/amministra.sh, che usa i dati e il Node del servizio.
import { leggiConfig } from './config.ts'
import { versioneSchema } from './db/connessione.ts'
import { apriDatabase, chiudiDatabase } from './db/sqlite-node.ts'
import { norm } from '../src/domain/testo.ts'
import * as identita from './servizi/identita.ts'

const SCHEMA_MINIMO = 5

function argomento(nome: string): string | undefined {
  const i = process.argv.indexOf(nome)
  return i > 0 ? process.argv[i + 1] : undefined
}
const posizionali = process.argv.slice(2).filter((a, i, tutti) => !a.startsWith('--') && !tutti[i - 1]?.startsWith('--'))
const [comando = 'stato', ...resto] = posizionali

const config = leggiConfig()
const db = apriDatabase(config.percorsoDb)
const data = (ms: number) => new Date(ms).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })

function utentePerNome(nome: string | undefined) {
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

function richiestaPerCodice(codice: string | undefined) {
  if (!codice) throw new Error('Indica il codice mostrato dal dispositivo (es. K7P-M2Q)')
  const r = identita.richiesteInAttesa(db, null).find((x) => x.codice === codice.toUpperCase() || x.id === codice)
  if (!r) throw new Error(`Nessuna richiesta in attesa con codice ${codice}`)
  return r
}

try {
  if (versioneSchema(db) < SCHEMA_MINIMO) throw new Error(`Il database è allo schema ${versioneSchema(db)}: avvia prima il servizio aggiornato`)
  switch (comando) {
    case 'stato': {
      for (const u of identita.elencaUtenti(db)) console.log(`${u.nome.padEnd(20)} ${u.ruolo.padEnd(15)} ${u.stato}`)
      const richieste = identita.richiesteInAttesa(db, null)
      console.log(richieste.length ? `\nRichieste in attesa:` : '\nNessuna richiesta in attesa.')
      for (const r of richieste) console.log(`  ${r.codice}  ${r.utenteNome} — ${r.dispositivo || 'dispositivo senza nome'} (${data(r.creatoIl)})`)
      break
    }
    case 'invito': {
      const u = utentePerNome(resto.join(' ') || undefined)
      const url = argomento('--url') ?? config.urlPubblico ?? config.urlPrivato
      if (!url) throw new Error('Indica l\'indirizzo dell\'app con --url https://… (o configura MENUAPP_URL_PRIVATO)')
      const i = identita.creaInvito(db, null, u.id, url)
      console.log(`Invito per ${u.nome}, valido fino al ${data(i.scadeIl)} e utilizzabile una sola volta:\n\n  ${i.link}\n`)
      console.log('Aprilo sul dispositivo da autorizzare, poi approva con: approva <codice mostrato>')
      break
    }
    case 'approva':
    case 'rifiuta': {
      const r = richiestaPerCodice(resto[0])
      identita.decidiRichiesta(db, null, r.id, comando)
      console.log(`${comando === 'approva' ? 'Approvata' : 'Rifiutata'} la richiesta ${r.codice} di ${r.utenteNome} (${r.dispositivo || 'dispositivo senza nome'}).`)
      break
    }
    case 'sessioni': {
      for (const s of identita.elencaSessioni(db, { id: '', nome: '', ruolo: 'amministratore', sessioneId: '', ingresso: 'privato' }, true)) {
        console.log(`${s.id}  ${s.utenteNome.padEnd(16)} ${(s.dispositivo || '—').padEnd(24)} ultimo uso ${data(s.ultimoUso)}`)
      }
      break
    }
    case 'revoca': {
      const bersaglio = resto.join(' ')
      const sessioni = identita.elencaSessioni(db, { id: '', nome: '', ruolo: 'amministratore', sessioneId: '', ingresso: 'privato' }, true)
      const scelte = sessioni.some((s) => s.id === bersaglio) ? sessioni.filter((s) => s.id === bersaglio) : sessioni.filter((s) => s.utenteId === utentePerNome(bersaglio).id)
      for (const s of scelte) identita.revocaSessione(db, null, s.id)
      console.log(`Sessioni revocate: ${scelte.length}`)
      break
    }
    default:
      throw new Error(`Comando sconosciuto: ${comando}. Comandi: stato, invito, approva, rifiuta, sessioni, revoca`)
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
} finally {
  chiudiDatabase(db)
}
