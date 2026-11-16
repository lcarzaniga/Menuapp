-- Più Famiglie per persona (SPEC §21): eventi associati a una Famiglia, ricette condivise con
-- Famiglie precise, inviti ad aderire a una Famiglia (distinti dagli inviti all'account).
-- Nessun dato cambia visibilità: le regole qui sotto riproducono esattamente quella attuale.

-- Evento → Famiglia. Gli eventi esistenti vanno alla Famiglia del proprietario quando ne ha
-- una sola (oggi tutti); con zero o più Famiglie restano senza (da assegnare a mano).
ALTER TABLE eventi ADD COLUMN gruppo_id TEXT REFERENCES gruppi (id) ON DELETE SET NULL;
UPDATE eventi SET gruppo_id = (SELECT m.gruppo_id FROM membri_gruppo m WHERE m.utente_id = eventi.proprietario_id)
WHERE (SELECT count(*) FROM membri_gruppo m WHERE m.utente_id = eventi.proprietario_id) = 1;
CREATE INDEX eventi_gruppo ON eventi (gruppo_id);

-- Ricetta → Famiglie con cui è condivisa. Finora «di famiglia» voleva dire «visibile in tutte le
-- Famiglie del proprietario»: le stesse righe esplicite. Le private restano private.
CREATE TABLE condivisioni_piatto_gruppo (
  piatto_id TEXT NOT NULL REFERENCES piatti (id) ON DELETE CASCADE,
  gruppo_id TEXT NOT NULL REFERENCES gruppi (id) ON DELETE CASCADE,
  creato_il INTEGER NOT NULL,
  PRIMARY KEY (piatto_id, gruppo_id)
) STRICT;
CREATE INDEX condivisioni_piatto_gruppo_gruppo ON condivisioni_piatto_gruppo (gruppo_id);
INSERT INTO condivisioni_piatto_gruppo (piatto_id, gruppo_id, creato_il)
SELECT p.id, m.gruppo_id, CAST(unixepoch('subsec') * 1000 AS INTEGER)
FROM piatti p JOIN membri_gruppo m ON m.utente_id = p.proprietario_id
WHERE p.visibilita = 'famiglia';
-- La colonna piatti.visibilita resta solo per compatibilità (ritorno al rilascio precedente):
-- la condivisione con le Famiglie è ora in condivisioni_piatto_gruppo.

-- Inviti ad aderire a una Famiglia: link monouso per chi ha già un account.
CREATE TABLE inviti_famiglia (
  id TEXT PRIMARY KEY,
  gruppo_id TEXT NOT NULL REFERENCES gruppi (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  creato_da TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  creato_il INTEGER NOT NULL,
  scade_il INTEGER NOT NULL,
  usato_da TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  usato_il INTEGER,
  annullato_il INTEGER
) STRICT;
CREATE INDEX inviti_famiglia_gruppo ON inviti_famiglia (gruppo_id);
