-- Spazio collaborativo della famiglia (SPEC §20): gruppi, bacheche (famiglia ed eventi) con
-- commenti, reazioni, allegati, sondaggi e proposte di piatti; chi porta cosa; notifiche;
-- valutazioni dei piatti serviti.

-- ── Gruppi familiari (appartenenza esplicita) ───────────────
CREATE TABLE gruppi (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL
) STRICT;

CREATE TABLE membri_gruppo (
  gruppo_id TEXT NOT NULL REFERENCES gruppi (id) ON DELETE CASCADE,
  utente_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE CASCADE,
  ruolo TEXT NOT NULL DEFAULT 'membro' CHECK (ruolo IN ('amministratore', 'membro')),
  creato_il INTEGER NOT NULL,
  PRIMARY KEY (gruppo_id, utente_id)
) STRICT;
CREATE INDEX membri_gruppo_utente ON membri_gruppo (utente_id);

-- Tutti gli utenti attuali sono stati invitati da Loris come familiari.
INSERT INTO gruppi (id, nome, creato_il, aggiornato_il)
VALUES ('gruppo-famiglia', 'Famiglia', CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER));
INSERT INTO membri_gruppo (gruppo_id, utente_id, ruolo, creato_il)
SELECT 'gruppo-famiglia', id, CASE ruolo WHEN 'amministratore' THEN 'amministratore' ELSE 'membro' END, CAST(unixepoch('subsec') * 1000 AS INTEGER) FROM utenti;

-- Partecipazione alla bacheca dell'evento, distinta dal permesso sul menù.
ALTER TABLE condivisioni_evento ADD COLUMN partecipa INTEGER NOT NULL DEFAULT 1 CHECK (partecipa IN (0, 1));

-- ── Bacheche ─────────────────────────────────────────────────
-- Un messaggio sta nella bacheca di un gruppo oppure in quella di un evento.
CREATE TABLE messaggi (
  id TEXT PRIMARY KEY,
  gruppo_id TEXT REFERENCES gruppi (id) ON DELETE CASCADE,
  evento_id TEXT REFERENCES eventi (id) ON DELETE CASCADE,
  autore_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL DEFAULT 'messaggio' CHECK (tipo IN ('messaggio', 'sondaggio', 'proposta')),
  testo TEXT NOT NULL DEFAULT '',
  -- Ricetta segnalata (si mostra solo a chi può leggerla).
  piatto_id TEXT REFERENCES piatti (id) ON DELETE SET NULL,
  fissato INTEGER NOT NULL DEFAULT 0 CHECK (fissato IN (0, 1)),
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  modificato_il INTEGER,
  aggiornato_il INTEGER NOT NULL,
  CHECK ((gruppo_id IS NULL) <> (evento_id IS NULL)),
  CHECK (tipo <> 'proposta' OR evento_id IS NOT NULL)
) STRICT;
CREATE INDEX messaggi_gruppo ON messaggi (gruppo_id, creato_il) WHERE gruppo_id IS NOT NULL;
CREATE INDEX messaggi_evento ON messaggi (evento_id, creato_il) WHERE evento_id IS NOT NULL;

CREATE TABLE commenti (
  id TEXT PRIMARY KEY,
  messaggio_id TEXT NOT NULL REFERENCES messaggi (id) ON DELETE CASCADE,
  autore_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE RESTRICT,
  testo TEXT NOT NULL CHECK (length(trim(testo)) > 0),
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  modificato_il INTEGER,
  aggiornato_il INTEGER NOT NULL
) STRICT;
CREATE INDEX commenti_messaggio ON commenti (messaggio_id, creato_il);

CREATE TABLE reazioni (
  messaggio_id TEXT NOT NULL REFERENCES messaggi (id) ON DELETE CASCADE,
  utente_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE CASCADE,
  reazione TEXT NOT NULL CHECK (reazione IN ('mi_piace', 'cuore', 'risata', 'gnam', 'applauso')),
  creato_il INTEGER NOT NULL,
  PRIMARY KEY (messaggio_id, utente_id, reazione)
) STRICT;

