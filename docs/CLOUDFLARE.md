# Installazione Cloudflare — operazioni

App su `https://app.ricettedifamiglia.online` (SPEC §32, §34): Worker `menuapp`, Durable Object
`Archivio` (database SQLite), bucket R2 privato `menuapp-foto`. Il dominio principale
`ricettedifamiglia.online` è del Worker `ricettedifamiglia-sito` (cartella `sito/`): solo la pagina
neutra «Sito in costruzione», senza alcun riferimento all'app. Il server Debian resta invariato su
Tailscale finché Loris non ne conferma la dismissione.

## Preparazione (una volta, da Loris sulla dashboard Cloudflare)

1. **Repository**: nessun collegamento Git a Workers (Workers & Pages → se c'è un progetto
   `menuapp` creato dal collegamento, Settings → Delete). Il rilascio è solo manuale.
2. **R2**: R2 Object Storage → attivare R2 sull'account (piano Free: 10 GB gratuiti; Cloudflare
   chiede un metodo di pagamento anche per il livello gratuito). Il bucket `menuapp-foto` lo crea
   lo script di rilascio; nessun dominio pubblico e nessun accesso pubblico sul bucket.
3. **DNS del dominio**: DNS → Records di `ricettedifamiglia.online`: eliminare i record **A**,
   **AAAA** o **CNAME** del nome principale (`ricettedifamiglia.online`), compresi quelli verso
   l'hosting precedente e verso un eventuale tunnel. Il Worker crea il suo record (dominio
   personalizzato) al primo rilascio, ma non se il nome è già occupato. `www` facoltativo (vedi sotto).
4. **Token API**: My Profile → API Tokens → Create Token → modello «Edit Cloudflare Workers»,
   più il permesso **Account · Workers R2 Storage · Edit**; Account Resources: il proprio account;
   Zone Resources: `ricettedifamiglia.online`. Copiare il token e l'**Account ID** (pagina
   iniziale del dominio, colonna a destra).
5. **Credenziali sul server** (`chmod 600`, fuori da Git):
   ```bash
   mkdir -p ~/.config/menuapp && install -m 600 /dev/null ~/.config/menuapp/cloudflare.env
   # dentro:
   CLOUDFLARE_API_TOKEN=…
   CLOUDFLARE_ACCOUNT_ID=…
   ```
6. **Impostazioni del dominio**: Speed → Optimization → **Rocket Loader spento**; Scrape Shield →
   **Email Address Obfuscation spenta** (inseriscono script che la CSP blocca); niente Cloudflare
   Access (sarebbe un secondo accesso); Security → Bots: nessuna verifica JavaScript su `/api/*`.

## Rilascio (manuale)

Dopo il rilascio Debian del ramo (`scripts/rilascia.sh <ramo>`, che porta il codice su `main` e su
GitHub):

```bash
scripts/cloudflare/rilascia.sh
```

Controlli, prove sul Worker in locale, build, creazione del bucket se manca, `npx wrangler deploy`,
verifica di `https://app.ricettedifamiglia.online/api/v1/salute` (`{"ok":true,"versioneApi":1}`) e
del 401 senza sessione. Il primo rilascio crea il Durable Object (schema 15 e catalogo al primo
accesso) e il dominio personalizzato (certificato in pochi minuti).

## Primo amministratore (procedura temporanea)

```bash
# 1. segreto temporaneo (almeno 32 caratteri): lo chiede wrangler
openssl rand -base64 36
source ~/.config/menuapp/cloudflare.env && export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put MENUAPP_CODICE_CONSOLE
# 2. invito per l'amministratore (utente «Loris» creato dalla migrazione)
MENUAPP_CODICE_CONSOLE='…' node scripts/cloudflare/console.ts invito    # link su app.ricettedifamiglia.online
# 3. aprire il link sul telefono, chiedere l'accesso, poi approvare col codice mostrato
MENUAPP_CODICE_CONSOLE='…' node scripts/cloudflare/console.ts approva K7P-M2Q
# 4. togliere il segreto: la console smette di esistere (404)
npx wrangler secret delete MENUAPP_CODICE_CONSOLE
```

Gli altri utenti e dispositivi si gestiscono dall'app (Impostazioni → Utenti e dispositivi), solo
dall'amministratore. La stessa procedura serve per recuperare l'accesso se l'amministratore perde
tutti i dispositivi. Altri comandi: `stato`, `rifiuta`, `sessioni`, `revoca`, `backup`.

