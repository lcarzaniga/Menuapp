# Avanzamento — Ricette di famiglia & Co. (menuapp)

Documento operativo per riprendere il lavoro fra sessioni.

## Stato (aggiornato al 21/11/2026)

| Ambiente | Dove | Codice | Schema |
|---|---|---|---|
| **PRODUZIONE** | Cloudflare, `https://app.ricettedifamiglia.online` (Worker `menuapp`, versione `e5814c15`, rilascio `20261121-1713-2eafbbb`) | `2eafbbb` | 21 |
| **TEST** | Debian, `https://loris-srv01.dala-tortoise.ts.net:9870/` (solo Tailscale) | `2eafbbb` (+ eventuali commit di sola documentazione) | 21 |

Dopo `2eafbbb` su `main` ci sono solo commit di documentazione: il codice di TEST e di PRODUZIONE è
lo stesso. Il rilascio attivo su TEST si legge con `readlink rilasci/attuale` (un documento non può
riportare il commit che lo pubblica).

- Dominio principale `ricettedifamiglia.online`: solo «Sito in costruzione» (Worker
  `ricettedifamiglia-sito`, SPEC §34). Tailscale Funnel spento.
- Procedura di rilascio: docs/RILASCI.md (TEST, prova di Loris, PRODUZIONE solo con il suo OK).
- Utenti in produzione: Loris, Lucia, Palli, Raffa (tutti collegati su `app.…`).
- **Branch**: `main`, pubblicato su GitHub e uguale al rilascio di TEST; lavoro sempre su un ramo dedicato.
- **Sviluppo**: tmux `menuapp` (finestre `server` → 9871 con `dati-sviluppo/`, `dev` → Vite 5173,
  telefono via `…ts.net:8443`).

## Completato nella v1 (12/11/2026)

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

## Test (ultima esecuzione, 19/11/2026)

| Comando | Esito |
|---|---|
| `npm run check` (lint, tipi, 798 test: dominio, server su Fastify e sul motore leggero, architettura, build) | verde |
| `npm run test:e2e` (52 scenari telefono + desktop) | verde |
| `npm run test:cloudflare` (9 prove sul Worker in locale, R2 compreso) | verde |

## Decisioni tecniche

- Nomi del codice in italiano; vedi registro SPEC 2.1 per gli scostamenti dal documento.
- Componenti UI scritti a mano in stile shadcn (radix-ui + cva), `<select>` nativi.
- Schermate caricate a richiesta (bundle iniziale ~410 kB).
- Test e2e: server reale su 127.0.0.1:4174 con `test-results/dati-e2e`, Chrome di sistema.

## Problemi aperti

- Copia dei backup su un secondo supporto: decisione aperta (SPEC §11.6). In produzione i backup
  sono in R2 (giornalieri e pre-migrazione).
- Trascinamento per il riordino non implementato (taglio previsto): Su/Giù/Sposta in.
- Senza console accesa Claude non ha una sessione di produzione: le verifiche dopo un rilascio con
  accesso (ricette, foto, famiglie, notifiche) le fa Loris nell'app.
- Rami vecchi non uniti, non toccati: `avanzamento-organizzazione`, `avanzamento-ricerca`.

## Prossima attività

Nessuna in corso. Il piano di evoluzione (docs/PIANO-EVOLUZIONE.md) è completato; le richieste
successive (ricette della Famiglia attiva, «Chi porta cosa» flessibile, memoria di famiglia,
collaborazione sulle ricette) sono in produzione.

---

# Storia del lavoro (dal più vecchio)

Ogni sezione è com'era al momento; lo stato attuale è in cima al documento. Fino al 18/11/2026
«in produzione» indica il server Debian, dal 18/11 (migrazione) Cloudflare.

## In produzione dal 12/11/2026 (rilascio `20261112-1520-fd1a901`, schema v2)

