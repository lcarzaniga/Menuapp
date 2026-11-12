-- Stile del menù stampato, uno per evento (SPEC F8). Le opzioni sono JSON validato dal
-- contratto (src/contratto/stampa.ts): non toccano menù né ricette.
CREATE TABLE stili_stampa (
  evento_id TEXT PRIMARY KEY REFERENCES eventi (id) ON DELETE CASCADE,
  opzioni TEXT NOT NULL CHECK (json_valid(opzioni)),
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL
) STRICT;
