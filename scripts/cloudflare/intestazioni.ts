// Scrive dist-cloudflare/_headers (Static Assets di Cloudflare) con le stesse intestazioni di
// sicurezza e di cache del server Debian (server/api/applicazione.ts, server/app.ts).
import { writeFileSync } from 'node:fs'
import { SICUREZZA } from '../../server/api/applicazione.ts'

const cartella = process.argv[2] ?? 'dist-cloudflare'
const tutte = Object.entries(SICUREZZA).map(([k, v]) => `  ${k}: ${v}`)
const testo = [
  '# Generato da scripts/cloudflare/intestazioni.ts: non modificare a mano.',
  '/*',
  ...tutte,
  '  cache-control: no-cache',
  // File con hash nel nome: immutabili (tranne i file del service worker, che non stanno in /assets).
  '/assets/*',
  '  ! cache-control',
  '  cache-control: public, max-age=31536000, immutable',
  '',
].join('\n')
writeFileSync(`${cartella}/_headers`, testo)
console.log(`Scritto ${cartella}/_headers`)
