# M0 — Fondamenta: piano operativo

| | |
|---|---|
| Riferimento | `docs/SPEC.md` v2.0, §6, §11–§17 |
| Branch | `m0-fondamenta` (da `main`, dopo il merge di `docs-spec`) |
| Periodo | 13–19 novembre 2026 |
| Uscita | `v0.1.0` in produzione sul server: https://loris-srv01.dala-tortoise.ts.net:9870/ (solo tailnet) |

## Obiettivo

Un'applicazione senza funzioni di dominio visibili, ma con tutte le fondamenta definitive:
database SQLite centrale con schema completo, vincoli e migrazioni; backend Fastify con
contratto condiviso, controllo delle versioni e revisione globale; backup automatici e
manuali, esportazione e ripristino; frontend installabile che naviga fra le schermate
(segnaposto), mostra lo stato del server e passa in sola lettura quando il server non è
raggiungibile; servizio di produzione con systemd e `tailscale serve`; test a ogni
livello. Dopo M0 ogni milestone aggiunge rotte, servizi e schermate sulle tabelle già
pronte, senza toccare l'infrastruttura.

**Priorità assolute**, in quest'ordine:
1. schema SQLite, migrazioni e vincoli;
2. backend con contratto, errori e concorrenza;
3. backup, esportazione e ripristino;
4. servizio di produzione (systemd, `tailscale serve`, rilasci);
5. frontend: connessione e sola lettura, PWA, navigazione.

**Nessuna anticipazione**: in M0 non si scrivono rotte, servizi o schermate di eventi,
menù, ricettario, catalogo, parser, spesa, piano e stampa. Lo **schema** di tutte le
tabelle invece è completo fin da `0001_iniziale.sql`, perché cambiarlo dopo costa di più.
Le API di M0 sono solo: salute, revisione, impostazioni (lettura e scrittura, prima
consumatrice del controllo di versione), reparti (lettura), backup, esportazione,
ripristino. Interfacce di M0: solo *Impostazioni → Dati* e segnaposto.

## Punto di partenza (su `main`)

Vite 8.3, React 19.3, TypeScript 7.0.2, vite-plugin-pwa 2.0, oxlint, icone segnaposto,
Vite di sviluppo su `127.0.0.1:5173` con `tailscale serve :8443`, `CLAUDE.md`.

