// Migrazione dei contenuti dal server Debian all'installazione Cloudflare (SPEC §33,
// docs/CLOUDFLARE.md «Migrazione dei dati»). Un passo alla volta, ognuno ripetibile:
//
//   node scripts/cloudflare/migra.ts prepara            backup Debian + esportazione e foto in dati/migrazione/<id>
//   node scripts/cloudflare/migra.ts carica <id>        file in R2 (zona di carico) e proposta di corrispondenza
//   (Loris controlla dati/migrazione/<id>/corrispondenza.json e mette "confermata": true)
//   node scripts/cloudflare/migra.ts conferma <id>      corrispondenza in R2 + piano di prova (nessuna modifica)
//   node scripts/cloudflare/migra.ts importa <id>       backup Cloudflare, importazione, verifica
//   node scripts/cloudflare/migra.ts verifica <id>      verifica ripetibile
//   node scripts/cloudflare/migra.ts annulla <backup>   ripristino dello stato precedente (pre-migrazione-…)
//
// Debian: solo letture e un backup manuale. Cloudflare: la console (segreto MENUAPP_CODICE_CONSOLE
// attivo) e R2 con le credenziali di ~/.config/menuapp/cloudflare.env.
// Per le prove in locale: MENUAPP_URL=http://127.0.0.1:… MENUAPP_R2_LOCALE=<cartella di wrangler dev>.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { esporta } from '../../server/backup/esportazione.ts'
import { nomeFile } from '../../server/servizi/foto.ts'
import type { TipoFoto } from '../../src/contratto/foto.ts'

const RADICE = resolve(import.meta.dirname, '../..')
const DATI = resolve(process.env.MENUAPP_DATI ?? join(RADICE, 'dati'))
const CARTELLA = (id: string) => join(DATI, 'migrazione', id)
const URL_APP = (process.env.MENUAPP_URL ?? 'https://app.ricettedifamiglia.online').replace(/\/+$/, '')
const BUCKET = 'menuapp-foto'
const [comando, argomento] = process.argv.slice(2)

function esci(messaggio: string): never {
  console.error(`✗ ${messaggio}`)
  process.exit(1)
}

async function console_(cmd: string, ...argomenti: string[]): Promise<{ testo: string; dati?: unknown }> {
  const codice = process.env.MENUAPP_CODICE_CONSOLE ?? esci('Imposta MENUAPP_CODICE_CONSOLE (segreto della console attivo sul Worker)')
  const r = await fetch(`${URL_APP}/api/v1/console`, {
    method: 'POST',
    headers: { authorization: `Bearer ${codice}`, 'content-type': 'application/json' },
    body: JSON.stringify({ comando: cmd, argomenti }),
  })
  const c = (await r.json().catch(() => null)) as { testo?: string; dati?: unknown; errore?: { messaggio: string } } | null
  if (r.status === 404) esci('Console non attiva: npx wrangler secret put MENUAPP_CODICE_CONSOLE')
  if (!r.ok || !c?.testo) esci(c?.errore?.messaggio ?? `Errore ${r.status}`)
  return { testo: c.testo, dati: c.dati }
}

function caricaInR2(chiave: string, file: string, tipo: string): void {
  const locale = process.env.MENUAPP_R2_LOCALE
  execFileSync(
    process.execPath,
    [join(RADICE, 'node_modules/wrangler/bin/wrangler.js'), 'r2', 'object', 'put', `${BUCKET}/${chiave}`, '--file', file, '--content-type', tipo,
      ...(locale ? ['--local', '--persist-to', locale] : ['--remote'])],
    { cwd: RADICE, stdio: ['ignore', 'ignore', 'inherit'] },
  )
}

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')
const idValido = (id: string | undefined) => (id && /^[0-9]{8}-[0-9]{4,6}$/.test(id) ? id : esci('Indica l\'identificativo della migrazione (es. 20261119-0930)'))

