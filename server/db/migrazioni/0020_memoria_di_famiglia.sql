-- Memoria di famiglia (SPEC §40): storia della ricetta, ricordi dei familiari, esperienze di
-- preparazione. Una sola tabella, già pensata per un futuro archivio di famiglia: ogni contributo
-- appartiene a una Famiglia (`gruppo_id`); in questa fase è sempre legato a una ricetta, ma
-- `piatto_id` può restare vuoto per i ricordi non collegati a una ricetta, che arriveranno poi.
CREATE TABLE memorie (
  id TEXT PRIMARY KEY,
  gruppo_id TEXT REFERENCES gruppi (id) ON DELETE SET NULL,
  piatto_id TEXT REFERENCES piatti (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('storia', 'ricordo', 'esperienza')),
  testo TEXT NOT NULL DEFAULT '' CHECK (length(testo) <= 20000),
  -- Esperienze: l'evento in cui la ricetta è stata preparata (facoltativo).
  evento_id TEXT REFERENCES eventi (id) ON DELETE SET NULL,
  -- Solo la storia si pubblica, e solo esplicitamente, insieme alla ricetta pubblica (§36).
  pubblica INTEGER NOT NULL DEFAULT 0 CHECK (pubblica IN (0, 1)),
  autore_id TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  -- Il nome resta anche se l'account viene eliminato.
  autore_nome TEXT NOT NULL,
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL,
  CHECK (tipo = 'storia' OR pubblica = 0),
  CHECK (tipo = 'esperienza' OR evento_id IS NULL)
) STRICT;
CREATE UNIQUE INDEX memorie_una_storia ON memorie (piatto_id) WHERE tipo = 'storia';
CREATE INDEX memorie_piatto ON memorie (piatto_id, tipo, creato_il);
CREATE INDEX memorie_gruppo ON memorie (gruppo_id, creato_il);

-- Fotografie storiche e dei ricordi: le stesse foto delle ricette (file, backup, impronte), legate
-- al contributo. Non compaiono fra le foto della ricetta e non passano nelle copie.
ALTER TABLE foto_piatti ADD COLUMN memoria_id TEXT REFERENCES memorie (id) ON DELETE CASCADE;
CREATE INDEX foto_piatti_memoria ON foto_piatti (memoria_id) WHERE memoria_id IS NOT NULL;
CREATE TRIGGER foto_memoria_non_principale BEFORE INSERT ON foto_piatti
WHEN NEW.memoria_id IS NOT NULL AND (NEW.principale = 1 OR NEW.passo IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'foto di un ricordo come foto della ricetta');
END;
