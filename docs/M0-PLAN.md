# M0 — Fondamenta: piano operativo

| | |
|---|---|
| Riferimento | `docs/SPEC.md` §12–§17 (versione 1.2) |
| Branch | `m0-fondamenta` (da `main`, dopo il merge di `docs-spec`) |
| Periodo | 13–17 novembre 2026 |
| Uscita | `v0.1.0` in produzione sul server: https://loris-srv01.dala-tortoise.ts.net:9870/ (solo tailnet) |

## Obiettivo

Un'app vuota ma completa nelle fondamenta: si installa, funziona offline, naviga fra
tutte le schermate (segnaposto), ha il database con lo schema definitivo v1, salva e
ripristina i dati, avvisa degli aggiornamenti, è servita in produzione dal server Debian
(servizio systemd sulla porta 9870, HTTPS via Tailscale) ed è coperta da test. Dopo M0 ogni
milestone aggiunge funzioni senza toccare l'infrastruttura.

**Priorità assolute**, in quest'ordine: (1) schema e apertura sicura del database,
(2) persistenza, (3) backup e ripristino, (4) offline e aggiornamenti, (5) navigazione.
Il servizio di produzione (T13) è necessario per installare la PWA sui dispositivi.
Tailwind/shadcn, CI e documentazione sono di supporto: si fanno nella misura minima che
serve a queste priorità.

**Nessuna anticipazione**: in M0 non si scrive codice di eventi, menù, ricettario,
catalogo, parser, spesa, piano, stampa, né interfacce di impostazioni diverse da
*Impostazioni → Dati*. Gli schemi zod di tutte le entità sono l'unica eccezione, perché
servono a validare i backup. Rinviati da M0: preferenza manuale del tema (M0 segue il
tema di sistema), banner «Installa l'app» e `shortcuts` del manifest (M4).

## Punto di partenza (già presente su `main`)

Vite 8.3, React 19.3, TypeScript 7.0.2, Dexie 4.4.7, vite-plugin-pwa 2.0
(`registerType: 'autoUpdate'`, da cambiare), icone PWA segnaposto, server di sviluppo su
`127.0.0.1:5173`, `tailscale serve :8443`, `CLAUDE.md`, oxlint.

Da **eliminare** in M0 (decisione del 12/11: niente GitHub Pages): `base: '/Menuapp/'`
in `vite.config.ts`, workflow `.github/workflows/deploy.yml`, riferimenti a Pages in
`README.md` e `CLAUDE.md`. Il sito Pages già pubblicato resta online finché Loris non
disattiva Pages nelle impostazioni del repository.

## Attività

Ogni attività termina con un commit (o pochi) sul branch e con `npm run check` verde
dove già disponibile.

