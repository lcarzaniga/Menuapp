# Menù & Co. — Specifica tecnica consolidata

| | |
|---|---|
| Versione documento | 1.2 — 12 novembre 2026 (revisione 2: hosting sul server) |
| Stato | Approvata in principio, da rivedere a fine M0 |
| Repository | `github.com/lcarzaniga/Menuapp` |
| Produzione | https://loris-srv01.dala-tortoise.ts.net:9870/ — server Debian `loris-srv01`, solo tailnet (§14) |
| Obiettivo | v1.0 completa entro il **15 dicembre 2026** (pranzo di Natale) |

Questo documento è la fonte di verità per tutte le milestone. Le modifiche sostanziali si
fanno qui, prima del codice, con una riga nel registro in fondo.

---

## 1. Visione del prodotto

Menù & Co. è una Progressive Web App **local-first** per organizzare pranzi, cene e
ricorrenze familiari. Una sola persona, che è insieme cuoco e organizzatore, la usa per:

1. creare l'evento (chi, quando, quanti);
2. comporre in pochi secondi un menù diviso in portate, anche solo con nomi di piatti;
3. far crescere nel tempo un ricettario personale, senza obbligo di inserire ricette;
4. ottenere una lista della spesa aggregata e scalata sui coperti, che non perde gli
   acquisti già fatti quando il menù cambia;
5. pianificare le preparazioni nei giorni precedenti;
6. cucinare con la ricetta sotto gli occhi, alle porzioni giuste;
7. stampare un menù elegante per la tavola;
8. non perdere mai i dati: tutto resta sul dispositivo, con backup JSON.

Principi:

- **Prima veloce, poi completo.** Un menù deve poter esistere in 30 secondi; ricette e
  ingredienti si aggiungono quando servono.
- **Niente magie silenziose.** Nessuna interpretazione incerta è presentata come certa;
  nessun dato dell'utente viene cancellato senza che lo sappia.
- **Offline sempre.** Nessuna funzione richiede la rete dopo il primo caricamento.
- **Telefono prima di tutto** (Android, Chrome), ma pienamente usabile da PC.
- **Italiano** in interfaccia, dati, messaggi, codice di dominio e documentazione.

## 2. Perimetro MVP (v1.0)

Incluso:

| Area | Funzioni |
|---|---|
| Eventi | Crea, modifica, elimina; tipo, occasione, data, ora, adulti, bambini, coefficiente, note; stati `attivo` / `concluso` / `archiviato`; snapshot all'archiviazione; riapertura |
| Menù | Portate per evento (dalle predefinite, modificabili); voci libere; inserimento rapido anche multiriga; collegamento facoltativo a un piatto; porzioni; incaricato; inclusione nella spesa; note; riordino e spostamento fra portate |
| Ricettario | Piatti con porzioni base, tempi, attrezzature, procedimento, ingredienti; creazione esplicita da una voce di menù; ricerca |
| Ingredienti | Catalogo con nome canonico, sinonimi, reparto, unità preferita; catalogo iniziale italiano; parser delle righe ingrediente con conferma |
| Spesa | Lista calcolata e aggregata per reparto; articoli manuali; stati *Da comprare / Ce l'ho / Comprato*; quantità corrette a mano; riconciliazione dopo modifiche del menù; condivisione testo |
| Piano | Attività per evento con data, ora facoltativa, stato, collegamento facoltativo a una voce di menù; checklist per giorno |
| Cucina | Vista ricetta a caratteri grandi, porzioni scalate, spunta ingredienti e passaggi, schermo sempre acceso |
| Stampa | Menù stampabile elegante (A4 e A5) |
| Dati | Backup JSON, ripristino validato, archiviazione persistente, copia di sicurezza prima delle migrazioni, promemoria backup |
| PWA | Installabile dal server via Tailscale (HTTPS), offline completo anche senza Tailscale, avviso di nuova versione con aggiornamento su richiesta |

## 3. Funzionalità rinviate (dopo il 15 dicembre)

Duplicazione di eventi · foto di piatti ed eventi · sincronizzazione fra dispositivi ·
budget e prezzi · importazione ricette da URL · valori nutrizionali e allergeni ·
timer di cucina · unione (merge) dei backup invece della sostituzione · condivisione con
altre persone · stampa di ricette e lista della spesa con layout dedicato (si usa la
stampa del browser) · cronologia completa delle versioni dei piatti · conversioni
peso↔volume per densità · statistiche · temi grafici personalizzati.

Sono esclusi in modo permanente salvo nuova decisione: backend, autenticazione,
servizi cloud, AI, Redux o altri store globali.

## 4. Flussi utente

### F1 — Primo avvio
1. L'app si apre su *Eventi* (vuoto) con un invito: «Crea il tuo primo evento».
2. Al primo salvataggio di dati l'app chiede l'archiviazione persistente
   (`navigator.storage.persist()`); l'esito è visibile in *Impostazioni → Dati*.
3. Se l'app non è installata, un banner discreto suggerisce «Installa sul telefono».

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
2. Anteprima: ogni riga mostra quantità, unità, nome, ingrediente di catalogo e un badge
   **Certo** o **Da verificare**, con il testo originale sempre visibile.
3. Le righe *Da verificare* vanno corrette o confermate una a una; si può salvare anche
   senza confermarle, ma restano marcate e segnalate nella spesa.
4. Ingredienti non presenti nel catalogo: «Aggiungi al catalogo» (nome, reparto
   proposto, unità) oppure lasciarli come testo libero.

### F5 — Spesa
1. *Evento → Spesa*: lista per reparto, calcolata dalle voci incluse nella spesa con un
   piatto che ha ingredienti.
2. Tocco su una riga: *Da comprare → Comprato*. Menu della riga: *Ce l'ho*, correggi
   quantità, nota, cambia reparto, nascondi, provenienza (da quali piatti arriva).
3. «Aggiungi articolo» per voci manuali (tovaglioli, ghiaccio…).
4. Se il menù cambia, la lista si aggiorna; gli acquisti già fatti restano e le
   differenze vengono segnalate (vedi §10).
5. «Condividi»: testo con le sole righe da comprare, raggruppate per reparto.

### F6 — Piano e preparazione
1. *Evento → Piano*: attività per giorno, con scelte rapide («il giorno prima», «la
   mattina stessa»).
2. Da una voce di menù: «Aggiungi preparazione» crea un'attività collegata.
3. Checklist: spunta *fatto*; le attività in ritardo sono evidenziate.

### F7 — Cucinare
1. Da voce di menù o dal ricettario: «Cucina». Si apre la vista cucina alle porzioni
   della voce (o alle porzioni base dal ricettario), modificabili.
2. Ingredienti e passaggi si spuntano; lo schermo resta acceso (Wake Lock) se supportato.

### F8 — Stampa
1. *Evento → Stampa menù*: anteprima con formato A4/A5, mostra/nascondi portate vuote,
   nota finale facoltativa.
2. «Stampa» apre la finestra del browser (su Android: Salva come PDF / stampante).

### F9 — Concludere e archiviare
1. Dopo la data, l'app propone «Segna come concluso».
2. «Archivia» crea lo snapshot completo dell'evento (menù, ricette, spesa, piano) e lo
   rende in sola lettura: da qui in poi l'evento si consulta solo dallo snapshot.
3. «Copia nel ricettario» recupera una ricetta archiviata come nuovo piatto.
4. «Riapri» su un evento archiviato segue la procedura di §7.4.

### F10 — Backup e ripristino
1. *Impostazioni → Dati → Esporta backup*: scarica `menuapp-backup-AAAA-MM-GG-HHmm.json`
   (o lo condivide con Web Share, se disponibile).
