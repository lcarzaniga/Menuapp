// Console amministrativa dell'installazione Cloudflare (SPEC §32.4), dal PC o dal server:
//
//   MENUAPP_CODICE_CONSOLE=… node scripts/cloudflare/console.ts stato
//   … invito [nome utente]        link d'invito monouso (primo amministratore, recupero)
//   … approva <codice>            approva la richiesta del dispositivo (es. K7P-M2Q)
//   … rifiuta <codice>
//   … sessioni | revoca <id sessione | nome utente>
//   … backup                      backup presenti in R2
//   … ripristina <nome backup>    ripristino (salva prima i dati attuali)
//
// Funziona solo mentre sul Worker è impostato lo stesso segreto (wrangler secret put
// MENUAPP_CODICE_CONSOLE); indirizzo da MENUAPP_URL (predefinito https://ricettedifamiglia.online).
const url = (process.env.MENUAPP_URL ?? 'https://ricettedifamiglia.online').replace(/\/+$/, '')
const codice = process.env.MENUAPP_CODICE_CONSOLE
const [comando = 'stato', ...argomenti] = process.argv.slice(2)

if (!codice) {
  console.error('Imposta MENUAPP_CODICE_CONSOLE con il segreto della console')
  process.exit(1)
}
const r = await fetch(`${url}/api/v1/console`, {
  method: 'POST',
  headers: { authorization: `Bearer ${codice}`, 'content-type': 'application/json' },
  body: JSON.stringify({ comando, argomenti }),
})
const corpo = (await r.json().catch(() => null)) as { testo?: string; errore?: { messaggio: string } } | null
if (r.status === 404) {
  console.error('Console non attiva: imposta il segreto con «npx wrangler secret put MENUAPP_CODICE_CONSOLE»')
  process.exit(1)
}
if (!r.ok || !corpo?.testo) {
  console.error(corpo?.errore?.messaggio ?? `Errore ${r.status}`)
  process.exit(1)
}
console.log(corpo.testo)
