# Formato ricetta di Menù & Co. — versione 1

_Aggiornato il 12/11/2026: foto collegate ai passaggi del procedimento (campo `passo`, facoltativo: i file precedenti restano validi)._

Standard per scambiare ricette con Menù & Co.: importazione, esportazione, scrittura a mano.
Le versioni future restano leggibili: un'app che conosce la versione N importa tutte le
versioni ≤ N.

## 1. File

| Tipo | Estensione | Contenuto |
|---|---|---|
| Pacchetto completo | `.menuapp-ricetta` (è uno ZIP; vale anche `.zip`) | `ricetta.json` + cartella `foto/` |
| Solo dati | `.json` | il contenuto di `ricetta.json` (senza foto) |
| Scritto a mano | `.txt` o `.md` | testo nel formato del §3 |

Più ricette in un solo pacchetto: `ricette/<nome>/ricetta.json` e `ricette/<nome>/foto/…`
(ogni sottocartella è una ricetta).

## 2. `ricetta.json`

```json
{
  "formato": "menuapp-ricetta",
  "versione": 1,
  "nome": "Lasagne alla bolognese",
  "portata": "Primi",
  "porzioniBase": 6,
  "tempi": { "preparazioneMin": 40, "cotturaMin": 45, "riposoMin": 10 },
  "attrezzature": ["teglia 30×20", "frusta"],
  "ingredienti": [
    "500 g di lasagne",
    { "testo": "1 l di latte", "quantita": 1, "unita": "l", "nome": "latte" },
    { "testo": "noce moscata q.b.", "unita": "qb", "nome": "noce moscata" },
    { "testo": "pinoli 30 g", "quantita": 30, "unita": "g", "nome": "pinoli", "facoltativo": true }
  ],
  "procedimento": ["Preparare il ragù…", "Montare gli strati…"],
  "note": "Si prepara anche il giorno prima.",
  "fonte": "nonna Pina",
  "foto": [
    { "file": "foto/1.jpg", "didascalia": "La teglia appena sfornata", "principale": true },
    { "file": "foto/2.jpg", "passo": 2, "didascalia": "Gli strati" }
  ]
}
```

Regole:

- Obbligatori: `formato`, `versione`, `nome`. Tutto il resto è facoltativo.
- `porzioniBase`: numero > 0 o `null`. `tempi`: minuti interi ≥ 0.
- `ingredienti`: ogni elemento è **una riga di testo** (verrà interpretata come quando si
  incolla) **oppure un oggetto** con `testo` obbligatorio e, facoltativi, `quantita`,
  `quantitaMax`, `unita` (codici di SPEC §8.1: `g`, `kg`, `ml`, `l`, `pz`, `cucchiaio`,
  `spicchio`, `confezione`, `qb`…), `nome`, `nota`, `facoltativo`, `scalatura`
  (`proporzionale` | `fissa`). Se l'oggetto indica `nome`, i campi sono considerati già
  verificati; altrimenti il `testo` passa dal parser.
- `procedimento`: un passaggio per elemento.
- `foto`: al massimo **10**; `file` è il percorso nel pacchetto; formati JPEG, PNG, WebP.
  `passo` (facoltativo) collega la foto a un passaggio del `procedimento`, **numerato da 1**;
  deve esistere. Senza `passo` la foto sta solo nella galleria. Più foto possono
  illustrare lo stesso passaggio.
  All'importazione le foto vengono ridotte a 1600 px sul lato lungo. Al massimo una
  `principale`; se nessuna lo è, è la prima.
- Campi sconosciuti: ignorati (compatibilità con versioni future).
- Testo in UTF-8.

### Foto dei passaggi

Ogni foto può illustrare un passaggio del procedimento con `passo`, numerato da 1 come nel
testo. Più foto possono riferirsi allo stesso passaggio; una foto senza `passo` sta solo
nella galleria del piatto. Una foto può essere insieme `principale` e collegata a un
passaggio.