2. *Ripristina*: scelta del file → validazione → riepilogo (data, versione, conteggi) →
   avviso che i dati attuali saranno sostituiti → l'app salva una copia di sicurezza dei
   dati attuali nel database `menuapp-sicurezza` (passo obbligatorio; il download della
   stessa copia è solo offerto) → ripristino in un'unica transazione → ricarica.
3. *Copie di sicurezza*: elenco delle ultime 3 copie automatiche con data e motivo;
   ciascuna si può scaricare o ripristinare con la stessa procedura.
3. Se l'ultimo backup ha più di 7 giorni e i dati sono cambiati, banner di promemoria.

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
| `#/eventi/:id/stampa` | Stampa menù | Anteprima e opzioni |
| `#/eventi/:id/voci/:voceId/cucina` | Vista cucina | Ricetta alle porzioni della voce |
| `#/ricettario` | Ricettario | Ricerca, elenco piatti, filtro «senza ingredienti» |
| `#/ricettario/nuovo`, `#/ricettario/:id` | Piatto | Scheda; modifica in linea |
| `#/ricettario/:id/cucina` | Vista cucina | Ricetta con porzioni scelte |
| `#/ingredienti` | Catalogo | Ricerca, reparto, sinonimi, unità preferita |
| `#/impostazioni` | Impostazioni | Portate predefinite, coefficiente bambini, reparti, tema |
| `#/impostazioni/dati` | Dati | Backup, ripristino, copie di sicurezza, persistenza, spazio usato, versione app e schema |
| `*` | Non trovata | Link a Eventi |

Requisiti trasversali dell'interfaccia: tema chiaro/scuro/sistema; bersagli di tocco
≥ 44 px; rispetto delle *safe area*; nessuno scroll orizzontale a 360 px; moduli che non
perdono il testo inserito se si cambia scheda; conferma per ogni eliminazione; annulla
(toast «Annulla» per 5 s) per l'eliminazione di voci di menù, attività e articoli manuali.

## 6. Modello dati

### 6.1 Convenzioni

- **ID**: UUID v4 da `crypto.randomUUID()`, stringa. Eccezioni: `settings` (id fisso
  `"settings"`), voci della tabella `meta` (chiave testuale), reparti e ingredienti del
  catalogo iniziale (id stabili `rep-…`, `ing-…` per idempotenza del seed).
- **Timestamp**: `createdAt`, `updatedAt` in millisecondi epoch (`number`). Aggiornati
  sempre dai repository, mai dai componenti.
- **Date di calendario**: stringa locale `YYYY-MM-DD`; **ore**: `HH:mm`. Nessun oggetto
  `Date` o fuso orario per date ed ore di eventi e attività.
- **Quantità**: `number` non arrotondato in archivio; l'arrotondamento esiste solo in
  visualizzazione (§9.4).
- **Testi**: salvati come inseriti (NFC); per ricerche e confronti si usa un campo
  normalizzato (`norm(s)`: minuscolo, senza accenti, spazi compattati, apostrofi
  uniformati).
- **Enumerazioni**: stringhe italiane in `snake_case` (`da_comprare`, `ce_lho`…).

### 6.2 Entità (TypeScript)

```ts
type Id = string
type DataISO = string   // 'YYYY-MM-DD'
type Ora = string       // 'HH:mm'
type Epoch = number

interface Base { id: Id; createdAt: Epoch; updatedAt: Epoch }

// ── Evento ───────────────────────────────────────────────
type TipoEvento = 'pranzo' | 'cena' | 'aperitivo' | 'brunch'
type StatoEvento = 'attivo' | 'concluso' | 'archiviato'

interface Portata { id: Id; nome: string; ordine: number }

interface Event extends Base {
  nome: string
  data: DataISO
  oraServizio: Ora | null
  tipo: TipoEvento
  occasione: string            // testo libero; suggerimenti: Natale, Vigilia, Capodanno,
                               // Pasqua, Compleanno, Anniversario, Domenica in famiglia…
  adulti: number               // intero ≥ 0
  bambini: number              // intero ≥ 0
  coefficienteBambini: number  // 0–1, passo 0,05; copiato dalle impostazioni alla creazione
  note: string
  portate: Portata[]           // copiate dalle predefinite alla creazione, poi per evento
  stato: StatoEvento
  conclusoAt: Epoch | null
  archiviatoAt: Epoch | null
  snapshotCorrenteId: Id | null   // snapshot valido mentre l'evento è archiviato
}

// ── Voce di menù ─────────────────────────────────────────
interface MenuItem extends Base {
  eventId: Id
  portataId: Id                // una delle portate dell'evento
  ordine: number               // 0..n-1 dentro la portata, senza buchi
  nome: string                 // sempre presente, anche se c'è un piatto
  dishId: Id | null
  porzioni: number | null      // null = coperti equivalenti dell'evento
  incaricato: string           // testo libero, '' se nessuno
  inSpesa: boolean             // default true
  note: string
}

// ── Piatto (piatto e ricetta sono la stessa entità) ──────
interface Dish extends Base {
  nome: string
  nomeNorm: string
  portataSuggerita: string | null   // nome di portata, solo come suggerimento
  porzioniBase: number | null       // null = ricetta non scalabile finché non si indica
  tempoPreparazioneMin: number | null
  tempoCotturaMin: number | null
  tempoRiposoMin: number | null
  attrezzature: string[]
  procedimento: string[]            // un passaggio per elemento
  note: string
  fonte: string                     // es. "nonna Pina", libro, sito: solo testo
}

// ── Ingrediente del piatto ───────────────────────────────
type StatoParsing = 'certo' | 'da_verificare' | 'confermato'
type Scalatura = 'proporzionale' | 'fissa'

interface DishIngredient extends Base {
  dishId: Id
  ordine: number
  testoOriginale: string            // riga come scritta o incollata, mai modificata
  nome: string                      // nome come mostrato (es. "parmigiano grattugiato")
  ingredientId: Id | null           // collegamento al catalogo
  quantita: number | null           // null con unita 'qb' o quantità non indicata
  quantitaMax: number | null        // intervalli "2-3": quantita=2, quantitaMax=3
  unita: CodiceUnita | null         // null = numero puro di pezzi ("2 uova") o assente
  scalatura: Scalatura              // 'fissa' = non dipende dalle porzioni
  facoltativo: boolean
  nota: string                      // "tritato", "a temperatura ambiente", "(230 g)"
  statoParsing: StatoParsing
  problemiParsing: string[]         // motivi del 'da_verificare', leggibili
}

// ── Catalogo ingredienti ─────────────────────────────────
interface Ingredient extends Base {
  nome: string                      // canonico, es. "Parmigiano Reggiano"
  nomeNorm: string
  sinonimi: string[]                // es. ["parmigiano", "grana"]
  sinonimiNorm: string[]            // indice multi-valore
  repartoId: Id
  unitaPreferita: CodiceUnita | null
  scalaturaAbituale: Scalatura      // 'fissa' per alloro, chiodi di garofano… (§8.3)
}

// ── Spesa: solo stato e interventi dell'utente ───────────
type StatoSpesa = 'da_comprare' | 'ce_lho' | 'comprato'

interface ShoppingItem extends Base {
  eventId: Id
  tipo: 'calcolato' | 'manuale'
  chiave: string | null             // solo 'calcolato': chiave della riga (§10.2)
  stato: StatoSpesa
  // Fabbisogno che l'utente ha dichiarato coperto segnando 'comprato' o 'ce_lho':
  // è la quantità che la lista MOSTRAVA in quel momento (unità base), NON una quantità
  // acquistata misurata. null per 'da_comprare', per righe senza quantità e per i manuali.
  fabbisognoCoperto: number | null
  // interventi dell'utente
  quantitaUtente: number | null     // correzione manuale (unità base della chiave)
  quantitaCalcolataAllaCorrezione: number | null
  repartoId: Id | null              // override del reparto
  nascosto: boolean                 // riga calcolata tolta dalla vista dall'utente
  inclusa: boolean                  // solo righe facoltative: aggiunta alla spesa (§10.1)
  nota: string                      // anche per annotare acquisti parziali (§10.3)
  // solo 'manuale'
  nome: string
  quantitaTesto: string             // libero: "2 sacchetti"
}

// ── Attività ─────────────────────────────────────────────
interface Task extends Base {
  eventId: Id
  titolo: string
  data: DataISO
  ora: Ora | null
  stato: 'da_fare' | 'fatto'
  menuItemId: Id | null
  note: string
  ordine: number                    // ordine dentro lo stesso giorno senza ora
}

// ── Impostazioni (record unico) ──────────────────────────
interface Reparto { id: Id; nome: string; ordine: number }

interface Settings {
  id: 'settings'
  portatePredefinite: { nome: string; ordine: number }[]
  coefficienteBambini: number       // default 0,5
  reparti: Reparto[]
  backup: { promemoriaGiorni: number }   // default 7; 0 = disattivato
  preferenze: { tema: 'sistema' | 'chiaro' | 'scuro' }
  updatedAt: Epoch
}

// ── Snapshot di evento archiviato ────────────────────────
// Storico AUTONOMO: contiene tutto ciò che serve a mostrare, stampare e consultare
// l'evento archiviato senza leggere altre tabelle. Copie con id originali, nomi già
// risolti (portate, reparti, ingredienti), nessun riferimento da seguire.
interface EventSnapshot extends Base {
  eventId: Id
  stato: 'valido' | 'superato'      // 'superato' dopo una riapertura (resta come storico)
  superatoAt: Epoch | null
  versioneFormato: 1
  evento: Omit<Event, 'createdAt' | 'updatedAt' | 'snapshotCorrenteId'>  // con portate
  copertiEquivalenti: number
  voci: (Omit<MenuItem, 'createdAt' | 'updatedAt'> & {
    portataNome: string
    porzioniEffettive: number
  })[]                              // tutte, con ordine e nomi liberi, anche senza piatto
  piatti: SnapshotPiatto[]          // solo i piatti collegati dalle voci
  spesa: SnapshotRigaSpesa[]        // lista riconciliata come appariva all'archiviazione
  articoliManuali: Omit<ShoppingItem, 'createdAt' | 'updatedAt'>[]
  attivita: Omit<Task, 'createdAt' | 'updatedAt'>[]
}

interface SnapshotPiatto {
  dishId: Id                        // id originale (può non esistere più)
  dati: Omit<Dish, 'createdAt' | 'updatedAt'>
  ingredienti: (Omit<DishIngredient, 'createdAt' | 'updatedAt'> & {
    ingredienteNome: string | null
    repartoNome: string | null
  })[]
}

interface SnapshotRigaSpesa {
  chiave: string; sezione: string; nome: string; reparto: string
  quantita: number | null; unita: CodiceUnita | null; stato: StatoSpesa
  provenienze: string[]             // nomi delle voci di menù
}

// ── Meta (chiave/valore) ─────────────────────────────────
// Due gruppi:
//  - di contenuto, inclusi nel backup: 'seedImpostazioni', 'seedCatalogo' (number: versione del seed applicata)
//  - del dispositivo, ESCLUSI dal backup: 'ultimoBackupAt', 'ultimaModificaAt' (Epoch),
//    'persistenzaRichiesta' (boolean), 'avvisoInstallazioneChiuso' (boolean)
interface Meta { chiave: string; valore: unknown }
```