### T1 — Toolchain e TypeScript
- `tsconfig.app.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  alias `@/*`; stesso alias in `vite.config.ts`.
- Script: `typecheck` (`tsc -b`), `test`, `test:watch`, `test:e2e`, `check`
  (lint + typecheck + test + build).
- Verifica TypeScript 7: compilazione di un file con alias, JSX, `import type`,
  tipi di `virtual:pwa-register/react` e di Dexie.
- **Dipende da**: nulla. **Test**: `npm run typecheck` verde; un errore volutamente
  introdotto viene segnalato.
- **Accettazione**: `npm run check` esiste e passa. Se TypeScript 7 fallisce su un
  punto bloccante → `typescript@~5.9` e nota nel registro di SPEC.

### T2 — Test unitari (Vitest)
- Installazione: `vitest`, `happy-dom`, `@testing-library/react`,
  `@testing-library/jest-dom`, `fake-indexeddb`.
- `vitest.config.ts` con due progetti: `dominio` (Node: `src/domain`, `src/db`) e `ui`
  (happy-dom: `src/**/*.test.tsx`).
- Primo test: `domain/tempo.ts` (date locali, `oggiISO`, aggiunta giorni).
- **Dipende da**: T1. **Accettazione**: `npm test` esegue entrambi i progetti.

### T3 — Tailwind CSS 4 e shadcn/ui
- `tailwindcss` + `@tailwindcss/vite`; `src/styles/index.css` con token del tema
  (chiaro/scuro), colore d'accento della PWA, `@media print` di base.
- `npx shadcn@latest init` (verifica funzionamento con TypeScript 7), poi **solo** i
  componenti usati in M0: button, card, badge, alert-dialog, sonner (toast). Gli altri
  si aggiungono nelle milestone che li usano.
- Tema chiaro/scuro che segue il sistema (`prefers-color-scheme`); la preferenza manuale
  arriva con le impostazioni (M1 o successive).
- **Dipende da**: T1. **Test**: componente di prova renderizzato in happy-dom.
  **Accettazione**: pulsante e dialog funzionano a 360 px, in chiaro e scuro.

### T4 — Navigazione e layout
- `react-router` 8 con `createHashRouter`; rotte di SPEC §5 con pagine segnaposto e
  titolo; pagina «Non trovata»; `errorElement` con pagina d'errore e link a
  *Impostazioni → Dati*.
- `AppShell`: barra inferiore (< 768 px) e laterale (≥ 768 px) con *Eventi, Ricettario,
  Ingredienti, Impostazioni*; area sicura (`env(safe-area-inset-*)`); titolo pagina in
  `document.title`.
- **Dipende da**: T3. **Test**: componente — navigazione fra le quattro sezioni;
  e2e in T9. **Accettazione**: tutte le rotte raggiungibili, back del telefono coerente,
  ricarica su una rotta profonda funziona.

### T5 — Database: schema v1, seed, apertura sicura (priorità 1)
- `src/db/db.ts`: classe Dexie tipizzata con tutte le tabelle di SPEC §6.3. La classe
  **non** viene istanziata né aperta all'import del modulo: la crea solo
  `apriDatabase()`, dopo i controlli. Nessun altro modulo apre `menuapp` direttamente.
- Tipi delle entità in `src/domain/tipi.ts`; schemi zod in `src/domain/schemi.ts`.
- `src/domain/id.ts` (`nuovoId()`), repository `settings` e `meta` (solo lettura e
  scrittura generica, nessuna interfaccia di modifica).
- Seed idempotente (`meta.seedImpostazioni`): impostazioni predefinite (portate,
  coefficiente 0,5, reparti di SPEC §7.6 con id stabili, promemoria 7 giorni, tema
  sistema). Il catalogo ingredienti arriva in M2 con `meta.seedCatalogo`.
- `src/db/sicurezza.ts`: database `menuapp-sicurezza` con schema proprio,
  `salvaCopia(motivo, contenuto)`, `elencaCopie()`, ultime 3.
- `apriDatabase()` secondo SPEC §11.4, passi 1–7, verificati il 12/11 con Dexie 4.4.7 e
  Chrome 157 (prova isolata):
  1. `Dexie.exists` → se assente, apertura normale + seed;
  2. versione installata da `indexedDB.databases()` (nativa / 10), senza aprire;
  3. uguale → apertura normale; maggiore → schermata «Ricarica»;
  4. minore → apertura **dinamica** (`new Dexie('menuapp')` senza `version()`), lettura
     di tutte le tabelle, `close()`;
  5. copia in `menuapp-sicurezza`; se fallisce, niente migrazione;
  6. apertura tipizzata con gli `upgrade`;
  7. `versionchange` → `close()` + avviso; `blocked` → avviso.
  Errore in qualunque passo → schermata con «Scarica i dati» e «Riprova».
- **Dipende da**: T2. **Test** (fake-indexeddb): seed eseguito una sola volta; seed non
  sovrascrive impostazioni modificate; DB v1 di prova → codice con v2 di prova: copia
  creata **prima** dell'upgrade e contenente i dati v1; copia fallita (errore simulato)
  → nessun upgrade; upgrade che lancia un errore → dati v1 intatti; limite di 3 copie;
  DB inesistente → nessuna copia. Gli stessi scenari girano in Chrome reale in T9.
- **Accettazione**: in *Impostazioni → Dati* compaiono versione dello schema e
  conteggi delle tabelle letti dal DB; scenari di migrazione verdi in Node e in Chrome.

### T6 — Backup e ripristino (priorità 3)
- `src/db/backup/canonico.ts`: serializzazione canonica e impronta SHA-256
  (`crypto.subtle`) secondo SPEC §11.1.
- `esporta.ts`: lettura in una transazione, esclusione delle chiavi `meta` del
  dispositivo, impronta, nome file con data; `ultimoBackupAt` aggiornato **dopo** il
  calcolo, alla consegna del file (download o condivisione).
- `valida.ts`: intestazione → **impronta sul file originale** → migrazione del formato
  → zod → integrità referenziale; errori leggibili in italiano.
- `migra.ts`: catena `migraBackup` (vuota per v1, struttura pronta).
- `ripristina.ts`: **copia di sicurezza obbligatoria** in `menuapp-sicurezza` (se
  fallisce, stop), poi transazione unica `clear` + `bulkAdd`, poi `ultimoBackupAt` e
  `ultimaModificaAt` = `esportatoAt`.
- Interfaccia in *Impostazioni → Dati*: esporta (download; condivisione file se
  disponibile); ripristina (scelta file → riepilogo → conferma → copia di sicurezza →
  ripristino → ricarica), con pulsante facoltativo «Scarica anche i dati attuali»;
  elenco delle copie di sicurezza con *Scarica* e *Ripristina*.
- **Dipende da**: T5. **Test**: ida e ritorno con dati di prova di tutte le tabelle
  (impronta identica); due esportazioni consecutive → stessa impronta; file
  reindentato → impronta valida; chiavi `meta` del dispositivo assenti dal file;
  impronta errata → avviso, prosecuzione solo con conferma; rifiuto di: JSON non
  valido, formato estraneo, schema futuro, enum sconosciuto, riferimento obbligatorio
  rotto; copia di sicurezza che fallisce → nessun ripristino; ripristino che fallisce a
  metà non altera i dati.
- **Accettazione**: criteri «Backup» di SPEC §16.

### T7 — Persistenza e promemoria backup
- `src/pwa/persistenza.ts`: `persisted()`, `persist()`, `estimate()`; richiesta al primo
  salvataggio di dati; stato e spazio usato in *Impostazioni → Dati*.
- Banner promemoria (SPEC §11.4) con azione «Esporta ora».
- Repository che aggiornano `meta.ultimaModificaAt` (inizialmente solo `settings`).
- **Dipende da**: T5, T6. **Test**: logica del promemoria come funzione pura
  (`serveBackup(ultimaModifica, ultimoBackup, giorni, ora)`).
- **Accettazione**: in Chrome Android installato lo stato risulta «persistente».

### T8 — PWA: aggiornamenti e offline
- `registerType: 'prompt'`; componente `AvvisoAggiornamento` con
  `useRegisterSW`: toast «Nuova versione disponibile — Aggiorna», «Pronta per l'uso
  offline»; controllo all'avvio, al ritorno in primo piano e ogni ora; pulsante
  «Verifica aggiornamenti» in *Impostazioni → Dati*.
- Manifest di SPEC §13 senza `shortcuts` (rinviate a M4, quando le rotte avranno
  contenuto); `id`, `scope` e `start_url` uguali a `/`; `base: '/'`; `navigateFallback:
  'index.html'`.
- Versione app: `define` con `versione package` + hash corto del commit; mostrata in
  *Impostazioni → Dati* insieme alla versione dello schema.
- **Dipende da**: T4. **Test**: e2e in T9 (offline, aggiornamento).
- **Accettazione**: con il rilascio A installato, il rilascio B mostra l'avviso;
  accettandolo l'app ricarica alla B senza perdere dati.

### T9 — Test end-to-end (Playwright)
- `@playwright/test`; `playwright.config.ts` con `channel: 'chrome'` (Chrome 157 di
  sistema), `webServer` = `vite preview --host 127.0.0.1 --port 4174 --strictPort`,
  progetti *Pixel 7* e *Desktop Chrome*, base URL `http://127.0.0.1:4174/`.
