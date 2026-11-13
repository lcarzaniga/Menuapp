# Avanzamento — Menù & Co.

Documento operativo per riprendere il lavoro fra sessioni.

## Stato

- **v0.1.0 in produzione dal 12/11/2026**: https://loris-srv01.dala-tortoise.ts.net:9870/
  (rilascio `20261112-1321-0d8d6fc`, `menuapp.service` e `menuapp-backup.timer` attivi e
  abilitati, `tailscale serve :9870`, porta non raggiungibile dalla LAN, altri servizi invariati).
- **Branch**: `main` (pubblicato su GitHub); sviluppo successivo su nuovi branch.
- **Sviluppo**: tmux `menuapp` (finestre `server` → 9871 con `dati-sviluppo/`, `dev` → Vite 5173,
  telefono via `…ts.net:8443`). Nessun servizio di produzione installato.

## Completato

- M0: schema SQLite completo con vincoli e migrazioni (backup pre-migrazione, codice 78),
  backend Fastify con contratto zod, Origin/Content-Type, versioni e revisione globale,
  backup verificati con rotazione e timer, esportazione con impronta canonica, ripristino
  in due passi, frontend con sola lettura e conflitti, PWA con avviso di aggiornamento,
  CI di soli controlli, script di servizio/rilascio/ritorno/emergenza (provati in locale).
- M1: eventi e stati, portate per evento, voci con inserimento rapido e multiriga, modifica,
  riordino e spostamento, eliminazione con annulla, impostazioni.
- M2: ricettario, «Crea nel ricettario», catalogo di 248 ingredienti, reparti, parser
  (112 casi, 100 % previsti), editor ingredienti con anteprima e correzione, vista cucina.
- M3: spesa calcolata e riconciliata sul server (6 classi di contributo, R1–R10, fabbisogno
  coperto stabilito dal server), stati, correzioni, facoltativi, manuali, pulizia,
  trasferimento, condivisione.
- M4: piano delle attività con scelte rapide e spostamento, preparazioni dalle voci, stampa
  A4/A5, archiviazione con snapshot autonomo, consultazione e vista cucina da snapshot,
  copia nel ricettario, riapertura.

## Test (ultima esecuzione)

| Comando | Esito |
|---|---|
| `npm run check` (lint, tipi, 178 test: dominio, server su SQLite reale, architettura, build) | verde |
| `npm run test:e2e` (13 scenari telefono + desktop, incluso collaudo di Natale da due dispositivi) | verde |
| Rilascio di prova costruito con `scripts/rilascia.sh` e avviato su 9872 | ok (poi rimosso) |

Produzione verificata il 12/11: salute via HTTPS, backup manuale verificato, `sw.js` no-cache,
LAN 9870 chiusa. Da fare: collaudo manuale sui dispositivi (`docs/collaudo/collaudo-v1.md`).

## Decisioni tecniche

- Nomi del codice in italiano; vedi registro SPEC 2.1 per gli scostamenti dal documento.
- Componenti UI scritti a mano in stile shadcn (radix-ui + cva), `<select>` nativi.
- Schermate caricate a richiesta (bundle iniziale ~410 kB).
- Test e2e: server reale su 127.0.0.1:4174 con `test-results/dati-e2e`, Chrome di sistema.

## Problemi aperti

- Nessun test per l'avviso di aggiornamento PWA con due build reali (verificato solo che
  il service worker metta in cache il guscio e mai `/api`): da provare a mano al secondo rilascio.
- Copia dei backup su un secondo supporto: decisione aperta (SPEC §11.6).
- Trascinamento per il riordino non implementato (taglio previsto): Su/Giù/Sposta in.

## Prossima attività

Collaudo manuale di Loris sui dispositivi e disattivazione di GitHub Pages; poi rifiniture
concordate. Nota: l'installazione di servizi systemd da Claude è bloccata dal controllo dei
permessi: Loris la esegue con `! comando`.

## In produzione dal 12/11/2026 (rilascio `20261112-1520-fd1a901`, schema v2)

- Grafica nuova (font, illustrazioni, testo scalabile per l'Echo Show 15).
- Accesso dalla rete di casa senza Tailscale: http://192.168.1.160:9880/ (SPEC 2.2).
- Formato ricetta v1, importazione con foto, foto dei piatti, esportazioni ZIP (SPEC 2.3).
- Migrazione 0002 applicata con backup `pre-migrazione-20261112-152102-v1.db`.

- Foto collegate ai passaggi (SPEC 2.4), migrazione 0003 applicata con backup
  `pre-migrazione-20261112-154031-v2.db`; rilascio `20261112-1540-d284829`, schema v3.
- Porta 9880 raggiungibile anche via Tailscale (`…ts.net:9880`, `100.114.50.37:9880`).

## Prossima attività

Rifiniture concordate con Loris dopo l'uso reale; collaudo manuale (`docs/collaudo/collaudo-v1.md`).

## Designer del menù stampato (12/11/2026, in produzione)

- SPEC 2.5 / F8: cinque modelli (Elegante, Minimal, Rustico, Festivo, Natale), 7 palette,
  4 combinazioni tipografiche, decorazioni, titolo/sottotitolo/data/nota, portate vuote e
  note dei piatti, formati A4, A5 e 2 × A5 su A4.
- Anteprima fedele (stessi fogli della stampa, scalati), ingrandimento a tutto schermo;
  impaginazione misurata con densità progressive e più pagine per i menù lunghi.
- Stile salvato per evento sul server: migrazione `0004_stili_stampa.sql`, `GET|PUT
  /eventi/:id/stampa`, versione ottimistica, sola lettura e snapshot per gli archiviati.
- Test: API (`server/api/stampa.test.ts`), impaginazione e modelli
  (`src/features/stampa/stampa.test.tsx`), e2e con PDF e schermate
  (`test/e2e/stampa.spec.ts`, schermate in `test-results/stampa/`).
- Rilasciato il 12/11 (`20261112-1747-10f0947`, schema v4, migrazione 0004 applicata con
  backup pre-migrazione). Verificato il 13/11: salute ok sui quattro indirizzi, 3 eventi,
  38 piatti, 38 foto, backup notturno `giornaliero-20261113-034559-v4.db` ok.

## Ricettario sfogliabile (13/11/2026, ramo `ricettario-rubrica`, da rilasciare)

- SPEC 2.6: filtri per portata in testa all'elenco con il numero di piatti (nell'indirizzo,
  ricordati tornando dal piatto), elenco alfabetico diviso per iniziale, rubrica A–Z a lato
  da toccare o trascinare, con la lettera della sezione visibile evidenziata.
- Le portate importate con varianti ricadono nella predefinita («Antipasti / Fritti» →
  Antipasti, «Dolci al cucchiaio» → Dolci); le altre («Piatti unici», «Condimenti») hanno
  un filtro loro. Logica pura in `src/domain/ricettario.ts` con test.
- Solo interfaccia: nessuna migrazione, nessuna modifica ad API o dati.
- Test: `src/domain/ricettario.test.ts`, `test/e2e/ricettario-rubrica.spec.ts` (schermate
  in `test-results/ricettario/`). `npm run check` 224 test verdi, `npm run test:e2e` 31 verdi.