### 6.3 Schema Dexie (versione 1)

Database `menuapp`. Tutte le tabelle esistono fin dalla v1, anche se usate da milestone
successive, per evitare migrazioni premature.

```ts
db.version(1).stores({
  events:          'id, data, stato, updatedAt',
  menuItems:       'id, eventId, [eventId+portataId], dishId',
  dishes:          'id, nomeNorm, updatedAt',
  dishIngredients: 'id, dishId, ingredientId',
  ingredients:     'id, nomeNorm, *sinonimiNorm, repartoId',
  shoppingItems:   'id, eventId, [eventId+chiave]',
  tasks:           'id, eventId, [eventId+data], menuItemId',
  eventSnapshots:  'id, eventId',
  settings:        'id',
  meta:            'chiave',
})
```

Database separato `menuapp-sicurezza`, schema proprio e stabile
(`copie: '++id, creataAt'`; record `{ creataAt, motivo: 'migrazione' | 'ripristino',
versioneSchema, contenuto }` dove `contenuto` è un file di backup completo nel formato di
§11.1, come stringa). Copie automatiche prima di migrazioni e ripristini (§11.4); tiene le
ultime 3. Essendo un database diverso, non è mai coinvolto nelle migrazioni di `menuapp`.

### 6.4 Integrità referenziale

IndexedDB non ha vincoli: li garantiscono i repository, sempre in transazione.

| Operazione | Effetto |
|---|---|
| Elimina evento | Elimina voci di menù, articoli di spesa, attività, snapshot dell'evento |
| Elimina portata dell'evento | Consentita solo se vuota, oppure spostando le voci in un'altra portata |
| Elimina voce di menù | Le attività collegate restano con `menuItemId = null` |
| Elimina piatto | Le voci collegate restano con `dishId = null` e il loro nome; avviso con elenco eventi; gli snapshot non cambiano |
| Elimina ingrediente di catalogo | Gli ingredienti dei piatti restano con `ingredientId = null` e il loro nome |
| Elimina reparto | Gli ingredienti passano a *Altro*; *Altro* non è eliminabile |

Il ripristino da backup verifica le stesse regole (§11.3).

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
3. evento → `archiviato`, `archiviatoAt`, `snapshotCorrenteId`.

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
2. In un'unica transazione: lo snapshot passa a `superato`, l'evento torna `attivo` con
   `snapshotCorrenteId = null`.
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
- Un ingrediente di catalogo ha nome canonico unico (su `nomeNorm`) e sinonimi unici
  nell'intero catalogo; un conflitto blocca il salvataggio con messaggio.
- Il catalogo iniziale conta **200–250 ingredienti italiani**, ognuno con reparto, unità
  preferita, sinonimi principali e, dove serve, `scalaturaAbituale: 'fissa'` (§8.3).
  Copre tutti i 14 reparti di §7.6 (almeno 5 ingredienti ciascuno, *Altro* escluso).
- Seed **idempotente**: id stabili (`ing-…`), `meta.seedCatalogo` per sapere quale
  versione del seed è stata applicata. Un'esecuzione ripetuta non crea duplicati;
  una versione nuova del seed aggiunge solo gli id mancanti e aggiorna solo le voci mai
  modificate dall'utente (`updatedAt === createdAt`); non elimina nulla. Un ingrediente
  dell'utente con lo stesso `nomeNorm` di una nuova voce del seed vince: la voce del
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

Tutto in `src/domain/spesa/`, funzioni pure senza Dexie né React, con test esaustivi.

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

Gli `ShoppingItem` di tipo `calcolato` nascono **solo** quando l'utente interviene su una
riga (stato, quantità, reparto, nascosto, inclusa, nota). Una riga mai toccata non ha
record: è `da_comprare`.

| Stato | Significato per l'app |
|---|---|
| `da_comprare` | Il fabbisogno mostrato non è coperto |
| `comprato` | L'utente dichiara **coperto** il fabbisogno mostrato in quel momento, comprandolo |
| `ce_lho` | L'utente dichiara **coperto** il fabbisogno mostrato in quel momento, con ciò che ha già |

