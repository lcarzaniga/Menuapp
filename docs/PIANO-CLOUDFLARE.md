# Piano di migrazione a Cloudflare (Workers, Durable Objects SQLite, R2)

Analisi del 18/11/2026 sul codice del rilascio `20261118-1021-5b2a63d` (schema 15).

> **Stato (18/11/2026)**: fasi C0–C6 sviluppate e provate in locale sul ramo `cloudflare`
> (SPEC §32, operazioni in `docs/CLOUDFLARE.md`). Decisioni di Loris: Durable Object SQLite, R2
> privato, piano Free da misurare, amministrazione dall'app solo agli amministratori, ripristino
> solo da script, primo amministratore con segreto temporaneo. Differenza dal piano emersa nel
> prototipo C0: **Fastify non gira su Workers** (genera codice con `new Function`) e al posto di
> Hono le stesse rotte girano su un motore leggero compatibile (`server/motore-leggero.ts`), così
> Debian e Cloudflare condividono tutto il codice delle rotte senza riscriverle.

Obiettivo finale: togliere il server applicativo Debian e Tailscale Funnel. Prima fase:
un'installazione **indipendente** su `ricettedifamiglia.online` (dati e utenti propri, nessuna
sincronizzazione), mentre la versione Debian resta com'è, con i suoi rilasci.

## 1. Verdetto

**Fattibile senza perdere funzioni, permessi o isolamento tra Famiglie**, con una modifica alla
proposta: il database conviene metterlo in un **Durable Object con SQLite** (stesso motore,
API sincrona, transazioni) invece che in **D1**.

| Proposta | Esito |
|---|---|
| Workers per PWA, API e autenticazione | Sì. Fastify va sostituito (Hono); le regole restano |
| D1 per il database | **Sconsigliato**: niente transazioni interattive, API asincrona → riscrittura di ~6.500 righe di servizi e repository con nuovi rischi di concorrenza |
| Durable Object SQLite (alternativa) | **Consigliato**: API sincrona e `transactionSync` come `node:sqlite`; servizi e repository si riusano quasi tali e quali |
| R2 per foto e allegati | Sì: sostituisce `dati/foto` (oggi 55 file, 7,4 MB) |

