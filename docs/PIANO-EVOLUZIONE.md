# Piano di evoluzione: ricettario, riuso degli eventi, riepilogo, regia della cucina

Stato: **proposta del 19/11/2026, da approvare**. Nessun codice modificato. Rilasci secondo
docs/RILASCI.md (TEST Debian → prova di Loris → PRODUZIONE Cloudflare); dati mai trasferiti fra
ambienti. Principio: il cuore è il **ricettario**; ogni ricetta nasce in una Famiglia e ne conserva
l'identità.

## 0. Cosa c'è già (analisi di codice, schema 15, API, interfaccia, test, dati di TEST)

Dati di TEST (sola lettura, copia dei dati reali al 18/11): 77 ricette, 4 utenti, **una sola
Famiglia**; 76 ricette condivise con la Famiglia, 1 privata; nessuna condivisione con persone; 1
copia; 64/77 con tempo di preparazione, 60 con cottura; 9 con attrezzature (testo libero: «teglia»,
«roner», «fruste elettriche»…); 1 senza ingredienti, 2 senza procedimento; 6 eventi; **0 attività
nel piano**. La produzione ha gli stessi contenuti più quanto inserito dal 18/11: va riletta con la
prova a secco della migrazione (§1.6) prima di ogni rilascio con schema nuovo.

| Area | Già presente | Da correggere | Nuovo |
|---|---|---|---|
| Visibilità ricette | proprietario; privata / in **una** Famiglia (`condivisioni_piatto_gruppo`, indice unico, §21.3, §28); condivisione con persone per le private (`condivisioni_piatto`); colonna storica `piatti.visibilita` | — | Famiglia d'origine, «Pubblica nell'app» |
| Copie | «Copia nel mio ricettario» (privata, `origine_piatto_id`), «Copia in un'altra Famiglia» (visibile nella destinazione, `provenienza` JSON solo testo, foto duplicate) | la provenienza non conserva l'id della sorgente | copia di una pubblica in una mia Famiglia |
| Riuso eventi | «Duplica evento» (§25, `server/servizi/duplicazione.ts`): portate e voci con ricette secondo i permessi, stile di stampa, note, coperti, piano spostato e tutto da fare, partecipanti a richiesta e in attesa, spesa da zero, ricorrenza; avvisi; anche da archiviati | menù, piano e stampa si copiano sempre (nessuna scelta); nessuna anteprima | scelta di cosa copiare, incarichi, anteprima |
| Riepilogo | menù vuoto/in preparazione/completato (1f0eff1), partecipanti, coperti, chi porta, piano (da fare, in ritardo), proposte, sondaggi, spesa; livelli `attenzione`/`da_fare`/`nota`/`facoltativo`/`ok` | la spesa conta `avvisi` (voce senza ricetta, ricetta senza ingredienti) ma l'interfaccia non li mostra; «in ritardo» guarda solo la data, non l'ora; dopo la data dell'evento resta tutto «da fare» | gruppi Da organizzare / Da acquistare / Da preparare |
| Cucina | piano (`attivita`: data, ora facoltativa, stato, voce collegata, note), scelte rapide, vista cucina della singola ricetta con Wake Lock e spunte locali, aggiornamento fra dispositivi (revisione ogni 10 s) | Wake Lock dentro `VistaCucina.tsx` (da estrarre) | vista «Regia» dell'evento |

Sicurezza verificata nel codice: ogni `/api/*` senza sessione → 401 (salvo attivazione); foto solo da
`GET /api/v1/foto/:id` con `richiediFoto` → stesse regole della ricetta; nessun dato nei file
statici; stesso codice su Fastify (Debian) e motore leggero (Worker/Durable Object), migrazioni
uguali nei due (`cloudflare/migrazioni.ts`), backup pre-migrazione in entrambi.

## 1. Fase 1 — Ricette pubbliche fra Famiglie (priorità alta)

Divisa in due rilasci: **1A** prepara l'identità (nessun cambiamento visibile salvo l'indicazione
della Famiglia), **1B** introduce le pubbliche.

### 1.1 Modello

- `piatti.famiglia_origine_id` (→ `gruppi`, `ON DELETE SET NULL`) e `piatti.famiglia_origine_nome`
  (testo fissato alla nascita: l'identità resta anche se la Famiglia viene rinominata o eliminata, o
  l'autore ne esce). Immutabili dopo la creazione (trigger), salvo l'assegnazione di un'origine
  mancante (§1.6).
- Visibilità in tre livelli, mostrata come una scelta sola:
  - **Privata**: solo il proprietario (più le persone scelte, se si conserva §19.4: decisione D3).
  - **Di famiglia**: la riga in `condivisioni_piatto_gruppo` (come oggi).
  - **Pubblica nell'app**: nuova colonna `piatti.pubblica` (0/1, default 0, mai impostata dalla
    migrazione). Pubblica implica anche «di famiglia»: la Famiglia continua a vederla come sua.
  Origine e condivisione restano distinte; rendere pubblica non tocca proprietario né origine.
