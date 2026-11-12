# Avanzamento — Menù & Co.

Documento operativo per riprendere il lavoro fra sessioni. Sintetico, aggiornato a ogni
attività significativa.

## Stato

- **Milestone corrente**: M0 (fondamenta) quasi completa → si passa a M1.
- **Branch di lavoro**: `m0-fondamenta` (da `docs-spec`, non ancora su `main`).
- **Ambiente di sviluppo**: tmux `menuapp`, finestra `server` (`npm run dev:server`,
  `127.0.0.1:9871`, dati in `dati-sviluppo/`), finestra `dev` (Vite `127.0.0.1:5173`,
  proxy `/api`). Da telefono: `https://loris-srv01.dala-tortoise.ts.net:8443/`.

## Completato

- M0 T1–T10: toolchain client/server (TS 7, Node esegue `server/*.ts` senza build),
  schema SQLite completo con vincoli, migrazioni con backup pre-migrazione e codice 78,
  seed, backend Fastify (contratto zod, errori, Origin/Content-Type, 503 manutenzione,
  file statici con cache corretta), controllo di versione e revisione globale, backup
  verificati con rotazione, esportazione con impronta canonica, ripristino in due passi,
  CLI per il timer, frontend base (layout, router hash, client API, sola lettura,
  conflitti, *Impostazioni → Dati*), PWA con avviso di aggiornamento, e2e Playwright,
  CI di soli controlli.

## Test

| Comando | Esito |
|---|---|
| `npm test` (dominio, server con SQLite reale, ui) | verde |
| `npm run test:e2e` (telefono + desktop, server reale) | verde (10) |
| `npm run lint` / `npm run typecheck` / `npm run build` | verdi (1 avviso lint su button.tsx) |

## Decisioni tecniche

- Nomi dei campi nel codice tutti in italiano (`eventoId`, `piattoId`, `voceMenuId`…):
  la SPEC §6.2 usa ancora alcuni nomi inglesi, da allineare a fine lavoro.
- Hook di sola lettura: `usePuoScrivere()` (la regola React richiede il prefisso `use`).
- Ripristino da JSON: il database temporaneo si costruisce applicando le migrazioni fino
  alla versione del file e poi le restanti (stesse migrazioni dell'avvio) invece di
  funzioni di migrazione JSON separate.
- Componenti UI scritti a mano in stile shadcn (radix-ui + cva), `<select>` nativi.
- Server non raggiungibile simulato negli e2e intercettando `/api/**`.

## Problemi aperti

- T11 (servizio di produzione, rilasci): script da scrivere; installazione e primo
  deploy **richiedono autorizzazione**.
- Bundle JS unico > 500 kB: dividere per schermata quando le funzioni saranno complete.

## Prossima attività

M1 — eventi e menù (servizi, API, schermate), poi M2–M4. T11 prima del collaudo finale.
