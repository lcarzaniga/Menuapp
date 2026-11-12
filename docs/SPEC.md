# Menù & Co. — Specifica tecnica consolidata

| | |
|---|---|
| Versione documento | 1.0 — 12 novembre 2026 |
| Stato | Approvata in principio, da rivedere a fine M0 |
| Repository | `github.com/lcarzaniga/Menuapp` |
| Pubblicazione | https://lcarzaniga.github.io/Menuapp/ |
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
| PWA | Installabile, offline completo, avviso di nuova versione con aggiornamento su richiesta |

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
2. «Archivia» crea lo snapshot delle ricette usate e rende l'evento in sola lettura.
3. «Riapri» su un evento archiviato segue la procedura di §7.4.

### F10 — Backup e ripristino
1. *Impostazioni → Dati → Esporta backup*: scarica `menuapp-backup-AAAA-MM-GG-HHmm.json`
   (o lo condivide con Web Share, se disponibile).
2. *Ripristina*: scelta del file → validazione → riepilogo (data, versione, conteggi) →
   avviso che i dati attuali saranno sostituiti → l'app scarica prima una copia dei dati
   attuali → ripristino in un'unica transazione → ricarica.
3. Se l'ultimo backup ha più di 7 giorni e i dati sono cambiati, banner di promemoria.

## 5. Schermate

Navigazione con **hash routing** (`https://lcarzaniga.github.io/Menuapp/#/…`).
Su telefono: barra inferiore con *Eventi · Ricettario · Ingredienti · Impostazioni*.
Da 768 px: barra laterale con le stesse voci. Il contenuto dell'evento usa schede.

| Rotta | Schermata | Contenuto principale |
|---|---|---|
| `#/` | Eventi | Prossimi eventi (attivi), conclusi, link all'archivio; pulsante Nuovo |
| `#/eventi/archivio` | Archivio | Eventi archiviati |
| `#/eventi/nuovo` | Nuovo evento | Modulo evento |
| `#/eventi/:id` | Evento — Panoramica | Dati, coperti equivalenti, stato, avvisi, azioni (concludi, archivia, riapri, elimina, stampa) |
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
| `#/impostazioni/dati` | Dati | Backup, ripristino, persistenza, spazio usato, versione app e schema |
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
}

// ── Spesa: solo stato e interventi dell'utente ───────────
type StatoSpesa = 'da_comprare' | 'ce_lho' | 'comprato'

