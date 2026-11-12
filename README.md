# Menù & Co.

Web app installabile (PWA) per organizzare pranzi, cene e ricorrenze di famiglia: eventi,
menù per portate, ricettario, lista della spesa aggregata, piano delle preparazioni, vista
cucina e stampa del menù. Un unico database SQLite sul server di casa, condiviso da PC,
telefono e tablet; accesso privato tramite Tailscale.

- Produzione: https://loris-srv01.dala-tortoise.ts.net:9870/ (tailnet, PWA installabile)
- Da casa senza Tailscale (es. Echo Show 15): http://192.168.1.160:9880/
- Specifica: `docs/SPEC.md` · operazioni: `docs/OPERAZIONI.md` · avanzamento: `docs/AVANZAMENTO.md`

## Uso

1. Da Chrome (Android o PC), con Tailscale attivo, apri l'indirizzo di produzione.
2. Menu di Chrome → *Installa app*.
3. *Eventi → Nuovo*: occasione, data, persone. Poi scrivi i piatti nelle portate (Invio,
   oppure incolla un elenco). Dalla voce di un piatto: *Crea nel ricettario*, incolla gli
   ingredienti, indica le porzioni base.
4. *Spesa*: tocca il cerchio per segnare comprato; ⋮ per «Ce l'ho»; *Condividi* per
   mandare la lista. Se il menù cambia, le righe già segnate restano e le differenze
   compaiono come «da integrare» o «non più necessari».
5. *Piano*: preparazioni con scelte rapide (giorno prima, mattina…).
6. *Panoramica → Stampa menù*; *Archivia* a evento concluso.
7. *Impostazioni → Dati*: backup ora, esportazione JSON da conservare su un altro
   dispositivo, ripristino.

Senza connessione al server l'app lo dice e disattiva le modifiche.

## Sviluppo

```sh
nvm use
npm ci
npm run dev:server   # backend su 127.0.0.1:9871, dati in dati-sviluppo/
npm run dev          # Vite su 127.0.0.1:5173, proxy /api → 9871
npm run check        # lint, tipi, test (dominio, server su SQLite reale, ui), build
npm run test:e2e     # Playwright con Chrome di sistema, server reale e database temporaneo
```

Da telefono in sviluppo: https://loris-srv01.dala-tortoise.ts.net:8443/ (tailscale serve → 5173).

## Rilascio

```sh
scripts/rilascia.sh            # da main, albero pulito: prova su copia dei dati, backup, cambio atomico, controlli
scripts/ripristina-rilascio.sh <id>
```