switch (comando) {
  case 'prepara': {
    const adesso = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const id = `${adesso.getFullYear()}${p(adesso.getMonth() + 1)}${p(adesso.getDate())}-${p(adesso.getHours())}${p(adesso.getMinutes())}`
    // 1. Backup completo di Debian (database verificato e foto), come quello notturno.
    const backup = execFileSync(process.execPath, [join(RADICE, 'server/backup/cli.ts'), 'manuale'], { cwd: RADICE, env: { ...process.env, MENUAPP_DATI: DATI }, encoding: 'utf8' })
    const nomeBackup = /: (manuale-\S+\.db)/.exec(backup)?.[1] ?? esci(`Backup Debian non riuscito: ${backup}`)
    console.log(`✓ Backup Debian: ${nomeBackup}`)
    // 2. Esportazione dal backup appena verificato (non dal database in uso).
    const db = new DatabaseSync(join(DATI, 'backup', nomeBackup), { readOnly: true })
    const e = esporta(db, 'migrazione', adesso)
    db.close()
    const dir = CARTELLA(id)
    mkdirSync(join(dir, 'foto'), { recursive: true })
    writeFileSync(join(dir, 'esportazione.json'), JSON.stringify(e))
    // 3. Foto e allegati, con l'impronta controllata.
    let n = 0
    for (const t of ['foto_piatti', 'allegati'] as const) {
      for (const r of (e.dati[t] ?? []) as { id: string; tipo: TipoFoto; sha256: string }[]) {
        const nome = nomeFile(r)
        const sorgente = [join(DATI, 'foto', nome), join(DATI, 'backup', 'foto', nome)].find((f) => existsSync(f)) ?? esci(`Manca il file ${nome} (${t}) anche nei backup`)
        if (sha(readFileSync(sorgente)) !== r.sha256) esci(`Il file ${nome} non corrisponde alla sua impronta`)
        copyFileSync(sorgente, join(dir, 'foto', nome))
        n++
      }
    }
    writeFileSync(join(dir, 'origine.json'), JSON.stringify({ backupDebian: nomeBackup, conteggi: e.conteggi, file: n }, null, 2))
    console.log(`✓ Esportazione ${id}: ${Object.entries(e.conteggi).filter(([, x]) => x > 0).map(([t, x]) => `${t} ${x}`).join(', ')}; ${n} file`)
    console.log(`Prossimo passo: node scripts/cloudflare/migra.ts carica ${id}`)
    break
  }
  case 'carica': {
    const id = idValido(argomento)
    const dir = CARTELLA(id)
    const e = JSON.parse(readFileSync(join(dir, 'esportazione.json'), 'utf8')) as { dati: Record<string, { id: string; tipo: TipoFoto }[]> }
    caricaInR2(`importazione/${id}/esportazione.json`, join(dir, 'esportazione.json'), 'application/json')
    let n = 0
    for (const t of ['foto_piatti', 'allegati']) {
      for (const r of e.dati[t] ?? []) {
        caricaInR2(`importazione/${id}/foto/${nomeFile(r)}`, join(dir, 'foto', nomeFile(r)), r.tipo)
        n++
      }
    }
    console.log(`✓ Caricati in R2: esportazione e ${n} file`)
    const p = await console_('proponi', id)
    writeFileSync(join(dir, 'corrispondenza.json'), `${JSON.stringify(p.dati, null, 2)}\n`)
    console.log(p.testo)
    console.log(`\nControlla ${join(dir, 'corrispondenza.json')}: ogni utente Debian → utente Cloudflare (o «nuovo»).`)
    console.log(`Se è giusta, metti "confermata": true e poi: node scripts/cloudflare/migra.ts conferma ${id}`)
    break
  }
  case 'conferma': {
    const id = idValido(argomento)
    const file = join(CARTELLA(id), 'corrispondenza.json')
    if ((JSON.parse(readFileSync(file, 'utf8')) as { confermata?: boolean }).confermata !== true) esci(`In ${file} manca "confermata": true`)
    caricaInR2(`importazione/${id}/corrispondenza.json`, file, 'application/json')
    console.log((await console_('piano', id)).testo)
    console.log(`\nSe il piano è giusto: node scripts/cloudflare/migra.ts importa ${id}`)
    break
  }
  case 'importa': {
    const id = idValido(argomento)
    console.log((await console_('importa', id)).testo)
    const v = await console_('verifica', id)
    console.log(v.testo)
    if (v.dati) esci('Verifica non superata: valuta l\'annullamento con «annulla <backup pre-migrazione>»')
    break
  }
  case 'verifica': {
    const v = await console_('verifica', idValido(argomento))
    console.log(v.testo)
    if (v.dati) process.exit(1)
    break
  }
  case 'annulla': {
    if (!argomento?.startsWith('pre-migrazione-')) esci('Indica il backup pre-migrazione-… mostrato dall\'importazione')
    console.log((await console_('ripristina', argomento)).testo)
    break
  }
  default:
    esci('Comandi: prepara, carica <id>, conferma <id>, importa <id>, verifica <id>, annulla <backup>')
}
