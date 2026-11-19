# Avanzamento — Ricette di famiglia & Co. (menuapp)

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

- ~~Nessun test per l'avviso di aggiornamento PWA con due build reali~~: coperto dal 17/11
  (`test/e2e/aggiornamento.pwa.ts`, SPEC §29.8).
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

## Ricettario sfogliabile (13/11/2026, in produzione)

- SPEC 2.6: filtri per portata in testa all'elenco con il numero di piatti (nell'indirizzo,
  ricordati tornando dal piatto), elenco alfabetico diviso per iniziale, rubrica A–Z a lato
  da toccare o trascinare, con la lettera della sezione visibile evidenziata.
- Le portate importate con varianti ricadono nella predefinita («Antipasti / Fritti» →
  Antipasti, «Dolci al cucchiaio» → Dolci); le altre («Piatti unici», «Condimenti») hanno
  un filtro loro. Logica pura in `src/domain/ricettario.ts` con test.
- Solo interfaccia: nessuna migrazione, nessuna modifica ad API o dati.
- Test: `src/domain/ricettario.test.ts`, `test/e2e/ricettario-rubrica.spec.ts` (schermate
  in `test-results/ricettario/`). `npm run check` 224 test verdi, `npm run test:e2e` 31 verdi.
- Rilasciato il 13/11 (`20261113-1015-0c5a473`, schema v4 invariato, backup
  `manuale-20261113-101602-v4.db`): salute ok sui quattro indirizzi, dati invariati
  (3 eventi, 38 piatti, 38 foto), dailymeals e kidscalendar attivi.

## Multiutente con inviti e Tailscale Funnel (13/11/2026, in produzione)

- SPEC 3.0 / §19. Utenti, inviti monouso (24 h), richiesta di attivazione legata al browser con
  codice di verifica, approvazione dall'amministratore (o dall'utente da un altro suo
  dispositivo), sessioni lato server revocabili (`__Host-`, HttpOnly, Secure, SameSite),
  console `scripts/amministra.sh` per primo accesso e recupero.
- Eventi privati con condivisione in lettura/modifica, revoca, uscita, trasferimento; ricette
  private condivisibili in lettura, usate per copia (con foto); voce collegabile solo a piatti
  del proprietario dell'evento (servizio + trigger).