interface ShoppingItem extends Base {
  eventId: Id
  tipo: 'calcolato' | 'manuale'
  chiave: string | null             // solo 'calcolato': chiave di aggregazione (§10.2)
  stato: StatoSpesa
  // stato della riga calcolata quando l'utente l'ha toccata
  quantitaAlloStato: number | null  // quantità calcolata (unità base) al cambio di stato
  // interventi dell'utente
  quantitaUtente: number | null     // correzione manuale (unità base della chiave)
  quantitaCalcolataAllaCorrezione: number | null
  repartoId: Id | null              // override del reparto
  nascosto: boolean                 // riga calcolata tolta dalla vista dall'utente
  nota: string
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
interface EventSnapshot extends Base {
  eventId: Id
  stato: 'valido' | 'superato'      // 'superato' dopo una riapertura
  superatoAt: Epoch | null
  versioneFormato: 1
  coperti: { adulti: number; bambini: number; coefficiente: number; equivalenti: number }
  piatti: SnapshotPiatto[]
  spesa: SnapshotRigaSpesa[]        // lista calcolata e stati al momento dell'archiviazione
}

interface SnapshotPiatto {
  dishId: Id                        // id originale (può non esistere più)
  dati: Omit<Dish, 'createdAt' | 'updatedAt'> & { updatedAtOriginale: Epoch }
  ingredienti: (Omit<DishIngredient, 'createdAt' | 'updatedAt'> & {
    ingredienteNome: string | null
    repartoNome: string | null
  })[]
}

interface SnapshotRigaSpesa {
  chiave: string; nome: string; reparto: string
  quantita: number | null; unita: CodiceUnita | null; stato: StatoSpesa
}

// ── Meta (chiave/valore) ─────────────────────────────────
// 'seedVersione' (number), 'ultimoBackupAt' (Epoch), 'ultimaModificaAt' (Epoch),
// 'persistenzaRichiesta' (boolean)
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

Database separato `menuapp-sicurezza` (tabella `copie: '++id, creataAt'`): copie JSON
automatiche prima di migrazioni e ripristini (§11.4). Tiene le ultime 3.

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
| `archiviato` | Nulla, tranne riapertura ed eliminazione | Ricette mostrate dallo snapshot; stampa e vista cucina disponibili |

**Archiviazione** (in un'unica transazione):
1. calcolo della lista della spesa corrente con i suoi stati;
2. creazione di un `EventSnapshot` con stato `valido`, copia profonda di tutti i piatti
   collegati dalle voci dell'evento (con ingredienti, nomi di catalogo e reparti
   risolti), coperti e spesa;
3. evento → `archiviato`, `archiviatoAt`, `snapshotCorrenteId`.

Da quel momento le modifiche o eliminazioni dei piatti nel ricettario non alterano ciò che
l'evento archiviato mostra.

### 7.4 Riapertura di un evento archiviato

La riapertura riporta l'evento allo stato **`attivo`** e lo ricollega al ricettario vivo:
un piatto resta una sola entità condivisa fra eventi, non esistono versioni.

1. L'app confronta ogni piatto dello snapshot con il ricettario attuale e mostra un
   riepilogo:
   - **Invariato** (`updatedAt` uguale): nessuna scelta.
   - **Modificato dopo l'archiviazione**: differenze riassunte (porzioni base, ingredienti
     aggiunti/tolti/cambiati). Scelte: *Usa la ricetta attuale* (predefinita) oppure
     *Recupera la versione archiviata come nuovo piatto* («Nome (Natale 2026)»), che
     viene creato e collegato **solo** alle voci di questo evento. La ricetta attuale non
     viene mai sovrascritta, perché potrebbe servire ad altri eventi.
   - **Eliminato dal ricettario**: *Ricrea dallo snapshot* (predefinita: nuovo piatto
     collegato alle voci) oppure *Lascia la voce senza ricetta*.
2. Confermando, in un'unica transazione: le scelte vengono applicate, lo snapshot passa
   a `superato` (non viene cancellato: resta come storico consultabile dalla
   panoramica), l'evento passa ad `attivo` con `snapshotCorrenteId = null`.
3. Gli stati della spesa e le attività restano come erano; la riconciliazione (§10.4)
   segnala le differenze dovute a ricette cambiate.
4. Una nuova archiviazione crea un nuovo snapshot `valido`; i precedenti restano
   `superato`. Gli snapshot si eliminano solo insieme all'evento.

### 7.5 Ricettario e catalogo

- Nome piatto obbligatorio; nomi duplicati permessi ma segnalati («Esiste già un piatto
  con questo nome»).
- `porzioniBase` vuoto: il piatto è usabile, ma la spesa non può scalarlo (§10.3).
- Un ingrediente di catalogo ha nome canonico unico (su `nomeNorm`) e sinonimi unici
  nell'intero catalogo; un conflitto blocca il salvataggio con messaggio.
- Il catalogo iniziale (~180 ingredienti, ognuno con reparto e unità preferita) è
  caricato da un seed idempotente con id stabili; aggiornamenti futuri del seed non
  toccano voci modificate dall'utente (`updatedAt > createdAt`).

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
   del catalogo marcati «di solito fisso» (alloro, chiodi di garofano…); `proporzionale`
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
| `porzioniBase` nullo o 0 | Nessuna scalatura; nella spesa le righe del piatto finiscono in *Da verificare* con «porzioni base mancanti» e le quantità della ricetta come riferimento |
| `quantita` nulla (non `qb`) | Riga *quantità da definire*: compare nella spesa senza somma |
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

### 10.1 Calcolo (`calcolaSpesa`)

