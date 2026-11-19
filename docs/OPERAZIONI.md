# Operazioni — Ricette di famiglia & Co. (menuapp)

Il server Debian è l'ambiente **TEST** (solo tailnet); la produzione è su Cloudflare
(docs/CLOUDFLARE.md). Procedura di rilascio: docs/RILASCI.md.

## Servizi

| Unità (systemd utente) | Ruolo |
|---|---|
| `menuapp.service` | Frontend e API su `127.0.0.1:9870` (rilascio in `rilasci/attuale`) |
| `menuapp-backup.timer` → `menuapp-backup.service` | Backup giornaliero verificato alle 03:45 |

```sh
systemctl --user status menuapp
journalctl --user -u menuapp -n 100
systemctl --user list-timers menuapp-backup.timer
systemctl --user start menuapp-backup      # backup subito
```

Accesso HTTPS dal tailnet (ingresso privato, anche funzioni di sistema):
`tailscale serve --bg --https=9870 http://127.0.0.1:9870` (`tailscale serve status`).

Accesso da Internet (ingresso pubblico, dalla versione multiutente, SPEC §19.5): Tailscale
Funnel sulla 443 verso `127.0.0.1:9873`; vedi «Accesso esterno» più sotto.

Rete di casa in HTTP (`http://192.168.1.160:9880/`): dalla versione multiutente non dà dati
(senza HTTPS non esiste il cookie di sessione) e rimanda all'indirizzo HTTPS. L'Echo Show
usa l'indirizzo pubblico con un suo invito.

Prima installazione: `scripts/rilascia.sh --senza-riavvio` (crea il primo rilascio), poi
`scripts/installa-servizio.sh` (crea solo unità `menuapp*`, verifica che gli altri servizi
restino invariati, chiede conferma prima di `tailscale serve`).

## Dati e backup

- Database: `dati/menuapp.db` (WAL). Foto: `dati/foto/` (file immutabili, nome = id).
- Backup: `dati/backup/` con file `.json` di verifica; le foto nuove vengono copiate in
  `dati/backup/foto/` a ogni backup e rimesse al loro posto dopo un ripristino.
- Conservazione: 14 giornalieri, 8 settimanali (domenica), 5 pre-migrazione, 5
  pre-ripristino, 10 manuali.
- Database e backup stanno sullo stesso disco: scarica periodicamente l'esportazione
  con le foto (*Impostazioni → Dati → Esporta con le foto (ZIP)*) su un altro dispositivo.

## Ripristino

- Normale: *Impostazioni → Dati* → backup del server o file JSON → verifica → «RIPRISTINA».
  Il server salva prima un backup pre-ripristino; tutto avviene in una transazione.
- D'emergenza (servizio che non parte): `scripts/ripristino-emergenza.sh <nome-backup.db>`:
  ferma il servizio, copia il database attuale in `dati/backup/emergenza-…`, sostituisce,
  riavvia.

## Rilasci

- `scripts/rilascia.sh <ramo>`: unisce il ramo in `main` (solo avanzamento), poi tutto il resto
  in un solo comando; lanciarlo è l'autorizzazione di Loris a merge, push e rilascio. Senza ramo
  rilascia `main` com'è. Passi: albero pulito; `npm run check`; pubblica `main` su GitHub se è
  avanti (mai forzato; `--senza-push` per saltarlo); build in cartella temporanea;
  prova del nuovo rilascio su una copia del database (porta 9872); backup manuale; cambio
  atomico di `rilasci/attuale`; riavvio; controlli (salute, `no-cache` su `sw.js`, porta
  solo su loopback, HTTPS via Tailscale). Se i controlli falliscono e lo schema non è
  cambiato, torna da solo al rilascio precedente. Conserva gli ultimi 5.
- `scripts/ripristina-rilascio.sh <id>`: solo verso un rilascio con lo stesso schema.
- Migrazione fallita all'avvio: il servizio esce con codice 78 e non riparte in ciclo; il
  database resta alla versione precedente. Torna al rilascio precedente; se serve, usa il
  backup `pre-migrazione-…`.
- Aggiornamento di Node con nvm: aggiorna il percorso in `scripts/comuni.sh` e riesegui
  `scripts/installa-servizio.sh`.

## Utenti e dispositivi (SPEC §19)

Console sul server (solo dal terminale; usa i dati e il Node del servizio):

```sh
scripts/amministra.sh stato                 # utenti e richieste in attesa
scripts/amministra.sh invito                # link per un dispositivo dell'amministratore
scripts/amministra.sh invito Anna           # link per un dispositivo di Anna
scripts/amministra.sh approva K7P-M2Q       # approva la richiesta con quel codice
scripts/amministra.sh rifiuta K7P-M2Q
scripts/amministra.sh sessioni              # dispositivi autorizzati
scripts/amministra.sh revoca <id | nome>    # scollega un dispositivo o tutti quelli di un utente
scripts/amministra.sh origini               # ricette senza Famiglia d'origine (SPEC §35)
```

