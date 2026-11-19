-- Collaborazione sulle ricette (SPEC §41): proposte di modifica con approvazione per singola
-- modifica, cronologia delle revisioni con ripristino, trasferimento della proprietà (volontario o
-- dall'amministratore della Famiglia, sempre accettato dal destinatario). Nessun dato esistente cambia.

CREATE TABLE proposte_piatto (
  id TEXT PRIMARY KEY,
  piatto_id TEXT NOT NULL REFERENCES piatti (id) ON DELETE CASCADE,
  autore_id TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  autore_nome TEXT NOT NULL,
  -- Versione della ricetta su cui è stata preparata.
  versione_base INTEGER NOT NULL,
  motivazione TEXT NOT NULL DEFAULT '' CHECK (length(motivazione) <= 2000),
  stato TEXT NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'conclusa', 'ritirata')),
  -- Richieste di chiarimento e risposte: [{ autoreId, autoreNome, testo, il }].
  chiarimenti TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(chiarimenti)),
  deciso_da_id TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  deciso_da_nome TEXT,
  deciso_il INTEGER,
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL
) STRICT;
CREATE INDEX proposte_piatto_piatto ON proposte_piatto (piatto_id, stato, creato_il);
CREATE INDEX proposte_piatto_autore ON proposte_piatto (autore_id, stato);

-- Le singole modifiche: un campo, un ingrediente (chiave = suo id) o una foto (chiave = suo id).
-- «prima» è il valore ufficiale quando la proposta è nata: il conflitto si ricalcola sempre.
CREATE TABLE modifiche_proposta (
  id TEXT PRIMARY KEY,
  proposta_id TEXT NOT NULL REFERENCES proposte_piatto (id) ON DELETE CASCADE,
  ordine INTEGER NOT NULL,
  campo TEXT NOT NULL,
  operazione TEXT NOT NULL CHECK (operazione IN ('modifica', 'aggiungi', 'rimuovi')),
  chiave TEXT,
  prima TEXT CHECK (prima IS NULL OR json_valid(prima)),
  dopo TEXT CHECK (dopo IS NULL OR json_valid(dopo)),
  -- Un'altra modifica della stessa proposta senza la quale questa non si applica (nessun vincolo:
  -- l'ordine di ripristino dei backup non lo garantisce).
  dipende_da TEXT,
  stato TEXT NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'approvata', 'rifiutata', 'ritirata')),
  motivo TEXT NOT NULL DEFAULT '' CHECK (length(motivo) <= 1000)
) STRICT;
CREATE INDEX modifiche_proposta_proposta ON modifiche_proposta (proposta_id, ordine);

-- Foto proposte: le stesse foto delle ricette (file, impronte, backup, R2), legate alla proposta;
-- fuori dalla galleria finché non vengono approvate.
ALTER TABLE foto_piatti ADD COLUMN proposta_id TEXT REFERENCES proposte_piatto (id) ON DELETE CASCADE;
CREATE INDEX foto_piatti_proposta ON foto_piatti (proposta_id) WHERE proposta_id IS NOT NULL;
CREATE TRIGGER foto_proposta_non_principale BEFORE INSERT ON foto_piatti
WHEN NEW.proposta_id IS NOT NULL AND NEW.principale = 1
BEGIN
  SELECT RAISE(ABORT, 'foto proposta come foto principale');
END;

-- Cronologia: ogni modifica applicata (diretta, da proposta, ripristino, foto, proprietà).
-- «contenuto» è la ricetta dopo la revisione (per il ripristino); «campi» ciò che è cambiato.
CREATE TABLE revisioni_piatto (
  id TEXT PRIMARY KEY,
  piatto_id TEXT NOT NULL REFERENCES piatti (id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('iniziale', 'modifica', 'proposta', 'ripristino', 'foto', 'trasferimento', 'riassegnazione')),
  autore_id TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  autore_nome TEXT NOT NULL,
  approvato_da_id TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  approvato_da_nome TEXT,
  proposta_id TEXT REFERENCES proposte_piatto (id) ON DELETE SET NULL,
  ripristina_numero INTEGER,
  campi TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(campi)),
  contenuto TEXT CHECK (contenuto IS NULL OR json_valid(contenuto)),
  motivazione TEXT NOT NULL DEFAULT '',
  creato_il INTEGER NOT NULL,
  UNIQUE (piatto_id, numero)
) STRICT;

-- Trasferimento della proprietà: diventa effettivo solo quando il destinatario accetta.
CREATE TABLE trasferimenti_piatto (
  id TEXT PRIMARY KEY,
  piatto_id TEXT NOT NULL REFERENCES piatti (id) ON DELETE CASCADE,
  da_id TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  a_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE CASCADE,
  -- Famiglia attraverso cui avviene (quella con cui la ricetta è condivisa).
  gruppo_id TEXT REFERENCES gruppi (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('volontario', 'amministrativo')),
  motivazione TEXT NOT NULL DEFAULT '' CHECK (length(motivazione) <= 1000),
  stato TEXT NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'accettato', 'rifiutato', 'annullato')),
  creato_da_id TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  creato_da_nome TEXT NOT NULL,
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  deciso_il INTEGER,
  CHECK (tipo = 'volontario' OR length(trim(motivazione)) > 0)
) STRICT;
CREATE UNIQUE INDEX trasferimenti_uno_in_attesa ON trasferimenti_piatto (piatto_id) WHERE stato = 'in_attesa';
CREATE INDEX trasferimenti_destinatario ON trasferimenti_piatto (a_id, stato);
