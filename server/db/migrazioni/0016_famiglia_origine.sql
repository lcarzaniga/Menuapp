-- Famiglia d'origine delle ricette (docs/PIANO-EVOLUZIONE.md §1, SPEC §35): la Famiglia in cui la
-- ricetta è nata, distinta da quella con cui è condivisa. Il nome è fissato alla nascita: l'identità
-- resta anche se la Famiglia viene eliminata o l'autore ne esce. Nessuna condivisione cambia.
ALTER TABLE piatti ADD COLUMN famiglia_origine_id TEXT REFERENCES gruppi (id) ON DELETE SET NULL;
ALTER TABLE piatti ADD COLUMN famiglia_origine_nome TEXT CHECK (famiglia_origine_nome IS NULL OR length(trim(famiglia_origine_nome)) > 0);

-- Ricette esistenti, senza scelte arbitrarie:
-- 1. condivisa con una Famiglia (al massimo una, indice unico della 0013) → quella;
UPDATE piatti SET famiglia_origine_id = (SELECT cg.gruppo_id FROM condivisioni_piatto_gruppo cg WHERE cg.piatto_id = piatti.id)
WHERE EXISTS (SELECT 1 FROM condivisioni_piatto_gruppo cg WHERE cg.piatto_id = piatti.id);
-- 2. altrimenti il proprietario fa parte di una sola Famiglia → quella;
UPDATE piatti SET famiglia_origine_id = (SELECT m.gruppo_id FROM membri_gruppo m WHERE m.utente_id = piatti.proprietario_id)
WHERE famiglia_origine_id IS NULL AND (SELECT count(*) FROM membri_gruppo m WHERE m.utente_id = piatti.proprietario_id) = 1;
-- 3. altrimenti resta da indicare: lo sceglie il proprietario nella scheda.
UPDATE piatti SET famiglia_origine_nome = (SELECT g.nome FROM gruppi g WHERE g.id = piatti.famiglia_origine_id)
WHERE famiglia_origine_id IS NOT NULL;

CREATE INDEX piatti_famiglia_origine ON piatti (famiglia_origine_id) WHERE famiglia_origine_id IS NOT NULL;

-- Una Famiglia indicata ha sempre il suo nome.
CREATE TRIGGER piatti_origine_con_nome_ins BEFORE INSERT ON piatti
WHEN NEW.famiglia_origine_id IS NOT NULL AND NEW.famiglia_origine_nome IS NULL
BEGIN
  SELECT RAISE(ABORT, 'famiglia d''origine senza nome');
END;
-- Una volta indicata, l'origine non cambia. Resta possibile solo perdere il collegamento quando la
-- Famiglia viene eliminata (ON DELETE SET NULL): il nome rimane.
CREATE TRIGGER piatti_origine_fissa BEFORE UPDATE OF famiglia_origine_id, famiglia_origine_nome ON piatti
WHEN (OLD.famiglia_origine_nome IS NOT NULL
      AND (NEW.famiglia_origine_nome IS NOT OLD.famiglia_origine_nome
           OR (NEW.famiglia_origine_id IS NOT NULL AND NEW.famiglia_origine_id IS NOT OLD.famiglia_origine_id)))
  OR (NEW.famiglia_origine_id IS NOT NULL AND NEW.famiglia_origine_nome IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'famiglia d''origine non modificabile');
END;