- **Primo accesso dopo il rilascio multiutente**: nessun dispositivo è autorizzato. Sul server
  `scripts/amministra.sh invito`, apri il link sul telefono (via Tailscale), «Richiedi
  l'accesso», poi `scripts/amministra.sh approva <codice>`. Gli altri dispositivi si collegano
  da *Il mio account → Collega un nuovo dispositivo*.
- **Recupero dell'amministratore** (telefono perso, sessioni revocate): stessa procedura dalla
  console; poi scollega il dispositivo perso da *Utenti e dispositivi*.
- **Familiari**: *Impostazioni → Il mio account → Utenti e dispositivi* (solo dall'indirizzo
  Tailscale) → «Utente» → nome → link da mandare con WhatsApp → quando apre il link compare
  la richiesta: approva solo se il codice coincide con quello che vede.
- **Sospendere** un utente scollega subito tutti i suoi dispositivi; i suoi dati restano.

## Accesso esterno (Tailscale Funnel)

Attivazione (dopo autorizzazione, con il rilascio multiutente già attivo):

1. `scripts/attiva-ingresso-pubblico.sh`: scrive `dati/server.json` (porta 9873 su loopback,
   indirizzo pubblico `https://loris-srv01.dala-tortoise.ts.net` per i link d'invito),
   riavvia il servizio e verifica che l'ingresso pubblico risponda senza funzioni di sistema.
2. `tailscale funnel --bg --https=443 http://127.0.0.1:9873` (richiede l'attributo `funnel`
   per il nodo nella policy del tailnet; la console di Tailscale lo propone al primo uso).
3. Verifica da un telefono fuori dal tailnet: la pagina «Dispositivo non autorizzato».

Coesiste con i serve già attivi (9870 e 8443, solo tailnet): Funnel usa solo la 443.
Spegnimento: `scripts/disattiva-funnel.sh` (controlla che la 443 sia quella di Menù & Co., esegue
`tailscale funnel --https=443 off` e verifica che il resto non cambi; l'app resta raggiungibile via
Tailscale).
Mai `tailscale funnel reset` / `tailscale serve reset`: cancellano anche gli altri serve.

## Dominio proprio (`ricettedifamiglia.online`)

Stesso ingresso pubblico del Funnel (127.0.0.1:9873, senza funzioni di sistema); il Funnel resta
attivo. Il dominio ha i DNS su Cloudflare; al 18/11/2026 punta ancora a un hosting esterno
(195.110.124.133), non a questo server.

1. Collegamento (scelta di Loris, fuori dall'app): il proxy del dominio deve portare **solo** a
   `http://127.0.0.1:9873`, mai alla 9870 (che comunque risponde 403 a nomi non locali). Con
   Cloudflare Tunnel: servizio `http://127.0.0.1:9873` per `ricettedifamiglia.online`;
   disattivare Rocket Loader e l'offuscamento delle email (inseriscono script che la CSP blocca).
2. `dati/server.json` (poi `systemctl --user restart menuapp`):
   ```json
   {
     "MENUAPP_PORTA_PUBBLICA": 9873,
     "MENUAPP_URL_PUBBLICO": "https://ricettedifamiglia.online",
     "MENUAPP_ALTRI_URL_PUBBLICI": "https://loris-srv01.dala-tortoise.ts.net",
     "MENUAPP_URL_PRIVATO": "https://loris-srv01.dala-tortoise.ts.net:9870"
   }
   ```
   I nuovi link d'invito usano il dominio; il Funnel continua ad accettare accessi e scritture.
   Se si usa anche `www.`, va aggiunto ad `MENUAPP_ALTRI_URL_PUBBLICI` (o reindirizzato al dominio).
3. Verifica: `curl https://ricettedifamiglia.online/api/v1/salute` → `{"ok":true,"versioneApi":1}`;
   `/api/v1/eventi` → 401; `/api/v1/admin/utenti` → 404.

Chi è già collegato dal Funnel resta collegato lì; per usare il dominio ogni dispositivo si
collega di nuovo («Collega un nuovo dispositivo» + approvazione): i cookie non passano da un
dominio all'altro.

## Ritorno indietro dalla versione multiutente

La migrazione `0005_utenti.sql` aggiunge tabelle e colonne; il codice precedente non sa
scrivere eventi e piatti con il proprietario e `ripristina-rilascio.sh` rifiuta il cambio di
schema. Si torna indietro codice **e** database, in quest'ordine (altrimenti il codice nuovo
rimigrerebbe il backup):

1. `tailscale funnel --https=443 off` (se attivo);
2. `systemctl --user stop menuapp`;
3. `ln -sfn <rilascio precedente> rilasci/attuale` (es. `20261113-1015-0c5a473`, schema v4);
4. `scripts/ripristino-emergenza.sh pre-migrazione-<data>-v4.db` (backup automatico fatto
   all'avvio del nuovo rilascio prima della migrazione: mette da parte il database attuale in
   `dati/backup/emergenza-…`, sostituisce, riavvia con il codice precedente).

Le modifiche fatte dopo il rilascio restano nel database messo da parte. `dati/server.json`
viene ignorato dal codice precedente.