```json
{
  "formato": "menuapp-ricetta",
  "versione": 1,
  "nome": "Tiramisù",
  "porzioniBase": 8,
  "procedimento": [
    "Montare i tuorli con lo zucchero fino a renderli chiari.",
    "Unire il mascarpone e poi gli albumi montati.",
    "Alternare savoiardi bagnati nel caffè e crema."
  ],
  "foto": [
    { "file": "foto/fetta.jpg", "didascalia": "La fetta", "principale": true },
    { "file": "foto/tuorli.jpg", "passo": 1, "didascalia": "Tuorli montati" },
    { "file": "foto/strati-1.jpg", "passo": 3 },
    { "file": "foto/strati-2.jpg", "passo": 3, "didascalia": "Secondo strato" }
  ]
}
```

Nell'app le foto di un passaggio compaiono sotto il passaggio, sia nella scheda del piatto
sia nella vista cucina. Se il procedimento viene modificato, ogni foto segue il suo
passaggio quando il testo è rimasto uguale (anche se spostato) o è stato solo ritoccato; se
il passaggio è stato riscritto o eliminato, la foto resta nella galleria.

## 3. Scrittura a mano (`.txt` / `.md`)

```
# Lasagne alla bolognese

Portata: Primi
Porzioni: 6
Preparazione: 40 min
Cottura: 45 min
Riposo: 10 min
Attrezzature: teglia 30×20, frusta
Fonte: nonna Pina

## Ingredienti
- 500 g di lasagne
- 1 l di latte
- noce moscata q.b.
- pinoli 30 g (facoltativo)

## Procedimento
1. Preparare il ragù.
2. Montare gli strati e infornare.

## Note
Si prepara anche il giorno prima.
```

Regole:

- **Titolo**: la prima riga che comincia con `#`, altrimenti la prima riga non vuota.
- **Campi** `Chiave: valore` prima delle sezioni: `Portata`, `Porzioni` (anche «per 6
  persone»), `Preparazione`, `Cottura`, `Riposo` (minuti; si accettano «1 h 30 min»,
  «90 min», «1 ora»), `Attrezzature` (separate da virgola), `Fonte`. Maiuscole
  indifferenti.
- **Sezioni**: una riga `## Ingredienti`, `Ingredienti:` o `INGREDIENTI` apre la sezione;
  lo stesso per `Procedimento` (anche `Preparazione` come sezione, `Istruzioni`) e `Note`.
- Ingredienti: una riga ciascuno, con o senza trattino o numero; interpretati dal parser
  (SPEC §8). Le righe che finiscono con `:` («Per la besciamella:») sono titoli e vengono
  ignorate.
- Procedimento: passaggi numerati (`1.`, `1)`) o separati da una riga vuota.
- Nessuna foto nel formato testo: per le foto dei passaggi si usa il pacchetto.

## 4. Importazione nell'app

1. *Ricettario → Importa*: si sceglie un file oppure si incolla il testo.
   *Scarica template .md* salva `ricetta-template.md` (UTF-8): un modello nel formato del §3 con
   valori d'esempio da sostituire, importabile così com'è (`TEMPLATE_RICETTA` in
   `src/domain/ricetta/formato.ts`).
2. Anteprima: dati del piatto, ingredienti con il badge **Certo** / **Da verificare** (come
   nell'editor), passaggi, foto.
3. Le foto mantengono didascalia, principale e passaggio; un `passo` che non esiste nel
   procedimento rende il file non valido (messaggio chiaro, nulla viene importato).
4. Se esiste già un piatto con lo stesso nome, l'app lo segnala e propone un nome diverso;
   non sovrascrive mai.
5. «Importa» crea il piatto e carica le foto; poi si apre la scheda per le correzioni.

## 5. Esportazione

*Piatto → Esporta ricetta*: scarica `nome-del-piatto.menuapp-ricetta` con `ricetta.json`
(ingredienti come oggetti completi, foto con didascalia, principale e `passo`) e le foto
salvate dall'app. *Condividi come testo* produce il formato del §3 (senza foto).

## 6. Compatibilità

- Un file senza `passo` o senza foto è sempre valido.
- Campi sconosciuti vengono ignorati: un'app più vecchia importa una ricetta più recente
  della stessa versione perdendo solo le informazioni che non conosce.
- Una `versione` maggiore di quella supportata viene rifiutata con «aggiorna l'app».
