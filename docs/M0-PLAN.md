# M0 — Fondamenta: piano operativo

| | |
|---|---|
| Riferimento | `docs/SPEC.md` §12–§17 |
| Branch | `m0-fondamenta` (da `main`, dopo il merge di `docs-spec`) |
| Periodo | 13–17 novembre 2026 |
| Uscita | `v0.1.0` pubblicata su https://lcarzaniga.github.io/Menuapp/ |

## Obiettivo

Un'app vuota ma completa nelle fondamenta: si installa, funziona offline, naviga fra
tutte le schermate (segnaposto), ha il database con lo schema definitivo v1, salva e
ripristina i dati, avvisa degli aggiornamenti, ed è coperta da test e CI. Dopo M0 ogni
milestone aggiunge funzioni senza toccare l'infrastruttura.

## Punto di partenza (già presente su `main`)

Vite 8.3, React 19.3, TypeScript 7.0.2, Dexie 4.4.7, vite-plugin-pwa 2.0
(`registerType: 'autoUpdate'`, da cambiare), icone PWA segnaposto, `base: '/Menuapp/'`,
server di sviluppo su `127.0.0.1:5173`, `tailscale serve :8443`, workflow Pages
funzionante, `CLAUDE.md`, oxlint.

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
- `npx shadcn@latest init` (verifica funzionamento con TypeScript 7), poi componenti:
  button, input, textarea, label, select, checkbox, switch, card, badge, tabs, dialog,
  alert-dialog, sheet, dropdown-menu, separator, skeleton, sonner (toast).
- Tema: preferenza *sistema / chiaro / scuro* applicata con classe `dark` su `<html>`,
  senza lampeggio all'avvio (script inline in `index.html`).
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
  ricarica su una rotta profonda funziona anche sotto `/Menuapp/`.

### T5 — Database: schema v1, seed, apertura sicura
- `src/db/db.ts`: classe Dexie tipizzata con tutte le tabelle di SPEC §6.3.
- Tipi delle entità in `src/domain/tipi.ts`; schemi zod in `src/domain/schemi.ts`.
- `src/domain/id.ts` (`nuovoId()`), repository `settings` e `meta`.
- Seed idempotente (`meta.seedVersione`): impostazioni predefinite (portate,
  coefficiente 0,5, reparti di SPEC §7.6 con id stabili, promemoria 7 giorni, tema
  sistema). Il catalogo ingredienti arriva in M2 con lo stesso meccanismo.
- `src/db/sicurezza.ts`: database `menuapp-sicurezza`, `salvaCopia(motivo)`, ultime 3.
- `apriDatabase()`: legge la versione installata; se inferiore, copia di sicurezza,
  poi apertura; gestione `versionchange` e `blocked`; errore di apertura → schermata
  dedicata.
- **Dipende da**: T2. **Test** (fake-indexeddb): seed eseguito una sola volta; seed non
  sovrascrive impostazioni modificate; copia di sicurezza creata prima di un upgrade
  simulato (DB v1 di prova → v2 di prova); limite di 3 copie.
- **Accettazione**: in *Impostazioni* compaiono portate e reparti predefiniti, letti dal DB.

### T6 — Backup e ripristino
- `src/db/backup/esporta.ts`: lettura in transazione, formato SPEC §11.1, impronta
  SHA-256 con `crypto.subtle`, nome file con data, `meta.ultimoBackupAt`.
- `valida.ts`: controlli di formato, versione, zod, impronta, integrità referenziale;
  risultato con errori leggibili in italiano.
- `migra.ts`: catena `migraBackup` (vuota per v1, struttura pronta).
- `ripristina.ts`: copia di sicurezza + transazione unica `clear` + `bulkAdd`.
- Interfaccia in *Impostazioni → Dati*: esporta (download; condivisione file se
  disponibile), ripristina (scelta file → riepilogo → conferma → download dei dati
  attuali → ripristino → ricarica).
- **Dipende da**: T5. **Test**: ida e ritorno con dati di prova di tutte le tabelle
  (impronta identica); rifiuto di: JSON non valido, formato estraneo, schema futuro, enum
  sconosciuto, riferimento obbligatorio rotto; ripristino che fallisce a metà non altera
  i dati (errore simulato dentro la transazione).
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
- Manifest completo (SPEC §13), `navigateFallback` con allowlist `/Menuapp/`.
- Versione app: `define` con `versione package` + hash corto del commit; mostrata in
  *Impostazioni → Dati* insieme alla versione dello schema.
- Banner «Installa l'app» su `beforeinstallprompt`, chiudibile e ricordato.
- **Dipende da**: T4. **Test**: e2e in T9 (offline, aggiornamento).
- **Accettazione**: con build A installata, la pubblicazione della build B mostra
  l'avviso; accettandolo l'app ricarica alla B senza perdere dati.