Da **eliminare** in M0:
- la dipendenza `dexie` (SQLite sul server è l'unica fonte di verità);
- `base: '/Menuapp/'`, `.github/workflows/deploy.yml`, riferimenti a Pages in `README.md`
  e `CLAUDE.md`;
- `registerType: 'autoUpdate'` (diventa `prompt`).

Verifiche già fatte il 12/11 (SPEC §12.1): Node 24.18 esegue TypeScript senza
compilazione; `node:sqlite` (SQLite 3.53.1) supporta FK, `STRICT`, WAL, aggiornamento
condizionato sulla versione e `backup()` online; porta 9870 libera; *linger* attivo.

## Attività

Ogni attività termina con commit sul branch e `npm run check` verde da T2 in poi.

### T1 — Toolchain client/server
- Rimozione di `dexie`, `base: '/Menuapp/'`, `deploy.yml`.
- Struttura di SPEC §12.2.
- `tsconfig`: progetti `app` (src, DOM) e `server` (server + src/domain + src/contratto,
  tipi di Node), entrambi `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`,
  `allowImportingTsExtensions`; alias `@/` solo nel frontend (il server usa percorsi
  relativi con estensione `.ts`, eseguibili da Node).
- Script: `dev` (Vite), `dev:server` (`node --watch server/main.ts` su 9871),
  `typecheck`, `lint`, `test`, `test:e2e`, `check`.
- Vite: proxy `/api` → `http://127.0.0.1:9871`.
- `.gitignore`: `dati/`, `dati-sviluppo/`, `rilasci/`.
- **Dipende da**: nulla. **Accettazione**: `node server/main.ts` parte come scheletro;
  `npm run typecheck` verde su client e server.

### T2 — Infrastruttura di test
- Vitest con progetti `dominio` (Node), `server` (Node, cartelle temporanee per SQLite),
  `ui` (happy-dom).
- Aiutanti: `dbDiProva()` (cartella temporanea + migrazioni), `appDiProva()` (Fastify
  con `inject`), pulizia automatica.
- Test di architettura degli import (SPEC §12.3).
- **Dipende da**: T1. **Accettazione**: un test per progetto verde; il test di
  architettura fallisce su un import vietato inserito apposta.

### T3 — Database: connessione, schema, migrazioni, seed (priorità 1)
- `server/db/connessione.ts`: apertura con i PRAGMA di SPEC §6.3, `transazione(fn)` con
  `BEGIN IMMEDIATE`, chiusura con checkpoint.
- `server/db/migrazioni/0001_iniziale.sql`: **tutte** le tabelle, gli indici e i vincoli
  di SPEC §6.3; elenco delle unità preso dal catalogo di dominio (`src/domain/unita.ts`,
  solo codici e famiglie in M0; formattazione e riconoscimento in M2) e fissato nel file.
- `esegui.ts`: procedura di SPEC §6.5 (versione, impronte dei file, backup
  pre-migrazione verificato, transazioni, `foreign_key_check`, codice 78).
- Seed `seed_impostazioni` (SPEC §6.6); contatore `meta.revisione`.
- Repository `impostazioni`, `reparti` (lettura), `meta`.
- **Dipende da**: T2. **Test** (SQLite reale): vuoto → v1; seconda esecuzione senza
  effetti; file di migrazione alterato → blocco; `user_version` maggiore → codice 78;
  migrazione di prova `0002` che fallisce → v1 intatta e backup pre-migrazione presente;
  **ogni** `CHECK`, FK, unicità e `ON DELETE` dello schema violato o esercitato almeno
  una volta, anche per le tabelle usate dalle milestone successive; seed idempotente.
- **Accettazione**: tabella dei vincoli di SPEC §6.4 coperta da test; `dati-sviluppo/`
  creato al primo avvio.

### T4 — Backend: app, contratto, errori, sicurezza (priorità 2)
- `server/config.ts` (variabili di SPEC §14.2 validate con zod).
- `server/app.ts`: Fastify, limiti del corpo, controllo di `Content-Type` e `Origin`
  sulle scritture (SPEC §12.7), formato d'errore unico, 503 durante la manutenzione, file
  statici con le intestazioni di SPEC §14.1 (solo se `MENUAPP_STATICI` è impostato).
- `src/contratto/`: schemi comuni (errore, versione, revisione), `salute`,
  `impostazioni`, `reparti`.
- Rotte M0: `GET /salute`, `GET /revisione`, `GET|PUT /impostazioni`, `GET /reparti`.
- `server/main.ts`: avvio e arresto ordinato (SPEC §14.2).
- **Dipende da**: T3. **Test** (`inject`): ogni codice d'errore di SPEC §12.4 prodotto
  almeno una volta; risposte conformi al contratto; scrittura senza `Origin` → 403,
  senza JSON → 415; intestazioni dei file statici.
- **Accettazione**: `/api/v1/salute` risponde su `127.0.0.1:9871` in sviluppo.

### T5 — Concorrenza e revisione (priorità 2)
- Aiutanti di repository: `aggiornaConVersione()`, riordino con elenco di versioni,
  creazione idempotente con id del client (struttura generica per M1+).
- Incremento di `meta.revisione` in ogni transazione di scrittura; intestazione
  `X-Revisione`.
- Prima applicazione: `PUT /impostazioni` (coefficiente e portate predefinite con ordine).
- **Dipende da**: T4. **Test**: due client sulla stessa versione → 200 e 409 con
  `attuale`; riordino con una versione errata → nessuna modifica; ripetizione dopo una
  risposta persa riconosciuta; revisione incrementata solo dalle scritture riuscite.
- **Accettazione**: criterio G3 di SPEC §16 dimostrato sulle impostazioni.

### T6 — Backup, esportazione e ripristino (priorità 3)
- `server/backup/`: creazione con verifica e rotazione (SPEC §11.1–11.2), esportazione
  JSON canonica con impronta (§11.3), ripristino in due passi con database temporaneo,
  backup pre-ripristino, `ATTACH` e transazione unica (§11.4), `cli.ts` per il timer.
- Rotte: `GET|POST /backup`, `GET /backup/:nome`, `GET /esportazione`,
  `POST /ripristino/verifica`, `POST /ripristino/esegui`.
- `scripts/ripristino-emergenza.sh` e `docs/OPERAZIONI.md` (§11.5).
- **Dipende da**: T3, T4. **Test** (SQLite reale): backup con scritture concorrenti in
  corso, anche da `cli.ts` in un processo separato; file corrotto scartato; rotazione per
  tipo; esportazione → ripristino → stessa impronta; due esportazioni consecutive →
  stessa impronta; impronta errata → avviso; schema futuro → rifiuto; riga non valida o
  FK rotta → rifiuto senza modifiche; errore a metà ripristino → dati invariati; backup
  pre-ripristino fallito → nessun ripristino; token scaduto o riusato → rifiuto; nome di
  backup con percorso → 400.
- **Accettazione**: criterio G5 di SPEC §16 in ambiente di test.

### T7 — Frontend base, connessione e sola lettura (priorità 5)
- Tailwind 4 e shadcn con **solo** i componenti usati: button, card, badge, alert-dialog,
  dialog, sonner. Tema di sistema (preferenza manuale in M1).
- `react-router` con `createHashRouter`, rotte di SPEC §5 con segnaposto, `AppShell`
  (barra inferiore/laterale), pagina d'errore.
- `src/api/`: client tipizzato sul contratto, mappatura degli errori, TanStack Query,
  interrogazione della revisione ogni 10 s e al ritorno in primo piano.
- `src/connessione/`: stati, banner, hook `usaPuoScrivere()`; componente
  `ConflittoVersione`; bozze dei moduli in `sessionStorage`.
- *Impostazioni → Dati*: stato del server, versioni, ultimo backup, elenco backup,
  backup ora, scaricamento `.db`, esportazione JSON, ripristino in due passi con
  riepilogo e conferma testuale.
- **Dipende da**: T4, T5, T6. **Test** (`ui`): mappatura degli errori, banner e comandi
  disattivati, `ConflittoVersione`, bozza conservata.
- **Accettazione**: con il backend fermo i pulsanti di *Dati* sono disattivati e il
  banner è visibile; al riavvio tutto torna attivo da solo.

### T8 — PWA
- `registerType: 'prompt'`, solo guscio in cache, `/api/*` escluso dal service worker,
  manifest di SPEC §13 senza `shortcuts`, avviso di aggiornamento, versione e rilascio
  mostrati in *Dati*.
- **Dipende da**: T7. **Test**: e2e in T9.
- **Accettazione**: app installabile da `:8443` in sviluppo; l'avvio senza server mostra
  il messaggio dedicato.

### T9 — End-to-end (Playwright)
- `webServer`: backend su `127.0.0.1:4174` con `MENUAPP_STATICI` = build di prova e
  `MENUAPP_DATI` temporanea; `channel: 'chrome'`; progetti *Pixel 7* e *Desktop*.
- Scenari M0 (SPEC §17.5): due contesti che vedono la stessa modifica delle impostazioni
  entro 15 s (scritta via API, senza interfaccia di M1) e il conflitto; server arrestato →
  sola lettura → riavvio; backup ora, esportazione, ripristino da JSON e da backup;
  service worker con `/api` mai in cache; avviso di aggiornamento.
- **Dipende da**: T7, T8. **Accettazione**: `npm run test:e2e` verde senza scaricare
  browser.

### T10 — CI di soli controlli
- `ci.yml` su push e pull request: `npm ci`, lint, typecheck, test `dominio`, `server`
  (SQLite reale in cartella temporanea), `ui`, build. Nessuna pubblicazione.
- **Dipende da**: T2. **Accettazione**: nessun workflow con permessi `pages`; controlli
  verdi al primo push autorizzato. Azione di Loris: disattivare Pages su GitHub.

### T11 — Servizio di produzione (priorità 4)
- `scripts/installa-servizio.sh`: crea `menuapp.service`, `menuapp-backup.service`,
  `menuapp-backup.timer` (SPEC §14.3), **solo** file con prefisso `menuapp`;
  `daemon-reload`, `enable --now`; propone
  `tailscale serve --bg --https=9870 http://127.0.0.1:9870` e lo esegue solo con conferma
  esplicita; registra prima e dopo lo stato di `dailymeals`, `kidscalendar`,
  `dailymeals-backup.timer`, `apache2` e di `tailscale serve status`, e si ferma
  segnalando l'anomalia se qualcosa di esterno a Menù & Co. risulta cambiato.
- `scripts/rilascia.sh` e `scripts/ripristina-rilascio.sh` (SPEC §14.4), compresa la
  prova del rilascio su una copia del database su `127.0.0.1:9872`.
- **Dipende da**: T4, T6, T8 (per il primo rilascio completo).
- **Test**: operativi di SPEC §17.6, eseguiti la prima volta insieme a Loris.
- **Accettazione**: servizio attivo e abilitato; timer programmato;
  `https://loris-srv01.dala-tortoise.ts.net:9870/` risponde con certificato valido;
  `http://192.168.1.160:9870/` non risponde; altri servizi e regola `:8443` invariati.
  **La prima installazione richiede l'autorizzazione di Loris.**

### T12 — Documentazione
- `README.md` (comandi, sviluppo, test, rilascio, URL, installazione), `CLAUDE.md`
  (architettura a livelli, regole, niente push/merge/rilasci senza autorizzazione),
  `docs/OPERAZIONI.md` (servizi, log, backup, ripristino d'emergenza, ritorno a un
  rilascio), `docs/collaudo/M0.md`.
- **Dipende da**: tutte. **Accettazione**: una nuova sessione può operare leggendo solo
  `CLAUDE.md` e `docs/`.

### T13 — Collaudo e primo rilascio
- Con autorizzazione: merge su `main`, `rilascia.sh` (tag locale `v0.1.0`).
- `docs/collaudo/M0.md` su S23, tablet e PC sull'URL di produzione: installazione; stessa
  modifica vista da due dispositivi; conflitto; Tailscale spento → sola lettura; backup
  ora, esportazione scaricata sul PC, ripristino; secondo rilascio con avviso di
  aggiornamento; riavvio del server con servizio e timer ripartiti; backup notturno
  presente il mattino dopo.
- **Dipende da**: T1–T12.

## Ordine di esecuzione e dipendenze

```
T1 ─▶ T2 ─▶ T3 ─▶ T4 ─▶ T5 ─▶ T6 ─▶ T7 ─▶ T8 ─▶ T9 ─┐
       │                       │                     ├─▶ T11 ─▶ T12 ─▶ T13
       └─▶ T10                 └─────────────────────┘
```

| Giorno | Attività |
|---|---|
| 13 nov | T1, T2, T3 (schema e migrazioni) |
| 14 nov | T3 (test dei vincoli), T4 |
| 15 nov | T5, T6 (backup ed esportazione) |
| 16 nov | T6 (ripristino), T10, T11 (script, senza installazione) |
| 17 nov | T7 |
| 18 nov | T8, T9 |
| 19 nov | T11 (installazione autorizzata), T12, T13 |

## Dipendenze da installare (tutte locali al progetto)

| Gruppo | Pacchetti |
|---|---|
| Backend | `fastify`, `@fastify/static`, `zod` |
| Frontend | `react-router`, `@tanstack/react-query`, `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `sonner` |
| Test | `vitest`, `happy-dom`, `@testing-library/react`, `@testing-library/jest-dom`, `@playwright/test` |
| Da rimuovere | `dexie` |

SQLite è incluso in Node (`node:sqlite`): nessun modulo nativo. Nessuna installazione
globale, nessun pacchetto di sistema, nessun download di browser.

## Criteri di accettazione di M0

1. `npm run check` e `npm run test:e2e` verdi sul server; CI di soli controlli pronta.
2. Database `dati/menuapp.db` alla versione 1 con tutte le tabelle definitive; ogni
   vincolo di SPEC §6.3–6.4 coperto da test su SQLite reale; migrazioni con backup
   pre-migrazione verificato e arresto sicuro (codice 78).
3. API di M0 conformi al contratto; errori 400/403/404/409/415/422/503 coperti da test;
   controllo di versione dimostrato con due client.
4. Una modifica fatta da un dispositivo è visibile su un altro entro 15 s; il conflitto
   è mostrato con *Ricarica* / *Sovrascrivi*.
5. Server non raggiungibile → banner, comandi di scrittura disattivati, nessuna scrittura
   in coda; ritorno automatico alla normalità.
6. Backup giornaliero automatico verificato (timer), backup ora, esportazione JSON e
   `.db`, ripristino in due passi con backup pre-ripristino; ripristino fallito senza
   effetti; stessa impronta su esportazione → ripristino → esportazione.
7. PWA installabile da `https://loris-srv01.dala-tortoise.ts.net:9870/` su Android,
   tablet e PC; avviso di aggiornamento dopo un nuovo rilascio, mai ricaricamento
   automatico; nessun dato dell'API nella cache del service worker.
8. `menuapp.service` attivo, abilitato, ripartito da solo dopo un errore e dopo il
   riavvio; 9870 solo su loopback e via `tailscale serve`; `:8444` chiuso dopo il
   collaudo.
9. Nessun altro servizio del server modificato: `dailymeals`, `kidscalendar`,
   `dailymeals-backup.timer`, `apache2`, regola `tailscale serve :8443` e unità systemd
   esistenti invariati (verificato da `installa-servizio.sh` prima e dopo).
10. Nessun riferimento residuo a Dexie, a IndexedDB come archivio, a GitHub Pages o a
    `/Menuapp/`.

## Fuori da M0

Rotte, servizi e schermate di eventi, menù, ricettario, catalogo, parser, spesa, piano,
stampa e archiviazione; interfaccia delle impostazioni (M1) e dei reparti (M2); seed del
catalogo (M2); scorciatoie del manifest (M4); `@dnd-kit`; font di stampa; aggiornamenti
in tempo reale; copia dei backup su un secondo supporto (decisione aperta).