- Scenari M0:
  - avvio e navigazione su tutte le rotte; ricarica su rotta profonda;
  - backup: ripristino di un **file di prova** (`test/fixture/backup-v1.json`, dati in
    tutte le tabelle) → esportazione → stessa impronta; file manomesso rifiutato con
    dati intatti (nessuna interfaccia delle milestone successive necessaria);
  - apertura sicura in Chrome reale: una pagina di prova crea `menuapp` alla v1 con
    dati; l'app avviata con una v2 di prova (solo build di test) crea la copia e migra;
    con un upgrade che fallisce i dati v1 restano intatti;
  - offline: attesa del service worker, `setOffline(true)`, ricarica, app funzionante;
  - aggiornamento: due build in cartelle diverse servite in sequenza, comparsa
    dell'avviso, nessun ricaricamento automatico.
- **Dipende da**: T4, T6, T8. **Accettazione**: `npm run test:e2e` verde sul server
  senza scaricare browser.

### T10 — Dismissione di Pages e CI di soli controlli
- Eliminazione di `.github/workflows/deploy.yml` e di `base: '/Menuapp/'`.
- Workflow `ci.yml` su push e pull request: `npm ci`, lint, typecheck, test unitari,
  build. Nessuna pubblicazione.
- **Dipende da**: T1, T2. **Accettazione**: nessun workflow con permessi `pages` o
  `id-token`; al primo push autorizzato i controlli risultano verdi su GitHub.
  Azione di Loris: disattivare Pages in *Settings → Pages* del repository.