Input: evento, voci di menù, piatti, ingredienti dei piatti, catalogo, impostazioni.
Output: `RigaCalcolata[]` + `Avviso[]`.

```ts
interface RigaCalcolata {
  chiave: string                 // §10.2
  nome: string                   // nome canonico del catalogo o nome libero
  repartoId: Id                  // dal catalogo, altrimenti 'rep-altro'
  famiglia: 'massa' | 'volume' | CodiceUnita | 'qb' | 'senza_unita'
  quantita: number | null        // in unità base; null per qb / da definire
  unita: CodiceUnita | null      // unità base della famiglia
  provenienze: { menuItemId: Id; dishId: Id; nomeVoce: string; quantita: number | null }[]
  daVerificare: string[]         // motivi (riga incerta, porzioni base mancanti…)
}
```

Passi:
1. Voci con `inSpesa` e `dishId` valido; le altre generano solo avvisi (§7.2).
2. Per ogni ingrediente del piatto (esclusi i `facoltativo`, che compaiono comunque come
   righe a parte, non sommate, marcate «facoltativo»): scalatura (§9), conversione
   nell'unità base della famiglia.
3. Raggruppamento per `chiave` e somma delle quantità (gli intervalli usano il massimo).
4. Ordinamento: ordine del reparto, poi nome.

### 10.2 Chiave di aggregazione

```
chiave = <identità> "|" <famiglia>
identità = "ing:" + ingredientId          se collegato al catalogo
         = "txt:" + norm(nome)            altrimenti
famiglia = "massa" | "volume" | "u:" + codiceUnita | "qb" | "senza_unita"
```

Esempi: `ing:ing-burro|massa`, `ing:ing-olio-evo|volume`,
`ing:ing-olio-evo|u:cucchiaio`, `txt:sale grosso|qb`.

Lo stesso ingrediente in famiglie diverse produce righe distinte, mostrate una sotto
l'altra con un solo titolo («Olio extravergine: 300 ml + 4 cucchiai»).

La chiave è **stabile** rispetto a: cambi di quantità, porzioni, coperti, aggiunta o
rimozione di voci, conversioni interne alla famiglia (200 g → 0,2 kg). Cambia, e quindi
genera una riga nuova, se: si collega/scollega un ingrediente dal catalogo, si cambia
famiglia di unità, si rinomina un ingrediente non collegato.

### 10.3 Stati e interventi salvati

Gli `ShoppingItem` di tipo `calcolato` nascono **solo** quando l'utente interviene su una
riga (cambia stato, corregge la quantità, cambia reparto, nasconde, scrive una nota). Una
riga mai toccata non ha record: è `da_comprare` per definizione.

Al cambio di stato verso `ce_lho` o `comprato` si salva `quantitaAlloStato` = quantità
calcolata in quel momento. Al ritorno a `da_comprare` si azzera.

### 10.4 Riconciliazione (`riconciliaSpesa`)

Input: righe calcolate, `ShoppingItem` dell'evento. Output: `VoceListaSpesa[]` raggruppate
in sezioni. Nessuna scrittura: la funzione è pura; eventuali pulizie sono azioni
esplicite.

