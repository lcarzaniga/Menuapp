-- Ricette pubbliche nell'app (docs/PIANO-EVOLUZIONE.md §1, SPEC §36): visibili in sola lettura a
-- tutti gli utenti con una sessione, mai agli anonimi. Nessuna ricetta esistente diventa pubblica.
-- Si pubblica solo una ricetta con la Famiglia d'origine indicata (§35).
ALTER TABLE piatti ADD COLUMN pubblica INTEGER NOT NULL DEFAULT 0 CHECK (pubblica IN (0, 1));
CREATE INDEX piatti_pubbliche ON piatti (nome_norm) WHERE pubblica = 1;

CREATE TRIGGER piatti_pubblica_con_origine BEFORE UPDATE OF pubblica ON piatti
WHEN NEW.pubblica = 1 AND NEW.famiglia_origine_nome IS NULL
BEGIN
  SELECT RAISE(ABORT, 'ricetta pubblica senza Famiglia d''origine');
END;
CREATE TRIGGER piatti_pubblica_con_origine_ins BEFORE INSERT ON piatti
WHEN NEW.pubblica = 1 AND NEW.famiglia_origine_nome IS NULL
BEGIN
  SELECT RAISE(ABORT, 'ricetta pubblica senza Famiglia d''origine');
END;

-- Preferenze personali, uguali su tutti i dispositivi dell'utente.
CREATE TABLE preferenze_utente (
  utente_id TEXT PRIMARY KEY REFERENCES utenti (id) ON DELETE CASCADE,
  -- «Includi ricette pubbliche» nel ricettario e nelle ricerche: spenta all'inizio.
  includi_pubbliche INTEGER NOT NULL DEFAULT 0 CHECK (includi_pubbliche IN (0, 1)),
  versione INTEGER NOT NULL DEFAULT 1,
  aggiornato_il INTEGER NOT NULL
) STRICT;
