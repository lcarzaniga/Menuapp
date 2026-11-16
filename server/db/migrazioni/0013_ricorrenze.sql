-- Ricorrenze e ricette fra Famiglie (SPEC §28).
--
-- 1. Ricorrenze: un elenco per Famiglia («Natale», «Compleanno Carlo»…) a cui associare zero
--    o più eventi della stessa Famiglia. Nessuna frequenza né data: servono a ritrovare,
--    duplicare e confrontare. Sostituiscono la serie anonima della 0011 (eventi.serie_id).
-- 2. Una ricetta è visibile al massimo in una Famiglia; in un'altra Famiglia si copia, e la
--    copia è indipendente con una provenienza solo descrittiva.

CREATE TABLE ricorrenze (
  id TEXT PRIMARY KEY,
  gruppo_id TEXT NOT NULL REFERENCES gruppi (id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  nome_norm TEXT NOT NULL,
  descrizione TEXT NOT NULL DEFAULT '',
  creato_da TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL
) STRICT;
CREATE INDEX ricorrenze_gruppo ON ricorrenze (gruppo_id, nome_norm);

-- Eliminare una ricorrenza toglie solo l'associazione: eventi, menù e archivi restano.
ALTER TABLE eventi ADD COLUMN ricorrenza_id TEXT REFERENCES ricorrenze (id) ON DELETE SET NULL;
CREATE INDEX eventi_ricorrenza ON eventi (ricorrenza_id) WHERE ricorrenza_id IS NOT NULL;

-- Le serie già create (collegamenti espliciti fatti a mano o duplicando) diventano ricorrenze
-- con il nome della prima edizione; quelle di eventi personali (senza Famiglia) non possono
-- avere una ricorrenza e restano scollegate. Nessun collegamento è dedotto da nomi o date.
INSERT INTO ricorrenze (id, gruppo_id, nome, nome_norm, descrizione, creato_il, aggiornato_il)
SELECT s.serie_id, s.gruppo_id, s.nome, lower(s.nome), '', s.creato_il, s.creato_il
FROM (
  SELECT e.serie_id, e.gruppo_id, e.nome, e.creato_il,
         row_number() OVER (PARTITION BY e.serie_id ORDER BY e.data, e.creato_il) AS n
  FROM eventi e WHERE e.serie_id IS NOT NULL AND e.gruppo_id IS NOT NULL
) s WHERE s.n = 1;
UPDATE eventi SET ricorrenza_id = serie_id WHERE serie_id IN (SELECT id FROM ricorrenze);

DROP TRIGGER eventi_serie_stessa_famiglia;
DROP TRIGGER eventi_serie_stessa_famiglia_ins;
DROP INDEX eventi_serie;
ALTER TABLE eventi DROP COLUMN serie_id;

-- Una ricorrenza appartiene alla Famiglia dell'evento. Togliere la Famiglia (eliminata) lascia
-- fare: la ricorrenza sparisce con lei.
CREATE TRIGGER eventi_ricorrenza_ins BEFORE INSERT ON eventi WHEN NEW.ricorrenza_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'ricorrenza di un''altra Famiglia')
  WHERE NOT EXISTS (SELECT 1 FROM ricorrenze r WHERE r.id = NEW.ricorrenza_id AND r.gruppo_id IS NEW.gruppo_id);
END;
CREATE TRIGGER eventi_ricorrenza_upd BEFORE UPDATE OF ricorrenza_id ON eventi WHEN NEW.ricorrenza_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'ricorrenza di un''altra Famiglia')
  WHERE NOT EXISTS (SELECT 1 FROM ricorrenze r WHERE r.id = NEW.ricorrenza_id AND r.gruppo_id IS NEW.gruppo_id);
END;
CREATE TRIGGER eventi_ricorrenza_famiglia BEFORE UPDATE OF gruppo_id ON eventi WHEN NEW.ricorrenza_id IS NOT NULL AND NEW.gruppo_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'ricorrenza di un''altra Famiglia')
  WHERE NOT EXISTS (SELECT 1 FROM ricorrenze r WHERE r.id = NEW.ricorrenza_id AND r.gruppo_id = NEW.gruppo_id);
END;

-- Una ricetta in al massimo una Famiglia. Se esistessero ricette condivise con più Famiglie la
-- migrazione si ferma qui (vincolo violato) senza toccare nulla: la conversione in copie
-- richiede una decisione su quale Famiglia tiene l'originale (SPEC §28.5). Verificato: in
-- produzione non ce ne sono.
CREATE UNIQUE INDEX condivisioni_piatto_una_famiglia ON condivisioni_piatto_gruppo (piatto_id);

-- Provenienza di una copia da un'altra Famiglia: solo testo descrittivo (titolo originale, quando,
-- chi, eventualmente il nome della Famiglia). Nessun riferimento all'originale.
ALTER TABLE piatti ADD COLUMN provenienza TEXT CHECK (provenienza IS NULL OR json_valid(provenienza));