| Caso | Condizione | Risultato mostrato |
|---|---|---|
| R1 Nuova | Riga calcolata senza record | *Da comprare*, quantità calcolata |
| R2 Invariata | Record presente, quantità calcolata = `quantitaAlloStato` (tolleranza) | Stato salvato |
| R3 Aumentata | Stato `comprato`/`ce_lho`, calcolata > `quantitaAlloStato` | Riga **Da integrare**: «Hai già 500 g, ora ne servono 800 g: mancano 300 g». Azioni: *Comprato anche il resto* (aggiorna `quantitaAlloStato`), *Va bene così* (idem, senza comprare) |
| R4 Diminuita | Stato `comprato`/`ce_lho`, calcolata < `quantitaAlloStato` | Stato salvato con nota informativa «ne servono meno di quanti presi» |
| R5 Non più necessaria | Record `comprato`/`ce_lho` senza riga calcolata (piatto tolto, voce esclusa, chiave cambiata) | Sezione **Non più necessari**, con quantità presa e provenienza nota. Azione *Rimuovi* (elimina il record). Mai eliminata in automatico |
| R6 Orfana senza valore | Record `da_comprare` senza riga calcolata, senza nota, quantità utente, reparto o nascosto | Non mostrata; eliminabile dalla pulizia silenziosa (nessuna informazione persa) |
| R7 Correzione utente | `quantitaUtente` presente | Si mostra `quantitaUtente`; se la calcolata è cambiata rispetto a `quantitaCalcolataAllaCorrezione`, badge «la ricetta è cambiata: calcolati ora 800 g» con *Usa il calcolo* / *Mantieni la mia* |
| R8 Nascosta | `nascosto = true` | In fondo, sezione «Nascosti», ripristinabile |
| R9 Q.b. / da definire | Famiglia `qb` o quantità nulla | Stato senza confronto quantitativo |
| R10 Possibile cambio di chiave | R5 e R1 con stessa identità ma famiglia diversa, o stesso nome normalizzato | R5 mostra il suggerimento «forse corrisponde a: Burro 250 g» con azione *Trasferisci lo stato* |

Le righe con `daVerificare` non vuoto compaiono nella sezione **Da verificare** (anche se
hanno quantità) finché la causa non è risolta.

Gli articoli **manuali** non partecipano a calcolo né riconciliazione: hanno solo nome,
quantità testuale, reparto, stato, nota.

### 10.5 Vista e condivisione

- Sezioni nell'ordine: Da verificare · Da comprare / Da integrare per reparto · Ce l'ho ·
  Comprato · Non più necessari · Nascosti.
- Contatori: «12 da comprare · 5 comprati · 3 ce l'ho».
- Condivisione (`navigator.share({ title, text })`, fallback `navigator.clipboard`):
  solo righe *da comprare* e *da integrare* (mancante), per reparto:

```
Spesa — Natale 2026 (25/12)

ORTOFRUTTA
☐ Patate 1,5 kg
☐ Prezzemolo 1 mazzetto
LATTE, UOVA E FRIGO
☐ Burro 300 g (mancano)
☐ Uova 8
```

### 10.6 Evento archiviato

