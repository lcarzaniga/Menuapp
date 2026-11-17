-- Ricorrenze standard (SPEC §30): Vigilia di Natale, Natale, Santo Stefano… sono un catalogo nel
-- codice (src/domain/ricorrenze.ts), uguale per tutte le Famiglie: nessuna riga per Famiglia.
-- Un evento ha al massimo una ricorrenza: della Famiglia (ricorrenza_id) oppure standard
-- (ricorrenza_standard, identificativo stabile del catalogo).
--
-- ricorrenza_manuale = 1: la ricorrenza (o la sua assenza) l'ha scelta una persona; l'app non
-- la cambia né la ripropone finché non cambia l'occasione dell'evento. Gli eventi che hanno già
-- una ricorrenza la conservano come scelta manuale; nessun evento esistente viene associato.
ALTER TABLE eventi ADD COLUMN ricorrenza_standard TEXT
  CHECK (ricorrenza_standard IS NULL OR (length(ricorrenza_standard) BETWEEN 1 AND 40 AND ricorrenza_standard NOT GLOB '*[^a-z-]*'));
ALTER TABLE eventi ADD COLUMN ricorrenza_manuale INTEGER NOT NULL DEFAULT 0 CHECK (ricorrenza_manuale IN (0, 1));
UPDATE eventi SET ricorrenza_manuale = 1 WHERE ricorrenza_id IS NOT NULL;

CREATE INDEX eventi_ricorrenza_standard ON eventi (gruppo_id, ricorrenza_standard) WHERE ricorrenza_standard IS NOT NULL;

-- Una sola ricorrenza per evento. (Che serva una Famiglia lo verifica il servizio: un vincolo
-- su gruppo_id bloccherebbe il suo ON DELETE SET NULL.)
CREATE TRIGGER eventi_una_ricorrenza_ins BEFORE INSERT ON eventi
WHEN NEW.ricorrenza_standard IS NOT NULL AND NEW.ricorrenza_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'una sola ricorrenza per evento');
END;
CREATE TRIGGER eventi_una_ricorrenza_upd BEFORE UPDATE OF ricorrenza_standard, ricorrenza_id ON eventi
WHEN NEW.ricorrenza_standard IS NOT NULL AND NEW.ricorrenza_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'una sola ricorrenza per evento');
END;
