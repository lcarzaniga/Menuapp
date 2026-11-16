-- Partecipanti, conferme e accompagnatori (SPEC §24). Facoltativi: un evento senza elenco
-- funziona come prima con i numeri adulti/bambini. Gli eventi esistenti restano con i coperti
-- manuali e nessun partecipante viene creato dai loro numeri.

-- Coperti calcolati dai partecipanti confermati (1) oppure dai numeri scritti a mano (0).
-- Le colonne adulti e bambini restano i numeri manuali anche in modalità automatica.
ALTER TABLE eventi ADD COLUMN coperti_automatici INTEGER NOT NULL DEFAULT 0 CHECK (coperti_automatici IN (0, 1));
-- Quanti accompagnatori può aggiungere da sé chi usa l'app (NULL: nessun limite).
ALTER TABLE eventi ADD COLUMN max_accompagnatori INTEGER CHECK (max_accompagnatori IS NULL OR max_accompagnatori BETWEEN 0 AND 99);

-- Una riga per persona con un nome: il titolare di un invito (invito_id NULL) o un suo
-- accompagnatore nominativo (invito_id = titolare). Gli accompagnatori senza nome sono solo
-- quantità sul titolare, per categoria e stato. Ogni persona conta una volta sola: diventare
-- partecipante autonomo cambia invito_id della stessa riga.
CREATE TABLE partecipanti (
  id TEXT PRIMARY KEY,
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  invito_id TEXT REFERENCES partecipanti (id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  nome_norm TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'adulto' CHECK (categoria IN ('adulto', 'bambino')),
  stato TEXT NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'confermato', 'assente')),
  note TEXT NOT NULL DEFAULT '',
  -- Collegamenti facoltativi: non danno accesso all'evento né appartenenza alla Famiglia.
  utente_id TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  esterno_id TEXT REFERENCES persone_esterne (id) ON DELETE SET NULL,
  anonimi_adulti_confermati INTEGER NOT NULL DEFAULT 0 CHECK (anonimi_adulti_confermati BETWEEN 0 AND 99),
  anonimi_adulti_in_attesa INTEGER NOT NULL DEFAULT 0 CHECK (anonimi_adulti_in_attesa BETWEEN 0 AND 99),
  anonimi_bambini_confermati INTEGER NOT NULL DEFAULT 0 CHECK (anonimi_bambini_confermati BETWEEN 0 AND 99),
  anonimi_bambini_in_attesa INTEGER NOT NULL DEFAULT 0 CHECK (anonimi_bambini_in_attesa BETWEEN 0 AND 99),
  ordine INTEGER NOT NULL DEFAULT 0,
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL,
  CHECK (utente_id IS NULL OR esterno_id IS NULL),
  CHECK (invito_id IS NULL OR invito_id <> id),
  CHECK (invito_id IS NULL OR anonimi_adulti_confermati + anonimi_adulti_in_attesa + anonimi_bambini_confermati + anonimi_bambini_in_attesa = 0)
) STRICT;
CREATE INDEX partecipanti_evento ON partecipanti (evento_id, ordine);
CREATE INDEX partecipanti_invito ON partecipanti (invito_id);
CREATE UNIQUE INDEX partecipanti_utente ON partecipanti (evento_id, utente_id) WHERE utente_id IS NOT NULL;
CREATE UNIQUE INDEX partecipanti_esterno ON partecipanti (evento_id, esterno_id) WHERE esterno_id IS NOT NULL;

-- Un accompagnatore appartiene a un titolare dello stesso evento; chi ha accompagnatori non
-- può diventare accompagnatore di altri (un solo livello).
CREATE TRIGGER partecipanti_invito_ins BEFORE INSERT ON partecipanti WHEN NEW.invito_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'invito non valido')
  WHERE NOT EXISTS (SELECT 1 FROM partecipanti t WHERE t.id = NEW.invito_id AND t.evento_id = NEW.evento_id AND t.invito_id IS NULL);
END;
CREATE TRIGGER partecipanti_invito_upd BEFORE UPDATE OF invito_id, evento_id ON partecipanti WHEN NEW.invito_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'invito non valido')
  WHERE NOT EXISTS (SELECT 1 FROM partecipanti t WHERE t.id = NEW.invito_id AND t.evento_id = NEW.evento_id AND t.invito_id IS NULL)
     OR EXISTS (SELECT 1 FROM partecipanti a WHERE a.invito_id = NEW.id);
END;