`fabbisognoCoperto` registra la quantità mostrata (unità base: `quantitaUtente` se
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

Input: righe calcolate, `ShoppingItem` dell'evento. Output: `VoceListaSpesa[]` raggruppate
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

### 11.1 Formato

```json
{
  "formato": "menuapp-backup",
  "versioneFormato": 1,
  "versioneSchema": 1,
  "versioneApp": "1.0.0+abc1234",
  "esportatoAt": "2026-12-01T18:30:00.000Z",
  "conteggi": { "events": 3, "menuItems": 41, "...": 0 },
  "impronta": "sha256:…",
  "dati": {
    "events": [], "menuItems": [], "dishes": [], "dishIngredients": [],
    "ingredients": [], "shoppingItems": [], "tasks": [], "eventSnapshots": [],
    "settings": [], "meta": []
  }
}
```

**Impronta**: `SHA-256` della serializzazione **canonica** di
`{ versioneFormato, versioneSchema, dati }`:
- tabelle nell'ordine fisso sopra; record di ogni tabella ordinati per chiave primaria;
- chiavi degli oggetti ordinate alfabeticamente a ogni livello, ordine degli array
  conservato;
- `JSON.stringify` senza spazi; codifica UTF-8.

La serializzazione canonica rende l'impronta indipendente dall'ordine di lettura e dalla
formattazione del file (un file reindentato a mano resta valido).

**Coerenza con `ultimoBackupAt`**: le chiavi `meta` del dispositivo (`ultimoBackupAt`,
`ultimaModificaAt`, `persistenzaRichiesta`, …, §6.2) **non** fanno parte del backup.
L'esportazione calcola l'impronta su `dati` già privi di quelle chiavi e **dopo** aggiorna
`ultimoBackupAt` nel database: il file e la sua impronta non cambiano per effetto
dell'esportazione stessa, e due esportazioni consecutive senza modifiche producono
`dati` e impronta identici.

### 11.2 Esportazione

- Lettura di tutte le tabelle in **una** transazione in sola lettura (dati coerenti),
  esclusione delle chiavi `meta` del dispositivo, calcolo dell'impronta.
- File `menuapp-backup-AAAA-MM-GG-HHmm.json`; su Android si offre anche la condivisione
  del file (`navigator.share({ files })`) per salvarlo su Drive o inviarlo.
- `ultimoBackupAt` viene aggiornato quando il file è stato consegnato al browser
  (download avviato o condivisione completata). L'app non può sapere se il file è stato
  davvero salvato: il promemoria resta l'ultima difesa.

### 11.3 Ripristino validato

1. Lettura file (max 50 MB) e `JSON.parse` con messaggio chiaro in caso di errore.
2. Controlli dell'intestazione: `formato`, `versioneFormato` supportata,
   `versioneSchema` ≤ versione dell'app (se maggiore: «Backup creato da una versione più
   recente: aggiorna l'app»).
3. **Verifica dell'impronta sui dati originali del file**, prima di qualsiasi
   trasformazione. Se non corrisponde: avviso «file modificato o danneggiato», si
   prosegue solo con conferma esplicita (utile per backup corretti a mano), e il
   riepilogo lo segnala.
4. Migrazione del contenuto alla versione corrente con funzioni pure
   (`migraBackup[v]`), le stesse regole delle migrazioni Dexie. L'impronta non viene
   ricalcolata: si riferisce al file così com'era.
5. Validazione di ogni record con schemi **zod** (tipi, enum, formati data/ora, UUID).
6. Integrità referenziale (§6.4): i riferimenti facoltativi rotti vengono annullati
   (`dishId → null`) e elencati; quelli obbligatori bloccano il ripristino.
7. Riepilogo e conferma (data, versione, conteggi, avvisi).
8. **Copia di sicurezza obbligatoria** dei dati attuali nel database
   `menuapp-sicurezza`, nello stesso formato di §11.1. Se la scrittura fallisce (spazio
   esaurito, errore), il ripristino si interrompe e nulla cambia. Il download della
   stessa copia è **offerto** con un pulsante, ma il ripristino non dipende da esso (il
   browser potrebbe bloccare o ritardare i download automatici).
9. Unica transazione `rw` su tutte le tabelle di `menuapp`: `clear()` + `bulkAdd()`
   per le tabelle di contenuto; per `meta` si eliminano e sostituiscono **solo** le
   chiavi di contenuto, mentre quelle del dispositivo restano. Nella stessa transazione
   `ultimoBackupAt` e `ultimaModificaAt` diventano `esportatoAt` del file (i dati
   coincidono con quel backup, quindi nessun promemoria immediato);
   `persistenzaRichiesta` e le altre chiavi del dispositivo restano invariate. Se la
   transazione fallisce, nulla cambia.
10. Ricarica dell'app.

L'MVP prevede solo «sostituisci tutto». L'unione è rinviata.

### 11.4 Archiviazione persistente e sicurezza

- `navigator.storage.persist()` richiesto al primo salvataggio di dati e
  all'installazione; stato e spazio (`storage.estimate()`) in *Impostazioni → Dati*.
- Promemoria backup: banner se `ultimaModificaAt > ultimoBackupAt` e sono passati più di
  `promemoriaGiorni` dall'ultimo backup.
- Copie di sicurezza: database `menuapp-sicurezza` (§6.3), ultime 3, consultabili,
  scaricabili e ripristinabili da *Impostazioni → Dati*.

**Apertura sicura e copia pre-migrazione** (procedura verificata il 12/11/2026 con Dexie
4.4.7 e Chrome 157, vedi §12.1):

1. `Dexie.exists('menuapp')`: se il database non esiste, apertura normale (creazione e
   seed), fine. `exists` non crea il database.
2. Lettura della versione installata **senza aprire** il database:
   `indexedDB.databases()` → `version` nativa; per Dexie `versione = nativa / 10`.
3. Se la versione installata è uguale a quella del codice: apertura normale.
   Se è maggiore: l'app è più vecchia dei dati (es. scheda rimasta aperta) → schermata
   «Ricarica per aggiornare l'app», nessuna apertura.
4. Se è minore: apertura **in modalità dinamica** (`new Dexie('menuapp')` senza
   `version()`): Dexie apre alla versione esistente, senza `upgradeneeded` e senza
   modificare nulla; lettura di tutte le tabelle e chiusura esplicita (`close()`), che
   evita il blocco dell'apertura successiva.
5. Scrittura della copia (formato §11.1, con la `versioneSchema` installata) in
   `menuapp-sicurezza`. Se fallisce: nessuna migrazione, schermata d'errore con
   «Scarica i dati» (esportazione dalla modalità dinamica) e «Riprova».
6. Apertura dell'istanza tipizzata con tutte le `version(n)`: Dexie esegue gli `upgrade`
   in un'unica transazione di versione; se un `upgrade` lancia un errore, IndexedDB
   annulla tutto e il database resta alla versione precedente con i dati intatti
   (verificato). L'app mostra la schermata d'errore con le stesse azioni.
7. Più schede: l'istanza registra `on('versionchange')` → `close()` e avviso «Ricarica»;
   `on('blocked')` → avviso «Chiudi le altre schede di Menù & Co.».

Regole per le migrazioni: mai modificare una `version(n)` già pubblicata; ogni nuova
versione ha un test che parte da dati fittizi della versione precedente, sia con
fake-indexeddb sia in Chrome (e2e); il formato di backup e le migrazioni del backup
evolvono insieme.

## 12. Architettura tecnica

### 12.1 Stack e versioni verificate (12/11/2026)

| Pacchetto | Versione | Note sulla verifica |
|---|---|---|
| Node | 24.18 (nvm, `.nvmrc`) | engines `>=22.12` |
| TypeScript | **7.0.2** | Installato e funzionante con `tsc -b` e `vite build`. **Strict è attivo per impostazione predefinita** (verificato: TS7006 e TS2322 su un file di prova); lo dichiariamo comunque esplicitamente. Il pacchetto **non espone l'API JavaScript** (`require('typescript').createProgram` è assente): gli strumenti che la richiedono non funzionano. Non la usano: Vite/oxc, Vitest, oxlint, Tailwind. `shadcn` usa `ts-morph`, che porta con sé TypeScript 6.0.2: compatibile. Ripiego documentato: `typescript@~5.9` |
| Vite | 8.3 | solo per sviluppo e build; in produzione i file sono serviti da `scripts/serve.mjs` (Node 24, nessuna dipendenza) |
| React / React DOM | 19.3 | |
| @vitejs/plugin-react | 6.1 | peer `vite ^8` |
| Tailwind CSS + @tailwindcss/vite | 4.3.5 | peer `vite ^5–^8` |
| shadcn (CLI, via `npx`) | 4.23 | componenti copiati nel progetto; dipendenze: `radix-ui` 1.8, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` |
| Dexie / dexie-react-hooks | 4.4.7 / 4.4.0 | `useLiveQuery`. Procedura di §11.4 provata in Chrome 157 headless: `Dexie.exists` non crea il DB; `indexedDB.databases()` restituisce versione nativa 10 per la v1 Dexie; l'apertura dinamica legge i dati senza upgrade; un `upgrade` che lancia un errore lascia DB e dati alla versione precedente |
| react-router | 8.5 | solo `createHashRouter` (peer React ≥ 19.2.7) |
| zod | 4.6 | validazione backup e moduli |
| vite-plugin-pwa / @vite-pwa/assets-generator | 2.0 / 1.x | |
| Vitest | 5.1 | peer `vite ^6–^8`, `@types/node ^22 ∥ ≥24` |
| happy-dom / @testing-library/react | 21 / 16.3 | componenti |
| fake-indexeddb | 6.2 | test Dexie in Node |
| @playwright/test | 1.65 | con **Chrome di sistema** (`channel: 'chrome'`, v157): niente download di browser; i Chromium in `~/.cache/ms-playwright` (rev. 1228) sono troppo vecchi |
| oxlint | 1.90 | |
| @dnd-kit/core, sortable (M1) | da fissare in M1 | riordino con tocco prolungato; già usato in dailyMeals |
| @fontsource-variable (M4) | da fissare in M4 | font serif per la stampa, inclusi nel bundle (offline) |

Gli avvisi `npm audit` attuali (glob/minimatch via workbox-build) riguardano solo la build,
non il codice distribuito.

Configurazione TypeScript aggiuntiva: `strict`, `noUncheckedIndexedAccess`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`, alias `@/*` → `src/*`.

### 12.2 Struttura delle cartelle

```
src/
  app/            App, router, layout (AppShell, navigazione), provider, pagina errore
  components/ui/  componenti shadcn (generati)
  components/     componenti condivisi (ConfermaElimina, CampoQuantita, Vuoto…)
  domain/         logica pura, senza React né Dexie
    tempo.ts        date locali, scelte rapide
    unita.ts        catalogo unità, famiglie, conversioni, formattazione
    porzioni.ts     coperti equivalenti, fattore, scalatura
    parser/         analizzaRiga, numeri in parola, casi di test
    spesa/          calcolaSpesa, chiavi, riconciliaSpesa, testoCondivisione
    snapshot.ts     creazione dello snapshot completo, piatti cambiati dopo l'archiviazione
    schemi.ts       schemi zod delle entità
  db/
    db.ts           istanza Dexie, versioni, apertura sicura
    seed/           impostazioni, reparti, catalogo ingredienti
    repo/           un modulo per entità: letture e scritture in transazione
    backup/         esporta, valida, migra, ripristina
    sicurezza.ts    database delle copie di sicurezza
  features/
    eventi/  menu/  ricettario/  ingredienti/  spesa/  piano/  cucina/  stampa/
    impostazioni/
  pwa/            avviso aggiornamento, installazione, persistenza
  styles/         index.css (Tailwind, token del tema, stampa)
test/e2e/         Playwright
scripts/          serve.mjs, installa-servizio.sh, rilascia.sh, ripristina-rilascio.sh
rilasci/          build di produzione (fuori da Git), collegamento `attuale`
```

### 12.3 Regole architetturali

- **Dominio puro**: `src/domain` non importa React, Dexie, `window`. Tutta la logica con
  regole (porzioni, parser, spesa, snapshot, validazione) sta lì ed è testata.
- **Accesso ai dati solo dai repository** (`src/db/repo`). I componenti leggono con
  `useLiveQuery` tramite hook di feature (`useEvento(id)`, `useListaSpesa(eventId)`) e
  scrivono chiamando funzioni dei repository. Niente store globale: lo stato condiviso è
  il database (reattivo) più l'URL.
- Ogni scrittura multi-tabella è una transazione Dexie.
- I repository impostano `updatedAt` e `meta.ultimaModificaAt`.
- Stato effimero della vista cucina (spunte) in `sessionStorage`.
- Nessuna chiamata di rete a runtime: font, icone e dati inclusi nel bundle.

## 13. PWA e funzionamento offline

- `vite-plugin-pwa` in modalità `generateSW` con **`registerType: 'prompt'`**: la nuova
  versione si installa in background e l'app mostra «Nuova versione disponibile —
  Aggiorna». L'aggiornamento non avviene mai da solo (si potrebbe essere a metà di una
  ricetta). Se ci sono modifiche non salvate in un modulo, l'aggiornamento chiede conferma.
