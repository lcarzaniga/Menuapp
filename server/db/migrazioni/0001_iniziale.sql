-- Menù & Co. — schema iniziale (SPEC §6.3).
-- Tutte le tabelle esistono fin dalla versione 1, anche se usate da milestone successive.
-- Elenco delle unità fissato da src/domain/unita.ts (CODICI_UNITA) al 12/11/2026.

CREATE TABLE meta (
  chiave TEXT PRIMARY KEY,
  valore TEXT NOT NULL CHECK (json_valid(valore))
) STRICT;

CREATE TABLE impostazioni (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  coefficiente_bambini REAL NOT NULL DEFAULT 0.5
    CHECK (coefficiente_bambini BETWEEN 0 AND 1),
  versione INTEGER NOT NULL DEFAULT 1,
  aggiornato_il INTEGER NOT NULL
) STRICT;

CREATE TABLE portate_predefinite (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  ordine INTEGER NOT NULL CHECK (ordine >= 0)
) STRICT;

CREATE TABLE reparti (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  nome_norm TEXT NOT NULL UNIQUE,
  ordine INTEGER NOT NULL CHECK (ordine >= 0),
  di_sistema INTEGER NOT NULL DEFAULT 0 CHECK (di_sistema IN (0, 1)),
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL
) STRICT;

CREATE TABLE eventi (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  data TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  ora_servizio TEXT CHECK (ora_servizio IS NULL OR ora_servizio GLOB '[0-2][0-9]:[0-5][0-9]'),
  tipo TEXT NOT NULL CHECK (tipo IN ('pranzo', 'cena', 'aperitivo', 'brunch')),
  occasione TEXT NOT NULL DEFAULT '',
  adulti INTEGER NOT NULL CHECK (adulti >= 0),
  bambini INTEGER NOT NULL CHECK (bambini >= 0),
  coefficiente_bambini REAL NOT NULL CHECK (coefficiente_bambini BETWEEN 0 AND 1),
  note TEXT NOT NULL DEFAULT '',
  stato TEXT NOT NULL DEFAULT 'attivo' CHECK (stato IN ('attivo', 'concluso', 'archiviato')),
  concluso_il INTEGER,
  archiviato_il INTEGER,
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL,
  CHECK ((stato = 'archiviato') = (archiviato_il IS NOT NULL))
) STRICT;
CREATE INDEX eventi_data ON eventi (data);

CREATE TABLE portate_evento (
  id TEXT PRIMARY KEY,
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  ordine INTEGER NOT NULL CHECK (ordine >= 0),
  UNIQUE (id, evento_id)
) STRICT;
CREATE INDEX portate_evento_evento ON portate_evento (evento_id);

CREATE TABLE piatti (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  nome_norm TEXT NOT NULL,
  portata_suggerita TEXT,
  porzioni_base REAL CHECK (porzioni_base IS NULL OR porzioni_base > 0),
  tempo_preparazione_min INTEGER CHECK (tempo_preparazione_min IS NULL OR tempo_preparazione_min >= 0),
  tempo_cottura_min INTEGER CHECK (tempo_cottura_min IS NULL OR tempo_cottura_min >= 0),
  tempo_riposo_min INTEGER CHECK (tempo_riposo_min IS NULL OR tempo_riposo_min >= 0),
  attrezzature TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(attrezzature) AND json_type(attrezzature) = 'array'),
  procedimento TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(procedimento) AND json_type(procedimento) = 'array'),
  note TEXT NOT NULL DEFAULT '',
  fonte TEXT NOT NULL DEFAULT '',
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL
) STRICT;
CREATE INDEX piatti_nome ON piatti (nome_norm);