### T9 — Test end-to-end (Playwright)
- `@playwright/test`; `playwright.config.ts` con `channel: 'chrome'` (Chrome 157 di
  sistema), `webServer` = `vite preview --host 127.0.0.1 --port 4174 --strictPort`,
  progetti *Pixel 7* e *Desktop Chrome*, base URL `http://127.0.0.1:4174/Menuapp/`.
- Scenari M0: avvio e navigazione su tutte le rotte; ricarica su rotta profonda;
  modifica di un'impostazione → backup → cancellazione dati → ripristino → dato
  presente; offline: attesa del service worker, `setOffline(true)`, ricarica, app
  funzionante; aggiornamento: due build in cartelle diverse servite in sequenza,
  comparsa dell'avviso.
- **Dipende da**: T4, T6, T8. **Accettazione**: `npm run test:e2e` verde sul server
  senza scaricare browser.

### T10 — CI e pubblicazione
- Workflow `ci.yml` su push (tutti i branch) e pull request: `npm ci`, lint,
  typecheck, test unitari, build.
- `deploy.yml` su `main`: stessi controlli prima della pubblicazione (fallisce → niente
  deploy).
- **Dipende da**: T1, T2. **Accettazione**: un push sul branch mostra i controlli verdi
  su GitHub; nessun deploy da branch diversi da `main`.

### T11 — Documentazione
- `README.md`: comandi, sviluppo da PC e Android, test, backup.
- `CLAUDE.md`: comandi aggiornati (`check`, `test:e2e`), regole architetturali (SPEC
  §12.3), regola «niente push/merge senza autorizzazione».
- `docs/collaudo/M0.md`: lista di controllo manuale.
- **Dipende da**: tutte. **Accettazione**: un nuovo avvio di sessione può lavorare
  leggendo solo `CLAUDE.md` e `docs/`.

### T12 — Collaudo su Android e rilascio
- Build di anteprima su `127.0.0.1:4173` + `tailscale serve --https=8444` (temporaneo).
- Lista di controllo `docs/collaudo/M0.md` sul Galaxy S23: installazione, avvio offline
  in modalità aereo, persistenza, backup scaricato e ripristinato, avviso aggiornamento,
  tema scuro, navigazione con il tasto indietro.
- Chiusura di `tailscale serve :8444`.
- Con approvazione: merge su `main`, push, tag `v0.1.0`, verifica di produzione
  (installazione dalla URL pubblica).
- **Dipende da**: T1–T11.

## Ordine di esecuzione e dipendenze

```
T1 ─▶ T2 ─▶ T5 ─▶ T6 ─▶ T7 ─┐
 │                 │          │
 ├─▶ T3 ─▶ T4 ─▶ T8 ──────────┼─▶ T9 ─▶ T11 ─▶ T12
 │                            │
 └─▶ T10 (dopo T2) ───────────┘
```

| Giorno | Attività |
|---|---|
| 13 nov | T1, T2, T3 |
| 14 nov | T4, T5 |
| 15 nov | T6, T7 |
| 16 nov | T8, T9, T10 |
| 17 nov | T11, T12 (collaudo e rilascio) |

## Dipendenze da installare (tutte locali al progetto)

| Gruppo | Pacchetti |
|---|---|
| Interfaccia | `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `sonner` |
| Applicazione | `react-router`, `dexie-react-hooks`, `zod` |
| Test | `vitest`, `happy-dom`, `@testing-library/react`, `@testing-library/jest-dom`, `fake-indexeddb`, `@playwright/test` |

Nessuna installazione globale; nessun download di browser (si usa Chrome di sistema).
`shadcn` si esegue con `npx` senza diventare dipendenza.

## Criteri di accettazione di M0

1. `npm run check` e `npm run test:e2e` verdi sul server; CI verde su GitHub.
2. L'app pubblicata su Pages si installa su Android e si apre in modalità aereo.
3. Tutte le rotte di SPEC §5 esistono (segnaposto) e la navigazione funziona da telefono
   e da PC, in tema chiaro e scuro, a 360 px senza scroll orizzontale.
4. Il database `menuapp` v1 contiene tutte le tabelle definitive; impostazioni e
   reparti predefiniti presenti dopo il primo avvio; seed idempotente.
5. Backup → ripristino riproduce i dati con la stessa impronta; file non validi
   rifiutati senza modificare i dati; copia di sicurezza creata prima di ripristini e
   migrazioni.
6. Persistenza richiesta e mostrata; promemoria backup funzionante.
7. Una nuova pubblicazione mostra l'avviso di aggiornamento, che non ricarica mai da solo.
8. Versione app e schema visibili in *Impostazioni → Dati*.
9. Nessun servizio esposto oltre a `127.0.0.1` e al tailnet; `:8444` chiuso a fine
   collaudo.
10. Decisione su TypeScript 7 registrata in SPEC.

## Fuori da M0

Qualsiasi funzione di eventi, menù, ricettario, spesa, piano, stampa (solo pagine
segnaposto); catalogo ingredienti; parser; `@dnd-kit`; font di stampa.
