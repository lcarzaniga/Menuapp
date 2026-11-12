-- Foto associate a un passaggio del procedimento (indice da 0; NULL = solo galleria).
ALTER TABLE foto_piatti ADD COLUMN passo INTEGER CHECK (passo IS NULL OR passo >= 0);
CREATE INDEX foto_piatti_passo ON foto_piatti (piatto_id, passo);
