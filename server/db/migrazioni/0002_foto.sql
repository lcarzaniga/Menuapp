-- Foto dei piatti (formato ricetta v1, docs/FORMATO-RICETTA.md). I file stanno in dati/foto/.
CREATE TABLE foto_piatti (
  id TEXT PRIMARY KEY,
  piatto_id TEXT NOT NULL REFERENCES piatti (id) ON DELETE CASCADE,
  ordine INTEGER NOT NULL CHECK (ordine >= 0),
  didascalia TEXT NOT NULL DEFAULT '',
  principale INTEGER NOT NULL DEFAULT 0 CHECK (principale IN (0, 1)),
  tipo TEXT NOT NULL CHECK (tipo IN ('image/jpeg', 'image/png', 'image/webp')),
  byte INTEGER NOT NULL CHECK (byte > 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL
) STRICT;
CREATE INDEX foto_piatti_piatto ON foto_piatti (piatto_id, ordine);
CREATE UNIQUE INDEX foto_piatti_principale ON foto_piatti (piatto_id) WHERE principale = 1;
