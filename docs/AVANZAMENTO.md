# Avanzamento — Menù & Co.

Documento operativo per riprendere il lavoro fra sessioni.

## Stato

- **v0.1.0 in produzione dal 12/11/2026**: https://loris-srv01.dala-tortoise.ts.net:9870/
  (rilascio `20261112-1321-0d8d6fc`, `menuapp.service` e `menuapp-backup.timer` attivi e
  abilitati, `tailscale serve :9870`, porta non raggiungibile dalla LAN, altri servizi invariati).
- **Branch**: `main` (pubblicato su GitHub); sviluppo successivo su nuovi branch.
- **Sviluppo**: tmux `menuapp` (finestre `server` → 9871 con `dati-sviluppo/`, `dev` → Vite 5173,
  telefono via `…ts.net:8443`). Nessun servizio di produzione installato.

## Completato

- M0: schema SQLite completo con vincoli e migrazioni (backup pre-migrazione, codice 78),
  backend Fastify con contratto zod, Origin/Content-Type, versioni e revisione globale,
  backup verificati con rotazione e timer, esportazione con impronta canonica, ripristino
  in due passi, frontend con sola lettura e conflitti, PWA con avviso di aggiornamento,
  CI di soli controlli, script di servizio/rilascio/ritorno/emergenza (provati in locale).
- M1: eventi e stati, portate per evento, voci con inserimento rapido e multiriga, modifica,
  riordino e spostamento, eliminazione con annulla, impostazioni.
- M2: ricettario, «Crea nel ricettario», catalogo di 248 ingredienti, reparti, parser
  (112 casi, 100 % previsti), editor ingredienti con anteprima e correzione, vista cucina.
- M3: spesa calcolata e riconciliata sul server (6 classi di contributo, R1–R10, fabbisogno
  coperto stabilito dal server), stati, correzioni, facoltativi, manuali, pulizia,
  trasferimento, condivisione.
- M4: piano delle attività con scelte rapide e spostamento, preparazioni dalle voci, stampa
  A4/A5, archiviazione con snapshot autonomo, consultazione e vista cucina da snapshot,
  copia nel ricettario, riapertura.

## Test (ultima esecuzione)

| Comando | Esito |
|---|---|
| `npm run check` (lint, tipi, 178 test: dominio, server su SQLite reale, architettura, build) | verde |
| `npm run test:e2e` (13 scenari telefono + desktop, incluso collaudo di Natale da due dispositivi) | verde |
| Rilascio di prova costruito con `scripts/rilascia.sh` e avviato su 9872 | ok (poi rimosso) |

Produzione verificata il 12/11: salute via HTTPS, backup manuale verificato, `sw.js` no-cache,
LAN 9870 chiusa. Da fare: collaudo manuale sui dispositivi (`docs/collaudo/collaudo-v1.md`).

## Decisioni tecniche

- Nomi del codice in italiano; vedi registro SPEC 2.1 per gli scostamenti dal documento.
- Componenti UI scritti a mano in stile shadcn (radix-ui + cva), `<select>` nativi.
- Schermate caricate a richiesta (bundle iniziale ~410 kB).
- Test e2e: server reale su 127.0.0.1:4174 con `test-results/dati-e2e`, Chrome di sistema.

## Problemi aperti

- Nessun test per l'avviso di aggiornamento PWA con due build reali (verificato solo che
  il service worker metta in cache il guscio e mai `/api`): da provare a mano al secondo rilascio.
- Copia dei backup su un secondo supporto: decisione aperta (SPEC §11.6).
- Trascinamento per il riordino non implementato (taglio previsto): Su/Giù/Sposta in.

## Prossima attività

Collaudo manuale di Loris sui dispositivi e disattivazione di GitHub Pages; poi rifiniture
concordate. Nota: l'installazione di servizi systemd da Claude è bloccata dal controllo dei
permessi: Loris la esegue con `! comando`.

## In corso (branch `grafica`, non ancora su `main` né in produzione)

- Grafica più elegante: font inclusi (Fraunces per i titoli, Inter per il testo), nuova
  palette calda con salvia e filetti oro, ombre morbide, illustrazioni SVG proprie
  (`src/components/Illustrazioni.tsx`) scelte per occasione, riquadro del prossimo evento.
- Misure in rem con dimensione del testo automatica sugli schermi grandi (Echo Show 15,
  1920×1080: 143,75 %) e preferenza per dispositivo in Impostazioni.
- Controllo visivo: `npx playwright test test/e2e/vetrina.spec.ts` → `test-results/vetrina/`.
- Notifiche in rem (leggibili sull'Echo Show).
- Accesso dalla rete di casa senza Tailscale su `:9880` (SPEC 2.2), provato in HTTP a 1920×1080.
- Da fare: rilascio (merge su main con autorizzazione; Loris rilancia `installa-servizio.sh`
  per aggiungere `MENUAPP_PORTA_LAN` all'unità).
- Aperto: standard di importazione ricette con foto (proposta da definire con Loris).
