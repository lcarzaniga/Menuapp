# Ricette di famiglia & Co. (già Menù & Co.) — Specifica tecnica consolidata

| | |
|---|---|
| Versione documento | 2.0 — 12 novembre 2026 (database centralizzato sul server) |
| Stato | Da approvare prima di M0 |
| Repository | `github.com/lcarzaniga/Menuapp` (solo codice) |
| Produzione | https://loris-srv01.dala-tortoise.ts.net:9870/ — server Debian `loris-srv01`, solo tailnet (§14) |
| Obiettivo | v1.0 completa entro il **15 dicembre 2026** (pranzo di Natale) |

Questo documento è la fonte di verità per tutte le milestone. Le modifiche sostanziali si
fanno qui, prima del codice, con una riga nel registro in fondo.

---

## 1. Visione del prodotto

Menù & Co. è una web app installabile (PWA) per organizzare pranzi, cene e ricorrenze
familiari, con **un unico archivio centrale** sul server di casa. Da PC, smartphone e
tablet si vedono e si modificano sempre gli stessi eventi, menù, ricette, ingredienti,
liste della spesa e attività.

Una persona, che è insieme cuoco e organizzatore, la usa per:

1. creare l'evento (chi, quando, quanti);
2. comporre in pochi secondi un menù diviso in portate, anche solo con nomi di piatti;
3. far crescere nel tempo un ricettario personale, senza obbligo di inserire ricette;
4. ottenere una lista della spesa aggregata e scalata sui coperti, che non perde gli
   acquisti già segnati quando il menù cambia, e usarla dal telefono al supermercato
   mentre il menù si modifica dal PC;
5. pianificare le preparazioni nei giorni precedenti;
6. cucinare con la ricetta sotto gli occhi, alle porzioni giuste, dal tablet in cucina;
7. stampare un menù elegante per la tavola;
8. non perdere mai i dati: database unico sul server, backup automatici giornalieri,
   esportazione e ripristino.

Principi:

- **Un'unica fonte di verità**: il database SQLite sul server. I dispositivi non
  conservano copie modificabili dei dati.
- **Prima veloce, poi completo.** Un menù deve poter esistere in 30 secondi; ricette e
  ingredienti si aggiungono quando servono.
- **Niente magie silenziose.** Nessuna interpretazione incerta è presentata come certa;
  nessun dato viene cancellato o sovrascritto senza che l'utente lo sappia, anche quando
  due dispositivi modificano la stessa cosa.
- **Rete privata.** L'app è raggiungibile solo dai dispositivi autorizzati del tailnet;
  senza connessione al server l'app lo dice chiaramente e non permette modifiche.
- **Telefono prima di tutto** (Android, Chrome), ma pienamente usabile da PC e tablet.
- **Italiano** in interfaccia, dati, messaggi, codice di dominio e documentazione.

## 2. Perimetro MVP (v1.0)

Incluso:

| Area | Funzioni |
|---|---|
| Eventi | Crea, modifica, elimina; tipo, occasione, data, ora, adulti, bambini, coefficiente, note; stati `attivo` / `concluso` / `archiviato`; snapshot all'archiviazione; riapertura |
| Menù | Portate per evento (dalle predefinite, modificabili); voci libere; inserimento rapido anche multiriga; collegamento facoltativo a un piatto; porzioni; incaricato; inclusione nella spesa; note; riordino e spostamento fra portate |
| Ricettario | Piatti con porzioni base, tempi, attrezzature, procedimento, ingredienti; creazione esplicita da una voce di menù; ricerca |
| Ingredienti | Catalogo con nome canonico, sinonimi, reparto, unità preferita; catalogo iniziale italiano; parser delle righe ingrediente con conferma |
| Spesa | Lista calcolata dal server e aggregata per reparto; articoli manuali; stati *Da comprare / Ce l'ho / Comprato*; quantità corrette a mano; riconciliazione dopo modifiche del menù; condivisione testo |
| Piano | Attività per evento con data, ora facoltativa, stato, collegamento facoltativo a una voce di menù; checklist per giorno |
| Cucina | Vista ricetta a caratteri grandi, porzioni scalate, spunta ingredienti e passaggi, schermo sempre acceso |
| Stampa | Menù stampabile elegante (A4 e A5) |
| Dati condivisi | Database SQLite unico sul server; aggiornamento automatico delle viste quando un altro dispositivo modifica i dati; controllo di versione con avviso di conflitto |
| Backup | Backup automatici giornalieri del database con verifica di integrità; backup prima di migrazioni e ripristini; backup su richiesta; esportazione JSON e copia del database; ripristino validato |
| PWA | Installabile da Chrome via HTTPS Tailscale; avvio rapido; avviso di nuova versione; senza server raggiungibile: dati non modificabili e messaggio chiaro |

## 3. Funzionalità rinviate (dopo il 15 dicembre)

