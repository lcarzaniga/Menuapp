# Operazioni — Menù & Co.

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

Accesso HTTPS dal tailnet: `tailscale serve --bg --https=9870 http://127.0.0.1:9870`
(`tailscale serve status` per verificarlo; mai `funnel`).

Accesso dalla rete di casa senza Tailscale: `http://192.168.1.160:9880/` (Echo Show, ospiti).
Funziona tutto tranne installazione PWA e schermo sempre acceso. Conviene una prenotazione
DHCP nel router per l'indirizzo del server. Chiunque sia sul Wi-Fi può usare l'app.

Prima installazione: `scripts/rilascia.sh --senza-riavvio` (crea il primo rilascio), poi
`scripts/installa-servizio.sh` (crea solo unità `menuapp*`, verifica che gli altri servizi
restino invariati, chiede conferma prima di `tailscale serve`).

## Dati e backup

- Database: `dati/menuapp.db` (WAL). Backup: `dati/backup/` con file `.json` di verifica.
- Conservazione: 14 giornalieri, 8 settimanali (domenica), 5 pre-migrazione, 5
  pre-ripristino, 10 manuali.
- Database e backup stanno sullo stesso disco: scarica periodicamente un'esportazione
  JSON (*Impostazioni → Dati → Esporta*) su un altro dispositivo.

## Ripristino

- Normale: *Impostazioni → Dati* → backup del server o file JSON → verifica → «RIPRISTINA».
  Il server salva prima un backup pre-ripristino; tutto avviene in una transazione.
- D'emergenza (servizio che non parte): `scripts/ripristino-emergenza.sh <nome-backup.db>`:
  ferma il servizio, copia il database attuale in `dati/backup/emergenza-…`, sostituisce,
  riavvia.

## Rilasci

- `scripts/rilascia.sh`: da `main` pulito; `npm run check`; build in cartella temporanea;
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

## Accesso (Tailscale)

Chi raggiunge la porta 9870 del tailnet può leggere e modificare tutto. Per limitarla:
regola in SPEC §14.5, da applicare nella console di Tailscale riportando anche le regole
degli altri servizi del server.
