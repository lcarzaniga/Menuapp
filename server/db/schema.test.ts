// Ogni vincolo di SPEC §6.3–6.4 violato o esercitato almeno una volta su SQLite reale.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { dbDiProva, type DbDiProva } from '../prova.ts'
import { esegui, uno } from './connessione.ts'

let p: DbDiProva
beforeAll(async () => {
  p = await dbDiProva()
})
afterAll(() => p.chiudi())

const T = 1_700_000_000_000
const run = (sql: string, ...par: (string | number | null)[]) => esegui(p.db, sql, ...par)
const conta = (tabella: string, where = '1') =>
  uno<{ n: number }>(p.db, `SELECT count(*) AS n FROM ${tabella} WHERE ${where}`)?.n

function evento(id = 'e1', extra: Partial<Record<string, string | number | null>> = {}) {
  const v = { data: '2026-12-25', ora_servizio: '13:00', tipo: 'pranzo', adulti: 8, bambini: 2, coefficiente_bambini: 0.5, stato: 'attivo', archiviato_il: null, ...extra }
  run(
    `INSERT INTO eventi (proprietario_id, id, nome, data, ora_servizio, tipo, adulti, bambini, coefficiente_bambini, stato, archiviato_il, creato_il, aggiornato_il)
     VALUES ('utente-amministratore', ?, 'Natale', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, v.data, v.ora_servizio, v.tipo, v.adulti, v.bambini, v.coefficiente_bambini, v.stato, v.archiviato_il, T, T,
  )
}
const portata = (id: string, ev = 'e1') =>
  run('INSERT INTO portate_evento (id, evento_id, nome, ordine) VALUES (?, ?, ?, 0)', id, ev, 'Primi')
const piatto = (id: string, extra = '') =>
  run(`INSERT INTO piatti (proprietario_id, id, nome, nome_norm, creato_il, aggiornato_il${extra ? ', porzioni_base' : ''}) VALUES ('utente-amministratore', ?, 'Lasagne', 'lasagne', ?, ?${extra ? ', ' + extra : ''})`, id, T, T)
const voce = (id: string, ev = 'e1', port = 'p1', piattoId: string | null = null) =>
  run(
    'INSERT INTO voci_menu (id, evento_id, portata_id, ordine, nome, piatto_id, creato_il, aggiornato_il) VALUES (?, ?, ?, 0, ?, ?, ?, ?)',
    id, ev, port, 'Lasagne', piattoId, T, T,
  )
const ingrediente = (id: string, reparto = 'rep-altro', nome = id) =>
  run('INSERT INTO ingredienti (id, nome, nome_norm, reparto_id, creato_il, aggiornato_il) VALUES (?, ?, ?, ?, ?, ?)', id, nome, nome, reparto, T, T)

beforeEach(() => {
  for (const t of ['snapshot_eventi', 'attivita', 'articoli_spesa', 'voci_menu', 'portate_evento', 'eventi', 'ingredienti_piatto', 'piatti', 'sinonimi_ingrediente', 'ingredienti']) {
    run(`DELETE FROM ${t}`)
  }
  run("DELETE FROM reparti WHERE id LIKE 'rep-prova%'")
})

describe('vincoli CHECK', () => {
  const casi: [string, () => unknown][] = [
    ['coefficiente impostazioni > 1', () => run('UPDATE impostazioni SET coefficiente_bambini = 1.5')],
    ['nome portata predefinita vuoto', () => run("INSERT INTO portate_predefinite VALUES ('x', '  ', 0)")],
    ['ordine portata predefinita negativo', () => run("INSERT INTO portate_predefinite VALUES ('x', 'A', -1)")],
    ['data evento malformata', () => evento('e1', { data: '25/12/2026' })],
    ['ora evento malformata', () => evento('e1', { ora_servizio: '1pm' })],
    ['tipo evento sconosciuto', () => evento('e1', { tipo: 'merenda' })],
    ['adulti negativi', () => evento('e1', { adulti: -1 })],
    ['bambini negativi', () => evento('e1', { bambini: -2 })],
    ['coefficiente evento negativo', () => evento('e1', { coefficiente_bambini: -0.1 })],
    ['stato evento sconosciuto', () => evento('e1', { stato: 'chiuso' })],
    ['archiviato senza data di archiviazione', () => evento('e1', { stato: 'archiviato' })],
    ['data di archiviazione su evento attivo', () => evento('e1', { archiviato_il: T })],
    ['tipo STRICT: testo in colonna intera', () => evento('e1', { adulti: 'otto' })],
    ['porzioni base zero', () => piatto('d1', '0')],
    ['tempo di cottura negativo', () => run("INSERT INTO piatti (proprietario_id, id, nome, nome_norm, tempo_cottura_min, creato_il, aggiornato_il) VALUES ('utente-amministratore', 'd1','A','a',-5,1,1)")],
    ['procedimento non JSON', () => run("INSERT INTO piatti (proprietario_id, id, nome, nome_norm, procedimento, creato_il, aggiornato_il) VALUES ('utente-amministratore', 'd1','A','a','passo 1',1,1)")],
    ['attrezzature JSON non array', () => run("INSERT INTO piatti (proprietario_id, id, nome, nome_norm, attrezzature, creato_il, aggiornato_il) VALUES ('utente-amministratore', 'd1','A','a','{}',1,1)")],
    ['nome voce vuoto', () => { evento(); portata('p1'); run("INSERT INTO voci_menu (id, evento_id, portata_id, ordine, nome, creato_il, aggiornato_il) VALUES ('v1','e1','p1',0,'',1,1)") }],
    ['porzioni voce negative', () => { evento(); portata('p1'); run("INSERT INTO voci_menu (id, evento_id, portata_id, ordine, nome, porzioni, creato_il, aggiornato_il) VALUES ('v1','e1','p1',0,'A',-2,1,1)") }],
    ['in_spesa non booleano', () => { evento(); portata('p1'); run("INSERT INTO voci_menu (id, evento_id, portata_id, ordine, nome, in_spesa, creato_il, aggiornato_il) VALUES ('v1','e1','p1',0,'A',2,1,1)") }],
    ['unità preferita sconosciuta', () => run("INSERT INTO ingredienti (id, nome, nome_norm, reparto_id, unita_preferita, creato_il, aggiornato_il) VALUES ('i1','A','a','rep-altro','tonnellata',1,1)")],
    ['scalatura abituale sconosciuta', () => run("INSERT INTO ingredienti (id, nome, nome_norm, reparto_id, scalatura_abituale, creato_il, aggiornato_il) VALUES ('i1','A','a','rep-altro','doppia',1,1)")],
    ['quantità ingrediente negativa', () => { piatto('d1'); run("INSERT INTO ingredienti_piatto (id, piatto_id, ordine, testo_originale, nome, quantita, scalatura, stato_parsing) VALUES ('x','d1',0,'t','n',-1,'proporzionale','certo')") }],
    ['quantità massima minore della minima', () => { piatto('d1'); run("INSERT INTO ingredienti_piatto (id, piatto_id, ordine, testo_originale, nome, quantita, quantita_max, scalatura, stato_parsing) VALUES ('x','d1',0,'t','n',3,2,'proporzionale','certo')") }],
    ['quantità massima senza minima', () => { piatto('d1'); run("INSERT INTO ingredienti_piatto (id, piatto_id, ordine, testo_originale, nome, quantita_max, scalatura, stato_parsing) VALUES ('x','d1',0,'t','n',3,'proporzionale','certo')") }],
    ['unità ingrediente sconosciuta', () => { piatto('d1'); run("INSERT INTO ingredienti_piatto (id, piatto_id, ordine, testo_originale, nome, unita, scalatura, stato_parsing) VALUES ('x','d1',0,'t','n','oncia','proporzionale','certo')") }],
    ['q.b. con quantità', () => { piatto('d1'); run("INSERT INTO ingredienti_piatto (id, piatto_id, ordine, testo_originale, nome, quantita, unita, scalatura, stato_parsing) VALUES ('x','d1',0,'t','n',1,'qb','fissa','certo')") }],
    ['stato di parsing sconosciuto', () => { piatto('d1'); run("INSERT INTO ingredienti_piatto (id, piatto_id, ordine, testo_originale, nome, scalatura, stato_parsing) VALUES ('x','d1',0,'t','n','proporzionale','forse')") }],
    ['articolo calcolato senza chiave', () => { evento(); run("INSERT INTO articoli_spesa (id, evento_id, tipo, creato_il, aggiornato_il) VALUES ('a1','e1','calcolato',1,1)") }],
    ['articolo manuale senza nome', () => { evento(); run("INSERT INTO articoli_spesa (id, evento_id, tipo, creato_il, aggiornato_il) VALUES ('a1','e1','manuale',1,1)") }],
    ['articolo manuale con chiave', () => { evento(); run("INSERT INTO articoli_spesa (id, evento_id, tipo, chiave, nome, creato_il, aggiornato_il) VALUES ('a1','e1','manuale','k','Ghiaccio',1,1)") }],
    ['stato spesa sconosciuto', () => { evento(); run("INSERT INTO articoli_spesa (id, evento_id, tipo, chiave, stato, creato_il, aggiornato_il) VALUES ('a1','e1','calcolato','k','preso',1,1)") }],
    ['da comprare con fabbisogno coperto', () => { evento(); run("INSERT INTO articoli_spesa (id, evento_id, tipo, chiave, fabbisogno_coperto, creato_il, aggiornato_il) VALUES ('a1','e1','calcolato','k',500,1,1)") }],
    ['quantità utente negativa', () => { evento(); run("INSERT INTO articoli_spesa (id, evento_id, tipo, chiave, quantita_utente, creato_il, aggiornato_il) VALUES ('a1','e1','calcolato','k',-1,1,1)") }],
    ['titolo attività vuoto', () => { evento(); run("INSERT INTO attivita (id, evento_id, titolo, data, creato_il, aggiornato_il) VALUES ('t1','e1',' ','2026-12-24',1,1)") }],
    ['data attività malformata', () => { evento(); run("INSERT INTO attivita (id, evento_id, titolo, data, creato_il, aggiornato_il) VALUES ('t1','e1','A','24-12-2026',1,1)") }],
    ['stato attività sconosciuto', () => { evento(); run("INSERT INTO attivita (id, evento_id, titolo, data, stato, creato_il, aggiornato_il) VALUES ('t1','e1','A','2026-12-24','forse',1,1)") }],
    ['stato snapshot sconosciuto', () => { evento(); run("INSERT INTO snapshot_eventi (id, evento_id, stato, versione_formato, contenuto, creato_il) VALUES ('s1','e1','vecchio',1,'{}',1)") }],
    ['snapshot superato senza data', () => { evento(); run("INSERT INTO snapshot_eventi (id, evento_id, stato, versione_formato, contenuto, creato_il) VALUES ('s1','e1','superato',1,'{}',1)") }],
    ['contenuto snapshot non JSON', () => { evento(); run("INSERT INTO snapshot_eventi (id, evento_id, stato, versione_formato, contenuto, creato_il) VALUES ('s1','e1','valido',1,'x',1)") }],
    ['valore meta non JSON', () => run("INSERT INTO meta VALUES ('x', 'non json')")],
    ['impostazioni con id diverso da 1', () => run('INSERT INTO impostazioni (id, aggiornato_il) VALUES (2, 1)')],
    ['di_sistema non booleano', () => run("INSERT INTO reparti (id, nome, nome_norm, ordine, di_sistema, creato_il, aggiornato_il) VALUES ('rep-prova','P','p',99,3,1,1)")],
  ]
  for (const [nome, azione] of casi) {
    it(nome, () => {
      expect(azione).toThrow(/constraint failed|cannot store/i)
    })
  }
})

describe('chiavi esterne e unicità', () => {
  it('voce in una portata di un altro evento', () => {
    evento('e1')
    evento('e2')
    portata('p2', 'e2')
    expect(() => voce('v1', 'e1', 'p2')).toThrow(/FOREIGN KEY/)
  })
  it('voce con piatto inesistente', () => {
    evento()
    portata('p1')
    expect(() => voce('v1', 'e1', 'p1', 'nessuno')).toThrow(/FOREIGN KEY/)
  })
  it('ingrediente con reparto inesistente', () => {
    expect(() => ingrediente('i1', 'rep-nessuno')).toThrow(/FOREIGN KEY/)
  })
  it('nome di reparto duplicato', () => {
    expect(() => run("INSERT INTO reparti (id, nome, nome_norm, ordine, creato_il, aggiornato_il) VALUES ('rep-prova','Dispensa','dispensa',99,1,1)")).toThrow(/UNIQUE/)
  })
  it('nome canonico di ingrediente duplicato', () => {
    ingrediente('i1', 'rep-altro', 'burro')
    expect(() => ingrediente('i2', 'rep-altro', 'burro')).toThrow(/UNIQUE/)
  })
  it('sinonimo usato da due ingredienti', () => {
    ingrediente('i1', 'rep-altro', 'parmigiano reggiano')
    ingrediente('i2', 'rep-altro', 'grana padano')
    run("INSERT INTO sinonimi_ingrediente VALUES ('i1', 'Parmigiano', 'parmigiano')")
    expect(() => run("INSERT INTO sinonimi_ingrediente VALUES ('i2', 'parmigiano', 'parmigiano')")).toThrow(/UNIQUE/)
  })
  it('due righe calcolate con la stessa chiave nello stesso evento', () => {
    evento()
    run("INSERT INTO articoli_spesa (id, evento_id, tipo, chiave, creato_il, aggiornato_il) VALUES ('a1','e1','calcolato','k',1,1)")
    expect(() => run("INSERT INTO articoli_spesa (id, evento_id, tipo, chiave, creato_il, aggiornato_il) VALUES ('a2','e1','calcolato','k',1,1)")).toThrow(/UNIQUE/)
  })
  it('più articoli manuali (chiave nulla) nello stesso evento sono ammessi', () => {
    evento()
    run("INSERT INTO articoli_spesa (id, evento_id, tipo, nome, creato_il, aggiornato_il) VALUES ('a1','e1','manuale','Ghiaccio',1,1)")
    run("INSERT INTO articoli_spesa (id, evento_id, tipo, nome, creato_il, aggiornato_il) VALUES ('a2','e1','manuale','Tovaglioli',1,1)")
    expect(conta('articoli_spesa')).toBe(2)
  })
  it('due snapshot validi per lo stesso evento', () => {
    evento()
    run("INSERT INTO snapshot_eventi (id, evento_id, stato, versione_formato, contenuto, creato_il) VALUES ('s1','e1','valido',1,'{}',1)")
    expect(() => run("INSERT INTO snapshot_eventi (id, evento_id, stato, versione_formato, contenuto, creato_il) VALUES ('s2','e1','valido',1,'{}',1)")).toThrow(/UNIQUE/)
    run("INSERT INTO snapshot_eventi (id, evento_id, stato, versione_formato, contenuto, creato_il, superato_il) VALUES ('s3','e1','superato',1,'{}',1,2)")
    expect(conta('snapshot_eventi')).toBe(2)
  })
  it('attività con voce inesistente', () => {
    evento()
    expect(() => run("INSERT INTO attivita (id, evento_id, titolo, data, voce_menu_id, creato_il, aggiornato_il) VALUES ('t1','e1','A','2026-12-24','nessuna',1,1)")).toThrow(/FOREIGN KEY/)
  })
})

describe('azioni ON DELETE', () => {
  it('eliminare un evento elimina portate, voci, spesa, attività e snapshot', () => {
    evento()
    portata('p1')
    voce('v1')
    run("INSERT INTO articoli_spesa (id, evento_id, tipo, nome, creato_il, aggiornato_il) VALUES ('a1','e1','manuale','Ghiaccio',1,1)")
    run("INSERT INTO attivita (id, evento_id, titolo, data, voce_menu_id, creato_il, aggiornato_il) VALUES ('t1','e1','Ragù','2026-12-24','v1',1,1)")
    run("INSERT INTO snapshot_eventi (id, evento_id, stato, versione_formato, contenuto, creato_il) VALUES ('s1','e1','valido',1,'{}',1)")
    run("DELETE FROM eventi WHERE id = 'e1'")
    for (const t of ['portate_evento', 'voci_menu', 'articoli_spesa', 'attivita', 'snapshot_eventi']) expect(conta(t)).toBe(0)
  })
  it('una portata con voci non si elimina', () => {
    evento()
    portata('p1')
    voce('v1')
    expect(() => run("DELETE FROM portate_evento WHERE id = 'p1'")).toThrow(/FOREIGN KEY/)
  })
  it('eliminare una voce lascia l\'attività senza collegamento', () => {
    evento()
    portata('p1')
    voce('v1')
    run("INSERT INTO attivita (id, evento_id, titolo, data, voce_menu_id, creato_il, aggiornato_il) VALUES ('t1','e1','Ragù','2026-12-24','v1',1,1)")
    run("DELETE FROM voci_menu WHERE id = 'v1'")
    expect(uno(p.db, "SELECT voce_menu_id FROM attivita WHERE id = 't1'")).toEqual({ voce_menu_id: null })
  })
  it('eliminare un piatto lascia la voce con il suo nome e senza piatto', () => {
    evento()
    portata('p1')
    piatto('d1')
    voce('v1', 'e1', 'p1', 'd1')
    run("INSERT INTO ingredienti_piatto (id, piatto_id, ordine, testo_originale, nome, scalatura, stato_parsing) VALUES ('x','d1',0,'burro','burro','proporzionale','certo')")
    run("DELETE FROM piatti WHERE id = 'd1'")
    expect(uno(p.db, "SELECT nome, piatto_id FROM voci_menu WHERE id = 'v1'")).toEqual({ nome: 'Lasagne', piatto_id: null })
    expect(conta('ingredienti_piatto')).toBe(0)
  })
  it('eliminare un ingrediente di catalogo scollega gli ingredienti dei piatti ed elimina i sinonimi', () => {
    ingrediente('i1')
    run("INSERT INTO sinonimi_ingrediente VALUES ('i1', 'Burrino', 'burrino')")
    piatto('d1')
    run("INSERT INTO ingredienti_piatto (id, piatto_id, ordine, testo_originale, nome, ingrediente_id, scalatura, stato_parsing) VALUES ('x','d1',0,'burro','burro','i1','proporzionale','certo')")
    run("DELETE FROM ingredienti WHERE id = 'i1'")
    expect(uno(p.db, "SELECT nome, ingrediente_id FROM ingredienti_piatto WHERE id = 'x'")).toEqual({ nome: 'burro', ingrediente_id: null })
    expect(conta('sinonimi_ingrediente')).toBe(0)
  })
  it('un reparto con ingredienti non si elimina', () => {
    run("INSERT INTO reparti (id, nome, nome_norm, ordine, creato_il, aggiornato_il) VALUES ('rep-prova','Prova','prova',99,1,1)")
    ingrediente('i1', 'rep-prova')
    expect(() => run("DELETE FROM reparti WHERE id = 'rep-prova'")).toThrow(/FOREIGN KEY/)
  })
  it('eliminare un reparto azzera il reparto scelto sugli articoli di spesa', () => {
    run("INSERT INTO reparti (id, nome, nome_norm, ordine, creato_il, aggiornato_il) VALUES ('rep-prova2','Prova','prova2',99,1,1)")
    evento()
    run("INSERT INTO articoli_spesa (id, evento_id, tipo, nome, reparto_id, creato_il, aggiornato_il) VALUES ('a1','e1','manuale','Ghiaccio','rep-prova2',1,1)")
    run("DELETE FROM reparti WHERE id = 'rep-prova2'")
    expect(uno(p.db, "SELECT reparto_id FROM articoli_spesa WHERE id = 'a1'")).toEqual({ reparto_id: null })
  })
})
