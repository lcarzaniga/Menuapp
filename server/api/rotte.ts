// Registro di tutte le rotte API.
import type { FastifyInstance } from 'fastify'
import type { Ingresso } from '../../src/contratto/accesso.ts'
import type { Contesto } from './aiuti.ts'
import { rotteSessione } from './sessione.ts'
import { rotteFamiglia } from './famiglia.ts'
import { rottePartecipanti } from './partecipanti.ts'
import { rotteEdizioni } from './edizioni.ts'
import { rotteEventi } from './eventi.ts'
import { rotteRicettario } from './ricettario.ts'
import { rotteSpesa } from './spesa.ts'
import { rotteFoto } from './foto.ts'
import { rotteMemoria } from './memoria.ts'
import { rotteCollaborazione } from './collaborazione.ts'
import { rotteSistema } from './sistema.ts'
import { rotteStampa } from './stampa.ts'

export function registraRotte(app: FastifyInstance, ctx: Contesto, ingresso: Ingresso): void {
  rotteSistema(app, ctx, ingresso)
  rotteSessione(app, ctx, ingresso)
  rotteEventi(app, ctx)
  rotteRicettario(app, ctx)
  rotteSpesa(app, ctx)
  rotteFoto(app, ctx)
  rotteMemoria(app, ctx)
  rotteCollaborazione(app, ctx)
  rotteStampa(app, ctx)
  rotteFamiglia(app, ctx)
  rottePartecipanti(app, ctx)
  rotteEdizioni(app, ctx)
}
