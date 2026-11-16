-- Edizioni di una ricorrenza (SPEC §25): «Natale 2026», «Natale 2027»… condividono serie_id.
-- Nessuna ricorrenza automatica; gli eventi esistenti restano senza serie. Una serie non
-- unisce eventi di Famiglie diverse (né eventi personali con eventi di una Famiglia).
ALTER TABLE eventi ADD COLUMN serie_id TEXT;
CREATE INDEX eventi_serie ON eventi (serie_id) WHERE serie_id IS NOT NULL;

CREATE TRIGGER eventi_serie_stessa_famiglia BEFORE UPDATE OF serie_id, gruppo_id ON eventi WHEN NEW.serie_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'serie di Famiglie diverse')
  WHERE EXISTS (SELECT 1 FROM eventi e WHERE e.serie_id = NEW.serie_id AND e.id <> NEW.id AND e.gruppo_id IS NOT NEW.gruppo_id);
END;
CREATE TRIGGER eventi_serie_stessa_famiglia_ins BEFORE INSERT ON eventi WHEN NEW.serie_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'serie di Famiglie diverse')
  WHERE EXISTS (SELECT 1 FROM eventi e WHERE e.serie_id = NEW.serie_id AND e.gruppo_id IS NOT NEW.gruppo_id);
END;