La spesa di un evento archiviato è letta dallo snapshot (`spesa`) in sola lettura.

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
  "impronta": "sha256 esadecimale di JSON.stringify(dati)",
  "dati": {
    "events": [], "menuItems": [], "dishes": [], "dishIngredients": [],
    "ingredients": [], "shoppingItems": [], "tasks": [], "eventSnapshots": [],
    "settings": [], "meta": []
  }
}
```

### 11.2 Esportazione

- Lettura di tutte le tabelle in una transazione in sola lettura (dati coerenti).
- File `menuapp-backup-AAAA-MM-GG-HHmm.json`; su Android si offre anche la condivisione
  del file (`navigator.share({ files })`) per salvarlo su Drive o inviarlo.
- Aggiorna `meta.ultimoBackupAt`.

### 11.3 Ripristino validato

1. Lettura file (max 50 MB) e `JSON.parse` con messaggio chiaro in caso di errore.
2. Controlli: `formato`, `versioneFormato` supportata, `versioneSchema` ≤ versione
   dell'app (se maggiore: «Backup creato da una versione più recente: aggiorna l'app»).
3. Migrazione del contenuto del backup alla versione corrente con funzioni pure
   (`migraBackup[v]`), le stesse logiche delle migrazioni Dexie.
4. Validazione di ogni record con schemi **zod** (tipi, enum, formati data/ora, UUID).
5. Impronta: se non corrisponde, avviso «file modificato o danneggiato» con possibilità
   di proseguire solo dopo conferma esplicita (utile per backup corretti a mano).
6. Integrità referenziale (§6.4): riferimenti mancanti elencati; i riferimenti
   facoltativi rotti vengono annullati (`dishId → null`), quelli obbligatori bloccano.
7. Riepilogo e conferma.
8. Copia di sicurezza dei dati attuali nel database `menuapp-sicurezza` **e** download.
9. Unica transazione `rw` su tutte le tabelle: `clear()` + `bulkAdd()`. Se fallisce,
   nulla cambia.
10. Ricarica dell'app.

L'MVP prevede solo «sostituisci tutto». L'unione è rinviata.

### 11.4 Archiviazione persistente e sicurezza

- `navigator.storage.persist()` richiesto al primo salvataggio di dati e
  all'installazione; stato e spazio (`storage.estimate()`) in *Impostazioni → Dati*.
- Promemoria backup: banner se `ultimaModificaAt > ultimoBackupAt` e sono passati più di
  `promemoriaGiorni` dall'ultimo backup.
- **Migrazioni sicure**: all'avvio l'app apre il database senza versione per leggerne la
  versione installata; se è inferiore a quella del codice, esporta tutte le tabelle in
  `menuapp-sicurezza` prima di aprirlo con la nuova versione. Le migrazioni Dexie
  (`version(n).upgrade()`) sono atomiche: un errore annulla l'aggiornamento e l'app
  mostra una schermata d'errore con «Scarica copia di sicurezza».
- Regole per le migrazioni: mai modificare una `version(n)` già pubblicata; ogni nuova
  versione ha un test che parte da dati fittizi della versione precedente.
- Più schede aperte: all'evento `versionchange` la scheda vecchia chiude il database e
  chiede di ricaricare.

## 12. Architettura tecnica

### 12.1 Stack e versioni verificate (12/11/2026)

| Pacchetto | Versione | Note sulla verifica |
|---|---|---|
| Node | 24.18 (nvm, `.nvmrc`) | engines `>=22.12` |
| TypeScript | **7.0.2** | Installato e funzionante con `tsc -b` e `vite build`. **Strict è attivo per impostazione predefinita** (verificato: TS7006 e TS2322 su un file di prova); lo dichiariamo comunque esplicitamente. Il pacchetto **non espone l'API JavaScript** (`require('typescript').createProgram` è assente): gli strumenti che la richiedono non funzionano. Non la usano: Vite/oxc, Vitest, oxlint, Tailwind. `shadcn` usa `ts-morph`, che porta con sé TypeScript 6.0.2: compatibile. Ripiego documentato: `typescript@~5.9` |
| Vite | 8.3 | |
| React / React DOM | 19.3 | |
| @vitejs/plugin-react | 6.1 | peer `vite ^8` |
| Tailwind CSS + @tailwindcss/vite | 4.3.5 | peer `vite ^5–^8` |
| shadcn (CLI, via `npx`) | 4.23 | componenti copiati nel progetto; dipendenze: `radix-ui` 1.8, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` |
| Dexie / dexie-react-hooks | 4.4.7 / 4.4.0 | `useLiveQuery` |
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
    snapshot.ts     creazione e confronto snapshot
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
- Controllo aggiornamenti all'avvio, al ritorno in primo piano e ogni ora.
- Precache di tutti gli asset (JS, CSS, HTML, icone, font). `navigateFallback:
  'index.html'` limitato allo scope `/Menuapp/`. L'hash routing evita problemi di
  rotte profonde.
- Avviso «Pronta per l'uso offline» alla prima installazione del service worker.
- Manifest: `name` e `short_name` «Menù & Co.», `id: '/Menuapp/'`, `scope` e
  `start_url` `/Menuapp/`, `lang: 'it'`, `display: 'standalone'`, colori tema
  chiaro, icone 64/192/512 + maskable 512, `shortcuts` verso *Nuovo evento* e
  *Ricettario*.
- Versione visibile in *Impostazioni → Dati*: `versione package + hash del commit`
  iniettati in build (`define`).
- **Origini e dati**: IndexedDB è legato all'origine. Produzione
  (`lcarzaniga.github.io`), sviluppo (`localhost:5173`, `…ts.net:8443`) e anteprima
  (`…ts.net:8444`) hanno archivi **separati**: i dati reali non si toccano in sviluppo.
  Per portare dati da un'origine all'altra si usa backup/ripristino.

## 14. Hosting e deploy

