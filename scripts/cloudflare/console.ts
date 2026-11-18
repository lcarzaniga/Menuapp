// Console amministrativa dell'installazione Cloudflare (SPEC §32.4), dal PC o dal server:
//
//   MENUAPP_CODICE_CONSOLE=… node scripts/cloudflare/console.ts stato
//   … invito [nome utente]        link d'invito monouso (primo amministratore, recupero)
//   … approva <codice>            approva la richiesta del dispositivo (es. K7P-M2Q)
//   … rifiuta <codice>
//   … sessioni | revoca <id sessione | nome utente>
//   … backup                      backup presenti in R2
//   … ripristina <nome backup>    ripristino (salva prima i dati attuali)
//   … utenti | proponi | piano | importa | verifica <id>   migrazione da Debian (usare scripts/cloudflare/migra.ts)
//
// Funziona solo mentre sul Worker è impostato lo stesso segreto (wrangler secret put
// MENUAPP_CODICE_CONSOLE); indirizzo da MENUAPP_URL (predefinito https://app.ricettedifamiglia.online).
import { chiamaConsole, codiceConsole } from './rete.ts'

const url = (process.env.MENUAPP_URL ?? 'https://app.ricettedifamiglia.online').replace(/\/+$/, '')
const codice = codiceConsole()
const [comando = 'stato', ...argomenti] = process.argv.slice(2)

if (!codice) {
  console.error('Console non attiva: scripts/cloudflare/console.sh attiva')
  process.exit(1)
}
const corpo = await chiamaConsole(url, codice, comando, argomenti)
if (corpo.stato === 404) {
  console.error('Console non attiva: imposta il segreto con «npx wrangler secret put MENUAPP_CODICE_CONSOLE»')
  process.exit(1)
}
if (corpo.stato >= 300 || !corpo.testo) {
  console.error(corpo.errore?.messaggio ?? `Errore ${corpo.stato}`)
  process.exit(1)
}
console.log(corpo.testo)