Perché non D1: tutto il server è costruito su transazioni sincrone `BEGIN IMMEDIATE`
(`server/db/connessione.ts`, 141 punti d'uso) dove si legge, si controllano permessi e
versioni, poi si scrive. D1 da un Worker offre solo query asincrone e `batch()` atomici senza
logica in mezzo: ogni caso d'uso andrebbe riscritto in modo asincrono e con controlli
spostati nelle `WHERE`, perdendo la garanzia attuale (409 coerenti, «Prendo io» senza doppioni,
permessi verificati nella stessa transazione). Un Durable Object esegue una richiesta alla
volta e ha SQLite locale con API sincrona: è lo stesso modello dell'attuale processo Node.
D1 stesso è costruito su Durable Objects; si perde solo la console SQL di D1 (vedi §6).

## 2. Architettura di destinazione

```
Browser / PWA ──HTTPS──► Worker «menuapp» (ricettedifamiglia.online)
                          ├─ file statici (Workers Static Assets: dist/, SPA, _headers)
                          └─ /api/*  ──►  Durable Object «Archivio» (una sola istanza)
                                           ├─ Hono: le rotte di oggi
                                           ├─ servizi/ + db/repo/ (riusati)
                                           ├─ SQLite del Durable Object (schema 15)
                                           └─ R2 «menuapp-foto» (foto, allegati, esportazioni)
                          Cron Trigger (notte) ──► Archivio: esportazione in R2, pulizie
```

- Un solo Durable Object = un solo database, come oggi. Serializza le richieste: per una
  famiglia il carico è trascurabile.
- Il Worker serve i file statici senza consumare richieste e inoltra `/api/*` all'oggetto.

## 3. Incompatibilità e modifiche, per area

### 3.1 Fastify → Hono
- Fastify non gira su Workers. 172 rotte in `server/api/` (~5.400 righe con i test) fanno solo
  da tramite: leggono parametri, validano con zod (`src/contratto`), chiamano i servizi.
  **Hono** ha routing e middleware equivalenti e gira sia su Workers sia su Node.
- Da ricreare come middleware: controllo dell'origine e del tipo JSON sulle scritture
  (`server/app.ts`), intestazioni di sicurezza, `cache-control: no-store`, `x-revisione`,
  gestore errori (`ErroreApi` → stesso corpo d'errore), 404 uniforme, limite del corpo
  (1 MB; foto 8 MB come oggi), autenticazione (`registraAutenticazione`).
- `@fastify/static` → Workers Static Assets: `not_found_handling = "single-page-application"`,
  intestazioni (CSP, `no-cache` per `index.html`/`sw.js`/manifest, `immutable` per `/assets/`)
  nel file `_headers`.
- Test: `app.inject()` → `app.request()` di Hono; test di server con
  `@cloudflare/vitest-pool-workers` (Durable Object, R2 simulati).

### 3.2 SQLite
- Introdurre un'interfaccia `Db` minima (`tutti`, `uno`, `esegui`, `transazione`, `lettura`)
  con due implementazioni: `node:sqlite` (Debian, invariata nel comportamento) e
  `ctx.storage.sql` + `transactionSync` (Cloudflare). Repository e servizi non cambiano.
- Da adattare:
  - niente `BEGIN`/`COMMIT`/`ROLLBACK` espliciti nel Durable Object: si usa `transactionSync`;
    la regola «transazione annidata = partecipa a quella esterna» resta nel wrapper;
  - niente cache di `prepare()` (il cursore del Durable Object non la richiede);
  - `PRAGMA user_version`, `journal_mode`, `wal_checkpoint`, `busy_timeout`: non disponibili o
    inutili. La versione dello schema si legge da `migrazioni_applicate` (esiste già);
  - `PRAGMA integrity_check` / `foreign_key_check` (backup, ripristino, migrazioni): da
    verificare nel prototipo; se non permessi, si tolgono da quel percorso;
  - **massimo 100 parametri per query**: le liste `IN (?, ?, …)` della bacheca
    (`server/db/repo/famiglia.ts`, righe 66, 86, 106) e gli inserimenti con molte colonne
    (`ricettario.ts:238`, `spesa.ts:81`, `backup/contenuto.ts:99`) vanno spezzati a blocchi;
  - righe e BLOB al massimo 2 MB (nessuna foto sta nel database: ok).
- Migrazioni: le 15 di oggi si applicano su un database vuoto all'avvio dell'oggetto
  (`blockConcurrencyWhile`); nessuna ricostruisce tabelle né spegne le chiavi esterne. Tabelle
  `STRICT`, trigger e chiavi esterne sono supportati. Il backup «pre-migrazione» su file sparisce:
  lo sostituisce il ripristino a un istante (§3.6).

### 3.3 Filesystem → R2
- `server/servizi/foto.ts` e gli allegati della bacheca (`bacheca.ts`) scrivono e leggono file
  in `dati/foto` con `node:fs`. Diventano `env.FOTO.put/get/delete` (asincroni).
- Ordine sicuro, perché R2 non partecipa alla transazione SQLite:
  - caricamento: prima l'oggetto in R2, poi la riga nel database; se la transazione fallisce,
    si cancella l'oggetto;
  - eliminazione: prima la riga, poi l'oggetto; gli orfani li toglie la pulizia notturna;
  - copia di una ricetta con le foto: copia in R2 dopo la transazione, con la stessa pulizia.
- Lettura delle foto sempre dall'API con controllo del permesso (`richiediFoto`), come oggi.
  Il bucket resta privato: nessun dominio pubblico R2.

### 3.4 Autenticazione e sessioni
- Restano identici: inviti monouso, richiesta con codice di verifica, approvazione, cookie
  `__Host-menuapp-sessione` (HttpOnly, Secure, SameSite=Lax, 180 giorni) e
  `__Host-menuapp-richiesta`, sessioni lato server con impronta SHA-256, revoche, sospensioni.
- `node:crypto` (`randomBytes`, `createHash`, `randomUUID`): disponibili con il flag
  `nodejs_compat`; nessuna riscrittura.
- Origini ammesse: variabile `MENUAPP_ORIGINI = https://ricettedifamiglia.online`.
- IP del limitatore dei tentativi: intestazione `CF-Connecting-IP` invece di `trustProxy`.
  Il limitatore in memoria funziona perché tutte le richieste passano dallo stesso oggetto (si
  azzera se l'oggetto viene scaricato: accettabile, oppure tabella SQLite).
- **Primo amministratore**: oggi `scripts/amministra.sh` usa la console del server, che su
  Cloudflare non c'è. Proposta: rotta di avvio attiva solo se è impostato il segreto
  `MENUAPP_CODICE_CONSOLE` (`wrangler secret put`) e solo finché non esiste un amministratore
  attivo; crea l'invito e approva con il codice. Dopo l'uso si cancella il segreto. Nessuna
  credenziale predefinita, nessuna registrazione autonoma.

### 3.5 Ingressi
- Oggi ci sono tre ingressi: privato (tailnet, con le funzioni di sistema), pubblico (Funnel,
  senza) e rete di casa. Su Cloudflare ce n'è uno solo, pubblico. Spariscono il controllo
  `Tailscale-Funnel-Request`, `hostLocale`, l'ingresso di rete di casa (l'Echo Show userà
  l'indirizzo HTTPS) e `MENUAPP_PORTA_*`.
- Decisione necessaria: dove stanno le funzioni oggi riservate all'ingresso privato (§7, D3).

### 3.6 Processi del server
| Oggi (Debian) | Su Cloudflare |
|---|---|
| `menuapp.service` (systemd) | Worker + Durable Object, nessun processo da gestire |
| `menuapp-backup.timer` 03:45, backup verificati in `dati/backup` | Ripristino a un istante degli ultimi 30 giorni del Durable Object + esportazione notturna in R2 (Cron Trigger) |
| Ripristino da file `.db` (`ATTACH`, `node:sqlite backup`) | Ripristino a un istante, oppure importazione dall'esportazione JSON (`backup/contenuto.ts` riusato) |
| `scripts/rilascia.sh` (merge, controlli, migrazioni con backup, link `attuale`) | `scripts/rilascia-cloudflare.sh`: controlli, `vite build`, `wrangler deploy` manuale; migrazioni all'avvio dell'oggetto |
| `scripts/amministra.sh` (console) | Rotta di avvio con segreto (§3.4) |
| Modalità manutenzione durante il ripristino | Stato nell'oggetto (stesse risposte 503) |
| Esportazione completa ZIP (`fflate`) | Compatibile; con le foto conviene scriverla in R2 a pezzi e scaricarla da lì |

### 3.7 Cosa non cambia
`src/domain/`, `src/contratto/`, tutto il frontend (stesse API, stessi percorsi, PWA),
servizi e repository (salvo §3.2 e §3.3), permessi (`server/servizi/permessi.ts`), regole
delle Famiglie, versioni e 409, revisione interrogata ogni 10 s.

## 4. Piano per fasi

Ogni fase su un ramo, con i test. Nessuna fase tocca la produzione Debian; il codice comune
(interfaccia `Db`) va a Debian solo quando Loris rilascia, ed è verificato dagli stessi test.

| Fase | Contenuto | Fatto quando |
|---|---|---|
| **C0** Prototipo (1–2 giorni) | Durable Object con le 15 migrazioni, `transazione` su `transactionSync`, una lettura e una scrittura, PRAGMA ammessi, CPU per richiesta misurata con `wrangler dev` | Schema 15 creato nel Durable Object; elenco di ciò che manca |
| **C1** Interfaccia `Db` | Due implementazioni; repository e servizi passano da `Db`; liste `IN` a blocchi da 100 | `npm run check` e e2e verdi su Debian, nessun cambio di comportamento |
| **C2** Rotte portabili | Rotte e middleware in Hono, condivisi; Fastify resta solo su Debian come ospite (oppure Hono anche su Debian, con `@hono/node-server`, in un rilascio separato) | Test di accesso e autorizzazione verdi su entrambe le piattaforme |
| **C3** Archiviazione | `Archivio` (interfaccia) su file e su R2; foto, allegati, copie, pulizia degli orfani | Test di foto e allegati su entrambe |
| **C4** Worker | `wrangler.toml`, Static Assets e `_headers`, inoltro `/api/*`, segreti, origini, limitatore con `CF-Connecting-IP`, rotta di avvio dell'amministratore | Suite e2e Playwright contro `wrangler dev` |
| **C5** Funzioni di sistema | Decisione D3: amministrazione utenti, esportazione in R2, ripristino a un istante, manutenzione | Test dedicati; procedura scritta in OPERAZIONI |
| **C6** Messa in linea | Account, bucket, dominio sul Worker, primo `wrangler deploy` manuale, primo amministratore, verifica da telefono | `ricettedifamiglia.online` funzionante con utenti propri; Debian invariata |
| **C7** (in seguito) | Trasferimento dei dati da Debian, periodo di prova, spegnimento di Funnel e del servizio | Fuori da questa fase |

Rilasci manuali: **non** collegare il repository a Workers Builds (rilascerebbe a ogni push).
`wrangler deploy` si lancia solo da `scripts/rilascia-cloudflare.sh`, con il token API in un
file fuori da Git, come per `scripts/rilascia.sh`.

## 5. Costi e limiti

Limiti del piano Free secondo la documentazione Cloudflare al 18/11/2026:

| Risorsa | Free | Workers Paid (5 $/mese) |
|---|---|---|
| Richieste al Worker | 100.000/giorno (oltre: errore 1027) | 10 milioni/mese inclusi |
| CPU per richiesta | **10 ms** (oltre: errore 1102) | 30 s predefiniti, fino a 5 min |
| Richieste al Durable Object | 100.000/giorno; 13.000 GB-s/giorno | 1 milione/mese + durata inclusa |
| SQLite del Durable Object | 5 M righe lette e 100.000 scritte/giorno; 1 GB per oggetto, 5 GB in tutto | 25 G righe lette e 50 M scritte/mese; 10 GB per oggetto |
| R2 | 10 GB, 1 M operazioni A e 10 M B al mese, traffico in uscita gratuito | stesso livello gratuito, poi 0,015 $/GB-mese |
| File statici | Gratuiti, senza limite di richieste | idem |
| Dimensione del Worker | 3 MB compressi | 10 MB |

Stima d'uso (10 dispositivi, app aperta 2 ore al giorno): la revisione ogni 10 s fa circa 7.200
richieste al Worker e altrettante al Durable Object al giorno, più qualche migliaio per le
pagine: **meno del 15% del limite Free**. Righe e spazio sono lontani dai limiti (database
attuale 1,1 MB, foto 7,4 MB).

Il limite stretto è la **CPU di 10 ms** per richiesta sul piano Free: bastano le richieste
normali, ma esportazione ZIP, importazione di ricette lunghe, ripristino e copie con foto
rischiano l'errore 1102. Inoltre, a limite superato, il piano Free rifiuta le operazioni invece
di fatturarle.

**Raccomandazione**: Free per il prototipo e la prima installazione (C0–C6). **Workers Paid
(5 $/mese)** prima di usarla davvero in famiglia o di spegnere Debian. Con questi volumi il
costo resta 5 $/mese più eventuale IVA; R2 resta nel livello gratuito.

## 6. Limiti e rischi

- **Console SQL**: col Durable Object non c'è `wrangler d1 execute`; ispezione e correzioni
  passano dalle funzioni di amministrazione dell'app o da rotte di manutenzione protette. È il
  prezzo delle transazioni; D1 lo offrirebbe, ma con la riscrittura di §1.
- **Un solo oggetto**: unico punto per tutte le richieste e collocato vicino alla prima
  richiesta (Europa). Per una famiglia nessun problema di prestazioni.
- **Due copie di codice da mantenere** finché Debian resta: mitigato dalle fasi C1–C3 (codice
  comune, test su entrambe le piattaforme).
- **CPU sul piano Free** (§5).
- **Ripristino** diverso da oggi: a un istante, senza scegliere un file; e ripristino
  dall'esportazione JSON per i casi gravi.
- Dettagli da confermare nel prototipo C0: PRAGMA ammessi, limite CPU delle richieste al
  Durable Object sul piano Free, disponibilità del ripristino a un istante sul piano Free.

## 7. Decisioni per Loris

- **D1 – Database**: Durable Object SQLite (consigliato) o D1 (riscrittura asincrona dei servizi).
- **D2 – Piano**: Free per prototipo e messa in linea, Paid prima dell'uso reale (consigliato).
- **D3 – Funzioni di sistema** senza ingresso privato:
  - **Consigliato**: amministrazione utenti, inviti e dispositivi all'amministratore dal dominio,
    come nell'ingresso privato di oggi. Esportazione completa all'amministratore. Ripristino solo
    con uno script (`wrangler`) dal PC, non dal browser.
  - Alternativa: riservarle a un percorso protetto da Cloudflare Access (gratuito fino a 50
    utenti), che però è un secondo accesso.
- **D4 – Primo amministratore**: rotta con segreto a uso singolo (consigliato) o rotta temporanea
  in un rilascio dedicato.
- **D5 – Dominio**: `ricettedifamiglia.online` passa al Worker. **Il Cloudflare Tunnel indicato
  il 18/11 non va creato** (oppure va rimosso): Debian resta sul Funnel
  (`loris-srv01.dala-tortoise.ts.net`) e `dati/server.json` deve continuare a puntare lì,
  altrimenti i link d'invito di Debian aprirebbero l'altra installazione. Al 18/11
  `dati/server.json` è corretto (Funnel) e il dominio risponde già da Cloudflare (IPv6
  2a06:98c1:…).

## Fonti

- [Workers – limiti](https://developers.cloudflare.com/workers/platform/limits/) ·
  [Workers – prezzi](https://developers.cloudflare.com/workers/platform/pricing/)
- [Durable Objects – limiti](https://developers.cloudflare.com/durable-objects/platform/limits/) ·
  [Durable Objects – prezzi](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [D1 – limiti](https://developers.cloudflare.com/d1/platform/limits/)
- [R2 – prezzi](https://developers.cloudflare.com/r2/pricing/)
