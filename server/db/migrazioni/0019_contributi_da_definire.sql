-- «Chi porta cosa» flessibile (SPEC §39): una voce del menù può essere un contributo «da definire»
-- (una portata a scelta di chi lo porta: «un primo a scelta») e valere più contributi («due
-- antipasti a scelta»). Menù e Chi porta restano lo stesso record: precisandolo più tardi (nome,
-- ricetta) l'incarico e le sue informazioni restano. Le voci esistenti non cambiano.
ALTER TABLE voci_menu ADD COLUMN da_definire INTEGER NOT NULL DEFAULT 0 CHECK (da_definire IN (0, 1));
ALTER TABLE voci_menu ADD COLUMN contributi INTEGER NOT NULL DEFAULT 1 CHECK (contributi BETWEEN 1 AND 99);
-- Un contributo da definire non ha ancora una ricetta.
CREATE TRIGGER voci_da_definire_senza_piatto BEFORE UPDATE OF da_definire, piatto_id ON voci_menu
WHEN NEW.da_definire = 1 AND NEW.piatto_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'contributo da definire con una ricetta');
END;
CREATE TRIGGER voci_da_definire_senza_piatto_ins BEFORE INSERT ON voci_menu
WHEN NEW.da_definire = 1 AND NEW.piatto_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'contributo da definire con una ricetta');
END;
