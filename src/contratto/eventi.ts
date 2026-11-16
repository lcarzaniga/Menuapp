// Contratto API: eventi, portate e voci di menù (SPEC §12.4).
import { z } from 'zod'
import { SchemaPersona } from './accesso.ts'
import { STATI_EVENTO, TIPI_EVENTO } from '../domain/tipi.ts'
import { DataISO, Epoch, Id, NomeObbligatorio, Ora, TestoBreve, TestoLungo, Versione } from './comune.ts'
import { Coefficiente } from './impostazioni.ts'

const Persone = z.number().int('Numero intero').min(0, 'Non può essere negativo').max(999)

export const SchemaPortata = z.object({ id: Id, nome: NomeObbligatorio, ordine: z.number().int().min(0) })

export const SchemaEvento = z.object({
  id: Id,
  nome: z.string(),
  data: DataISO,
  oraServizio: Ora.nullable(),
  tipo: z.enum(TIPI_EVENTO),
  occasione: z.string(),
  adulti: z.number().int(),
  bambini: z.number().int(),
  coefficienteBambini: z.number(),
  copertiAutomatici: z.boolean(),
  copertiManuali: z.object({ adulti: z.number().int(), bambini: z.number().int() }),
  maxAccompagnatori: z.number().int().nullable(),
  serieId: Id.nullable(),
  note: z.string(),
  stato: z.enum(STATI_EVENTO),
  conclusoIl: Epoch.nullable(),
  archiviatoIl: Epoch.nullable(),
  portate: z.array(SchemaPortata),
  versione: Versione,
  creatoIl: Epoch,
  aggiornatoIl: Epoch,
})

export const SchemaRiepilogoEvento = SchemaEvento.extend({
  numeroVoci: z.number().int(),
  copertiEquivalenti: z.number(),
  proprietario: SchemaPersona,
  /** Permesso dell'utente corrente: suo, oppure condiviso in modifica o lettura. */
  permesso: z.enum(['proprietario', 'modifica', 'lettura']),
  /** Famiglia dell'evento (null: evento personale, fuori dalle Famiglie). */
  gruppo: SchemaPersona.nullable(),
})
export type RiepilogoEvento = z.infer<typeof SchemaRiepilogoEvento>

const CampiEvento = {
  nome: NomeObbligatorio,
  data: DataISO,
  oraServizio: Ora.nullable(),
  tipo: z.enum(TIPI_EVENTO),
  occasione: TestoBreve,
  adulti: Persone,
  bambini: Persone,
  coefficienteBambini: Coefficiente,
  note: TestoLungo,
}

export const SchemaNuovoEvento = z.object({
  id: Id,
  /** Famiglia dell'evento (verificata sul server). Assente: l'unica Famiglia dell'autore, se ne ha una. */
  gruppoId: Id.nullable().optional(),
  ...CampiEvento,
  coefficienteBambini: Coefficiente.optional(),
  /** Assenti: copiate dalle portate predefinite. */
  portate: z.array(z.object({ id: Id, nome: NomeObbligatorio })).max(30).optional(),
})
export type NuovoEvento = z.infer<typeof SchemaNuovoEvento>

export const SchemaAggiornaEvento = z.object({
  ...CampiEvento,
  portate: z.array(z.object({ id: Id, nome: NomeObbligatorio })).min(1, 'Serve almeno una portata').max(30),
  versione: Versione,
})
export type AggiornaEvento = z.infer<typeof SchemaAggiornaEvento>

export const SchemaVoceMenu = z.object({
  id: Id,
  eventoId: Id,
  portataId: Id,
  ordine: z.number().int(),
  nome: z.string(),
  piattoId: Id.nullable(),
  porzioni: z.number().nullable(),
  incaricato: z.string(),
  inSpesa: z.boolean(),
  note: z.string(),
  versione: Versione,
  creatoIl: Epoch,
  aggiornatoIl: Epoch,
})

const Porzioni = z.number().positive('Le porzioni devono essere più di zero').max(10_000).nullable()

export const SchemaNuovaVoce = z.object({
  id: Id,
  portataId: Id,
  nome: NomeObbligatorio,
  piattoId: Id.nullable().optional(),
  porzioni: Porzioni.optional(),
  incaricato: TestoBreve.optional(),
  inSpesa: z.boolean().optional(),
  note: TestoLungo.optional(),
  /** Posizione nella portata (per «Annulla» dopo un'eliminazione); assente = in fondo. */
  ordine: z.number().int().min(0).optional(),
})
export type NuovaVoce = z.infer<typeof SchemaNuovaVoce>

export const SchemaNuoveVoci = z.object({ voci: z.array(SchemaNuovaVoce).min(1).max(100) })

export const SchemaAggiornaVoce = z.object({
  nome: NomeObbligatorio,
  piattoId: Id.nullable(),
  porzioni: Porzioni,
  incaricato: TestoBreve,
  inSpesa: z.boolean(),
  note: TestoLungo,
  versione: Versione,
})
export type AggiornaVoce = z.infer<typeof SchemaAggiornaVoce>

export const SchemaRiordinoVoci = z.object({
  portataId: Id,
  voci: z.array(z.object({ id: Id, versione: Versione })).max(500),
})
export type RiordinoVoci = z.infer<typeof SchemaRiordinoVoci>

export const SchemaMenu = z.object({
  evento: SchemaEvento,
  copertiEquivalenti: z.number(),
  portate: z.array(SchemaPortata.extend({ voci: z.array(SchemaVoceMenu.extend({ piattoNome: z.string().nullable(), porzioniEffettive: z.number() })) })),
})
export type Menu = z.infer<typeof SchemaMenu>
export type VoceDelMenu = Menu['portate'][number]['voci'][number]