### T11 — Documentazione
- `README.md`: comandi, sviluppo da PC e Android, test, backup, rilascio e ritorno a un
  rilascio precedente, URL di produzione, installazione della PWA.
- `CLAUDE.md`: comandi aggiornati (`check`, `test:e2e`), regole architetturali (SPEC
  §12.3), regola «niente push/merge senza autorizzazione».
- `docs/collaudo/M0.md`: lista di controllo manuale.
- **Dipende da**: tutte. **Accettazione**: un nuovo avvio di sessione può lavorare
  leggendo solo `CLAUDE.md` e `docs/`.

### T13 — Servizio di produzione sul server (SPEC §14)
- `scripts/serve.mjs`: server statico senza dipendenze, `127.0.0.1:9870`, radice
  `rilasci/attuale` risolta a ogni richiesta, intestazioni di cache e sicurezza,
  protezione dei percorsi, `/__salute` (SPEC §14.2).
- `scripts/installa-servizio.sh`: scrive `~/.config/systemd/user/menuapp.service`
  (SPEC §14.3), `daemon-reload`, `enable --now menuapp`; stampa il comando
  `tailscale serve --bg --https=9870 http://127.0.0.1:9870` e lo esegue **solo** con
  conferma esplicita. Non tocca altre unità né altre configurazioni di `tailscale serve`
  (si aggiunge accanto a `:8443`).
- `scripts/rilascia.sh` e `scripts/ripristina-rilascio.sh` (SPEC §14.4); `rilasci/` in
  `.gitignore`; `rilascio.json` scritto nella build.
- Prima installazione: richiede l'autorizzazione di Loris (crea un servizio e una
  configurazione Tailscale nuovi); nessun riavvio di altri servizi.
- **Dipende da**: T1 (script), T8 (build PWA definitiva per il primo rilascio).
- **Test**: unitari di `serve.mjs` (SPEC §17.1) eseguiti da Vitest in Node; controlli
  automatici di `rilascia.sh` (SPEC §17.3); prova di `systemctl --user kill menuapp` →
  riavvio automatico entro pochi secondi; `ss -tln` mostra 9870 solo su `127.0.0.1` e
  sull'indirizzo Tailscale.
- **Accettazione**: `https://loris-srv01.dala-tortoise.ts.net:9870/` raggiungibile da
  telefono e PC nel tailnet con certificato valido; `http://192.168.1.160:9870/` non
  risponde; dailyMeals, sharedKidsCalendar, Apache e la configurazione `:8443`
  invariati.

### T12 — Collaudo su Android e rilascio
- Build di anteprima su `127.0.0.1:4173` + `tailscale serve --https=8444` (temporaneo)
  per le prove distruttive; chiusura di `:8444` a fine collaudo.
- Con approvazione: merge su `main`, primo rilascio con `rilascia.sh` (tag locale
  `v0.1.0`; push solo se autorizzato).
- Lista di controllo `docs/collaudo/M0.md` sul Galaxy S23 e sul PC, **sull'URL di
  produzione**: installazione da `:9870`, avvio in modalità aereo e con Tailscale spento,
  persistenza, backup scaricato e ripristinato, secondo rilascio con avviso di
  aggiornamento, ritorno al rilascio precedente, tema scuro, tasto indietro, riavvio del
  server con servizio ripartito da solo.
