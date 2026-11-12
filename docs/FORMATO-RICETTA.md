# Formato ricetta di Menù & Co. — versione 1

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
    { "file": "foto/2.jpg" }
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
  All'importazione le foto vengono ridotte a 1600 px sul lato lungo. Al massimo una
  `principale`; se nessuna lo è, è la prima.
- Campi sconosciuti: ignorati (compatibilità con versioni future).
- Testo in UTF-8.

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
- Nessuna foto nel formato testo.

## 4. Importazione nell'app

1. *Ricettario → Importa*: si sceglie un file oppure si incolla il testo.
2. Anteprima: dati del piatto, ingredienti con il badge **Certo** / **Da verificare** (come
   nell'editor), passaggi, foto.
3. Se esiste già un piatto con lo stesso nome, l'app lo segnala e propone un nome diverso;
   non sovrascrive mai.
4. «Importa» crea il piatto e carica le foto; poi si apre la scheda per le correzioni.

## 5. Esportazione

*Piatto → Esporta*: scarica `nome-del-piatto.menuapp-ricetta` con `ricetta.json`
(ingredienti come oggetti completi) e le foto originali salvate dall'app.
