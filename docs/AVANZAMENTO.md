# Avanzamento — Menù & Co.

Documento operativo per riprendere il lavoro fra sessioni.

## Stato

- **Milestone**: M0–M4 implementate e collaudate in locale. Mancano solo le operazioni che
  richiedono autorizzazione: merge su `main`, push, installazione del servizio, primo
  rilascio, `tailscale serve :9870`, collaudo manuale sui dispositivi.
- **Branch di lavoro**: `m0-fondamenta` (contiene anche `docs-spec`); `main` fermo a `300a2d7`.
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

Non eseguiti (richiedono autorizzazione o dispositivi reali): installazione systemd,
`tailscale serve :9870`, collaudo manuale (`docs/collaudo/collaudo-v1.md`).

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

Con autorizzazione: merge di `m0-fondamenta` su `main` e push → `scripts/rilascia.sh
--senza-riavvio` → `scripts/installa-servizio.sh` (con `tailscale serve :9870`) → collaudo
manuale → disattivazione di GitHub Pages da parte di Loris.
