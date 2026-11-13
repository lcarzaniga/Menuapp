-- Multiutente (SPEC §19): utenti, dispositivi autorizzati su invito, condivisioni.
-- I token (inviti, richieste, sessioni) sono conservati solo come impronta SHA-256.
-- Tutti i dati esistenti passano all'amministratore iniziale.

CREATE TABLE utenti (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  nome_norm TEXT NOT NULL UNIQUE,
  ruolo TEXT NOT NULL DEFAULT 'utente' CHECK (ruolo IN ('amministratore', 'utente')),
  stato TEXT NOT NULL DEFAULT 'attivo' CHECK (stato IN ('attivo', 'sospeso')),
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL
) STRICT;

-- Invito monouso per autorizzare un dispositivo di un utente.
CREATE TABLE inviti (
  id TEXT PRIMARY KEY,
  utente_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  creato_da TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  creato_il INTEGER NOT NULL,
  scade_il INTEGER NOT NULL,
  usato_il INTEGER,
  annullato_il INTEGER
) STRICT;
CREATE INDEX inviti_utente ON inviti (utente_id);

-- Richiesta di attivazione nata da un invito: solo il browser che possiede il segreto
-- della richiesta (cookie) riceve la sessione, dopo l'approvazione di questa richiesta.
CREATE TABLE richieste_attivazione (
  id TEXT PRIMARY KEY,
  invito_id TEXT NOT NULL UNIQUE REFERENCES inviti (id) ON DELETE CASCADE,
  utente_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE CASCADE,
  segreto_hash TEXT NOT NULL UNIQUE CHECK (length(segreto_hash) = 64),
  codice TEXT NOT NULL,
  dispositivo TEXT NOT NULL DEFAULT '',
  agente TEXT NOT NULL DEFAULT '',
  stato TEXT NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'approvata', 'rifiutata', 'completata')),
  deciso_da TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  creato_il INTEGER NOT NULL,
  scade_il INTEGER NOT NULL,
  deciso_il INTEGER
) STRICT;
CREATE INDEX richieste_utente ON richieste_attivazione (utente_id, stato);

CREATE TABLE sessioni (
  id TEXT PRIMARY KEY,
  utente_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  dispositivo TEXT NOT NULL DEFAULT '',
  agente TEXT NOT NULL DEFAULT '',
  creato_il INTEGER NOT NULL,
  ultimo_uso INTEGER NOT NULL,
  scade_il INTEGER NOT NULL,
  revocata_il INTEGER
) STRICT;
CREATE INDEX sessioni_utente ON sessioni (utente_id);

CREATE TABLE condivisioni_evento (
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  utente_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE CASCADE,
  permesso TEXT NOT NULL CHECK (permesso IN ('lettura', 'modifica')),
  creato_il INTEGER NOT NULL,
  PRIMARY KEY (evento_id, utente_id)
) STRICT;
CREATE INDEX condivisioni_evento_utente ON condivisioni_evento (utente_id);

-- Le ricette si condividono solo in lettura: chi le usa ne fa una copia.
CREATE TABLE condivisioni_piatto (
  piatto_id TEXT NOT NULL REFERENCES piatti (id) ON DELETE CASCADE,
  utente_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE CASCADE,
  creato_il INTEGER NOT NULL,
  PRIMARY KEY (piatto_id, utente_id)
) STRICT;
CREATE INDEX condivisioni_piatto_utente ON condivisioni_piatto (utente_id);

INSERT INTO utenti (id, nome, nome_norm, ruolo, stato, creato_il, aggiornato_il)
VALUES ('utente-amministratore', 'Loris', 'loris', 'amministratore', 'attivo',
        CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER));

-- Proprietario: colonna con chiave esterna e predefinito NULL (SQLite non ammette altro con
-- le chiavi esterne attive), poi assegnata e resa obbligatoria dai trigger.
ALTER TABLE eventi ADD COLUMN proprietario_id TEXT REFERENCES utenti (id) ON DELETE RESTRICT;
UPDATE eventi SET proprietario_id = 'utente-amministratore';
CREATE INDEX eventi_proprietario ON eventi (proprietario_id);
CREATE TRIGGER eventi_proprietario_ins BEFORE INSERT ON eventi WHEN NEW.proprietario_id IS NULL
BEGIN SELECT RAISE(ABORT, 'eventi.proprietario_id obbligatorio'); END;
CREATE TRIGGER eventi_proprietario_upd BEFORE UPDATE OF proprietario_id ON eventi WHEN NEW.proprietario_id IS NULL
BEGIN SELECT RAISE(ABORT, 'eventi.proprietario_id obbligatorio'); END;

ALTER TABLE piatti ADD COLUMN proprietario_id TEXT REFERENCES utenti (id) ON DELETE RESTRICT;
-- Copia di una ricetta altrui: da dove viene (senza vincolo: l'originale può sparire).
ALTER TABLE piatti ADD COLUMN origine_piatto_id TEXT;
ALTER TABLE piatti ADD COLUMN origine_autore TEXT NOT NULL DEFAULT '';
UPDATE piatti SET proprietario_id = 'utente-amministratore';
CREATE INDEX piatti_proprietario ON piatti (proprietario_id, nome_norm);
CREATE TRIGGER piatti_proprietario_ins BEFORE INSERT ON piatti WHEN NEW.proprietario_id IS NULL
BEGIN SELECT RAISE(ABORT, 'piatti.proprietario_id obbligatorio'); END;
CREATE TRIGGER piatti_proprietario_upd BEFORE UPDATE OF proprietario_id ON piatti WHEN NEW.proprietario_id IS NULL
BEGIN SELECT RAISE(ABORT, 'piatti.proprietario_id obbligatorio'); END;

-- Una voce può collegarsi solo a un piatto del proprietario dell'evento (le ricette altrui
-- entrano come copia): nessuna dipendenza fra i dati di utenti diversi.
CREATE TRIGGER voci_piatto_proprietario_ins BEFORE INSERT ON voci_menu
WHEN NEW.piatto_id IS NOT NULL AND EXISTS (SELECT 1 FROM piatti WHERE id = NEW.piatto_id)
  AND (SELECT proprietario_id FROM piatti WHERE id = NEW.piatto_id)
  IS NOT (SELECT proprietario_id FROM eventi WHERE id = NEW.evento_id)
BEGIN SELECT RAISE(ABORT, 'voce collegata a un piatto di un altro utente'); END;
CREATE TRIGGER voci_piatto_proprietario_upd BEFORE UPDATE OF piatto_id ON voci_menu
WHEN NEW.piatto_id IS NOT NULL AND EXISTS (SELECT 1 FROM piatti WHERE id = NEW.piatto_id)
  AND (SELECT proprietario_id FROM piatti WHERE id = NEW.piatto_id)
  IS NOT (SELECT proprietario_id FROM eventi WHERE id = NEW.evento_id)
BEGIN SELECT RAISE(ABORT, 'voce collegata a un piatto di un altro utente'); END;
