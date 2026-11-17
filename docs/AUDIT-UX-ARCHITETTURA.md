# Audit di architettura, interfaccia e usabilità — Ricette di famiglia & Co.

*17 novembre 2026 · produzione `20261117-1420-ce7a017` (schema 15) · solo analisi: nessuna modifica
all'app, al database o alla produzione.*

Materiale di supporto in `docs/audit/`:

- `schermate/`: schermate dell'app attuale con dati dimostrativi, prese su un server isolato
  (127.0.0.1:4176, dati temporanei). Telefono 412 px e PC 1366 px.
- `prototipi/index.html`: bozze statiche della struttura proposta, apribili nel browser senza server;
  `prototipi/prototipi.png` è la stessa pagina come immagine.

Lo script del giro di schermate è in `test-results/audit/` (non versionato) e si può rilanciare a
ogni fase come controllo visivo.

**Stato dei rami.** `rifinitura-ux`, `ricorrenze-standard` e `partecipanti-tabella` sono già in
produzione e fusi in `main`. Restano `avanzamento-organizzazione` e `avanzamento-ricerca` (un commit
ciascuno, solo AVANZAMENTO): sono superati dalle note successive e si possono eliminare. Non ci sono
funzionalità sviluppate ma non pubblicate.

---

## In breve

- **Quattro problemi gravi (P0)**, tutti piccoli da correggere:
  1. con più Famiglie la Famiglia attiva predefinita è la prima in ordine alfabetico, e la pagina
     Eventi può dire «Crea il tuo primo evento» a chi ha eventi altrove;
  2. dentro un evento, il selettore della Famiglia attiva mostra un'altra Famiglia;
  3. chi ha l'evento in sola lettura non può duplicarlo, anche se SPEC e server lo permettono;
  4. un nuovo evento nasce nella Famiglia attiva senza che lo si veda.
- **Struttura**: le funzioni ci sono e funzionano, ma sono cresciute per aggiunte:
  - l'evento ha 7 schede, e sul telefono 3 non si vedono;
  - la Panoramica raccoglie tutto (riepilogo, dati, 6 pulsanti, archivio, ricorrenza, condivisione);
  - la scheda Membri della Famiglia contiene 7 funzioni diverse;
  - Impostazioni mescola account, dispositivo e amministrazione;
  - «Chi porta» ha due pulsanti grandi per ogni riga.
- **Proposta raccomandata (A)**: stessa barra in basso (Impostazioni diventa «Altro»), evento in 5
  schede (Riepilogo · Menù · Persone · Prepara · Bacheca), gestione dell'evento in un menù «⋯»,
  Famiglia con schede Persone e Gestione. Quasi tutto è interfaccia: nessuna migrazione.
- **Codice**: sano (livelli rispettati, contratti zod, test ampi, nessuna dipendenza superflua).
  Pochi file troppo grandi e qualche servizio con responsabilità miste; il refactoring serve solo dove
  accompagna la riorganizzazione.

---

## 1. Inventario delle funzionalità

Legenda: ✅ implementata e in produzione · ◐ parziale · ✗ solo prevista o rinviata.

