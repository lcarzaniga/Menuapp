-- Voce da cui è stata copiata una voce duplicando l'evento (SPEC §27): un'identità persistente
-- per confrontare le edizioni anche quando il piatto non ha una ricetta. Nessun vincolo: la
-- voce d'origine può essere eliminata, l'informazione storica resta.
ALTER TABLE voci_menu ADD COLUMN voce_origine_id TEXT;
