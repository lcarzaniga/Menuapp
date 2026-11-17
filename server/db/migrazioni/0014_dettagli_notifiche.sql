-- Notifiche raggruppate apribili (SPEC §29.1): gli aggiornamenti riuniti sotto la stessa chiave
-- restano elencati (al massimo gli ultimi 10: chi, cosa, quando, a cosa si riferiscono), così
-- «3 aggiornamenti» si può aprire e ognuno porta al suo contenuto. Le notifiche esistenti
-- restano senza elenco e si mostrano come prima.
ALTER TABLE notifiche ADD COLUMN dettagli TEXT CHECK (dettagli IS NULL OR json_valid(dettagli));