- Controllo dei permessi su tutte le rotte (`server/servizi/permessi.ts`), prima della
  validazione; 404 indistinguibili per chi non ha accesso; funzioni di sistema solo
  amministratore e solo dall'ingresso privato; ingresso pubblico su loopback 9873 per Funnel;
  9880 senza dati (rimanda all'HTTPS).
- Interfaccia: attivazione, attesa con codice, Il mio account (dispositivi, nuovo dispositivo,
  esporta i miei dati, esci), Utenti e dispositivi (amministratore), eventi «Condivisi con me»,
  scheda Condivisione, sola lettura per permesso, ricette «di …», «Copia nel mio ricettario».
- Migrazione `0005_utenti.sql` provata su una copia del database di produzione: conteggi
  invariati (3 eventi, 38 piatti, 282 ingredienti dei piatti, 38 foto, 4 voci), relazioni
  voci/foto identiche, `foreign_key_check` vuoto, `integrity_check` ok, spesa ricalcolata
  identica, 38 ricette leggibili, tutti i file delle foto presenti.
- Collaudo isolato (copia dei dati reali, porte di prova su loopback): ingressi, flusso
  d'invito da console, 401/404/403 attesi, origine estranea rifiutata.
- Test: `npm run check` 261 verdi (nuovi `accesso.test.ts`, `autorizzazione.test.ts`),
  `npm run test:e2e` 34 verdi (primo accesso reale nel progetto `accesso`, `multiutente.spec.ts`
  con due browser; schermate in `test-results/multiutente/`).
- Nota sviluppo: il server di sviluppo (9871) ha già migrato `dati-sviluppo/`: per entrare da
  8443 serve `npm run admin -- invito` e `npm run admin -- approva <codice>`.
- Rilasciato il 13/11 (`20261113-1204-2a4c181`, schema v5, backup
  `pre-migrazione-20261113-120451-v4.db`); telefono di Loris attivato dalla console. Nota: due
  ricette («Baccalà con cipolle», «Bourguignonne») erano state eliminate dall'app fra le 11:16
  e le 12:04, prima del rilascio: recuperabili da `manuale-20261113-101602-v4.db`.
- Funnel non ancora attivato (autorizzato; lo esegue Loris con
  `scripts/attiva-ingresso-pubblico.sh` e `tailscale funnel`).

## Ricettario di famiglia (13/11/2026, in produzione: `20261113-1323-80ec6d8`, schema v6)

- SPEC 3.1: ricette visibili a tutti per impostazione predefinita, «Rendi privata» per il
  proprietario (le private si condividono con persone scelte); modifica solo del proprietario;
  negli eventi altrui per copia. Migrazione `0006_visibilita_piatti.sql` provata su una copia
  del database di produzione (conteggi invariati, 36 ricette di famiglia, chiavi esterne e
  integrità ok). Filtro «Solo le mie», «Utenti e dispositivi» in Impostazioni.

## Spazio della famiglia e nuovo nome (16/11/2026, in produzione: `20261116-1126-eee3afc`, schema v7)

- SPEC 4.0 / §20. Milestone completate: C1 bacheche (famiglia ed eventi) con commenti, reazioni,
  foto, ricette segnalate; C2 sondaggi; C3 proposte di piatti con inserimento nel menù (copia
  della ricetta, nessun doppione); C4 chi porta cosa su «A cura di» con uscita/rientro nella
  spesa e prese in carico concorrenti; C5 centro notifiche (raggruppate, preferenze, pulizia
  dopo le revoche); C6 valutazioni e classifica ponderata. Gruppi familiari espliciti;
  permesso di partecipazione distinto. Nome «Ricette di famiglia & Co.» (breve «Ricette & Co.»).
- Migrazione `0007_famiglia.sql` provata su una copia del database di produzione (16/11):
  conteggi invariati (3 eventi, 21 voci, 73 piatti, 657 ingredienti, 46 foto, 4 utenti, 8
  sessioni), spesa identica, ricettario visibile identico per ogni utente, tutti e 4 gli utenti
  nel gruppo «Famiglia» (Loris amministratore), chiavi esterne e integrità ok.
- Test: `npm run check` 295 verdi (nuovi `famiglia.test.ts` 19, `incarichi.test.ts` 11, matrice
  estesa); `npm run test:e2e` 35 verdi (nuovo `famiglia.spec.ts` con due browser; schermate in
  `test-results/famiglia/`).
- Rilascio: `! scripts/rilascia.sh famiglia` (migrazione 0007 con backup verificato).
- Rilasciato il 16/11 alle 11:27 (backup `pre-migrazione-20261116-112703-v6.db`); verificati
  file del rilascio completi, salute su 9870 e Funnel, 401 senza sessione, 404 delle funzioni di
  amministrazione dall'esterno, manifest «Ricette & Co.», dati invariati, 4 utenti nella
  Famiglia, chiavi esterne ok, altri servizi attivi.

## Famiglia allargata unica, isolata (16/11/2026, in produzione: `20261116-1136-1f4db27`)

- Precisazione di Loris: una sola grande Famiglia, nessun sottogruppo; eventi selettivi; in
  futuro più Famiglie isolate. Il modello esistente era già compatibile (nessuna migrazione).
  Chiusi tre punti che con più Famiglie non sarebbero stati isolati: elenco `/persone`, nuove
  condivisioni e passaggi di proprietà verso chi è fuori dalla Famiglia, Famiglia di un nuovo
  utente. Condivisioni esistenti invariate. SPEC §20.1 aggiornata; 4 test nuovi.

## Più Famiglie per persona (16/11/2026, in produzione: `20261116-1215-3460a66`, schema v8)

- SPEC 5.0 / §21: Famiglie create da chiunque, inviti ad aderire (distinti dagli inviti
  all'account), uscita, rimozione, passaggio dell'amministrazione; Famiglia attiva (filtro sul
  dispositivo, selettore solo da due Famiglie, schermata per chi non ne ha); eventi con la loro
  Famiglia; ricette condivise con una o più Famiglie, copie private; classifiche e notifiche
  per Famiglia.
- Migrazione `0008_famiglie.sql` provata su una copia del database di produzione (16/11):
  conteggi invariati in tutte le tabelle, spesa identica, ricette visibili ed eventi con
  permessi identici per ognuno dei 4 utenti, 3 eventi assegnati a «Famiglia», 73 ricette
  condivise con «Famiglia» (nessuna privata), chiavi esterne e integrità ok. Nessuna decisione
  da prendere sui dati attuali.
- Test: `npm run check` 308 verdi (nuovo `famiglie.test.ts`, 9), `npm run test:e2e` 36 verdi
  (nuovo `multi-famiglia.spec.ts`; e2e esistenti resi indipendenti dal numero di Famiglie).
- Rilasciato il 16/11 alle 12:15 (backup `pre-migrazione-20261116-121540-v7.db`); verificati
  file del rilascio completi, salute su 9870 e Funnel, 401 senza sessione anche sulle rotte
  nuove, 404 dell'amministrazione dall'esterno, 9880 senza dati, conteggi invariati, 3 eventi
  e 73 ricette nella «Famiglia», chiavi esterne ok, altri servizi e serve invariati.

## Persone senza account negli incarichi (16/11/2026, in produzione: `20261116-1254-15742b6`, schema v9)

- SPEC 5.1 / §22: rubrica «Senza app» per Famiglia; «Affida» in «Chi porta» a chi usa l'app,
  a una persona della rubrica o a un nome (anche salvato in rubrica), con nota e uscita dalla
  spesa; quantità e unità delle cose da portare; nessuna identità per le persone esterne.
- Migrazione `0009_persone_esterne.sql` provata su una copia del database di produzione:
  conteggi invariati, spesa identica, voci e incarichi identici, chiavi esterne e integrità ok.
- Test: `npm run check` 314 verdi (nuovo `esterni.test.ts`, 6), `npm run test:e2e` 37 verdi
  (nuovo `esterni.spec.ts`).
- Proposta aperta: elenco dei partecipanti collegato ai coperti (vedi SPEC §22).
- Rilasciato il 16/11 alle 12:54; verificati salute (privato e Funnel), 401 senza sessione sulla
  rubrica, dati invariati, chiavi esterne ok, altri servizi attivi.

## Avvisi del rilascio (16/11/2026, in produzione: `20261116-1334-00a32ea`)

- `INEFFECTIVE_DYNAMIC_IMPORT`: il modulo dell'attività è ora in `src/features/piano/ModuloAttivita.tsx`
  (usato dal Piano e dall'editor delle voci), così il Piano resta caricato su richiesta.
- `glob@11.1.0` deprecato (dipendenza di `workbox-build`, solo per la build): `overrides` in
  `package.json` verso `glob@^14` (stessa API `globSync`); service worker con gli stessi file.
- `curl: Failed to connect` durante i controlli del rilascio: tentativi silenziosi mentre il
  servizio riparte; in caso di fallimento finale si mostra l'errore.
- Test: `npm run check` 314 verdi, `npm run test:e2e` 37 verdi. Nessuna migrazione.

## Ricerca delle ricette per ingredienti (16/11/2026, in produzione: `20261116-1456-1c8b196`)

- SPEC 5.2 / §23: ricerca per nome e ingredienti (catalogo e sinonimi), più termini, senza
  accenti e maiuscole, ordine per pertinenza; ricettario e scelta dei piatti nel menù.
- Nessuna migrazione. Test: `npm run check` 324 verdi, `npm run test:e2e` 38 verdi.
- Rilasciato il 16/11 alle 14:56; verificati salute (privato e Funnel), 401 senza sessione, altri servizi attivi.

## Organizzazione degli eventi (16/11/2026, in produzione: `20261116-1738-5e13659`, schema v12)

- SPEC 6.0 / §24–§27, quattro commit (M1–M4):
  - M1 Partecipanti: elenco facoltativo, conferme, accompagnatori con e senza nome, coperti
    manuali o calcolati, «Conferma presenza» per chi usa l'app, partecipanti in «Chi porta».
  - M2 Duplica evento (anche archiviato) ed edizioni di una ricorrenza.
  - M3 «A che punto siamo?» in Panoramica.
  - M4 Confronto fra edizioni.
- Migrazioni `0010_partecipanti.sql`, `0011_edizioni.sql`, `0012_origine_voci.sql` provate su una
  copia del database di produzione: conteggi, spesa, menù e coperti, incarichi e archivi
  identici; nessun partecipante creato, tutti gli eventi in manuale, nessuna serie; chiavi
  esterne e integrità ok.
- Limitazioni: niente link pubblici, email o SMS per le risposte; le cose da portare non si
  copiano duplicando; i voti di un'edizione non passano alla successiva (per scelta).
- Test: `npm run check` 357 verdi, `npm run test:e2e` 41 verdi (nuovi `partecipanti.spec.ts`,
  `edizioni.spec.ts`). Nessun intervento manuale oltre al rilascio.
- Rilasciato il 16/11 alle 17:38; verificati salute (privato e Funnel), 401 senza sessione,
  dati invariati (nessun partecipante, eventi in manuale, nessuna serie), chiavi esterne ok,
  altri servizi attivi.

## Ricorrenze e copia delle ricette fra Famiglie (17/11/2026, in produzione: `20261117-0836-e08f42c`, schema v13)

- SPEC 6.1 / §28: ricorrenze per Famiglia (Famiglia → Membri), associazione facoltativa agli
  eventi (riquadro «Ricorrenza» in Panoramica), proposta duplicando, confronto con l'evento
  precedente della ricorrenza. Sostituiscono le serie anonime di §25.
- Ricette: visibili in una sola Famiglia; «Copia in un'altra Famiglia» con foto duplicate e
  provenienza descrittiva, senza legami con l'originale.
- Migrazione `0013_ricorrenze.sql` provata su una copia del database di produzione: conteggi,
  spesa, menù, coperti, incarichi e archivi identici; nessuna serie da convertire, nessuna
  ricetta in più Famiglie; chiavi esterne e integrità ok.
- Differenze di comportamento: una ricetta creata via API senza Famiglia da chi ne ha più d'una
  nasce privata (prima: visibile in tutte); le serie anonime diventano ricorrenze con un nome.
- Test: `npm run check` 364 verdi (nuovo `ricorrenze.test.ts`), `npm run test:e2e` 43 verdi
  (nuovo `ricorrenze.spec.ts`).
- Rilasciato il 17/11 alle 08:36 (backup `pre-migrazione-20261117-083705-v12.db`); verificati
  salute (schema 13), migrazione applicata senza ricorrenze create, 6 eventi e 74 ricette,
  chiavi esterne e integrità ok.

## Rifinitura UX e collaudo (17/11/2026, in produzione: `20261117-1158-fd15fbd`, schema v14)

- SPEC 6.2 / §29. Audit iniziale: ricorrenze e copia delle ricette fra Famiglie già corrette
  (solo collaudo); notifiche senza categoria, gruppi non apribili, incarichi senza destinazione
  precisa e un errore (bacheca di un'altra Famiglia aperta su quella attiva); riepilogo senza
  priorità; ricettario che perdeva posizione e ricerca tornando indietro; suggerimenti del menù
  irraggiungibili da tastiera; nessun test dell'aggiornamento PWA.
- **Rettifica sulle presenze** (Loris, 17/11): solo chi può modificare l'evento aggiorna
  partecipanti, accompagnatori e stati; tolti «Conferma presenza» e la gestione dei propri
  accompagnatori dall'interfaccia, dal riepilogo e dalle API (403 prima della validazione). Le
  presenze già registrate in produzione (15 partecipanti) restano invariate.
- Decisione di Loris: nessuna notifica nuova per le conferme di partecipazione.
- Migrazione `0014_dettagli_notifiche.sql` (colonna JSON, nessun dato cambiato) provata su una
  copia del database di produzione: conteggi identici (salvo il registro delle migrazioni),
  19 notifiche e 15 partecipanti invariati, chiavi esterne e integrità ok.
- Test: `npm run check` 371 verdi (nuovo `notifiche.test.ts`; partecipanti e riepilogo
  aggiornati alla rettifica), `npm run test:e2e` 45 verdi (nuovi `rifinitura.spec.ts` e
  `aggiornamento.pwa.ts` su un server isolato 127.0.0.1:4175; `test:e2e` costruisce ora anche
  una seconda build `pwa-nuova`).
- Limitazioni: notifiche raggruppate più vecchie della 0014 senza elenco; un messaggio
  eliminato toglie l'intera notifica raggruppata che lo cita per ultimo; `max_accompagnatori`
  resta nel database senza effetto.
- Rilasciato il 17/11 alle 11:58 (backup `pre-migrazione-20261117-115914-v13.db`); verificati
  salute (schema 14), 19 notifiche e 15 partecipanti invariati, chiavi esterne e integrità ok.

## Ricorrenze standard (17/11/2026, in produzione: `20261117-1313-2de27ef`, schema v15)

- SPEC 6.3 / §30. Il ramo `rifinitura-ux` era già rilasciato: lavoro su un ramo nuovo da `main`.
- Stato iniziale: ricorrenze solo della Famiglia (§28), associate a mano; nessun tipo strutturato
  per le feste (il «Tipo» è pranzo/cena; l'occasione è testo libero con suggerimenti).
- Catalogo di 8 ricorrenze standard nel codice; associazione automatica dall'occasione alla
  creazione; scelte manuali che prevalgono; proposta al cambio d'occasione e per gli eventi
  esistenti; duplicazione, edizioni e confronto nella stessa Famiglia; un selettore unico che
  distingue standard e della Famiglia.
- Migrazione `0015_ricorrenze_standard.sql` provata su una copia del database di produzione:
  eventi e snapshot identici, nessuna associazione assegnata; l'evento «Vigilia di Natale» con la
  ricorrenza della Famiglia omonima la conserva (scelta manuale).
- Test: `npm run check` 382 verdi (nuovo `ricorrenze-standard.test.ts`, 11), `npm run test:e2e`
  46 verdi (nuovo `ricorrenze-standard.spec.ts`).
- Da sapere: in produzione esiste la ricorrenza della Famiglia «Vigilia di Natale»; un nuovo
  evento con occasione «Vigilia di Natale» entra nella standard, non in quella (niente unioni per
  nome). Duplicando l'evento esistente resta nella ricorrenza della Famiglia.
- Rilasciato il 17/11 alle 13:13 (backup `pre-migrazione-20261117-131414-v14.db`); verificati
  salute (schema 15), nessuna associazione standard assegnata, 6 eventi e 74 ricette, chiavi
  esterne e integrità ok.

## Partecipanti in tabella (17/11/2026, in produzione: `20261117-1420-ce7a017`)

- Richiesta di Loris: elenco meno dispersivo. Tabella Nome / Risposta con gli accompagnatori
  sotto l'invito; in consultazione solo nome e risposta («parziale» se le risposte differiscono);
  «Modifica elenco» mostra risposta modificabile, «Aggiungi» e il menù di ogni riga
  (accompagnatori, modifica, invito a parte, togli). SPEC §29.2.
- Solo interfaccia: nessuna migrazione, API invariate (permessi già sul server, §29.2).
- Tolta dall'elenco l'indicazione «Porta: …» (si vede in «Chi porta»); resta l'avviso per chi
  non partecipa ma ha un incarico.
- Test: `npm run check` 382 verdi, `npm run test:e2e` 46 verdi (`partecipanti.spec.ts` rifatto
  sulla tabella e sulla modalità di modifica).
- Rilasciato il 17/11 alle 14:20; verificati salute (schema 15), 15 partecipanti e 6 eventi invariati.

## Audit UX e riorganizzazione (17/11/2026, in produzione: `20261117-1548-667343a`)

- `docs/AUDIT-UX-ARCHITETTURA.md` (con schermate e prototipi in `docs/audit/`); implementata la
  proposta A con le decisioni di Loris: SPEC 6.4 / §31 (mappa della navigazione in §31.1).
- Cosa cambia per chi usa l'app:
  - evento in cinque schede: **Riepilogo** (con «Azioni» e «Stampa menù»), **Menù**, **Persone**
    (Presenze · Chi porta), **Prepara** (Spesa · Piano), **Bacheca**;
  - **Eventi**: In programma · Conclusi · Archivio, «Per te», «Duplica»;
  - **Famiglia**: Bacheca · Apprezzati · Persone · Gestione (le ricorrenze sono in Gestione);
  - **Impostazioni**: personali, ingredienti, amministrazione (solo per chi amministra);
  - ricetta: il contenuto prima, «Gestione della ricetta» in fondo (e dal pulsante in alto);
  - «A cura di» si affida in Chi porta;
  - messaggi temporanei in basso.
- Problemi dell'audit corretti:
  - P0: evento di un'altra Famiglia segnalato; selettore solo dove conta; Duplica anche in sola
    lettura; Famiglia visibile nel nuovo evento;
  - P1: «Menù ancora vuoto» non è «Tutto pronto»; schede tutte visibili; Panoramica alleggerita;
    Chi porta compatto; un solo posto per il responsabile; vista cucina a un tocco; archivio;
    indietro con la cronologia; messaggi in basso; Famiglia e Impostazioni riordinate.
- Nessuna migrazione. Nuova lettura `GET /per-te`; `menu.voci` nel riepilogo.
- Test: `npm run check` (unitari e server) e `npm run test:e2e` (nuovo `riorganizzazione.spec.ts`,
  e2e esistenti aggiornati); risultati nella relazione del rilascio.
- Da verificare su dispositivi fisici: barra e messaggi con la tastiera aperta su Android, area
  sicura in basso su iPhone/PWA installata, Echo Show 15 (testo grande).
- Rilasciato il 17/11 alle 15:48; verificati salute (schema 15), dati e integrità, `/per-te` 401 senza sessione.

## Eventi in un solo elenco (17/11/2026, in produzione)

- Richiesta di Loris: niente divisione fra eventi miei e condivisi. Un solo elenco in ordine di
  data; i condivisi hanno il badge «di … · sola lettura / puoi modificare», anche nel riquadro del
  prossimo evento (che ora può essere uno condiviso). SPEC 6.4.1.
- Solo interfaccia, nessuna migrazione. e2e `multiutente.spec.ts` e `riorganizzazione.spec.ts`
  aggiornati (ordine, badge, nessuna sezione «Condivisi con me»).
- Rilasciato il 17/11 alle 16:15 (`20261117-1615-090ef7d`); verificati salute, servizio e registro.

## Accesso per il dominio `ricettedifamiglia.online` (18/11/2026, in produzione)

- Verifica dell'accesso in vista della pubblicazione (SPEC §19, 6.4.2): nessuna registrazione
  autonoma (solo invito monouso + approvazione del dispositivo), ogni rotta API senza sessione 401,
  funzioni di sistema assenti dall'ingresso pubblico, permessi per utente invariati.
- Problemi trovati e corretti:
  - un secondo indirizzo pubblico non poteva scrivere (origine non ammessa) e non c'era modo di
    aggiungerlo senza toccare il servizio systemd: nuova chiave `MENUAPP_ALTRI_URL_PUBBLICI`;
  - l'ingresso privato si difendeva solo dall'intestazione del Funnel: un proxy del dominio
    puntato per errore alla 9870 avrebbe esposto le funzioni di sistema. Ora risponde solo a nomi
    locali e del tailnet;
  - pagina di accesso indicizzabile: `X-Robots-Tag: noindex, nofollow`.
- Test: `accesso.test.ts` (due indirizzi pubblici: invito, approvazione, sessione, scritture;
  origine estranea 403; ingresso privato con nomi pubblici 403; configurazione solo HTTPS).
- Nessuna migrazione. Dopo il rilascio non cambia nulla finché non si aggiorna `dati/server.json`
  e non si collega il dominio (OPERAZIONI, «Dominio proprio»).
- Rilasciato il 18/11 alle 10:21 (`20261118-1021-5b2a63d`); verificati salute (privato e pubblico),
  9870 con nome pubblico → 403, 9873 senza sessione → 401, admin → 404, `X-Robots-Tag`.
- Pubblicazione: Cloudflare Workers non adatto (Node, SQLite e file sul server); da usare
  Cloudflare Tunnel verso 127.0.0.1:9873 (indicazioni date a Loris, nulla configurato).

## Piano di migrazione a Cloudflare (18/11/2026, documento; realizzato nel ramo `cloudflare`)

- Analisi di fattibilità in `docs/PIANO-CLOUDFLARE.md`: Workers + R2 come proposto; database in
  un Durable Object SQLite invece che in D1 (transazioni sincrone come oggi); fasi C0–C7, limiti
  e costi del piano Free, decisioni D1–D5 in attesa di Loris. Nessun codice modificato; Debian
  invariata.

## Installazione Cloudflare, fasi C0–C6 (18/11/2026, in produzione: Debian `20261118-1258-1e63320`, Worker su ricettedifamiglia.online)

- Decisioni di Loris: Durable Object SQLite, R2 privato, piano Free da misurare, amministrazione
  dall'app solo agli amministratori, ripristino solo da script, primo amministratore con segreto
  temporaneo. Installazione indipendente: dati e utenti propri, nessuna sincronizzazione (C7).
- C0 (prototipo in workerd): Fastify non gira su Workers (`new Function`); SQLite del Durable
  Object con `transactionSync`, chiavi esterne attive, niente `user_version`/`integrity_check`,
  massimo 100 parametri per query.
- C1–C3 (codice comune, comportamento Debian invariato): interfaccia `Db` con apertura
  `node:sqlite` in `server/db/sqlite-node.ts`; migrazioni senza file in `applica.ts`;
  `CartellaFile` (disco/R2) per foto e allegati; configurazione dell'app separata dal motore
  (`server/api/applicazione.ts`); **motore leggero** compatibile con le rotte (`server/motore-leggero.ts`);
  backup su file solo nel montaggio Debian; liste di id della bacheca come parametro JSON.
- C4–C5 (`cloudflare/`): Worker con Static Assets e `_headers` generato, Durable Object `Archivio`,
  R2 con copie a fine richiesta e cestino, ingresso `unico`, console con segreto
  (`scripts/cloudflare/console.ts`), backup in R2, ripristino dalla console, manutenzione notturna.
  Pagina «Dati e backup» senza ripristino su Cloudflare.
- C6: `wrangler.jsonc` (dominio personalizzato, bucket, Cron), `scripts/cloudflare/rilascia.sh`
  (manuale), `docs/CLOUDFLARE.md` (preparazione sulla dashboard, primo amministratore, backup,
  misure). Nessuna operazione su Cloudflare eseguita: account, token e DNS restano a Loris.
- Problemi trovati e corretti: DELETE senza corpo arriva a Cloudflare con `content-length: 0`
  (prima 415); bacheca con più di 100 messaggi oltre il limite dei parametri; menù, inserimento
  rapido: con una rete lenta il cursore tornava al campo precedente e l'Invio finiva lì (anche Debian).
- Test: suite del server due volte (Fastify e motore leggero), `npm run test:cloudflare`,
  `npm run test:e2e:cloudflare` (la e2e su Cloudflare: ripristino dalla console invece che
  dall'app); e2e della revoca in bacheca resa deterministica (ricaricamento).
- Rilascio Debian del ramo invariato nel comportamento (`! scripts/rilascia.sh cloudflare`), poi
  `scripts/cloudflare/rilascia.sh` dopo la preparazione su Cloudflare (docs/CLOUDFLARE.md).

## Migrazione dei dati e nuovi domini (18/11/2026, codice in produzione; migrazione dei dati da fare)

- Richiesta di Loris: Cloudflare copia completa dei contenuti Debian con gli utenti di Cloudflare;
  app su `app.ricettedifamiglia.online`, dominio principale con la sola pagina «Sito in costruzione»
  (nessun riferimento all'app). SPEC §33, §34; procedura in docs/CLOUDFLARE.md.
- Schema reale analizzato (Debian, sola lettura): 4 utenti (Loris, Raffa, Lucia, Palli), una Famiglia;
  23 colonne in 20 tabelle puntano agli utenti, più gli id nei dettagli delle notifiche e i nomi
  nel testo (autore d'origine, partecipanti).
- Codice: `cloudflare/importazione.ts` (corrispondenza esplicita, piano senza modifiche, importazione
  in una transazione, verifica di conteggi, riferimenti e impronte dei file), comandi della console,
  `scripts/cloudflare/migra.ts`; backup `pre-migrazione` in R2; `sito/` e
  `scripts/cloudflare/rilascia-sito.sh`; `rilascia.sh --transizione`.
- Prova completa in locale (`test/cloudflare/worker.test.ts`): Debian di prova con utente omonimo e
  utente solo Debian, proposta, conferma obbligatoria, importazione, utenti e sessioni Cloudflare
  intatti, riferimenti tradotti, foto in R2, annullamento.
- Nessuna operazione eseguita su Cloudflare né sui dati di produzione.
- Rilasciato il 18/11: Debian `20261118-1535-71ef495` (salute ok, schema 15); Worker in transizione
  (versione `af913611`) su `app.ricettedifamiglia.online` e ancora sul dominio principale. Il
  controllo finale dello script era fallito solo perché il DNS del router di casa ricordava il nome
  `app.` come inesistente: verificato col DNS di Cloudflare. Ramo `rilascio-dns`: le verifiche degli
  script ora interrogano 1.1.1.1.
- Decisioni di Loris (18/11): utenti Debian assenti su Cloudflare creati come «nuovi», senza
  dispositivi; ruoli: restano quelli di Cloudflare.
- Rilascio `rilascio-dns` (18/11 16:25): Debian `20261118-1625-14fddc5`, Worker in transizione.
- **Migrazione eseguita il 18/11/2026** (`20261118-1631`, autorizzata da Loris): backup Debian
  `manuale-20261118-163128-v15.db`; corrispondenza confermata (Loris e Lucia esistenti, Raffa e Palli
  nuovi senza dispositivi, ruoli di Cloudflare); piano superato; importazione con backup
  `pre-migrazione-20261118-153446-v15.json` (annullamento: `migra.ts annulla` con quel nome); verifica
  superata (conteggi uguali a Debian, riferimenti integri, 48 foto presenti e identiche). Sessioni di
  Loris su Cloudflare intatte. Debian non modificato, ancora attivo con il Funnel.
- Console spenta (segreto tolto dal Worker e da cloudflare.env). Sito pubblicato il 18/11
  (`ricettedifamiglia-sito`, versione `1ed0dea9`): dominio principale staccato da `menuapp`, solo
  «Sito in costruzione», 404 per le risorse dell'app, noindex; app solo su `app.…`. I falsi errori
  finali degli script venivano dal DNS del router (risposte negative in memoria): verifiche ora col
  DNS di Cloudflare.
- 18/11 sera: `Clear-Site-Data` del sito con «cookies» cancellava anche la sessione di `app.…`
  (vale per tutto il dominio): tolto, sito ripubblicato (`3a1f1aa7`), test d'architettura.
  Console: il Durable Object legge i segreti solo al suo avvio, quindi attivazione e spegnimento non
  avevano effetto finché non ripartiva; ora il codice arriva dal Worker (intestazione interna, mai dal
  browser). Da rilasciare: `scripts/rilascia.sh dopo-migrazione`, poi `scripts/cloudflare/rilascia.sh`
  (senza `--transizione`: il dominio principale è già del sito).
- Rilasciato da Loris il 18/11 sera: Debian `20261118-1709-c75e999`, Worker (deploy 16:12 UTC).
  Verificato il 19/11 in sola lettura: salute di `app.…` ok, console «non attiva» con un codice di
  prova, dominio principale ancora «Sito in costruzione», salute di Debian ok.
- Prossimi passi: inviti a Raffa e Palli e ricollegamento di Lucia su `app.…`; dismissione di
  Debian e Funnel su conferma di Loris.

## Ambienti TEST e PRODUZIONE; «A che punto siamo?» e il menù (19/11/2026, ramo `riepilogo-menu`)

- Ambienti (docs/RILASCI.md): **TEST** = Debian, solo dal tailnet (`…ts.net:9870`); **PRODUZIONE** =
  Cloudflare (`app.ricettedifamiglia.online`). Dati separati, nessun trasferimento fra ambienti.
  `scripts/cloudflare/rilascia.sh` rifiuta un commit diverso da quello attivo su TEST. Verificato
  (sola lettura): il Worker `menuapp` non ha build automatiche da GitHub (solo `pole2-landing` le ha).
- Funnel: `scripts/disattiva-funnel.sh` (da lanciare da Loris) spegne solo la 443 pubblica verso
  127.0.0.1:9873, dopo aver controllato che sia quella di Menù & Co.; verifica che i serve 9870 e
  8443 e Tailscale restino invariati e che TEST risponda. Ancora attivo finché Loris non lo lancia.
  Dalla LAN senza Tailscale (`:9880`, HTTP) TEST non dà dati: serve Tailscale.
- Riepilogo: prima il menù contava solo se vuoto; con un piatto qualsiasi spariva e l'evento poteva
  risultare «Tutto pronto». Ora: vuoto → «Menù ancora vuoto»; portate senza piatti → «Menù in
  preparazione» (da fare, elenca le portate, suggerisce di togliere quelle che non servono); ogni
  portata con almeno un piatto → «Menù completato» fra le cose a posto. Nessun minimo, nessun segno
  manuale né migrazione: le portate dell'evento dicono cosa si vuole servire (SPEC §26).
  `GET /eventi/:id/riepilogo` → `menu.portateVuote`. Test: unitari, server (due motori), e2e.