-- Fotografie dei messaggi: file in dati/foto/ (stessa cartella e stesso backup delle foto dei piatti).
CREATE TABLE allegati (
  id TEXT PRIMARY KEY,
  messaggio_id TEXT NOT NULL REFERENCES messaggi (id) ON DELETE CASCADE,
  ordine INTEGER NOT NULL CHECK (ordine >= 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('image/jpeg', 'image/png', 'image/webp')),
  byte INTEGER NOT NULL CHECK (byte > 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  creato_il INTEGER NOT NULL
) STRICT;
CREATE INDEX allegati_messaggio ON allegati (messaggio_id, ordine);

-- ── Sondaggi ────────────────────────────────────────────────
CREATE TABLE sondaggi (
  messaggio_id TEXT PRIMARY KEY REFERENCES messaggi (id) ON DELETE CASCADE,
  multipla INTEGER NOT NULL DEFAULT 0 CHECK (multipla IN (0, 1)),
  risultati TEXT NOT NULL DEFAULT 'dopo_voto' CHECK (risultati IN ('sempre', 'dopo_voto', 'alla_chiusura')),
  scade_il INTEGER,
  chiuso_il INTEGER,
  chiuso_da TEXT REFERENCES utenti (id) ON DELETE SET NULL
) STRICT;

CREATE TABLE opzioni_sondaggio (
  id TEXT PRIMARY KEY,
  messaggio_id TEXT NOT NULL REFERENCES sondaggi (messaggio_id) ON DELETE CASCADE,
  ordine INTEGER NOT NULL CHECK (ordine >= 0),
  testo TEXT NOT NULL CHECK (length(trim(testo)) > 0),
  UNIQUE (messaggio_id, ordine),
  UNIQUE (id, messaggio_id)
) STRICT;

-- Un insieme di preferenze per utente e sondaggio (le righe sono le opzioni scelte).
CREATE TABLE voti_sondaggio (
  messaggio_id TEXT NOT NULL REFERENCES sondaggi (messaggio_id) ON DELETE CASCADE,
  utente_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE CASCADE,
  opzione_id TEXT NOT NULL,
  creato_il INTEGER NOT NULL,
  PRIMARY KEY (messaggio_id, utente_id, opzione_id),
  FOREIGN KEY (opzione_id, messaggio_id) REFERENCES opzioni_sondaggio (id, messaggio_id) ON DELETE CASCADE
) STRICT;
CREATE INDEX voti_sondaggio_utente ON voti_sondaggio (utente_id);

-- ── Proposte di piatti (messaggi di una bacheca di evento) ───
CREATE TABLE proposte (
  messaggio_id TEXT PRIMARY KEY REFERENCES messaggi (id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  -- Ricetta proposta (del proponente o leggibile da lui): nel menù entra come copia.
  piatto_id TEXT REFERENCES piatti (id) ON DELETE SET NULL,
  portata_nome TEXT NOT NULL DEFAULT '',
  stato TEXT NOT NULL DEFAULT 'in_valutazione' CHECK (stato IN ('in_valutazione', 'accettata', 'rifiutata')),
  voce_id TEXT REFERENCES voci_menu (id) ON DELETE SET NULL,
  deciso_da TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  deciso_il INTEGER
) STRICT;

-- ── Chi porta cosa ──────────────────────────────────────────
-- Le voci del menù restano il luogo della responsabilità («A cura di»): si aggiunge chi
-- (utente), se è fatto e se la presa in carico ha tolto la voce dalla spesa.
ALTER TABLE voci_menu ADD COLUMN incaricato_id TEXT REFERENCES utenti (id) ON DELETE SET NULL;
ALTER TABLE voci_menu ADD COLUMN incarico_completato INTEGER NOT NULL DEFAULT 0 CHECK (incarico_completato IN (0, 1));
ALTER TABLE voci_menu ADD COLUMN spesa_tolta_da_incarico INTEGER NOT NULL DEFAULT 0 CHECK (spesa_tolta_da_incarico IN (0, 1));

-- Cose da portare che non sono piatti del menù (vino, pane, ghiaccio…).
CREATE TABLE cose_da_portare (
  id TEXT PRIMARY KEY,
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  quantita TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  incaricato TEXT NOT NULL DEFAULT '',
  incaricato_id TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  completato INTEGER NOT NULL DEFAULT 0 CHECK (completato IN (0, 1)),
  creato_da TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  ordine INTEGER NOT NULL DEFAULT 0,
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL
) STRICT;
CREATE INDEX cose_da_portare_evento ON cose_da_portare (evento_id, ordine);

-- ── Valutazioni dei piatti serviti ──────────────────────────
-- Riferite alla voce dell'evento; nome e origine della ricetta fotografati al voto, così
-- restano anche se voce o ricetta cambiano o spariscono.
CREATE TABLE valutazioni (
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  voce_id TEXT NOT NULL,
  utente_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE CASCADE,
  stelle INTEGER NOT NULL CHECK (stelle BETWEEN 1 AND 5),
  nome_piatto TEXT NOT NULL,
  portata TEXT NOT NULL DEFAULT '',
  -- Identità della ricetta: l'originale da cui discendono le copie (null = piatto senza ricetta).
  ricetta_origine_id TEXT,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL,
  PRIMARY KEY (voce_id, utente_id)
) STRICT;
CREATE INDEX valutazioni_evento ON valutazioni (evento_id);
CREATE INDEX valutazioni_origine ON valutazioni (ricetta_origine_id);

-- ── Notifiche ───────────────────────────────────────────────
-- Gli aggiornamenti ripetitivi si raggruppano: una sola notifica non letta per chiave.
CREATE TABLE notifiche (
  id TEXT PRIMARY KEY,
  utente_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  chiave TEXT NOT NULL,
  gruppo_id TEXT REFERENCES gruppi (id) ON DELETE CASCADE,
  evento_id TEXT REFERENCES eventi (id) ON DELETE CASCADE,
  messaggio_id TEXT REFERENCES messaggi (id) ON DELETE CASCADE,
  piatto_id TEXT REFERENCES piatti (id) ON DELETE CASCADE,
  attore_id TEXT REFERENCES utenti (id) ON DELETE SET NULL,
  testo TEXT NOT NULL DEFAULT '',
  conteggio INTEGER NOT NULL DEFAULT 1 CHECK (conteggio >= 1),
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL,
  letta_il INTEGER
) STRICT;
CREATE UNIQUE INDEX notifiche_da_leggere ON notifiche (utente_id, chiave) WHERE letta_il IS NULL;
CREATE INDEX notifiche_utente ON notifiche (utente_id, aggiornato_il);

CREATE TABLE preferenze_notifiche (
  utente_id TEXT NOT NULL REFERENCES utenti (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  attiva INTEGER NOT NULL CHECK (attiva IN (0, 1)),
  PRIMARY KEY (utente_id, tipo)
) STRICT;
