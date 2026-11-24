-- Varianti delle ricette nelle voci del menù (SPEC §44): una voce collegata a una ricetta può avere
-- ingredienti propri per quell'evento. La colonna contiene la copia completa (ingredienti, porzioni di
-- riferimento, descrizione, nota, ricetta d'origine): niente differenze da ricalcolare, niente tabella
-- di varianti condivise. Vuota = come la ricetta, cioè tutte le voci esistenti.
ALTER TABLE voci_menu ADD COLUMN variante TEXT
  CHECK (variante IS NULL OR (json_valid(variante) AND json_type(variante) = 'object'));