### Eventi
| Funzione | Stato | Dove |
|---|---|---|
| Elenco eventi (prossimo in evidenza, condivisi con me, conclusi), archivio | ✅ | `#/`, `#/eventi/archivio` |
| Creazione con occasione, tipo, ricorrenza, data, coperti, note | ✅ | `#/eventi/nuovo` |
| Stati attivo/concluso/archiviato, riapertura, eliminazione | ✅ | Panoramica |
| «A che punto siamo?» | ✅ | Panoramica |
| Menù: portate, voci, inserimento rapido e multiriga, suggerimenti dal ricettario, porzioni, «A cura di», note, riordino Su/Giù/Sposta | ✅ (trascinamento ✗) | `/menu` |
| Vista cucina di una voce | ✅ | `/voci/:id/cucina` |
| Partecipanti: tabella, presenze manuali, accompagnatori, coperti manuali/calcolati | ✅ | `/partecipanti` |
| Chi porta cosa (piatti e cose, affidi anche a persone senza app) | ✅ | `/chi-porta` |
| Spesa calcolata, stati, correzioni, articoli manuali, condivisione | ✅ | `/spesa` |
| Piano delle attività | ✅ | `/piano` |
| Bacheca evento: messaggi, foto, reazioni, commenti, sondaggi, proposte | ✅ | `/bacheca` |
| Valutazioni dei piatti serviti | ✅ | Menù (dopo l'evento) |
| Stampa del menù (5 modelli, A4/A5) | ✅ | `/stampa` |
| Condivisione (lettura/modifica, partecipa), passaggio di proprietà, Famiglia dell'evento | ✅ | Panoramica |
| Duplicazione, ricorrenze (della Famiglia e standard), confronto fra edizioni | ✅ | Panoramica, `/confronto` |
| Archiviazione con snapshot e consultazione | ✅ | Panoramica |

### Ricette
| Funzione | Stato |
|---|---|
| Ricettario con portate, rubrica alfabetica, ricerca per nome e ingredienti, «solo mie», «senza ingredienti» | ✅ |
| Scheda ricetta, foto (anche per passaggio), vista cucina, «usato in» | ✅ |
| Editor ingredienti con parser e catalogo | ✅ |
| Importazione (testo, JSON, pacchetto con foto), esportazione, condivisione come testo | ✅ |
| Visibilità privata / in una Famiglia, copia nel mio ricettario, copia in un'altra Famiglia con provenienza | ✅ |
| Catalogo ingredienti e reparti | ✅ (`#/ingredienti`, Impostazioni) |
| Importazione da URL, valori nutrizionali, timer, stampa ricetta, cronologia versioni | ✗ (SPEC §3) |

### Famiglia e persone
| Funzione | Stato |
|---|---|
| Più Famiglie, Famiglia attiva, inviti ad aderire, uscita, rimozione, amministrazione | ✅ |
| Bacheca della Famiglia con sondaggi | ✅ |
| «I più apprezzati» | ✅ |
| Rubrica «Senza app» | ✅ |
| Ricorrenze della Famiglia | ✅ (in Famiglia → Membri) |
| Notifiche interne con categorie, gruppi apribili, preferenze | ✅ |
| Notifiche push o email, tempo reale | ✗ (rinviati) |

### Account e sistema
| Funzione | Stato |
|---|---|
| Accesso su invito con approvazione del dispositivo, dispositivi, «Esporta i miei dati» | ✅ |
| Utenti e dispositivi (amministratore, solo ingresso privato) | ✅ |
| Backup, esportazione, ripristino (amministratore, ingresso privato) | ✅ |
| Aspetto (tema, dimensione del testo) per dispositivo | ✅ |
| PWA con avviso di aggiornamento | ✅ |
| Modifiche offline, copia dei backup su un secondo supporto | ✗ |

**Documentazione non allineata** (da correggere quando si tocca la SPEC):

- §3 elenca ancora come rinviati account e ruoli, duplicazione degli eventi e foto, che sono
  implementati;
- §13 indica il nome del manifest «Menù & Co.»;
- §22 descrive come «proposta non implementata» l'elenco dei partecipanti, che esiste (§24).

---

## 2. Mappa della navigazione attuale

```
Barra (telefono in basso, PC a sinistra): Eventi · Ricettario · Famiglia · Notifiche · Impostazioni
(PC: in fondo alla barra anche «Loris» → Account)        Telefono: selettore Famiglia in cima a OGNI pagina

Eventi #/ ── Prossimo evento · Condivisi con me · Conclusi · link «Eventi archiviati» (#/eventi/archivio)
  ├─ Nuovo #/eventi/nuovo
  └─ Evento #/eventi/:id  [7 schede a scorrimento orizzontale]
       Panoramica ── A che punto siamo · dati · [Modifica][Stampa menù][Duplica][Concludi/Riapri][Elimina]
       │             · Archivia · Ricorrenza (+ Confronta → /confronto) · Condivisione/Famiglia/Passa
       Partecipanti ── coperti · riepilogo · tabella («Modifica elenco»)
       Menù ── portate · voci → finestra voce → Vista cucina (/voci/:id/cucina) · valutazioni
       Spesa ── lista · condividi · articolo
       Piano ── attività
       Bacheca ── messaggi · sondaggi · proposte
       Chi porta ── piatti e cose
       (fuori dalle schede) /stampa · /confronto · /voci/:id/cucina

Ricettario #/ricettario ── ricerca · portate · rubrica · [Ingredienti] [Importa] [Nuovo]
  └─ Ricetta #/ricettario/:id ── visibilità · copia in altra Famiglia · foto · Vista cucina · ingredienti
                                  · procedimento · usato in · esporta · condividi · elimina
  └─ Ingredienti #/ingredienti (anche da Impostazioni)

Famiglia #/famiglia ── Bacheca │ I più apprezzati │ Membri (membri+invito · Ricorrenze · Senza app ·
                       nome · esci · crea un'altra Famiglia)
Notifiche #/notifiche ── Da leggere · Già lette · preferenze
Impostazioni #/impostazioni ── Account · Ingredienti · Utenti e dispositivi* · Dati e backup*
                               · Nuovi eventi (coefficiente, portate)** · Reparti** · Aspetto
                               (* amministratore dall'ingresso privato; ** modificabili solo dall'amministratore)
Account #/account ── dispositivi · nuovo dispositivo · i miei dati · esci
```

Profondità dei percorsi più comuni (tocchi dalla barra):

| Destinazione | Tocchi |
|---|---|
| Menù del prossimo evento | 2 (evento, Menù) |
| Chi porta | 3 sul telefono (evento, scorrere le schede, Chi porta) |
| Vista cucina di un piatto del menù | 4 (evento, Menù, voce, Vista cucina) |
| Ricorrenze della Famiglia | 2 + scorrimento (Famiglia, Membri, scorrere) |
| Archivio | 1 + scorrimento fino al link in fondo |

---

## 3. Problemi individuati

### 3.1 Gravi (percorsi interrotti, incoerenze importanti)

**G1 — Famiglia attiva predefinita e pagina Eventi vuota.**
- *Evidenza*: `src/features/famiglia/attiva.tsx` usa `famiglie[0]` quando non c'è una scelta, e
  l'elenco viene da `server/db/repo/accesso.ts` ordinato per `g.nome`. Nel giro di schermate, con
  «Amici del mare» e «Famiglia», la pagina Eventi mostra «Crea il tuo primo evento»
  (`docs/audit/schermate/tel-01-eventi.png`), anche se l'utente ha due eventi in «Famiglia» e uno
  condiviso.
- *Quando succede*: è il caso normale dopo la creazione di una seconda Famiglia, se il nome della
  nuova viene prima, oppure su un nuovo dispositivo.

**G2 — Il selettore della Famiglia contraddice l'evento aperto.**
- Sul telefono il selettore sta in cima a ogni pagina, anche dentro un evento o una ricetta. In
  `tel-04-panoramica.png` dice «Amici del mare» su un evento di «Famiglia».
- Cambiarlo lì non cambia l'evento, e confonde su dove si stia lavorando.

**G3 — Chi legge non può duplicare.**
- *Evidenza*: `LayoutEvento` avvolge tutte le schede in `SolaLettura` per il permesso `lettura`, e la
  Panoramica usa `disabled={!puoScrivere}` anche per «Duplica evento».
- SPEC §25 e il server (`duplica` chiede solo `lettura`) lo permettono, quindi il percorso
  «riprendo il menù dello zio per il mio evento» è interrotto (`tel-26-evento-condiviso-lettura.png`).

**G4 — Il nuovo evento nasce in una Famiglia che non si vede.**
- `PaginaNuovoEvento` manda `gruppoId` della Famiglia attiva senza mostrarla.
- Insieme a G1, un evento può finire nella Famiglia sbagliata e «sparire» dall'elenco quando si
  torna all'altra.

### 3.2 Usabilità e navigazione

| # | Problema | Evidenza |
|---|---|---|
| U1 | 7 schede nell'evento: sul telefono Piano, Bacheca e Chi porta sono fuori schermo, senza indizio che si scorra | `tel-04`, `tel-06` (si legge «Piar…») |
| U2 | Panoramica sovraccarica: riepilogo, scheda dati, 6 pulsanti di pari peso, Archivia staccato, Ricorrenza, Condivisione; i coperti compaiono 3 volte | `tel-04-panoramica.png` (circa 4 schermate) |
| U3 | Chi legge vede pulsanti spenti (Modifica, Duplica, Concludi, Archivia) invece di non vederli | `tel-26` |
| U4 | «Tutto pronto» su un evento con il menù vuoto | `tel-26`: «0 voci in 7 portate» e «Tutto pronto» |
| U5 | «Chi porta» dispersivo: per ogni piatto una scheda con due pulsanti grandi; 7 piatti sono circa 3 schermate | `tel-10-chi-porta.png` (stesso problema già risolto per i partecipanti) |
| U6 | Il responsabile di un piatto si imposta in due posti: «A cura di» nella finestra della voce e «Chi porta» | `EditorVoce.tsx` (campo `incaricato`) e `PaginaChiPorta.tsx` |
| U7 | Famiglia → Membri contiene 7 funzioni: membri, invito, ricorrenze, rubrica, nome, esci, nuova Famiglia | `tel-21-famiglia-membri.png` |
| U8 | Le ricorrenze stanno in «Membri», dove nessuno le cerca; si usano dalla Panoramica | come sopra |
| U9 | Impostazioni lunga 6 schermate | `tel-23-impostazioni.png`, vedi sotto |
| U10 | Scheda ricetta: visibilità e «Copia in un'altra Famiglia» vengono prima di ingredienti e procedimento; «Vista cucina» sta sotto le foto; ogni passaggio mostra un riquadro «Foto» vuoto | `tel-16-ricetta.png` |
| U11 | Vista cucina di un piatto del menù: 4 tocchi, dentro la finestra di modifica della voce | `EditorVoce.tsx:115` |
| U12 | L'archivio è un link piccolo in fondo all'elenco; i conclusi stanno in un'altra sezione della stessa pagina | `PaginaEventi.tsx` |
| U13 | Sul telefono i messaggi di conferma, in alto, coprono titolo e schede dell'evento | `pc-panoramica.png`, `00-elenco*.png`; gli e2e lo aggirano con `page.goto` (`edizioni.spec.ts`) |
| U14 | «← Eventi» porta sempre all'elenco, anche arrivando da una notifica o dalla ricetta | `LayoutEvento.tsx` |
| U15 | Account: sul PC dal nome in fondo alla barra, sul telefono solo da Impostazioni → prima riga | `Layout.tsx` |
| U16 | Ricettario: l'icona «Ingredienti» (carota) in testa è poco riconoscibile; stessa pagina raggiungibile anche da Impostazioni | `PaginaRicettario.tsx:65` |
| U17 | Nuovo evento: l'occasione (che decide ricorrenza e nome) è il primo campo ma il più astratto; nessuna indicazione della Famiglia | `tel-03-nuovo-evento.png` |

Dettaglio di U9 (Impostazioni):

- mescola tre livelli diversi: account; preferenze del dispositivo (Aspetto, in fondo); impostazioni
  comuni dell'amministratore (portate, 14 reparti) mostrate a tutti ma spente;
- «Nuovi eventi» si salva con un suo pulsante;
- i reparti sono un elenco di 14 righe con tre icone ciascuna.

### 3.3 Più Famiglie e livelli di autorizzazione

- G1, G2, G4 sopra.
- Gli eventi «Condivisi con me» di un'altra Famiglia si vedono solo con quella Famiglia attiva: chi
  riceve un invito lo cerca nel posto sbagliato.
- Quando la Famiglia attiva non ha eventi, non c'è un avviso del tipo «Hai 2 eventi in Famiglia —
  passa a Famiglia».
- Le funzioni di amministrazione dell'app (utenti, backup) dipendono dall'ingresso privato. Il
  comportamento è corretto, ma senza spiegazione per chi entra dall'esterno: la voce non c'è e basta.
- Partecipanti: la sola lettura ora è chiara (tabella e «Le presenze le aggiorna…»). È il modello da
  estendere a «Chi porta» e alla Panoramica.

---

## 4. Audit grafico

**Cosa funziona** (da conservare):

- identità (Fraunces e Inter, palette terracotta, illustrazioni) coerente e curata;
- tema scuro completo;
- testo scalabile;
- componenti di base scritti a mano in stile shadcn: `Button` con varianti, `Card`, `Campo`,
  `Finestra`, `Conferma`, `MenuAzioni`, `Badge`, `Vuoto`;
- conferme distruttive sempre con finestra (salvo l'avviso PWA, che usa `window.confirm`);
- nessuno scorrimento orizzontale nelle pagine controllate.

**Incoerenze**:

| Area | Osservazione | Proposta |
|---|---|---|
| Gerarchia delle azioni | Panoramica: 4 pulsanti «contorno» uguali, «Elimina» fantasma rosso a capo, «Archivia» in un pannello a parte; Ricetta: «Elimina piatto» in fondo, «Modifica» in alto | Un'azione principale per schermata; le altre in `MenuAzioni` («⋯»); le distruttive sempre ultime nel menù |
| Schede | Schede dell'evento (`LayoutEvento`) e della Famiglia (`PaginaFamiglia`) scritte due volte con stili simili ma non uguali | Componente `Schede` unico, con indicatore di scorrimento o righe che non scorrono |
| Filtri e segmenti | Pulsanti `aria-pressed` con 4 stili diversi in 7 file (ricettario, spesa, piano, bacheca, notifiche, valutazioni, partecipanti) | Componenti `Segmenti` e `Filtro` |
| Elenchi a link | Stessa riga «icona · titolo · descrizione · ›» copiata 5 volte (Impostazioni, Account) | Componente `RigaLink` |
| Titoli di sezione | Maiuscoletto con «filetto» in 8 punti con classi copiate; altrove `CardTitle` | Componente `TitoloSezione` |
| Tabelle compatte | Partecipanti ha la sua tabella; Chi porta, Spesa e Reparti usano schede | Componente `TabellaCompatta` (righe, rientro, colonna azioni) da riusare |
| Stato e risposte | Badge di presenza (colori e testi) definiti in Partecipanti; Chi porta usa «da assegnare» con un altro stile | Mappa unica stato → variante del badge |
| Messaggi | `sonner` in alto: sul telefono copre l'intestazione dell'evento | In basso, sopra la barra, sul telefono |
| Pulsanti spenti | Molto chiari: si leggono come «rotti» più che «non per te» | Nascondere ciò che non è permesso; spegnere solo ciò che è temporaneo (connessione) |
| PC | Contenuto largo al massimo 768 px su schermo da 1366 px; Panoramica e Ricetta lasciano metà schermo vuoto | Su schermi larghi due colonne (riepilogo e dettagli; ingredienti e procedimento) |
| Segnaposto vuoti | Riquadri «Foto» tratteggiati sotto ogni passaggio; «Aggiungi foto» grande in cima alla ricetta | Un solo «Aggiungi foto» in modifica; in lettura nessun segnaposto |

---

## 5. Audit tecnico

Problemi **reali**, con un beneficio concreto se risolti:

| # | Problema | Evidenza | Beneficio |
|---|---|---|---|
| T1 | File di interfaccia troppo grandi con più schermate dentro | `Bacheca.tsx` 610 righe; `PaginaPartecipanti.tsx` 597; `PaginaFamiglia.tsx` 487, con 7 componenti, fra cui due pagine (`PaginaUnisciti`, `Classifica`); `PaginaSpesa.tsx` 483; `PaginaStampa.tsx` 459; `PaginaPiatto.tsx` 418 | Riorganizzare le schermate senza toccare tutto insieme |
| T2 | Servizi con responsabilità miste | `server/servizi/duplicazione.ts` contiene anche edizioni e associazione delle ricorrenze; `condivisione.ts` contiene condivisione degli eventi, passaggio di proprietà, Famiglia dell'evento, visibilità e copie delle ricette; `api/edizioni.ts` contiene le rotte `/famiglie/:id/ricorrenze` | Trovare le regole dove ci si aspetta; meno conflitti fra rami |
| T3 | La stessa entità ha due nomi nelle API | `/gruppi/:id/bacheca` e `/gruppi/:id/messaggi`, contro `/famiglie/:id/...` per tutto il resto | Contratto più prevedibile (mantenendo le rotte vecchie come alias) |
| T4 | Hook di dati sparsi | `useRicorrenze` in `features/eventi/Edizioni.tsx`, importato da `famiglia/RicorrenzeFamiglia.tsx`; altri 10 file definiscono `useQuery` locali, invece di `src/api/query.ts` | Chiavi delle query in un posto; dipendenze fra feature più chiare |
| T5 | Logica di dominio nell'interfaccia | `nomeEdizione` e `annoDopo` (`Edizioni.tsx`), `confermaParziale` (`PaginaPartecipanti.tsx`), scelta della ricorrenza proposta nella finestra Duplica, `nomeSuggerito` | Testabili nel dominio, riusabili dal server |
| T6 | Residui | `eventi.max_accompagnatori` senza effetto (rettifica RSVP); prop `soloStato`/`gestisce` di `FinestraModifica` ormai sempre vera | Meno rami morti |
| T7 | e2e dipendenti dall'ordine | Database e2e unico per tutti i file. `multi-famiglia.spec` si salta da solo se le Famiglie non sono esattamente una (nel progetto desktop è sempre saltato). Diversi test forzano `localStorage` della Famiglia o ricaricano la pagina dopo scritture via API | Test che non si rompono riordinando i file o aggiungendo Famiglie |
| T8 | Rischio regressioni dalla riorganizzazione | Gli e2e cercano le schede per nome («Chi porta», «Partecipanti») e i percorsi `/eventi/:id/chi-porta`, presenti anche nei collegamenti delle notifiche | Da gestire con alias delle rotte (§11) |

Non sono problemi (preferenze, da **non** toccare):

- architettura a livelli verificata da `test/architettura.test.ts`;
- contratti zod condivisi;
- TanStack Query con invalidazione globale (semplice e corretta per pochi utenti);
- `<select>` nativi;
- i nomi in italiano;
- nessuno store globale;
- tutte le dipendenze di `package.json` sono usate (verificato);
- 382 test unitari e 46 e2e verdi.

---

## 6. Percorsi utente

Le presenze le aggiorna solo chi può modificare l'evento (SPEC §29.2).

| # | Percorso | Partenza | Passaggi oggi | Difficoltà | Miglioramento |
|---|---|---|---|---|---|
| 1 | Creare un evento | Eventi → Nuovo | Occasione, tipo, ricorrenza, nome, data, ora, coperti, note → Crea | Famiglia invisibile (G4); 11 campi in fila; coperti prima di sapere chi viene | Famiglia in testa se sono due o più; «Altri dettagli» comprimibile (coefficiente, note) |
| 2 | Organizzare il menù | Evento → Menù | Scrivere nella portata, scegliere il suggerimento, ⋮ per dettagli | Buono; responsabile in due posti (U6); vista cucina nascosta (U11) | «A cura di» solo in Persone → Chi porta; icona cucina sulla riga del piatto con ricetta |
| 3 | Presenze (solo chi modifica) | Evento → Partecipanti | Modifica elenco → risposte, accompagnatori, togli → Fine | Ora chiaro; la scheda è la seconda di 7 | Persone → Presenze (immutato) |
| 4 | Assegnare cosa portare | Evento → scorrere → Chi porta | Una scheda per piatto, «Me ne occupo» o «Affida» | Scheda nascosta (U1); lunga (U5) | Persone → Chi porta in tabella; azioni nel menù della riga |
| 5 | Lista della spesa | Evento → Spesa | Lista per reparto, spunte, condividi | Buono; il piano (cosa preparare) è in un'altra scheda | Prepara → Spesa · Piano |
| 6 | Ricetta mentre si cucina | Ricettario → ricetta → Vista cucina, oppure Menù → voce → Vista cucina | 3–4 tocchi | Vista cucina sotto la gestione (U10, U11) | Vista cucina come azione principale della ricetta e sulla riga del menù |
| 7 | Partecipare a una discussione | Famiglia → Bacheca, oppure Evento → Bacheca | Scrivere, rispondere, reagire | La bacheca dell'evento è fuori schermo (U1) | Bacheca come quinta scheda, sempre visibile |
| 8 | Rispondere a un sondaggio | Notifica → messaggio | Tocca, vota | Buono (con apertura precisa) | «Per te» in Eventi con i sondaggi aperti |
| 9 | Consultare le notifiche | Barra → Notifiche | Elenco, gruppi apribili | Buono; «← Eventi» dopo l'apertura non torna alle notifiche (U14) | «Indietro» che segue la cronologia |
| 10 | Duplicare l'evento dell'anno scorso | Archivio → evento → Panoramica → Duplica | 4 tocchi + finestra | Archivio nascosto (U12); disattivato per chi legge (G3) | «Duplica dall'anno scorso» in Eventi; Duplica nel menù ⋯ anche per chi legge |
| 11 | Confrontare due edizioni | Panoramica → scorrere → Ricorrenza → Confronta | 3 tocchi + scorrimento | Riquadro in fondo alla Panoramica | Riepilogo → «Edizioni» in alto, con Confronta |
| 12 | Ricorrenze standard e personalizzate | Panoramica (scelta) · Famiglia → Membri (gestione) | Due posti lontani | Gestione in «Membri» (U8) | Famiglia → Gestione → Ricorrenze; scelta nel menù ⋯ dell'evento |
| 13 | Passare da una Famiglia all'altra | Selettore in cima (telefono) o nella barra (PC) | 1 tocco | Selettore anche dove non conta (G2); predefinita alfabetica (G1) | Selettore solo in Eventi, Ricette e Famiglia; Famiglia dell'evento nell'intestazione; predefinita con il prossimo evento |
| 14 | Copiare una ricetta tra Famiglie | Ricetta → «Copia in un'altra Famiglia» | 2 tocchi + finestra | Il pulsante sta prima del contenuto (U10) | Nel menù ⋯ della ricetta, con Visibilità |
| 15 | Stampare un menù | Panoramica → Stampa menù | 2 tocchi | Buono; lontano dal Menù | Anche dal Menù («Stampa» accanto a «Portate») e dal menù ⋯ |

---

## 7. Due proposte alternative

### Proposta A — «Riordino a cinque schede» (raccomandata)

- **Barra**: Eventi · Ricette · Famiglia · Notifiche · **Altro** (al posto di Impostazioni). Sul PC
  la stessa, con l'account in fondo come oggi.
- **Eventi (pagina iniziale)**:
  - in testa la Famiglia attiva («Cambia»);
  - il prossimo evento con lo stato;
  - «Per te»: cosa porto io, sondaggi da votare, notifiche da leggere, tutti dati già disponibili;
  - elenco a segmenti In programma · Conclusi · Archivio;
  - segnalazione degli eventi nelle altre Famiglie.
- **Evento**: 5 schede sempre visibili.
  - **Riepilogo**: A che punto siamo, dati in una riga, Edizioni e Confronta, persone con accesso.
  - **Menù**: invariato, più Stampa e la vista cucina sulla riga.
  - **Persone**: segmenti Presenze · Chi porta (tabella).
  - **Prepara**: segmenti Spesa · Piano.
  - **Bacheca**: invariata.
  - **Menù «⋯» nell'intestazione**: Modifica, Stampa, Duplica, Ricorrenza, Condivisione e Famiglia,
    Concludi/Riapri, Archivia, Elimina, ciascuno solo per chi può.
- **Ricette**: contenuto prima della gestione; «⋯» con Visibilità, Copia in altra Famiglia,
  Esporta, Condividi, Elimina.
- **Famiglia**: Bacheca · Apprezzati · **Persone** (con l'app, senza app, inviti) · **Gestione**
  (nome, ricorrenze, nuova Famiglia, esci).
- **Altro**:
  - Account, Aspetto del dispositivo, Ingredienti;
  - un gruppo «Amministrazione» con Portate predefinite, Reparti, Utenti e dispositivi, Dati e
    backup, ciascuno in una sottopagina.

### Proposta B — «Home e hub dell'evento»

- **Barra**: **Home** · Eventi · Ricette · Famiglia · Altro. Le notifiche diventano una campanella
  nell'intestazione della Home, con il contatore.
- **Home**: prossimo evento, «Per te», ultime notifiche, sondaggi aperti, novità della bacheca della
  Famiglia.
- **Evento come hub**: niente schede. La pagina dell'evento è una griglia di riquadri (Menù,
  Persone, Spesa, Piano, Bacheca, Chi porta), ciascuno con il suo indicatore; ogni riquadro apre una
  pagina a sé, con «indietro».
- **Ricette, Famiglia, Altro**: come A.

### Confronto

| Criterio | A — Cinque schede | B — Home e hub |
|---|---|---|
| Tocchi per passare da Menù a Spesa | 1 (scheda) | 2 (indietro, riquadro) |
| Scoperta delle funzioni dell'evento | Tutte visibili nelle schede | Tutte visibili nella griglia |
| Somiglianza con l'app di oggi | Alta: stessi posti, meno schede | Media: nuova Home, niente schede, notifiche spostate |
| Uso tipico (pochi eventi l'anno, preparazione concentrata) | Ottimo: si resta dentro l'evento | Buono per guardare, più lento per lavorare |
| Novità richieste | Nessuna API nuova («Per te» usa dati esistenti) | Una schermata e un'aggregazione nuove (Home), le notifiche escono dalla barra |
| Rischio di regressione | Basso–medio: rotte con alias, e2e da aggiornare | Medio–alto: cambia la navigazione di base |
| Lavoro stimato | 4 fasi, ciascuna rilasciabile | Più fasi, rilascio quasi «tutto insieme» |

---

## 8. Proposta raccomandata e motivazioni

**Raccomando A.** Le ragioni:

1. L'uso reale ruota attorno a pochi eventi l'anno, preparati per giorni da telefono: si lavora
   dentro un evento e si salta fra Menù, Persone e Spesa. Le schede lo fanno in un tocco; un hub ne
   chiede due ogni volta.
2. I problemi trovati sono di **distribuzione**, non di struttura di base: troppe schede, gestione
   sparsa, pagine sovraccariche. A li risolve spostando, non reinventando.
3. Il valore della Home di B («Per te», prossimo evento) si ottiene in A arricchendo la pagina
   Eventi, senza una sezione in più né l'uscita delle notifiche dalla barra.
4. Si può fare a fasi rilasciabili una alla volta, ciascuna verificabile con gli e2e e il giro di
   schermate. Le prime (P0) sono piccole correzioni.

Da decidere insieme prima di procedere:

- **Nomi delle schede**: Riepilogo/Panoramica, Persone, Prepara.
- **«A cura di»**: nella finestra della voce diventa solo lettura, con il collegamento a Chi porta?
- **«Per te» in Eventi**: subito (fase 2) o dopo?
- **Due colonne su PC**: fase 4 o mai?

---

## 9. Bozze delle schermate

Bozze in `docs/audit/prototipi/index.html` (immagine: `docs/audit/prototipi/prototipi.png`):

1. **Eventi (iniziale)**: Famiglia attiva in testa, prossimo evento con conferme e cose da fare,
   «Per te», In programma, eventi nelle altre Famiglie.
2. **Elenco eventi**: segmenti In programma · Conclusi · Archivio, una riga per evento con lo stato,
   «Duplica dall'anno scorso».
3. **Riepilogo dell'evento**: intestazione compatta con «⋯», 5 schede, A che punto siamo, Edizioni,
   persone con accesso. **3b**: il menù «⋯» con la gestione.
4. **Persone → Presenze**: la tabella attuale dentro la nuova scheda. **4b**: Chi porta compatto
   in tabella.
5. **Ricette**: ricerca, portate, rubrica.
6. **Famiglia → Persone**: con l'app, senza app, inviti.
7. **Altro**: account, aspetto, ingredienti; amministrazione a parte.

Schermate di confronto dell'app attuale, in `docs/audit/schermate/`:

- `tel-01-eventi`: pagina vuota con più Famiglie;
- `tel-04-panoramica`;
- `tel-10-chi-porta`;
- `tel-16-ricetta`;
- `tel-21-famiglia-membri`;
- `tel-23-impostazioni`;
- `tel-26-evento-condiviso-lettura`;
- `tel-03-nuovo-evento`;
- `pc-panoramica`.

---

## 10. Piano di intervento per priorità

Complessità: S (≤ mezza giornata), M (1–2 giorni), L (più giorni). Rischio di regressione: basso,
medio, alto.

### P0 — Problemi gravi

| ID | Problema | Evidenza | Soluzione | Beneficio | Compl. | Rischio | Dipende da |
|---|---|---|---|---|---|---|---|
| P0-1 | Famiglia predefinita alfabetica, Eventi vuoto fuorviante | G1 | Predefinita: la Famiglia del prossimo evento (poi la più recente); a Famiglia senza eventi, «Hai N eventi in X — passa a X» | Nessuno «perde» i suoi eventi | S | Basso | — |
| P0-2 | Selettore Famiglia dentro evento e ricetta | G2 | Selettore solo in Eventi, Ricette, Famiglia; nell'intestazione dell'evento la sua Famiglia | Contesto sempre giusto | S | Basso | — |
| P0-3 | Chi legge non può duplicare | G3 | Duplica, Stampa, Lascia escluse da `SolaLettura` (solo connessione); e2e per chi legge | Percorso ripristinato come da SPEC | S | Basso | — |
| P0-4 | Nuovo evento in una Famiglia invisibile | G4 | Campo «Famiglia» nel modulo, con due o più Famiglie, predefinito sull'attiva | Eventi nel posto giusto | S | Basso | P0-1 |

### P1 — Usabilità

| ID | Problema | Soluzione | Compl. | Rischio | Dipende da |
|---|---|---|---|---|---|
| P1-1 | 7 schede, 3 fuori schermo (U1) | 5 schede: Riepilogo · Menù · Persone (Presenze · Chi porta) · Prepara (Spesa · Piano) · Bacheca; alias delle rotte vecchie | M | Medio (e2e, notifiche) | P2-1, P2-2 |
| P1-2 | Panoramica sovraccarica (U2, U3) | Intestazione con «⋯» e gestione nel menù, mostrata solo a chi può; coperti una volta; Edizioni in alto | M | Medio | P1-1 |
| P1-3 | «Tutto pronto» con menù vuoto (U4) | Indicatore «Menù vuoto» fra le cose in sospeso | S | Basso | — |
| P1-4 | Chi porta dispersivo (U5) | Tabella come Partecipanti; azioni nel menù della riga; modalità di modifica per chi organizza | M | Medio | P2-3 |
| P1-5 | Responsabile in due posti (U6) | «A cura di» in sola lettura nella voce, con il collegamento a Chi porta | S | Basso | P1-4 |
| P1-6 | Famiglia → Membri sovraccarica (U7, U8) | Schede Persone e Gestione; ricorrenze in Gestione | S | Basso | P2-1 |
| P1-7 | Impostazioni lunga e mista (U9, U15) | «Altro» con sottopagine; amministrazione raggruppata e nascosta a chi non amministra | M | Basso | P2-4 |
| P1-8 | Ricetta: gestione prima del contenuto (U10) | Contenuto prima; «⋯» con Visibilità e Copia; Vista cucina come azione principale; niente segnaposto in lettura | S | Basso | — |
| P1-9 | Vista cucina nascosta (U11) | Icona sulla riga del piatto con ricetta | S | Basso | — |
| P1-10 | Archivio e conclusi sparsi (U12) | Segmenti In programma · Conclusi · Archivio; «Duplica dall'anno scorso» | S | Basso (rotta `/eventi/archivio` come alias) | — |
| P1-11 | Messaggi che coprono le schede (U13) | Su telefono in basso, sopra la barra | S | Basso (togliere i `page.goto` di ripiego dagli e2e) | — |
| P1-12 | «Indietro» fisso (U14) | Torna alla pagina precedente dell'app, se c'è; altrimenti l'elenco | S | Basso | — |
| P1-13 | «Per te» in Eventi | Riquadro con incarichi miei, sondaggi aperti, notifiche da leggere (dati esistenti) | M | Basso | P0-1 |
| P1-14 | Nuovo evento lungo (U17) | «Altri dettagli» comprimibile | S | Basso | P0-4 |

### P2 — Coerenza grafica

| ID | Problema | Soluzione | Compl. | Rischio | Dipende da |
|---|---|---|---|---|---|
| P2-1 | Schede scritte due volte | Componente `Schede` (scorrimento con indizio) | S | Basso | — |
| P2-2 | Segmenti e filtri in 4 stili | Componenti `Segmenti` e `Filtro` usati in ricettario, spesa, piano, bacheca, notifiche | S | Basso | — |
| P2-3 | Tabelle compatte | `TabellaCompatta` estratta da Partecipanti, riusata in Chi porta e Reparti | S | Basso | — |
| P2-4 | Righe a link copiate | `RigaLink` e `TitoloSezione` | S | Basso | — |
| P2-5 | Gerarchia delle azioni | Regola: una principale, il resto in «⋯», distruttive ultime; pulsanti nascosti se non permessi | S (regola) + per schermata | Basso | P1-2 |
| P2-6 | Stati di presenza e incarichi | Mappa unica stato → badge | S | Basso | — |
| P2-7 | PC a una colonna stretta | Due colonne da 1024 px in Riepilogo e Ricetta | M | Basso | P1-2, P1-8 |
| P2-8 | Avviso PWA con `window.confirm` | `Conferma` dell'app | S | Basso | — |

### P3 — Manutenibilità (solo dove accompagna le fasi sopra)

| ID | Problema | Soluzione | Compl. | Rischio | Dipende da |
|---|---|---|---|---|---|
| P3-1 | File grandi (T1) | Separare per schermata mentre li si riorganizza (`PaginaFamiglia` → Bacheca/Persone/Gestione/Unisciti/Classifica; `PaginaPartecipanti` → tabella, finestre; `Bacheca` → composizione, scheda messaggio, sondaggio, proposta) | M | Basso | P1-1, P1-6 |
| P3-2 | Servizi misti (T2) | `servizi/ricorrenze.ts` prende edizioni e associazione; `condivisione.ts` diviso in eventi e ricette; rotte delle ricorrenze in un file loro | M | Basso (test server ampi) | — |
| P3-3 | API `/gruppi` e `/famiglie` (T3) | Rotte `/famiglie/:id/bacheca\|messaggi`, le vecchie come alias | S | Basso | — |
| P3-4 | Hook sparsi (T4) | `useRicorrenze`, `useEdizioni`, `usePartecipanti`, `useRiepilogo` in `src/api/query.ts` | S | Basso | — |
| P3-5 | Dominio nella UI (T5) | `nomeEdizione`, `annoDopo`, `confermaParziale`, proposta della ricorrenza in `src/domain` con test | S | Basso | — |
| P3-6 | Residui (T6) | Togliere i rami morti; `max_accompagnatori` resta nel database (nessuna migrazione) ma esce da contratto e interfaccia | S | Basso | — |
| P3-7 | e2e dipendenti dall'ordine (T7) | Famiglia e utenti propri per ogni file; helper per scegliere la Famiglia attiva; `multi-famiglia` su un server suo | M | Basso | — |
| P3-8 | SPEC non allineata | Correggere §3, §13, §22; aggiungere la mappa di navigazione | S | — | — |

### Fasi proposte

1. **Fase 1 — Correzioni** (P0-1…4, P1-3, P1-11, P2-8): un ramo, un rilascio. Nessuna
   migrazione.
2. **Fase 2 — Evento** (P2-1…3, P1-1, P1-2, P1-4, P1-5, P1-9, P1-12, P3-1 per i file toccati):
   nuova navigazione dell'evento con alias delle rotte.
3. **Fase 3 — Sezioni** (P1-6, P1-7, P1-8, P1-10, P1-13, P1-14, P2-4…6): Famiglia, Altro, Ricetta,
   Eventi.
4. **Fase 4 — Rifinitura e manutenzione** (P2-7, P3-2…8).

---

## 11. Rischi e strategia per evitare regressioni

| Rischio | Strategia |
|---|---|
| Collegamenti salvati e notifiche verso rotte che spariscono (`/chi-porta`, `/partecipanti`, `/spesa`, `/piano`, `/eventi/archivio`) | Le rotte vecchie restano come alias che portano alla scheda e al segmento nuovi; i collegamenti delle notifiche si calcolano alla lettura (§29.1), quindi si aggiornano da soli; test di ogni alias |
| e2e legati a nomi di schede e pulsanti | Aggiornati nello stesso ramo; prima della fase 2 si rende indipendente la Famiglia degli e2e (P3-7) |
| Permessi: nascondere pulsanti invece di spegnerli può nascondere troppo | Matrice per ruolo (proprietario, modifica, lettura con e senza «partecipa», non membro) in un e2e per schermata; il server resta l'unica autorità (`autorizzazione.test.ts` invariato) |
| Regressioni visive su telefono | Giro di schermate (`test-results/audit/giro.spec.ts`) rilanciato a ogni fase e confrontato; controllo dello scorrimento orizzontale già negli e2e |
| Più cambiamenti insieme da imparare | Una fase per rilascio; nota «Cosa cambia» in AVANZAMENTO per Loris; struttura dell'app (barra) invariata in A |
| Dati | Nessuna fase richiede migrazioni; P3-6 non tocca il database |
| PWA in cache con la versione vecchia | Avviso di aggiornamento già collaudato (§29.8); le rotte alias coprono chi aggiorna in ritardo |

**Stop**: l'audit si ferma qui. Nessuna modifica all'applicazione è stata fatta; l'implementazione
parte solo dopo la scelta della proposta e delle decisioni elencate in §8.
