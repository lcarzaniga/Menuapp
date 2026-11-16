// Partecipanti e coperti (SPEC §24): conteggio delle presenze e coperti effettivi. Unico
// punto che decide quanti adulti e bambini valgono per menù, porzioni, spesa e stampa.

export const STATI_PRESENZA = ['in_attesa', 'confermato', 'assente'] as const
export type StatoPresenza = (typeof STATI_PRESENZA)[number]
export const CATEGORIE_PERSONA = ['adulto', 'bambino'] as const
export type CategoriaPersona = (typeof CATEGORIE_PERSONA)[number]

/** Accompagnatori senza nome di un invito: quantità per categoria e stato. */
export interface Anonimi {
  adultiConfermati: number
  adultiInAttesa: number
  bambiniConfermati: number
  bambiniInAttesa: number
}
export const NESSUN_ANONIMO: Anonimi = { adultiConfermati: 0, adultiInAttesa: 0, bambiniConfermati: 0, bambiniInAttesa: 0 }

/** Una persona con un nome: titolare di un invito (`invitoId` null) o accompagnatore nominativo. */
export interface Presenza {
  id: string
  invitoId: string | null
  categoria: CategoriaPersona
  stato: StatoPresenza
  /** Solo sui titolari. */
  anonimi: Anonimi
}

export interface Conteggio {
  confermati: number
  inAttesa: number
  assenti: number
}
export interface ConteggioPresenze {
  adulti: Conteggio
  bambini: Conteggio
  /** Inviti (titolari) e persone in tutto, accompagnatori senza nome compresi. */
  inviti: number
  persone: number
}

const vuoto = (): Conteggio => ({ confermati: 0, inAttesa: 0, assenti: 0 })

/**
 * Conta ogni persona una volta: le righe con un nome (titolari e accompagnatori, ciascuno con il
 * suo stato) più le quantità senza nome dei titolari. Gli stati sono indipendenti: se il titolare
 * non viene, i suoi accompagnatori confermati restano confermati finché non li si cambia.
 */
export function contaPresenze(presenze: readonly Presenza[]): ConteggioPresenze {
  const c = { adulti: vuoto(), bambini: vuoto(), inviti: 0, persone: 0 }
  for (const p of presenze) {
    const k = p.categoria === 'bambino' ? c.bambini : c.adulti
    if (p.stato === 'confermato') k.confermati++
    else if (p.stato === 'in_attesa') k.inAttesa++
    else k.assenti++
    c.persone++
    if (p.invitoId === null) {
      c.inviti++
      c.adulti.confermati += p.anonimi.adultiConfermati
      c.adulti.inAttesa += p.anonimi.adultiInAttesa
      c.bambini.confermati += p.anonimi.bambiniConfermati
      c.bambini.inAttesa += p.anonimi.bambiniInAttesa
      c.persone += totaleAnonimi(p.anonimi)
    }
  }
  return c
}

export const totaleAnonimi = (a: Anonimi) => a.adultiConfermati + a.adultiInAttesa + a.bambiniConfermati + a.bambiniInAttesa

export interface ImpostazioneCoperti {
  /** Numeri scritti a mano (restano salvati anche in modalità automatica). */
  adulti: number
  bambini: number
  copertiAutomatici: boolean
}

/**
 * Adulti e bambini che valgono per l'evento: i numeri manuali, oppure i confermati (accompagnatori
 * compresi; in attesa e assenti esclusi) quando i coperti sono calcolati dai partecipanti.
 */
export function copertiEffettivi(e: ImpostazioneCoperti, presenze: readonly Presenza[]): { adulti: number; bambini: number } {
  if (!e.copertiAutomatici) return { adulti: e.adulti, bambini: e.bambini }
  const c = contaPresenze(presenze)
  return { adulti: c.adulti.confermati, bambini: c.bambini.confermati }
}

/**
 * Il responsabile di un incarico è questa persona? Per collegamento (utente o rubrica) quando
 * c'è, altrimenti per nome normalizzato (un nome scritto a mano in «A cura di»).
 */
export function stessaPersona(
  responsabile: { incaricatoId: string | null; esternoId: string | null; nomeNorm: string },
  persona: { utenteId: string | null; esternoId: string | null; nomeNorm: string },
): boolean {
  if (!responsabile.nomeNorm) return false
  if (responsabile.incaricatoId || persona.utenteId) return responsabile.incaricatoId !== null && responsabile.incaricatoId === persona.utenteId
  if (responsabile.esternoId && persona.esternoId) return responsabile.esternoId === persona.esternoId
  return responsabile.nomeNorm === persona.nomeNorm
}