- **Sviluppo** sul server Debian (`/srv/apps/menuapp`), sessione tmux `menuapp`.
  - Vite su `127.0.0.1:5173`, mai su `0.0.0.0` (il server non ha firewall).
  - PC: `ssh -L 5173:localhost:5173 loris@loris-srv01.dala-tortoise.ts.net` →
    `http://localhost:5173/Menuapp/` (localhost è contesto sicuro).
  - Android: `tailscale serve --bg --https=8443 http://127.0.0.1:5173` →
    `https://loris-srv01.dala-tortoise.ts.net:8443/Menuapp/` (solo tailnet; mai
    `funnel`).
  - Prove PWA reali (service worker, offline, installazione, aggiornamento):
    `npm run build && npm run preview` su `127.0.0.1:4173`, esposto con
    `tailscale serve --bg --https=8444 http://127.0.0.1:4173` solo quando serve, poi
    `tailscale serve --https=8444 off`.
- **Git**: `main` sempre pubblicabile; un branch per milestone (`m0-fondamenta`,
  `m1-eventi-menu`, `m2-ricettario`, `m3-spesa`, `m4-piano-stampa`); commit piccoli in
  italiano; merge su `main` solo con `npm run check` verde e approvazione di Loris; push
  solo autorizzati. Tag `v0.N.0` a fine milestone, `v1.0.0` al rilascio.
- **Produzione**: GitHub Pages tramite GitHub Actions a ogni push su `main`: `npm ci` →
  lint → typecheck → test unitari → build → pubblicazione. Su pull request e push di
  altri branch: solo i controlli, senza pubblicazione. I test e2e girano sul server (con
  Chrome di sistema), non in CI.
- `base: '/Menuapp/'` in tutte le modalità.

## 15. Roadmap

| Milestone | Date | Contenuto | Uscita |
|---|---|---|---|
| **M0 — Fondamenta** | 13–17 nov | Toolchain, Tailwind/shadcn, navigazione, schema Dexie v1 completo, seed impostazioni e reparti, backup/ripristino, persistenza, PWA con avviso aggiornamento, test unitari ed e2e, CI | `v0.1.0` |
| **M1 — Eventi e menù** | 18–23 nov | Eventi (CRUD, stati senza archiviazione), coperti, portate per evento, voci di menù, inserimento rapido multiriga, riordino e spostamento | `v0.2.0` |
| **M2 — Ricettario** | 24 nov – 1 dic | Unità, catalogo ingredienti con seed, parser, piatti, ingredienti con anteprima e conferma, porzioni e scalatura, «Crea nel ricettario», vista cucina | `v0.3.0` |
| **M3 — Spesa** | 2–7 dic | Calcolo, chiavi, riconciliazione, stati, correzioni, manuali, reparti, condivisione | `v0.4.0` |
| **M4 — Piano e stampa** | 8–12 dic | Attività e checklist, archiviazione con snapshot e riapertura, stampa del menù, collaudo completo | `v0.5.0` |
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
- G4 Backup → ripristino su un'altra origine riproduce dati identici (stessa impronta).
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
- **Spesa**: tutti i casi R1–R10 coperti da test unitari; scenario e2e «compro il burro,
  aumento i coperti, vedo *Da integrare*; tolgo il piatto, il burro compare in *Non più
  necessari*».
- **Snapshot**: dopo l'archiviazione, modificare o eliminare un piatto non cambia la
  vista dell'evento archiviato; la riapertura segue §7.4 senza alterare piatti usati da
  altri eventi.
- **Backup**: un file manomesso (enum non valido, riferimento rotto, schema futuro) viene
  rifiutato con un messaggio comprensibile e i dati attuali restano intatti.
- **Stampa**: menù di Natale su una pagina A4 senza tagli, leggibile in bianco e nero.

## 17. Test automatici e manuali

### 17.1 Unitari (Vitest, ambiente Node)
- `domain/porzioni`: coperti, fattore, casi limite (0, decimali, fissa, intervalli).
- `domain/unita`: riconoscimento forme, famiglie, conversioni consentite e **vietate**
  (test che verificano che cucchiaio→ml e confezione→g non esistano), formattazione.