- Preferenza «Includi ricette pubbliche»: tabella `preferenze_utente (utente_id PK, includi_pubbliche
  0/1 DEFAULT 0, versione, aggiornato_il)`, sul server (segue l'utente su tutti i dispositivi).
  Tabella a parte e non colonna di `utenti`: `utenti` è tabella d'identità con trattamento speciale
  in importazione e backup.
- Provenienza delle copie: si aggiunge `piattoId` (facoltativo) e `famiglia` al JSON
  `piatti.provenienza` già esistente (nessuna colonna nuova; resta solo descrittiva: non dà accesso).

### 1.2 Regole e permessi (servizio `permessi.ts` / `repo/accesso.ts`)

- Lettura di una ricetta altrui: Famiglia condivisa **oppure** `pubblica = 1` (qualunque utente con
  sessione) oppure le regole esistenti (persone, eventi visibili). Una sola condizione SQL usata da
  elenco, scheda, foto, esportazione e ricerca (oggi `CONDIVISA_CON_LE_MIE_FAMIGLIE`).
- Pubblica = sola lettura per tutti: niente modifica, voti, commenti, uso diretto nei menù altrui
  (vedi D5); la copia sì.
- Rendere pubblica/privata: solo il proprietario, solo con Famiglia d'origine nota. Nessun
  automatismo: nessuna ricetta esistente diventa pubblica.
- Togliere la pubblicazione o eliminare l'originale non tocca le copie (già garantito dalla copia
  indipendente con file propri).
- Anonimi: nessuna rotta nuova senza sessione; test espliciti su elenco, scheda, foto, esportazione
  con 401 su entrambi i motori e su Cloudflare (`test/cloudflare`).

### 1.3 API (contratto zod in `src/contratto/`)

- `GET /piatti?pubbliche=1|solo` (default dalla preferenza): elenco con `visibilita:
  'privata'|'famiglia'|'pubblica'`, `famigliaOrigine: {id|null, nome}`, `mia`, `inMieFamiglie`.
- `PUT /piatti/:id/visibilita` estesa a `'pubblica'` (oggi `'famiglia'|'privata'`).
- `GET/PUT /account/preferenze` (`includiPubbliche`, con versione).
- `POST /piatti/:id/copia-in-famiglia` riusata per le pubbliche (stesso servizio `copiaInFamiglia`):
  `{ id, gruppoId }`; la copia nasce **privata** (D4), origine = Famiglia di destinazione,
  provenienza con titolo, Famiglia d'origine, data, id sorgente.
- `PUT /piatti/:id/famiglia-origine` solo per ricette senza origine (§1.6), solo il proprietario,
  solo una Famiglia di cui fa parte.

### 1.4 Interfaccia