- Controllo aggiornamenti all'avvio, al ritorno in primo piano e ogni ora, solo se il
  server è raggiungibile (Tailscale attivo); in caso contrario nessun errore visibile.
- Precache di tutti gli asset (JS, CSS, HTML, icone, font). `navigateFallback:
  'index.html'`. L'hash routing evita problemi di rotte profonde.
- Avviso «Pronta per l'uso offline» alla prima installazione del service worker.
- Manifest: `name` e `short_name` «Menù & Co.», `id: '/'`, `scope: '/'`,
  `start_url: '/'`, `lang: 'it'`, `display: 'standalone'`, colori tema chiaro, icone
  64/192/512 + maskable 512, `shortcuts` verso *Nuovo evento* e *Ricettario* (M4).
- `base: '/'` in tutte le modalità: l'app è servita alla radice della propria origine.
- Versione visibile in *Impostazioni → Dati*: `versione package + hash del commit`
  iniettati in build (`define`), più l'identificativo del rilascio servito.
- **Installazione**: da Chrome (Android o PC) con Tailscale attivo, aprire
  `https://loris-srv01.dala-tortoise.ts.net:9870/` → menu → *Installa app*. Dopo
  l'installazione l'app si apre e funziona **anche con Tailscale spento o senza rete**:
  tutto è in cache e i dati sono nel browser. Tailscale serve solo per installare e per
  ricevere aggiornamenti.
- **Dove stanno i dati**: in IndexedDB del browser di ciascun dispositivo, mai sul
  server. Il server distribuisce solo file statici; perdere il server non fa perdere dati,
  e il backup resta la protezione dei dati (§11).
- **Origini e dati**: IndexedDB è legato all'origine (schema + host + porta).

  | Uso | Origine | Dati |
  |---|---|---|
  | Produzione | `https://loris-srv01.dala-tortoise.ts.net:9870` | reali |
  | Sviluppo da Android | `https://loris-srv01.dala-tortoise.ts.net:8443` | di prova |
  | Sviluppo da PC (tunnel) | `http://localhost:5173` | di prova |
  | Anteprima di collaudo | `https://loris-srv01.dala-tortoise.ts.net:8444` | di prova |
  | Test e2e | `http://127.0.0.1:4174` | temporanei |

  L'origine di produzione è **definitiva**: cambiarne host o porta dopo l'uso reale
  richiede di spostare i dati con backup e ripristino su ogni dispositivo.

## 14. Hosting e rilascio

Tutto sul server Debian `loris-srv01`, nella directory `/srv/apps/menuapp`, come le altre
applicazioni (dailyMeals, sharedKidsCalendar). Nessun servizio cloud; GitHub è solo il
repository del codice.