Modifiche offline (con coda di sincronizzazione) · consultazione offline dei dati già
visti · foto degli eventi ·
budget e prezzi · importazione ricette da URL · valori nutrizionali e allergeni · timer
di cucina · stampa di ricette e lista della spesa con layout dedicato · cronologia delle
versioni dei piatti · conversioni peso↔volume per densità · statistiche · aggiornamenti
in tempo reale via WebSocket/SSE (nell'MVP: interrogazione periodica, §12.6) · copia dei
backup su un secondo supporto (decisione aperta, §11.6).

Esclusi in modo permanente salvo nuova decisione: servizi cloud, AI, Redux o altri store
globali, sincronizzazione bidirezionale fra database locali e server, pubblicazione su
GitHub Pages.

## 4. Flussi utente

### F1 — Primo avvio su un dispositivo
1. Da Chrome, con Tailscale attivo, si apre `https://loris-srv01.dala-tortoise.ts.net:9870/`.
2. L'app mostra *Eventi* con i dati del server (vuoto alla prima installazione) e un
   invito: «Crea il tuo primo evento».
3. Menu di Chrome → *Installa app*. Da quel momento si apre come app; i dati restano
   quelli del server.

### F2 — Creare un evento e un menù veloce
1. *Eventi → Nuovo*: nome (suggerito da occasione + anno, es. «Natale 2026»), tipo,
   occasione, data, ora, adulti, bambini. Coefficiente e portate arrivano dalle
   impostazioni e si possono cambiare.
2. Si apre il menù dell'evento: una sezione per portata, ciascuna con un campo
   «Aggiungi piatto…».
3. Scrivere un nome e premere Invio crea una voce di menù **senza** piatto collegato. Se
   il nome coincide con un piatto del ricettario, compare un suggerimento: sceglierlo
   collega la voce al piatto; ignorarlo lascia la voce libera.
4. Incollare più righe nel campo crea una voce per riga.
5. Le voci si riordinano con trascinamento (pressione prolungata) o con i comandi
   *Su / Giù / Sposta in…*.

### F3 — Dal nome al piatto
1. Su una voce senza piatto: azione «Crea nel ricettario».
2. Nasce un piatto con lo stesso nome, porzioni base vuote; la voce viene collegata e si
   apre l'editor del piatto.
3. In alternativa: «Collega a piatto esistente» con ricerca.

### F4 — Inserire gli ingredienti di un piatto
1. Nell'editor: area di testo «Incolla gli ingredienti, uno per riga».
2. Anteprima (calcolata nel browser con il parser del dominio): ogni riga mostra
   quantità, unità, nome, ingrediente di catalogo e un badge **Certo** o **Da
   verificare**, con il testo originale sempre visibile.
3. Le righe *Da verificare* vanno corrette o confermate una a una; si può salvare anche
   senza confermarle, ma restano marcate e segnalate nella spesa.
4. Ingredienti non presenti nel catalogo: «Aggiungi al catalogo» (nome, reparto
   proposto, unità) oppure lasciarli come testo libero.
5. «Salva» invia piatto e ingredienti insieme; il server li registra in un'unica
   transazione.

### F5 — Spesa
1. *Evento → Spesa*: lista per reparto, calcolata dal server dalle voci incluse nella
   spesa con un piatto che ha ingredienti.
2. Tocco su una riga: *Da comprare → Comprato*. Menu della riga: *Ce l'ho*, correggi
   quantità, nota, cambia reparto, nascondi, provenienza (da quali piatti arriva).
3. «Aggiungi articolo» per voci manuali (tovaglioli, ghiaccio…).
4. Se il menù cambia (anche da un altro dispositivo), la lista si aggiorna; gli
   acquisti già segnati restano e le differenze vengono segnalate (vedi §10).
5. «Condividi»: testo con le righe da comprare, raggruppate per reparto.

### F6 — Piano e preparazione
1. *Evento → Piano*: attività per giorno, con scelte rapide («il giorno prima», «la
   mattina stessa»).
2. Da una voce di menù: «Aggiungi preparazione» crea un'attività collegata.
3. Checklist: spunta *fatto*; le attività in ritardo sono evidenziate.

### F7 — Cucinare
1. Da voce di menù o dal ricettario: «Cucina». Si apre la vista cucina alle porzioni
   della voce (o alle porzioni base dal ricettario), modificabili.
2. Ingredienti e passaggi si spuntano (spunte solo sul dispositivo, non salvate sul
   server); lo schermo resta acceso (Wake Lock) se supportato.

### F8 — Stampa (designer del menù)
1. *Evento → Stampa menù* apre il designer: miniature dei modelli, opzioni in sezioni
   semplici, anteprima sempre visibile (desktop: affiancata e alta quanto la finestra;
   telefono: sotto i modelli, larga quanto lo schermo, più «Ingrandisci» a tutto schermo).
2. Cinque modelli con layout propri: **Elegante** (simmetrico, cornice doppia, maiuscoletti
   fra filetti), **Minimal** (allineato a sinistra, griglia portata/piatti, filetti),
   **Rustico** (carta calda, cornice tratteggiata, rametti d'ulivo, portate in etichette),
   **Festivo** (festone, portate in riquadri, coriandoli), **Natale** (agrifoglio, titolo
   calligrafico, cornice sottile con stelle). Ornamenti SVG originali, nessun servizio esterno.
3. Opzioni: modello; titolo (vuoto = nome dell'evento); sottotitolo; data sì/no; nota
   finale; 7 palette coordinate; 4 combinazioni tipografiche (Classica, Garamond, Moderna,
   Calligrafica); decorazioni sì/no; nascondi portate vuote; note dei piatti (le note delle
   voci del menù). Predefiniti: modello dall'occasione (Natale/Vigilia/Santo Stefano/Epifania
   → Natale; compleanni, anniversari, battesimi… → Festivo; altrimenti Elegante), con la
   sua palette e i suoi caratteri; A4; data visibile; portate vuote nascoste. Cambiando
   modello, palette e caratteri passano a quelli del modello. «Ripristina stile
   predefinito» torna ai predefiniti.
4. Formati: A4 verticale, A5 verticale, 2 × A5 su A4 orizzontale (due copie, segni di
   taglio in alto e in basso). Fogli in mm/pt con margini di sicurezza interni (cornici ad
   almeno 6,5 mm dal bordo), `@page { margin: 0 }`.
5. Impaginazione misurata sui caratteri reali: si prova a stringere prima gli spazi, poi il
   carattere fino all'86% (mai sotto ~12 pt in A4, ~10 pt in A5); oltre, più pagine, con
   le portate intere o divise fra le voci senza voci isolate. L'anteprima mostra gli
   stessi fogli della stampa.
6. «Stampa / Salva PDF» apre la finestra del browser: escono solo i fogli. Testi, cornici
   e ornamenti stampano sempre; i fondi colorati richiedono «Grafica di sfondo».
7. Lo stile si salva da solo sul server, per evento (tabella `stili_stampa`, versione
   ottimistica, 409 → si adotta lo stile dell'altro dispositivo). Non modifica menù né
   ricette. Evento archiviato: sola lettura, stile fotografato nello snapshot
   (`contenuto.stampa`); la stampa resta disponibile.

### F9 — Concludere e archiviare
1. Dopo la data, l'app propone «Segna come concluso».
2. «Archivia» crea lo snapshot completo dell'evento (menù, ricette, spesa, piano) e lo
   rende in sola lettura: da qui in poi l'evento si consulta solo dallo snapshot.
3. «Copia nel ricettario» recupera una ricetta archiviata come nuovo piatto.
4. «Riapri» su un evento archiviato segue la procedura di §7.4.

### F10 — Backup e ripristino
1. Ogni notte il server crea un backup verificato del database; in *Impostazioni →
   Dati* si vedono data e esito dell'ultimo backup e l'elenco dei backup disponibili.
2. *Backup ora*: crea subito un backup sul server (es. prima di modifiche importanti).
3. *Esporta*: scarica un file JSON portabile (`menuapp-esportazione-AAAA-MM-GG-HHmm.json`)
   o la copia del database (`.db`), da conservare fuori dal server.
4. *Ripristina*: da un backup del server oppure da un file JSON caricato → verifica →
   riepilogo (data, versione, conteggi) → conferma esplicita → il server crea un backup
   dei dati attuali → sostituzione in un'unica transazione → tutti i dispositivi si
   ricaricano con i nuovi dati.

### F11 — Due dispositivi sulla stessa cosa
1. Dal PC si modifica il menù mentre dal telefono si spunta la spesa: nessun conflitto,
   sono record diversi; entro pochi secondi ciascun dispositivo vede le modifiche
   dell'altro.
2. Se due dispositivi modificano **lo stesso** elemento (es. le note dell'evento), il
   secondo salvataggio viene respinto: l'app mostra «Modificato da un altro dispositivo»
   con il valore attuale e le scelte *Ricarica* (perde la propria modifica, mostrata per
   copiarla) o *Sovrascrivi* (salva la propria sopra quella dell'altro).

### F12 — Server non raggiungibile
1. Tailscale spento, rete assente o server fermo: banner fisso «Server non
   raggiungibile — le modifiche sono disabilitate».
2. I dati già mostrati restano visibili finché l'app è aperta; tutti i comandi che
   scrivono sono disattivati; un modulo in compilazione conserva il testo e si può
   salvare quando la connessione torna.
3. Se l'app viene aperta senza server raggiungibile, mostra la stessa spiegazione con
   «Riprova» al posto dei dati.

## 5. Schermate

Navigazione con **hash routing** (`https://loris-srv01.dala-tortoise.ts.net:9870/#/…`).
Su telefono: barra inferiore con *Eventi · Ricettario · Ingredienti · Impostazioni*.
Da 768 px: barra laterale con le stesse voci. Il contenuto dell'evento usa schede.

| Rotta | Schermata | Contenuto principale |
|---|---|---|
| `#/` | Eventi | Prossimi eventi (attivi), conclusi, link all'archivio; pulsante Nuovo |
| `#/eventi/archivio` | Archivio | Eventi archiviati |
| `#/eventi/nuovo` | Nuovo evento | Modulo evento |
| `#/eventi/:id` | Evento — Panoramica | Dati, coperti equivalenti, stato, avvisi, azioni (concludi, archivia, riapri, elimina, stampa), «Versioni archiviate». Se archiviato, tutte le schede dell'evento leggono dallo snapshot |
| `#/eventi/:id/menu` | Evento — Menù | Portate e voci, inserimento rapido, riordino |
| `#/eventi/:id/spesa` | Evento — Spesa | Lista per reparto, filtri, manuali, sezioni *Da verificare* e *Non più necessari* |
| `#/eventi/:id/piano` | Evento — Piano | Attività per giorno, checklist |
| `#/eventi/:id/stampa` | Stampa menù | Designer: modelli, opzioni, anteprima, stampa/PDF (F8) |
| `#/eventi/:id/voci/:voceId/cucina` | Vista cucina | Ricetta alle porzioni della voce |
| `#/famiglia` | Famiglia | Famiglia attiva: bacheca, «I più apprezzati», membri e inviti (§20, §21); senza Famiglie: crea o entra con un invito |
| `#/unisciti/:token` | Invito a una Famiglia | Anteprima e «Entra nella Famiglia» (§21.1) |
| `#/notifiche` | Notifiche | Elenco, tutte lette, preferenze (§20.6) |
| `#/eventi/:id/bacheca`, `#/eventi/:id/chi-porta` | Evento — Bacheca, Chi porta | Messaggi, sondaggi, proposte; incarichi (§20.2–20.5) |
| `#/ricettario` | Ricettario | Ricerca; filtri per portata in testa (`?portata=…`, ricordato tornando dal piatto) e «senza ingredienti»; elenco alfabetico diviso per iniziale con rubrica laterale A–Z da toccare o trascinare (da 10 piatti) |
| `#/ricettario/nuovo`, `#/ricettario/:id` | Piatto | Scheda; modifica |
| `#/ricettario/:id/cucina` | Vista cucina | Ricetta con porzioni scelte |
| `#/ingredienti` | Catalogo | Ricerca, reparto, sinonimi, unità preferita |
| `#/impostazioni` | Impostazioni | Portate predefinite, coefficiente bambini, reparti, tema (del dispositivo) |
| `#/attiva/:token`, `#/accesso` | Attivazione | Dispositivo non autorizzato: richiesta d'accesso dal link d'invito, codice, attesa dell'approvazione (§19.2) |
| `#/account` | Il mio account | Dispositivi autorizzati e revoca, nuovo dispositivo, richieste da approvare, «Esporta i miei dati», esci |
| `#/impostazioni/utenti` | Utenti e dispositivi | Solo amministratore dall'ingresso privato: utenti, inviti, richieste, dispositivi di tutti |
| `#/impostazioni/dati` | Dati | Stato del server, ultimo backup, elenco backup, backup ora, esportazione JSON e `.db`, ripristino, versione app e schema |
| `*` | Non trovata | Link a Eventi |

Requisiti trasversali dell'interfaccia: tema chiaro/scuro/sistema (preferenza del
singolo dispositivo, in `localStorage`); bersagli di tocco ≥ 44 px; rispetto delle
*safe area*; nessuno scroll orizzontale a 360 px; moduli che non perdono il testo
inserito se si cambia scheda o cade la connessione; conferma per ogni eliminazione;
annulla (toast «Annulla» per 5 s) per l'eliminazione di voci di menù, attività e
articoli manuali; indicatore di stato della connessione sempre visibile in caso di
problemi.

## 6. Modello dati e database

### 6.1 Convenzioni

- **Database**: SQLite 3.53 tramite `node:sqlite` (incluso in Node 24, nessun modulo
  nativo), file `/srv/apps/menuapp/dati/menuapp.db`. Unico processo scrittore: il
  backend.
- **Nomi**: tabelle e colonne in italiano `snake_case` nel database; tipi TypeScript in
  `camelCase`. La conversione avviene solo nei repository (§12.3).
- **ID**: UUID v4 testuali generati **dal client** alla creazione (`crypto.randomUUID()`),
  così una creazione ripetuta dopo un errore di rete non produce duplicati (§12.5).
  Eccezioni con id stabili: reparti (`rep-…`) e ingredienti del catalogo iniziale
  (`ing-…`), impostazioni (`id = 1`).
- **Versione**: ogni record modificabile ha `versione INTEGER NOT NULL DEFAULT 1`,
  incrementata dal server a ogni modifica (controllo di concorrenza, §12.5).
- **Timestamp**: `creato_il`, `aggiornato_il` in millisecondi epoch (`INTEGER`), impostati
  dal server.
- **Date di calendario**: testo `YYYY-MM-DD`; **ore**: testo `HH:mm`. Nessun fuso orario.
- **Quantità**: `REAL` non arrotondato; l'arrotondamento esiste solo in visualizzazione
  (§9.4).
- **Booleani**: `INTEGER` 0/1 con `CHECK`.
- **Elenchi** (attrezzature, passaggi, motivi del parser): testo JSON con
  `CHECK (json_valid(...))`.
- **Testi**: salvati come inseriti (NFC); per ricerche e unicità si usa una colonna
  `*_norm` (minuscolo, senza accenti, spazi compattati, apostrofi uniformati) calcolata
  dal server con la funzione di dominio `norm()`.
- **Enumerazioni**: testo italiano `snake_case` con `CHECK (... IN (...))`.
- Tutte le tabelle sono `STRICT` (tipi verificati da SQLite).

### 6.2 Tipi di dominio (TypeScript, condivisi da client e server)

I tipi stanno in `src/domain/tipi.ts`; gli schemi zod che li validano sulle API in
`src/contratto/` (§12.4).

```ts
type Id = string; type DataISO = string; type Ora = string; type Epoch = number
interface Base { id: Id; versione: number; creatoIl: Epoch; aggiornatoIl: Epoch }

type TipoEvento = 'pranzo' | 'cena' | 'aperitivo' | 'brunch'
type StatoEvento = 'attivo' | 'concluso' | 'archiviato'

interface Portata { id: Id; eventId: Id; nome: string; ordine: number }

interface Event extends Base {
  nome: string; data: DataISO; oraServizio: Ora | null
  tipo: TipoEvento
  occasione: string            // libero; suggerimenti: Natale, Vigilia, Capodanno, Pasqua…
  adulti: number; bambini: number          // interi ≥ 0
  coefficienteBambini: number              // 0–1, passo 0,05
  note: string
  stato: StatoEvento
  conclusoAt: Epoch | null; archiviatoAt: Epoch | null
  portate: Portata[]                       // restituite insieme all'evento
}

interface MenuItem extends Base {
  eventId: Id; portataId: Id; ordine: number
  nome: string; dishId: Id | null
  porzioni: number | null      // null = coperti equivalenti dell'evento
  incaricato: string; inSpesa: boolean; note: string
}

interface Dish extends Base {
  nome: string; portataSuggerita: string | null
  porzioniBase: number | null
  tempoPreparazioneMin: number | null; tempoCotturaMin: number | null
  tempoRiposoMin: number | null
  attrezzature: string[]; procedimento: string[]
  note: string; fonte: string
  ingredienti: DishIngredient[]           // salvati e versionati insieme al piatto
}

type StatoParsing = 'certo' | 'da_verificare' | 'confermato'
type Scalatura = 'proporzionale' | 'fissa'

interface DishIngredient {
  id: Id; ordine: number
  testoOriginale: string; nome: string; ingredientId: Id | null
  quantita: number | null; quantitaMax: number | null; unita: CodiceUnita | null
  scalatura: Scalatura; facoltativo: boolean; nota: string
  statoParsing: StatoParsing; problemiParsing: string[]
}

interface Ingredient extends Base {
  nome: string; sinonimi: string[]; repartoId: Id
  unitaPreferita: CodiceUnita | null; scalaturaAbituale: Scalatura
}

interface Reparto { id: Id; nome: string; ordine: number; diSistema: boolean; versione: number }

type StatoSpesa = 'da_comprare' | 'ce_lho' | 'comprato'

interface ShoppingItem extends Base {     // tabella articoli_spesa
  eventId: Id
  tipo: 'calcolato' | 'manuale'
  chiave: string | null                   // solo 'calcolato' (§10.2)
  stato: StatoSpesa
  fabbisognoCoperto: number | null        // §10.3; calcolato dal server
  quantitaUtente: number | null; quantitaCalcolataAllaCorrezione: number | null
  repartoId: Id | null; nascosto: boolean; inclusa: boolean; nota: string
  nome: string; quantitaTesto: string     // solo 'manuale'
}

interface Task extends Base {
  eventId: Id; titolo: string; data: DataISO; ora: Ora | null
  stato: 'da_fare' | 'fatto'; menuItemId: Id | null; note: string; ordine: number
}

interface Settings {                       // record unico
  coefficienteBambini: number              // default 0,5
  portatePredefinite: { id: Id; nome: string; ordine: number }[]
  versione: number
}

interface EventSnapshot {                  // contenuto autonomo, §7.3
  id: Id; eventId: Id; stato: 'valido' | 'superato'
  creatoIl: Epoch; superatoIl: Epoch | null
  versioneFormato: 1
  contenuto: {
    evento: Omit<Event, 'versione' | 'creatoIl' | 'aggiornatoIl'>   // con portate
    copertiEquivalenti: number
    voci: (Omit<MenuItem, 'versione' | 'creatoIl' | 'aggiornatoIl'>
           & { portataNome: string; porzioniEffettive: number })[]
    piatti: { dishId: Id; dati: Omit<Dish, 'versione' | 'creatoIl' | 'aggiornatoIl'>
              & { ingredienti: (DishIngredient & { ingredienteNome: string | null;
                                                   repartoNome: string | null })[] } }[]
    spesa: { chiave: string; sezione: string; nome: string; reparto: string
             quantita: number | null; unita: CodiceUnita | null; stato: StatoSpesa
             provenienze: string[] }[]
    articoliManuali: Omit<ShoppingItem, 'versione' | 'creatoIl' | 'aggiornatoIl'>[]
    attivita: Omit<Task, 'versione' | 'creatoIl' | 'aggiornatoIl'>[]
  }
}
```

La preferenza del tema non è un dato condiviso: sta nel `localStorage` di ciascun
dispositivo.

### 6.3 Schema SQLite (migrazione `0001_iniziale.sql`)

Impostazioni di connessione, applicate a ogni apertura dal backend:

```sql
PRAGMA journal_mode = WAL;      -- letture concorrenti alle scritture, backup a caldo
PRAGMA synchronous = FULL;      -- durabilità massima (carico minimo, nessun costo percepibile)
PRAGMA foreign_keys = ON;       -- vincoli referenziali attivi (per connessione)
PRAGMA busy_timeout = 5000;
```

```sql
CREATE TABLE meta (
  chiave TEXT PRIMARY KEY,
  valore TEXT NOT NULL                     -- JSON
) STRICT;
-- chiavi: 'revisione' (contatore globale, §12.6), 'seed_impostazioni', 'seed_catalogo'

CREATE TABLE impostazioni (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  coefficiente_bambini REAL NOT NULL DEFAULT 0.5
    CHECK (coefficiente_bambini BETWEEN 0 AND 1),
  versione INTEGER NOT NULL DEFAULT 1,
  aggiornato_il INTEGER NOT NULL
) STRICT;

CREATE TABLE portate_predefinite (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  ordine INTEGER NOT NULL CHECK (ordine >= 0)
) STRICT;

CREATE TABLE reparti (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  nome_norm TEXT NOT NULL UNIQUE,
  ordine INTEGER NOT NULL CHECK (ordine >= 0),
  di_sistema INTEGER NOT NULL DEFAULT 0 CHECK (di_sistema IN (0, 1)),   -- 'rep-altro'
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL, aggiornato_il INTEGER NOT NULL
) STRICT;

CREATE TABLE eventi (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  data TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  ora_servizio TEXT CHECK (ora_servizio IS NULL OR ora_servizio GLOB '[0-2][0-9]:[0-5][0-9]'),
  tipo TEXT NOT NULL CHECK (tipo IN ('pranzo', 'cena', 'aperitivo', 'brunch')),
  occasione TEXT NOT NULL DEFAULT '',
  adulti INTEGER NOT NULL CHECK (adulti >= 0),
  bambini INTEGER NOT NULL CHECK (bambini >= 0),
  coefficiente_bambini REAL NOT NULL CHECK (coefficiente_bambini BETWEEN 0 AND 1),
  note TEXT NOT NULL DEFAULT '',
  stato TEXT NOT NULL DEFAULT 'attivo' CHECK (stato IN ('attivo', 'concluso', 'archiviato')),
  concluso_il INTEGER, archiviato_il INTEGER,
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL, aggiornato_il INTEGER NOT NULL,
  CHECK ((stato = 'archiviato') = (archiviato_il IS NOT NULL))
) STRICT;
CREATE INDEX eventi_data ON eventi (data);

CREATE TABLE portate_evento (
  id TEXT PRIMARY KEY,
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  ordine INTEGER NOT NULL CHECK (ordine >= 0),
  UNIQUE (id, evento_id)                   -- destinazione della FK composta delle voci
) STRICT;
CREATE INDEX portate_evento_evento ON portate_evento (evento_id);

CREATE TABLE piatti (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  nome_norm TEXT NOT NULL,
  portata_suggerita TEXT,
  porzioni_base REAL CHECK (porzioni_base IS NULL OR porzioni_base > 0),
  tempo_preparazione_min INTEGER CHECK (tempo_preparazione_min IS NULL OR tempo_preparazione_min >= 0),
  tempo_cottura_min INTEGER CHECK (tempo_cottura_min IS NULL OR tempo_cottura_min >= 0),
  tempo_riposo_min INTEGER CHECK (tempo_riposo_min IS NULL OR tempo_riposo_min >= 0),
  attrezzature TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(attrezzature)),
  procedimento TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(procedimento)),
  note TEXT NOT NULL DEFAULT '', fonte TEXT NOT NULL DEFAULT '',
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL, aggiornato_il INTEGER NOT NULL
) STRICT;
CREATE INDEX piatti_nome ON piatti (nome_norm);

CREATE TABLE voci_menu (
  id TEXT PRIMARY KEY,
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  portata_id TEXT NOT NULL,
  ordine INTEGER NOT NULL CHECK (ordine >= 0),
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  piatto_id TEXT REFERENCES piatti (id) ON DELETE SET NULL,
  porzioni REAL CHECK (porzioni IS NULL OR porzioni > 0),
  incaricato TEXT NOT NULL DEFAULT '',
  in_spesa INTEGER NOT NULL DEFAULT 1 CHECK (in_spesa IN (0, 1)),
  note TEXT NOT NULL DEFAULT '',
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL, aggiornato_il INTEGER NOT NULL,
  -- la portata deve appartenere allo stesso evento; una portata con voci non si elimina
  FOREIGN KEY (portata_id, evento_id) REFERENCES portate_evento (id, evento_id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX voci_menu_evento ON voci_menu (evento_id, portata_id, ordine);
CREATE INDEX voci_menu_piatto ON voci_menu (piatto_id);

CREATE TABLE ingredienti (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  nome_norm TEXT NOT NULL UNIQUE,
  reparto_id TEXT NOT NULL REFERENCES reparti (id) ON DELETE RESTRICT,
  unita_preferita TEXT CHECK (unita_preferita IS NULL OR unita_preferita IN (/* §8.1 */)),
  scalatura_abituale TEXT NOT NULL DEFAULT 'proporzionale'
    CHECK (scalatura_abituale IN ('proporzionale', 'fissa')),
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL, aggiornato_il INTEGER NOT NULL
) STRICT;
CREATE INDEX ingredienti_reparto ON ingredienti (reparto_id);

CREATE TABLE sinonimi_ingrediente (
  ingrediente_id TEXT NOT NULL REFERENCES ingredienti (id) ON DELETE CASCADE,
  sinonimo TEXT NOT NULL,
  sinonimo_norm TEXT NOT NULL UNIQUE,      -- un sinonimo appartiene a un solo ingrediente
  PRIMARY KEY (ingrediente_id, sinonimo_norm)
) STRICT;

CREATE TABLE ingredienti_piatto (
  id TEXT PRIMARY KEY,
  piatto_id TEXT NOT NULL REFERENCES piatti (id) ON DELETE CASCADE,
  ordine INTEGER NOT NULL CHECK (ordine >= 0),
  testo_originale TEXT NOT NULL,
  nome TEXT NOT NULL,
  ingrediente_id TEXT REFERENCES ingredienti (id) ON DELETE SET NULL,
  quantita REAL CHECK (quantita IS NULL OR quantita >= 0),
  quantita_max REAL CHECK (quantita_max IS NULL OR (quantita IS NOT NULL AND quantita_max >= quantita)),
  unita TEXT CHECK (unita IS NULL OR unita IN (/* §8.1 */)),
  scalatura TEXT NOT NULL CHECK (scalatura IN ('proporzionale', 'fissa')),
  facoltativo INTEGER NOT NULL DEFAULT 0 CHECK (facoltativo IN (0, 1)),
  nota TEXT NOT NULL DEFAULT '',
  stato_parsing TEXT NOT NULL CHECK (stato_parsing IN ('certo', 'da_verificare', 'confermato')),
  problemi_parsing TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(problemi_parsing)),
  CHECK (unita IS NOT 'qb' OR quantita IS NULL)
) STRICT;
CREATE INDEX ingredienti_piatto_piatto ON ingredienti_piatto (piatto_id, ordine);
CREATE INDEX ingredienti_piatto_ingrediente ON ingredienti_piatto (ingrediente_id);

CREATE TABLE articoli_spesa (
  id TEXT PRIMARY KEY,
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('calcolato', 'manuale')),
  chiave TEXT,
  stato TEXT NOT NULL DEFAULT 'da_comprare' CHECK (stato IN ('da_comprare', 'ce_lho', 'comprato')),
  fabbisogno_coperto REAL,
  quantita_utente REAL CHECK (quantita_utente IS NULL OR quantita_utente >= 0),
  quantita_calcolata_alla_correzione REAL,
  reparto_id TEXT REFERENCES reparti (id) ON DELETE SET NULL,
  nascosto INTEGER NOT NULL DEFAULT 0 CHECK (nascosto IN (0, 1)),
  inclusa INTEGER NOT NULL DEFAULT 0 CHECK (inclusa IN (0, 1)),
  nota TEXT NOT NULL DEFAULT '',
  nome TEXT NOT NULL DEFAULT '',
  quantita_testo TEXT NOT NULL DEFAULT '',
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL, aggiornato_il INTEGER NOT NULL,
  CHECK ((tipo = 'calcolato' AND chiave IS NOT NULL)
      OR (tipo = 'manuale' AND chiave IS NULL AND length(trim(nome)) > 0)),
  CHECK (stato <> 'da_comprare' OR fabbisogno_coperto IS NULL)
) STRICT;
CREATE UNIQUE INDEX articoli_spesa_chiave ON articoli_spesa (evento_id, chiave) WHERE chiave IS NOT NULL;
CREATE INDEX articoli_spesa_evento ON articoli_spesa (evento_id);

CREATE TABLE attivita (
  id TEXT PRIMARY KEY,
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  titolo TEXT NOT NULL CHECK (length(trim(titolo)) > 0),
  data TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  ora TEXT CHECK (ora IS NULL OR ora GLOB '[0-2][0-9]:[0-5][0-9]'),
  stato TEXT NOT NULL DEFAULT 'da_fare' CHECK (stato IN ('da_fare', 'fatto')),
  voce_menu_id TEXT REFERENCES voci_menu (id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  ordine INTEGER NOT NULL DEFAULT 0,
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL, aggiornato_il INTEGER NOT NULL
) STRICT;
CREATE INDEX attivita_evento ON attivita (evento_id, data);

CREATE TABLE snapshot_eventi (
  id TEXT PRIMARY KEY,
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  stato TEXT NOT NULL CHECK (stato IN ('valido', 'superato')),
  versione_formato INTEGER NOT NULL,
  contenuto TEXT NOT NULL CHECK (json_valid(contenuto)),
  creato_il INTEGER NOT NULL,
  superato_il INTEGER,
  CHECK ((stato = 'superato') = (superato_il IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX snapshot_valido ON snapshot_eventi (evento_id) WHERE stato = 'valido';
```

L'elenco delle unità nei `CHECK` (`/* §8.1 */`) è generato dal catalogo delle unità del
dominio al momento di scrivere la migrazione e poi fissato nel file SQL (una nuova unità
richiede una migrazione).

### 6.4 Vincoli e azioni referenziali

| Operazione | Garanzia | Dove |
|---|---|---|
| Elimina evento | Elimina portate, voci, articoli di spesa, attività, snapshot | `ON DELETE CASCADE` |
| Elimina portata dell'evento | Rifiutata se ha voci; l'interfaccia propone di spostarle prima | `ON DELETE RESTRICT` + servizio |
| Voce in una portata di un altro evento | Impossibile | FK composta `(portata_id, evento_id)` |
| Elimina voce di menù | Le attività collegate restano con `voce_menu_id = NULL` | `ON DELETE SET NULL` |
| Attività collegata a una voce di un altro evento | Rifiutata | servizio (422) |
| Elimina piatto | Le voci collegate restano con il loro nome e `piatto_id = NULL`; gli snapshot non cambiano | `ON DELETE SET NULL`; snapshot in JSON |
| Elimina ingrediente di catalogo | Gli ingredienti dei piatti restano con il loro nome e `ingrediente_id = NULL`; sinonimi eliminati | `SET NULL` / `CASCADE` |
| Elimina reparto | Il servizio sposta prima gli ingredienti su `rep-altro` nella stessa transazione; `rep-altro` (`di_sistema`) non è eliminabile | `RESTRICT` + servizio |
| Modifiche a un evento archiviato | Rifiutate con 422 `evento_archiviato` | servizio |
| Sinonimo uguale a un nome canonico di un altro ingrediente | Rifiutato | servizio (l'unicità fra tabelle non è esprimibile in SQL) |
| Una sola versione archiviata valida per evento | Garantito | indice univoco parziale |

### 6.5 Migrazioni

- File SQL numerati in `server/db/migrazioni/` (`0001_iniziale.sql`, `0002_….sql`),
  applicati in ordine dal backend **all'avvio**, prima di accettare richieste.
- Versione corrente in `PRAGMA user_version`; una tabella `migrazioni_applicate (versione,
  nome, sha256, applicata_il)` conserva lo storico e l'impronta dei file: un file già
  applicato e poi modificato blocca l'avvio.
- Procedura all'avvio:
  1. apertura del database e lettura di `user_version`;
  2. se il database è più recente del codice → arresto con codice d'uscita 78 e messaggio
     nel journal («rilascio più vecchio del database»);
  3. se ci sono migrazioni da applicare → **backup a caldo** (`backup()` di `node:sqlite`)
     in `dati/backup/pre-migrazione-v<N>-<data>.db` e `PRAGMA integrity_check` sul
     backup; se fallisce, nessuna migrazione e arresto con codice 78;
  4. ogni migrazione in una transazione `BEGIN IMMEDIATE … COMMIT` insieme
     all'aggiornamento di `user_version` e di `migrazioni_applicate`;
  5. dopo l'ultima: `PRAGMA foreign_key_check` e `PRAGMA integrity_check`; un errore
     annulla l'ultima transazione e arresta con codice 78.
- Il servizio systemd non riavvia in ciclo dopo il codice 78
  (`RestartPreventExitStatus=78`, §14.3).
- Le migrazioni sono solo in avanti. Tornare indietro significa ripristinare il backup
  pre-migrazione e il rilascio precedente (§14.4).
- Ogni migrazione ha un test che parte da un database reale della versione precedente
  popolato con dati di prova (§17).

### 6.6 Dati iniziali (seed)

- Eseguiti dal backend all'avvio dopo le migrazioni, idempotenti, in transazione.
- `seed_impostazioni` (M0): impostazioni (coefficiente 0,5), portate predefinite
  (Antipasti, Primi, Secondi, Contorni, Dolci, Frutta e caffè, Bevande), reparti di
  §7.6 con id stabili e `rep-altro` di sistema.
- `seed_catalogo` (M2): catalogo ingredienti (§7.5).
- Ogni seed registra la propria versione in `meta`; una versione nuova aggiunge solo ciò
  che manca e non tocca i record modificati dall'utente.

## 7. Regole di business

### 7.1 Coperti e porzioni

- **Coperti equivalenti** = `adulti + bambini × coefficienteBambini`. Valore decimale, non
  arrotondato; mostrato con al massimo un decimale («10,5 coperti»).
- Porzioni effettive di una voce = `porzioni ?? copertiEquivalenti`.
- Cambiare adulti, bambini o coefficiente aggiorna tutte le voci senza porzioni proprie;
  le voci con porzioni proprie non cambiano (mostrano un'icona «porzioni personalizzate»
  e l'azione «torna ai coperti»).
- Coperti equivalenti = 0: le quantità calcolate sono 0 e la spesa mostra l'avviso
  «Indica il numero di persone».

### 7.2 Menù

- Una voce può esistere senza piatto. Aggiungere un nome **non** crea mai un piatto.
- Il piatto nasce solo con un'azione esplicita («Crea nel ricettario»).
- La voce collegata conserva il proprio `nome` (può differire dal piatto, es. «Lasagne
  della nonna» → piatto «Lasagne alla bolognese»). Se il piatto viene rinominato, la voce
  propone «Aggiorna anche il nome nel menù» senza farlo da sola.
- Una voce partecipa alla spesa solo se `inSpesa` e ha un piatto con ingredienti. Una
  voce senza piatto con `inSpesa = true` compare in *Spesa → Da verificare* come «Piatto
  senza ricetta: aggiungi gli ingredienti o un articolo manuale».
- Ordine: interi consecutivi per portata, riscritti in transazione a ogni spostamento.

### 7.3 Stati dell'evento

```
            concludi                  archivia
  attivo ─────────────▶ concluso ─────────────▶ archiviato
    ▲  ◀───────────────── │                        │
    │       riapri        │ archivia               │ riapri (§7.4)
    │                     ▼                        │
    └──────────────── (anche attivo → archiviato) ◀┘
```

| Stato | Modificabile | Note |
|---|---|---|
| `attivo` | Tutto | Stato iniziale |
| `concluso` | Tutto | Evento passato ma ancora aperto (es. per finire il piano o rivedere la spesa). Proposto, mai automatico, quando la data è passata |
| `archiviato` | Nulla, tranne riapertura ed eliminazione | Tutto (panoramica, menù, ricette, spesa, piano, stampa, vista cucina) è letto **solo dallo snapshot** |

**Archiviazione** (in un'unica transazione):
1. calcolo e riconciliazione della spesa corrente (§10);
2. creazione di un `EventSnapshot` `valido` con la copia completa di: dati dell'evento e
   portate, tutte le voci di menù (ordine, nomi liberi, porzioni effettive, incaricati,
   note), i piatti collegati con ingredienti e nomi di catalogo/reparto risolti, la
   spesa riconciliata, gli articoli manuali, le attività;
3. evento → `archiviato`, `archiviatoAt`; lo snapshot è l'unico `valido` dell'evento
   (indice univoco parziale, §6.3).

I record vivi (voci, stati della spesa, attività) restano nel database ma l'interfaccia
non li usa finché l'evento è archiviato. Le modifiche o eliminazioni di piatti nel
ricettario non alterano mai ciò che l'evento archiviato mostra.

Dall'evento archiviato è disponibile, per ogni piatto, l'azione **«Copia nel
ricettario»**: crea un **nuovo** piatto dai dati dello snapshot (nome «Nome (Natale
2026)», modificabile). È l'unico modo di recuperare una ricetta archiviata e non tocca
i piatti esistenti.

### 7.4 Riapertura di un evento archiviato

Scelta di semplicità: lo storico è affidabile perché autonomo; la riapertura non tenta
di fondere snapshot e ricettario.

1. «Riapri» mostra una conferma: «L'evento tornerà modificabile e userà le ricette
   **attuali** del ricettario. La versione archiviata resta consultabile nello storico.»
   Se alcuni piatti sono cambiati o eliminati dopo l'archiviazione, la conferma li elenca
   (solo informazione) e ricorda l'azione «Copia nel ricettario».
2. In un'unica transazione: lo snapshot passa a `superato`, l'evento torna `attivo`.
3. L'evento riprende i propri record vivi: voci (quelle di piatti eliminati sono già senza
   piatto, §6.4), stati della spesa, articoli manuali, attività. La riconciliazione
   (§10.4) segnala le differenze dovute a ricette cambiate.
4. Gli snapshot `superato` sono consultabili in sola lettura dalla panoramica
   («Versioni archiviate»). Una nuova archiviazione crea un nuovo snapshot `valido`. Gli
   snapshot si eliminano solo insieme all'evento.

### 7.5 Ricettario e catalogo

- Nome piatto obbligatorio; nomi duplicati permessi ma segnalati («Esiste già un piatto
  con questo nome»).
- `porzioniBase` vuoto: il piatto è usabile, ma la spesa non può scalarlo (§10.3).
- Un ingrediente di catalogo ha nome canonico unico (su `nome_norm`) e sinonimi unici
  nell'intero catalogo; un conflitto blocca il salvataggio con messaggio.
- Il catalogo iniziale conta **200–250 ingredienti italiani**, ognuno con reparto, unità
  preferita, sinonimi principali e, dove serve, `scalaturaAbituale: 'fissa'` (§8.3).
  Copre tutti i 14 reparti di §7.6 (almeno 5 ingredienti ciascuno, *Altro* escluso).
- Seed **idempotente**: id stabili (`ing-…`), la riga `seed_catalogo` della tabella `meta` per sapere quale
  versione del seed è stata applicata. Un'esecuzione ripetuta non crea duplicati;
  una versione nuova del seed aggiunge solo gli id mancanti e aggiorna solo le voci mai
  modificate dall'utente (`aggiornato_il = creato_il` e `versione = 1`); non elimina nulla. Un ingrediente
  dell'utente con lo stesso `nome_norm` di una nuova voce del seed vince: la voce del
  seed non viene inserita.

### 7.6 Reparti

Catalogo iniziale, in quest'ordine (id stabili):

| id | Nome | Esempi del catalogo iniziale |
|---|---|---|
| `rep-ortofrutta` | Ortofrutta | patate, cipolle, aglio, limoni, prezzemolo, insalata |
| `rep-macelleria` | Macelleria | manzo, vitello, maiale, pollo, cappone, salsiccia, macinato |
| `rep-pescheria` | Pescheria | salmone, gamberi, vongole, cozze, baccalà |
| `rep-salumi-formaggi` | Salumi e formaggi | prosciutto crudo, mortadella, parmigiano, mozzarella, gorgonzola |
| `rep-latte-uova-frigo` | Latte, uova e frigo | latte, panna, burro, uova, yogurt, mascarpone, pasta sfoglia |
| `rep-pane-forno` | Pane e forno | pane, pane in cassetta, grissini, pangrattato |
| `rep-pasta-riso-farine` | Pasta, riso e farine | spaghetti, lasagne, riso carnaroli, farina 00, fecola, lievito |
| `rep-dispensa` | Dispensa | passata, pelati, legumi, tonno, olio, aceto, brodo, frutta secca |
| `rep-spezie-condimenti` | Spezie e condimenti | sale, pepe, noce moscata, alloro, zafferano, senape |
| `rep-dolci` | Dolci | zucchero, cioccolato, cacao, savoiardi, panettone, canditi |
| `rep-surgelati` | Surgelati | piselli surgelati, spinaci surgelati, gelato |
| `rep-bevande` | Bevande | acqua, vino, spumante, succhi, birra |
| `rep-casa-tavola` | Casa e tavola | tovaglioli, carta forno, alluminio, candele |
| `rep-altro` | Altro | (predefinito per ingredienti senza reparto) |

I reparti si rinominano, riordinano, aggiungono ed eliminano (con le regole di §6.4).
L'ordine dei reparti è l'ordine della lista della spesa.

### 7.7 Attività

- Data obbligatoria (proposta: giorno dell'evento), ora facoltativa.
- Scelte rapide: *2 giorni prima*, *il giorno prima*, *la mattina*, *un'ora prima del
  servizio* (calcola data e ora dall'evento; poi i valori sono assoluti e non seguono
  spostamenti successivi dell'evento — se la data dell'evento cambia, l'app propone
  «Sposta anche le attività di N giorni»).
- Ordinamento: data, poi ora (le attività senza ora per prime), poi `ordine`.

### 7.8 Portate

- Predefinite (modificabili in impostazioni): Antipasti, Primi, Secondi, Contorni,
  Dolci, Frutta e caffè, Bevande.
- Alla creazione l'evento copia le predefinite; poi ogni evento ha le sue (aggiungi,
  rinomina, riordina, elimina). Le portate vuote non compaiono in stampa (opzione).

## 8. Parser ingredienti

Funzione pura `analizzaRiga(testo, catalogo) → RigaAnalizzata` in `src/domain/parser/`.

### 8.1 Unità riconosciute

| Codice | Famiglia | Forme riconosciute (senza distinzione maiuscole, con o senza punto) |
|---|---|---|
| `g` | massa | g, gr, grammo, grammi |
| `hg` | massa | hg, etto, etti |
| `kg` | massa | kg, chilo, chili, chilogrammo, chilogrammi |
| `ml` | volume | ml, millilitro, millilitri |
| `cl` | volume | cl, centilitro, centilitri |
| `dl` | volume | dl, decilitro, decilitri |
| `l` | volume | l, lt, litro, litri |
| `pz` | conteggio | pz, pezzo, pezzi, n., nr |
| `cucchiaio` | misura domestica | cucchiaio, cucchiai, cucch., c. |
| `cucchiaino` | misura domestica | cucchiaino, cucchiaini, cucchiaino/i da caffè, c.no |
| `tazza` | misura domestica | tazza, tazze |
| `bicchiere` | misura domestica | bicchiere, bicchieri |
| `spicchio` | conteggio | spicchio, spicchi |
| `foglia` | conteggio | foglia, foglie |
| `rametto` | conteggio | rametto, rametti |
| `mazzetto` | conteggio | mazzetto, mazzetti, mazzo, mazzi |
| `fetta` | conteggio | fetta, fette |
| `pizzico` | misura domestica | pizzico, pizzichi |
| `manciata` | misura domestica | manciata, manciate |
| `noce` | misura domestica | noce (solo in «una noce di burro») |
| `bustina` | confezione | bustina, bustine |
| `confezione` | confezione | confezione, confezioni, conf., pacco, pacchi, pacchetto |
| `scatola` | confezione | scatola, scatole, lattina, lattine |
| `vasetto` | confezione | vasetto, vasetti, barattolo, barattoli |
| `qb` | qb | q.b., qb, quanto basta, a piacere |

### 8.2 Conversioni sicure

Le **uniche** conversioni ammesse sono interne a una famiglia metrica:

| Famiglia | Unità base | Fattori |
|---|---|---|
| massa | `g` | 1 hg = 100 g · 1 kg = 1000 g |
| volume | `ml` | 1 cl = 10 ml · 1 dl = 100 ml · 1 l = 1000 ml |

Mai convertite: massa ↔ volume (nessuna densità), misure domestiche ↔ volume (un
cucchiaio non diventa 15 ml), unità contabili fra loro (spicchio ≠ pezzo, confezione ≠
scatola), confezioni ↔ massa anche se la nota dice «(230 g)». Ogni unità non metrica è
una famiglia a sé: si somma solo con la stessa unità.

### 8.3 Formati supportati

| Esempio | quantità | unità | nome | nota | esito |
|---|---|---|---|---|---|
| `200 g farina` | 200 | g | farina | | certo |
| `200g di farina 00` | 200 | g | farina 00 | | certo |
| `farina 00 200 g` | 200 | g | farina 00 | | certo |
| `Farina 00 g 200` | 200 | g | farina 00 | | certo |
| `1,5 kg di patate` | 1,5 | kg | patate | | certo |
| `2 uova` / `uova 2` | 2 | — | uova | | certo |
| `un uovo` / `mezzo limone` | 1 / 0,5 | — | uovo / limone | | certo |
| `1/2 cucchiaino di sale` / `½ bicchiere di vino` | 0,5 | cucchiaino / bicchiere | sale / vino | | certo |
| `2-3 patate` / `2 o 3 patate` | 2 (max 3) | — | patate | | certo |
| `1 spicchio d'aglio` | 1 | spicchio | aglio | | certo |
| `burro 50 g (morbido)` | 50 | g | burro | morbido | certo |
| `sale q.b.` / `q.b. pepe` / `sale` (riga di soli condimenti noti) | — | qb | sale / pepe | | certo / certo / da verificare |
| `1 confezione di pasta sfoglia (230 g)` | 1 | confezione | pasta sfoglia | (230 g) | certo |
| `parmigiano grattugiato facoltativo` | — | — | parmigiano grattugiato | | da verificare (`facoltativo = true`) |
| `1.000 g di farina` | 1000 | g | farina | | **da verificare** (separatore delle migliaia) |
| `2 cucchiai abbondanti di olio` | 2 | cucchiaio | olio | abbondanti | certo |
| `3 4 pomodori` / `200 g 2 uova` | — | — | — | | **da verificare** (più numeri) |
| `zucchero di canna` | — | — | zucchero di canna | | **da verificare** (nessuna quantità) |
| `1 cipolla rossa di Tropea` | 1 | — | cipolla rossa di Tropea | | certo |

Regole:
1. Normalizzazione: frazioni Unicode (½ ¼ ¾ ⅓ ⅔), virgola decimale, numeri in parola
   (un/uno/una, mezzo/mezza, due…dodici, dozzina), «e mezzo».
2. Si cercano numero e unità all'**inizio** (forma «200 g farina»), alla **fine**
   («farina 200 g») o nella forma da ricettario «nome unità numero» («farina g 200»).
3. Token numerici che fanno parte del nome (`00`, `0`, `tipo 1`, `tipo 2`, `70%`) sono
   protetti da un elenco e non diventano quantità.
4. Connettivi rimossi dal nome: «di», «d'», «del», «della»; parentesi → `nota`; parole
   come «abbondanti», «scarsi», «circa» → `nota` (e «circa» non rende incerta la riga).
5. Collegamento al catalogo: corrispondenza **esatta** di `norm(nome)` con nome canonico o
   sinonimo → `ingredientId`, certo. Corrispondenze approssimate (singolare/plurale,
   prefisso più lungo come «parmigiano grattugiato» → «parmigiano») sono solo
   **suggerimenti** da confermare: non impostano `ingredientId`.
6. Esito `certo` solo se: al massimo un numero (o un intervallo), unità riconosciuta o
   nessuna unità con nome non vuoto, nessun token sconosciuto in posizione d'unità.
   Altrimenti `da_verificare` con l'elenco dei motivi in `problemiParsing`.
7. La conferma o correzione manuale imposta `statoParsing = 'confermato'`;
   `testoOriginale` non cambia mai.
8. `scalatura` proposta: `fissa` per foglia, rametto, pizzico, `qb` e per ingredienti
   del catalogo con `scalaturaAbituale = 'fissa'` (alloro, chiodi di garofano…); `proporzionale`
   per il resto. Sempre modificabile.

### 8.4 Collaudo del parser

Tabella di casi in `src/domain/parser/casi.test.ts` con almeno **100** righe reali
(ricette italiane, formati misti, errori di battitura). Il criterio non è «indovinare
tutto», ma: nessuna riga ambigua marcata `certo`, e ≥ 90 % dei casi della tabella
classificati come previsto.

## 9. Scalatura delle quantità

### 9.1 Fattore

```
porzioniEffettive = voce.porzioni ?? copertiEquivalenti(evento)
fattore = porzioniEffettive / piatto.porzioniBase
quantitaScalata = scalatura === 'fissa' ? quantita : quantita × fattore
```

### 9.2 Casi particolari

| Situazione | Comportamento |
|---|---|
| `porzioniBase` nullo o 0 | Nessuna scalatura; nella spesa ogni ingrediente del piatto compare come contributo **non sommato** in *Da verificare* («porzioni base mancanti»), con la quantità della ricetta indicata come «riferimento per N porzioni sconosciute» (§10.1) |
| `quantita` nulla (non `qb`) | Contributo *quantità da definire*, non sommato, visibile in *Da verificare* |
| `statoParsing = 'da_verificare'` | Contributo non sommato in *Da verificare*, con il testo originale |
| `qb` | Mai scalata né sommata; nella spesa un'unica riga per ingrediente «q.b.» |
| Intervallo `quantita`–`quantitaMax` | Entrambi scalati; la spesa usa il massimo |
| Scalatura `fissa` | Conta una volta per voce di menù che usa il piatto |
| Fattore molto alto o basso (> 4 o < 0,25) | Avviso «quantità moltiplicata per N: controlla le dosi» in vista cucina e spesa |

### 9.3 Precisione

Calcolo in virgola mobile con somma su unità base; i confronti usano una tolleranza di
`1e-6` relativa. Nessun arrotondamento viene mai salvato.

### 9.4 Arrotondamento in visualizzazione

| Unità | Vista cucina | Lista della spesa |
|---|---|---|
| g | < 10: 1 decimale; ≥ 10: intero | ≥ 1000 → kg con fino a 2 decimali; altrimenti intero arrotondato per eccesso a 5 g |
| ml | come g | ≥ 1000 → l con fino a 2 decimali; altrimenti intero per eccesso a 5 ml |
| hg, cl, dl | convertiti nell'unità base della famiglia (g, ml) prima di mostrare | idem |
| pz e conteggi (spicchio, fetta, foglia, rametto, mazzetto) | frazioni comuni (½, ⅓, ¼, ¾) se entro il 5 %, altrimenti 1 decimale | per eccesso all'intero |
| confezioni (bustina, confezione, scatola, vasetto) | come conteggi | per eccesso all'intero |
| misure domestiche (cucchiaio, cucchiaino, tazza, bicchiere, pizzico, manciata, noce) | al ½ più vicino | al ½ più vicino |

Formattazione italiana (virgola decimale) con `Intl.NumberFormat('it-IT')`.

## 10. Calcolo e riconciliazione della spesa

Tutto in `src/domain/spesa/`, funzioni pure senza SQLite, Fastify né React, con test
esaustivi. Le esegue il **server** (servizio `spesa`), che legge i dati in una
transazione di sola lettura e restituisce al client la lista già riconciliata (§12.4).

Principio: **si somma solo ciò che è certo**. Ogni contributo incompleto o dubbio resta
visibile come riga a sé, con la sua provenienza, e non entra in alcun totale.

### 10.1 Calcolo (`calcolaSpesa`)

Input: evento, voci di menù, piatti, ingredienti dei piatti, catalogo, impostazioni.
Output: `RigaCalcolata[]` + `Avviso[]`.

```ts
type Natura = 'sommata' | 'qb' | 'da_verificare' | 'facoltativa'

interface RigaCalcolata {
  chiave: string                 // §10.2
  natura: Natura
  nome: string                   // nome canonico del catalogo o nome libero
  repartoId: Id                  // dal catalogo, altrimenti 'rep-altro'
  quantita: number | null        // in unità base; null se non sommabile
  unita: CodiceUnita | null      // unità base della famiglia
  provenienze: {
    menuItemId: Id; dishId: Id; dishIngredientId: Id; nomeVoce: string
    testoOriginale: string
    quantitaScalata: number | null
  }[]
  motivi: string[]               // solo 'da_verificare': perché non è sommata
}
```

**Classificazione di ogni contributo** (un ingrediente di un piatto collegato a una voce
inclusa nella spesa), nell'ordine:

| # | Condizione | Natura | Sommato? |
|---|---|---|---|
| 1 | `facoltativo` | `facoltativa` | Sommato solo con altri contributi facoltativi della stessa chiave; mai nella spesa obbligatoria |
| 2 | `unita = 'qb'` | `qb` | No: una riga per ingrediente «q.b.» con l'elenco delle voci |
| 3 | `statoParsing = 'da_verificare'` | `da_verificare` | No |
| 4 | `porzioniBase` del piatto nullo o 0 | `da_verificare` | No (quantità mostrata come «da ricetta, non scalata») |
| 5 | `quantita` nulla | `da_verificare` | No («quantità da definire») |
| 6 | altrimenti (certo o confermato, scalabile, con quantità) | `sommata` | Sì, per chiave |

Un contributo `da_verificare` produce **una riga per contributo** (chiave in §10.2), mai
fusa con altre. Quando esiste anche una riga `sommata` per lo stesso ingrediente, questa
mostra un rimando: «+ 1 contributo da verificare» con collegamento, così il totale non
viene letto come completo.

Voci con `inSpesa` ma senza piatto, o con piatto senza ingredienti: non generano righe
ma un **avviso** visibile in cima alla sezione *Da verificare* («Lasagne: nessun
ingrediente — aggiungili o crea un articolo manuale»).

Passi:
1. Selezione delle voci con `inSpesa` e `dishId` valido.
2. Classificazione dei contributi; scalatura (§9) e conversione nell'unità base della
   famiglia solo per `sommata` e `facoltativa` (per `da_verificare` la quantità scalata
   è calcolata solo se possibile ed è mostrata come indicazione).
3. Raggruppamento per chiave: somma per `sommata` e `facoltativa`, unione delle voci per
   `qb`, nessun raggruppamento per `da_verificare`.
4. Ordinamento: ordine del reparto, poi nome.

### 10.2 Chiave della riga

```
sommata / facoltativa:  <identità> "|" <famiglia> [ "|fac" ]
qb:                     <identità> "|qb"
da_verificare:          "dv:" + menuItemId + ":" + dishIngredientId

identità = "ing:" + ingredientId          se collegato al catalogo
         = "txt:" + norm(nome)            altrimenti
famiglia = "massa" | "volume" | "u:" + codiceUnita | "senza_unita"
```

Esempi: `ing:ing-burro|massa`, `ing:ing-olio-evo|volume`, `ing:ing-olio-evo|u:cucchiaio`,
`ing:ing-pinoli|massa|fac`, `txt:sale grosso|qb`, `dv:3f2a…:9c1d…`.

Lo stesso ingrediente in famiglie diverse produce righe distinte, mostrate una sotto
l'altra con un solo titolo («Olio extravergine: 300 ml + 4 cucchiai»).

La chiave è **stabile** rispetto a: cambi di quantità, porzioni, coperti, aggiunta o
rimozione di voci, conversioni interne alla famiglia (200 g → 0,2 kg). Cambia, e quindi
genera una riga nuova, se: si collega/scollega un ingrediente dal catalogo, si cambia
famiglia di unità, si rinomina un ingrediente non collegato, un contributo passa da
*da verificare* a *sommato* (conferma del parser, porzioni base inserite).

### 10.3 Significato degli stati e acquisti parziali

Le righe di `articoli_spesa` di tipo `calcolato` nascono **solo** quando l'utente interviene su una
riga (stato, quantità, reparto, nascosto, inclusa, nota). Una riga mai toccata non ha
record: è `da_comprare`.

| Stato | Significato per l'app |
|---|---|
| `da_comprare` | Il fabbisogno mostrato non è coperto |
| `comprato` | L'utente dichiara **coperto** il fabbisogno mostrato in quel momento, comprandolo |
| `ce_lho` | L'utente dichiara **coperto** il fabbisogno mostrato in quel momento, con ciò che ha già |

`fabbisognoCoperto` è calcolato **dal server** al momento della richiesta (mai
preso dal client, che potrebbe mostrare una lista vecchia) e registra la quantità mostrata (unità base: `quantitaUtente` se
presente, altrimenti calcolata) nel momento in cui la riga passa a `comprato` o `ce_lho`;
torna `null` con `da_comprare`. **Non è una quantità acquistata**: l'app non sa quanto
è stato comprato, sa solo quale fabbisogno è stato dichiarato coperto. Per questo i testi
dell'interfaccia parlano sempre di *fabbisogno* e mai di quantità possedute («segnato
come comprato quando ne servivano 500 g», non «hai 500 g»).

**Acquisti parziali (MVP)**: non sono modellati. Una riga resta `da_comprare` finché il
fabbisogno non è coperto per intero; un acquisto parziale si annota nella `nota` della
riga («presi 2 pacchi su 3»), che è visibile in lista e nella condivisione. Nessun
inventario della dispensa. Un'eventuale gestione delle quantità parziali è rinviata e
richiederà un campo distinto, senza cambiare il significato di `fabbisognoCoperto`.

Righe `da_verificare` e `qb`: possono essere segnate `comprato`/`ce_lho`, ma
`fabbisognoCoperto` resta `null` (nessun confronto quantitativo possibile).

Righe `facoltativa`: compaiono nella sezione *Facoltativi* e non contano nella spesa
obbligatoria finché l'utente non le **aggiunge** (`inclusa = true`); da quel momento si
comportano come righe sommate (stati, confronti, condivisione).

### 10.4 Riconciliazione (`riconciliaSpesa`)

Input: righe calcolate, righe di `articoli_spesa` dell'evento. Output: `VoceListaSpesa[]` raggruppate
in sezioni. Nessuna scrittura: la funzione è pura; eventuali pulizie sono azioni
esplicite. «Fabbisogno attuale» = `quantitaUtente` se presente, altrimenti quantità
calcolata.

| Caso | Condizione | Risultato mostrato |
|---|---|---|
| R1 Nuova | Riga calcolata senza record | *Da comprare*, fabbisogno calcolato |
| R2 Invariata | Record presente; fabbisogno attuale = `fabbisognoCoperto` (tolleranza) | Stato salvato |
| R3 Fabbisogno aumentato | Stato `comprato`/`ce_lho`; fabbisogno attuale > `fabbisognoCoperto` | Riga **Da integrare** nella lista da comprare: «Segnato come comprato per 500 g; ora il fabbisogno è 800 g (+300 g)». Azioni: *Coperto anche l'aumento* (aggiorna `fabbisognoCoperto`), *Torna a da comprare* |
| R4 Fabbisogno diminuito | Stato `comprato`/`ce_lho`; fabbisogno attuale < `fabbisognoCoperto` | Stato salvato con nota informativa «il fabbisogno è sceso a 300 g (era 500 g quando l'hai segnato)» |
| R5 Non più necessaria | Record `comprato`/`ce_lho` senza riga calcolata (piatto tolto, voce esclusa, chiave cambiata) | Sezione **Non più necessari**: nome, stato, fabbisogno che era stato dichiarato coperto, ultima provenienza nota. Azione *Rimuovi* (elimina il record). Mai eliminata in automatico |
| R6 Orfana senza valore | Record `da_comprare` senza riga calcolata, senza nota, quantità utente, reparto, nascosto o inclusa | Non mostrata; eliminata solo dalla pulizia esplicita «Ripulisci» (nessuna informazione persa) |
| R7 Correzione utente | `quantitaUtente` presente | Si mostra `quantitaUtente`; se la calcolata è cambiata rispetto a `quantitaCalcolataAllaCorrezione`, badge «la ricetta è cambiata: calcolati ora 800 g» con *Usa il calcolo* / *Mantieni la mia* |
| R8 Nascosta | `nascosto = true` | In fondo, sezione *Nascosti*, ripristinabile |
| R9 Senza confronto | Natura `qb` o `da_verificare` | Stato salvato, nessun confronto quantitativo |
| R10 Possibile cambio di chiave | Una riga R5 e una R1 con la stessa identità (o lo stesso `norm(nome)`) | Su R5 il suggerimento «forse corrisponde a: Burro 250 g» con azione *Trasferisci lo stato* (sposta stato e nota sulla nuova chiave; `fabbisognoCoperto` resta quello registrato, quindi un aumento appare come R3) |

Per il cambio di natura *da verificare → sommata* (stesso ingrediente), R10 propone il
trasferimento dello stato della riga `dv:` alla riga sommata.

### 10.5 Vista e condivisione

- Sezioni nell'ordine: **Da verificare** (avvisi e contributi non sommati) · **Da
  comprare** (incluse *Da integrare*), per reparto · **Facoltativi** · **Ce l'ho** ·
  **Comprato** · **Non più necessari** · **Nascosti**.
- Contatori: «12 da comprare · 2 da verificare · 5 comprati · 3 ce l'ho».
- Condivisione (`navigator.share({ title, text })`, fallback `navigator.clipboard`):
  righe *da comprare*, *da integrare* (solo la differenza, indicata come tale) e *da
  verificare* (in un blocco separato, con il testo originale), per reparto. Note
  incluse. Facoltativi non aggiunti esclusi.

```
Spesa — Natale 2026 (25/12)

ORTOFRUTTA
☐ Patate 1,5 kg
☐ Prezzemolo 1 mazzetto
LATTE, UOVA E FRIGO
☐ Burro +300 g (aumento rispetto a quanto già segnato)
☐ Uova 8 (nota: presi 6)

DA VERIFICARE
☐ Lasagne: "besciamella" (quantità da definire)
☐ Arrosto: "carne 1 kg" (porzioni base mancanti)
```

### 10.6 Evento archiviato

La spesa di un evento archiviato è letta dallo snapshot (`spesa`, `articoliManuali`) in
sola lettura.

## 11. Backup e ripristino

Il database è unico e sta sul server: i backup sono **centralizzati** e non dipendono da
alcun dispositivo.

### 11.1 Tipi di backup

| Tipo | Quando | Formato | Conservazione |
|---|---|---|---|
| Giornaliero | Timer systemd `menuapp-backup.timer`, ogni giorno alle 03:45 (dopo il backup di dailyMeals delle 03:30) | Copia `.db` a caldo | Ultimi 14 |
| Settimanale | La copia giornaliera della domenica viene conservata anche come settimanale | `.db` | Ultime 8 |
| Pre-migrazione | All'avvio, prima di applicare migrazioni (§6.5) | `.db` | Ultimi 5 |
| Pre-ripristino | Prima di ogni ripristino (§11.4) | `.db` | Ultimi 5 |
| Manuale | *Impostazioni → Dati → Backup ora* | `.db` | Ultimi 10 |
| Esportazione | Su richiesta, scaricata dal browser | JSON portabile (§11.3) | Fuori dal server, a cura di Loris |

Cartella: `/srv/apps/menuapp/dati/backup/` (fuori da Git), nomi
`<tipo>-<AAAAMMGG-HHmmss>-v<schema>.db`, accompagnati da `<nome>.json` con impronta
SHA-256 del file, versione dello schema, conteggi delle tabelle ed esito della verifica.

### 11.2 Creazione e verifica

1. `backup()` di `node:sqlite` (API di backup online di SQLite) dal database aperto: copia
   coerente anche durante le scritture (WAL), su un file temporaneo nella stessa cartella.
2. Apertura del file in sola lettura: `PRAGMA integrity_check` = `ok`,
   `PRAGMA foreign_key_check` vuoto, `user_version` letto, conteggi.
3. Solo se la verifica riesce: `fsync`, rinomina al nome definitivo, scrittura del file
   `.json` di accompagnamento, rotazione secondo §11.1. Altrimenti il file temporaneo
   viene eliminato e l'errore registrato.
4. Esito in `meta` (`ultimo_backup`: data, tipo, esito, nome) e nel journal; in
   *Impostazioni → Dati* un avviso compare se l'ultimo backup giornaliero riuscito ha
   più di 36 ore o se l'ultimo tentativo è fallito.

Il timer esegue `server/backup/cli.ts giornaliero`, che apre il database in un processo
separato e usa lo stesso modulo `server/backup/` dell'API: in modalità WAL la copia a
caldo legge in modo coerente mentre il servizio continua a scrivere. Il servizio resta
l'unico processo che modifica il contenuto.

### 11.3 Esportazione JSON

Formato portabile e leggibile, indipendente da SQLite, utile per conservare i dati fuori
dal server e per i test:

```json
{
  "formato": "menuapp-esportazione",
  "versioneFormato": 1,
  "versioneSchema": 1,
  "versioneApp": "1.0.0+abc1234",
  "esportatoAt": "2026-12-01T18:30:00.000Z",
  "conteggi": { "eventi": 3, "voci_menu": 41, "…": 0 },
  "impronta": "sha256:…",
  "dati": { "<tabella>": [ { "<colonna>": "<valore>" } ] }
}
```

- `dati` contiene **tutte** le tabelle di contenuto con i nomi e i valori delle colonne
  SQL, letti in una transazione di sola lettura. Esclusi: `migrazioni_applicate`,
  `meta.revisione`, `meta.ultimo_backup` (dati di servizio, non di contenuto).
- **Impronta**: SHA-256 della serializzazione canonica di
  `{ versioneFormato, versioneSchema, dati }` (tabelle in ordine alfabetico, righe
  ordinate per chiave primaria, chiavi degli oggetti in ordine alfabetico, `JSON.stringify`
  senza spazi, UTF-8). Due esportazioni senza modifiche intermedie hanno la stessa
  impronta; un file reindentato resta valido.
- È disponibile anche lo scaricamento di un backup `.db` dall'elenco dei backup.

### 11.4 Ripristino

Due sorgenti: un **backup del server** (`.db` dall'elenco) o un **file JSON** caricato
(max 50 MB). Il ripristino avviene in due passi, per evitare sostituzioni accidentali.

**Passo 1 — Verifica** (`POST /api/v1/ripristino/verifica`), nessuna scrittura:
1. JSON: lettura, controllo dell'intestazione, **verifica dell'impronta sul contenuto
   originale** (se non corrisponde: avviso «file modificato o danneggiato», si può
   proseguire solo con conferma esplicita), migrazione del formato alla versione corrente
   con funzioni pure, validazione zod di ogni riga, caricamento in un database
   **temporaneo** con lo schema corrente (che applica tutti i vincoli SQL).
   `.db`: copia temporanea, `integrity_check`, migrazioni fino alla versione corrente
   (stesse migrazioni dell'avvio), `foreign_key_check`.
2. Versione dello schema più recente del codice → rifiuto («aggiorna l'app»).
3. Risposta: riepilogo (data, origine, versione, conteggi, avvisi) e un `token` valido 10
   minuti che identifica il database temporaneo verificato.

**Passo 2 — Esecuzione** (`POST /api/v1/ripristino/esegui` con `token` e conferma
testuale «RIPRISTINA»):
1. backup **pre-ripristino** del database attuale (§11.2); se fallisce, stop;
2. in un'unica transazione `BEGIN IMMEDIATE`: `ATTACH` del database temporaneo,
   cancellazione del contenuto di tutte le tabelle di contenuto in ordine inverso alle
   dipendenze, `INSERT … SELECT` da quello temporaneo, `foreign_key_check`, incremento di
   `meta.revisione`; un errore annulla tutto;
3. `DETACH`, eliminazione del temporaneo, voce nel journal;
4. tutti i dispositivi vedono cambiare la revisione e ricaricano i dati (§12.6); le
   modifiche in corso su altri dispositivi ricevono 409 (le versioni non coincidono più).

Il file del database non viene mai sostituito sul disco mentre il servizio è attivo:
il ripristino è una transazione, quindi atomico.

### 11.5 Ripristino d'emergenza (servizio non avviabile)

Procedura documentata in `docs/OPERAZIONI.md` e in `scripts/ripristino-emergenza.sh`:
fermare `menuapp.service`, copiare il database attuale in `dati/backup/emergenza-…`,
copiare il backup scelto su `dati/menuapp.db` (rimuovendo i file `-wal` e `-shm`),
`integrity_check`, riavviare. Richiede l'intervento di Loris.

### 11.6 Limite noto: un solo disco

Database e backup stanno sullo stesso disco NVMe del server. I backup proteggono da
errori, migrazioni fallite e corruzione logica, **non** dalla rottura del disco. Mitigazione
nell'MVP: esportazione JSON periodica scaricata su un altro dispositivo (promemoria in
*Impostazioni → Dati* se l'ultima esportazione ha più di 14 giorni). Una copia automatica
su un secondo supporto è una decisione aperta.

## 12. Architettura tecnica

### 12.1 Stack e versioni verificate (12/11/2026)

| Componente | Versione | Note sulla verifica |
|---|---|---|
| Node | 24.18 (nvm, `.nvmrc`) | engines `>=22.12`. Esegue TypeScript **senza compilazione** (rimozione dei tipi): verificato con import fra moduli `.ts` e `import type`. Richiede solo sintassi cancellabile, già imposta da `erasableSyntaxOnly` |
| SQLite | 3.53.1 via `node:sqlite` | Verificato: `PRAGMA foreign_keys` e violazioni FK, tabelle `STRICT`, WAL, `ON DELETE CASCADE`, aggiornamento condizionato sulla versione (`changes` 1 / 0), `backup()` online con `integrity_check` = `ok`. Nessun avviso sperimentale in Node 24.18. Nessun modulo nativo da compilare (alternativa scartata: `better-sqlite3` 13) |
| Fastify | 5.12 | `app.inject()` per i test delle API senza porte |
| @fastify/static | 10.1 | file del frontend dallo stesso processo |
| zod | 4.6 | contratto API condiviso, validazione delle esportazioni |
| TypeScript | 7.0.2 | strict di default (verificato); `tsc -b` solo per il controllo dei tipi di client e server. Il pacchetto non espone l'API JS: non serve a nessuno strumento dello stack; ripiego `~5.9` |
| Vite | 8.3 | build del frontend; in sviluppo, proxy `/api` verso il backend |
| React / React DOM | 19.3 | |
| @tanstack/react-query | 5.107 | cache dei dati del server nel client, invalidazione, ricarica al ritorno in primo piano (non è uno store globale dell'applicazione) |
| react-router | 8.5 | solo `createHashRouter` |
| Tailwind CSS + @tailwindcss/vite | 4.3.5 | |
| shadcn (CLI via `npx`) | 4.23 | componenti copiati nel progetto |
| vite-plugin-pwa | 2.0 | solo guscio dell'app in cache, nessun dato |
| Vitest | 5.1 | progetti `dominio`, `server`, `ui` |
| happy-dom / @testing-library/react | 21 / 16.3 | componenti |
| @playwright/test | 1.65 | Chrome di sistema 157 (`channel: 'chrome'`) |
| oxlint | 1.90 | |
| @dnd-kit (M1), font di stampa (M4) | da fissare | |

Rimossi rispetto alla v1.2: `dexie`, `dexie-react-hooks`, `fake-indexeddb`.

### 12.2 Struttura delle cartelle

```
src/
  domain/         logica pura condivisa (nessun import da React, Fastify, SQLite, DOM)
    tipi.ts  norm.ts  tempo.ts  unita.ts  porzioni.ts  parser/  spesa/  snapshot.ts
    regole/        transizioni di stato dell'evento, ordinamenti, validazioni di dominio
  contratto/      schemi zod e tipi delle API (richieste, risposte, codici d'errore)
  app/            frontend: App, router, layout, pagina errore
  api/            client HTTP tipizzato + hook TanStack Query
  connessione/    stato del server, modalità sola lettura
  components/ui/  componenti shadcn
  components/     componenti condivisi (ConflittoVersione, ConfermaElimina, …)
  features/       eventi/ menu/ ricettario/ ingredienti/ spesa/ piano/ cucina/ stampa/ impostazioni/
  pwa/            registrazione service worker, avviso aggiornamento
  styles/
server/
  main.ts         avvio: configurazione, migrazioni, seed, ascolto
  app.ts          costruzione dell'app Fastify (iniettabile nei test)
  config.ts       variabili d'ambiente validate
  db/
    connessione.ts   apertura, PRAGMA, transazioni
    migrazioni/      0001_iniziale.sql …  +  esegui.ts
    seed/            impostazioni, reparti, catalogo
    repo/            un modulo per tabella/aggregato: SQL e conversione di nomi
  servizi/        casi d'uso: transazioni, controlli di versione, regole, chiamate al dominio
  api/            rotte Fastify: validazione col contratto, chiamata ai servizi, mappatura errori
  backup/         crea, verifica, ruota, esporta, ripristina, cli.ts
scripts/          installa-servizio.sh, rilascia.sh, ripristina-rilascio.sh, ripristino-emergenza.sh
test/             e2e/ (Playwright), fixture/ (database ed esportazioni di prova)
dati/             database e backup di produzione (fuori da Git)
dati-sviluppo/    database di sviluppo (fuori da Git)
rilasci/          rilasci installati (fuori da Git), collegamento `attuale`
```

### 12.3 Livelli e regole di dipendenza

```
 interfaccia (src/features, src/app) ──▶ src/api ──HTTP──▶ server/api ──▶ server/servizi ──▶ server/db/repo ──▶ SQLite
            │                                 │                 │                │
            └──────────────▶ src/domain ◀─────┴── src/contratto ─┴────────────────┘
```

- `src/domain`: funzioni pure, testate senza server né browser. Usato dal client
  (anteprima del parser, scalatura in vista cucina, testo di condivisione) e dal server
  (calcolo e riconciliazione della spesa, snapshot, regole).
- `src/contratto`: unico punto in cui è definita la forma dei dati scambiati; il client
  lo usa per tipizzare le chiamate, il server per validare ingressi e uscite.
- `server/api` non contiene regole: valida, chiama un servizio, traduce il risultato.
- `server/servizi` contiene i casi d'uso: apre la transazione, controlla le versioni,
  applica le regole (anche quelle del dominio) e incrementa la revisione.
- `server/db/repo` è l'unico codice che scrive SQL.
- Un test di architettura (Vitest) analizza gli import e fallisce se una regola è violata
  (es. `src/domain` che importa `react` o `node:sqlite`, `src/features` che importa
  `server/`).

### 12.4 API REST e contratto

Prefisso `/api/v1`. JSON UTF-8. Gli schemi di ogni richiesta e risposta sono in
`src/contratto/` e coincidono con i tipi di §6.2.

**Convenzioni**
- Creazione: `POST` con `id` generato dal client. Se l'id esiste già con lo stesso
  contenuto → `200` con il record (ripetizione dopo un errore di rete); con contenuto
  diverso → `409 id_esistente`.
- Modifica: `PUT` dell'intero aggregato con il campo `versione` letto in precedenza.
- Eliminazione: `DELETE …?versione=N`.
- Azioni di stato: `POST /…/<azione>` con `{ versione }`.
- Risposte di scrittura: il record aggiornato (con la nuova `versione`) e l'intestazione
  `X-Revisione` (§12.6).
- Errori: `{ "errore": { "codice": "…", "messaggio": "testo italiano", "dettagli": … } }`.

| Stato | Codice | Quando |
|---|---|---|
| 400 | `richiesta_non_valida` | Corpo o parametri non conformi al contratto (dettagli per campo) |
| 403 | `origine_non_ammessa` | Scrittura senza `Origin` ammessa (§12.7) |
| 404 | `non_trovato` | Risorsa assente |
| 409 | `conflitto_versione` | Versione diversa da quella attuale; `dettagli.attuale` contiene il record aggiornato |
| 409 | `id_esistente` | Creazione con id già usato per un altro contenuto |
| 415 | `tipo_non_supportato` | Scrittura senza `Content-Type: application/json` |
| 422 | `regola_violata` | Regola di dominio (es. `evento_archiviato`, `portata_non_vuota`, `sinonimo_duplicato`); `dettagli.regola` la identifica |
| 503 | `servizio_non_pronto` | Avvio o manutenzione (migrazioni, ripristino) in corso |

**Risorse** (in grassetto le rotte implementate in M0)

| Metodo e percorso | Scopo | Milestone |
|---|---|---|
| **`GET /api/v1/salute`** | `{ ok, versioneApp, versioneSchema, rilascio, revisione }` | M0 |
| **`GET /api/v1/revisione`** | `{ revisione }` (interrogazione leggera, §12.6) | M0 |
| **`GET /api/v1/impostazioni`** · **`PUT`** | coefficiente bambini e portate predefinite | M0 (API), M1 (interfaccia) |
| **`GET /api/v1/reparti`** | elenco ordinato | M0 |
| `POST /api/v1/reparti` · `PUT /…/:id` · `DELETE /…/:id` · `PUT /api/v1/reparti/ordine` | gestione reparti | M2 |
| `GET /api/v1/eventi?stato=` · `POST /api/v1/eventi` | elenco e creazione (con portate copiate dalle predefinite) | M1 |
| `GET /api/v1/eventi/:id` · `PUT` · `DELETE` | evento con portate | M1 |
| `POST /api/v1/eventi/:id/concludi` · `/riapri` · `/archivia` | stati (§7.3–7.4) | M1 / M4 |
| `POST /api/v1/eventi/:id/portate` · `PUT /api/v1/portate/:id` · `DELETE` · `PUT /api/v1/eventi/:id/portate/ordine` | portate dell'evento | M1 |
| `GET /api/v1/eventi/:id/menu` | portate con voci ordinate | M1 |
| `GET /api/v1/eventi/:id/stampa` · `PUT` | stile del menù stampato `{ opzioni, versione }` (0 = mai salvato); archiviato: dallo snapshot, `PUT` → 422 | 2.5 |
| `POST /api/v1/eventi/:id/voci` (una o più, inserimento multiriga) · `PUT /api/v1/voci/:id` · `DELETE` | voci di menù | M1 |
| `PUT /api/v1/eventi/:id/voci/ordine` | `{ portataId, voci: [{ id, versione }] }` — riordino e spostamento | M1 |
| `POST /api/v1/voci/:id/crea-piatto` | crea il piatto e collega la voce in una transazione | M2 |
| `GET /api/v1/piatti?q=` · `POST` · `GET /api/v1/piatti/:id` · `PUT` · `DELETE` | piatto con ingredienti come unico aggregato | M2 |
| `GET /api/v1/ingredienti` · `POST` · `PUT /api/v1/ingredienti/:id` · `DELETE` | catalogo con sinonimi | M2 |
| `GET /api/v1/eventi/:id/spesa` | lista calcolata e riconciliata dal server, sezioni, avvisi | M3 |
| `PUT /api/v1/eventi/:id/spesa/righe/:chiave` | stato, quantità utente, reparto, nascosto, inclusa, nota (`versione` 0 se la riga non ha ancora un record) | M3 |
| `DELETE /api/v1/eventi/:id/spesa/righe/:chiave` · `POST /…/spesa/ripulisci` · `POST /…/spesa/trasferisci` | casi R5, R6, R10 | M3 |
| `POST /api/v1/eventi/:id/spesa/manuali` · `PUT /api/v1/spesa/manuali/:id` · `DELETE` | articoli manuali | M3 |
| `GET /api/v1/eventi/:id/attivita` · `POST` · `PUT /api/v1/attivita/:id` · `DELETE` · `POST /api/v1/eventi/:id/attivita/sposta` | piano | M4 |
| `GET /api/v1/eventi/:id/snapshot` · `GET /api/v1/snapshot/:id` · `POST /api/v1/snapshot/:id/copia-piatto` | storico archiviato | M4 |
| **`GET /api/v1/backup`** · **`POST /api/v1/backup`** · **`GET /api/v1/backup/:nome`** | elenco, backup ora, scaricamento `.db` | M0 |
| **`GET /api/v1/esportazione`** | esportazione JSON (§11.3) | M0 |
| **`POST /api/v1/ripristino/verifica`** · **`POST /api/v1/ripristino/esegui`** | ripristino in due passi (§11.4) | M0 |

Il parser degli ingredienti gira nel client (anteprima immediata); il server riceve le
righe già analizzate e confermate e ne valida la forma. La spesa invece è calcolata **solo
dal server**, che è l'unico a vedere sempre tutti i dati aggiornati.

### 12.5 Concorrenza fra dispositivi

**Controllo ottimistico per aggregato.** Ogni aggregato ha una `versione`:

| Aggregato | Contiene |
|---|---|
| Impostazioni | coefficiente, portate predefinite |
| Reparto | singolo reparto |
| Evento | dati dell'evento e sue portate (nomi e ordine) |
| Voce di menù | singola voce |
| Piatto | piatto con tutti i suoi ingredienti |
| Ingrediente | ingrediente con sinonimi |
| Articolo di spesa | singola riga (calcolata o manuale) |
| Attività | singola attività |

- Scrittura: `UPDATE … SET …, versione = versione + 1 WHERE id = ? AND versione = ?`
  dentro `BEGIN IMMEDIATE` (le transazioni di scrittura sono serializzate da SQLite).
  `changes = 0` → se il record esiste: `409 conflitto_versione` con il record attuale;
  altrimenti `404`.
- Riordino di più record (`…/ordine`): il client invia `{ id, versione }` di ogni record;
  se anche uno solo non coincide, nessuna modifica e `409` con lo stato attuale.
- Operazioni che toccano più aggregati (es. «crea nel ricettario», archiviazione,
  ripristino) avvengono in un'unica transazione e controllano le versioni di tutti gli
  aggregati che modificano.
- La granularità è scelta perché i casi comuni non entrino in conflitto: spuntare la
  spesa dal telefono mentre si modifica il menù dal PC tocca aggregati diversi.

**Gestione nel client.** Componente unico `ConflittoVersione`: mostra «Modificato da un
altro dispositivo», il valore attuale accanto a quello che si stava salvando e due
scelte: *Ricarica* (scarta la propria modifica, che resta visibile per copiarla) e
*Sovrascrivi* (ripete il salvataggio con la nuova versione: scelta esplicita, mai
automatica). Le eliminazioni in conflitto propongono solo *Ricarica*.

**Ripetizioni sicure.** Creazioni con id del client (idempotenti); le modifiche, se la
risposta si perde, al nuovo tentativo ricevono 409 con il record già aggiornato: il
client confronta e, se coincide con quanto voleva salvare, lo considera riuscito senza
mostrare il conflitto.

### 12.6 Aggiornamento delle viste fra dispositivi

- `meta.revisione` è un contatore globale incrementato da ogni transazione di scrittura.
- Il client interroga `GET /api/v1/revisione` ogni 10 s mentre l'app è visibile (e
  subito al ritorno in primo piano); se la revisione è cambiata, invalida le query di
  TanStack Query, che ricaricano solo le viste aperte. Costo trascurabile: una lettura di
  una riga.
- Dopo una propria scrittura il client aggiorna la revisione nota dall'intestazione
  `X-Revisione`, per non ricaricare inutilmente.
- In tempo reale (SSE/WebSocket): rinviato; l'interfaccia del client non cambia.

### 12.7 Sicurezza

- Nessun login: l'accesso è deciso da Tailscale (§14.5). Il backend ascolta solo su
  `127.0.0.1`.
- Protezione dalle richieste da altri siti (un sito qualsiasi aperto nel browser di un
  dispositivo del tailnet potrebbe tentare di chiamare l'API): ogni scrittura richiede
  `Content-Type: application/json` (che obbliga il browser a una richiesta preliminare
  CORS, mai autorizzata) **e** un'intestazione `Origin` uguale all'origine di produzione
  o di sviluppo configurata; altrimenti 403/415. Nessuna intestazione CORS permissiva.
- Limiti: corpo delle richieste 1 MB (50 MB solo per `ripristino/verifica`), file
  serviti solo dalla cartella del rilascio, nomi dei backup validati con un'espressione
  regolare (niente percorsi arbitrari).

## 13. PWA e connessione al server

- `vite-plugin-pwa` (`generateSW`, **`registerType: 'prompt'`**): in cache solo il guscio
  dell'app (HTML, JS, CSS, icone, font). **Nessun dato** in cache: le chiamate `/api/*`
  sono escluse dal service worker (`NetworkOnly`, nessun fallback).
- Avviso «Nuova versione disponibile — Aggiorna», mai ricaricamento automatico; se c'è un
  modulo non salvato chiede conferma. Controllo all'avvio, al ritorno in primo piano e
  ogni ora, solo con server raggiungibile.
- Compatibilità client/server: `GET /salute` restituisce la versione dell'app servita; se
  il client in esecuzione è più vecchio, l'avviso di aggiornamento diventa insistente e le
  scritture restano possibili solo se la versione dell'API (`/api/v1`) coincide.
- **Stato della connessione** (`src/connessione/`): `connesso` | `non_raggiungibile` |
  `in_manutenzione`. Determinato da `navigator.onLine`, dall'interrogazione della revisione
  (§12.6) e dall'esito delle chiamate (errore di rete o 503). Due fallimenti consecutivi →
  `non_raggiungibile`; il primo successo → `connesso` e ricarica dei dati.
- In `non_raggiungibile`: banner fisso, tutti i comandi di scrittura disattivati tramite un
  unico hook (`usaPuoScrivere()`), nessuna scrittura messa in coda; i dati già caricati
  restano visibili; i moduli aperti conservano il testo (bozza in `sessionStorage`).
- Avvio senza server: il guscio si apre dalla cache e mostra «Server non raggiungibile:
  verifica che Tailscale sia attivo» con *Riprova*.
- Manifest: `name` «Ricette di famiglia & Co.» e `short_name` «Ricette & Co.» (§20), `id`, `scope` e `start_url` uguali a `/`,
  `lang: 'it'`, `display: 'standalone'`, icone 64/192/512 + maskable, `shortcuts` (M4).
- Installazione: Chrome su Android, PC e tablet nel tailnet → `https://loris-srv01.dala-tortoise.ts.net:9870/`
  → *Installa app*.
- Unico dato locale del dispositivo: la preferenza del tema (`localStorage`) e le spunte
  temporanee della vista cucina (`sessionStorage`).

## 14. Hosting e rilascio

Tutto sul server Debian `loris-srv01`, in `/srv/apps/menuapp`, come le altre applicazioni.
Nessun servizio cloud; GitHub è solo il repository del codice.

### 14.1 Architettura di produzione

```
 PC / telefono / tablet (tailnet)
 Chrome ── HTTPS (certificato Tailscale) ──▶ tailscaled 100.114.50.37:9870   (tailscale serve)
                                                   │ HTTP, solo loopback
                                                   ▼
                    menuapp.service: node rilasci/attuale/server/main.ts   127.0.0.1:9870
                       ├── /api/v1/*  → Fastify: servizi → SQLite  dati/menuapp.db (WAL)
                       └── /*         → @fastify/static: rilasci/attuale/dist/
 menuapp-backup.timer (03:45) ──▶ server/backup/cli.ts ──▶ dati/backup/
```

- **Un solo processo** serve frontend e backend: stessa origine, nessun CORS, un solo
  servizio da gestire.
- **HTTPS**: `tailscale serve --bg --https=9870 http://127.0.0.1:9870`; tailscaled
  ascolta sull'indirizzo del tailnet, il backend su loopback (coesistenza sulla stessa
  porta verificata). Certificato rinnovato da Tailscale. **Mai `tailscale funnel`.**
- **Apache** (porta 80) non viene usato né modificato.
- Intestazioni dei file statici: `index.html`, `sw.js`, `registerSW.js`,
  `manifest.webmanifest`, `workbox-*.js` → `no-cache`; `assets/*` →
  `public, max-age=31536000, immutable`; sicurezza: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`,
  `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:;
  style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'`.

### 14.2 Configurazione del backend

Variabili d'ambiente validate all'avvio (`server/config.ts`):

| Variabile | Produzione | Sviluppo |
|---|---|---|
| `MENUAPP_HOST` | `127.0.0.1` | `127.0.0.1` |
| `MENUAPP_PORTA` | `9870` | `9871` |
| `MENUAPP_DATI` | `/srv/apps/menuapp/dati` | `/srv/apps/menuapp/dati-sviluppo` |
| `MENUAPP_STATICI` | `/srv/apps/menuapp/rilasci/attuale/dist` | (non servito: ci pensa Vite) |
| `MENUAPP_ORIGINI` | `https://loris-srv01.dala-tortoise.ts.net:9870` | `http://localhost:5173`, `https://loris-srv01.dala-tortoise.ts.net:8443` |

Avvio: configurazione → apertura DB → migrazioni (§6.5) → seed → ascolto. Arresto
ordinato su `SIGTERM`: smette di accettare richieste, attende quelle in corso (max 5 s),
esegue `PRAGMA wal_checkpoint(TRUNCATE)` e chiude il database.

### 14.3 Servizi systemd

Servizi **utente** come `dailymeals.service` e `kidscalendar.service` (*linger* attivo per
`loris`: partono all'avvio del server). Installati da `scripts/installa-servizio.sh`, che
crea **solo** file con prefisso `menuapp` in `~/.config/systemd/user/` e non tocca altre
unità.

`menuapp.service`:

```ini
[Unit]
Description=Menù & Co. (frontend e API)
Documentation=file:///srv/apps/menuapp/docs/SPEC.md
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
WorkingDirectory=/srv/apps/menuapp
Environment=NODE_ENV=production
Environment=MENUAPP_HOST=127.0.0.1
Environment=MENUAPP_PORTA=9870
Environment=MENUAPP_DATI=/srv/apps/menuapp/dati
Environment=MENUAPP_STATICI=/srv/apps/menuapp/rilasci/attuale/dist
Environment=MENUAPP_ORIGINI=https://loris-srv01.dala-tortoise.ts.net:9870
ExecStart=/home/loris/.nvm/versions/node/v24.18.0/bin/node /srv/apps/menuapp/rilasci/attuale/server/main.ts
Restart=on-failure
RestartSec=3
RestartPreventExitStatus=78
TimeoutStopSec=15
NoNewPrivileges=yes
PrivateTmp=yes

[Install]
WantedBy=default.target
```

`menuapp-backup.service` (`Type=oneshot`, stesso Node, `ExecStart=… server/backup/cli.ts
giornaliero`) e `menuapp-backup.timer` (`OnCalendar=*-*-* 03:45:00`, `Persistent=true`:
se il server era spento, il backup parte al riavvio).

Il percorso di Node è fissato come negli altri servizi; un cambio di versione via nvm
richiede di rieseguire `installa-servizio.sh`.

### 14.4 Rilasci

- Un rilascio contiene codice del server, dominio, contratto, dipendenze di produzione e
  frontend compilato: `rilasci/<AAAAMMGG-HHmm>-<hash>/` con `server/`, `src/domain/`,
  `src/contratto/`, `package.json`, `node_modules/` (`npm ci --omit=dev`), `dist/` e
  `rilascio.json`. La cartella `dati/` **non** fa parte dei rilasci.
- `scripts/rilascia.sh`:
  1. verifica: albero Git pulito, ramo `main`, `npm run check` verde;
  2. `git archive` del commit in una cartella temporanea, `npm ci --omit=dev`,
     `vite build`, spostamento in `rilasci/<id>/`;
  3. prova del rilascio su una **copia** del database di produzione: avvio temporaneo
     su `127.0.0.1:9872` con `MENUAPP_DATI` su una cartella di prova, migrazioni,
     `/salute`, arresto;
  4. backup manuale del database di produzione;
  5. cambio atomico del collegamento `attuale` (`ln -sfn` + `mv -T`) e
     `systemctl --user restart menuapp` (interruzione di circa un secondo; all'avvio il
     nuovo codice applica le migrazioni con backup pre-migrazione);
  6. controlli: `/api/v1/salute` su loopback e via HTTPS Tailscale (rilascio atteso,
     certificato valido), `no-cache` su `sw.js`, porta 9870 assente dagli indirizzi LAN;
     se falliscono → ritorno automatico al rilascio precedente, se lo schema non è
     cambiato;
  7. conserva gli ultimi 5 rilasci.
- `scripts/ripristina-rilascio.sh <id>`: solo verso un rilascio con la stessa versione
  dello schema; altrimenti indica la procedura con il backup pre-migrazione (§11.5).
- Ogni rilascio richiede l'autorizzazione di Loris; tag Git locali, pubblicati su GitHub
  solo se autorizzato.

### 14.5 Accesso e autorizzazioni (Tailscale)

> Superato dalla §19 (multiutente con accesso su invito): resta valido per la rete del server.

- La porta 9870 esiste solo dentro il tailnet (`tailscale serve`); il backend ascolta su
  loopback; il server non ha firewall ma nulla di Menù & Co. ascolta sugli indirizzi LAN.
- Chi accede è deciso nella policy del tailnet (console di amministrazione, *Access
  controls*), che filtra il traffico prima di `tailscale serve`. Oggi: un solo utente,
  policy predefinita «consenti tutto» fra i suoi dispositivi.
- Regola da aggiungere quando si vuole limitare per dispositivo o aprire ad altre
  persone:

  ```jsonc
  {
    "groups": { "group:menuapp": ["loris.carzaniga@gmail.com"] },
    "hosts":  { "loris-srv01": "100.114.50.37" },
    "grants": [
      { "src": ["group:menuapp"], "dst": ["loris-srv01"], "ip": ["tcp:9870"] }
    ]
  }
  ```

  Per un familiare: invito nel tailnet o condivisione del solo nodo `loris-srv01`, più
  la sua email nel gruppo. Senza login applicativo, chi raggiunge la porta può leggere e
  modificare tutto: la policy Tailscale è l'unico controllo d'accesso.
- **Attenzione**: sostituire la policy «consenti tutto» blocca ogni accesso non elencato,
  anche agli altri servizi del server (SSH 22, RDP 3389/3390, dailyMeals 9876,
  sharedKidsCalendar 9878, Samba, open-webui 3000, lobe-chat 3210, sviluppo 8443). La
  modifica la fa Loris nella console, con le regole esistenti riportate esplicitamente.

### 14.6 Sviluppo e collaudo

- Sessione tmux `menuapp`: finestra `server` (`node --watch server/main.ts` su
  `127.0.0.1:9871`, database in `dati-sviluppo/`) e finestra `dev` (Vite su
  `127.0.0.1:5173` con proxy `/api` → `127.0.0.1:9871`).
- PC: `https://loris-srv01.dala-tortoise.ts.net:8443/` oppure tunnel SSH su 5173.
- Android/tablet: `tailscale serve --https=8443` → 5173 (già attivo).
- Collaudo prima del rilascio: avvio del rilascio candidato su `127.0.0.1:9872` con una
  **copia** del database di produzione, esposto temporaneamente con
  `tailscale serve --bg --https=8444 http://127.0.0.1:9872`, poi chiuso.
- Test e2e: backend + frontend compilato su `127.0.0.1:4174`, database temporaneo per
  ogni esecuzione (§17.4).
- I dati di sviluppo, collaudo e test non toccano mai `dati/`.

### 14.7 Git e GitHub

- GitHub (`lcarzaniga/Menuapp`) è solo il repository del codice: nessun push, merge o
  tag pubblicato senza autorizzazione esplicita.
- `main` sempre rilasciabile; un branch per milestone; commit piccoli in italiano; merge
  su `main` solo con `npm run check` verde e approvazione di Loris.
- GitHub Pages dismesso: in M0 si eliminano `deploy.yml` e `base: '/Menuapp/'`;
  `ci.yml` esegue solo controlli (lint, tipi, test unitari, di database e di API, build).
  La disattivazione di Pages nelle impostazioni del repository è un'azione di Loris.

## 15. Roadmap

| Milestone | Date | Contenuto | Uscita |
|---|---|---|---|
| **M0 — Fondamenta** | 13–19 nov | Toolchain client/server, SQLite con schema completo, migrazioni e vincoli, backend Fastify con contratto, concorrenza e revisione, backup automatici/manuali, esportazione e ripristino, frontend base con stato della connessione e sola lettura, PWA, servizi systemd e `tailscale serve`, rilasci, test a tutti i livelli | `v0.1.0` |
| **M1 — Eventi e menù** | 20–25 nov | Eventi (CRUD, stati senza archiviazione), coperti, portate per evento, voci di menù, inserimento rapido multiriga, riordino e spostamento; impostazioni modificabili (portate predefinite, coefficiente, tema del dispositivo) | `v0.2.0` |
| **M2 — Ricettario** | 26 nov – 2 dic | Unità, catalogo di 200–250 ingredienti con seed idempotente, parser, piatti, ingredienti con anteprima e conferma, porzioni e scalatura, «Crea nel ricettario», vista cucina, gestione dei reparti | `v0.3.0` |
| **M3 — Spesa** | 3–8 dic | Calcolo e riconciliazione sul server, stati e fabbisogno coperto, correzioni, facoltativi, manuali, reparti, condivisione | `v0.4.0` |
| **M4 — Piano e stampa** | 9–12 dic | Attività e checklist, archiviazione con snapshot, consultazione da snapshot, «Copia nel ricettario», riapertura, stampa del menù, collaudo completo | `v0.5.0` |
| **Collaudo reale** | 13–15 dic | Menù di Natale vero inserito da telefono e PC, backup, correzioni | `v1.0.0` (15 dic) |

M0 si allunga di due giorni rispetto alla v1.2 (backend, database e servizi); i giorni
sono recuperati comprimendo M1 e M2 di un giorno ciascuno. Tagli previsti in caso di
ritardo, in quest'ordine: trascinamento (restano Su/Giù) → formato A5 → Wake Lock →
suggerimenti R10 → scorciatoie del manifest → promemoria dell'esportazione.

## 16. Criteri di accettazione

### Generali (v1.0)
- G1 Tutti i flussi F1–F12 eseguibili su Chrome Android installato come PWA, su PC e
  tablet.
- G2 **Dati condivisi**: una modifica fatta da un dispositivo è visibile sugli altri
  entro 15 secondi senza azioni dell'utente.
- G3 **Nessuna perdita silenziosa**: due salvataggi concorrenti sullo stesso aggregato
  producono sempre un 409 e la finestra di conflitto; nessun salvataggio sovrascrive
  senza scelta esplicita.
- G4 **Sola lettura senza server**: con server o Tailscale non raggiungibili, nessun
  comando di scrittura è attivo e il messaggio è chiaro; al ritorno della connessione i
  dati si ricaricano da soli.
- G5 **Backup**: backup giornaliero automatico verificato presente ogni giorno; backup
  pre-migrazione e pre-ripristino sempre creati; esportazione JSON → ripristino riproduce
  dati identici (stessa impronta); un ripristino fallito non modifica nulla.
- G6 `npm run check` (lint, tipi, test di dominio, database, API, componenti, build) verde;
  e2e verdi.
- G7 **Rete**: `127.0.0.1:9870` non raggiungibile dalla LAN; nessun `funnel`; il servizio
  riparte da solo dopo un errore e dopo il riavvio del server; gli altri servizi del
  server non sono stati modificati.
- G8 Usabile a 360 px di larghezza, in tema chiaro e scuro.

### Per area
- **Menù**: aggiungere 10 voci in 4 portate richiede meno di 60 s; nessun piatto creato
  senza azione esplicita (verificato da test).
- **Porzioni**: con 8 adulti, 4 bambini e coefficiente 0,5 una voce senza porzioni ha 10
  porzioni; cambiando i bambini a 6 diventa 11; una voce con 6 porzioni resta 6.
- **Parser**: criteri di §8.4; il testo originale è sempre visibile e conservato.
- **Spesa**: tutti i casi R1–R10 e le sei classi di contributo di §10.1 coperti da test;
  nessun contributo incerto, senza quantità o di un piatto senza porzioni base entra in un
  totale; nessun testo attribuisce all'utente quantità possedute o acquistate; scenario
  e2e su due dispositivi: «dal telefono segno comprato il burro; dal PC aumento i coperti;
  il telefono mostra *Da integrare* con il fabbisogno in più; dal PC tolgo il piatto, il
  burro compare in *Non più necessari*».
- **Snapshot**: dopo l'archiviazione, modificare o eliminare un piatto, una voce o
  un'attività non cambia ciò che l'evento archiviato mostra; la riapertura non modifica
  alcun piatto.
- **Database**: ogni vincolo di §6.3–6.4 ha un test che ne prova la violazione su SQLite
  reale.
- **Stampa**: menù di Natale su una pagina A4 senza tagli, leggibile in bianco e nero.

## 17. Test automatici e manuali

### 17.1 Dominio (Vitest, progetto `dominio`, Node)
Porzioni, unità (conversioni consentite e vietate), parser (≥ 100 casi, §8.4), spesa
(classificazione dei contributi, chiavi, R1–R10, idempotenza, somme), snapshot (contenuto
completo e autonomo), regole di stato dell'evento, serializzazione canonica e impronta.

### 17.2 Database (Vitest, progetto `server`, SQLite reale)
Ogni test usa un file SQLite nuovo in una cartella temporanea (non un database in
memoria, per provare WAL, backup e file reali).
- Migrazioni: database vuoto → ultima versione; da ogni versione precedente con dati di
  prova (`test/fixture/db-vN.db`) → ultima, con dati intatti; file di migrazione
  modificato → avvio bloccato; database più recente del codice → codice 78.
- Vincoli: ogni `CHECK`, FK, unicità e azione `ON DELETE` di §6.3–6.4 violato o
  esercitato almeno una volta.
- Repository e servizi: aggiornamento con versione corretta / errata, riordino con una
  versione errata (nessuna modifica), transazioni multi-aggregato annullate per intero,
  seed idempotenti, incremento della revisione.
- Backup: creazione con scritture concorrenti in corso, verifica di integrità, rotazione,
  file corrotto scartato; ripristino da `.db` e da JSON; ripristino che fallisce a metà
  lascia i dati invariati; backup pre-ripristino obbligatorio.

### 17.3 API (Vitest, progetto `server`, `app.inject()` su SQLite reale)
Per ogni rotta: risposta corretta, 400 con dettagli, 404, 409 con `dettagli.attuale`, 422
con la regola, 403 senza `Origin` ammessa, 415 senza JSON. Conformità delle risposte agli
schemi del contratto (validate nei test). Scenario di concorrenza: due client leggono la
stessa versione, il primo salva, il secondo riceve 409; creazione ripetuta con lo stesso
id → 200.

### 17.4 Frontend (Vitest, progetto `ui`, happy-dom)
Client API con `fetch` simulato: mappatura degli errori, intestazione `X-Revisione`.
Componenti: `ConflittoVersione`, banner di connessione e disattivazione dei comandi con
`usaPuoScrivere()`, moduli che conservano la bozza.

### 17.5 End-to-end (Playwright, Chrome di sistema)
Server reale (backend + frontend compilato) su `127.0.0.1:4174` con database temporaneo;
progetti *Pixel 7* e *Desktop*.
- Due contesti del browser come due dispositivi: una modifica dell'uno appare nell'altro
  entro 15 s; modifica concorrente dello stesso elemento → finestra di conflitto.
- Server arrestato durante l'uso → banner e comandi disattivati; riavviato → dati
  ricaricati.
- Backup ora, esportazione, ripristino da JSON e da backup del server.
- Service worker: guscio servito dalla cache; nessuna chiamata `/api` servita dalla
  cache; avviso di aggiornamento con due build consecutive.
- Dalle milestone successive: flussi F2–F9 e lo scenario spesa a due dispositivi.

### 17.6 Operativi (sul server, a ogni installazione o rilascio)
`rilascia.sh` (controlli automatici di §14.4); `systemctl --user kill menuapp` → riavvio
entro pochi secondi; avvio con migrazione fallita simulata (su copia) → codice 78 senza
riavvii in ciclo; `systemctl --user start menuapp-backup` → backup verificato; `ss -tln`
→ 9870 solo su loopback e indirizzo Tailscale; stato invariato di `dailymeals`,
`kidscalendar`, `apache2` e della regola `tailscale serve :8443`.

### 17.7 Manuali (a fine milestone, `docs/collaudo/Mn.md`)
Installazione su S23, tablet e PC · uso contemporaneo da due dispositivi · Tailscale
spento (sola lettura e messaggio) · avviso di aggiornamento dopo un rilascio · backup,
esportazione su un altro dispositivo e ripristino · condivisione spesa su WhatsApp/Keep ·
schermo acceso in vista cucina · stampa/Salva PDF · tema scuro · riavvio del server.

## 18. Rischi tecnici

| Rischio | Prob. | Impatto | Mitigazione |
|---|---|---|---|
| Rottura del disco del server (database e backup sullo stesso NVMe) | Bassa | Alto | Esportazione JSON periodica su un altro dispositivo con promemoria; copia su secondo supporto da decidere (§11.6) |
| Migrazione errata in produzione | Bassa | Alto | Prova su copia del database in `rilascia.sh`, backup pre-migrazione verificato, migrazioni transazionali, codice 78 senza riavvii in ciclo, test da ogni versione precedente |
| Conflitti frequenti che infastidiscono | Bassa | Medio | Aggregati piccoli (§12.5), aggiornamento delle viste ogni 10 s, conflitti solo sullo stesso elemento |
| Modifiche perse per connessione caduta durante la compilazione | Media | Medio | Bozze in `sessionStorage`, comandi disattivati con messaggio, ripetizioni idempotenti |
| Server o Tailscale non disponibili il giorno di Natale | Bassa | Alto | Servizio con riavvio automatico e avvio al boot; uso in casa via Tailscale anche su LAN; stampa del menù, della spesa e delle ricette come riserva cartacea il giorno prima |
| `node:sqlite` cambia comportamento in un aggiornamento di Node | Bassa | Medio | Node fissato nel servizio e in `.nvmrc`; test di database a ogni aggiornamento; ripiego `better-sqlite3` isolato nei repository |
| TypeScript 7 incompatibile con qualche strumento | Media | Medio | Esecuzione del server senza compilazione (rimozione dei tipi di Node, indipendente da `tsc`); ripiego `typescript@~5.9` |
| Richieste da siti esterni aperti sul dispositivo (CSRF) | Bassa | Alto | Controllo di `Origin` e `Content-Type` su ogni scrittura (§12.7) |
| Nessun login: chiunque nel tailnet può modificare | Media | Medio | Policy Tailscale per porta (§14.5); tailnet oggi con un solo utente |
| Policy Tailscale troppo restrittiva blocca altri servizi | Media | Medio | Modifica di Loris con le regole esistenti elencate; proposta rivista prima |
| Client vecchio dopo un rilascio con API cambiate | Bassa | Medio | Versione dell'API nel percorso, avviso di aggiornamento insistente, scritture bloccate se l'API non coincide |
| Ritorno a un rilascio con schema più vecchio | Bassa | Medio | `ripristina-rilascio.sh` solo a parità di schema; altrimenti backup pre-migrazione |
| Scadenza del 15 dicembre con M0 più grande | Media | Alto | Backend e database prima dell'interfaccia; API delle milestone successive scritte solo quando servono; tagli ordinati (§15) |
| Aggiornamento di Node con nvm che rompe il servizio | Bassa | Medio | Percorso fissato, `installa-servizio.sh` da rieseguire, `Restart=on-failure`, log nel journal |
| Floating point nelle somme | Bassa | Basso | Somme in unità base, tolleranza nei confronti, arrotondamento solo in vista |

---

## 19. Multiutente e accesso su invito

Decisione di Loris (13/11/2026): Menù & Co. diventa multiutente per la famiglia, con
accesso da Internet tramite **Tailscale Funnel** senza installare Tailscale sui dispositivi
dei familiari. Restano PWA, Fastify, SQLite centrale; niente app native, niente database
locali, niente password, niente login Google. Dal 18/11/2026 anche il dominio proprio
`ricettedifamiglia.online` porta allo stesso ingresso pubblico (§19.5).

### 19.1 Utenti e sessioni

- Tabella `utenti` (id, nome unico, ruolo `amministratore|utente`, stato `attivo|sospeso`,
  versione). La migrazione `0005_utenti.sql` crea `utente-amministratore` («Loris») e gli
  assegna tutti gli eventi e i piatti esistenti (e quindi foto, spesa, piano, snapshot).
- Sessioni lato server (`sessioni`): cookie `__Host-menuapp-sessione` con token casuale da
  256 bit, `HttpOnly; Secure; SameSite=Lax; Path=/`, 180 giorni con scadenza scorrevole
  (rinnovo al più una volta l'ora). Sul server solo l'impronta SHA-256. Revocabili una per
  una (dall'utente per i suoi dispositivi, dall'amministratore per tutti); un utente sospeso
  perde subito tutte le sessioni, gli inviti e le richieste in corso.
- Una sessione è un browser autorizzato, non un'identità dell'hardware: chi copia il cookie
  di un dispositivo ne ha l'accesso finché la sessione non viene revocata.

### 19.2 Inviti e attivazione dei dispositivi

1. L'amministratore crea l'utente e un **invito monouso** (token da 256 bit, 24 ore, sul
   server solo l'impronta): link `<URL pubblico>/#/attiva/<token>` (il token sta nel
   frammento: non finisce nei log). Si copia o si manda con WhatsApp.
2. Il link apre la pagina di attivazione: il dispositivo chiede l'accesso con un nome. L'invito
   si **consuma** in quel momento e nasce una *richiesta di attivazione* legata al browser da un
   secondo segreto (cookie `__Host-menuapp-richiesta`, `SameSite=Strict`, 24 ore). Il
   dispositivo mostra un **codice di verifica** (es. `K7P-M2Q`).
3. L'amministratore (o l'utente stesso da un dispositivo già autorizzato) vede la richiesta con
   lo stesso codice, nome del dispositivo e browser, e la **approva** o la rifiuta.
4. Solo il browser che possiede il segreto di quella richiesta riceve la sessione (una volta);
   chi ha soltanto il link non ottiene nulla. Tentativi: al massimo 10 ogni 15 minuti per
   indirizzo e 60 l'ora in tutto (429).
- **Nuovo dispositivo**: «Il mio account → Collega un nuovo dispositivo» crea un invito per sé;
  si approva dal dispositivo già collegato (o lo approva l'amministratore).
- **Primo accesso e recupero dell'amministratore**: solo dalla console del server,
  `scripts/amministra.sh invito` (link) e `scripts/amministra.sh approva <codice>`. Nessuna
  credenziale predefinita, nessuna rotta pubblica di creazione dell'amministratore.

### 19.3 Eventi: proprietà e condivisione

- Ogni evento ha un `proprietario_id` ed è privato. Il proprietario lo condivide
  (`condivisioni_evento`) in **lettura** o **modifica** con utenti specifici, cambia il
  permesso, revoca; l'invitato può lasciare l'evento.
- Modifica: menù, portate, voci, spesa, piano, stile di stampa, «concludi»/«riapri» di un
  evento concluso. Solo il proprietario: condivisioni, eliminazione, archiviazione, riapertura
  di un archiviato, **trasferimento di proprietà** (il nuovo proprietario riceve copie delle
  ricette collegate; il vecchio resta con la modifica).
- Le modifiche si vedono agli altri con la revisione (§12.6, ogni 10 s). Conflitti: versioni e
  409 come prima, ma il record attuale torna solo a chi ha accesso.

### 19.4 Ricette: ricettario di famiglia, ricette private, copie

- Ogni piatto ha un proprietario e una **visibilità** (migrazione `0006_visibilita_piatti.sql`):
  `famiglia` (predefinita, anche per tutte le ricette esistenti) = visibile a tutti gli utenti
  in sola lettura; `privata` = solo il proprietario, più le persone con cui la condivide
  (`condivisioni_piatto`). Solo il proprietario modifica, elimina e cambia la visibilità
  («Rendi privata» / «Rendi visibile a tutti» nella scheda). Una ricetta collegata a un evento
  visibile è leggibile (con le foto) da chi vede l'evento, per cucinare quel menù.
- Il ricettario mostra le proprie ricette, quelle di famiglia degli altri («di Anna») e quelle
  private condivise; filtro «Solo le mie».
- Le ricette altrui si usano **per copia** («Copia nel mio ricettario»): ingredienti e foto
  duplicati (file nuovi), `origine_piatto_id` e `origine_autore` per ricordare la provenienza;
  la copia ha la visibilità dell'originale (la copia di una privata resta privata).
  Una voce di menù si collega solo a un piatto del proprietario dell'evento (verifica nel
  servizio e trigger nel database): se un invitato collega una sua ricetta, il proprietario
  dell'evento ne riceve una copia (riusata se esiste). Nessun collegamento vivo fra utenti:
  modifiche, eliminazioni e revoche dell'originale non toccano copie, spese ed eventi altrui.
- Catalogo ingredienti e reparti: comuni a tutti. Tutti leggono e aggiungono ingredienti;
  eliminazioni di ingredienti, reparti e impostazioni comuni (coefficiente bambini, portate
  proposte) solo all'amministratore. L'elenco degli usi di un ingrediente mostra i nomi solo
  delle proprie ricette (gli altri come numero).

### 19.5 Ingressi e superficie esposta

| Ingresso | Ascolto | Cosa offre |
|---|---|---|
| Privato (Tailscale Serve `:9870`) | 127.0.0.1:9870 | Tutto, comprese le funzioni di sistema per l'amministratore |
| Pubblico (Tailscale Funnel `:443` e dominio proprio `ricettedifamiglia.online`) | 127.0.0.1:9873 (`MENUAPP_PORTA_PUBBLICA`) | App e API utente; `/admin/*`, `/backup*`, `/esportazione`, `/ripristino/*`, `/foto/:id/file` **non esistono** (404 come una rotta sconosciuta), anche per l'amministratore |
| Rete di casa HTTP `:9880` | 0.0.0.0:9880 | Nessun dato (senza HTTPS il cookie Secure non esiste): API 403, pagine → reindirizzate all'indirizzo HTTPS configurato |

- Senza sessione rispondono solo `GET /salute` (sull'ingresso pubblico solo `{ok, versioneApi}`)
  e le rotte di attivazione; ogni altra rotta API risponde 401. I file statici (codice
  dell'app, font, icone) sono pubblici: non contengono dati. Le foto passano dalle API con
  controllo del permesso sulla ricetta.
- Sull'ingresso privato le richieste marcate dal Funnel (`Tailscale-Funnel-Request`) e quelle
  con un nome host che non è locale o del tailnet (`hostLocale`, es. il dominio pubblico portato
  per errore sulla 9870) sono rifiutate (403). Scritture: origine ammessa (URL privato, URL pubblico) e corpo JSON come prima
  (§12.7), più `SameSite` dei cookie.
- Configurazione in `dati/server.json` (stesse chiavi delle variabili d'ambiente, che hanno la
  precedenza): `MENUAPP_PORTA_PUBBLICA`, `MENUAPP_URL_PUBBLICO` (indirizzo principale, usato
  nei link d'invito), `MENUAPP_ALTRI_URL_PUBBLICI` (altri indirizzi HTTPS dello stesso ingresso,
  separati da virgole: origini ammesse per le scritture), `MENUAPP_URL_PRIVATO`. Nessun
  indirizzo scritto nel codice.
- **Due indirizzi pubblici** (6.4.2): il dominio `ricettedifamiglia.online` e il nome Funnel
  arrivano allo stesso ingresso pubblico e funzionano entrambi. I cookie `__Host-` valgono solo
  per il nome con cui sono stati creati: un dispositivo collegato da un indirizzo non è collegato
  sull'altro (serve un nuovo collegamento con invito e approvazione, come per un altro browser).
  Nessuna sessione condivisa fra domini, nessuna autenticazione aggiuntiva.
- Tutte le risposte hanno `X-Robots-Tag: noindex, nofollow`: l'app è privata.

### 19.6 Autorizzazione nel codice

- `server/servizi/permessi.ts` è l'unico punto delle regole: `richiediEvento`,
  `richiediVoce`/`Attivita`/`Articolo`/`Snapshot` (risalgono all'evento), `richiediPiatto`,
  `richiediFoto`, `richiediAmministratore`, `richiediSistema`. Ogni rotta chiama il controllo
  **prima** della validazione del corpo: chi non ha accesso riceve lo stesso 404 di un id
  inesistente; chi vede ma non può modificare riceve 403 con il motivo.
- Elenchi e ricerche (`/eventi`, `/piatti?q=`, usi degli ingredienti, «usato in») filtrano per
  utente. L'esportazione completa resta all'amministratore; ognuno ha «Esporta i miei dati»
  (`GET /account/esportazione`: i propri eventi e le proprie ricette con le foto).
- Test: `server/api/accesso.test.ts` (ogni rotta senza sessione → 401, inviti, approvazione,
  revoca, ingressi) e `server/api/autorizzazione.test.ts` (ogni rotta con id per proprietario,
  invitato in modifica, in lettura, utente senza accesso), e2e `test/e2e/multiutente.spec.ts`
  con due browser.
- Limiti noti: la revisione (§12.6) resta un contatore unico, quindi un utente sa *che* è
  cambiato qualcosa (non cosa) e ricarica le sue viste; il ripristino completo riporta indietro
  i dati di tutti e, se il file è precedente alla versione 5, scollega tutti i dispositivi
  (recupero con la console).

## 20. Spazio collaborativo della famiglia

Decisione di Loris (16/11/2026): l'app diventa anche uno spazio della famiglia legato a cucina,
menù ed eventi (non un social generico, non una chat). Nuovo nome «Ricette di famiglia & Co.»,
breve «Ricette & Co.» (manifest, titoli, testi); restano `menuapp` repository, cartelle,
database, servizi, URL e identificativi (l'`id` del manifest non cambia: le installazioni si
aggiornano da sole). Migrazione `0007_famiglia.sql`.

### 20.1 La Famiglia (famiglia allargata) e la sua bacheca

- **Una sola grande Famiglia**: persone di nuclei diversi (fratelli, sorelle, cognati, figli,
  altri parenti) nello stesso gruppo, senza sottogruppi né nuclei né gerarchie (precisazione di
  Loris del 16/11/2026). Tabelle `gruppi` e `membri_gruppo`: l'unico ruolo distinto,
  `amministratore`, serve solo a moderare la bacheca (fissare, eliminare messaggi altrui).
  La migrazione `0007` crea «Famiglia» con tutti gli utenti esistenti; un nuovo utente entra
  nella Famiglia di chi lo crea (casella predefinita), o resta fuori.
- **Dentro la Famiglia**: ricette di famiglia visibili a tutti i membri (salvo le private,
  §19.4), bacheca generale comune. **Gli eventi restano a condivisione selettiva**: chi organizza
  sceglie partecipanti e permessi (§19.3).
- **Più Famiglie indipendenti (apertura futura)**: il modello le ammette già, isolate fra loro:
  bacheca, ricettario di famiglia, notifiche e persone con cui condividere (`/persone`) sono
  limitati alla propria Famiglia; nuove condivisioni di eventi e ricette e passaggi di proprietà
  solo verso persone della stessa Famiglia (altrimenti «non trovato»). Le condivisioni già
  esistenti restano valide e modificabili. Oggi l'interfaccia mostra una Famiglia sola. Da
  rivedere prima di un'apertura pubblica: catalogo ingredienti e reparti, impostazioni comuni e
  ruolo di amministratore dell'app sono ancora unici per tutte le Famiglie.
- Bacheca del gruppo (`#/famiglia`): messaggi dal più recente, fissati in cima (li fissa chi
  amministra il gruppo), commenti, reazioni (👍 ❤️ 😄 😋 👏), fino a 4 foto, ricetta segnalata
  (mostrata solo a chi può leggerla, altrimenti «non disponibile» senza nome), sondaggi. Autore,
  data, «modificato»; modifica l'autore (con versione e 409), elimina l'autore o chi amministra.

### 20.2 Bacheca dell'evento

- Scheda «Bacheca» dell'evento; legge chi vede l'evento. Scrive chi **partecipa**: proprietario,
  invitati in modifica e invitati in lettura con `condivisioni_evento.partecipa = 1`
  (predefinito; il proprietario può toglierlo per persona). Fissano proprietario e
  collaboratori; elimina messaggi altrui il proprietario.
- Un unico modello: `messaggi` (gruppo **o** evento, vincolo nel database), `commenti`,
  `reazioni`, `allegati` (file in `dati/foto/`, stesso backup e recupero delle foto dei piatti).

### 20.3 Sondaggi

- Messaggio di tipo `sondaggio` (`sondaggi`, `opzioni_sondaggio`, `voti_sondaggio`): 2–12
  opzioni diverse, risposta singola o multipla, scadenza facoltativa (futura), risultati
  `sempre | dopo_voto | alla_chiusura`. Voti legati all'utente (non al dispositivo): un insieme
  di preferenze per utente, sostituito a ogni voto, ritirabile; nomi dei votanti visibili (nessun
  voto anonimo). Chiude l'autore o chi modera; chiuso o scaduto non accetta voti.

### 20.4 Proposte di piatti

- Messaggio di tipo `proposta` (solo bacheche di evento, `proposte`): nome, ricetta facoltativa
  (che il proponente può leggere), portata suggerita, descrizione, foto. Preferenze con le
  reazioni (👍) e commenti.
- Decide chi organizza (permesso di modifica): in valutazione, accettata, non accettata; la
  decisione non dipende dai voti. «Accetta e metti nel menù» crea la voce una volta sola (id
  derivato dalla proposta); la ricetta entra come copia indipendente nel ricettario del
  proprietario dell'evento (§19.4) con l'accesso del proponente; se non è più leggibile entra
  il solo nome. Il proponente riceve l'esito.

### 20.5 Chi porta cosa

- Scheda «Chi porta» dell'evento: piatti del menù e cose da portare (`cose_da_portare`: nome,
  quantità, note), stato da assegnare / assegnato / completato. Per i piatti la responsabilità
  resta «A cura di» della voce (`voci_menu.incaricato`), con in più `incaricato_id`,
  `incarico_completato`, `spesa_tolta_da_incarico`: nessun secondo sistema.
- Chi partecipa si offre e rinuncia; chi organizza assegna, libera e segna come fatto.
  Prese in carico condizionate alla versione: due persone non prendono la stessa cosa (409 con
  lo stato attuale). Evento archiviato: sola lettura.
- Spesa: chi prende un piatto può dire «porto tutto io» e la voce esce dalla spesa
  (`in_spesa = 0`, ricordato); alla rinuncia o al cambio di incaricato torna nella spesa **solo**
  se ne era uscita per quella presa in carico. Una modifica a mano di «A cura di» che non è più il
  nome dell'utente incaricato lo scollega.

### 20.6 Notifiche

- Centro notifiche interno (`#/notifiche`, campanella con contatore), nessun push/email:
  aggiornamento con la revisione (§12.6) e ogni minuto. Tipi: bacheca della famiglia, bacheca
  degli eventi, risposte (commenti ai propri messaggi o alle discussioni a cui si partecipa),
  sondaggi nuovi e chiusi, proposte, esito delle proprie proposte, incarichi (prese in carico,
  rinunce, assegnazioni), modifiche importanti al menù (piatti aggiunti o tolti, data e ora),
  condivisioni di eventi e ricette, nuove stelle ai piatti preparati.
- Mai per le proprie azioni; raggruppate per chiave (una notifica non letta con contatore);
  segna come letta, tutte lette; preferenze per tipo. In lettura i permessi si ricontrollano:
  le notifiche su eventi, gruppi, messaggi o ricette non più accessibili vengono cancellate e
  non compaiono; le lette più vecchie di 60 giorni si eliminano.

### 20.7 Valutazioni e «I più apprezzati»

- Dopo l'evento (concluso, archiviato o con la data arrivata) chi partecipa dà da 1 a 5 stelle
  a ogni piatto servito, nel Menù. Un voto per utente e voce, modificabile (`valutazioni`, chiave
  voce + utente). Nome, portata e ricetta d'origine fotografati al voto: restano dopo
  archiviazione, modifiche ed eliminazioni di ricetta e voce (si perdono solo eliminando l'evento).
- Classifica (`#/famiglia?scheda=apprezzati`) sugli eventi visibili all'utente: le preparazioni
  della stessa ricetta (copie comprese, tramite `origine_piatto_id`) si sommano; i piatti senza
  ricetta restano separati (niente fusione per nome). Ordine per media bayesiana
  (3 × 3 + somma) / (3 + n): un solo 5 (3,5) non supera molti 4; si mostrano comunque media
  vera, numero di voti e occasioni. Filtri per portata e anno. Collegamento alla ricetta solo
  se l'utente può leggerla.

### 20.8 Sicurezza e test

- Stesse regole di §19.6: controllo prima della validazione, 404 indistinguibili, funzioni
  `/admin/*` (anche i gruppi) solo dall'ingresso privato. Test: `server/api/famiglia.test.ts`,
  `server/api/incarichi.test.ts`, matrice di `autorizzazione.test.ts` estesa alla
  partecipazione, rotte nuove nel controllo «senza sessione → 401»; e2e
  `test/e2e/famiglia.spec.ts` con due browser.
- Limiti: niente tempo reale (si aggiorna con la revisione); la scadenza di un sondaggio non
  genera notifica; i messaggi non entrano in «Esporta i miei dati»; l'esportazione completa ZIP
  contiene le foto dei piatti, non gli allegati (che sono comunque nei backup).

## 21. Più Famiglie per persona

Decisione di Loris (16/11/2026): una persona ha un solo account e può far parte di più
Famiglie (la sua, quella del coniuge, quella di un figlio…), ognuna uno spazio distinto con
bacheca, eventi, ricette condivise, sondaggi e classifiche. Niente sottogruppi né gerarchie.
Il modello è pronto per un'apertura al pubblico (Famiglie isolate tra loro). Migrazione
`0008_famiglie.sql`. Sostituisce la «Famiglia unica» di §20.1 dove diverge.

### 21.1 Famiglie e appartenenza

- Molti-a-molti `membri_gruppo` (§20.1). Ruoli: **amministratore** (membri, inviti, nome) e
  **membro**. L'amministratore non vede per questo contenuti privati altrui; i permessi sugli
  eventi restano separati (§19.3).
- Chiunque crea una Famiglia (`POST /famiglie`) e ne diventa amministratore. Inviti ad aderire
  (`inviti_famiglia`): link `#/unisciti/<token>`, monouso, 7 giorni, sul server solo
  l'impronta; per chi ha già un account (l'account si crea con l'invito del dispositivo, §19.2:
  sono due inviti distinti). Anteprima e accettazione con il token nel corpo della richiesta.
- Uscita volontaria; rimozione da parte di un amministratore; nomina, revoca e passaggio
  dell'amministrazione in un colpo solo. Resta sempre almeno un amministratore; chi è l'unico
  membro non può uscire (la Famiglia sparirebbe con i suoi contenuti).

### 21.2 Famiglia attiva e selettore

- La Famiglia attiva è un filtro di navigazione ricordato sul dispositivo (`localStorage`), mai
  un'autorizzazione: ogni rotta verifica l'appartenenza (`?gruppo=`, `gruppoId` mai creduti
  sulla parola). Non è salvata nell'utente.
- Una Famiglia: nessun selettore, nessun passaggio in più. Due o più: selettore discreto
  (barra laterale su PC, in cima su telefono). Nessuna: schermata «Crea una Famiglia» o link
  d'invito; ricette ed eventi personali restano disponibili. Se la Famiglia scelta non è più
  valida (uscita, rimozione) si usa un'altra delle proprie, o la schermata iniziale.

### 21.3 Ricette

- Il ricettario personale non dipende dalla Famiglia attiva. Una ricetta è privata oppure
  visibile in **una** Famiglia dell'autore (`condivisioni_piatto_gruppo`, al massimo una riga
  dalla 6.1, §28); la vedono i membri di quella Famiglia **finché l'autore ne fa parte**. Le
  ricette nuove dall'app sono visibili nella Famiglia attiva (si possono rendere private); la
  scheda mostra «Condividi con… / Rendi privata» con una Famiglia e un elenco a scelta singola
  con più d'una. In un'altra Famiglia la ricetta si copia (§28). Le condivisioni con
  persone (§19.4) restano per le private.
- Copie (copia nel mio ricettario, inserimento in un evento altrui, passaggio di proprietà,
  copia da un evento archiviato): indipendenti e **private** finché l'autore della copia non le
  condivide. Menù, spesa, valutazioni e archivi non dipendono mai da ricette di altri.
- `piatti.visibilita` resta solo per compatibilità con il rilascio precedente.

### 21.4 Eventi

- Ogni evento ha una Famiglia (`eventi.gruppo_id`, scelta alla creazione: quella attiva,
  verificata; se l'autore ha una sola Famiglia è quella) o nessuna (evento personale).
  L'appartenenza alla Famiglia **non** dà accesso agli eventi: servono gli inviti individuali
  con i loro permessi. Si invitano (e si passa la proprietà a) persone della Famiglia
  dell'evento; le condivisioni già esistenti restano. Il proprietario può spostare l'evento in
  un'altra delle sue Famiglie.
- Elenco con la Famiglia attiva: i suoi eventi, quelli personali e quelli di Famiglie di cui
  l'utente non fa parte ma a cui è stato invitato.
- Migrazione: ogni evento esistente va alla Famiglia del proprietario se ne ha esattamente
  una (oggi tutti); altrimenti resta personale, da assegnare a mano.

### 21.5 Bacheche, notifiche, classifiche

- Bacheca, sondaggi e moderazione per Famiglia (§20.1–20.3); bacheche degli eventi per invito.
- Centro notifiche unico per l'account; con più Famiglie ogni notifica indica la Famiglia.
- «I più apprezzati» per Famiglia: solo gli eventi di quella Famiglia (fra quelli visibili).

### 21.6 Test

`server/api/famiglie.test.ts` (zero Famiglie, inviti ad aderire, uscita, rimozione, passaggio
dell'amministrazione, bacheche separate, ricette private/una/più Famiglie, eventi della
Famiglia, classifiche separate, rimozione dalla Famiglia attiva, migrazione 0008 da un
database v7) ed e2e `test/e2e/multi-famiglia.spec.ts` (una Famiglia senza selettore, due con
selettore e contenuti separati, persona senza Famiglie che entra con un invito).

## 22. Persone senza account negli incarichi

Richiesta di Loris (16/11/2026): affidare piatti e cose da portare anche a chi non usa l'app
(«Zio Marco porta 4 bottiglie di vino», «Nonna Maria porta il dolce»). Migrazione
`0009_persone_esterne.sql`.

- **Già presente prima**: «A cura di» (`voci_menu.incaricato`) è un testo libero, quindi un nome
  scritto a mano nel menù era già possibile; le cose da portare avevano una quantità solo
  testuale; nessun elenco dei partecipanti (i coperti sono i numeri adulti/bambini).
- **Rubrica per Famiglia** (`persone_esterne`): nome e nota; la gestiscono i membri della
  Famiglia (`#/famiglia?scheda=membri`, «Senza app»), nessun'altra Famiglia la vede. Niente
  doppioni: nome già in rubrica o di un membro della Famiglia → rifiutato. Sono solo nomi:
  nessun account, sessione, permesso o notifica.
- **Responsabile di un incarico**: un utente con l'app invitato all'evento, una persona della
  rubrica della Famiglia dell'evento o un nome libero (occasionale o salvato in rubrica). Un
  nome scritto che coincide con un invitato diventa quell'utente, con una persona della rubrica
  diventa quella; con un membro della Famiglia non invitato chiede di invitarlo. Al massimo un
  responsabile (`incaricato_id` o `incaricato_esterno_id`, vincolo nel database); il nome resta
  sempre in «A cura di», quindi menù, spesa e stampa non cambiano. Rinominare in rubrica
  aggiorna gli incarichi; togliere dalla rubrica lascia il nome scritto.
- Affidare spetta a chi organizza («Affida» / «Cambia»), con **nota** dell'incarico
  (`note_incarico` per i piatti) e, per un piatto, «lo porta già pronto: togli dalla spesa»
  (stesse regole di §20.5). Stato: chi organizza segna fatto / non ancora / libera anche per le
  persone senza app.
- **Quantità e unità** delle cose da portare (`quantita_numero`, `unita` libera: «4
  bottiglie»); per i piatti la quantità sono le porzioni della voce («per 10»). La vecchia
  quantità testuale resta e si mostra se manca quella strutturata.
- L'elenco dei partecipanti, proposto qui, è stato poi realizzato (§24, presenze solo manuali §29.2).
- Test: `server/api/esterni.test.ts`, e2e `test/e2e/esterni.spec.ts`.

## 23. Ricerca delle ricette per nome e ingredienti

Richiesta di Loris (16/11/2026). Prima: solo il nome, come sottostringa senza accenti, nel
ricettario e nella scelta di un piatto per il menù (inserimento rapido e «Collega»).

- Una sola funzione pura `cercaRicette` (`src/domain/ricerca.ts`) per ricettario, menù e
  `GET /piatti?q=`. Nessun motore esterno.
- Si cerca nel nome e negli **ingredienti**: nome scritto nella ricetta, nome del catalogo e
  **sinonimi** del catalogo (`ingredienti`, `sinonimi_ingrediente`), forniti nel riepilogo
  del piatto (`ingredienti: string[]`, senza doppioni per forma normalizzata).
- Senza maiuscole e accenti; più parole insieme; parole vuote ignorate («di», «al», «con»…).
  Negli ingredienti un termine vale all'inizio di parola o come singolare/plurale («uova» →
  «uovo»); nel nome anche come parte di parola (come prima).
- Ordine: 1) tutti i termini nel nome; 2) tutti i termini trovati, almeno uno fra gli
  ingredienti; 3) corrispondenze parziali. A parità: chi comincia con il testo, più termini,
  più termini nel nome, ordine alfabetico. Sotto il risultato «con …» dice cosa ha trovato.
- Il ricettario mostra i gruppi «Nel nome», «Negli ingredienti», «Corrispondenze parziali»;
  il filtro per portata vale anche con la ricerca; la rubrica alfabetica resta senza ricerca.
- Permessi: si cerca solo fra le ricette che l'utente può leggere (il server non manda le
  altre). La Famiglia attiva non filtra il ricettario (§21.3).
- Prestazioni: 73 ricette reali, elenco 5–9 ms, ricerca sotto 8 ms; 5000 ricette da 15
  ingredienti: prima ricerca ~0,4 s, poi ~16 ms; dal server con 2000 ricette ~150 ms.
- Test: `src/domain/ricerca.test.ts`, `server/api/ricerca.test.ts`, e2e `test/e2e/ricerca.spec.ts`.

## 24. Partecipanti, conferme e accompagnatori

Richiesta di Loris (16/11/2026, «Evoluzione organizzazione eventi», M1). Migrazione
`0010_partecipanti.sql`. Scheda «Partecipanti» dell'evento.

- **Facoltativo**: senza elenco l'evento funziona come prima (adulti e bambini scritti a mano).
  Gli eventi esistenti restano in manuale; nessun partecipante è creato dai numeri.
- **Partecipante** (`partecipanti`): nome visualizzato, adulto o bambino, stato (in attesa,
  confermato, non partecipa), note; collegamento facoltativo a un utente (membri della Famiglia
  dell'evento o persone dell'evento) o alla rubrica «Senza app». Un nome già noto diventa quella
  persona; la stessa persona (utente, rubrica o nome) compare una volta sola. Il collegamento
  non dà accesso all'evento né appartenenza alla Famiglia; l'accesso non implica la partecipazione.
- **Invito e accompagnatori (+N)**: il titolare (`invito_id` NULL) può avere accompagnatori
  nominativi (righe con `invito_id`, ciascuna con categoria e stato propri) e senza nome
  (quantità sul titolare per adulti/bambini e confermati/in attesa). Stati indipendenti: se il
  titolare non viene, i suoi accompagnatori restano come sono. «Invito a parte» rende autonomo
  un accompagnatore: è la stessa riga, quindi nessun doppio conteggio. Un solo livello (vincoli
  nel database); togliere un invito toglie i suoi accompagnatori nominativi.
- **Chi aggiorna le presenze** (rettifica del 17/11/2026, §29.2): solo chi può modificare
  l'evento (proprietario o permesso di modifica) inserisce partecipanti e accompagnatori e ne
  cambia gli stati, per tutti, anche per chi usa l'app. Nessuna risposta personale, link
  pubblico, email o SMS. `max_accompagnatori` resta nel database ma non ha più effetto.
- **Coperti** (`eventi.coperti_automatici`): «Coperti manuali» (predefinito) o «Calcolati dai
  partecipanti» (confermati, accompagnatori compresi; in attesa e assenti esclusi). Un'unica
  funzione (`copertiEffettivi`, `src/domain/partecipanti.ts`) decide adulti e bambini effettivi,
  applicata in `leggiEvento`: menù, porzioni, spesa, stampa, riepilogo e archivio leggono gli
  stessi numeri. I numeri manuali restano salvati (`copertiManuali`). Cambio esplicito con il
  confronto fra i due conteggi e la conferma se i coperti cambiano; tornando al manuale si
  propongono i calcolati. Porzioni personalizzate e quantità degli incarichi non cambiano.
- **Chi porta**: in «Affida» si può scegliere un partecipante (la sua persona collegata, o il
  nome se non vede l'evento). Se il responsabile non partecipa compare un avviso; l'incarico
  resta.
- **Archivio**: lo snapshot conserva modalità, conteggi, inviti, accompagnatori, stati e nomi;
  l'evento archiviato mostra l'elenco com'era (anche dopo cambi di rubrica). Esportazione e
  ripristino comprendono i partecipanti (titolari prima degli accompagnatori).
- Test: `src/domain/partecipanti.test.ts`, `server/api/partecipanti.test.ts`, e2e `partecipanti.spec.ts`.

## 25. Duplicazione degli eventi ed edizioni

M2. Migrazioni `0011_edizioni.sql` (`eventi.serie_id`) e `0012_origine_voci.sql`
(`voci_menu.voce_origine_id`). «Duplica evento» in Panoramica, anche da eventi archiviati.

- Si sceglie nome (l'anno nel nome segue la data), data, Famiglia (solo le proprie) e se copiare
  i partecipanti. Chi può leggere l'evento può duplicarlo: il nuovo evento è suo.
- Si copiano: portate, voci (nome, ricetta, porzioni personalizzate, note; tornano in spesa le
  voci uscite per un incarico), stile di stampa, note dell'evento, coperti effettivi come numeri
  manuali, limite degli accompagnatori, piano spostato sulla nuova data e tutto da fare.
- Non si copiano: conferme, incarichi e cose da portare, voti, sondaggi, bacheca, notifiche,
  stato della spesa, archiviazione, condivisioni.
- **Ricette** con le regole di sempre (§19.4, §21.3): del nuovo proprietario restano collegate,
  altrimenti una copia privata (riusata se esiste già). Ricetta non disponibile: voce senza
  ricetta con avviso. Da un archiviato, se la ricetta non esiste più, si ricrea dall'archivio
  come ricetta privata (avviso); l'archivio originale non cambia.
- **Partecipanti** (a richiesta): stessa composizione, tutti in attesa, accompagnatori senza
  nome in attesa; collegamenti alla rubrica solo se della Famiglia di destinazione.
- **Ricorrenza**: la copia riceve la ricorrenza dell'originale, cambiabile o da togliere (dalla
  6.1 le serie anonime della 0011 sono sostituite dalle ricorrenze della Famiglia, §28). Ogni
  voce copiata ricorda la voce d'origine (identità per §27).
- Test: `server/api/duplicazione.test.ts`, e2e `edizioni.spec.ts`.

## 26. Riepilogo «A che punto siamo?»

M3. In cima alla Panoramica; `GET /eventi/:id/riepilogo` aggrega dati esistenti in una sola
richiesta. Ogni indicatore apre la sua sezione; quelli delle funzioni non usate non compaiono.

- Sempre: coperti e modalità. Con l'elenco: confermati e in attesa. Ordine e «Tutto pronto»:
  §29.3.
- Menù: «Menù ancora vuoto» senza piatti e «Menù in preparazione» con portate ancora senza piatti
  (elencate, con il suggerimento di togliere quelle che non servono) sono cose da completare;
  «Menù completato» (con il numero di piatti) fra le cose a posto quando ogni portata dell'evento ha
  almeno un piatto. Nessun numero minimo di portate e nessun segno manuale: le portate dell'evento
  dicono cosa si vuole servire (§7.8).
- «Chi porta», solo se usato (un piatto affidato o una cosa da portare): cose da portare senza
  nessuno e incarichi di chi non partecipa (attenzione), incarichi da completare, piatti non
  affidati (solo informazione: li può preparare chi organizza).
- Piano (da fare, in ritardo), proposte da decidere, sondaggi aperti, spesa (da comprare, da
  verificare). Nessuna nuova scadenza o obbligo. Evento archiviato: niente cose da fare.
- Test: `server/api/riepilogo.test.ts`, `src/features/eventi/Riepilogo.test.tsx`, e2e `edizioni.spec.ts`.

## 27. Confronto fra edizioni

M4. «Confronta con l'anno scorso» (dal riquadro «Ricorrenza») apre `#/eventi/:id/confronto`:
propone l'evento precedente della stessa ricorrenza per data (anche non consecutivo, senza
segnalare le edizioni mancanti), oppure un evento della stessa Famiglia scelto a mano.

- Mostra coperti, persone e partecipanti delle due edizioni, portate nuove o tolte, piatti in
  entrambe (con le porzioni se cambiano), nuovi e non riproposti.
- **Identità**: la voce copiata da quella dell'altra edizione, oppure la stessa ricetta
  d'origine (copie comprese; per una ricetta eliminata quella registrata con i voti). Solo lo
  stesso nome, con almeno una voce senza ricetta: «stesso nome, ricetta non verificabile».
  Stesso nome ma ricette diverse: due piatti distinti, segnalati.
- **Valutazioni** delle preparazioni effettive di ciascuna edizione, mai trasferite.
- Eventi archiviati letti dall'archivio. Solo eventi visibili all'utente e della stessa
  Famiglia (404 / 422 altrimenti).
- Test: `src/domain/confronto.test.ts`, `server/api/confronto.test.ts`, e2e `edizioni.spec.ts`.

## 28. Ricorrenze e copia delle ricette fra Famiglie

Richiesta di Loris (16/11/2026). Migrazione `0013_ricorrenze.sql`.

### 28.1 Ricorrenze

- Ogni Famiglia ha un elenco di ricorrenze (`ricorrenze`: nome, descrizione facoltativa),
  gestito in Famiglia → Membri. Nessuna frequenza, data o generazione di eventi; nessun esempio
  precaricato. I membri le creano e le rinominano; eliminarle spetta a chi amministra la
  Famiglia. Nomi unici nella Famiglia (senza accenti né maiuscole).
- Un evento ha zero o una ricorrenza della propria Famiglia (`eventi.ricorrenza_id`, vincolo nel
  database), scelta nel riquadro «Ricorrenza» della Panoramica da chi lo modifica e fa parte
  della Famiglia. Gli eventi personali non ne hanno; spostare un evento in un'altra Famiglia
  toglie la ricorrenza. Nessuna associazione dedotta da nomi o date.
- Eliminare una ricorrenza toglie solo l'associazione: eventi, menù, partecipanti e archivi
  restano.
- Duplicando si propone la ricorrenza dell'originale (se la Famiglia è la stessa), cambiabile o
  da togliere. Il confronto (§27) propone l'evento precedente della ricorrenza per data.
- Migrazione: le serie della 0011 nelle Famiglie diventano ricorrenze con il nome della prima
  edizione; quelle di eventi personali restano scollegate; la colonna `serie_id` è rimossa.
  In produzione non c'erano serie.

### 28.2 Visibilità e copia delle ricette

- «Visibile nella Famiglia» significa visibile ai membri della Famiglia, mai pubblica su
  Internet. Una ricetta è privata (con eventuali persone scelte, §19.4) oppure visibile in una
  sola Famiglia; la modifica resta al proprietario. Non è più possibile renderla visibile in
  più Famiglie insieme (indice unico; regola `una_famiglia`).
- «Copia in un'altra Famiglia» (per chi fa parte di più Famiglie, da una ricetta che vede in una
  di esse): nuova ricetta dell'utente con nuovo id, ingredienti, quantità, procedimento, tempi,
  note e foto **duplicate** (file propri), nata nella Famiglia di destinazione e, dalla 7.3,
  **privata** finché l'utente non la condivide (§36). Nessun
  legame operativo: `origine_piatto_id` vuoto (classifiche, copie e confronto separati), niente
  voti, commenti o dati degli eventi; resta anche se l'originale cambia o sparisce o se
  l'utente esce dalla Famiglia d'origine.
- **Provenienza** (`piatti.provenienza`, JSON di solo testo): titolo originale, data e ora,
  chi ha copiato, e il nome della Famiglia d'origine solo se chi copia sceglie di indicarlo.
  Mostrata con discrezione nella scheda; non dà accesso a nulla.
- Ricette già visibili in più Famiglie: in produzione nessuna (una sola Famiglia). Se ce ne
  fossero, la migrazione si ferma senza modificare nulla (indice unico violato): la scelta di
  quale Famiglia tiene l'originale va presa con Loris prima di convertirle in copie.
- Test: `server/api/ricorrenze.test.ts`, e2e `ricorrenze.spec.ts` ed `edizioni.spec.ts`.

## 29. Rifinitura UX e collaudo (6.2)

Richiesta di Loris (17/11/2026, «Pacchetto di rifinitura UX e collaudo»), con la rettifica
sulle presenze dello stesso giorno. Migrazione `0014_dettagli_notifiche.sql`. Nessun nuovo tipo
di notifica (decisione di Loris: niente notifiche per le conferme di partecipazione).

### 29.1 Centro notifiche

- Ogni notifica mostra icona e categoria del tipo (Bacheca della Famiglia, Bacheca dell'evento,
  Commento, Sondaggio, Proposta di piatto, La tua proposta, Chi porta cosa, Menù, Condivisione,
  Valutazione), evento o Famiglia (con più Famiglie anche la Famiglia), testo con l'autore, data;
  divise in «Da leggere» e «Già lette», con il pallino sulle non lette.
- **Raggruppate apribili**: la colonna `notifiche.dettagli` (JSON) conserva gli ultimi 10
  aggiornamenti riuniti sotto la stessa chiave (chi, cosa, quando, messaggio o elemento);
  «N aggiornamenti» li elenca e ognuno porta al suo contenuto. Le chiavi restano per evento o
  per Famiglia: nessun gruppo mescola eventi o Famiglie diverse. Le notifiche nate prima della
  0014 non hanno elenco finché non ricevono un nuovo aggiornamento.
- **Apertura**: messaggi, commenti, sondaggi e proposte → il messaggio nella sua bacheca
  (`?messaggio=`); bacheca di una Famiglia → `#/famiglia?famiglia=<id>&messaggio=<id>`: la
  Famiglia della notifica diventa quella attiva (se se ne fa ancora parte; il parametro vale una
  volta sola); incarichi → l'incarico preciso in «Chi porta» (`?incarico=voce:<id>|cosa:<id>`),
  evidenziato; menù e valutazioni → il menù; condivisioni → l'evento o la ricetta. Se il
  contenuto non c'è più lo si dice («non è più disponibile»), senza altri dettagli.
- Permessi come in §20.6: in lettura si ricontrollano e le notifiche su risorse non più
  accessibili spariscono; un messaggio eliminato toglie la sua notifica; gli eventi archiviati
  restano consultabili.

### 29.2 Partecipanti e presenze (rettifica obbligatoria)

- Le presenze sono **sempre manuali** e le aggiorna solo chi può modificare l'evento: inserisce
  partecipanti e accompagnatori (adulti e bambini, con e senza nome) e cambia gli stati
  (in attesa, confermato, non partecipa). Chi ha solo la lettura consulta l'elenco, vede chi
  gestisce le presenze («Le presenze le aggiorna chi può modificare l'evento: …») e nessun
  comando. Niente «Conferma presenza» personale, niente conferme da inviti, notifiche o altro.
- Il server rifiuta (403, prima di validare il corpo) ogni scrittura sui partecipanti di chi non
  ha il permesso di modifica, anche sul proprio invito; 404 se l'evento non è visibile. Le
  presenze già registrate restano come sono.
- La partecipazione non dà permessi; i permessi non sono partecipazione; «Chi porta cosa»
  resta separato.
- Interfaccia: «N coperti per porzioni e spesa» (il numero usato davvero), modalità
  «Manuali» (indipendenti dall'elenco; a chi organizza si dice quanti sarebbero con i
  confermati, senza cambiare nulla) o «Automatici» (dai confermati, accompagnatori compresi);
  riquadri Confermati / In attesa / Non partecipano con i bambini; «conferma parziale» sugli
  inviti con risposte diverse fra titolare e accompagnatori.
- **Elenco in tabella** (richiesta di Loris, 17/11/2026): colonne Nome e Risposta, gli
  accompagnatori sotto il loro invito, quelli senza nome in una riga riassuntiva. Normalmente si
  vedono solo nome e risposta; chi organizza tocca «Modifica elenco» e compaiono la scelta della
  risposta, «Aggiungi» e per ogni riga il menù con accompagnatori, modifica, invito a parte e
  «Togli dall'elenco»; «Fine» torna alla consultazione. Con l'elenco vuoto «Aggiungi
  partecipante» resta subito disponibile.

### 29.3 «A che punto siamo?»

- Prima ciò che manca, poi «Già a posto». In sospeso, nell'ordine: problemi (incarichi di chi
  non partecipa, cose da portare senza nessuno, attività in ritardo, spesa da verificare), poi
  conferme mancanti, incarichi da completare, attività da fare, proposte da decidere, sondaggi
  aperti, spesa da comprare. I piatti non affidati sono una nota, non una cosa in sospeso.
- Niente in sospeso: «Tutto pronto». Ogni voce apre la sezione che la risolve; nessuna gestione
  parallela.

### 29.4 Duplicazione e confronto

- La finestra «Duplica evento» dice da quale evento si parte, cosa si copia e cosa no, e che la
  ricorrenza proposta è quella dell'originale.
- Il confronto dice quali eventi si confrontano (nomi e date), se li lega una ricorrenza (o se
  l'evento è scelto a mano) e la differenza dei coperti; colonne «Prima» e «Ora». Senza
  un'edizione precedente il collegamento si chiama «Confronta con un altro evento».

### 29.5–29.6 Ricorrenze e ricette fra Famiglie

Verificate (§28) e lasciate invariate: collaudo e2e con più Famiglie, eliminazione della
ricorrenza senza perdere eventi, copia indipendente (foto, provenienza, eliminazione
dell'originale, uscita dalla Famiglia).

### 29.7 Ricettario e menù

- Tornando indietro (a una pagina già vista) si ritrova la posizione di scorrimento; una pagina
  nuova parte dall'alto. Nel ricettario anche la ricerca resta nell'indirizzo (`?q=`), come la
  portata.
- Suggerimenti del ricettario nel menù: campo «combobox», frecce per scegliere, Invio per
  collegare, Esc per chiudere (prima non erano raggiungibili da tastiera).

### 29.8 Collaudo

- `server/api/notifiche.test.ts`, test di partecipanti e riepilogo aggiornati alla rettifica;
  e2e `rifinitura.spec.ts` (due persone, notifiche, Famiglia giusta, presenze in sola lettura,
  tastiera, ritorno nel ricettario, testi lunghi senza scorrimento orizzontale, archivio).
- **Aggiornamento PWA** (`test/e2e/aggiornamento.pwa.ts`, progetto `pwa`): server di prova
  isolato su 127.0.0.1:4175 con dati propri; seconda build (`MENUAPP_COMMIT=pwa-nuova`) messa al
  posto della prima: rilevamento al ritorno in primo piano, avviso senza ricaricamento, «Aggiorna»,
  nuova versione in Impostazioni → Dati, nessun file della build vecchia in cache, sessione, dati
  e preferenze intatti.

## 30. Ricorrenze standard (6.3)

Richiesta di Loris (17/11/2026). Migrazione `0015_ricorrenze_standard.sql`. Completa §28 senza un
secondo sistema: le ricorrenze della Famiglia restano come sono.

- **Catalogo** (`src/domain/ricorrenze.ts`, uguale per client e server): Vigilia di Natale,
  Natale, Santo Stefano, Capodanno, Epifania, Pasqua, Pasquetta, Ferragosto, con identificativi
  stabili (`vigilia-natale`, `natale`, …) indipendenti dal nome. Disponibili in tutte le
  Famiglie senza configurazione e senza righe per Famiglia; nessun evento creato, nessuna data.
  Aggiungerne una è una modifica del codice (nessun vincolo SQL sull'elenco).
- **Modello**: l'evento ha al massimo una ricorrenza, della Famiglia (`ricorrenza_id`) oppure
  standard (`eventi.ricorrenza_standard`, vincolo nel database); solo gli eventi di una
  Famiglia ne hanno. `ricorrenza_manuale = 1` quando la ricorrenza, o la sua assenza, l'ha scelta
  una persona. Il «tipo» che indica una standard è l'**occasione** dell'evento (campo già
  esistente, con i suggerimenti), riconosciuta solo se coincide con il nome o un sinonimo
  (senza accenti e maiuscole): mai dal nome libero dell'evento. Il «Tipo» pranzo/cena non c'entra.
- **Creazione**: senza una scelta esplicita l'evento di una Famiglia con occasione standard entra
  nella ricorrenza standard (`ricorrenza` assente nella richiesta); con `ricorrenza` (anche
  `null`) vale la scelta. Nel modulo il campo «Ricorrenza» segue l'occasione finché non lo si
  tocca. Una ricorrenza della Famiglia omonima non viene mai scelta per nome.
- **Scelte manuali** (`PUT /eventi/:id/ricorrenza` con `{ ricorrenza: { tipo, id } | null }`;
  resta accettato `{ ricorrenzaId }`): prevalgono sempre; titolo, data e altri campi non le
  cambiano; una ricorrenza tolta non torna. Se cambia l'occasione verso un'altra standard, la
  ricorrenza attuale resta e la Panoramica propone la nuova («Usa «Pasquetta»» / «Lascia così»).
  Stessa proposta per gli eventi esistenti senza ricorrenza; nessuna associazione in massa.
- **Duplicazione**: la copia mantiene la ricorrenza standard (anche in un'altra Famiglia), salvo
  scelta diversa; nessuna nuova definizione. **Edizioni e confronto**: eventi della stessa
  ricorrenza standard **nella stessa Famiglia**; confronto invariato (§27). Spostando un evento
  in un'altra Famiglia la standard resta, rendendolo personale si perde.
- **Interfaccia**: un unico selettore (creazione, Panoramica, Duplica) con «Nessuna ricorrenza»,
  «Ricorrenze standard» e «Ricorrenze della Famiglia» (queste con «(della Famiglia)»); la
  ricorrenza si mostra come «Natale · standard» o «Natale · della Famiglia». In Famiglia →
  Membri l'elenco delle standard già pronte.
- Migrazione provata su una copia del database di produzione (17/11): eventi e snapshot
  identici, nessuna ricorrenza standard assegnata, l'unico evento con una ricorrenza della
  Famiglia («Vigilia di Natale») la conserva come scelta manuale.
- Test: `server/api/ricorrenze-standard.test.ts`, e2e `ricorrenze-standard.spec.ts`.

## 31. Riorganizzazione della navigazione (6.4)

Richiesta di Loris (17/11/2026), proposta A dell'audit `docs/AUDIT-UX-ARCHITETTURA.md` con le sue
decisioni. Nessuna migrazione; API invariate salvo `GET /per-te` (nuova, sola lettura) e
`menu.voci` nel riepilogo.

### 31.1 Navigazione principale e Famiglia attiva

```
Barra (telefono in basso, PC a sinistra): Eventi · Ricettario · Famiglia · Notifiche · Impostazioni
Eventi #/ ── In programma │ Conclusi (?vista=conclusi) │ Archivio (?vista=archivio; #/eventi/archivio → qui)
   · Per te · Prossimo evento · un solo elenco in ordine di data (propri e condivisi insieme, i
   condivisi con il badge «di … · sola lettura / puoi modificare») · eventi nelle altre Famiglie
   · [Duplica] [Nuovo]
   └─ Evento #/eventi/:id ── Riepilogo │ Menù │ Persone │ Prepara │ Bacheca
         Riepilogo (#/eventi/:id, /confronto): A che punto siamo · [Stampa menù] [Azioni ▾]
                    · informazioni · archivio · Ricorrenza ed edizioni (Confronta) · Condivisione
         Menù (/menu): portate, piatti, ricette, porzioni, A cura di (in sola lettura), [Portate] [Stampa],
                    vista cucina sulla riga (/voci/:v/cucina)
         Persone: Presenze (/partecipanti) · Chi porta (/chi-porta)
         Prepara: Spesa (/spesa) · Piano (/piano) · vista cucina dei piatti con ricetta
         Bacheca (/bacheca): messaggi, commenti, sondaggi, proposte
Ricettario #/ricettario ── ricerca (?q=) · portate · rubrica → Ricetta: nome e foto, porzioni,
   Vista cucina, ingredienti, procedimento, usato in, poi «Gestione della ricetta» (provenienza,
   visibilità, copia in altra Famiglia, esporta, condividi, elimina)
Famiglia #/famiglia ── Bacheca │ Apprezzati │ Persone (con l'app, inviti, senza app) │
   Gestione (ricorrenze standard e della Famiglia, nome, esci, nuova Famiglia); ?scheda=membri → Persone
Notifiche #/notifiche (?preferenze=1 apre le preferenze)
Impostazioni ── Personali: Account, Notifiche, Aspetto │ Ricettario e spesa: Ingredienti │
   Amministrazione (solo chi amministra): Nuovi eventi (#/impostazioni/eventi), Reparti
   (#/impostazioni/reparti), Utenti e dispositivi*, Dati e backup*   (* solo dall'ingresso privato)
```

- Le sei pagine dell'evento restano agli stessi indirizzi: le schede Persone e Prepara li
  raggruppano con un interruttore a segmenti. Notifiche, segnalibri e collegamenti interni
  continuano a funzionare, anche ricaricando.
- **Famiglia attiva**: la sceglie solo l'utente (selettore) ed è ricordata sul dispositivo; l'app
  non la cambia in base agli eventi. Il selettore compare sul telefono solo dove conta
  (Eventi, Ricettario, Famiglia). Dentro un evento l'intestazione mostra la Famiglia dell'evento e,
  se diversa da quella attiva, un avviso con «Passa a «X»». Nella pagina Eventi gli eventi delle
  altre Famiglie sono segnalati con lo stesso pulsante. Il nuovo evento mostra il campo
  «Famiglia» (con due o più Famiglie), proposto sulla Famiglia attiva.
- **Indietro** (`PulsanteIndietro`): torna alla pagina precedente dell'app; aperta da fuori o dopo
  un ricaricamento, va alla pagina indicata (es. l'elenco degli eventi o l'archivio).
- **Messaggi temporanei** in basso, sopra la barra del telefono: non coprono titoli e schede.

### 31.2 Evento

- **Riepilogo**: «A che punto siamo?» distingue problemi, cose da completare (anche «Menù ancora
  vuoto», «Menù in preparazione» e «Coperti non indicati»), parti facoltative non usate («Non ancora usati»: elenco dei
  partecipanti, chi porta, piano) e cose a posto; «Tutto pronto» solo senza cose in sospeso. Poi
  le informazioni (tipo, coperti una volta sola, menù, note), l'archivio, Ricorrenza ed edizioni
  con «Confronta», la condivisione.
- **Azioni** (menù): Modifica evento, Duplica evento, Concludi o Riapri, Archivia, Elimina;
  ciascuna solo a chi può usarla. **Duplica** basta poter leggere l'evento (§25): chi è in sola
  lettura vede solo questa azione. «Stampa menù» resta un pulsante.
- **A cura di** e **Chi porta** sono lo stesso incarico della voce (`incaricato`,
  `incaricato_id`, `incaricato_esterno_id`, completato, spesa): si gestisce in Chi porta; nella
  finestra del piatto si legge, con «Affida/Cambia in Chi porta». L'API `PUT /voci/:id` accetta
  ancora `incaricato` (compatibilità), con le regole di §20.5.
- **Chi porta** compatto: una riga per piatto o cosa; «Me ne occupo io» e «Affida» in vista per
  ciò che è libero; per ciò che è affidato il responsabile e «Fatto», «Cambia responsabile» e
  rinuncia nel menù della riga. Permessi invariati (§20.5).
- **Prepara**: Spesa e Piano, con i piatti con ricetta a un tocco dalla vista cucina.

### 31.3 Altre sezioni

- **Eventi**: segmenti In programma · Conclusi · Archivio; «Per te» (`GET /per-te`): piatti e cose
  affidati all'utente non ancora fatti negli eventi non archiviati che vede, e sondaggi aperti a
  cui non ha risposto (nelle sue Famiglie e negli eventi dove partecipa), ciascuno con il
  collegamento; «Duplica» sceglie l'evento (anche concluso o archiviato) e apre la solita finestra.
- **Ricetta**, **Famiglia**, **Impostazioni**: come nella mappa §31.1. Portate predefinite e
  reparti, comuni a tutti, si vedono e si cambiano solo da chi amministra.

### 31.4 Permessi

Nessuna regola cambiata: il server resta l'autorità (`autorizzazione.test.ts`). L'interfaccia
nasconde le azioni non permesse invece di spegnerle; Duplica non dipende più dalla sola lettura
dell'evento d'origine.

### 31.5 Codice

Componenti condivisi in `src/components/Navigazione.tsx` (`Schede`, `Segmenti`,
`PulsanteIndietro`, `TitoloSezione`, `RigaLink`, `ElencoLink`); regole spostate nel dominio
(`src/domain/edizioni.ts`: `nomeEdizione`, `annoDopo`; `confermaParziale` in
`src/domain/partecipanti.ts`); hook `useEdizioni`, `useRicorrenze`, `usePerTe` in
`src/api/query.ts`.

### 31.6 Grafica e accessibilità

Schede sempre visibili (larghe uguali) e segmenti con `aria-current`; pulsanti di almeno 36 px;
verde di «confermato» scurito (4,98:1 sul suo sfondo, AA); nessuno scorrimento orizzontale nelle
pagine collaudate; messaggi in basso.

### 31.7 Differenze rispetto alla proposta A (motivate)

- La quinta sezione resta **Impostazioni** (non «Altro»): decisione di Loris.
- In **Chi porta** le azioni frequenti restano in vista (non nel menù «⋯» del prototipo):
  richiesta di Loris.
- Nessun cambio automatico della **Famiglia attiva** in base al prossimo evento (l'audit lo
  proponeva per P0-1): la Famiglia la sceglie l'utente; gli eventi delle altre Famiglie sono
  segnalati.
- **«Per te»** senza il conteggio delle notifiche (già nella barra).
- Rinviati: due colonne su PC (P2-7), «Altri dettagli» comprimibili nel nuovo evento (P1-14),
  divisione dei servizi misti e alias `/famiglie/:id/bacheca` (P3-2, P3-3), e2e indipendenti
  dall'ordine (P3-7).

### 31.8 Test

`server/api/per-te.test.ts`, `src/features/eventi/Riepilogo.test.tsx` (menù vuoto, parti
facoltative), `server/api/riepilogo.test.ts`; e2e `riorganizzazione.spec.ts` (barra, Famiglia
ricordata, evento di un'altra Famiglia, nuovo evento nella Famiglia giusta, schede e vecchi
indirizzi dopo il ricaricamento, vista cucina, indietro, azioni per ruolo, duplicazione in sola
lettura, Me ne occupo e Per te, archivio, ricetta, Famiglia, impostazioni) e gli e2e esistenti
aggiornati alla nuova navigazione.

## 32. Installazione su Cloudflare (7.0)

Decisione di Loris (18/11/2026, piano `docs/PIANO-CLOUDFLARE.md`): una seconda installazione,
**indipendente** da Debian, su `ricettedifamiglia.online`, con database e utenti propri. Il server
Debian resta com'è (stesso codice comune, stesso comportamento); nessuna sincronizzazione dei dati
(fase C7, più avanti). Operazioni in `docs/CLOUDFLARE.md`.

### 32.1 Architettura

- **Worker** `menuapp` (`cloudflare/worker.ts`): file dell'app dagli Static Assets
  (`dist-cloudflare/`, SPA, `_headers` generato da `scripts/cloudflare/intestazioni.ts` con le
  stesse intestazioni di sicurezza e di cache del server); ogni `/api/*` va al Durable Object.
- **Durable Object** `Archivio`, una sola istanza: database SQLite, foto in R2, stesse rotte del
  server. Fastify non può girare su Workers (genera codice con `new Function`): le rotte girano sul
  **motore leggero** (`server/motore-leggero.ts`), che imita la parte di Fastify usata
  (hook, decorazioni, analisi del corpo, errori, 404, HEAD, `inject`). La configurazione comune
  (`server/api/applicazione.ts`: origini, tipo JSON, intestazioni, errori, autenticazione, rotte)
  è la stessa sui due motori; tutta la suite del server gira anche sul motore leggero
  (`MENUAPP_MOTORE=leggero`).
- **Cron Trigger** alle 02:45 UTC: manutenzione notturna (§32.6).

### 32.2 Database

- Interfaccia `Db` (`server/db/connessione.ts`) soddisfatta da `DatabaseSync` (Debian, aperto in
  `server/db/sqlite-node.ts`) e da `DbDurable` (`cloudflare/db-durable.ts`, SQLite del Durable
  Object). Servizi e repository invariati.
- Nel Durable Object: transazioni con `transactionSync` (BEGIN/COMMIT vietati; annidate
  partecipano a quella esterna), righe modificate con `changes()`, niente `PRAGMA user_version`
  né `integrity_check` (versione dello schema da `migrazioni_applicate`), chiavi esterne sempre
  attive, **al massimo 100 parametri per query**: le liste di id (commenti, reazioni e allegati dei
  200 messaggi di una bacheca) passano come un solo parametro JSON (`json_each`).
- Migrazioni: `server/db/migrazioni/applica.ts` (senza file), gli stessi `.sql` inclusi come
  testo (`cloudflare/migrazioni.ts`, un test verifica che ci siano tutti), applicate all'avvio
  dell'oggetto con `blockConcurrencyWhile`, poi il catalogo (`eseguiSeed`).

### 32.3 Foto e allegati

`CartellaFile` (`server/servizi/cartella.ts`): disco su Debian (`server/cartella-disco.ts`),
bucket R2 **privato** `menuapp-foto` su Cloudflare (`cloudflare/cartella-r2.ts`). Prima il file e
poi la riga; le copie fatte dentro una transazione (copia di una ricetta con le foto) partono alla
fine della richiesta; un file eliminato va in `cestino/` (svuotato dopo 30 giorni) per i
ripristini. Le foto si leggono solo dall'API, con il permesso sulla ricetta o sul messaggio.

### 32.4 Accesso e console

- Inviti, codice di verifica, approvazione, sessioni, cookie `__Host-` e revoche identici a §19;
  link d'invito su `MENUAPP_URL_PUBBLICO` (`https://ricettedifamiglia.online`); scritture solo da
  quell'origine (più `MENUAPP_ORIGINI`). IP dei tentativi da `CF-Connecting-IP`.
- **Console** (`cloudflare/console.ts`, `POST /api/v1/console`): sostituisce il terminale del
  server per primo amministratore, approvazioni, sessioni, revoche, elenco dei backup e
  **ripristino**. Esiste solo mentre è impostato il segreto `MENUAPP_CODICE_CONSOLE` (almeno 32
  caratteri, confronto a tempo costante, 10 tentativi ogni 15 minuti per indirizzo); senza segreto
  risponde 404. Script: `scripts/cloudflare/console.ts`, `scripts/cloudflare/console.sh`. Il segreto
  lo legge il Worker e lo passa al Durable Object con un'intestazione interna (quella del browser è
  sempre tolta): il Durable Object legge i propri segreti solo al suo avvio.

### 32.5 Ingresso `unico`

L'installazione Cloudflare ha un solo ingresso, `unico`: amministrazione di utenti, inviti e
dispositivi e funzioni di sistema dall'app **solo agli amministratori** (`richiediSistema` nega
solo l'ingresso `pubblico`); salute minima senza sessione; niente controllo dei nomi locali, del
Funnel né rete di casa. Rotte di ripristino assenti (404).

### 32.6 Backup

Esportazioni complete JSON (stesso formato di §11.3) in R2 sotto `backup/`: `giornaliero` (14),
`manuale` (10), `pre-ripristino` (5). La pagina «Dati e backup» le elenca, le crea e le scarica;
niente ripristino dall'app. Manutenzione notturna: backup giornaliero, file non più citati da più
di un giorno nel cestino, cestino svuotato dopo 30 giorni. Ripristino solo dalla console
(`ripristina <nome>`): verifica di formato, impronta e schema, backup `pre-ripristino`, sostituzione
del contenuto in una transazione, file delle foto rimessi dal cestino; le sessioni restano valide.
Esportazione JSON e ZIP con le foto per l'amministratore come su Debian.

### 32.7 Rilascio

Solo manuale, mai dal collegamento Git: `scripts/cloudflare/rilascia.sh` da `main` già pubblicato
(controlli, prove sul Worker in locale, build, creazione del bucket se manca, `wrangler deploy`,
verifica di salute e 401). Credenziali in `~/.config/menuapp/cloudflare.env` (600).

### 32.8 Test

- Suite del server due volte: Fastify e motore leggero.
- `npm run test:cloudflare` (`test/cloudflare/worker.test.ts`, `wrangler dev` con workerd,
  Durable Object e R2 locali): intestazioni, console, primo amministratore, ingresso `unico`,
  permessi e Famiglie, foto in R2 e copie, backup, esportazione ZIP, ripristino e cestino, Cron.
- `npm run test:e2e:cloudflare`: la suite e2e completa contro il Worker in locale (tranne
  l'aggiornamento della PWA fra due build).
- `test/architettura.test.ts`: il Worker non importa `node:fs`, `node:sqlite`, Fastify; tutte le
  migrazioni incluse.

### 32.9 Limiti noti

- Piano Free: 100.000 richieste al giorno al Worker e al Durable Object, 10 ms di CPU per
  richiesta al Worker (che inoltra soltanto); per il Durable Object la documentazione indica 30 s,
  da confermare con le misure reali (primo avvio: migrazioni e catalogo ~90 ms).
- Nessuna console SQL: si interviene dalla console e dalle funzioni d'amministrazione.

## 33. Migrazione dei contenuti da Debian a Cloudflare (7.1)

Decisione di Loris (18/11/2026): Cloudflare diventa una copia completa dei contenuti Debian;
utenti, credenziali, sessioni e dispositivi di Cloudflare restano. Codice: `cloudflare/importazione.ts`,
comandi della console `proponi`, `piano`, `importa`, `verifica`; procedura guidata
`scripts/cloudflare/migra.ts` (docs/CLOUDFLARE.md).

- **Cosa si importa**: tutte le tabelle di contenuto (§11.3) tranne l'identità di Cloudflare
  (`utenti`, `sessioni`, `preferenze_notifiche`, oltre a `inviti` e `richieste_attivazione`, che non
  sono contenuto): Famiglie e appartenenze, ricette e ingredienti, catalogo e reparti, impostazioni,
  eventi, menù, spesa, piano, archivio, bacheca, sondaggi, proposte, chi porta, partecipanti,
  persone esterne, ricorrenze, valutazioni, notifiche, foto e allegati. I contenuti di prova di
  Cloudflare sono sostituiti.
- **Utenti**: corrispondenza esplicita Debian → Cloudflare in `corrispondenza.json`, proposta per
  nome normalizzato e **confermata da Loris** (`"confermata": true`). Omonimie e nomi senza
  corrispondente non si risolvono mai in automatico; due utenti Debian sullo stesso utente
  Cloudflare sono vietati; un utente Debian senza corrispondente è creato solo se indicato
  («nuovo», senza dispositivi, mai con lo stesso nome di uno esistente). Ruolo e nome restano quelli
  di Cloudflare. Ogni colonna che punta a `utenti` (lette dallo schema reale: proprietari, autori,
  incaricati, membri, condivisioni, voti, partecipanti, notifiche…) e gli id dentro i dettagli delle
  notifiche sono tradotti; un riferimento senza corrispondenza ferma tutto prima di toccare i dati.
  I nomi «fotografati» nel testo (autore d'origine di una ricetta copiata, nome di un partecipante)
  restano come sono.
- **Sicurezza**: backup manuale verificato di Debian (`prepara`), esportazione dal backup e non dal
  database in uso, impronta dell'esportazione e di ogni file controllate; `piano` esegue tutti i
  controlli senza modificare nulla; `importa` salva Cloudflare in `pre-migrazione-…` (R2), copia i
  file con l'impronta verificata, poi sostituisce i contenuti in una sola transazione con verifica
  dei riferimenti e dei conteggi; `verifica` (ripetibile) confronta i conteggi con Debian, controlla
  riferimenti e utenti, legge ogni foto e allegato da R2 e ne verifica l'impronta.
- **Annullamento**: `migra.ts annulla pre-migrazione-…` (ripristino della console, §32.6).
- Debian non è mai modificato (solo il backup manuale); resta attivo con il Funnel fino alla
  dismissione confermata da Loris.

## 34. Domini (7.1)

- `app.ricettedifamiglia.online`: l'app (Worker `menuapp`): inviti, origine ammessa, cookie
  `__Host-` e PWA su questo nome.
- `ricettedifamiglia.online`: Worker separato `ricettedifamiglia-sito` (`sito/`), solo file statici:
  pagina neutra «Sito in costruzione» (responsive, chiara e scura), 404 per tutto il resto,
  `noindex` (intestazione, meta e `robots.txt`), CSP minima. **Nessun riferimento all'app**: niente
  link, pulsanti, reindirizzamenti o nomi di funzioni (lo script di rilascio lo controlla). Un service
  worker sostitutivo e `Clear-Site-Data: "cache", "storage"` tolgono dai dispositivi l'app
  installata in passato su questo nome. **Mai `"cookies"`**: vale per tutto il dominio registrato,
  sottodomini compresi, e cancellerebbe la sessione di `app.…` (successo il 18/11). Predisposto per diventare una landing page.
- Passaggio senza interruzioni: `rilascia.sh --transizione` pubblica l'app su entrambi i nomi
  (origine del dominio principale ammessa in via temporanea); i dispositivi si ricollegano su `app.…`;
  poi il dominio principale passa al sito.

## 35. Famiglia d'origine delle ricette (7.2)

Prima fase del piano di evoluzione (docs/PIANO-EVOLUZIONE.md §1, fase 1A). Migrazione
`0016_famiglia_origine.sql`.

- Ogni ricetta ha una **Famiglia d'origine** (`piatti.famiglia_origine_id`, `famiglia_origine_nome`):
  dove è nata, distinta dalla Famiglia con cui è condivisa (§21.3, §28). Il nome è fissato alla
  nascita; si mostra quello attuale finché la Famiglia esiste, poi quello della nascita. Una volta
  indicata non cambia (trigger `piatti_origine_fissa`); l'eliminazione della Famiglia toglie solo
  il collegamento.
- Alla nascita: la Famiglia indicata (`famigliaOrigine` in `POST /piatti`, sempre dell'autore; l'app
  manda la Famiglia attiva, anche nell'importazione), altrimenti quella con cui è condivisa,
  altrimenti l'unica Famiglia dell'autore, altrimenti nessuna. Copie: in un'altra Famiglia → la
  destinazione; nel proprio ricettario → quella dell'originale se l'autore della copia ne fa parte;
  ricette create per un evento (voce, copia per il proprietario, duplicazione, archivio) → la
  Famiglia dell'evento se il proprietario ne fa parte.
- Ricette esistenti (migrazione, senza scelte arbitrarie): condivisa con una Famiglia → quella;
  altrimenti il proprietario in una sola Famiglia → quella; altrimenti da indicare. Nessuna
  condivisione o permesso cambia. Sui dati di TEST: 77 su 77 determinate.
- Da indicare: la scheda chiede al proprietario «In quale Famiglia è nata questa ricetta?» (una sua
  Famiglia, una volta sola): `PUT /piatti/:id/famiglia-origine { gruppoId, versione }`. Controllo:
  `origini` nella console (`scripts/amministra.sh origini`, console Cloudflare).
- Scheda: «Nata in <Famiglia>» nella gestione della ricetta; elenco e scheda espongono
  `famigliaOrigine: { id | null, nome } | null`.
- Test: `server/api/famiglia-origine.test.ts` (migrazione, nascita, copie, eventi, origine fissa,
  rinomina ed eliminazione della Famiglia, ripristino), `test/cloudflare` (console), e2e
  `ricorrenze.spec.ts`.

## 36. Ricette pubbliche fra Famiglie (7.3)

Seconda fase del piano di evoluzione (docs/PIANO-EVOLUZIONE.md §1, fase 1B, decisioni D1–D6).
Migrazione `0017_ricette_pubbliche.sql`.

- **Visibilità** in tre livelli: privata (solo il proprietario, più le eventuali persone scelte di
  §19.4), di famiglia (una Famiglia, §28), **pubblica nell'app** (`piatti.pubblica`): in sola lettura
  a ogni utente con una sessione, di qualunque Famiglia; mai agli anonimi (ogni `/api` senza sessione
  → 401, foto comprese). Pubblica include la Famiglia: una privata resa pubblica entra anche nella
  sua Famiglia d'origine. Solo il proprietario pubblica, con conferma, e solo con la Famiglia
  d'origine indicata (§35; trigger `piatti_pubblica_con_origine`); proprietà e origine non cambiano.
  «Di famiglia» toglie la pubblicazione, «privata» toglie anche la Famiglia. Nessuna ricetta
  esistente è diventata pubblica.
- Cosa vede chi legge una pubblica di un'altra Famiglia: contenuto, foto, Famiglia d'origine e nome
  dell'autore (D2); nulla di membri, eventi, voti o commenti di quella Famiglia. Le altre ricette di
  quella Famiglia restano invisibili.
- **Preferenza** «Includi ricette pubbliche» (`preferenze_utente`, `GET/PUT /account/preferenze` con
  versione): personale, uguale su tutti i dispositivi, spenta all'inizio. Nel ricettario: pulsante
  nella fila dei filtri, poi «Solo pubbliche»; etichetta «pubblica · <Famiglia>» sulle pubbliche
  delle altre Famiglie. `GET /piatti?pubbliche=no|si|solo`; una pubblica della propria Famiglia
  compare una volta sola, come ricetta di famiglia con l'etichetta «pubblica» (`soloPubblica`
  distingue le altre).
- **Copia** (D4): «Copia in una mia Famiglia» dalla scheda di una pubblica; la copia nasce sempre
  **privata**, dell'utente, con origine nella Famiglia scelta, indipendente (ingredienti e foto
  propri, nessun `origine_piatto_id`) e con la provenienza (titolo, Famiglia d'origine, data, chi,
  id della sorgente: solo memoria). Vale anche per «Copia in un'altra Famiglia» delle ricette di
  famiglia (prima nasceva visibile nella destinazione). La scheda di una pubblica già copiata dice
  «Hai già una copia». Privatizzare, modificare o eliminare l'originale non tocca le copie.
- **Menù** (D5 rivista): con la preferenza attiva i suggerimenti includono le pubbliche (dopo le
  proprie) con «pubblica · <Famiglia> · verrà copiata nel ricettario»; in «Collega un piatto» la
  casella «Cerca anche nelle ricette pubbliche» parte dalla preferenza. Collegarla crea una copia
  privata e indipendente nel ricettario del proprietario dell'evento, nella Famiglia dell'evento,
  riusata ai collegamenti successivi (`copiaEsistente` guarda anche la provenienza).
- Test: `server/api/ricette-pubbliche.test.ts` (pubblicazione, permessi, isolamento, anonimi, foto,
  doppioni, copie, menù, preferenze, migrazione), `ricorrenze.test.ts` (copie private), e2e
  `ricette-pubbliche.spec.ts`, `ricorrenze.spec.ts`.

### Registro delle modifiche

| Data | Modifica |
|---|---|
| 12/11/2026 | 1.0 — Prima versione consolidata (local-first, IndexedDB) |
| 12/11/2026 | 1.1 — Impronta del backup, fabbisogno coperto, contributi incompleti della spesa, snapshot autonomo, catalogo 200–250, apertura sicura con Dexie |
| 12/11/2026 | 1.2 — Produzione sul server Debian (porta 9870, systemd, `tailscale serve`), GitHub Pages dismesso |
| 12/11/2026 | 2.0 — **Database centralizzato**: backend Node + Fastify, SQLite unica fonte di verità condivisa da tutti i dispositivi; rimossi Dexie/IndexedDB, local-first, backup per dispositivo e sincronizzazione; schema SQL con vincoli e migrazioni; API REST `/api/v1` con contratto zod condiviso; controllo ottimistico delle versioni per aggregato; aggiornamento delle viste via revisione globale; backup automatici, manuali, pre-migrazione e pre-ripristino con verifica; ripristino in due passi; sola lettura senza server; un servizio systemd per frontend e API più timer di backup; strategia di test su SQLite reale e API; M0 riprogettata (13–19 nov) |
| 12/11/2026 | 2.1 — Allineamento al codice della v1.0: nomi dei campi tutti in italiano (`eventoId`, `piattoId`, `voceMenuId`, `ingredienteId`…; i tipi §6.2 restano validi con questi nomi); hook di sola lettura `usePuoScrivere()`; ripristino da JSON ricostruito applicando le migrazioni SQL fino alla versione del file e poi le restanti (niente funzioni `migraBackup` separate); «pz» e numero puro sono la stessa famiglia nella spesa; snapshot con `menu` (portate e voci) e `spesa` (lista riconciliata completa) già pronti per la consultazione; `POST /eventi/:id/riapri` vale anche per gli eventi archiviati e `GET /eventi/:id/riapertura` elenca i piatti cambiati; il backup del timer apre il database in un processo separato; trasferimento R10 del fabbisogno coperto solo fra righe della stessa famiglia di unità; catalogo iniziale di 248 ingredienti |
| 12/11/2026 | 2.2 — Accesso anche senza Tailscale dalla rete di casa (decisione di Loris, per l'Echo Show 15): secondo ascolto HTTP su `0.0.0.0:9880` (`MENUAPP_PORTA_LAN`), che accetta solo nomi host locali (IP privati, `*.local`, `loris-srv01`: protezione dal DNS rebinding) e scritture con origine uguale all'indirizzo usato. In HTTP l'app non si installa come PWA e non tiene lo schermo acceso, ma funziona completamente; gli id del client hanno un'alternativa senza `crypto.randomUUID`. Chiunque sia sul Wi-Fi di casa può usare l'app. L'accesso HTTPS via Tailscale (`:9870`) resta per l'installazione PWA e per l'uso fuori casa. Grafica: font inclusi (Fraunces, Inter), illustrazioni SVG, misure in rem con testo automatico più grande sugli schermi ≥ 1400 px e preferenza «Dimensione del testo» |
| 12/11/2026 | 2.3 — Foto e importazione ricette (richiesta di Loris): formato ricetta v1 definito in `docs/FORMATO-RICETTA.md` (pacchetto `.menuapp-ricetta` ZIP con `ricetta.json` e foto, JSON, scrittura a mano `.txt/.md`); migrazione `0002_foto.sql` con tabella `foto_piatti` (max 10 per piatto, una principale, file in `dati/foto/`, tipo verificato dai primi byte, ridotte a 1600 px nel browser); rotte `POST /piatti/:id/foto`, `GET|PUT|DELETE /foto/:id`, `PUT /foto/:id/file`, `GET /piatti/:id/esporta`, `GET /esportazione?foto=1` (ZIP); le foto vengono copiate in `dati/backup/foto/` a ogni backup e recuperate dopo i ripristini; importazione con anteprima del parser, mai sovrascrittura di piatti esistenti; condivisione della ricetta come testo. Le foto rientrano nel perimetro (prima erano rinviate) |
| 12/11/2026 | 2.4 — Foto collegate ai passaggi del procedimento: migrazione `0003_foto_passi.sql` (colonna `passo`, indice da 0), campo `passo` (da 1) nel formato ricetta v1 (facoltativo, retrocompatibile), ricollegamento automatico quando il procedimento cambia (stesso testo o testo appena ritoccato; altrimenti solo galleria), foto sotto i passaggi in scheda e vista cucina. Porta 9880 aperta anche ai nomi e agli indirizzi Tailscale (`*.ts.net`, 100.64.0.0/10) |
| 12/11/2026 | 2.5 — Designer del menù stampato (richiesta di Loris, F8 riscritta): cinque modelli, palette, caratteri, decorazioni, formati A4/A5/2×A5, impaginazione misurata su più pagine; migrazione `0004_stili_stampa.sql` (tabella `stili_stampa`: `evento_id` PK con CASCADE, `opzioni` JSON validato dal contratto `src/contratto/stampa.ts`, `versione`); rotte `GET|PUT /eventi/:id/stampa` (versione 0 = primo salvataggio); stile incluso nello snapshot all'archiviazione e nelle esportazioni/ripristini; nuovi caratteri locali (Cormorant Garamond, Josefin Sans, Great Vibes, solo sottoinsieme latino) caricati solo dalla schermata di stampa |
| 13/11/2026 | 2.6 — Ricettario sfogliabile (richiesta di Loris): filtro per portata in testa all'elenco (portate predefinite nel loro ordine, poi le altre, poi «Senza portata»; le varianti importate come «Antipasti / Fritti» o «Dolci al cucchiaio» ricadono nella predefinita da cui cominciano, regola in `src/domain/ricettario.ts`), elenco in ordine alfabetico italiano diviso per iniziale e rubrica alfabetica a lato come un'agenda telefonica (lettere vuote attenuate: portano alla successiva piena). Nessuna modifica a dati, API o schema |
| 13/11/2026 | 3.0 — **Multiutente** (§19, decisione di Loris): utenti, accesso su invito con approvazione del dispositivo e codice di verifica, sessioni lato server revocabili, eventi privati condivisibili in lettura o modifica, ricette condivisibili in lettura e usate per copia, trasferimento di proprietà, amministrazione dalla console e dall'ingresso privato, ingresso pubblico per Tailscale Funnel senza funzioni di sistema, rete di casa HTTP senza dati; migrazione `0005_utenti.sql` (tutti i dati all'amministratore); «Esporta i miei dati» |
| 13/11/2026 | 3.1 — **Ricettario di famiglia** (decisione di Loris): le ricette sono visibili a tutti gli utenti per impostazione predefinita e il proprietario può renderle private (condivisibili con persone scelte); modifica sempre solo del proprietario, uso negli eventi altrui per copia; migrazione `0006_visibilita_piatti.sql` (tutte le ricette esistenti di famiglia); filtro «Solo le mie»; «Utenti e dispositivi» anche in Impostazioni |
| 16/11/2026 | 4.0 — **Spazio della famiglia** e nuovo nome «Ricette di famiglia & Co.» (§20): gruppi familiari, bacheche della famiglia e degli eventi con commenti, reazioni e foto, sondaggi, proposte di piatti, chi porta cosa integrato con «A cura di» e spesa, centro notifiche, valutazioni e classifica; permesso di partecipazione distinto dalla modifica; migrazione `0007_famiglia.sql`; navigazione Eventi · Ricettario · Famiglia · Notifiche · Impostazioni (Ingredienti da Ricettario e Impostazioni) |
| 16/11/2026 | 5.0 — **Più Famiglie per persona** (§21): Famiglie con inviti ad aderire, uscita, rimozione e passaggio dell'amministrazione; Famiglia attiva con selettore solo da due Famiglie; eventi associati a una Famiglia; ricette condivise con una o più Famiglie (copie private); classifiche e notifiche per Famiglia; migrazione `0008_famiglie.sql` |
| 16/11/2026 | 5.1 — **Persone senza account** negli incarichi (§22): rubrica per Famiglia, incarichi affidati a utenti, persone della rubrica o nomi liberi senza doppioni, note, quantità e unità delle cose da portare; migrazione `0009_persone_esterne.sql` |
| 16/11/2026 | 5.2 — **Ricerca per ingredienti** (§23): nome, ingredienti, catalogo e sinonimi, più termini, ordine per pertinenza nel ricettario e nel menù |
| 16/11/2026 | 6.0 — **Organizzazione degli eventi** (§24–§27): partecipanti con conferme e accompagnatori, coperti manuali o calcolati; duplicazione ed edizioni; «A che punto siamo?»; confronto fra edizioni; migrazioni 0010–0012 |
| 16/11/2026 | 6.1 — **Ricorrenze** della Famiglia (sostituiscono le serie anonime) e **copia delle ricette fra Famiglie** con provenienza; una ricetta visibile in una sola Famiglia (§28); migrazione `0013_ricorrenze.sql` |
| 17/11/2026 | 6.2 — **Rifinitura UX** (§29): notifiche con categoria, gruppi apribili e apertura del contenuto preciso; **presenze solo manuali** da chi può modificare l'evento (rettifica: tolta la conferma personale anche dalle API); riepilogo con le cose in sospeso e «Tutto pronto»; duplicazione e confronto più chiari; ritorno alla posizione e ricerca nell'indirizzo; suggerimenti da tastiera; collaudo dell'aggiornamento PWA; migrazione `0014_dettagli_notifiche.sql` |
| 17/11/2026 | 6.3 — **Ricorrenze standard** (§30): catalogo comune con id stabili, associazione automatica dall'occasione alla creazione, scelte manuali che prevalgono, proposta al cambio d'occasione, duplicazione ed edizioni nella Famiglia; migrazione `0015_ricorrenze_standard.sql` |
| 17/11/2026 | 6.3.1 — Partecipanti in una tabella compatta: nome e risposta in consultazione, risposte, accompagnatori e rimozioni solo in «Modifica elenco» (§29.2). Nessuna modifica a dati o API |
| 17/11/2026 | 6.4 — **Riorganizzazione** (§31, proposta A dell'audit): evento in cinque schede (Riepilogo, Menù, Persone, Prepara, Bacheca) con gli stessi indirizzi, azioni in un menù, Famiglia dell'evento distinta da quella attiva, Eventi con segmenti e «Per te», Famiglia con Persone e Gestione, Impostazioni personali e di amministrazione, ricetta con il contenuto prima; `GET /per-te`; nessuna migrazione |
| 19/11/2026 | 7.3 — **Ricette pubbliche** fra Famiglie (§36): visibilità pubblica per gli utenti con sessione, preferenza «Includi ricette pubbliche», copia privata in una propria Famiglia, uso nei menù tramite copia; le copie fra Famiglie nascono private |
| 19/11/2026 | 7.2 — **Famiglia d'origine** delle ricette (§35): migrazione 0016 senza assegnazioni arbitrarie, origine alla nascita, fissa, indicata dal proprietario se manca |
| 18/11/2026 | 7.1 — **Migrazione da Debian** (§33): importazione dei contenuti con corrispondenza esplicita degli utenti, piano di prova, backup pre-migrazione, verifica e annullamento; **domini** (§34): app su `app.ricettedifamiglia.online`, dominio principale con la sola pagina «Sito in costruzione» in un Worker separato |
| 18/11/2026 | 7.0 — **Installazione su Cloudflare** (§32): Worker, Durable Object SQLite, R2 privato; motore leggero con le stesse rotte; interfacce `Db` e `CartellaFile` comuni; ingresso `unico`; console con segreto; backup in R2 e ripristino solo dalla console; rilascio manuale |
| 18/11/2026 | 6.4.2 — Accesso con il dominio `ricettedifamiglia.online` accanto al Funnel: `MENUAPP_ALTRI_URL_PUBBLICI`, ingresso privato solo con nomi locali o del tailnet, `X-Robots-Tag` (§19.5) |
| 17/11/2026 | 6.4.1 — Eventi: propri e condivisi in un solo elenco in ordine di data (niente sezione «Condivisi con me»); i condivisi si riconoscono dal badge, anche nel prossimo evento (richiesta di Loris, §31.1) |
