-- Ricettario di famiglia (SPEC §19.4, decisione di Loris): ogni ricetta è visibile a tutti gli
-- utenti, salvo quelle che il proprietario rende private. Le esistenti restano visibili.
ALTER TABLE piatti ADD COLUMN visibilita TEXT NOT NULL DEFAULT 'famiglia' CHECK (visibilita IN ('famiglia', 'privata'));
