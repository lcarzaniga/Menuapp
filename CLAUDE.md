# Ricette di famiglia & Co. (menuapp, già «Menù & Co.»)

Web app (PWA) React + TypeScript + Vite con backend Node + Fastify e database SQLite
centrale (`node:sqlite`) sul server Debian. Un solo database condiviso da tutti i
dispositivi; multiutente con accesso su invito e dispositivi approvati (SPEC §19), spazio
collaborativo della famiglia (SPEC §20). Nome breve «Ricette & Co.»; repository, cartelle,
database, servizi, URL e identificativi tecnici restano `menuapp`. Leggi `docs/SPEC.md` (fonte di
verità) e `docs/AVANZAMENTO.md` (stato del lavoro) prima di cambiare qualcosa.

## Chi la usa e come

- L'utente è Loris e scrive in **italiano**. Interfaccia, commenti, messaggi, test e
  documentazione sono in italiano; anche i nomi nel codice di dominio.
- Si usa soprattutto da Android (PWA installata), anche da PC e tablet.

## Architettura (SPEC §12)

- `src/domain/`: logica pura (porzioni, unità, parser, spesa, regole). Niente React,
  Fastify, SQLite, Node. Condivisa da client e server; import con estensione `.ts`.
- `src/contratto/`: schemi zod delle API, unico punto che definisce i dati scambiati.
- `server/`: `api/` (rotte senza regole né SQL) → `servizi/` (transazioni, versioni,
  regole) → `db/repo/` (unico posto con SQL). Migrazioni in `server/db/migrazioni/`
  (mai modificare un file già applicato). Node esegue il TypeScript senza build.
- Frontend: `src/features/`, client in `src/api/` (TanStack Query, `useScrittura`),
  sola lettura con `usePuoScrivere()`, conflitti con `ConflittoVersione`.
- `test/architettura.test.ts` verifica le dipendenze fra livelli.
- Ogni record modificabile ha `versione`: aggiornamenti condizionati, 409 con il record
  attuale. Ogni scrittura incrementa `meta.revisione` (i client la interrogano ogni 10 s).

## Ambiente e comandi

- Node 24 via nvm (`.nvmrc`); mai il Node di sistema (`/usr/bin`, v20).
- tmux `menuapp`: finestra `server` (`npm run dev:server`, 127.0.0.1:9871, `dati-sviluppo/`)
  e `dev` (`npm run dev`, Vite 127.0.0.1:5173). Da telefono: `…ts.net:8443` (tailscale serve).
- Prima di ogni commit: `npm run check`; per le interfacce anche `npm run test:e2e`.
- Mai ascoltare su `0.0.0.0` (il server non ha firewall); mai `tailscale funnel`.

## Ambienti (docs/RILASCI.md)

- **TEST**: server Debian. Servizio utente `menuapp.service` su 127.0.0.1:9870 + `tailscale serve
  --https=9870` (solo tailnet); timer `menuapp-backup.timer` (03:45). Dati in `dati/` (fuori da Git).
  Rilasci con `scripts/rilascia.sh` in `rilasci/<id>`, collegamento `rilasci/attuale` (docs/OPERAZIONI.md).
- **PRODUZIONE**: Cloudflare, `https://app.ricettedifamiglia.online` (docs/CLOUDFLARE.md), con
  `scripts/cloudflare/rilascia.sh` solo dopo la prova su TEST e la conferma di Loris.
- Dati separati: un rilascio non porta mai dati da un ambiente all'altro.

## Regole operative

- Niente push, merge su `main`, rilasci (salvo TEST come sotto), modifiche a servizi systemd o a Tailscale,
  operazioni su dati di produzione senza autorizzazione esplicita di Loris.
- Rilasci (docs/RILASCI.md, regola dal 23/11/2026): uno sviluppo approvato da Loris, completato e
  con i test automatici verdi, va su TEST con `scripts/rilascia.sh <ramo>` **senza chiedere** (merge in
  main, controlli, push, migrazioni, rilascio); mai merge o push fuori da questo script.
  PRODUZIONE (`scripts/cloudflare/rilascia.sh`) **sempre e solo** dopo l'OK esplicito di Loris dato
  dopo il collaudo su TEST; con un OK ambiguo si chiede conferma.
- Rami di sola documentazione (`docs/*.md`): nessun rilascio; Claude li porta su `main` in autonomia
  appena prima di un rilascio in PRODUZIONE con `scripts/documentazione.sh <ramo>…` (docs/RILASCI.md).
- Non toccare altri progetti o servizi del server (dailyMeals, sharedKidsCalendar, Apache…).
- Aggiorna `docs/AVANZAMENTO.md` a ogni attività significativa.