### 14.1 Architettura di produzione

```
 Telefono / PC (tailnet)                         loris-srv01
 ───────────────────────     HTTPS (cert. Let's Encrypt di Tailscale)
 Chrome ──── tailnet ────▶ tailscaled  100.114.50.37:9870  (tailscale serve)
                                    │  HTTP in chiaro, solo loopback
                                    ▼
                           node scripts/serve.mjs  127.0.0.1:9870
                                    │  file statici
                                    ▼
                           /srv/apps/menuapp/rilasci/attuale → rilasci/<id>/
```

- **Server statico**: `scripts/serve.mjs`, script Node senza dipendenze (solo
  `node:http`, `node:fs`, `node:path`), sullo stesso modello di `serve.mjs` di dailyMeals
  e sharedKidsCalendar. Ascolta **solo su `127.0.0.1:9870`**: non raggiungibile da LAN
  né da Internet.
- **HTTPS**: `tailscale serve --bg --https=9870 http://127.0.0.1:9870`. tailscaled
  ascolta sulla stessa porta ma sull'indirizzo del tailnet (100.114.50.37 e IPv6
  Tailscale), quindi non c'è conflitto con il loopback (verificato: due socket sulla
  stessa porta con indirizzi diversi coesistono). Il certificato è emesso e rinnovato
  da Tailscale. La configurazione `--bg` persiste ai riavvii. **Mai `tailscale funnel`.**
- **Perché non Apache**: è già attivo sulla porta 80 per altri usi e il suo
  `ports.conf` contiene `Listen 443` (inattivo finché `mod_ssl` è spento). Aggiungere un
  sito o un proxy richiederebbe di modificarne la configurazione e ricaricarlo, cioè di
  toccare un servizio condiviso. Il server Node dedicato è isolato: un errore di Menù &
  Co. non tocca nulla d'altro.
- **Perché non `vite preview`**: è pensato per anteprime, non per un servizio
  permanente; il server dedicato controlla con precisione intestazioni di cache e
  sicurezza.

### 14.2 Server statico (`scripts/serve.mjs`)

| Aspetto | Comportamento |
|---|---|
| Configurazione | Variabili `HOST` (default `127.0.0.1`), `PORT` (default `9870`), `RADICE` (default `rilasci/attuale`) |
| Metodi | Solo `GET` e `HEAD`; altri → 405 |
| Percorsi | Decodifica, normalizzazione e `realpath` dentro la radice risolta; ogni uscita (`..`, link simbolici esterni) → 404. Nessun elenco di cartelle |
| Radice | La radice (`rilasci/attuale`) viene risolta a ogni richiesta, così il cambio di rilascio non richiede riavvio |
| `/` | `index.html`. Nessun altro fallback (hash routing): file inesistente → 404 |
| Tipi MIME | Tabella interna: html, js, mjs, css, json, webmanifest (`application/manifest+json`), svg, png, ico, woff2, txt |
| Cache | `index.html`, `sw.js`, `registerSW.js`, `manifest.webmanifest`, `workbox-*.js` → `Cache-Control: no-cache`; `assets/*` (nomi con hash) → `public, max-age=31536000, immutable`; altro → `no-cache` |
| Sicurezza | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy` minima, `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'` (lo script inline del tema, se presente, va spostato in un file) |
| Salute | `GET /__salute` → `200` con `{ rilascio, versione }` letti da `rilasci/attuale/rilascio.json`; usato dai controlli dopo il rilascio |
| Log | Una riga per richiesta con errore (≥ 400) e all'avvio, su stdout → journald |
| Arresto | Chiusura ordinata su `SIGTERM` |

### 14.3 Servizio systemd

Servizio **utente** `menuapp.service` (come `dailymeals.service` e
`kidscalendar.service`; *linger* già attivo per `loris`, quindi parte all'avvio del
server senza login), file `~/.config/systemd/user/menuapp.service` installato da
`scripts/installa-servizio.sh`:

```ini
[Unit]
Description=Menù & Co. (file statici di produzione)
Documentation=file:///srv/apps/menuapp/docs/SPEC.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/srv/apps/menuapp
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=9870
ExecStart=/home/loris/.nvm/versions/node/v24.18.0/bin/node /srv/apps/menuapp/scripts/serve.mjs
Restart=on-failure
RestartSec=3
TimeoutStopSec=10
NoNewPrivileges=yes
PrivateTmp=yes

[Install]
WantedBy=default.target
```

Il percorso di Node è fissato come negli altri servizi: un cambio di versione di Node
via nvm richiede di aggiornare il servizio (`installa-servizio.sh` lo rigenera).

### 14.4 Rilasci

- Struttura: `rilasci/<AAAAMMGG-HHmm>-<hash>/` (contenuto di `dist/` + `rilascio.json`)
  e il collegamento simbolico `rilasci/attuale`. La cartella `rilasci/` è in
  `.gitignore`.
- `scripts/rilascia.sh`:
  1. verifica: albero Git pulito, ramo `main`, `npm run check` verde;
  2. `vite build` in una cartella temporanea, poi copia in `rilasci/<id>/`;
  3. cambio **atomico** del collegamento (`ln -sfn` su un nome temporaneo + `mv -T`);
  4. controllo: `curl` su `http://127.0.0.1:9870/__salute` e su
     `https://loris-srv01.dala-tortoise.ts.net:9870/` (rilascio atteso, intestazioni
     `no-cache` su `sw.js`);
  5. tiene gli ultimi 5 rilasci.
- `scripts/ripristina-rilascio.sh <id>`: riporta `attuale` a un rilascio precedente.
  I dati dei dispositivi non sono toccati; attenzione però alle migrazioni dello schema:
  un rilascio più vecchio dello schema già installato sui dispositivi mostra «Ricarica per
  aggiornare l'app» (§11.4, passo 3). Si torna indietro solo fra rilasci con lo stesso
  schema.
- Il rilascio **non** riavvia il servizio. I dispositivi ricevono l'avviso di
  aggiornamento al successivo controllo (§13).
- Ogni rilascio richiede l'autorizzazione di Loris; il tag Git (`v0.N.0`) si crea
  localmente e si pubblica su GitHub solo se autorizzato.

### 14.5 Accesso e autorizzazioni (Tailscale)

- La porta 9870 è raggiungibile solo dai dispositivi del tailnet tramite
  `tailscale serve`. Il server non ha firewall, ma `serve.mjs` ascolta solo su loopback
  e la porta del tailnet esiste solo dentro Tailscale.
- **Chi accede** si decide nella policy del tailnet (console di amministrazione
  Tailscale, *Access controls*), che filtra il traffico **prima** che arrivi a
  `tailscale serve`. Oggi il tailnet ha un solo utente (`loris.carzaniga@gmail.com`) e
  la policy predefinita consente tutto fra i suoi dispositivi.
- Regola proposta, da aggiungere quando serve limitare per dispositivo o aprire ad altre
  persone (una *grant* per porta):

  ```jsonc
  {
    "groups": { "group:menuapp": ["loris.carzaniga@gmail.com"] },
    "hosts":  { "loris-srv01": "100.114.50.37" },
    "grants": [
      { "src": ["group:menuapp"], "dst": ["loris-srv01"], "ip": ["tcp:9870"] }
    ]
  }
  ```

  Per limitare a dispositivi specifici: `src` con gli IP Tailscale dei dispositivi (o
  tag come `tag:telefono`), oppure condizioni di postura. Per un familiare: invito nel
  tailnet o condivisione del solo nodo `loris-srv01`, più la sua email in
  `group:menuapp`.
- **Attenzione**: quando la policy predefinita «consenti tutto» viene sostituita, ogni
  accesso non elencato viene bloccato, anche per gli altri servizi del server (SSH 22,
  RDP 3389/3390, dailyMeals 9876, sharedKidsCalendar 9878, Samba, open-webui 3000,
  lobe-chat 3210, sviluppo 8443). La modifica va fatta da Loris nella console, con le
  regole esistenti riportate esplicitamente; Claude prepara la proposta ma non può né
  deve applicarla.