## Backup e ripristino

- Ogni notte (02:45 UTC) un backup completo in R2 (`backup/giornaliero-…json`, 14 giorni), più i
  manuali dalla pagina «Dati e backup» (10) e i `pre-ripristino` (5). Esportazione JSON o ZIP con
  le foto dalla stessa pagina, da conservare fuori da Cloudflare.
- **Ripristino** solo con lo script (segreto della console attivo come sopra):
  ```bash
  MENUAPP_CODICE_CONSOLE='…' node scripts/cloudflare/console.ts backup
  MENUAPP_CODICE_CONSOLE='…' node scripts/cloudflare/console.ts ripristina giornaliero-20261119-024500-v15.json
  ```
  Salva prima i dati attuali (`pre-ripristino-…`), sostituisce tutto il contenuto in una
  transazione, rimette dal cestino le foto che servono; i dispositivi restano collegati.

## Passaggio ad app.ricettedifamiglia.online e migrazione dei dati

Ordine pensato perché l'accesso non si interrompa mai e Debian resti attivo fino alla fine.

1. **Rilascio del codice**: `scripts/rilascia.sh migrazione-cloudflare` (Debian, comportamento
   invariato), poi `scripts/cloudflare/rilascia.sh --transizione`: l'app risponde su
   `app.ricettedifamiglia.online` **e** ancora sul dominio principale; inviti e PWA già sul nuovo nome.
2. **Dispositivi sul nuovo indirizzo** (i cookie valgono per un solo nome, quindi ognuno va
   ricollegato): da un dispositivo già collegato, Impostazioni → Il mio account → «Collega un nuovo
   dispositivo», aprire il link su `app.…` e approvare il codice; per gli altri familiari un invito
   dall'amministrazione. Reinstallare la PWA da `app.…`. Gli utenti restano gli stessi.
3. **Migrazione dei dati** (segreto della console attivo; nessuno usa l'app nel frattempo, né su
   Debian né su Cloudflare):
   ```bash
   export MENUAPP_CODICE_CONSOLE='…'   # lo stesso impostato con wrangler secret put
   node scripts/cloudflare/migra.ts prepara          # backup Debian + esportazione e foto in dati/migrazione/<id>
   node scripts/cloudflare/migra.ts carica <id>      # in R2 (zona di carico) + proposta di corrispondenza
   #   controllare dati/migrazione/<id>/corrispondenza.json e mettere "confermata": true
   node scripts/cloudflare/migra.ts conferma <id>    # piano di prova: tutti i controlli, nessuna modifica
   node scripts/cloudflare/migra.ts importa <id>     # backup pre-migrazione, importazione, verifica
   ```
   In caso di problemi: `node scripts/cloudflare/migra.ts annulla pre-migrazione-….json` (il nome lo
   stampa `importa`). Debian non viene modificato in nessun passo (solo un backup manuale).
4. **Sito sul dominio principale**: togliere `ricettedifamiglia.online` dal Worker `menuapp`
   (Workers & Pages → menuapp → Settings → Domains & Routes → rimuovere il dominio principale, lasciando
   `app.…`), poi `scripts/cloudflare/rilascia-sito.sh` (controlla prima che l'app risponda su `app.…`).
   I prossimi rilasci dell'app: `scripts/cloudflare/rilascia.sh` senza `--transizione`.
5. **Dismissione di Debian e Funnel**: solo su conferma di Loris (docs/OPERAZIONI.md).

Un telefono che aveva installato la PWA sul dominio principale, alla prima apertura dopo il passo 4
mostra per un attimo l'app in cache, poi il sito la rimuove (service worker sostitutivo e
`Clear-Site-Data`) e resta solo la pagina «Sito in costruzione».

## Misure da fare dopo il primo rilascio (piano Free)

Workers & Pages → `menuapp` → Metrics e Durable Objects → Metrics: richieste al giorno (limite
100.000 per Worker e Durable Object), CPU per richiesta, righe lette e scritte (5 milioni e 100.000
al giorno), spazio R2. Se il primo accesso fallisse con l'errore 1102 (CPU), il limite del Durable
Object sul piano Free è più basso dei 30 s documentati: serve Workers Paid (5 $/mese).

## Prove in locale

```bash
npm run test:cloudflare        # integrazione: console, R2, backup, ripristino, Cron
npm run test:e2e:cloudflare    # tutta la e2e contro il Worker in locale
```