CREATE TABLE voci_menu (
  id TEXT PRIMARY KEY,
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  portata_id TEXT NOT NULL,
  ordine INTEGER NOT NULL CHECK (ordine >= 0),
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  piatto_id TEXT REFERENCES piatti (id) ON DELETE SET NULL,
  porzioni REAL CHECK (porzioni IS NULL OR porzioni > 0),
  incaricato TEXT NOT NULL DEFAULT '',
  in_spesa INTEGER NOT NULL DEFAULT 1 CHECK (in_spesa IN (0, 1)),
  note TEXT NOT NULL DEFAULT '',
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL,
  FOREIGN KEY (portata_id, evento_id) REFERENCES portate_evento (id, evento_id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX voci_menu_evento ON voci_menu (evento_id, portata_id, ordine);
CREATE INDEX voci_menu_piatto ON voci_menu (piatto_id);

CREATE TABLE ingredienti (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  nome_norm TEXT NOT NULL UNIQUE,
  reparto_id TEXT NOT NULL REFERENCES reparti (id) ON DELETE RESTRICT,
  unita_preferita TEXT CHECK (unita_preferita IS NULL OR unita_preferita IN (
    'g', 'hg', 'kg', 'ml', 'cl', 'dl', 'l', 'pz', 'spicchio', 'foglia', 'rametto', 'mazzetto',
    'fetta', 'cucchiaio', 'cucchiaino', 'tazza', 'bicchiere', 'pizzico', 'manciata', 'noce',
    'bustina', 'confezione', 'scatola', 'vasetto', 'qb')),
  scalatura_abituale TEXT NOT NULL DEFAULT 'proporzionale'
    CHECK (scalatura_abituale IN ('proporzionale', 'fissa')),
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL
) STRICT;
CREATE INDEX ingredienti_reparto ON ingredienti (reparto_id);

CREATE TABLE sinonimi_ingrediente (
  ingrediente_id TEXT NOT NULL REFERENCES ingredienti (id) ON DELETE CASCADE,
  sinonimo TEXT NOT NULL CHECK (length(trim(sinonimo)) > 0),
  sinonimo_norm TEXT NOT NULL UNIQUE,
  PRIMARY KEY (ingrediente_id, sinonimo_norm)
) STRICT;

CREATE TABLE ingredienti_piatto (
  id TEXT PRIMARY KEY,
  piatto_id TEXT NOT NULL REFERENCES piatti (id) ON DELETE CASCADE,
  ordine INTEGER NOT NULL CHECK (ordine >= 0),
  testo_originale TEXT NOT NULL,
  nome TEXT NOT NULL,
  ingrediente_id TEXT REFERENCES ingredienti (id) ON DELETE SET NULL,
  quantita REAL CHECK (quantita IS NULL OR quantita >= 0),
  quantita_max REAL CHECK (quantita_max IS NULL OR (quantita IS NOT NULL AND quantita_max >= quantita)),
  unita TEXT CHECK (unita IS NULL OR unita IN (
    'g', 'hg', 'kg', 'ml', 'cl', 'dl', 'l', 'pz', 'spicchio', 'foglia', 'rametto', 'mazzetto',
    'fetta', 'cucchiaio', 'cucchiaino', 'tazza', 'bicchiere', 'pizzico', 'manciata', 'noce',
    'bustina', 'confezione', 'scatola', 'vasetto', 'qb')),
  scalatura TEXT NOT NULL CHECK (scalatura IN ('proporzionale', 'fissa')),
  facoltativo INTEGER NOT NULL DEFAULT 0 CHECK (facoltativo IN (0, 1)),
  nota TEXT NOT NULL DEFAULT '',
  stato_parsing TEXT NOT NULL CHECK (stato_parsing IN ('certo', 'da_verificare', 'confermato')),
  problemi_parsing TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(problemi_parsing) AND json_type(problemi_parsing) = 'array'),
  CHECK (unita IS NOT 'qb' OR quantita IS NULL)
) STRICT;
CREATE INDEX ingredienti_piatto_piatto ON ingredienti_piatto (piatto_id, ordine);
CREATE INDEX ingredienti_piatto_ingrediente ON ingredienti_piatto (ingrediente_id);

CREATE TABLE articoli_spesa (
  id TEXT PRIMARY KEY,
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('calcolato', 'manuale')),
  chiave TEXT,
  stato TEXT NOT NULL DEFAULT 'da_comprare' CHECK (stato IN ('da_comprare', 'ce_lho', 'comprato')),
  fabbisogno_coperto REAL,
  quantita_utente REAL CHECK (quantita_utente IS NULL OR quantita_utente >= 0),
  quantita_calcolata_alla_correzione REAL,
  reparto_id TEXT REFERENCES reparti (id) ON DELETE SET NULL,
  nascosto INTEGER NOT NULL DEFAULT 0 CHECK (nascosto IN (0, 1)),
  inclusa INTEGER NOT NULL DEFAULT 0 CHECK (inclusa IN (0, 1)),
  nota TEXT NOT NULL DEFAULT '',
  nome TEXT NOT NULL DEFAULT '',
  quantita_testo TEXT NOT NULL DEFAULT '',
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL,
  CHECK ((tipo = 'calcolato' AND chiave IS NOT NULL)
      OR (tipo = 'manuale' AND chiave IS NULL AND length(trim(nome)) > 0)),
  CHECK (stato <> 'da_comprare' OR fabbisogno_coperto IS NULL)
) STRICT;
CREATE UNIQUE INDEX articoli_spesa_chiave ON articoli_spesa (evento_id, chiave) WHERE chiave IS NOT NULL;
CREATE INDEX articoli_spesa_evento ON articoli_spesa (evento_id);

CREATE TABLE attivita (
  id TEXT PRIMARY KEY,
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  titolo TEXT NOT NULL CHECK (length(trim(titolo)) > 0),
  data TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  ora TEXT CHECK (ora IS NULL OR ora GLOB '[0-2][0-9]:[0-5][0-9]'),
  stato TEXT NOT NULL DEFAULT 'da_fare' CHECK (stato IN ('da_fare', 'fatto')),
  voce_menu_id TEXT REFERENCES voci_menu (id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  ordine INTEGER NOT NULL DEFAULT 0,
  versione INTEGER NOT NULL DEFAULT 1,
  creato_il INTEGER NOT NULL,
  aggiornato_il INTEGER NOT NULL
) STRICT;
CREATE INDEX attivita_evento ON attivita (evento_id, data);
CREATE INDEX attivita_voce ON attivita (voce_menu_id);

CREATE TABLE snapshot_eventi (
  id TEXT PRIMARY KEY,
  evento_id TEXT NOT NULL REFERENCES eventi (id) ON DELETE CASCADE,
  stato TEXT NOT NULL CHECK (stato IN ('valido', 'superato')),
  versione_formato INTEGER NOT NULL,
  contenuto TEXT NOT NULL CHECK (json_valid(contenuto)),
  creato_il INTEGER NOT NULL,
  superato_il INTEGER,
  CHECK ((stato = 'superato') = (superato_il IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX snapshot_valido ON snapshot_eventi (evento_id) WHERE stato = 'valido';
CREATE INDEX snapshot_evento ON snapshot_eventi (evento_id);
