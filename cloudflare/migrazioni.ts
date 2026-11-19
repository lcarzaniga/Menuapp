// Migrazioni incluse nel Worker come testo (SPEC §32.2): stessi file del server, stesso ordine.
import { createHash } from 'node:crypto'
import type { Migrazione } from '../server/db/migrazioni/applica.ts'
import m0001 from '../server/db/migrazioni/0001_iniziale.sql'
import m0002 from '../server/db/migrazioni/0002_foto.sql'
import m0003 from '../server/db/migrazioni/0003_foto_passi.sql'
import m0004 from '../server/db/migrazioni/0004_stili_stampa.sql'
import m0005 from '../server/db/migrazioni/0005_utenti.sql'
import m0006 from '../server/db/migrazioni/0006_visibilita_piatti.sql'
import m0007 from '../server/db/migrazioni/0007_famiglia.sql'
import m0008 from '../server/db/migrazioni/0008_famiglie.sql'
import m0009 from '../server/db/migrazioni/0009_persone_esterne.sql'
import m0010 from '../server/db/migrazioni/0010_partecipanti.sql'
import m0011 from '../server/db/migrazioni/0011_edizioni.sql'
import m0012 from '../server/db/migrazioni/0012_origine_voci.sql'
import m0013 from '../server/db/migrazioni/0013_ricorrenze.sql'
import m0014 from '../server/db/migrazioni/0014_dettagli_notifiche.sql'
import m0015 from '../server/db/migrazioni/0015_ricorrenze_standard.sql'
import m0016 from '../server/db/migrazioni/0016_famiglia_origine.sql'
import m0017 from '../server/db/migrazioni/0017_ricette_pubbliche.sql'
import m0018 from '../server/db/migrazioni/0018_incarico_precedente.sql'
import m0019 from '../server/db/migrazioni/0019_contributi_da_definire.sql'
import m0020 from '../server/db/migrazioni/0020_memoria_di_famiglia.sql'

const FILE: [string, string][] = [
  ['0001_iniziale.sql', m0001],
  ['0002_foto.sql', m0002],
  ['0003_foto_passi.sql', m0003],
  ['0004_stili_stampa.sql', m0004],
  ['0005_utenti.sql', m0005],
  ['0006_visibilita_piatti.sql', m0006],
  ['0007_famiglia.sql', m0007],
  ['0008_famiglie.sql', m0008],
  ['0009_persone_esterne.sql', m0009],
  ['0010_partecipanti.sql', m0010],
  ['0011_edizioni.sql', m0011],
  ['0012_origine_voci.sql', m0012],
  ['0013_ricorrenze.sql', m0013],
  ['0014_dettagli_notifiche.sql', m0014],
  ['0015_ricorrenze_standard.sql', m0015],
  ['0016_famiglia_origine.sql', m0016],
  ['0017_ricette_pubbliche.sql', m0017],
  ['0018_incarico_precedente.sql', m0018],
  ['0019_contributi_da_definire.sql', m0019],
  ['0020_memoria_di_famiglia.sql', m0020],
]

export const MIGRAZIONI: Migrazione[] = FILE.map(([nome, sql], i) => {
  if (Number(nome.slice(0, 4)) !== i + 1) throw new Error(`Numerazione delle migrazioni non continua: ${nome}`)
  return { versione: i + 1, nome, sql, sha256: createHash('sha256').update(sql).digest('hex') }
})