- **Dipende da**: T1–T11, T13.

## Ordine di esecuzione e dipendenze

```
T1 ─▶ T2 ─▶ T5 (logica) ─▶ T6 (logica) ─▶ T7 (logica) ─┐
 │                                                     ├─▶ interfacce T5–T7 ─┐
 └─▶ T3 ─▶ T4 ─────────────────────────────────────────┘                     │
                └─▶ T8 ───────────────────────────────────────────────────────┼─▶ T9 ─▶ T13 ─▶ T11 ─▶ T12
 T10 (dopo T2) ────────────────────────────────────────────────────────────────┘
```

Le priorità si riflettono nell'ordine: la **logica** di database, apertura sicura,
backup e persistenza (con i loro test in Node) viene prima di qualsiasi interfaccia;
Tailwind/shadcn e navigazione arrivano dopo e servono solo a esporre *Impostazioni →
Dati* e le rotte segnaposto.

| Giorno | Attività |
|---|---|
| 13 nov | T1, T2, T5 (logica e test) |
| 14 nov | T6, T7 (logica e test) |
| 15 nov | T3, T4, interfacce di T5–T7 in *Impostazioni → Dati* |
| 16 nov | T8, T9, T10, T13 (script e test; installazione solo dopo autorizzazione) |
| 17 nov | T11, T12 (primo rilascio, collaudo) |

## Dipendenze da installare (tutte locali al progetto)

| Gruppo | Pacchetti |
|---|---|
| Interfaccia | `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `sonner` |
| Applicazione | `react-router`, `dexie-react-hooks`, `zod` |
| Test | `vitest`, `happy-dom`, `@testing-library/react`, `@testing-library/jest-dom`, `fake-indexeddb`, `@playwright/test` |

Nessuna installazione globale; nessun download di browser (si usa Chrome di sistema).
Il server di produzione non aggiunge dipendenze: usa solo moduli di Node.
`shadcn` si esegue con `npx` senza diventare dipendenza.

## Criteri di accettazione di M0

1. `npm run check` e `npm run test:e2e` verdi sul server; CI di soli controlli verde su
   GitHub (al primo push autorizzato); nessun riferimento a Pages né a `/Menuapp/`.
2. L'app servita da `https://loris-srv01.dala-tortoise.ts.net:9870/` si installa su
   Android e PC e si apre in modalità aereo e con Tailscale spento.
3. Tutte le rotte di SPEC §5 esistono (segnaposto) e la navigazione funziona da telefono
   e da PC, in tema chiaro e scuro, a 360 px senza scroll orizzontale.
4. Il database `menuapp` v1 contiene tutte le tabelle definitive; impostazioni e
   reparti predefiniti presenti dopo il primo avvio; seed idempotente.
5. Backup → ripristino riproduce i dati con la stessa impronta; impronta verificata sul
   file originale; esportazioni ripetute senza modifiche hanno la stessa impronta; file
   non validi rifiutati senza modificare i dati; copia di sicurezza in
   `menuapp-sicurezza` scritta prima di ogni ripristino e migrazione, senza dipendere da
   un download; scenari di migrazione verdi anche in Chrome reale.
6. Persistenza richiesta e mostrata; promemoria backup funzionante.
7. Un nuovo rilascio mostra l'avviso di aggiornamento, che non ricarica mai da solo;
   il ritorno al rilascio precedente funziona.
8. Versione app e schema visibili in *Impostazioni → Dati*.
9. `menuapp.service` attivo, abilitato all'avvio, ripartito da solo dopo un errore;
   porta 9870 solo su `127.0.0.1` e via `tailscale serve` (mai `funnel`), non
   raggiungibile dalla LAN; `:8444` chiuso a fine collaudo; altri servizi del server
   invariati.
10. Decisione su TypeScript 7 registrata in SPEC.

## Fuori da M0

Qualsiasi funzione di eventi, menù, ricettario, spesa, piano, stampa (solo pagine
segnaposto); catalogo ingredienti e `seedCatalogo`; parser; impostazioni modificabili
(portate, coefficiente e tema in M1, reparti in M2); banner di installazione; `shortcuts` del
manifest; componenti shadcn non usati in M0; `@dnd-kit`; font di stampa.