- Grafica nuova (font, illustrazioni, testo scalabile per l'Echo Show 15).
- Accesso dalla rete di casa senza Tailscale: http://192.168.1.160:9880/ (SPEC 2.2).
- Formato ricetta v1, importazione con foto, foto dei piatti, esportazioni ZIP (SPEC 2.3).
- Migrazione 0002 applicata con backup `pre-migrazione-20261112-152102-v1.db`.

- Foto collegate ai passaggi (SPEC 2.4), migrazione 0003 applicata con backup
  `pre-migrazione-20261112-154031-v2.db`; rilascio `20261112-1540-d284829`, schema v3.
- Porta 9880 raggiungibile anche via Tailscale (`…ts.net:9880`, `100.114.50.37:9880`).

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
- Prossimi passi: ~~inviti a Raffa e Palli e ricollegamento di Lucia su `app.…`~~ (fatti da Loris il
  19/11: tutti collegati); Funnel spento il 19/11; Debian resta come TEST.

## Ambienti TEST e PRODUZIONE; «A che punto siamo?» e il menù (19/11/2026, in produzione: TEST `20261119-0922-1f0eff1`, Cloudflare `20261119-0925-1f0eff1`)

- Ambienti (docs/RILASCI.md): **TEST** = Debian, solo dal tailnet (`…ts.net:9870`); **PRODUZIONE** =
  Cloudflare (`app.ricettedifamiglia.online`). Dati separati, nessun trasferimento fra ambienti.
  `scripts/cloudflare/rilascia.sh` rifiuta un commit diverso da quello attivo su TEST. Verificato
  (sola lettura): il Worker `menuapp` non ha build automatiche da GitHub (solo `pole2-landing` le ha).
- Funnel: `scripts/disattiva-funnel.sh` (da lanciare da Loris) spegne solo la 443 pubblica verso
  127.0.0.1:9873, dopo aver controllato che sia quella di Menù & Co.; verifica che i serve 9870 e
  8443 e Tailscale restino invariati e che TEST risponda. Spento da Loris il 19/11.
  Dalla LAN senza Tailscale (`:9880`, HTTP) TEST non dà dati: serve Tailscale.
- Riepilogo: prima il menù contava solo se vuoto; con un piatto qualsiasi spariva e l'evento poteva
  risultare «Tutto pronto». Ora: vuoto → «Menù ancora vuoto»; portate senza piatti → «Menù in
  preparazione» (da fare, elenca le portate, suggerisce di togliere quelle che non servono); ogni
  portata con almeno un piatto → «Menù completato» fra le cose a posto. Nessun minimo, nessun segno
  manuale né migrazione: le portate dell'evento dicono cosa si vuole servire (SPEC §26).
  `GET /eventi/:id/riepilogo` → `menu.portateVuote`. Test: unitari, server (due motori), e2e.
- Primo ciclo TEST → PRODUZIONE (19/11): rilascio su TEST da Loris, prova funzionale e conferma;
  rilascio Cloudflare (versione `8325776a`) solo dopo, con lo stesso commit. Verificato: salute ok,
  401 senza sessione, file dell'app uguali alla build, dominio principale ancora sul sito. Nessun
  dato trasferito fra gli ambienti; schema invariato (15).

## Piano di evoluzione (19/11/2026, documento approvato; fasi tutte in produzione)

- `docs/PIANO-EVOLUZIONE.md`: ricette pubbliche fra Famiglie (1A Famiglia d'origine, 1B pubbliche e
  copia), riuso degli eventi (estensione di «Duplica»), riepilogo a gruppi e livelli, Regia della
  cucina sul piano esistente; 12 decisioni aperte con la soluzione consigliata. Nessun codice
  modificato. Dati di TEST letti in sola lettura: 77 ricette tutte con Famiglia d'origine
  determinabile, 0 attività nel piano, attrezzature solo testo libero.

## Fase 1A — Famiglia d'origine delle ricette (19/11/2026, in produzione dal 19/11, schema 16)

- Decisioni di Loris sul piano: D1–D12 approvate; D5 rivista (pubbliche cercabili nei suggerimenti
  del menù, copiate al collegamento e riusate).
- Migrazione 0016, origine alla nascita in un solo punto (`inserisciPiatto`), regole per copie ed
  eventi, `PUT /piatti/:id/famiglia-origine`, «Nata in …» nella scheda, comando `origini` nelle due
  console. SPEC §35.
- Prova a secco su una copia del database di TEST: 77/77 determinate, condivisioni invariate,
  integrità e chiavi esterne ok. Test: `npm run check` (699), `test:cloudflare` (8), e2e mirati.
- Rilasciata su TEST da Loris (19/11), verificata: schema 16, `origini` → 77/77. Provata da Loris.
  Produzione: un unico rilascio alla fine delle fasi (decisione di Loris).

## Fase 1B — Ricette pubbliche fra Famiglie (19/11/2026, in produzione dal 19/11, schema 17)

- Migrazione 0017 (`piatti.pubblica`, trigger «serve l'origine», `preferenze_utente`); lettura delle
  pubbliche per chi ha una sessione in `piattoLeggibileDaAltri` (scheda, foto, esportazione, bacheca,
  classifiche) ed elenco `?pubbliche=no|si|solo`; visibilità a tre livelli; copie sempre private
  (D4) e indipendenti con provenienza e id sorgente; nei menù copia riusata (D5); preferenza
  personale. Interfaccia: filtri ed etichette del ricettario, «Pubblica nell'app…» con conferma,
  «Copia in una mia Famiglia», «Hai già una copia», suggerimenti del menù. SPEC §36.

## Ricette della Famiglia attiva (19/11/2026, in produzione dal 19/11)

- Richiesta di Loris provando la 1B su TEST con una seconda Famiglia: le ricette di una Famiglia
  solo in quella Famiglia; le personali sempre; per usarle altrove si copiano. SPEC §37.
- `GET /piatti?famiglia=`, ricettario e suggerimenti del menù per Famiglia (attiva / dell'evento);
  `piattoPerEvento` copia nella Famiglia dell'evento le ricette di altre Famiglie. Nessuna migrazione.
- Test: `npm run check` (723), e2e completi (48).
- Provata da Loris su TEST («ok a posto»).

## Fase 3 — «A che punto siamo?» a gruppi (19/11/2026, in produzione dal 19/11)

- Gruppi Da organizzare / Da acquistare / Da preparare, livelli da risolvere / aperto /
  suggerimento, «Da sapere»; ritardo con l'ora italiana (`adessoInItalia`, anche sul Worker),
  prossima attività, piatti in spesa senza ricetta o ingredienti come suggerimento, «Evento
  passato». Nessuna migrazione. SPEC §26.
- E2e multi-famiglia: il controllo del ricettario usava un elenco in cache creato dalla pagina
  dell'evento (ricette create dall'API esterna): ricaricamento nel test.
- Osservazione di Loris su TEST: i gruppi comparivano solo con cose aperte (niente «Da preparare»
  senza piano) e i livelli si capivano solo dalle icone. Corretto: tre gruppi sempre visibili con
  tutte le loro voci (anche «non usato»), livello scritto accanto («da risolvere», «suggerimento»).
- Seconda osservazione di Loris: menù vuoto e in preparazione allo stesso livello. Criterio unico:
  «da risolvere» solo se qualcosa è andato storto (responsabile assente, attività in ritardo,
  quantità da verificare); menù vuoto, coperti mancanti e cose senza nessuno diventano «aperti».

## Fase 2 del piano — Riuso degli eventi (19/11/2026, in produzione dal 19/11, schema 18)

- Estesa «Duplica evento»: scelte (menù, partecipanti, chi porta cosa, piano, stampa), anteprima
  senza scritture (`anteprima: true`), incarichi da riassegnare con promemoria (`incarico_precedente`,
  verificato alla lettura: le condivisioni non si copiano), «Affida a …» in Chi porta. Decisione
  sulle ricette estratta in `esitoRicetta` (anteprima e collegamento usano la stessa). SPEC §25.
- Osservazioni di Loris su TEST: l'anteprima mostrava solo le scelte con qualcosa da copiare
  (sembrava che le altre non funzionassero) → ogni scelta spuntata ha la sua riga, anche vuota;
  la barra di scorrimento usciva dal bordo arrotondato → in tutte le finestre scorre solo il
  contenuto, titolo e pulsanti restano fermi (`src/components/ui/dialog.tsx`).

## Fase 4 del piano — Regia della cucina (19/11/2026, in produzione dal 19/11)

- `/eventi/:id/regia` sul piano esistente: In ritardo / Adesso / Più tardi / Fatto, filtri per
  attrezzatura e giorno, attrezzature dal testo delle ricette, «Ricetta in cucina», spunta, testo
  grande, Wake Lock condiviso; «Prepara il piano dai piatti» con l'ora suggerita. SPEC §38.

## «Chi porta cosa» flessibile (19/11/2026, in produzione dal 19/11, schema 19)

- Richiesta di Loris (19/11). Analisi: le voci del menù sono già gli incarichi dei piatti (stesso
  record) e le cose da portare coprono i contributi generici: bastava «da definire» e «contributi»
  sulla voce (migrazione 0019, trigger senza ricetta), «Piatto a scelta» e «Precisa» in Chi porta,
  «da definire» nel menù e nell'editor, spesa e riepilogo coerenti, duplicazione. SPEC §39.

## Memoria di famiglia (19/11/2026, in produzione dal 19/11, schema 20)

- Richiesta di Loris (19/11). Tabella `memorie` (storia / ricordo / esperienza, con Famiglia: pronta
  per un archivio senza ricetta), foto in `foto_piatti` con `memoria_id` (stessi file e backup),
  regole di lettura e scrittura in `permessi.ts` (anche per le foto), sezione nella scheda. La
  scheda di una ricetta altrui è in sola lettura: la memoria usa solo lo stato della connessione,
  il server applica i permessi. SPEC §40.

## Rilascio unico in produzione (19/11/2026)

- Su conferma di Loris: Cloudflare `20261119-1453-d949431` (versione `45d4ee02`), schema 15 → 20 (fasi
  1A, 1B, ricette della Famiglia, riepilogo, riuso degli eventi, regia, chi porta flessibile, memoria).
  Verificato: salute ok, 401 senza sessione anche sulle rotte nuove, dominio principale ancora sul sito.
- Trovato dopo il rilascio: il Durable Object applicava le migrazioni **senza** backup pre-migrazione
  in R2 (avevo detto il contrario). Copertura: giornaliero `giornaliero-20261119-024549-v15.json`;
  migrazioni solo additive, già provate su una copia dei dati di TEST. Corretto nel ramo
  `backup-migrazioni-cloudflare` (backup `pre-migrazione` prima di ogni migrazione nel Worker).

## Collaborazione sulle ricette e proprietà (19/11/2026, in produzione dal 19/11, schema 21)

Stato: **sviluppato, testato, su TEST** (`20261119-1546-1806441`, poi con la correzione del backup
`20261119-1615-60c2d67`), **collaudato da Loris**, **in PRODUZIONE** dal 19/11/2026 (vedi sotto).

- Situazione di partenza: PRODUZIONE `20261119-1453-d949431` (schema 20); TEST `20261119-1458-9a44716`
  (in più solo il backup pre-migrazione del Worker, in attesa dell'OK per la produzione).
- Migrazione 0021: `proposte_piatto`, `modifiche_proposta`, `revisioni_piatto`,
  `trasferimenti_piatto`, `foto_piatti.proposta_id` (+ trigger); nuove tabelle nei backup.
- Codice: logica pura `src/domain/ricetta/proposte.ts` (differenze, conflitti, applicazione,
  dipendenze); `server/servizi/collaborazione.ts` e `revisioni.ts`; permessi in `permessi.ts`
  (proponente, proposta, trasferimento, amministratore della ricetta; foto proposte); cronologia
  registrata da `aggiornaPiatto` e dalle foto; interfaccia: barra nella scheda, editor in modalità
  proposta, pagine Proposte e Cronologia, trasferimento e riassegnazione. SPEC §41.
- Scelte: conflitti ricalcolati e non memorizzati; riassegnazione amministrativa con accettazione del
  destinatario (immediata se è l'amministratore stesso); al trasferimento le voci degli eventi di
  altri passano a una copia del proprietario dell'evento (vincolo del database §19.4); il ripristino
  non tocca le foto.
- Verifica su TEST dopo il rilascio (autorizzato da Loris): schema 21, integrità e chiavi esterne ok,
  ricette 77, foto 48, condivisioni 76, eventi 6, voci 23 (come prima), 77/77 con Famiglia
  d'origine, 401 senza sessione. Backup `manuale-20261119-154652-v20.db`.

## Incidente nel rilascio in produzione della collaborazione (19/11/2026)

- Rilascio Cloudflare di `1806441` (versione `992eef87`) autorizzato da Loris: il Worker non partiva
  (errore 1101). Causa: il backup pre-migrazione (aggiunto in `9a44716`) esportava con l'elenco delle
  tabelle del codice nuovo, comprese quelle della 0021 non ancora create → «Backup pre-migrazione
  fallito, nessuna migrazione applicata». La protezione ha funzionato: schema 20 e dati intatti.
- Ritorno con `wrangler rollback` alla versione `45d4ee02` (`d949431`, schema 20): app di nuovo attiva
  dopo circa 6 minuti (15:52–15:58). Su Debian il backup è una copia del file: per questo TEST non
  aveva mostrato il problema.
- Correzione nel ramo `backup-schema-precedente`: l'esportazione legge solo le tabelle esistenti;
  test di regressione dagli schemi 15, 19 e 20; prova locale del percorso reale (Worker `d949431`
  allo schema 20, poi Worker nuovo sugli stessi dati: backup `pre-migrazione-…-v20.json` in R2,
  migrazione, risposte corrette).
- PRODUZIONE resta su `d949431` (schema 20) finché la correzione non passa da TEST.
- Correzione su TEST (`20261119-1615-60c2d67`, autorizzato da Loris), poi PRODUZIONE su suo OK:
  Cloudflare `20261119-1630-60c2d67` (versione `94d01118`), schema 20 → 21. Backup
  `pre-migrazione-20261119-153113-v20.json` (572 KB) creato in R2 prima della migrazione. Verificato:
  salute ok, 401 senza sessione anche su proposte e cronologia, file dell'app uguali alla build,
  dominio principale ancora «Sito in costruzione». Accesso, ricette, foto, famiglie e notifiche con
  una sessione: da controllare da Loris nell'app (senza console non ho una sessione di produzione).

## Controlli di GitHub in errore (19/11/2026, ramo `ci-cache-istruzioni`)

- Dal commit `878b0a0` (riuso degli eventi) i «Controlli» di GitHub Actions fallivano su
  `server/api/partecipanti.test.ts` (migrazione 0010), mentre sul server passavano. Causa: la cache delle
  istruzioni preparate (`server/db/connessione.ts`) teneva un `SELECT *` preparato prima delle
  migrazioni; con Node 24.18 (server) restituiva le colonne di prima, con il Node 24 più recente di
  GitHub quelle nuove, e il test confrontava le righe intere (la 0018 aggiunge una colonna).
- Correzione: `applicaElenco` svuota la cache dopo ogni migrazione (nessuna istruzione con lo schema
  vecchio dopo un cambio); il test confronta le colonne di allora (`toMatchObject`). Nessun effetto
  sull'app in uso: su Debian le migrazioni avvengono all'avvio e il ripristino usa una connessione
  separata; il Durable Object non tiene istruzioni preparate.

## Segnaposto (19/11/2026, ramo `segnaposto`, nessuna migrazione)

Stato: **sviluppato e testato automaticamente**; non su TEST (serve l'autorizzazione di Loris);
non collaudato; non in PRODUZIONE.

- Funzione: «Stampa segnaposto» dalla panoramica dell'evento e dalla stampa del menù; cavalletto
  (4 per A4, retro capovolto, piega con due tacche) o piatto (10 per A4); nomi proposti dai
  partecipanti (confermati e in attesa) o scritti a mano, copie, ordine, selezione, senza doppioni;
  nome dell'evento facoltativo; stile del menù o proprio; linee di taglio. SPEC §42.
- Dati: chiave `segnaposto` nel JSON di `stili_stampa.opzioni` (stessa versione del menù, ciascuno
  conserva la parte dell'altro); rotte `GET|PUT /eventi/:id/segnaposto`. Archivio, duplicazione,
  esportazione e ripristino li portano già con la riga.
- Codice: `src/domain/segnaposto.ts` (nomi, impaginazione, dimensione dei nomi),
  `src/contratto/segnaposto.ts`, `server/servizi/segnaposto.ts`, `FogliSegnaposto.tsx` +
  `segnaposto.css`, `PaginaSegnaposto.tsx`; controlli comuni della stampa in `controlli.tsx`,
  salvataggio automatico reso generico (`useStile.ts`).
- Test: logica (nomi, doppioni, copie, riordino, fogli, dimensione dei nomi), rendering (due facce,
  retro vuoto, taglio, più fogli, accenti, modelli), server su due motori (proposta, indipendenza,
  menù e segnaposto senza toccarsi, 409, validazione, archivio, duplicazione, ripristino), e2e su
  telefono e desktop (a mano, dai partecipanti, stile proprio, ritorno al menù) e stampa reale in PDF
  per i cinque modelli nei due formati con controllo che nessun nome esca dalla sua zona.
  Verifica visiva dei PDF (`test-results/segnaposto/*.pdf`). `npm run check` 826 test, e2e 57,
  Worker 9: verdi.

## Segnaposto: più biglietti per foglio (19/11/2026, ramo `segnaposto-a4`)

Stato: **sviluppato e testato automaticamente**; non su TEST; non collaudato; non in PRODUZIONE.
(I segnaposto `6c90eeb` sono su TEST dal 19/11, `20261119-1813-6c90eeb`.)

- Richiesta di Loris dopo la prova su TEST: troppa carta da buttare. Margine minimo da 10 a 5 mm e
  orientamento scelto per avere più cartoncini: cavalletto da 4 a 6 per foglio (copertura dal 58%
  all'87%), piatto da 10 a 12 (dal 72% all'87%). Cartoncini girati di 90° sul foglio; misure e
  composizione delle facce invariate. SPEC §42.1.

## Restyling «Cucina di famiglia» — fase 0, rete di sicurezza (20/11/2026, ramo `restyling`)

Stato: **sviluppato e testato automaticamente**; nessun cambiamento visibile; non su TEST.

- Piano approvato da Loris (20/11): sette fasi tecniche su un solo ramo `restyling`, un commit per
  fase; due cicli di rilascio su TEST (A: fasi 0–2; B: fasi 3–6) e un solo rilascio in PRODUZIONE
  dopo l'approvazione finale. Decisioni: tema scuro più caldo, segmento selezionato chiaro con
  ombra, illustrazione del prossimo evento piccola, navigazione invariata, quantità nella colonna
  sinistra della vista cucina, verde per il completato, nessuna funzione nuova, stampa esclusa.
- Confronti visivi: `npm run test:aspetto` (`playwright.aspetto.config.ts`, `test/e2e/aspetto.visivo.ts`),
  server separato sulla porta 4176 con database nuovo a ogni esecuzione. 9 pagine (eventi, evento,
  menù, bacheca, ricetta con e senza foto, vista cucina, famiglia, impostazioni) × 6 configurazioni
  (telefono 390 px chiaro e scuro al 100%, chiaro al 150%; telefono 360 px scuro al 150%; desktop
  chiaro e scuro) = 54 schermate di riferimento in `test/e2e/aspetto/` (8,8 MB), confronto al pixel.
- Stabilità: dati di prova fissi, orologio del browser al 19/11/2030, date del server riscritte con un
  istante fisso nelle risposte dell'API, caratteri e immagini attesi, animazioni, notifiche a comparsa
  e service worker esclusi; barra in basso del telefono in fondo alla pagina negli scatti.
  Riproducibilità verificata con più esecuzioni consecutive identiche.
- Le schermate valgono per questo server e il Chrome installato: dopo un aggiornamento di Chrome si
  rigenerano con `npm run test:aspetto:aggiorna`, prima di qualunque modifica grafica.
- Difetti già presenti, visibili nelle schermate (da correggere nelle fasi 2–3): a 360 px con testo al
  150% il titolo «Eventi» è coperto dai pulsanti, i nomi degli eventi successivi sono troncati, le
  etichette della barra in basso si sovrappongono.

### Fase 1 — Token (ramo `restyling`)

- `src/styles/index.css`: ombra più leggera nei due temi; nuove variabili `--salvia-testo` (testo sul
  fondo salvia, per il conto alla rovescia) e `--fuga` (griglia delle piastrelle); sfondo dell'app
  (luci calde e fughe da 3 rem) su un livello fisso `body::before`, senza `background-attachment:
  fixed`, nascosto in stampa. Tema chiaro invariato nei colori.
- Tema scuro più caldo: sfondo `#201b19`, carta `#2c2521`, tenue `#372e29`, testo `#f7eee5`, testo
  secondario `#bca99c`, bordo `#55453b`, primario `#e8a184` con testo `#281c18`, fondi tenui del
  primario e della salvia riallineati (le superfici restano più chiare dello sfondo).
- `test/contrasti.test.ts`: contrasti dei due temi letti dal CSS (testi ≥ 4,5:1, bordi dei controlli
  ≥ 3:1) e ordine delle superfici scure.
- Confronti visivi: soglia per pixel portata a 0,01 (la predefinita non vedeva il cambio del tema
  scuro), confronto di tutte le schermate in ogni esecuzione. Differenze della fase 1 riviste: tutte e
  54 le schermate cambiano per ombra, fughe e tema scuro, nessuna differenza di impaginazione;
  riferimenti aggiornati. Negli scatti lo sfondo fisso copre tutta la pagina (adattamento solo di test).

### Fase 2 — Componenti condivisi (ramo `restyling`)

- Segmenti (`Navigazione.tsx`): selezionato chiaro con l'ombra nuova e in grassetto (nel tema scuro
  sulla superficie più chiara, barra sullo sfondo); con il testo grande va a capo, con un tetto di
  16 px perché ogni parola stia nella sua colonna anche a 360 px.
- Badge: variante `tempo` (fondo salvia, `--salvia-testo`) per il conto alla rovescia.
- Nuovo `components/BloccoData.tsx` (giorno, numero, mese; in rem; `evidenza` per il prossimo evento;
  data completa per i lettori di schermo) e `partiData` in `domain/tempo.ts`. Si usano nella fase 3.
- Intestazione delle pagine (`Pagina.tsx`): le azioni vanno a capo invece di coprire il titolo (a
  360 px con testo al 150% «Eventi» era coperto da «Duplica» e «Nuovo»).
- Barra in basso (`Layout.tsx`): etichette a 11 px anche con il testo ingrandito (le icone crescono),
  intere e separate a 360 px con testo al 150% (prima «Ricettario» e «Impostazioni» si sovrapponevano).
- Test: `components/componenti.test.tsx` (blocco data, badge); nei confronti visivi la verifica della
  barra com'è davvero durante lo scorrimento (sul bordo dello schermo, fine pagina non coperta,
  etichette intere e separate), che fallisce con la barra di prima.
- Stabilità dei confronti: due cause di differenze occasionali trovate ripetendo le esecuzioni e
  rimosse solo negli scatti (schermo sempre acceso concesso subito; foto ridimensionate senza filtro,
  perché Chrome alterna filtro rapido e di qualità). Dieci esecuzioni consecutive identiche.
- Differenze riviste: tutte le schermate del telefono (barra in basso), la pagina eventi su desktop
  (segmenti), gli eventi a 150% (intestazione e segmenti). Riferimenti aggiornati.
- Da fare nella fase 3 (pagina eventi, non componenti condivisi): nomi degli eventi successivi
  troncati e «0 piatti» sul bordo della scheda a 360 px con testo al 150%.

### Fase 3 — Eventi (ramo `restyling`)

- Prossimo evento (`PaginaEventi.tsx`): blocco data in evidenza, titolo a tutta larghezza, «ore · N
  persone», badge del conto alla rovescia (Oggi, Domani, Tra N giorni), illustrazione piccola nella
  stessa riga, azioni invariate (Menù, Persone, Prepara).
- Altri eventi: blocco data al posto della miniatura, nome intero (non più troncato), ora, persone e
  piatti che non si spezzano, «tra N giorni» in testo piccolo; badge di stato e di condivisione invariati.
- «N persone» = adulti + bambini effettivi (con i coperti automatici, i confermati), già presenti nel
  riepilogo: nessuna modifica a contratto o server; i coperti equivalenti restano nei calcoli e
  nelle altre schermate.
- Blocco data con tetti in px (72 px di larghezza, numero a 34 px) perché a 360 px con testo al 150%
  lasci spazio al titolo.
- e2e: `riorganizzazione.spec.ts` riconosceva le schede dalla parola «coperti»; ora da «N piatti».
- Differenze riviste: solo le 6 schermate della pagina eventi; riferimenti aggiornati.

### Fase 4 — Ricetta (ramo `restyling`)

- `PaginaPiatto.tsx`: foto (o «Aggiungi foto» se manca), porzioni e tempi, «Vista cucina» come
  pulsante principale a tutta larghezza, poi la barra della collaborazione; ingredienti, procedimento e
  note separati da filetti invece che chiusi in riquadri; testo degli ingredienti a 15 px. Memoria di
  famiglia, «Usato in» e gestione della ricetta invariati.
- Sui telefoni, con nomi lunghi, «Modifica» va su una riga sua sotto il titolo (intestazione della
  fase 2): il titolo non si comprime.
- Differenze riviste: solo le 12 schermate delle ricette (con e senza foto); riferimenti aggiornati.

### Fase 5 — Vista cucina (ramo `restyling`)

- `VistaCucina.tsx`, solo aspetto: passaggi a 1,25 rem con numeri in cerchi a bordo pieno, righe
  separate da filetti invece che riquadri, cerchi da spuntare con bordo a 3:1 o più (prima 1,3:1),
  verde per il completato come prima, «Schermo sempre acceso» a chip salvia. Invariati: spunte di
  ingredienti e passaggi, porzioni, schermo acceso, foto principale e dei passaggi, avviso sulle dosi,
  note.
- Quantità nella colonna a sinistra; se lo spazio non basta (360 px con testo al 150%) il nome va sotto
  la quantità. Corregge un difetto che c'era già: a quella dimensione la pagina era più larga dello
  schermo (438 px) e scorreva in orizzontale.
- Confronti visivi: nuovo controllo che nessuna pagina sia più larga dello schermo.
- Differenze riviste: solo le 6 schermate della vista cucina; riferimenti aggiornati. Nella suite e2e
  della fase 4 un test del ricettario (filtro per portata) era fallito una volta; isolato passa tre
  volte su tre e nella suite della fase 5 è verde: instabilità occasionale, da tenere d'occhio.

### Fase 6 — Barra laterale desktop (ramo `restyling`)

- Fascia a quadretti (tovaglia) alta 8 px in fondo alla barra laterale del desktop: utilità `tovaglia`
  in `index.css` (due righe incrociate nel colore principale, semitrasparenti), decorativa, non in
  stampa né sul telefono. Fughe delle piastrelle invariate (intensità approvata da Loris).
- Differenze riviste: solo le 18 schermate desktop; riferimenti aggiornati.

Ciclo B (fasi 3–6): sviluppato e testato automaticamente; non su TEST (in attesa dell'OK di Loris).

## Palette ottanio (20/11/2026, ramo `palette-ottanio`)

Stato: **sviluppato e testato automaticamente**; non su TEST (in attesa dell'OK di Loris).

- Distribuzione approvata da Loris: testi in bruno caldo; ottanio principale `#0D7074` per le azioni,
  ottanio profondo `#0B4F54` (`--primario-forte`, nuova) per testo e stati attivi sui fondi chiari e per
  il pulsante premuto, ottanio chiarissimo `#E2F0ED` per badge e selezioni, ottanio morbido `#72B5B5`
  come principale del tema scuro; avorio caldo `#F7F3EA` e sabbia `#E6D6C2` per fondo e bordi; oro
  antico solo decorativo; terracotta (`--accento-caldo`, nuova) per illustrazioni, fascia a quadretti e
  marchio; verde funzionale spostato verso il giallo (`#3F6B1F`) per distinguersi dall'ottanio;
  `--salvia-testo` tolta (il conto alla rovescia passa all'ottanio). Fughe delle piastrelle in ottanio
  molto tenue (richiesta di Loris). Logo, icone PWA e palette di stampa invariati; barra del browser in
  ottanio.
- Differenze dalla proposta: oro antico `#A38548` invece di `#B59657` (stelle e trofeo sono icone
  informative: servono 3:1); marchio rimasto terracotta; badge «Tra N giorni» con testo a 14 px e
  contorno ottanio (la prima versione era troppo pallida).
- Test dei contrasti esteso (tutte le coppie della distribuzione, focus, icone in oro, distinzione delle
  tinte verde/ottanio). Revisione visiva su un campione chiaro e scuro; 54 riferimenti aggiornati.

### Palette ottanio, correzione (20/11/2026, ramo `palette-ottanio`)

- Richiesta di Loris: meno avorio, identità ottanio anche nelle superfici. Tema chiaro: fondo ottanio
  chiarissimo `#E2F0ED`, superfici secondarie ottanio pallido `#D2E7E4`, schede avorio `#FFFDF9`, testo
  secondario `#5F5A51`, ombre velate di ottanio, fughe in ottanio profondo al 4,5%. Tema scuro: fondi
  petrolio (`#142A2B`, schede `#203637`, superfici secondarie `#294344`), testo chiaro caldo `#F4ECE1`,
  selezioni `#16403F`.
- Oro antico come rifinitura (mai per i testi): filetto sotto i titoli delle pagine, filo d'oro nel
  blocco data del prossimo evento, lineetta sulla voce attiva della navigazione, bordo dei pulsanti a
  contorno, contorno del badge «Tra N giorni», sottolineatura dei link.
- Tovaglia a quadretti classica in ottanio (utilità `tovaglia`, bande all'8%) sotto la barra laterale
  del desktop e la barra in basso del telefono; tolta la fascia terracotta. Voce attiva della barra in
  basso in ottanio profondo. Test dei contrasti esteso al quadretto più scuro.
- Revisione su campione (Eventi e dettaglio evento, chiaro e scuro); riferimenti aggiornati.
  `npm run check` 877, e2e 57, confronti visivi verdi.

### Pagina Eventi in oro (20/11/2026, ramo `eventi-oro`)

- Richiesta di Loris: date e giorni mancanti nelle tonalità dell'oro. Blocchi data con il numero in
  terracotta e giorno e mese in oro scuro, su fondo oro: intenso per il prossimo evento (`--oro-medio`),
  chiaro per gli altri (`--oro-tenue`); badge «Tra N giorni» in oro scuro (`--oro-forte`) su oro chiaro
  con contorno oro antico. Tre variabili nuove, contrasti verificati nel test (testi piccoli ≥ 4,5:1,
  numero grande in terracotta ≥ 3:1 sull'oro intenso del chiaro).

### Colori più intensi (20/11/2026, ramo `colori-intensi`)

- Richiesta di Loris: tema più scuro e colorato, mantenendo la leggibilità. Chiaro: fondo `#C3DFD9`,
  superfici secondarie `#B5D6D0`, ottanio `#0A6064` e profondo `#0A464A`, testo secondario `#4D4843`,
  tovaglia al 13%, oro delle date `#EEDCB4` / `#D8B977` con oro scuro `#5A4318`. Scuro: fondo `#09292A`,
  schede `#123D3E`, superfici `#1A4C4D`, ottanio morbido `#86CECC`, selezioni `#0F5759`, oro delle date
  `#45361B` / `#634C22`. Intensità della tovaglia in una variabile (`--tovaglia`) per tema; test dei
  contrasti aggiornato (quadretto più scuro calcolato con l'intensità di ciascun tema).
- `npm run check` 885, e2e 57, confronti visivi verdi; revisione su campione (eventi, ricetta, bacheca,
  vista cucina; chiaro e scuro).

## Restyling e palette ottanio in produzione (20/11/2026)

- Su OK di Loris: Cloudflare `20261120-1932-176caed` (versione `5fdd2d95`), nessuna migrazione (schema
  21). Comprende i cicli A e B del restyling, la palette ottanio, la pagina Eventi in oro e i colori più
  intensi, tutti provati da Loris su TEST. Verificato: salute ok, 401 senza sessione, file dell'app
  uguali alla build, dominio principale ancora «Sito in costruzione».
- Da sistemare al prossimo giro: il colore della barra del browser (`theme-color` e manifest) è ancora
  `#0D7074`, mentre l'ottanio dei pulsanti è diventato `#0A6064` (differenza minima).

## Template Markdown della ricetta (20/11/2026, ramo `template-ricetta-md`)

Stato: **sviluppato e testato automaticamente**; non su TEST (serve l'OK di Loris).

- Ricettario → Importa: «Scarica template .md» accanto a «Scegli un file», con «Compila il modello e
  importalo qui». Scarica `ricetta-template.md` (UTF-8, collegamento con `download` a un indirizzo
  `data:`, funziona anche sul telefono). Contenuto nel formato §3 di docs/FORMATO-RICETTA.md con valori
  d'esempio, importabile così com'è; parser e formato invariati.
- Test: `src/features/ricettario/template.test.tsx` (file del collegamento → parser → contratto
  dell'API), e2e in `importa-ricette.spec.ts` (telefono e desktop: scarica, compila, ricarica, importa).

## Template Markdown in produzione (20/11/2026)

- Su OK di Loris dopo la prova su TEST: Cloudflare `20261120-2213-a2fa862` (versione `035d90dd`), nessuna
  migrazione. Verificato: salute ok, 401 senza sessione, file dell'app uguali alla build, dominio
  principale ancora «Sito in costruzione».

## Date come calendario da tavolo (21/11/2026, ramo `date-calendario`)

Stato: **sviluppato e testato automaticamente**; non su TEST (serve l'OK di Loris).

- `BloccoData.tsx`, stessi colori: angoli vivi, bordo e ombra netta solo a destra e in basso (rilievo),
  fascia del mese in terracotta con testo chiaro (6,1:1; scuro nel tema scuro, 7,2:1), due anelli di
  rilegatura in oro scuro, numero in terracotta, giorno della settimana in oro scuro in fondo.
- `npm run check` 889, e2e 59, confronti visivi verdi (cambiano solo le schermate della pagina Eventi).

## Date a calendario in produzione (21/11/2026)

- Su OK di Loris dopo la prova su TEST: Cloudflare `20261121-1713-2eafbbb` (versione `e5814c15`), nessuna
  migrazione. Verificato: salute ok, 401 senza sessione, file dell'app uguali alla build, dominio
  principale ancora «Sito in costruzione».

## Tipografia Plus Jakarta Sans (23/11/2026, ramo `tipografia-jakarta`)

- Tutta l'interfaccia in Plus Jakarta Sans (`@fontsource-variable/plus-jakarta-sans`), al posto di
  Fraunces (titoli) e Inter (testo). Configurazione in un solo punto: `--font-sans` in
  `src/styles/index.css`; l'utilità `titolo` usa lo stesso carattere (niente più `--font-serif` nell'interfaccia).
- Pesi: titoli di pagina, delle schede, dei dialoghi e nome dell'app 700 (`font-bold`); sottotitoli
  e intestazioni di sezione 600; pulsanti e navigazione 500–600 (invariati); testo 400.
- Stampa invariata: Fraunces e Inter restano inclusi solo per i caratteri «Classica» e «Moderna» del
  menù e dei segnaposto (`stampa/caratteri.ts`).
- PWA: i file del carattere (latin, latin-ext, vietnamese; ~57 KB) sono nel precache, quindi
  disponibili offline. Il confronto visivo ora verifica che i pesi 400–700 siano davvero caricati.
- Test: `npm run check` verde; e2e 59 superati; aspetto: 54 immagini di riferimento rigenerate,
  larghezza pagina e barra in basso verdi. Problema **preesistente** (identico prima del cambio):
  a 360 px con testo al 150% le schede dell'evento si accavallano e la pagina supera la larghezza.

## Tipografia in TEST (23/11/2026)

Rilascio `20261123-1047-ef2fae3` su TEST. In produzione andrà insieme alle rifiniture delle schede
evento, su richiesta di Loris.

## Rifiniture delle schede evento (23/11/2026, ramo `rifiniture-eventi`)

- Pulsanti Menù/Persone/Prepara con la nuova variante `navigazione` (ottanio tenue, uguali fra loro);
  «Nuovo» resta l'unico pulsante pieno della pagina. Verificato il ruolo degli altri pulsanti pieni
  (Nuovo, Nuovo evento, Torna agli eventi): sono azioni, restano invariati.
- `DatiEvento`: orario, persone e piatti con icone allineate nelle due schede (prima la scheda
  principale non aveva icone né piatti); testo da 13 a 14 px.
- Conto alla rovescia delle schede dell'elenco in `oro-forte`; badge di condivisione sotto il titolo
  del prossimo evento, a capo su schermi stretti (controllo e2e a 360 px con testo «enorme» in
  `riorganizzazione.spec.ts`).
- Oro: filetti delle portate pieni (prima 70%), lineetta dei titoli di pagina piena (prima 80%).
- Contrasti aggiunti a `test/contrasti.test.ts`: oro-forte su carta e tenue, primario-forte su carta,
  nei due temi.
- Test: `npm run check` verde (895 unitari); e2e 59 superati; aspetto: 42 immagini aggiornate
  (eventi, menù e pagine con la lineetta del titolo), larghezza e barra verdi.
- Da sapere: a 360 px con testo al 150% le parole lunghe del titolo del prossimo evento si spezzano
  (`break-words`, comportamento già presente, non modificato).