### 14.6 Sviluppo e collaudo

- Sessione tmux `menuapp`.
- Vite su `127.0.0.1:5173`, mai su `0.0.0.0` (il server non ha firewall).
  - PC: `https://loris-srv01.dala-tortoise.ts.net:8443/` (il PC è nel tailnet), oppure
    `ssh -L 5173:localhost:5173 loris@loris-srv01.dala-tortoise.ts.net` →
    `http://localhost:5173/`.
  - Android: `tailscale serve --bg --https=8443 http://127.0.0.1:5173` (già attivo).
- Collaudo della build prima del rilascio (service worker, offline, installazione,
  aggiornamento): `npm run build && npm run preview` su `127.0.0.1:4173`, esposto con
  `tailscale serve --bg --https=8444 http://127.0.0.1:4173` solo durante il collaudo,
  poi `tailscale serve --https=8444 off`.
- Test e2e: anteprima isolata su `127.0.0.1:4174` (§17.3), più un controllo finale sul
  servizio di produzione dopo ogni rilascio.

### 14.7 Git e GitHub

- GitHub (`lcarzaniga/Menuapp`) resta il repository del codice. Nessun push, merge o tag
  pubblicato senza autorizzazione esplicita.
- `main` è sempre rilasciabile; un branch per milestone (`m0-fondamenta`,
  `m1-eventi-menu`, `m2-ricettario`, `m3-spesa`, `m4-piano-stampa`); commit piccoli in
  italiano; merge su `main` solo con `npm run check` verde e approvazione di Loris.
- **GitHub Pages dismesso**: si eliminano il workflow `deploy.yml` e `base: '/Menuapp/'`.
  Al loro posto un workflow `ci.yml` di soli controlli (lint, typecheck, test unitari,
  build) su push e pull request, senza pubblicazione. La disattivazione di Pages nelle
  impostazioni del repository è un'azione di Loris.

## 15. Roadmap

| Milestone | Date | Contenuto | Uscita |
|---|---|---|---|
| **M0 — Fondamenta** | 13–17 nov | Toolchain, Tailwind/shadcn, navigazione, schema Dexie v1 completo, seed impostazioni e reparti, backup/ripristino, persistenza, PWA con avviso aggiornamento, test unitari ed e2e, CI di soli controlli, servizio di produzione sul server (porta 9870, systemd, `tailscale serve`), rilasci | `v0.1.0` |
| **M1 — Eventi e menù** | 18–23 nov | Eventi (CRUD, stati senza archiviazione), coperti, portate per evento, voci di menù, inserimento rapido multiriga, riordino e spostamento; impostazioni modificabili: portate predefinite, coefficiente bambini, tema | `v0.2.0` |
| **M2 — Ricettario** | 24 nov – 1 dic | Unità, catalogo di 200–250 ingredienti con seed idempotente, parser, piatti, ingredienti con anteprima e conferma, porzioni e scalatura, «Crea nel ricettario», vista cucina; gestione dei reparti (coerente con il catalogo) | `v0.3.0` |
| **M3 — Spesa** | 2–7 dic | Calcolo con classificazione dei contributi, chiavi, riconciliazione, stati e fabbisogno coperto, correzioni, facoltativi, manuali, reparti, condivisione | `v0.4.0` |
| **M4 — Piano e stampa** | 8–12 dic | Attività e checklist, archiviazione con snapshot completo, consultazione da snapshot, «Copia nel ricettario», riapertura semplice, stampa del menù, collaudo completo | `v0.5.0` |
| **Collaudo reale** | 13–15 dic | Menù di Natale vero inserito sul telefono, backup, correzioni | `v1.0.0` (15 dic) |

Tagli previsti in caso di ritardo, in quest'ordine: trascinamento (restano Su/Giù) →
formato A5 → Wake Lock → condivisione file del backup → suggerimenti R10 → scorciatoie
del manifest.

## 16. Criteri di accettazione

### Generali (v1.0)
- G1 Tutti i flussi F1–F10 eseguibili su Chrome Android (S23) installato come PWA e su
  Chrome desktop.
- G2 Con modalità aereo attiva, dopo il primo caricamento, l'app si apre e ogni
  funzione è utilizzabile.
- G3 Nessuna perdita di dati in: chiusura forzata durante un salvataggio, aggiornamento
  dell'app, migrazione, ripristino fallito.
- G4 Backup → ripristino su un'altra origine (es. dal telefono al PC) riproduce dati identici (stessa impronta).
- G8 L'app è raggiungibile solo dal tailnet: `127.0.0.1:9870` non è visibile dalla LAN, nessun `funnel` attivo; il servizio riparte da solo dopo un errore e dopo il riavvio del server; gli altri servizi del server non sono stati modificati.
- G5 `npm run check` (lint, typecheck, unit, build) verde; e2e verdi.
- G6 Lighthouse PWA/Best Practices senza errori bloccanti; nessuna richiesta di rete a
  runtime oltre agli asset dell'app.
- G7 Usabile a 360 px di larghezza, in tema chiaro e scuro.

### Per area
- **Menù**: aggiungere 10 voci in 4 portate richiede meno di 60 s; nessun piatto creato
  senza azione esplicita (verificato da test).
- **Porzioni**: con 8 adulti, 4 bambini e coefficiente 0,5 una voce senza porzioni ha 10
  porzioni; cambiando i bambini a 6 diventa 11; una voce con 6 porzioni resta 6.
- **Parser**: criteri di §8.4; il testo originale è sempre visibile e conservato.
- **Spesa**: tutti i casi R1–R10 e le sei classi di contributo di §10.1 coperti da test
  unitari; nessun contributo incerto, senza quantità o di un piatto senza porzioni base
  entra in un totale, e ognuno resta visibile con la sua provenienza; nessun testo
  dell'interfaccia attribuisce all'utente quantità possedute o acquistate; scenario e2e
  «segno comprato il burro, aumento i coperti, vedo *Da integrare* con il fabbisogno in
  più; tolgo il piatto, il burro compare in *Non più necessari*».
- **Snapshot**: dopo l'archiviazione, modificare o eliminare un piatto, una voce o
  un'attività viva non cambia nulla di ciò che l'evento archiviato mostra (menù completo
  con portate, ordine e nomi liberi, ricette, spesa, piano); la riapertura non modifica
  alcun piatto del ricettario.
- **Backup**: un file manomesso (enum non valido, riferimento rotto, schema futuro) viene
  rifiutato con un messaggio comprensibile e i dati attuali restano intatti; impronta
  verificata sul file originale; due esportazioni consecutive senza modifiche hanno la
  stessa impronta; il ripristino non parte se la copia di sicurezza non è stata scritta.
- **Stampa**: menù di Natale su una pagina A4 senza tagli, leggibile in bianco e nero.

## 17. Test automatici e manuali

### 17.1 Unitari (Vitest, ambiente Node)
- `domain/porzioni`: coperti, fattore, casi limite (0, decimali, fissa, intervalli).
- `domain/unita`: riconoscimento forme, famiglie, conversioni consentite e **vietate**
  (test che verificano che cucchiaio→ml e confezione→g non esistano), formattazione.
- `domain/parser`: tabella ≥ 100 casi (§8.4), numeri in parola, frazioni, nomi con cifre.
- `domain/spesa`: classificazione dei contributi (§10.1, una prova per riga della
  tabella), chiavi, ogni caso R1–R10, facoltativi inclusi/non inclusi, idempotenza
  (riconciliare due volte dà lo stesso risultato), proprietà semplici (somma delle
  provenienze `sommata` = totale; nessun contributo `da_verificare` nei totali).
