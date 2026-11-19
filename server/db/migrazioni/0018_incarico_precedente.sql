-- Riuso degli eventi (docs/PIANO-EVOLUZIONE.md fase 2, SPEC §25, D7): duplicando un evento con
-- «Chi porta cosa», piatti e cose da portare nascono da assegnare e ricordano chi se ne occupava
-- nell'originale, per riaffidarli con un tocco. Solo un promemoria: nessun incarico è accettato.
-- JSON { nome, utenteId | null, esternoId | null }; gli id solo se validi nella nuova Famiglia.
ALTER TABLE voci_menu ADD COLUMN incarico_precedente TEXT CHECK (incarico_precedente IS NULL OR json_valid(incarico_precedente));
ALTER TABLE cose_da_portare ADD COLUMN incarico_precedente TEXT CHECK (incarico_precedente IS NULL OR json_valid(incarico_precedente));
