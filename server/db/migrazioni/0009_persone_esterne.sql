-- Persone senza account (SPEC §22): una piccola rubrica per Famiglia di parenti e amici che
-- non usano l'app (zio Marco, nonna Maria), utilizzabili come responsabili degli incarichi.
-- Non hanno identità digitale, sessioni né permessi: sono solo nomi.

CREATE TABLE persone_esterne (
  id TEXT PRIMARY KEY,
  gruppo_id TEXT NOT NULL REFERENCES gruppi (id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  nome_norm TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  creato_da TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL,
  UNIQUE (gruppo_id, nome_norm)
) STRICT;

-- Responsabile esterno di un incarico. Il nome resta in «A cura di» (incaricato): se la persona
-- viene tolta dalla rubrica l'incarico conserva il nome.
ALTER TABLE voci_menu ADD COLUMN incaricato_esterno_id TEXT REFERENCES persone_esterne (id) ON DELETE SET NULL;
ALTER TABLE voci_menu ADD COLUMN note_incarico TEXT NOT NULL DEFAULT '';
ALTER TABLE cose_da_portare ADD COLUMN incaricato_esterno_id TEXT REFERENCES persone_esterne (id) ON DELETE SET NULL;
-- Quantità strutturata delle cose da portare (4 bottiglie); la vecchia «quantita» testuale resta.
ALTER TABLE cose_da_portare ADD COLUMN quantita_numero REAL CHECK (quantita_numero IS NULL OR quantita_numero > 0);
ALTER TABLE cose_da_portare ADD COLUMN unita TEXT NOT NULL DEFAULT '';

-- Un responsabile alla volta: utente registrato oppure persona esterna.
CREATE TRIGGER voci_un_responsabile_ins BEFORE INSERT ON voci_menu
WHEN NEW.incaricato_id IS NOT NULL AND NEW.incaricato_esterno_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'incarico con due responsabili'); END;
CREATE TRIGGER voci_un_responsabile_upd BEFORE UPDATE OF incaricato_id, incaricato_esterno_id ON voci_menu
WHEN NEW.incaricato_id IS NOT NULL AND NEW.incaricato_esterno_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'incarico con due responsabili'); END;
CREATE TRIGGER cose_un_responsabile_ins BEFORE INSERT ON cose_da_portare
WHEN NEW.incaricato_id IS NOT NULL AND NEW.incaricato_esterno_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'incarico con due responsabili'); END;
CREATE TRIGGER cose_un_responsabile_upd BEFORE UPDATE OF incaricato_id, incaricato_esterno_id ON cose_da_portare
WHEN NEW.incaricato_id IS NOT NULL AND NEW.incaricato_esterno_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'incarico con due responsabili'); END;