- Ricettario: interruttore «Includi ricette pubbliche» (persistente, spento all'inizio); segmento o
  filtro «Solo pubbliche»; ogni scheda con un'etichetta di visibilità (lucchetto / casa / globo) e
  «Famiglia Rossi». Le ricette della propria Famiglia che sono anche pubbliche compaiono **una volta
  sola** come «di famiglia» con il globo (l'elenco è una sola query con `DISTINCT` per id).
- Scheda di una pubblica altrui: sola lettura, «Copia in una mia Famiglia…» (scelta della Famiglia
  se più d'una). Se l'utente ne ha già una copia (provenienza con lo stesso id): «Hai già una copia»
  con collegamento.
- Scheda propria: la scelta «Privata / Di famiglia / Pubblica nell'app» con una frase che spiega chi
  la vede; la pubblicazione chiede conferma una volta.
- Ricerca: le pubbliche entrano nei risultati quando la preferenza è attiva.

### 1.5 Isolamento

- Una pubblica rivela solo: titolo, contenuto della ricetta, foto, Famiglia d'origine e nome
  dell'autore (D2). Mai membri, eventi, voti o commenti della Famiglia d'origine.
- Una Famiglia non vede le private né le «di famiglia» delle altre: test d'isolamento con tre
  Famiglie (A pubblica, B legge, C esclusa dalle private di A).

### 1.6 Migrazione `0016` (Fase 1A) e prova a secco

Regole, in ordine, senza scelte arbitrarie:
1. ricetta condivisa con una Famiglia → quella (al massimo una, indice unico);
2. altrimenti, proprietario in **una sola** Famiglia → quella;
3. altrimenti (privata di chi ha zero o più Famiglie) → **origine non determinata** (`NULL`):
   la ricetta resta com'è, nessun permesso cambia, e la scheda chiede al proprietario «In quale
   Famiglia è nata?» (scelta fra le sue). Finché manca non si può rendere pubblica.

Sui dati di TEST: 77/77 determinabili (regole 1 e 2). Prima del rilascio in produzione: comando di
prova a secco nella console/script (`conteggi per regola`, elenco delle non determinate) e backup
pre-migrazione automatico; dopo: `integrity_check`/`foreign_key_check` (Debian) e i controlli del
backup R2 (Cloudflare). La migrazione non tocca `condivisioni_piatto_gruppo` né
`condivisioni_piatto`: condivisioni e permessi restano identici (test: insiemi di ricette visibili
per ogni utente uguali prima e dopo).

### 1.7 Rischi, test, accettazione, impegno

- Rischi: una condizione di lettura dimenticata (foto, esportazione, ricerca) → mitigato da un'unica
  funzione SQL e da test per ogni rotta; prestazioni dell'elenco con molte pubbliche (oggi poche
  centinaia: nessun problema; paginazione solo se servirà).
- Test: dominio (etichette/filtro), server su entrambi i motori (permessi per ruolo × visibilità,
  anonimi 401, foto, copia indipendente con file nuovi, originale eliminato/privatizzato, migrazione
  su database di prova con i tre casi), Worker locale, e2e (pubblica → altra Famiglia la vede con la
  preferenza, copia, modifica della copia, l'originale torna privato e la copia resta).
- Accettazione (Loris su TEST con due Famiglie di prova): nessuna ricetta pubblica dopo il rilascio;
  una ricetta resa pubblica è visibile a un utente di un'altra Famiglia solo con «Includi ricette
  pubbliche»; da non collegato (finestra anonima) nessuna ricetta né foto; la copia nasce privata
  nella Famiglia scelta, è modificabile, mostra la provenienza, sopravvive alla cancellazione
  dell'originale.
- Impegno: 1A ~1 giornata; 1B ~2–3 giornate.

## 2. Fase 2 — Riutilizzare un evento (priorità alta, impegno medio)

Si estende «Duplica evento» (nessuna logica parallela): stesso servizio `duplica`, stessa rotta.

- Scelte (caselle, con i valori di oggi come predefiniti): **Menù** (portate e piatti), **Partecipanti
  e coperti**, **Chi porta cosa**, **Piano delle attività**, **Impostazioni di stampa**. Senza menù
  si copiano solo le portate (struttura).
- Piano: nuova data → attività spostate degli stessi giorni (già così), anteprima delle nuove date
  modificabile prima di confermare; tutte da fare (già così).
- Spesa: mai copiata (già così): nessun «Comprato» o «Ce l'ho».
- Incarichi: piatti affidati e cose da portare si copiano **da assegnare**, con l'indicazione
  «l'anno scorso: Anna» e un tocco per riaffidare (D7). Nuova colonna `responsabile_precedente`
  (testo) su `voci_menu` e `cose_da_portare` (migrazione `0018`); niente accettazione automatica.
- Ricette: regole di sempre (`piattoPerEvento`): del nuovo proprietario restano collegate, altrimenti
  copia privata; non disponibili → voce senza ricetta e avviso. Una pubblica non è mai collegata a un
  evento altrui senza copia.
- Revisione prima della conferma: `POST /eventi/:id/duplica` con `anteprima: true` restituisce, senza
  scrivere nulla, cosa verrà creato (portate e piatti, ricette che diventano copie o restano senza,
  attività con le nuove date, partecipanti, incarichi da riaffidare, avvisi); l'utente corregge nome,
  data, Famiglia, scelte, poi conferma. Dopo la creazione l'evento si modifica come ogni altro (D8).
- Test: estensione di `server/api/duplicazione.test.ts` (ogni combinazione di scelte, anteprima
  senza scritture: revisione invariata, incarichi da assegnare con precedente, attività spostate e da
  fare, spesa vuota, permessi delle ricette fra Famiglie), e2e «Natale 2027 da Natale 2026».
- Accettazione: da un evento con menù, partecipanti, incarichi e piano, «Duplica» con scelte diverse
  produce esattamente ciò che l'anteprima mostrava; l'originale non cambia; nel nuovo nulla risulta
  comprato, fatto o accettato.
- Rischi: pochi (codice esistente e testato); attenzione agli eventi archiviati (snapshot senza
  incarichi: l'opzione si disattiva con una spiegazione).
- Impegno: ~2 giornate.

## 3. Fase 3 — «A che punto siamo?» più intelligente (priorità alta, impegno medio)

Si parte dalla logica attuale (`Riepilogo.tsx`, `servizi/riepilogo.ts`, incluso il menù di 1f0eff1)
e la si **raggruppa**, senza sostituirla.

- Tre gruppi, ciascuno con il suo collegamento:
  - **Da organizzare**: menù vuoto / in preparazione; coperti; conferme in attesa; cose da portare
    senza nessuno; incarichi di chi non partecipa; proposte da decidere; sondaggi aperti.
  - **Da acquistare**: articoli da comprare, da verificare; piatti **in spesa** senza ricetta o con
    ricetta senza ingredienti (gli `avvisi` già calcolati, oggi invisibili) come *suggerimento* con
    collegamento alla voce: chi esclude il piatto dalla spesa («non in spesa», scelta già esistente)
    o lo affida ad altri non riceve più l'avviso.
  - **Da preparare**: attività da fare, in ritardo (data **e ora** passate), quelle del giorno
    dell'evento prima dell'ora di servizio.
- Tre livelli espliciti (D9): **da risolvere** (blocca davvero: menù vuoto, coperti a zero, cosa da
  portare senza nessuno, responsabile assente, attività in ritardo); **aperto** (in corso, normale);
  **suggerimento** (mai conteggiato in «Mancano ancora N cose»: piatti non affidati, piatti senza
  ingredienti, parti non usate). «Tutto pronto» solo senza «da risolvere» e «aperto».
- Coerenza nel tempo: dopo la data dell'evento (o da concluso) il riepilogo dice «Evento passato»
  e propone solo «Concludi»/«Archivia», senza cose da fare.
- Nessun obbligo di ingredienti, procedimento, numero di portate o di piatti; nulla di affidato ad
  altri conta come mancante per l'organizzatore oltre a «da completare».
- Contratto: `GET /eventi/:id/riepilogo` aggiunge `spesa.avvisi` dettagliati (voce, tipo) e
  `attivita.prossime`; compatibile (campi in più). Nessuna migrazione.
- Test: unitari degli indicatori per ogni gruppo e livello (inclusi i casi «scelta intenzionale»),
  server su entrambi i motori, e2e del riepilogo esteso.
- Accettazione: per un evento di prova ogni voce porta alla schermata giusta; escludere un piatto
  dalla spesa o affidarlo fa sparire il relativo avviso; un'attività con ora passata compare in
  ritardo; un evento passato non mostra cose da fare.
- Impegno: ~1,5 giornate. Indipendente dalle fasi 1 e 2.

## 4. Fase 4 — Regia della cucina (priorità medio-alta, impegno medio-alto)

Una vista dell'evento, `/eventi/:id/regia`, costruita **sul piano delle attività** (nessun secondo
sistema).

- Dati affidabili oggi: attività (data, ora facoltativa, stato, voce → ricetta), tempi delle ricette
  (preparazione/cottura/riposo, presenti in ~80 % dei casi), ora di servizio. Poco affidabili:
  attrezzature (testo libero, 9 ricette su 77). Nessuna durata sulle attività, nessuna risorsa.
  Quindi **niente pianificazione automatica**: solo ordinamento, raggruppamento e informazioni.
- Colonne (tablet/schermo grande) o sezioni (telefono): **In ritardo** · **Adesso** (attività di oggi
  con ora entro la prossima ora, o senza ora) · **Più tardi** (in ordine di ora; «si può anticipare»
  solo come azione manuale: spuntarla prima) · **Fatto**.
- Ogni attività: titolo, ora, piatto collegato con tempi della ricetta («≈ 40 min + 1 h forno») e
  attrezzature della ricetta, tocco per la vista cucina della ricetta (porzioni dell'evento), grande
  spunta «Fatto» (stessa API e versioni del piano: aggiornamento fra dispositivi con la revisione).
- Filtri: stato, fascia oraria, attrezzatura (D10).
- Lettura a distanza: modalità «grande» (testo e spunte ingranditi, contrasto alto), Wake Lock
  estratto in un hook comune con la vista cucina.
- Piano vuoto (oggi è il caso reale): la Regia propone «Prepara il piano dai piatti del menù»
  (un'attività per piatto con ricetta, il giorno dell'evento, da rivedere prima di salvare) — D11.
- Test: dominio (raggruppamento per ora e stato, fuso orario), UI, e2e su telefono e tablet (due
  dispositivi: spunta su uno, aggiornamento sull'altro).
- Accettazione: su tablet la Regia mostra cosa fare adesso, cosa dopo, cosa è in ritardo e fatto;
  la spunta compare sull'altro dispositivo entro ~10 s; lo schermo resta acceso; dal telefono è
  usabile.
- Impegno: ~3 giornate (più ~0,5 per D11). Dipende solo dal piano esistente.

## 5. Architettura, sicurezza e compatibilità (tutte le fasi)

- Livelli invariati (`api` → `servizi` → `repo`), contratto zod unico, versioni e revisione.
- Migrazioni nuove numerate (0016 Famiglia d'origine, 0017 pubblica e preferenze, 0018 responsabile
  precedente), mai modifiche a file applicati; incluse automaticamente in `cloudflare/migrazioni.ts`;
  backup pre-migrazione (Debian su disco, Cloudflare in R2); `TABELLE_CONTENUTO` e
  esportazione/ripristino aggiornati per `preferenze_utente`.
- Ogni test del server gira su Fastify e sul motore leggero; `test/cloudflare` sul Worker locale.
- Rilasci: TEST con `scripts/rilascia.sh <ramo>`, prova di Loris, PRODUZIONE con
  `scripts/cloudflare/rilascia.sh` (accetta solo il commit di TEST). Dominio principale invariato
  («Sito in costruzione», nessun riferimento). Nessun trasferimento di dati fra gli ambienti.

## 6. Ordine e calendario indicativo

| # | Fase | Schema | Dipende da | Impegno |
|---|---|---|---|---|
| 1 | 1A Famiglia d'origine | 16 | — | ~1 g |
| 2 | 1B Ricette pubbliche e copia | 17 | 1A | ~2–3 g |
| 3 | 3 Riepilogo a gruppi | — | — | ~1,5 g |
| 4 | 2 Riuso degli eventi | 18 | — | ~2 g |
| 5 | 4 Regia della cucina | — | — | ~3–3,5 g |

Ogni riga è un ramo e un rilascio a sé. La fase 3 può anticipare la 1B se si vuole un rilascio
breve fra le due parti del ricettario.

## 7. Decisioni aperte (con la soluzione consigliata)

- **D1 — Più Famiglie per una ricetta «di famiglia»?** Oggi una sola (decisione §28). Consiglio:
  **restare a una**; per un'altra Famiglia si copia o si pubblica.
- **D2 — Cosa mostra una pubblica di chi l'ha scritta?** Consiglio: Famiglia d'origine e nome
  dell'autore (come oggi «di Anna»); nulla dei membri.
- **D3 — «Privata» con le persone scelte (§19.4)?** Oggi nessun uso. Consiglio: **mantenerla** senza
  metterla in evidenza (compatibilità); non mostrarla fra i tre livelli.
- **D4 — Le copie fra Famiglie nascono private anche quando non vengono da una pubblica?** Oggi la
  «Copia in un'altra Famiglia» nasce visibile nella destinazione. Consiglio: **sempre private** (una
  regola sola), con «Condividi con la Famiglia» subito dopo la copia.
- **D5 — Le pubbliche nei suggerimenti del menù?** Collegarle creerebbe copie senza chiederlo.
  Consiglio: **no**; dal menù si cerca nelle proprie, la pubblica si copia dal ricettario.
- **D6 — Origine non determinata** (nessun caso oggi): consiglio la richiesta al proprietario nella
  scheda; nessuna assegnazione automatica.
- **D7 — Incarichi copiati**: consiglio «da assegnare» con «l'anno scorso: …» e riaffidamento a un
  tocco, invece di un nuovo stato «proposto/da accettare».
- **D8 — Revisione prima della conferma**: consiglio l'**anteprima** nella finestra di duplicazione
  (nessuno stato «bozza» degli eventi).
- **D9 — Tre livelli nel riepilogo** (da risolvere / aperto / suggerimento): consiglio sì.
- **D10 — Attrezzature per la Regia**: consiglio di usare il testo della ricetta con un filtro per
  parole comuni (forno, fornelli/padella/pentola, frigo) indicato come «dalla ricetta»; un campo
  strutturato solo se dopo l'uso risulta utile.
- **D11 — «Prepara il piano dai piatti»**: consiglio sì, come proposta da rivedere, mai automatica.
- **D12 — Ordine delle fasi**: consiglio quello del §6.