- `domain/parser`: tabella ≥ 100 casi (§8.4), numeri in parola, frazioni, nomi con cifre.
- `domain/spesa`: calcolo, chiavi, ogni caso R1–R10, idempotenza (riconciliare due volte
  dà lo stesso risultato), test a proprietà semplici (somma delle provenienze = totale).
- `domain/snapshot`: creazione, confronto invariato/modificato/eliminato.
- `db` con fake-indexeddb: seed idempotente, repository (cascata eliminazioni),
  migrazioni (dati vN → vN+1), backup ida e ritorno, ripristino che fallisce senza
  toccare i dati.

### 17.2 Componenti (Vitest + happy-dom + Testing Library)
Moduli evento, inserimento rapido, anteprima parser, riga della spesa (cambio stato).

### 17.3 End-to-end (Playwright, Chrome di sistema)
Server di anteprima isolato su `127.0.0.1:4174`; progetti *Pixel 7* (mobile) e *Desktop*.
Scenari: avvio e navigazione; evento → menù → piatto → ingredienti → spesa; riconciliazione
dopo modifica del menù; backup e ripristino; offline dopo l'installazione del service
worker (`context.setOffline(true)` + ricarica); avviso di aggiornamento (due build
consecutive); stampa (`emulateMedia({ media: 'print' })` + screenshot).

### 17.4 Manuali (su Android, a fine milestone)
Installazione da `:8444` e da produzione · modalità aereo · avviso aggiornamento dopo un
deploy · stato persistenza · condivisione spesa su WhatsApp/Keep · schermo acceso in
vista cucina · stampa/Salva PDF · tastiera e tocco su moduli · tema scuro · ripristino
di un backup da file scaricato.

Una lista di controllo per milestone sta in `docs/collaudo/Mn.md`.

## 18. Rischi tecnici

| Rischio | Prob. | Impatto | Mitigazione |
|---|---|---|---|
| Ecosistema non pronto per TypeScript 7 (assenza dell'API JS) | Media | Medio | Verificato in M0 (T1); ripiego `typescript@~5.9` con una sola modifica a `package.json` |
| Cancellazione dei dati da parte del browser (spazio, pulizia) | Bassa | Alto | Persistenza richiesta, PWA installata, promemoria backup, condivisione del file su Drive |
| Origine `lcarzaniga.github.io` condivisa da tutte le Pages dell'utente | Media | Medio | Nome DB specifico (`menuapp`), scope SW `/Menuapp/`; un futuro dominio personalizzato cambia origine → migrazione via backup/ripristino |
| Service worker che serve una versione vecchia o resta bloccato | Media | Medio | `registerType: 'prompt'`, controllo periodico, pulsante «Verifica aggiornamenti», test e2e di aggiornamento |
| Migrazione Dexie errata in produzione | Bassa | Alto | Copia di sicurezza pre-migrazione, test di migrazione obbligatori, upgrade atomici |
| Parser troppo ottimista | Media | Medio | Regola «nel dubbio da verificare», tabella di casi reali, conferma manuale |
| Riconciliazione confusa per l'utente | Media | Medio | Casi R1–R10 esplicitati, testi chiari, prova reale col menù di Natale nel collaudo |
| Scadenza del 15 dicembre | Media | Alto | Milestone con uscita pubblicata, tagli ordinati (§15), dominio puro testato prima dell'interfaccia |
| Stampa diversa fra Chrome Android e desktop | Media | Basso | CSS di stampa semplice, font incluso, prova su entrambi |
| Browser di Playwright non allineati | Bassa | Basso | Uso del Chrome di sistema (`channel: 'chrome'`) |
| Più schede aperte con versioni diverse | Bassa | Medio | Gestione `versionchange`, `useLiveQuery` per aggiornamenti reattivi |
| Floating point nelle somme | Bassa | Basso | Somme in unità base, tolleranza nei confronti, arrotondamento solo in vista |

---

### Registro delle modifiche

| Data | Modifica |
|---|---|
| 12/11/2026 | Prima versione consolidata |