- `domain/snapshot`: lo snapshot contiene evento, portate, tutte le voci (anche senza
  piatto), piatti, spesa, manuali, attività; è serializzabile e autonomo (nessun id da
  risolvere per mostrarlo).
- `db/backup`: serializzazione canonica (ordine di tabelle, record e chiavi), impronta
  stabile su esportazioni ripetute, chiavi `meta` del dispositivo escluse, impronta
  verificata prima della migrazione del formato.
- `db` con fake-indexeddb: seed idempotente (impostazioni in M0, catalogo in M2),
  repository (cascata eliminazioni), migrazioni (dati vN → vN+1), copia pre-migrazione,
  backup ida e ritorno, ripristino che fallisce senza toccare i dati, ripristino
  annullato se la copia di sicurezza non viene scritta.

- `scripts/serve.mjs` (Node, server avviato su porta casuale con una radice di prova):
  tipi MIME, intestazioni di cache per `sw.js`/`index.html`/`assets/*`, intestazioni di
  sicurezza, 404 per file assenti, tentativi di uscita dalla radice (`..`, codifiche,
  collegamenti simbolici esterni) respinti, 405 per metodi diversi da GET/HEAD, cambio del
  collegamento `attuale` visto senza riavvio, `/__salute`.

### 17.2 Componenti (Vitest + happy-dom + Testing Library)
Moduli evento, inserimento rapido, anteprima parser, riga della spesa (cambio stato).

### 17.3 End-to-end (Playwright, Chrome di sistema)
Server di anteprima isolato su `127.0.0.1:4174`; progetti *Pixel 7* (mobile) e *Desktop*.
Scenari: avvio e navigazione; evento → menù → piatto → ingredienti → spesa; riconciliazione
dopo modifica del menù; backup e ripristino; apertura sicura in Chrome reale (DB v1 di
prova → app con v2 di prova: copia in `menuapp-sicurezza`, upgrade, e upgrade che fallisce
con dati intatti); offline dopo l'installazione del service
worker (`context.setOffline(true)` + ricarica); avviso di aggiornamento (due build
consecutive); stampa (`emulateMedia({ media: 'print' })` + screenshot).

Dopo ogni rilascio, controllo automatico in `rilascia.sh` sul servizio vero: `/__salute`
su loopback e via `https://loris-srv01.dala-tortoise.ts.net:9870/`, certificato valido,
`Cache-Control: no-cache` su `sw.js`, porta 9870 assente sugli indirizzi LAN
(`ss -tln`).

### 17.4 Manuali (su Android, a fine milestone)
Installazione da `:8444` e da produzione (`:9870`) · modalità aereo e Tailscale spento ·
avviso aggiornamento dopo un rilascio · ritorno a un rilascio precedente · stato persistenza · condivisione spesa su WhatsApp/Keep · schermo acceso in
vista cucina · stampa/Salva PDF · tastiera e tocco su moduli · tema scuro · ripristino
di un backup da file scaricato.

Una lista di controllo per milestone sta in `docs/collaudo/Mn.md`.

## 18. Rischi tecnici

| Rischio | Prob. | Impatto | Mitigazione |
|---|---|---|---|
| Ecosistema non pronto per TypeScript 7 (assenza dell'API JS) | Media | Medio | Verificato in M0 (T1); ripiego `typescript@~5.9` con una sola modifica a `package.json` |
| Cancellazione dei dati da parte del browser (spazio, pulizia) | Bassa | Alto | Persistenza richiesta, PWA installata, promemoria backup, condivisione del file su Drive |
| Cambio dell'origine di produzione (host o porta) dopo l'uso reale | Bassa | Alto | Origine `…ts.net:9870` decisa prima di M0 e considerata definitiva; in caso di cambio, backup/ripristino su ogni dispositivo |
| Server o Tailscale non disponibili | Bassa | Basso | L'app installata funziona offline; mancano solo installazione e aggiornamenti |
| Policy Tailscale troppo restrittiva che blocca altri servizi | Media | Medio | Modifica fatta da Loris con le regole esistenti elencate (§14.5); proposta preparata e rivista prima |
| `tailscale serve` rimosso o reimpostato per errore | Bassa | Medio | Comando documentato in `scripts/installa-servizio.sh`; controllo HTTPS in `rilascia.sh` |
| Aggiornamento di Node con nvm che rompe il servizio | Bassa | Medio | Percorso fissato nell'unità, rigenerato da `installa-servizio.sh`; servizio con `Restart=on-failure` e log in journald |
| Ritorno a un rilascio con schema più vecchio di quello sui dispositivi | Bassa | Medio | `ripristina-rilascio.sh` solo fra rilasci con lo stesso schema; l'app rileva il caso (§11.4) |
| Service worker che serve una versione vecchia o resta bloccato | Media | Medio | `registerType: 'prompt'`, controllo periodico, pulsante «Verifica aggiornamenti», test e2e di aggiornamento |
| Migrazione Dexie errata in produzione | Bassa | Alto | Copia di sicurezza pre-migrazione, test di migrazione obbligatori, upgrade atomici |
| Parser troppo ottimista | Media | Medio | Regola «nel dubbio da verificare», tabella di casi reali, conferma manuale |
| Riconciliazione confusa per l'utente | Media | Medio | Casi R1–R10 esplicitati, testi chiari, prova reale col menù di Natale nel collaudo |
| Scadenza del 15 dicembre | Media | Alto | Milestone con uscita pubblicata, tagli ordinati (§15), dominio puro testato prima dell'interfaccia |
| Stampa diversa fra Chrome Android e desktop | Media | Basso | CSS di stampa semplice, font incluso, prova su entrambi |
| Browser di Playwright non allineati | Bassa | Basso | Uso del Chrome di sistema (`channel: 'chrome'`) |
| Più schede aperte con versioni diverse | Bassa | Medio | Gestione `versionchange`, `useLiveQuery` per aggiornamenti reattivi |
| Floating point nelle somme | Bassa | Basso | Somme in unità base, tolleranza nei confronti, arrotondamento solo in vista |
| `indexedDB.databases()` non disponibile (browser vecchi) | Bassa | Medio | Supportato da Chrome (obiettivo); ripiego: apertura dinamica per leggere `verno` prima di aprire con lo schema tipizzato |
| «Comprato» letto come quantità posseduta | Media | Medio | Semantica di fabbisogno coperto (§10.3), testi che non parlano mai di quantità possedute, acquisti parziali solo in nota |

---

### Registro delle modifiche

| Data | Modifica |
|---|---|
| 12/11/2026 | Prima versione consolidata |
| 12/11/2026 | Revisione 1: impronta canonica verificata prima della migrazione e chiavi `meta` del dispositivo escluse dal backup; copia di sicurezza nel DB `menuapp-sicurezza` obbligatoria prima del ripristino, download solo offerto; `quantitaAlloStato` → `fabbisognoCoperto` con semantica di fabbisogno dichiarato coperto, acquisti parziali in nota; classificazione dei contributi della spesa (incompleti visibili e mai sommati, facoltativi separati con `inclusa`); snapshot autonomo con menù completo, piano e spesa; riapertura semplificata e «Copia nel ricettario»; catalogo 200–250 ingredienti; procedura di apertura sicura verificata con Dexie 4.4.7; ripristino che conserva le chiavi `meta` del dispositivo; impostazioni modificabili assegnate a M1 (portate, coefficiente, tema) e M2 (reparti) |
| 12/11/2026 | Revisione 2: GitHub Pages dismesso; produzione sul server Debian in `/srv/apps/menuapp`, server statico Node `scripts/serve.mjs` su `127.0.0.1:9870` come servizio systemd utente, HTTPS e accesso solo tailnet con `tailscale serve --https=9870`, regole di accesso nella policy Tailscale, rilasci in `rilasci/` con cambio atomico, `base: '/'`, CI di soli controlli |
