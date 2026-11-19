# Rilasci: TEST → PRODUZIONE

| Ambiente | Dove | Chi lo raggiunge | Dati |
|---|---|---|---|
| **TEST** | server Debian, `menuapp.service` | solo dal tailnet: `https://loris-srv01.dala-tortoise.ts.net:9870/` | `dati/` sul server |
| **PRODUZIONE** | Cloudflare, Worker `menuapp` | `https://app.ricettedifamiglia.online` | Durable Object `Archivio` e R2 `menuapp-foto` |

I due ambienti hanno dati separati: un rilascio porta solo codice e migrazioni di schema, mai
dati da un ambiente all'altro. Il dominio principale `ricettedifamiglia.online` mostra solo
«Sito in costruzione» (SPEC §34) e non fa parte di questa procedura.

## Procedura (a ogni modifica)

1. **Sviluppo** (Claude): lavoro su un ramo, `npm run check` e `npm run test:e2e` verdi, commit.
   Nessun merge, push o rilascio.
2. **TEST** (Loris): `! scripts/rilascia.sh <ramo>`
   unisce il ramo in `main`, ripete i controlli, pubblica `main` su GitHub, applica le migrazioni
   al database di TEST (con backup) e rilascia su Debian. Lanciarlo è l'autorizzazione.
   Poi Claude verifica in sola lettura (rilascio attivo, salute, schema) e annota AVANZAMENTO.
3. **Prova funzionale** (Loris) su TEST, dal telefono o dal PC collegati a Tailscale.
   - Va bene → si passa al punto 4, con una conferma esplicita a Claude.
   - Non va bene → correzione su un nuovo ramo e di nuovo dal punto 2. Produzione non cambia.
4. **PRODUZIONE** (Loris, solo dopo la conferma): `! scripts/cloudflare/rilascia.sh`
   rifiuta il rilascio se il commit di `main` non è quello attivo su TEST; poi controlli, prove sul
   Worker in locale, build, `wrangler deploy`, verifica di `app.ricettedifamiglia.online`. Le
   migrazioni di schema le applica il Durable Object al suo avvio, dopo un backup `pre-migrazione`
   in R2 (se il backup non riesce non migra e il Worker non parte).
5. **Verifica** (Claude, sola lettura): salute di produzione, 401 senza sessione, dominio principale
   ancora sul sito; con una migrazione, il backup `pre-migrazione-…-v<schema precedente>.json` in R2;
   annotazione in AVANZAMENTO. Le prove con un accesso (ricette, foto, famiglie, notifiche) le fa
   Loris nell'app.

Nessun rilascio su Cloudflare parte da solo: il Worker `menuapp` non ha build automatiche collegate a
GitHub (verificato il 19/11/2026), e il push di `main` non pubblica nulla.

## Ritorno indietro

- TEST: `scripts/ripristina-rilascio.sh` (docs/OPERAZIONI.md).
- PRODUZIONE: `npx wrangler rollback <versione precedente>`, solo se lo schema non è cambiato (anche
  quando il Worker nuovo non parte perché il backup pre-migrazione è fallito: nessuna migrazione è
  stata applicata; incidente del 19/11/2026). Con una migrazione applicata si corregge in avanti
  (nuovo ramo, TEST, PRODUZIONE); i dati di prima sono nel backup `pre-migrazione` in R2.

## Accesso a TEST

- **Tailscale (VPN)**: `https://loris-srv01.dala-tortoise.ts.net:9870/` (ingresso privato, anche
  funzioni di sistema). È l'accesso di TEST, anche dalla rete di casa.
- **Rete di casa senza Tailscale**: `http://192.168.1.160:9880/` risponde, ma in HTTP non esiste il
  cookie di sessione: rimanda all'indirizzo HTTPS. Per usare TEST serve Tailscale.
- **Internet**: nessuno: Funnel spento il 19/11/2026 con `scripts/disattiva-funnel.sh`
  (spegne solo la 443 pubblica; Tailscale, i serve 9870 e 8443, il servizio e i dati restano).
  Per riaccenderlo: `tailscale funnel --bg --https=443 http://127.0.0.1:9873` (docs/OPERAZIONI.md).
